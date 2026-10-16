"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  applyEdgeChanges,
  applyNodeChanges,
  reconnectEdge,
  type Connection,
  type Edge,
  type Node,
  type OnEdgesChange,
  type OnNodesChange,
  type OnReconnect,
  type Viewport,
} from "@xyflow/react";

type PosMap = Record<string, { x: number; y: number }>;

type EdgeSaveLite = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
};

/** Full flow document persisted to localStorage. */
export type FlowDocument = {
  v: 4;
  flowId: string;
  savedAt: string;
  viewport?: Viewport;
  nodes: Node[];
  edges: Edge[];
};

type LegacySave = {
  v?: 2 | 3;
  viewport?: Viewport;
  positions?: PosMap;
  edges?: EdgeSaveLite[];
};

function storageKey(flowId: string) {
  return `luwas.dev.flow.layout.${flowId}`;
}

function serializeNode(n: Node): Node {
  return {
    id: n.id,
    type: n.type,
    position: { x: n.position.x, y: n.position.y },
    data: n.data,
    parentId: n.parentId,
    extent: n.extent,
    style: n.style,
    zIndex: n.zIndex,
    width: n.width,
    height: n.height,
    expandParent: n.expandParent,
    sourcePosition: n.sourcePosition,
    targetPosition: n.targetPosition,
    draggable: true,
  } as Node;
}

function serializeEdge(e: Edge): Edge {
  return {
    id: e.id,
    type: e.type,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
    label: e.label,
    labelStyle: e.labelStyle,
    labelBgStyle: e.labelBgStyle,
    labelBgPadding: e.labelBgPadding,
    labelBgBorderRadius: e.labelBgBorderRadius,
    style: e.style,
    markerEnd: e.markerEnd,
    markerStart: e.markerStart,
    animated: e.animated,
    reconnectable: true,
  } as Edge;
}

function buildDocument(
  flowId: string,
  nodes: Node[],
  edges: Edge[],
  viewport?: Viewport,
): FlowDocument {
  return {
    v: 4,
    flowId,
    savedAt: new Date().toISOString(),
    viewport,
    nodes: nodes.map(serializeNode),
    edges: edges.map(serializeEdge),
  };
}

