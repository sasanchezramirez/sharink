import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { Activity, LifeArea, ViewportSettings, ActivityNode } from '../types';
import { getNodeShading, getTemperatureLabel } from '../utils/colors';
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

  // Filter activities based on visibility and active filters
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

  // Layout & Simulation setup (Pure spatial clustering, no hulls, no node dragging)
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || 900;
    const height = containerRef.current.clientHeight || 700;
    const centerX = width / 2;
    const centerY = height / 2;

    const activeAreas = areas.filter((a) => a.visible);
    const areaCentroids = new Map<string, { x: number; y: number }>();
    const angleStep = (2 * Math.PI) / (activeAreas.length || 1);
    const orbitRadius = Math.min(width, height) * 0.32;

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
      // Harmonious radius scale
      const radius = Math.max(16, Math.min(48, 14 + Math.sqrt(Math.max(0.2, act.hours)) * 12));

      // Calculate target centroid for spatial attraction
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
        color: '', // handled via radial gradient
        x: prev?.x ?? targetX + (Math.random() - 0.5) * 40,
        y: prev?.y ?? targetY + (Math.random() - 0.5) * 40,
        vx: prev?.vx ?? 0,
        vy: prev?.vy ?? 0,
      };
    });

    nodesRef.current = newNodes;

    // Fast-converging simulation that settles naturally into fixed harmonic positions
    const simulation = d3
      .forceSimulation<ActivityNode>(newNodes)
      .force('charge', d3.forceManyBody().strength(-120).distanceMax(380))
      .force(
        'collision',
        d3.forceCollide<ActivityNode>().radius((d) => d.radius + 12).iterations(3)
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
        }).strength(0.18)
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
        }).strength(0.18)
      )
      .alphaDecay(0.04) // Converges quickly to stable equilibrium
      .velocityDecay(0.45);

    simulationRef.current = simulation;

    const svg = d3.select(svgRef.current);
    const g = svg.select<SVGGElement>('#graph-container');

    // Zoom & Pan on the background
    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3.5])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString());
      });

    zoomBehaviorRef.current = zoomBehavior;
    svg.call(zoomBehavior);

    // Render subtle area labels in the background at their centroid
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
      .attr('class', 'area-watermark pointer-events-none font-mono text-[10px] tracking-widest uppercase')
      .attr('text-anchor', 'middle')
      .attr('fill', (d) => d.area.color)
      .attr('fill-opacity', 0.18)
      .merge(labelSelection)
      .attr('x', (d) => d.pos.x)
      .attr('y', (d) => d.pos.y - 65)
      .text((d) => d.area.name);

    // Tick Handler
    simulation.on('tick', () => {
      const nodeSelection = g
        .select<SVGGElement>('#nodes-group')
        .selectAll<SVGGElement, ActivityNode>('.activity-node')
        .data(newNodes, (d) => d.id);

      nodeSelection.exit().remove();

      // Enter new nodes (NO DRAGGING: purely contemplative and stable)
      const enter = nodeSelection
        .enter()
        .append('g')
        .attr('class', 'activity-node cursor-pointer select-none');

      // 1. OPTICAL BLOOM (True optical diffusion with radial fade + Gaussian blur)
      enter
        .append('circle')
        .attr('class', 'node-bloom pointer-events-none transition-all duration-300')
        .attr('filter', 'url(#optical-blur)')
        .attr('opacity', 0);

      // 2. MAIN SPHERICAL NODE with radial depth (No MS Paint bucket fill!)
      enter
        .append('circle')
        .attr('class', 'node-body transition-transform duration-200');

      // 3. ULTRA-THIN GLASS PERIMETER RING (0.5px)
      enter
        .append('circle')
        .attr('class', 'node-glass-ring pointer-events-none')
        .attr('fill', 'none')
        .attr('stroke', 'rgba(255, 255, 255, 0.14)')
        .attr('stroke-width', 0.5);

      // 4. MULTI-AREA SUBTLE ACCENT PINPOINT (Only if multi-area)
      enter
        .append('circle')
        .attr('class', 'node-multi-pin pointer-events-none')
        .attr('fill', 'none')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '2 3')
        .attr('opacity', 0.4);

      // 5. ACTIVITY NAME (Crisp micro-typography)
      enter
        .append('text')
        .attr('class', 'node-label pointer-events-none font-sans font-medium text-center select-none fill-white')
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em');

      // 6. HOURS MICRO-BADGE
      enter
        .append('text')
        .attr('class', 'node-hours pointer-events-none text-[9px] font-mono select-none fill-gray-400')
        .attr('text-anchor', 'middle')
        .attr('dy', '1.6em');

      const allNodes = enter.merge(nodeSelection);

      allNodes.attr('transform', (d) => `translate(${d.x || 0}, ${d.y || 0})`);

      // Set optical bloom
      allNodes
        .select('.node-bloom')
        .attr('r', (d) => d.radius + 14)
        .attr('fill', (d) => `url(#bloom-grad-${d.id})`);

      // Set multi-stop radial gradient fill
      allNodes
        .select('.node-body')
        .attr('r', (d) => d.radius)
        .attr('fill', (d) => `url(#sphere-grad-${d.id})`);

      // Glass ring
      allNodes
        .select('.node-glass-ring')
        .attr('r', (d) => d.radius);

      // Multi-area ring
      allNodes
        .select('.node-multi-pin')
        .attr('r', (d) => d.radius + 2.5)
        .attr('stroke', (d) => {
          if (d.activity.areaIds.length > 1) {
            const secondArea = areaMap.get(d.activity.areaIds[1]);
            return secondArea ? secondArea.color : 'transparent';
          }
          return 'transparent';
        });

      // Label
      allNodes
        .select('.node-label')
        .style('display', settings.showLabels ? 'block' : 'none')
        .style('font-size', (d) => `${Math.max(9.5, Math.min(11.5, d.radius * 0.4))}px`)
        .text((d) => {
          const maxChars = Math.floor(d.radius / 3.3);
          return d.activity.name.length > maxChars
            ? d.activity.name.slice(0, maxChars) + '…'
            : d.activity.name;
        });

      // Hours
      allNodes
        .select('.node-hours')
        .style('display', settings.showLabels && settings.viewMode !== 'global' ? 'block' : 'none')
        .text((d) => `${d.activity.hours}h`);

      // Hover and Click events (Gentle optical bloom activation)
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

          // Fade-in optical bloom smoothly
          d3.select(event.currentTarget)
            .select('.node-bloom')
            .transition()
            .duration(220)
            .attr('opacity', 0.85);

          // Subtle micro-expansion of the node body
          d3.select(event.currentTarget)
            .select('.node-body')
            .transition()
            .duration(180)
            .attr('r', d.radius * 1.08);

          d3.select(event.currentTarget)
            .select('.node-glass-ring')
            .transition()
            .duration(180)
            .attr('r', d.radius * 1.08)
            .attr('stroke', 'rgba(255, 255, 255, 0.4)');
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

          // Fade-out optical bloom
          d3.select(event.currentTarget)
            .select('.node-bloom')
            .transition()
            .duration(200)
            .attr('opacity', 0);

          d3.select(event.currentTarget)
            .select('.node-body')
            .transition()
            .duration(180)
            .attr('r', d.radius);

          d3.select(event.currentTarget)
            .select('.node-glass-ring')
            .transition()
            .duration(180)
            .attr('r', d.radius)
            .attr('stroke', 'rgba(255, 255, 255, 0.14)');
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
        .duration(350)
        .call(zoomBehaviorRef.current.transform, d3.zoomIdentity);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-[#08090d]"
    >
      <svg ref={svgRef} className="w-full h-full cursor-default">
        <defs>
          {/* Real Optical Gaussian Blur Filter */}
          <filter id="optical-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="7" result="blur" />
          </filter>

          {/* Dynamic multi-stop radial gradients for each activity */}
          {visibleActivities.map((act) => {
            const shading = getNodeShading(act.temperature);
            return (
              <React.Fragment key={act.id}>
                {/* 1. Deep Celestial Sphere Gradient */}
                <radialGradient
                  id={`sphere-grad-${act.id}`}
                  cx="36%"
                  cy="36%"
                  r="64%"
                >
                  <stop offset="0%" stopColor={shading.coreColor} stopOpacity="0.95" />
                  <stop offset="42%" stopColor={shading.midColor} stopOpacity="0.88" />
                  <stop offset="100%" stopColor={shading.darkColor} stopOpacity="0.98" />
                </radialGradient>

                {/* 2. Optical Bloom Diffusion Gradient (Exponential decay) */}
                <radialGradient
                  id={`bloom-grad-${act.id}`}
                  cx="50%"
                  cy="50%"
                  r="50%"
                >
                  <stop offset="0%" stopColor={shading.glowColor} stopOpacity="0.45" />
                  <stop offset="45%" stopColor={shading.glowColor} stopOpacity="0.18" />
                  <stop offset="100%" stopColor={shading.glowColor} stopOpacity="0" />
                </radialGradient>
              </React.Fragment>
            );
          })}
        </defs>

        <g id="graph-container">
          {/* Subtle area watermarks */}
          <g id="area-labels-group" />
          {/* Nodes */}
          <g id="nodes-group" />
        </g>
      </svg>

      {/* Floating Canvas Controls (Ultra-minimal bottom-left) */}
      <div className="absolute bottom-6 left-6 flex items-center gap-1 p-1 rounded-full bg-[#101218]/80 backdrop-blur-xl border border-white/5 shadow-xl z-20">
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

      {/* Subtle Hover Inspection Card */}
      {hovered && (
        <div
          className="absolute z-50 pointer-events-none transform -translate-x-1/2 -translate-y-[120%] transition-transform duration-75"
          style={{ left: hovered.x, top: hovered.y }}
        >
          <div className="p-3 rounded-xl bg-[#101218]/95 backdrop-blur-2xl border border-white/10 shadow-2xl text-xs space-y-2 min-w-[190px] text-gray-100">
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
                  style={{ backgroundColor: getNodeShading(hovered.activity.temperature).midColor }}
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
