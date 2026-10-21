/**
 * Untrusted public cache responses are accepted only when they match the
 * browser's independently generated synthetic match evidence.
 * No browser-side Azure credentials or inference requests are ever made.
 */
export interface PublishedInsight {
  id: string;
  headline: string;
  at_second: number;
  method: string;
  metric: { previous: number; recent: number; delta: number };
  evidence_ids: string[];
  baseline_ids: string[];
  modes: { fan: string; analyst: string; broadcast: string };
  trace: { stage: string; status: string; detail: string }[];
}

type SourceReference = {
  events: { id: string; second: number }[];
  insights: {
    id: string; at_second: number;
    metric: { previous: number; recent: number; delta: number };
    evidence_ids: string[]; baseline_ids: string[];
  }[];
};

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sameIds(value: unknown, source: string[]): value is string[] {
  return Array.isArray(value)
    && value.length === source.length
    && value.every((item: unknown) => typeof item === "string")
    && new Set(value).size === value.length
    && value.every((item: string) => source.includes(item));
}

function safeText(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

/** Null means never display this as a verified model result. */
export function validateFoundryCache(payload: unknown, match: SourceReference): PublishedInsight | null {
  if (!object(payload) || payload.status !== "ready" || payload.source !== "azure-published-cache") return null;
  if (!object(payload.result) || payload.result.status !== "verified"
      || payload.result.provider !== "microsoft-foundry") return null;
  const result = payload.result;
  const insight = result.insight;
  if (!object(insight) || !object(insight.metric) || !object(insight.modes)) return null;
  const reference = match.insights.find(item => item.id === insight.id);
  if (!reference || reference.at_second !== insight.at_second || result.at_second !== reference.at_second) return null;
  for (const key of ["previous", "recent", "delta"] as const) {
    if (insight.metric[key] !== reference.metric[key]) return null;
  }
  if (!sameIds(insight.evidence_ids, reference.evidence_ids)
      || !sameIds(insight.baseline_ids, reference.baseline_ids)) return null;
  const visibleIds = new Set(match.events.filter(event => event.second <= reference.at_second).map(event => event.id));
  if (![...insight.evidence_ids, ...insight.baseline_ids].every(id => visibleIds.has(id))) return null;
  if (!safeText(insight.headline, 180) || !safeText(insight.method, 1500)) return null;
  for (const mode of ["fan", "analyst", "broadcast"] as const) {
    if (!safeText(insight.modes[mode], 900)) return null;
  }
  if (!Array.isArray(result.trace)
      || !result.trace.every((item: unknown) => object(item)
        && safeText(item.stage, 80) && safeText(item.status, 40)
        && safeText(item.detail, 250))) return null;
  if (!result.trace.some((item: { stage: string; status: string }) =>
        item.stage === "Evidence gate" && item.status === "approved")
      || !result.trace.some((item: { stage: string; status: string }) =>
        item.stage === "Verification" && item.status === "approved")
      || !result.trace.some((item: { stage: string; status: string }) =>
        item.stage === "Presentation" && item.status === "complete")) return null;

  return {
    id: insight.id as string,
    headline: insight.headline,
    at_second: insight.at_second as number,
    method: insight.method,
    metric: {
      previous: reference.metric.previous,
      recent: reference.metric.recent,
      delta: reference.metric.delta,
    },
    evidence_ids: [...reference.evidence_ids],
    baseline_ids: [...reference.baseline_ids],
    modes: {
      fan: insight.modes.fan as string,
      analyst: insight.modes.analyst as string,
      broadcast: insight.modes.broadcast as string,
    },
    trace: result.trace.map((item: { stage: string; status: string; detail: string }) =>
      ({ stage: item.stage, status: item.status, detail: item.detail })),
  };
}
