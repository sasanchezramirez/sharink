import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { Activity, LifeArea, ViewportSettings, ActivityNode } from '../types';
import { getTemperatureColor, getTemperatureLabel } from '../utils/colors';
import { ZoomIn, ZoomOut, RotateCcw, Pause, Play } from 'lucide-react';

interface GraphCanvasProps {
  activities: Activity[];
  areas: LifeArea[];
  settings: ViewportSettings;
  onSelectActivity: (activity: Activity) => void;
  onUpdateAreaVisibility: (areaId: string) => void;
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
  const [isPaused, setIsPaused] = useState<boolean>(false);

  // Map areas by ID for quick lookup
  const areaMap = useMemo(() => {
    const map = new Map<string, LifeArea>();
    areas.forEach((a) => map.set(a.id, a));
    return map;
  }, [areas]);

  // Filter activities according to active filters & visibility
  const visibleActivities = useMemo(() => {
    return activities.filter((act) => {
      // Check if at least one of the activity's areas is visible
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

  // Keep references to simulation and elements
  const simulationRef = useRef<d3.Simulation<ActivityNode, undefined> | null>(null);
  const nodesRef = useRef<ActivityNode[]>([]);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // Compute layout and run simulation
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 600;
    const centerX = width / 2;
    const centerY = height / 2;

    // Calculate fixed target positions (centroids) for each Life Area in a circle
    const activeAreas = areas.filter((a) => a.visible);
    const areaCentroids = new Map<string, { x: number; y: number }>();
    const angleStep = (2 * Math.PI) / (activeAreas.length || 1);
    const orbitRadius = Math.min(width, height) * 0.28;

    activeAreas.forEach((area, index) => {
      const angle = index * angleStep - Math.PI / 2;
      areaCentroids.set(area.id, {
        x: centerX + orbitRadius * Math.cos(angle),
        y: centerY + orbitRadius * Math.sin(angle),
      });
    });

    // Build or update nodes list preserving previous positions if existing
    const prevNodesMap = new Map<string, ActivityNode>();
    nodesRef.current.forEach((n) => prevNodesMap.set(n.id, n));

    const newNodes: ActivityNode[] = visibleActivities.map((act) => {
      const prev = prevNodesMap.get(act.id);
      // Base radius proportional to sqrt of hours
      const radius = Math.max(22, Math.min(65, 18 + Math.sqrt(Math.max(0.2, act.hours)) * 15));
      const color = getTemperatureColor(act.temperature);

      // Target cluster centroid (average of associated areas)
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
        x: prev?.x ?? targetX + (Math.random() - 0.5) * 80,
        y: prev?.y ?? targetY + (Math.random() - 0.5) * 80,
        vx: prev?.vx ?? 0,
        vy: prev?.vy ?? 0,
      };
    });

    nodesRef.current = newNodes;

    // Create D3 Force Simulation
    const simulation = d3
      .forceSimulation<ActivityNode>(newNodes)
      // Repulsion between nodes
      .force('charge', d3.forceManyBody().strength(-180).distanceMax(450))
      // Prevent collisions based on node radius
      .force(
        'collision',
        d3.forceCollide<ActivityNode>().radius((d) => d.radius + 12).iterations(3)
      )
      // Attraction towards area centroid (grouped by area)
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
        }).strength(0.12)
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
        }).strength(0.12)
      )
      .alphaDecay(0.02)
      .velocityDecay(0.4);

    simulationRef.current = simulation;

    // SVG elements setup
    const svg = d3.select(svgRef.current);
    const g = svg.select<SVGGElement>('#graph-container');

    // Setup Zoom & Pan behavior
    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3.5])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString());
      });

    zoomBehaviorRef.current = zoomBehavior;
    svg.call(zoomBehavior);

    // Tick handler: updates DOM positions
    simulation.on('tick', () => {
      // 1. Update Area Shaded Hulls/Clouds
      renderAreaHulls(g, activeAreas, newNodes, settings.showAreaHulls);

      // 2. Update Nodes
      const nodeSelection = g
        .select<SVGGElement>('#nodes-group')
        .selectAll<SVGGElement, ActivityNode>('.activity-node')
        .data(newNodes, (d) => d.id);

      // Remove exiting
      nodeSelection.exit().remove();

      // Enter new nodes
      const enter = nodeSelection
        .enter()
        .append('g')
        .attr('class', 'activity-node cursor-grab active:cursor-grabbing transition-opacity')
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

      // Outer glow / multi-area border
      enter
        .append('circle')
        .attr('class', 'node-glow pointer-events-none')
        .attr('fill', 'none')
        .attr('stroke-width', 2.5)
        .attr('stroke-dasharray', '4 2')
        .attr('opacity', 0.8);

      // Main circular node
      enter
        .append('circle')
        .attr('class', 'node-body')
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 1.5)
        .attr('stroke-opacity', 0.7);

      // Inner highlight circle (glassmorphic 3D sphere look)
      enter
        .append('circle')
        .attr('class', 'node-highlight pointer-events-none')
        .attr('fill', 'white')
        .attr('opacity', 0.25);

      // Node label (Activity name)
      enter
        .append('text')
        .attr('class', 'node-label pointer-events-none font-medium text-center select-none fill-white')
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .style('text-shadow', '0 2px 4px rgba(0,0,0,0.9)');

      // Hours badge below label
      enter
        .append('text')
        .attr('class', 'node-hours pointer-events-none text-xs font-mono font-bold select-none fill-gray-300')
        .attr('text-anchor', 'middle')
        .attr('dy', '1.6em')
        .style('text-shadow', '0 2px 4px rgba(0,0,0,0.9)');

      // Merge and update all nodes
      const allNodes = enter.merge(nodeSelection);

      allNodes.attr('transform', (d) => `translate(${d.x || 0}, ${d.y || 0})`);

      allNodes
        .select('.node-glow')
        .attr('r', (d) => d.radius + 6)
        .attr('stroke', (d) => {
          // If multi-area, use first area color, otherwise node temperature
          const firstArea = areaMap.get(d.activity.areaIds[0]);
          return firstArea ? firstArea.color : d.color;
        });

      allNodes
        .select('.node-body')
        .attr('r', (d) => d.radius)
        .attr('fill', (d) => {
          // Use SVG gradient if multi-area, otherwise temperature color
          return d.activity.areaIds.length > 1 ? `url(#grad-${d.id})` : d.color;
        });

      allNodes
        .select('.node-highlight')
        .attr('cx', (d) => -d.radius * 0.28)
        .attr('cy', (d) => -d.radius * 0.28)
        .attr('r', (d) => d.radius * 0.45);

      allNodes
        .select('.node-label')
        .style('display', settings.showLabels ? 'block' : 'none')
        .style('font-size', (d) => `${Math.max(10, Math.min(13, d.radius * 0.42))}px`)
        .text((d) => {
          const maxChars = Math.floor(d.radius / 3.2);
          return d.activity.name.length > maxChars
            ? d.activity.name.slice(0, maxChars) + '…'
            : d.activity.name;
        });

      allNodes
        .select('.node-hours')
        .style('display', settings.showLabels && settings.viewMode !== 'global' ? 'block' : 'none')
        .text((d) => `${d.activity.hours}h`);

      // Mouse events for Hover Tooltip and Selection
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
          // Slight hover grow effect
          d3.select(event.currentTarget)
            .select('.node-body')
            .transition()
            .duration(150)
            .attr('r', d.radius * 1.12);
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
            .select('.node-body')
            .transition()
            .duration(150)
            .attr('r', d.radius);
        })
        .on('click', (_event, d) => {
          onSelectActivity(d.activity);
        });
    });

    return () => {
      simulation.stop();
    };
  }, [visibleActivities, areas, settings, onSelectActivity, areaMap]);

  // Function to render smooth convex hulls for area groupings (CA4)
  const renderAreaHulls = (
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
      // Find all nodes that belong to this area
      const nodesInArea = currentNodes.filter(
        (n) => n.activity.areaIds.includes(area.id) && n.x != null && n.y != null
      );

      if (nodesInArea.length === 0) return;

      const padding = 45;

      if (nodesInArea.length === 1) {
        // 1 Node: Render a round padded circle
        const n = nodesInArea[0];
        const r = n.radius + padding;
        const p = `M ${n.x! - r}, ${n.y!} a ${r},${r} 0 1,0 ${r * 2},0 a ${r},${r} 0 1,0 -${r * 2},0`;
        hullData.push({ area, path: p });
      } else if (nodesInArea.length === 2) {
        // 2 Nodes: Render an expanded capsule path
        const n1 = nodesInArea[0];
        const n2 = nodesInArea[1];
        const dx = n2.x! - n1.x!;
        const dy = n2.y! - n1.y!;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const r1 = n1.radius + padding;
        const r2 = n2.radius + padding;
        const nx = (-dy / dist);
        const ny = (dx / dist);

        const p = `M ${n1.x! + nx * r1} ${n1.y! + ny * r1} ` +
                  `L ${n2.x! + nx * r2} ${n2.y! + ny * r2} ` +
                  `A ${r2} ${r2} 0 0 1 ${n2.x! - nx * r2} ${n2.y! - ny * r2} ` +
                  `L ${n1.x! - nx * r1} ${n1.y! - ny * r1} ` +
                  `A ${r1} ${r1} 0 0 1 ${n1.x! + nx * r1} ${n1.y! + ny * r1} Z`;
        hullData.push({ area, path: p });
      } else {
        // 3+ Nodes: Multi-point polygon hull
        const points: [number, number][] = [];
        nodesInArea.forEach((n) => {
          const r = n.radius + padding;
          // Add radial expansion points for smooth hull
          for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
            points.push([n.x! + Math.cos(a) * r, n.y! + Math.sin(a) * r]);
          }
        });

        const hull = d3.polygonHull(points);
        if (hull) {
          // Smooth curve along the hull vertices
          const curve = d3.line().curve(d3.curveCatmullRomClosed);
          const path = curve(hull);
          if (path) {
            hullData.push({ area, path });
          }
        }
      }
    });

    // Bind and render hull paths
    const hullSel = hullsGroup
      .selectAll<SVGPathElement, { area: LifeArea; path: string }>('.area-hull')
      .data(hullData, (d) => d.area.id);

    hullSel.exit().remove();

    hullSel
      .enter()
      .append('path')
      .attr('class', 'area-hull transition-all duration-300 pointer-events-none')
      .merge(hullSel)
      .attr('d', (d) => d.path)
      .attr('fill', (d) => d.area.color)
      .attr('fill-opacity', 0.12)
      .attr('stroke', (d) => d.area.color)
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.4)
      .attr('stroke-dasharray', '8 4')
      .style('filter', 'blur(4px)');
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
      className="relative w-full h-full overflow-hidden bg-gradient-to-br from-[#0a0c12] via-[#0d1017] to-[#121622]"
    >
      {/* Dynamic SVG Gradients Definitions for Multi-area nodes (CA4) */}
      <svg ref={svgRef} className="w-full h-full cursor-crosshair">
        <defs>
          {visibleActivities.map((act) => {
            if (act.areaIds.length <= 1) return null;
            const area1 = areaMap.get(act.areaIds[0]);
            const area2 = areaMap.get(act.areaIds[1]);
            const c1 = area1 ? area1.color : getTemperatureColor(act.temperature);
            const c2 = area2 ? area2.color : '#3b82f6';
            return (
              <linearGradient
                key={`grad-${act.id}`}
                id={`grad-${act.id}`}
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor={c1} />
                <stop offset="50%" stopColor={getTemperatureColor(act.temperature)} />
                <stop offset="100%" stopColor={c2} />
              </linearGradient>
            );
          })}
        </defs>

        {/* Root Zoomable Group */}
        <g id="graph-container">
          <g id="hulls-group" />
          <g id="nodes-group" />
        </g>
      </svg>

      {/* Floating Canvas Action Controls */}
      <div className="absolute bottom-6 left-6 flex items-center gap-1.5 p-1.5 rounded-xl bg-gray-900/80 backdrop-blur-md border border-gray-800/80 shadow-2xl z-20">
        <button
          onClick={handleZoomIn}
          title="Acercar (Zoom In)"
          className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
        >
          <ZoomIn size={17} />
        </button>
        <button
          onClick={handleZoomOut}
          title="Alejar (Zoom Out)"
          className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
        >
          <ZoomOut size={17} />
        </button>
        <button
          onClick={handleResetView}
          title="Centrar Grafo"
          className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
        >
          <RotateCcw size={17} />
        </button>
        <div className="w-[1px] h-5 bg-gray-700 mx-1" />
        <button
          onClick={handleToggleSimulation}
          title={isPaused ? 'Reanudar física del grafo' : 'Pausar física del grafo'}
          className={`p-2 rounded-lg transition-colors ${
            isPaused ? 'text-amber-400 bg-amber-500/20' : 'text-gray-300 hover:text-white hover:bg-gray-800'
          }`}
        >
          {isPaused ? <Play size={17} /> : <Pause size={17} />}
        </button>
      </div>

      {/* Floating Interactive Legends (CA4 & CA5) */}
      <div className="absolute top-6 left-6 flex flex-col gap-3 z-20 pointer-events-none">
        {/* Areas Legend */}
        <div className="pointer-events-auto p-3.5 rounded-xl bg-gray-900/85 backdrop-blur-md border border-gray-800/80 shadow-xl max-w-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
            <span>Aspectos de Vida</span>
            <span className="text-[10px] text-gray-500">({areas.filter((a) => a.visible).length})</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {areas.map((area) => {
              const count = activities.filter((a) => a.areaIds.includes(area.id)).length;
              return (
                <div
                  key={area.id}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-800/60 border border-gray-700/40 text-xs"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shadow-sm"
                    style={{ backgroundColor: area.color }}
                  />
                  <span className="text-gray-300">{area.name}</span>
                  <span className="text-[10px] font-mono text-gray-400">({count})</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Temperature Spectrum EM Legend (CA5) */}
        <div className="pointer-events-auto p-3 rounded-xl bg-gray-900/85 backdrop-blur-md border border-gray-800/80 shadow-xl w-64">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
            <span>Escala EM Vital</span>
            <span className="text-[10px] text-gray-400">CA5</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-gradient-to-r from-red-500 via-emerald-400 to-blue-500 shadow-inner" />
          <div className="flex items-center justify-between mt-1 text-[10px] font-medium">
            <span className="text-rose-400">Negativo (-5)</span>
            <span className="text-emerald-400">Neutro (0)</span>
            <span className="text-blue-400">Positivo (+5)</span>
          </div>
        </div>
      </div>

      {/* Floating Hover Card / Tooltip (CA3) */}
      {hovered && (
        <div
          className="absolute z-50 pointer-events-none transform -translate-x-1/2 -translate-y-[120%] transition-transform duration-75"
          style={{ left: hovered.x, top: hovered.y }}
        >
          <div className="p-3.5 rounded-xl bg-gray-950/95 backdrop-blur-xl border border-gray-700/80 shadow-2xl min-w-[200px] text-xs">
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <span className="font-bold text-sm text-white tracking-tight">
                {hovered.activity.name}
              </span>
              <span className="font-mono font-extrabold text-sm px-2 py-0.5 rounded-md bg-indigo-950/80 text-indigo-300 border border-indigo-700/50">
                {hovered.activity.hours}h
              </span>
            </div>

            {/* Life Areas badges */}
            <div className="flex flex-wrap gap-1 mb-2">
              {hovered.activity.areaIds.map((aid) => {
                const area = areaMap.get(aid);
                if (!area) return null;
                return (
                  <span
                    key={aid}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-800 text-gray-200"
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: area.color }}
                    />
                    {area.name}
                  </span>
                );
              })}
            </div>

            {/* Temperature score info */}
            <div className="flex items-center justify-between pt-1.5 border-t border-gray-800/80">
              <span className="text-gray-400 text-[11px]">Temperatura:</span>
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: getTemperatureColor(hovered.activity.temperature) }}
                />
                <span className={`font-semibold ${getTemperatureLabel(hovered.activity.temperature).textClass}`}>
                  {hovered.activity.temperature > 0 ? `+${hovered.activity.temperature}` : hovered.activity.temperature}
                </span>
              </div>
            </div>

            {hovered.activity.notes && (
              <p className="mt-2 text-[11px] text-gray-400 italic border-l-2 border-gray-700 pl-2">
                "{hovered.activity.notes}"
              </p>
            )}

            <div className="mt-2 text-[10px] text-gray-500 text-center font-mono">
              Haz clic para editar o eliminar
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
