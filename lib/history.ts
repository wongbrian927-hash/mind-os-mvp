import {
  calculateTierLevel,
  type ApexVariant,
  type ResultCardLang,
} from "@/lib/calculateTier";

export const HISTORY_STORAGE_KEY = "mind_os_history_v1";
const MAX_VALID_RUNS = 30;

export type HistoryRun = {
  id: string;
  timestamp: string;
  reactionMs: number;
  stroopAccuracy: number;
  interferenceMs: number | null;
  tier: string;
  valid: boolean;
};

export type MetricCmp = {
  arrow: "↑" | "↓" | "→";
  label: string;
};

function isHistoryRun(value: unknown): value is HistoryRun {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.timestamp === "string" &&
    typeof row.reactionMs === "number" &&
    typeof row.stroopAccuracy === "number" &&
    (row.interferenceMs === null || typeof row.interferenceMs === "number") &&
    typeof row.tier === "string" &&
    typeof row.valid === "boolean"
  );
}

export function formatHistoryTier(
  level: number,
  variant: ApexVariant | null | undefined,
): string {
  if (variant === "void") return "TIER 00X";
  return `TIER ${String(level).padStart(2, "0")}`;
}

export function buildHistoryTierLabel(input: {
  latency: number;
  interference: number;
  accuracy: number;
  completedBreathingBeforeTest: boolean;
  apexVariant: ApexVariant | null;
}): string {
  const level = calculateTierLevel({
    latency: input.latency,
    interference: input.interference,
    accuracy: input.accuracy,
    lang: "en",
    completedBreathingBeforeTest: input.completedBreathingBeforeTest,
    apexVariant: input.apexVariant ?? undefined,
  });
  return formatHistoryTier(level, input.apexVariant);
}

export function loadHistory(): HistoryRun[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isHistoryRun);
  } catch {
    return [];
  }
}

function saveHistory(runs: HistoryRun[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(runs));
}

/** Most recent valid run, or null. */
export function getLastValidRun(): HistoryRun | null {
  const valid = loadHistory().filter((run) => run.valid);
  if (valid.length === 0) return null;
  return valid[valid.length - 1] ?? null;
}

export function createHistoryId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Append a valid run. Keeps at most the newest 30 valid entries. */
export function appendValidRun(
  entry: Omit<HistoryRun, "valid"> & { valid?: boolean },
): HistoryRun {
  const nextEntry: HistoryRun = {
    ...entry,
    valid: true,
    interferenceMs:
      entry.interferenceMs === null
        ? null
        : Math.max(0, Math.round(entry.interferenceMs)),
  };
  const prior = loadHistory().filter((run) => run.valid);
  const next = [...prior, nextEntry].slice(-MAX_VALID_RUNS);
  saveHistory(next);
  return nextEntry;
}

export function compareReaction(
  current: number,
  previous: number,
  lang: ResultCardLang,
): MetricCmp {
  const delta = current - previous;
  if (delta === 0) {
    return {
      arrow: "→",
      label: lang === "zh" ? "same vs last" : "same vs last",
    };
  }
  if (delta < 0) {
    return {
      arrow: "↓",
      label: `${Math.abs(delta)} ms vs last`,
    };
  }
  return {
    arrow: "↑",
    label: `${delta} ms vs last`,
  };
}

export function compareAccuracy(
  current: number,
  previous: number,
  lang: ResultCardLang,
): MetricCmp {
  const delta = current - previous;
  if (delta === 0) {
    return {
      arrow: "→",
      label: lang === "zh" ? "same vs last" : "same vs last",
    };
  }
  if (delta > 0) {
    return {
      arrow: "↑",
      label: `${delta} pp vs last`,
    };
  }
  return {
    arrow: "↓",
    label: `${Math.abs(delta)} pp vs last`,
  };
}

export function compareInterference(
  current: number,
  previous: number,
  lang: ResultCardLang,
): MetricCmp {
  const cur = Math.max(0, current);
  const prev = Math.max(0, previous);
  const delta = cur - prev;
  if (delta === 0) {
    return {
      arrow: "→",
      label: lang === "zh" ? "same vs last" : "same vs last",
    };
  }
  if (delta < 0) {
    return {
      arrow: "↓",
      label: `${Math.abs(delta)} ms vs last`,
    };
  }
  return {
    arrow: "↑",
    label: `${delta} ms vs last`,
  };
}