function readRaw(flowId: string): unknown {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(flowId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeDocument(flowId: string, doc: FlowDocument) {
  try {
    window.localStorage.setItem(storageKey(flowId), JSON.stringify(doc));
  } catch {
    /* ignore quota */
  }
}

function hydrateNodes(defaults: Node[], savedNodes?: Node[], positions?: PosMap): Node[] {
  const byId = new Map((savedNodes ?? []).map((n) => [n.id, n]));
  return defaults.map((d) => {
    const s = byId.get(d.id);
    const legacy = positions?.[d.id];
    const position = s?.position ?? (legacy ? { x: legacy.x, y: legacy.y } : d.position);
    return {
      ...d,
      position,
      draggable: true,
    };
  });
}

function hydrateEdges(
  defaults: Edge[],
  savedEdges?: Edge[],
  legacy?: EdgeSaveLite[],
): Edge[] {
  // Always use code defaults for wiring + style so renamed/removed handles
  // never leave dangling arrows. Saved reconnects are ignored after handle changes.
  void savedEdges;
  void legacy;
  return defaults.map((e) => ({ ...e, reconnectable: true }));
}

function parseSaved(
  flowId: string,
  defaultsNodes: Node[],
  defaultsEdges: Edge[],
): {
  nodes: Node[];
  edges: Edge[];
  viewport?: Viewport;
  hasSaved: boolean;
} {
  const raw = readRaw(flowId);
  if (!raw || typeof raw !== "object" || raw === null) {
    return {
      nodes: hydrateNodes(defaultsNodes),
      edges: hydrateEdges(defaultsEdges),
      hasSaved: false,
    };
  }

  const bag = raw as Record<string, unknown>;

  // v4 full document
  if (bag.v === 4) {
    const doc = raw as FlowDocument;
    return {
      nodes: hydrateNodes(defaultsNodes, doc.nodes),
      edges: hydrateEdges(defaultsEdges, doc.edges),
      viewport: doc.viewport,
      hasSaved: true,
    };
  }

  // v2 / v3 layout-only
  if (bag.v === 2 || bag.v === 3) {
    const doc = raw as LegacySave;
    return {
      nodes: hydrateNodes(defaultsNodes, undefined, doc.positions),
      edges: hydrateEdges(defaultsEdges, undefined, doc.edges),
      viewport: doc.viewport,
      hasSaved: Boolean(
        doc.viewport ||
          Object.keys(doc.positions ?? {}).length ||
          doc.edges?.length,
      ),
    };
  }

  // Legacy bare positions map
  if (!("v" in bag) && !("nodes" in bag)) {
    const positions = raw as PosMap;
    return {
      nodes: hydrateNodes(defaultsNodes, undefined, positions),
      edges: hydrateEdges(defaultsEdges),
      hasSaved: Object.keys(positions).length > 0,
    };
  }

  return {
    nodes: hydrateNodes(defaultsNodes),
    edges: hydrateEdges(defaultsEdges),
    hasSaved: false,
  };
}

export function useFlowLayout(
  flowId: string,
  defaultNodes: Node[] = [],
  defaultEdges: Edge[] = [],
) {
  const defaultsKey = useMemo(() => {
    const nodes = defaultNodes ?? [];
    const edges = defaultEdges ?? [];
    return (
      nodes
        .map((n) => {
          const s = n.style as { width?: number; height?: number } | undefined;
          const data = n.data as Record<string, unknown> | undefined;
          const handles = [
            data?.inLeft,
            data?.inBottom,
            data?.inTop,
            data?.outRight,
            data?.outTop,
            data?.outBottom,
          ].join(",");
          return `${n.id}:${n.position.x},${n.position.y}:${s?.width ?? ""}x${s?.height ?? ""}:${handles}`;
        })
        .join("|") +
      "|" +
      edges
        .map((e) => {
          const stroke =
            e.style && typeof e.style === "object" && "stroke" in e.style
              ? String((e.style as { stroke?: string }).stroke ?? "")
              : "";
          return `${e.id}:${String(e.label ?? "")}:${e.sourceHandle ?? ""}>${e.targetHandle ?? ""}:${stroke}`;
        })
        .join(",")
    );
  }, [defaultNodes, defaultEdges]);

  const [nodes, setNodes] = useState<Node[]>(() =>
    hydrateNodes(defaultNodes ?? []),
  );
  const [edges, setEdges] = useState<Edge[]>(() =>
    hydrateEdges(defaultEdges ?? []),
  );
  const [viewport, setViewport] = useState<Viewport | undefined>(undefined);
  const [hasSavedLayout, setHasSavedLayout] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0);

  useEffect(() => {
    const parsed = parseSaved(
      flowId,
      defaultNodes ?? [],
      defaultEdges ?? [],
    );
    setNodes(parsed.nodes);
    setEdges(parsed.edges);
    setViewport(parsed.viewport);
    setHasSavedLayout(parsed.hasSaved);
    setHydrated(true);
    setCanvasKey((k) => k + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- defaultsKey tracks identity
  }, [flowId, defaultsKey]);

  const persist = useCallback(
    (nextNodes: Node[], nextEdges: Edge[], nextViewport?: Viewport) => {
      const doc = buildDocument(
        flowId,
        nextNodes,
        nextEdges,
        nextViewport ?? viewport,
      );
      writeDocument(flowId, doc);
      setHasSavedLayout(true);
    },
    [flowId, viewport],
  );

  const onNodesChange: OnNodesChange = useCallback((changes) => {
    setNodes((prev) => applyNodeChanges(changes, prev));
  }, []);

  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    setEdges((prev) => applyEdgeChanges(changes, prev));
  }, []);

  const onNodeDragStop = useCallback(() => {
    setNodes((currentNodes) => {
      setEdges((currentEdges) => {
        persist(currentNodes, currentEdges, viewport);
        return currentEdges;
      });
      return currentNodes;
    });
  }, [persist, viewport]);

  const onMoveEnd = useCallback(
    (_: unknown, next: Viewport) => {
      setViewport(next);
      setNodes((currentNodes) => {
        setEdges((currentEdges) => {
          persist(currentNodes, currentEdges, next);
          return currentEdges;
        });
        return currentNodes;
      });
    },
    [persist],
  );

  const onReconnect: OnReconnect = useCallback(
    (oldEdge, newConnection: Connection) => {
      setEdges((eds) => {
        const next = reconnectEdge(oldEdge, newConnection, eds);
        setNodes((currentNodes) => {
          persist(currentNodes, next, viewport);
          return currentNodes;
        });
        return next;
      });
    },
    [persist, viewport],
  );

  const resetLayout = useCallback(() => {
    try {
      window.localStorage.removeItem(storageKey(flowId));
    } catch {
      /* ignore */
    }
    setNodes(hydrateNodes(defaultNodes ?? []));
    setEdges(hydrateEdges(defaultEdges ?? []));
    setViewport(undefined);
    setHasSavedLayout(false);
    setCanvasKey((k) => k + 1);
  }, [defaultEdges, defaultNodes, flowId]);

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onNodeDragStop,
    onMoveEnd,
    onReconnect,
    resetLayout,
    hasSavedLayout,
    defaultViewport: viewport,
    fitView: hydrated && !viewport,
    hydrated,
    canvasKey,
  };
}
