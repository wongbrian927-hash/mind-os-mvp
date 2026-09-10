/** Dev-only tier preview fixtures. Guard with NODE_ENV === "development". */

import { TIER_BASELINE_LOSS } from "@/lib/calculateTier";

export type MockTierKey = "tier0" | "tier1" | "tier2" | "tier3" | "tier4";

export type MockTierPayload = {
  key: MockTierKey;
  label: string;
  latency: number;
  interference: number;
  accuracy: number;
  completedBreathingBeforeTest: boolean;
  sessionId: string;
};

/** Monotonic fixtures: Loss rises strictly as tier degrades (0 → 25 → 75 → 180 → 320). */
export const MOCK_TIERS: Record<MockTierKey, MockTierPayload> = {
  tier0: {
    key: "tier0",
    label: "Tier 0 · 神經超頻",
    latency: 165,
    interference: TIER_BASELINE_LOSS[0],
    accuracy: 100,
    completedBreathingBeforeTest: true,
    sessionId: "MOS-DEV-T000",
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
    accuracy: 75,
    completedBreathingBeforeTest: false,
    sessionId: "MOS-DEV-T003",
  },
  tier4: {
    key: "tier4",
    label: "Tier 4 · 神經疲勞",
    latency: 380,
    interference: TIER_BASELINE_LOSS[4],
    accuracy: 50,
    completedBreathingBeforeTest: false,
    sessionId: "MOS-DEV-T004",
  },
};

export function parseMockTierKey(raw: string | null | undefined): MockTierKey | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase() as MockTierKey;
  return key in MOCK_TIERS ? key : null;
}

/** Build synthetic SRT + Stroop arrays that resolve to the target averages. */
export function buildMockTrialData(payload: MockTierPayload) {
  const latencies = [payload.latency, payload.latency, payload.latency];

  // 2 congruent + 2 incongruent; interference = mean(incong) - mean(cong)
  const congruentMs = 320;
  const incongruentMs = congruentMs + payload.interference;
  const correctCount = Math.round((payload.accuracy / 100) * 4);

  const base = [
    { congruent: true, latencyMs: congruentMs, correct: true },
    { congruent: true, latencyMs: congruentMs, correct: true },
    { congruent: false, latencyMs: incongruentMs, correct: true },
    { congruent: false, latencyMs: incongruentMs, correct: true },
  ];

  const stroopResults = base.map((trial, index) => ({
    ...trial,
    correct: index < correctCount,
  }));

  return { latencies, stroopResults };
}
