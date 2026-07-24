import { useEffect, useRef } from "react";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { select, type Selection } from "d3-selection";
import { drag } from "d3-drag";
import { zoom } from "d3-zoom";
import type { GraphEdge, GraphNode } from "../types";
import { CATEGORY_COLORS } from "../data/graphData";

type SimNode = GraphNode & SimulationNodeDatum;
type SimLink = SimulationLinkDatum<SimNode> & { highlighted?: boolean };

const WIDTH = 640;
const HEIGHT = 900;

interface NetworkGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function NetworkGraph({ nodes, edges, selectedId, onSelect }: NetworkGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const nodeSelRef = useRef<Selection<SVGGElement, SimNode, SVGGElement, unknown> | null>(null);
  const linkSelRef = useRef<Selection<SVGLineElement, SimLink, SVGGElement, unknown> | null>(null);
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const svg = select<SVGSVGElement, unknown>(svgRef.current!);
    svg.selectAll("*").remove();

    const simNodes: SimNode[] = nodes.map((n) => ({ ...n }));
    const simLinks: SimLink[] = edges.map((e) => ({ ...e }));

    const simulation = forceSimulation(simNodes)
      .force(
        "link",
        forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(60)
          .strength(0.4)
      )
      .force("charge", forceManyBody().strength(-180))
      .force("center", forceCenter(WIDTH / 2, HEIGHT / 2))
      .force(
        "collide",
        forceCollide<SimNode>((d) => d.radius + 16)
      );

    const g = svg.append("g");

    svg.call(
      zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.3, 2.5])
        .on("zoom", (event) => g.attr("transform", event.transform))
    );

    const link = g
      .append("g")
      .attr("stroke-opacity", 0.7)
      .selectAll<SVGLineElement, SimLink>("line")
      .data(simLinks)
      .join("line")
      .attr("stroke", (d) => (d.highlighted ? "#d64545" : "#c7c7c7"))
      .attr("stroke-width", (d) => (d.highlighted ? 2.5 : 1.5));

    function dragBehavior() {
      function dragstarted(event: any, d: SimNode) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      }
      function dragged(event: any, d: SimNode) {
        d.fx = event.x;
        d.fy = event.y;
      }
      function dragended(event: any, d: SimNode) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      }
      return drag<SVGGElement, SimNode>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
    }

    const node = g
      .append("g")
      .selectAll<SVGGElement, SimNode>("g")
      .data(simNodes)
      .join("g")
      .attr("cursor", "pointer")
      .call(dragBehavior())
      .on("click", (_event, d) => onSelectRef.current(d.id));

    node
      .append("circle")
      .attr("r", (d) => d.radius)
      .attr("fill", (d) => CATEGORY_COLORS[d.category])
      .attr("stroke", "#fff")
      .attr("stroke-width", 2);

    node.each(function (d) {
      const lines = d.label.split("\n");
      const text = select(this)
        .append("text")
        .attr("text-anchor", "middle")
        .attr("y", d.radius + 14)
        .attr("font-size", 11)
        .attr("fill", "#333");
      lines.forEach((line, i) => {
        text
          .append("tspan")
          .attr("x", 0)
          .attr("dy", i === 0 ? 0 : 12)
          .text(line);
      });
    });

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as SimNode).x ?? 0)
        .attr("y1", (d) => (d.source as SimNode).y ?? 0)
        .attr("x2", (d) => (d.target as SimNode).x ?? 0)
        .attr("y2", (d) => (d.target as SimNode).y ?? 0);
      node.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    nodeSelRef.current = node;
    linkSelRef.current = link;

    return () => {
      simulation.stop();
    };
  }, [nodes, edges]);

  useEffect(() => {
    if (!nodeSelRef.current || !linkSelRef.current) return;

    nodeSelRef.current
      .select("circle")
      .attr("stroke", (d) => (d.id === selectedId ? "#d64545" : "#fff"))
      .attr("stroke-width", (d) => (d.id === selectedId ? 4 : 2));

    linkSelRef.current
      .attr("stroke", (d) => {
        const source = d.source as SimNode;
        const target = d.target as SimNode;
        const touchesSelected = source.id === selectedId || target.id === selectedId;
        return d.highlighted || touchesSelected ? "#d64545" : "#c7c7c7";
      })
      .attr("stroke-width", (d) => {
        const source = d.source as SimNode;
        const target = d.target as SimNode;
        const touchesSelected = source.id === selectedId || target.id === selectedId;
        return d.highlighted || touchesSelected ? 2.5 : 1.5;
      });
  }, [selectedId]);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="network-graph"
      role="img"
      aria-label="ANT network graph"
    />
  );
}
