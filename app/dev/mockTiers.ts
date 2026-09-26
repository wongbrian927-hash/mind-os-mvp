/** Dev-only tier preview fixtures. Guard with NODE_ENV === "development". */

import { TIER_BASELINE_LOSS, type ApexVariant } from "@/lib/calculateTier";
import { STROOP_COUNT } from "@/lib/focusSession";

export type MockTierKey =
  | "tier00"
  | "tier0"
  | "tier0-aurora"
  | "tier0-sun"
  | "tier00x"
  | "tier1"
  | "tier2"
  | "tier3"
  | "tier4";

export type MockTierPayload = {
  key: MockTierKey;
  label: string;
  latency: number;
  interference: number;
  accuracy: number;
  completedBreathingBeforeTest: boolean;
  sessionId: string;
  apexVariant?: ApexVariant;
};

const TIER0_BASE = {
  latency: 165,
  interference: TIER_BASELINE_LOSS[0],
  accuracy: 100,
  completedBreathingBeforeTest: true,
} as const;

/** Monotonic fixtures: Loss rises strictly as tier degrades (0 → 25 → 75 → 180 → 320). */
export const MOCK_TIERS: Record<MockTierKey, MockTierPayload> = {
  tier00: {
    key: "tier00",
    label: "Tier 00 · Random TOP 1%",
    latency: 210,
    interference: 10,
    accuracy: 100,
    completedBreathingBeforeTest: true,
    sessionId: "MOS-DEV-T00S",
  },
  tier0: {
    key: "tier0",
    label: "Tier 00 · Random TOP 1%",
    ...TIER0_BASE,
    sessionId: "MOS-DEV-T000",
  },
  "tier0-aurora": {
    key: "tier0-aurora",
    label: "Tier 00 · Aurora TOP 1%",
    ...TIER0_BASE,
    sessionId: "MOS-DEV-T0A",
    apexVariant: "aurora",
  },
  "tier0-sun": {
    key: "tier0-sun",
    label: "Tier 00 · Midnight TOP 1%",
    ...TIER0_BASE,
    sessionId: "MOS-DEV-T0S",
    apexVariant: "midnight-sun",
  },
  tier00x: {
    key: "tier00x",
    label: "Tier 00X · Monochrome Void",
    latency: 165,
    interference: 0,
    accuracy: 100,
    completedBreathingBeforeTest: true,
    sessionId: "MOS-DEV-T0X",
    apexVariant: "void",
  },
  tier1: {
    key: "tier1",
    label: "Tier 1 · 超感神經",
    latency: 205,
    interference: TIER_BASELINE_LOSS[1],
    accuracy: 100,
    completedBreathingBeforeTest: true,
    sessionId: "MOS-DEV-T001",
  },
  tier2: {
    key: "tier2",
    label: "Tier 2 · 敏銳清晰",
    latency: 255,
    interference: TIER_BASELINE_LOSS[2],
    accuracy: 100,
    completedBreathingBeforeTest: true,
    sessionId: "MOS-DEV-T002",
  },
  tier3: {
    key: "tier3",
    label: "Tier 3 · 認知負載",
    latency: 310,
    interference: TIER_BASELINE_LOSS[3],
    accuracy: 83,
    completedBreathingBeforeTest: false,
    sessionId: "MOS-DEV-T003",
  },
  tier4: {
    key: "tier4",
    label: "Tier 4 · Crimson Impulse",
    latency: 380,
    interference: TIER_BASELINE_LOSS[4],
    accuracy: 50,
    completedBreathingBeforeTest: false,
    sessionId: "MOS-DEV-T004",
  },
};

export function parseMockTierKey(raw: string | null | undefined): MockTierKey | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  if (key === "tier_lofoten") return "tier00x";
  return key in MOCK_TIERS ? (key as MockTierKey) : null;
}

/** Build synthetic SRT + Stroop arrays that resolve to the target averages. */
export function buildMockTrialData(payload: {
  latency: number;
  interference: number;
  accuracy: number;
}) {
  const latencies = Array.from({ length: 5 }, () => payload.latency);

  const congruentMs = 320;
  const incongruentMs = congruentMs + payload.interference;
  const correctCount = Math.round((payload.accuracy / 100) * STROOP_COUNT);
  const half = STROOP_COUNT / 2;

  const base = [
    ...Array.from({ length: half }, () => ({
      congruent: true,
      latencyMs: congruentMs,
      correct: true,
    })),
    ...Array.from({ length: half }, () => ({
      congruent: false,
      latencyMs: incongruentMs,
      correct: true,
    })),
  ];

  const stroopResults = base.map((trial, index) => ({
    ...trial,
    correct: index < correctCount,
  }));

  return { latencies, stroopResults };
}
