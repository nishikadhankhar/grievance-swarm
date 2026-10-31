"use client";

import { Handle, Position, ReactFlow, type Edge, type Node, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMemo } from "react";
import type { MekoCall } from "@/lib/types";
import { cx } from "./ui";

// Layout matches the Figma swarm board: MEKO hub in the centre, agents on an inner ring, people outside.
const CX = 459;
const CY = 270;
const polar = (deg: number, rx: number, ry: number) => {
  const t = (deg * Math.PI) / 180;
  return { x: CX + rx * Math.cos(t), y: CY + ry * Math.sin(t) };
};

export const AGENTS: [string, string, number][] = [
  ["desk", "Desk agent", -90],
  ["water", "Water agent", -18],
  ["curator", "Curator agent", 54],
  ["electricity", "Electricity agent", 126],
  ["wifi", "Wi-Fi agent", 198],
];
export const PEOPLE: [string, string, number][] = [
  ["student", "Student", -135],
  ["dean", "Dean", -45],
  ["warden", "Warden", 20],
  ["technician", "Technician", 160],
];
export const NODE_IDS = new Set([...AGENTS, ...PEOPLE].map((n) => n[0]));
const KB = { x: 800, y: 492 };

export interface Pulse {
  call: MekoCall;
  key: number;
}

type NodeData = { label: string; active: boolean };

const center = { left: "50%", top: "50%", transform: "translate(-50%,-50%)" };
function Handles() {
  return (
    <>
      <Handle type="source" position={Position.Top} style={center} isConnectable={false} />
      <Handle type="target" position={Position.Top} style={center} isConnectable={false} />
    </>
  );
}

function BoxNode({ data, kind }: { data: NodeData; kind: "person" | "agent" }) {
  return (
    <div
      className={cx(
        "flex h-[42px] w-[116px] items-center justify-center rounded-xl text-[13px] font-semibold transition-shadow",
        kind === "agent" ? "bg-gray-900 text-white" : "border-[1.5px] border-gray-900 bg-white text-gray-900",
        data.active && "animate-pulseRing",
      )}
    >
      {data.label}
      <Handles />
    </div>
  );
}

const nodeTypes = {
  person: ({ data }: NodeProps) => <BoxNode data={data as NodeData} kind="person" />,
  agent: ({ data }: NodeProps) => <BoxNode data={data as NodeData} kind="agent" />,
  hub: ({ data }: NodeProps) => (
    <div
      className={cx(
        "flex h-[108px] w-[108px] flex-col items-center justify-center rounded-full bg-orange-500 text-white shadow-[0_0_28px_6px_rgba(249,115,22,0.35)]",
        (data as NodeData).active && "animate-pulseRing",
      )}
    >
      <span className="text-lg font-bold leading-tight">MEKO</span>
      <span className="text-[11px] font-medium text-orange-100">memory</span>
      <Handles />
    </div>
  ),
  kb: ({ data }: NodeProps) => (
    <div
      className={cx(
        "flex h-[46px] w-[144px] items-center justify-center rounded-full border-2 border-orange-500 bg-orange-50 text-sm font-semibold text-orange-700",
        (data as NodeData).active ? "shadow-glow" : "shadow-[0_0_18px_2px_rgba(249,115,22,0.25)]",
      )}
    >
      Campus KB
      <Handles />
    </div>
  ),
};

type EdgeState = { op: MekoCall["op"]; skipped: boolean; error: boolean; datapack: string };

