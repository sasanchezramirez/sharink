import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { Activity, LifeArea, ViewportSettings, ActivityNode } from '../types';
import { getTemperatureColor, getTemperatureLabel } from '../utils/colors';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

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
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hovered, setHovered] = useState<HoverInfo | null>(null);

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

  // Setup D3 Simulation (Obsidian-inspired pure spatial dynamics)
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || 900;
    const height = containerRef.current.clientHeight || 700;
    const centerX = width / 2;
    const centerY = height / 2;

    const activeAreas = areas.filter((a) => a.visible);
    const areaCentroids = new Map<string, { x: number; y: number }>();
    const angleStep = (2 * Math.PI) / (activeAreas.length || 1);
    const orbitRadius = Math.min(width, height) * 0.31;

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
      // Sleek, balanced node radius (13px to 30px) - clean Obsidian style
      const radius = Math.max(13, Math.min(30, 11 + Math.sqrt(Math.max(0.2, act.hours)) * 8.5));
      const color = getTemperatureColor(act.temperature);

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
        x: prev?.x ?? targetX + (Math.random() - 0.5) * 30,
        y: prev?.y ?? targetY + (Math.random() - 0.5) * 30,
        vx: prev?.vx ?? 0,
        vy: prev?.vy ?? 0,
      };
    });

    nodesRef.current = newNodes;

    const simulation = d3
      .forceSimulation<ActivityNode>(newNodes)
      .force('charge', d3.forceManyBody().strength(-100).distanceMax(350))
      .force(
        'collision',
        d3.forceCollide<ActivityNode>().radius((d) => d.radius + 8).iterations(3)
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
        }).strength(0.20)
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
        }).strength(0.20)
      )
      .alphaDecay(0.04)
      .velocityDecay(0.48);

    simulationRef.current = simulation;

    const svg = d3.select(svgRef.current);
    const g = svg.select<SVGGElement>('#graph-container');

    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3.5])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString());
      });

    zoomBehaviorRef.current = zoomBehavior;
    svg.call(zoomBehavior);

    // Render ethereal area watermarks at centroids
    const areaLabelsGroup = g.select<SVGGElement>('#area-labels-group');
    const areaLabelsData = activeAreas.map((area) => ({
      area,
      pos: areaCentroids.get(area.id) || { x: centerX, y: centerY },
    }));

    const labelSelection = areaLabelsGroup
      .selectAll<SVGTextElement, { area: LifeArea; pos: { x: number; y: number } }>('.area-watermark')
      .data(areaLabelsData, (d) => d.area.id);

    labelSelection.exit().remove();

    labelSelection
      .enter()
      .append('text')
      .attr('class', 'area-watermark pointer-events-none font-sans text-[11px] font-semibold tracking-[0.2em] uppercase select-none')
      .attr('text-anchor', 'middle')
      .attr('fill', (d) => d.area.color)
      .attr('fill-opacity', 0.22)
      .merge(labelSelection)
      .attr('x', (d) => d.pos.x)
      .attr('y', (d) => d.pos.y - 50)
      .text((d) => d.area.name);

    // Simulation Tick: Update positions
    simulation.on('tick', () => {
      const nodeSelection = g
        .select<SVGGElement>('#nodes-group')
        .selectAll<SVGGElement, ActivityNode>('.activity-node')
        .data(newNodes, (d) => d.id);

      nodeSelection.exit().remove();

      // Enter new nodes: PURE AESTHETIC DISCS (No 3D Encarta spheres, NO dotted lines)
      const enter = nodeSelection
        .enter()
        .append('g')
        .attr('class', 'activity-node cursor-pointer select-none');

      // 1. Soft Ambient Halo (Only visible on hover via CSS/opacity)
      enter
        .append('circle')
        .attr('class', 'node-glow pointer-events-none transition-all duration-300')
        .attr('opacity', 0);

      // 2. Main Flat-Matte Aesthetic Disc
      enter
        .append('circle')
        .attr('class', 'node-body transition-transform duration-200')
        .attr('stroke', 'rgba(255, 255, 255, 0.22)')
        .attr('stroke-width', 1);

      // 3. Crisp Activity Name Label
      enter
        .append('text')
        .attr('class', 'node-label pointer-events-none font-sans text-center select-none fill-white')
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .style('font-weight', '500')
        .style('text-shadow', '0 1px 3px rgba(0,0,0,0.8)');

      // 4. Hours Subtitle (Only if node is large enough)
      enter
        .append('text')
        .attr('class', 'node-hours pointer-events-none text-[8.5px] font-mono select-none fill-gray-300')
        .attr('text-anchor', 'middle')
        .attr('dy', '1.65em')
        .style('text-shadow', '0 1px 3px rgba(0,0,0,0.8)');

      const allNodes = enter.merge(nodeSelection);

      allNodes.attr('transform', (d) => `translate(${d.x || 0}, ${d.y || 0})`);

      // Soft glow
      allNodes
        .select('.node-glow')
        .attr('r', (d) => d.radius + 10)
        .attr('fill', (d) => d.color);

      // Clean flat-matte body with subtle depth
      allNodes
        .select('.node-body')
        .attr('r', (d) => d.radius)
        .attr('fill', (d) => d.color)
        .attr('fill-opacity', 0.88);

      // Label text
      allNodes
        .select('.node-label')
        .style('display', settings.showLabels ? 'block' : 'none')
        .style('font-size', (d) => `${Math.max(8.5, Math.min(10.5, d.radius * 0.42))}px`)
        .text((d) => {
          const maxChars = Math.floor(d.radius / 3.0);
          return d.activity.name.length > maxChars
            ? d.activity.name.slice(0, maxChars) + '…'
            : d.activity.name;
        });

      // Hours text
      allNodes
        .select('.node-hours')
        .style('display', settings.showLabels && settings.viewMode !== 'global' && settings.showLabels ? 'block' : 'none')
        .text((d) => (d.radius >= 18 ? `${d.activity.hours}h` : ''));

      // Clean Hover interactions
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

          // Subtle, elegant optical bloom on hover
          d3.select(event.currentTarget)
            .select('.node-glow')
            .transition()
            .duration(180)
            .attr('opacity', 0.35)
            .attr('r', d.radius + 14);

          d3.select(event.currentTarget)
            .select('.node-body')
            .transition()
            .duration(150)
            .attr('r', d.radius * 1.12)
            .attr('fill-opacity', 1)
            .attr('stroke', 'rgba(255, 255, 255, 0.6)');
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
            .select('.node-glow')
            .transition()
            .duration(180)
            .attr('opacity', 0)
            .attr('r', d.radius + 10);

          d3.select(event.currentTarget)
            .select('.node-body')
            .transition()
            .duration(150)
            .attr('r', d.radius)
            .attr('fill-opacity', 0.88)
            .attr('stroke', 'rgba(255, 255, 255, 0.22)');
        })
        .on('click', (_event, d) => {
          onSelectActivity(d.activity);
        });
    });

    return () => {
      simulation.stop();
    };
  }, [visibleActivities, areas, settings, onSelectActivity, areaMap]);

  // Zoom actions
  const handleZoomIn = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current).transition().duration(200).call(zoomBehaviorRef.current.scaleBy, 1.3);
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current).transition().duration(200).call(zoomBehaviorRef.current.scaleBy, 0.77);
    }
  };

  const handleResetView = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(300)
        .call(zoomBehaviorRef.current.transform, d3.zoomIdentity);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-[#07080c]"
    >
      <svg ref={svgRef} className="w-full h-full cursor-default">
        <defs>
          {/* Aesthetic Micro-Dot Matrix Pattern (Obsidian Canvas style) */}
          <pattern
            id="dot-grid"
            width="28"
            height="28"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="2" cy="2" r="0.9" fill="rgba(255, 255, 255, 0.055)" />
          </pattern>
        </defs>

        {/* Micro-dot spatial grid */}
        <rect width="100%" height="100%" fill="url(#dot-grid)" pointerEvents="none" />

        {/* Dynamic Graph Container */}
        <g id="graph-container">
          <g id="area-labels-group" />
          <g id="nodes-group" />
        </g>
      </svg>

      {/* Floating Canvas Quick Controls (Ultra-minimal bottom-left) */}
      <div className="absolute bottom-6 left-6 flex items-center gap-1 p-1 rounded-full bg-[#10121a]/85 backdrop-blur-xl border border-white/5 shadow-xl z-20">
        <button
          onClick={handleZoomIn}
          title="Zoom In"
          className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <ZoomIn size={14} />
        </button>
        <button
          onClick={handleZoomOut}
          title="Zoom Out"
          className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <ZoomOut size={14} />
        </button>
        <button
          onClick={handleResetView}
          title="Centrar Vista"
          className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <RotateCcw size={14} />
        </button>
      </div>

      {/* Hover Inspection Card (Ultra-sleek, clean typography) */}
      {hovered && (
        <div
          className="absolute z-50 pointer-events-none transform -translate-x-1/2 -translate-y-[120%] transition-transform duration-75"
          style={{ left: hovered.x, top: hovered.y }}
        >
          <div className="p-3 rounded-xl bg-[#0f1118]/95 backdrop-blur-2xl border border-white/10 shadow-2xl text-xs space-y-2 min-w-[190px] text-gray-100">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold text-xs tracking-tight text-white">
                {hovered.activity.name}
              </span>
              <span className="px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-white/5 text-cyan-300 border border-white/10">
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
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] bg-white/5 text-gray-300 border border-white/5"
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: area.color }} />
                    {area.name}
                  </span>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-1.5 border-t border-white/5 text-[10.5px]">
              <span className="text-gray-500">Impacto:</span>
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: getTemperatureColor(hovered.activity.temperature) }}
                />
                <span className={`font-medium ${getTemperatureLabel(hovered.activity.temperature).textClass}`}>
                  {hovered.activity.temperature > 0 ? `+${hovered.activity.temperature}` : hovered.activity.temperature}
                </span>
              </div>
            </div>

            {hovered.activity.notes && (
              <p className="text-[10px] italic pl-2 border-l border-white/10 text-gray-400">
                "{hovered.activity.notes}"
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
