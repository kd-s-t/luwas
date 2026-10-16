"use client";

import { useCallback, useState } from "react";
import type { Edge, Node } from "@xyflow/react";

function serializeNode(n: Node) {
  return {
    id: n.id,
    type: n.type,
    position: { x: n.position.x, y: n.position.y },
    parentId: n.parentId,
    extent: n.extent,
    style: n.style,
    data: n.data,
  };
}

function serializeEdge(e: Edge) {
  return {
    id: e.id,
    type: e.type,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
    label: e.label,
    style: e.style,
    markerEnd: e.markerEnd,
    animated: e.animated,
  };
}

/** Copy current flow nodes + edges as JSON for paste into chat. */
export function FlowCopyJsonButton({
  flowId,
  nodes,
  edges,
}: {
  flowId: string;
  nodes: Node[];
  edges: Edge[];
}) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    const payload = {
      flowId,
      savedAt: new Date().toISOString(),
      nodes: nodes.map(serializeNode),
      edges: edges.map(serializeEdge),
    };
    const text = JSON.stringify(payload, null, 2);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }, [edges, flowId, nodes]);

  return (
    <button
      type="button"
      onClick={() => void onCopy()}
      className="rounded-[8px] border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
    >
      {copied ? "Copied" : "Copy JSON"}
    </button>
  );
}
