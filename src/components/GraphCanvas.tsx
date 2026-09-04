import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { Activity, LifeArea, ViewportSettings, ActivityNode } from '../types';
import { getTemperatureColor, getTemperatureLabel } from '../utils/colors';
import { useTheme } from '../context/ThemeContext';
import { ZoomIn, ZoomOut, RotateCcw, Pause, Play, Layers } from 'lucide-react';

interface GraphCanvasProps {
  activities: Activity[];
  areas: LifeArea[];
  settings: ViewportSettings;
  onSelectActivity: (activity: Activity) => void;
  onToggleAreaVisibility: (areaId: string) => void;
  onOpenNewActivity: () => void;
}

interface HoverInfo {
  x: number;
  y: number;
  activity: Activity;
}

export const GraphCanvas: React.FC<GraphCanvasProps> = ({
  activities,
  areas,
  settings,
  onSelectActivity,
}) => {
  const { theme, themeConfig } = useTheme();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hovered, setHovered] = useState<HoverInfo | null>(null);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [showMiniLegend, setShowMiniLegend] = useState<boolean>(false);

  // Map areas by ID
  const areaMap = useMemo(() => {
    const map = new Map<string, LifeArea>();
    areas.forEach((a) => map.set(a.id, a));
    return map;
  }, [areas]);

  // Filter activities
  const visibleActivities = useMemo(() => {
    return activities.filter((act) => {
      const hasVisibleArea = act.areaIds.some((id) => {
        const area = areaMap.get(id);
        const isAreaVisible = area ? area.visible : true;
        const passesFilter =
          settings.activeAreaFilters.length === 0 ||
          settings.activeAreaFilters.includes(id);
        return isAreaVisible && passesFilter;
      });
      return hasVisibleArea;
    });
  }, [activities, areaMap, settings.activeAreaFilters]);

  const simulationRef = useRef<d3.Simulation<ActivityNode, undefined> | null>(null);
  const nodesRef = useRef<ActivityNode[]>([]);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // Simulation Setup
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 600;
    const centerX = width / 2;
    const centerY = height / 2;

    const activeAreas = areas.filter((a) => a.visible);
    const areaCentroids = new Map<string, { x: number; y: number }>();
    const angleStep = (2 * Math.PI) / (activeAreas.length || 1);
    const orbitRadius = Math.min(width, height) * 0.30;

    activeAreas.forEach((area, index) => {
      const angle = index * angleStep - Math.PI / 2;
      areaCentroids.set(area.id, {
        x: centerX + orbitRadius * Math.cos(angle),
        y: centerY + orbitRadius * Math.sin(angle),
      });
    });

    const prevNodesMap = new Map<string, ActivityNode>();
    nodesRef.current.forEach((n) => prevNodesMap.set(n.id, n));

    const newNodes: ActivityNode[] = visibleActivities.map((act) => {
      const prev = prevNodesMap.get(act.id);
      // Ethereal scaling: clean proportions
      const radius = Math.max(18, Math.min(54, 15 + Math.sqrt(Math.max(0.2, act.hours)) * 13));
      const color = getTemperatureColor(act.temperature, theme);

      let targetX = centerX;
      let targetY = centerY;
      if (act.areaIds.length > 0) {
        let sumX = 0;
        let sumY = 0;
        let count = 0;
        act.areaIds.forEach((id) => {
          const c = areaCentroids.get(id);
          if (c) {
            sumX += c.x;
            sumY += c.y;
            count++;
          }
        });
        if (count > 0) {
          targetX = sumX / count;
          targetY = sumY / count;
        }
      }

      return {
        id: act.id,
        activity: act,
        radius,
        color,
        x: prev?.x ?? targetX + (Math.random() - 0.5) * 60,
        y: prev?.y ?? targetY + (Math.random() - 0.5) * 60,
        vx: prev?.vx ?? 0,
        vy: prev?.vy ?? 0,
      };
    });

    nodesRef.current = newNodes;

    const simulation = d3
      .forceSimulation<ActivityNode>(newNodes)
      .force('charge', d3.forceManyBody().strength(-150).distanceMax(400))
      .force(
        'collision',
        d3.forceCollide<ActivityNode>().radius((d) => d.radius + 10).iterations(3)
      )
      .force(
        'x',
        d3.forceX<ActivityNode>((d) => {
          if (d.activity.areaIds.length === 0) return centerX;
          let sum = 0;
          let count = 0;
          d.activity.areaIds.forEach((aid) => {
            const c = areaCentroids.get(aid);
            if (c) {
              sum += c.x;
              count++;
            }
          });
          return count > 0 ? sum / count : centerX;
        }).strength(0.14)
      )
      .force(
        'y',
        d3.forceY<ActivityNode>((d) => {
          if (d.activity.areaIds.length === 0) return centerY;
          let sum = 0;
          let count = 0;
          d.activity.areaIds.forEach((aid) => {
            const c = areaCentroids.get(aid);
            if (c) {
              sum += c.y;
              count++;
            }
          });
          return count > 0 ? sum / count : centerY;
        }).strength(0.14)
      )
      .alphaDecay(0.02)
      .velocityDecay(0.38);

    simulationRef.current = simulation;

    const svg = d3.select(svgRef.current);
    const g = svg.select<SVGGElement>('#graph-container');

    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.25, 4.0])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString());
      });

    zoomBehaviorRef.current = zoomBehavior;
    svg.call(zoomBehavior);

    simulation.on('tick', () => {
      // 1. Fluid Ultra-thin Area Hulls
      renderFluidAreaHulls(g, activeAreas, newNodes, settings.showAreaHulls);

      // 2. Constellation Nodes
      const nodeSelection = g
        .select<SVGGElement>('#nodes-group')
        .selectAll<SVGGElement, ActivityNode>('.activity-node')
        .data(newNodes, (d) => d.id);

      nodeSelection.exit().remove();

      const enter = nodeSelection
        .enter()
        .append('g')
        .attr('class', 'activity-node cursor-pointer select-none')
        .call(
          d3
            .drag<SVGGElement, ActivityNode>()
            .on('start', (event, d) => {
              if (!event.active) simulation.alphaTarget(0.3).restart();
              d.fx = d.x;
              d.fy = d.y;
            })
            .on('drag', (event, d) => {
              d.fx = event.x;
              d.fy = event.y;
            })
            .on('end', (event, d) => {
              if (!event.active) simulation.alphaTarget(0);
              d.fx = null;
              d.fy = null;
            })
        );

      // Subtle atmospheric aura (ambient glow on hover)
      enter
        .append('circle')
        .attr('class', 'node-aura pointer-events-none transition-all duration-300')
        .attr('fill', (d) => d.color)
        .attr('opacity', 0);

      // Multi-area delicate outer ring (1px)
      enter
        .append('circle')
        .attr('class', 'node-subring pointer-events-none')
        .attr('fill', 'none')
        .attr('stroke-width', 1)
        .attr('stroke-opacity', 0.4);

      // Main matte circular node
      enter
        .append('circle')
        .attr('class', 'node-body transition-transform duration-200')
        .attr('stroke', themeConfig.textPrimary)
        .attr('stroke-width', 0.75)
        .attr('stroke-opacity', 0.25);

      // Activity Name Label (Clean typography)
      enter
        .append('text')
        .attr('class', 'node-label pointer-events-none font-medium text-center select-none')
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em');

      // Hours indicator
      enter
        .append('text')
        .attr('class', 'node-hours pointer-events-none text-[10px] select-none')
        .attr('text-anchor', 'middle')
        .attr('dy', '1.55em');

      const allNodes = enter.merge(nodeSelection);

      allNodes.attr('transform', (d) => `translate(${d.x || 0}, ${d.y || 0})`);

      allNodes
        .select('.node-aura')
        .attr('r', (d) => d.radius + 10)
        .attr('fill', (d) => d.color);

      allNodes
        .select('.node-subring')
        .attr('r', (d) => d.radius + 3)
        .attr('stroke', (d) => {
          if (d.activity.areaIds.length > 1) {
            const a2 = areaMap.get(d.activity.areaIds[1]);
            return a2 ? a2.color : d.color;
          }
          return 'transparent';
        });

      allNodes
        .select('.node-body')
        .attr('r', (d) => d.radius)
        .attr('fill', (d) => d.color)
        .attr('fill-opacity', 0.88)
        .attr('stroke', themeConfig.textPrimary);

      allNodes
        .select('.node-label')
        .style('display', settings.showLabels ? 'block' : 'none')
        .style('font-size', (d) => `${Math.max(10, Math.min(12, d.radius * 0.42))}px`)
        .attr('fill', '#ffffff')
        .attr('fill-opacity', 0.95)
        .attr('class', `node-label pointer-events-none font-medium text-center ${themeConfig.fontFamily}`)
        .text((d) => {
          const maxChars = Math.floor(d.radius / 3.4);
          return d.activity.name.length > maxChars
            ? d.activity.name.slice(0, maxChars) + '…'
            : d.activity.name;
        });

      allNodes
        .select('.node-hours')
        .style('display', settings.showLabels && settings.viewMode !== 'global' ? 'block' : 'none')
        .attr('fill', '#ffffff')
        .attr('fill-opacity', 0.6)
        .attr('class', `node-hours pointer-events-none text-[10px] ${themeConfig.fontFamily}`)
        .text((d) => `${d.activity.hours}h`);

      // Mouse events
      allNodes
        .on('mouseenter', (event, d) => {
          const rect = containerRef.current?.getBoundingClientRect();
          if (rect) {
            setHovered({
              x: event.clientX - rect.left,
              y: event.clientY - rect.top,
              activity: d.activity,
            });
          }
          // Activate delicate aura on hover
          d3.select(event.currentTarget)
            .select('.node-aura')
            .transition()
            .duration(200)
            .attr('opacity', 0.28)
            .attr('r', d.radius + 14);

          d3.select(event.currentTarget)
            .select('.node-body')
            .transition()
            .duration(150)
            .attr('fill-opacity', 1)
            .attr('stroke-opacity', 0.6);
        })
        .on('mousemove', (event) => {
          const rect = containerRef.current?.getBoundingClientRect();
          if (rect) {
            setHovered((prev) =>
              prev ? { ...prev, x: event.clientX - rect.left, y: event.clientY - rect.top } : null
            );
          }
        })
        .on('mouseleave', (event, d) => {
          setHovered(null);
          d3.select(event.currentTarget)
            .select('.node-aura')
            .transition()
            .duration(200)
            .attr('opacity', 0)
            .attr('r', d.radius + 10);

          d3.select(event.currentTarget)
            .select('.node-body')
            .transition()
            .duration(150)
            .attr('fill-opacity', 0.88)
            .attr('stroke-opacity', 0.25);
        })
        .on('click', (_event, d) => {
          onSelectActivity(d.activity);
        });
    });

    return () => {
      simulation.stop();
    };
  }, [visibleActivities, areas, settings, onSelectActivity, areaMap, theme, themeConfig]);

  // Fluid Ultra-thin Spline Area Delimitation
  const renderFluidAreaHulls = (
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    activeAreas: LifeArea[],
    currentNodes: ActivityNode[],
    showHulls: boolean
  ) => {
    const hullsGroup = g.select<SVGGElement>('#hulls-group');

    if (!showHulls) {
      hullsGroup.selectAll('*').remove();
      return;
    }

    const hullData: Array<{ area: LifeArea; path: string }> = [];

    activeAreas.forEach((area) => {
      const nodesInArea = currentNodes.filter(
        (n) => n.activity.areaIds.includes(area.id) && n.x != null && n.y != null
      );

      if (nodesInArea.length === 0) return;

      const padding = 38;

      if (nodesInArea.length === 1) {
        const n = nodesInArea[0];
        const r = n.radius + padding;
        const p = `M ${n.x! - r}, ${n.y!} a ${r},${r} 0 1,0 ${r * 2},0 a ${r},${r} 0 1,0 -${r * 2},0`;
        hullData.push({ area, path: p });
      } else if (nodesInArea.length === 2) {
        const n1 = nodesInArea[0];
        const n2 = nodesInArea[1];
        const dx = n2.x! - n1.x!;
        const dy = n2.y! - n1.y!;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const r1 = n1.radius + padding;
        const r2 = n2.radius + padding;
        const nx = -dy / dist;
        const ny = dx / dist;

        const p =
          `M ${n1.x! + nx * r1} ${n1.y! + ny * r1} ` +
          `L ${n2.x! + nx * r2} ${n2.y! + ny * r2} ` +
          `A ${r2} ${r2} 0 0 1 ${n2.x! - nx * r2} ${n2.y! - ny * r2} ` +
          `L ${n1.x! - nx * r1} ${n1.y! - ny * r1} ` +
          `A ${r1} ${r1} 0 0 1 ${n1.x! + nx * r1} ${n1.y! + ny * r1} Z`;
        hullData.push({ area, path: p });
      } else {
        const points: [number, number][] = [];
        nodesInArea.forEach((n) => {
          const r = n.radius + padding;
          for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
            points.push([n.x! + Math.cos(a) * r, n.y! + Math.sin(a) * r]);
          }
        });

        const hull = d3.polygonHull(points);
        if (hull) {
          const curve = d3.line().curve(d3.curveCatmullRomClosed);
          const path = curve(hull);
          if (path) {
            hullData.push({ area, path });
          }
        }
      }
    });

    const hullSel = hullsGroup
      .selectAll<SVGPathElement, { area: LifeArea; path: string }>('.area-hull')
      .data(hullData, (d) => d.area.id);

    hullSel.exit().remove();

    hullSel
      .enter()
      .append('path')
      .attr('class', 'area-hull transition-all duration-500 pointer-events-none')
      .merge(hullSel)
      .attr('d', (d) => d.path)
      .attr('fill', (d) => d.area.color)
      .attr('fill-opacity', 0.03) // Ethereal subtle fill
      .attr('stroke', (d) => d.area.color)
      .attr('stroke-width', 1) // Ultra-thin 1px stroke
      .attr('stroke-opacity', 0.22);
  };

  // Zoom controls
  const handleZoomIn = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current).transition().duration(250).call(zoomBehaviorRef.current.scaleBy, 1.3);
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current).transition().duration(250).call(zoomBehaviorRef.current.scaleBy, 0.77);
    }
  };

  const handleResetView = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(400)
        .call(zoomBehaviorRef.current.transform, d3.zoomIdentity);
    }
  };

  const handleToggleSimulation = () => {
    if (!simulationRef.current) return;
    if (isPaused) {
      simulationRef.current.alphaTarget(0.1).restart();
      setIsPaused(false);
    } else {
      simulationRef.current.stop();
      setIsPaused(true);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden transition-colors duration-500"
      style={{ backgroundColor: themeConfig.bgCanvas }}
    >
      {/* SVG Canvas */}
      <svg ref={svgRef} className="w-full h-full cursor-crosshair">
        <g id="graph-container">
          <g id="hulls-group" />
          <g id="nodes-group" />
        </g>
      </svg>

      {/* Floating Canvas Quick Controls (Minimal Pill in bottom-left) */}
      <div
        className="absolute bottom-6 left-6 flex items-center gap-1 p-1 rounded-full backdrop-blur-xl transition-all duration-300 z-20 shadow-lg"
        style={{
          backgroundColor: `${themeConfig.bgSurface}cc`,
          border: `1px solid ${themeConfig.borderSubtle}`,
        }}
      >
        <button
          onClick={handleZoomIn}
          title="Zoom In"
          className="p-2 rounded-full hover:opacity-80 transition-opacity"
          style={{ color: themeConfig.textSecondary }}
        >
          <ZoomIn size={14} />
        </button>
        <button
          onClick={handleZoomOut}
          title="Zoom Out"
          className="p-2 rounded-full hover:opacity-80 transition-opacity"
          style={{ color: themeConfig.textSecondary }}
        >
          <ZoomOut size={14} />
        </button>
        <button
          onClick={handleResetView}
          title="Centrar"
          className="p-2 rounded-full hover:opacity-80 transition-opacity"
          style={{ color: themeConfig.textSecondary }}
        >
          <RotateCcw size={14} />
        </button>
        <div className="w-[1px] h-3.5 mx-0.5" style={{ backgroundColor: themeConfig.borderSubtle }} />
        <button
          onClick={handleToggleSimulation}
          title={isPaused ? 'Reanudar física (Espacio)' : 'Pausar física (Espacio)'}
          className="p-2 rounded-full transition-colors"
          style={{ color: isPaused ? themeConfig.accent : themeConfig.textSecondary }}
        >
          {isPaused ? <Play size={14} /> : <Pause size={14} />}
        </button>
        <div className="w-[1px] h-3.5 mx-0.5" style={{ backgroundColor: themeConfig.borderSubtle }} />
        <button
          onClick={() => setShowMiniLegend((prev) => !prev)}
          title="Leyenda de Aspectos"
          className="p-2 rounded-full hover:opacity-80 transition-opacity"
          style={{ color: showMiniLegend ? themeConfig.accent : themeConfig.textSecondary }}
        >
          <Layers size={14} />
        </button>
      </div>

      {/* Minimal Floating Legend Drawer (Toggleable) */}
      {showMiniLegend && (
        <div
          className="absolute bottom-16 left-6 p-3 rounded-2xl backdrop-blur-xl border z-20 shadow-2xl space-y-2 animate-fadeIn max-w-xs"
          style={{
            backgroundColor: `${themeConfig.bgSurface}f0`,
            borderColor: themeConfig.borderSubtle,
          }}
        >
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider" style={{ color: themeConfig.textMuted }}>
            <span>Aspectos de Vida</span>
            <span>{areas.filter((a) => a.visible).length}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {areas.map((area) => {
              const count = activities.filter((a) => a.areaIds.includes(area.id)).length;
              return (
                <div
                  key={area.id}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs"
                  style={{
                    backgroundColor: `${themeConfig.bgElevated}90`,
                    border: `1px solid ${themeConfig.borderSubtle}`,
                    color: themeConfig.textSecondary,
                  }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: area.color }} />
                  <span>{area.name}</span>
                  <span className="text-[10px] opacity-60">({count})</span>
                </div>
              );
            })}
          </div>

          {/* EM Scale hint */}
          <div className="pt-2 border-t" style={{ borderColor: themeConfig.borderSubtle }}>
            <div className="flex justify-between text-[10px] mb-1" style={{ color: themeConfig.textMuted }}>
              <span>Drenante (-5)</span>
              <span>Neutro (0)</span>
              <span>Flujo (+5)</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-gradient-to-r from-rose-500 via-slate-400 to-indigo-500 opacity-80" />
          </div>
        </div>
      )}

      {/* Subtle Ethereal Tooltip Card */}
      {hovered && (
        <div
          className="absolute z-50 pointer-events-none transform -translate-x-1/2 -translate-y-[120%] transition-transform duration-75"
          style={{ left: hovered.x, top: hovered.y }}
        >
          <div
            className="p-3 rounded-xl backdrop-blur-2xl shadow-2xl text-xs space-y-2 min-w-[190px] border"
            style={{
              backgroundColor: `${themeConfig.bgSurface}f5`,
              borderColor: themeConfig.borderStrong,
              color: themeConfig.textPrimary,
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold text-sm tracking-tight">
                {hovered.activity.name}
              </span>
              <span
                className="px-2 py-0.5 rounded text-xs font-mono font-bold"
                style={{
                  backgroundColor: `${themeConfig.bgElevated}`,
                  color: themeConfig.accent,
                }}
              >
                {hovered.activity.hours}h
              </span>
            </div>

            <div className="flex flex-wrap gap-1">
              {hovered.activity.areaIds.map((aid) => {
                const area = areaMap.get(aid);
                if (!area) return null;
                return (
                  <span
                    key={aid}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]"
                    style={{
                      backgroundColor: `${themeConfig.bgElevated}90`,
                      color: themeConfig.textSecondary,
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: area.color }} />
                    {area.name}
                  </span>
                );
              })}
            </div>

            <div
              className="flex items-center justify-between pt-1.5 border-t text-[11px]"
              style={{ borderColor: themeConfig.borderSubtle }}
            >
              <span style={{ color: themeConfig.textMuted }}>Impacto:</span>
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: getTemperatureColor(hovered.activity.temperature, theme) }}
                />
                <span className={`font-medium ${getTemperatureLabel(hovered.activity.temperature).textClass}`}>
                  {hovered.activity.temperature > 0 ? `+${hovered.activity.temperature}` : hovered.activity.temperature}
                </span>
              </div>
            </div>

            {hovered.activity.notes && (
              <p
                className="text-[11px] italic pl-2 border-l"
                style={{
                  borderColor: themeConfig.borderStrong,
                  color: themeConfig.textSecondary,
                }}
              >
                "{hovered.activity.notes}"
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