function edgeStyle(s: EdgeState | undefined): Pick<Edge, "style" | "animated" | "label"> {
  if (!s) return { style: { stroke: "#E5E7EB", strokeWidth: 1.5 }, animated: false };
  const label = `${s.op} · ${s.datapack}`;
  if (s.error) return { style: { stroke: "#DC2626", strokeWidth: 3 }, animated: false, label: `error · ${s.op}` };
  if (s.skipped) return { style: { stroke: "#D1D5DB", strokeWidth: 2, strokeDasharray: "2 5" }, animated: false, label: `${s.op} skipped (Meko OFF)` };
  switch (s.op) {
    case "recall":
      return { style: { stroke: "#6B7280", strokeWidth: 2.5, strokeDasharray: "6 5" }, animated: true, label };
    case "directive":
      return { style: { stroke: "#F97316", strokeWidth: 3.5 }, animated: false, label };
    case "promote":
      return { style: { stroke: "#F97316", strokeWidth: 4, filter: "drop-shadow(0 0 6px rgba(249,115,22,0.8))" }, animated: false, label };
    case "approval":
      return { style: { stroke: "#C2410C", strokeWidth: 2.5, strokeDasharray: "1 4" }, animated: false, label: "approval" };
    default: // write, share
      return { style: { stroke: "#4B5563", strokeWidth: 3 }, animated: false, label };
  }
}

/** Which edges a call lights up: actor ↔ hub, hub ↔ target (share/directive), curator → KB (promote). */
export function edgesForCall(c: MekoCall): string[] {
  const ids: string[] = [];
  if (NODE_IDS.has(c.actor)) ids.push(`e-${c.actor}`);
  if (c.target && NODE_IDS.has(c.target) && c.target !== c.actor) ids.push(`e-${c.target}`);
  if (c.op === "promote") ids.push("e-kb");
  return ids;
}

export function SwarmGraph({ pulses, onNodeClick, selected }: { pulses: Pulse[]; onNodeClick?: (id: string) => void; selected?: string | null }) {
  const { nodes, edges } = useMemo(() => {
    const active: Record<string, EdgeState> = {};
    const activeNodes = new Set<string>();
    for (const { call } of pulses) {
      const s = { op: call.op, skipped: call.skipped, error: !!call.error, datapack: call.datapack };
      edgesForCall(call).forEach((id) => (active[id] = s));
      if (NODE_IDS.has(call.actor)) activeNodes.add(call.actor);
      if (call.op === "promote") activeNodes.add("campus-kb");
      if (!call.skipped) activeNodes.add("meko");
    }
    const box = (id: string, label: string, deg: number, kind: "agent" | "person", rx: number, ry: number): Node => {
      const p = polar(deg, rx, ry);
      return {
        id,
        type: kind,
        position: { x: p.x - 58, y: p.y - 21 },
        data: { label, active: activeNodes.has(id) },
        selected: selected === id,
      };
    };
    const nodes: Node[] = [
      ...AGENTS.map(([id, label, deg]) => box(id, label, deg, "agent", 250, 170)),
      ...PEOPLE.map(([id, label, deg]) => box(id, label, deg, "person", 390, 240)),
      { id: "meko", type: "hub", position: { x: CX - 54, y: CY - 54 }, data: { label: "MEKO", active: activeNodes.has("meko") } },
      { id: "campus-kb", type: "kb", position: { x: KB.x - 72, y: KB.y - 23 }, data: { label: "Campus KB", active: activeNodes.has("campus-kb") } },
    ];
    const edges: Edge[] = [
      ...[...NODE_IDS].map((id) => ({ id: `e-${id}`, source: id, target: "meko", type: "straight", ...edgeStyle(active[`e-${id}`]) })),
      { id: "e-kb", source: "curator", target: "campus-kb", type: "straight", ...edgeStyle(active["e-kb"]) },
    ].map((e) => ({ ...e, labelStyle: { fontSize: 10, fontWeight: 600, fill: "#374151" }, labelBgStyle: { fill: "#fff" }, zIndex: e.label ? 1 : 0 }));
    return { nodes, edges };
  }, [pulses, selected]);

  return (
    <div className="h-[540px] w-full overflow-hidden rounded-xl bg-gray-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.06 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
        onNodeClick={(_, n) => onNodeClick?.(n.id)}
        proOptions={{ hideAttribution: false }}
      />
    </div>
  );
}
