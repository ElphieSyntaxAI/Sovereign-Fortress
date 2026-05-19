import { useEffect, useState } from "react";

import {
  resolveLayerBFlags,
  type AiAllowanceLevel,
  type LayerBAllowanceEvent,
  type LayerBRuntimeFlags,
} from "@elphie-syntax/core";

export type UseLayerBAllowanceStreamOptions = {
  assignmentId: string;
  /** Base URL for MSGF API (e.g. https://elphiesgatedai.elphiesyntax.com). */
  apiBase: string;
  initialLevel?: AiAllowanceLevel;
  enabled?: boolean;
};

export type UseLayerBAllowanceStreamResult = {
  layerB: LayerBRuntimeFlags;
  lastEvent: LayerBAllowanceEvent | null;
  connected: boolean;
};

/**
 * SSE subscription for Layer B — does not remount Layer A toolbox.
 */
export function useLayerBAllowanceStream(
  options: UseLayerBAllowanceStreamOptions
): UseLayerBAllowanceStreamResult {
  const { assignmentId, apiBase, initialLevel = 3, enabled = true } = options;
  const [level, setLevel] = useState<AiAllowanceLevel>(initialLevel);
  const [lastEvent, setLastEvent] = useState<LayerBAllowanceEvent | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!enabled || !assignmentId) return;

    const url = `${apiBase.replace(/\/$/, "")}/api/education/workspace/allowance/stream?assignmentId=${encodeURIComponent(assignmentId)}`;
    const es = new EventSource(url);

    es.addEventListener("connected", () => setConnected(true));
    es.addEventListener("layer_b_allowance_updated", (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data) as LayerBAllowanceEvent;
        setLastEvent(data);
        setLevel(data.aiAllowanceLevel);
      } catch {
        /* ignore malformed */
      }
    });
    es.onerror = () => setConnected(false);

    return () => {
      es.close();
      setConnected(false);
    };
  }, [assignmentId, apiBase, enabled]);

  return {
    layerB: resolveLayerBFlags(level),
    lastEvent,
    connected,
  };
}
