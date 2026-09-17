// DEV ONLY - remove before launch
import { TIER_BASELINE_LOSS, type ApexVariant } from "@/lib/calculateTier";

export type DevTierOverride =
  | "hidden-aurora"
  | "hidden-midnight"
  | "tier00"
  | "tier00x"
  | "tier_lofoten"
  | "tier01"
  | "tier02"
  | "tier03"
  | "tier04";

export type DevTierFixture = {
  latency: number;
  interference: number;
  accuracy: number;
  completedBreathingBeforeTest: boolean;
  apexVariant: ApexVariant | null;
  sessionId: string;
};

const DEV_TIER_KEYS: Record<DevTierOverride, true> = {
  "hidden-aurora": true,
  "hidden-midnight": true,
  tier00: true,
  tier00x: true,
  tier_lofoten: true,
  tier01: true,
  tier02: true,
  tier03: true,
  tier04: true,
};

export function parseDevTier(
  raw: string | null | undefined,
): DevTierOverride | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  if (key === "tier_lofoten") return "tier00x";
  return key in DEV_TIER_KEYS ? (key as DevTierOverride) : null;
}

/** Fixture scores that satisfy the requested card. In-memory preview only. */
export function getDevTierFixture(key: DevTierOverride): DevTierFixture {
  switch (key) {
    case "hidden-aurora":
      return {
        latency: 165,
        interference: 0,
        accuracy: 100,
        completedBreathingBeforeTest: true,
        apexVariant: "aurora",
        sessionId: "MOS-DEV-HID-A",
      };
    case "hidden-midnight":
      return {
        latency: 165,
        interference: 0,
        accuracy: 100,
        completedBreathingBeforeTest: true,
        apexVariant: "midnight-sun",
        sessionId: "MOS-DEV-HID-M",
      };
    case "tier00":
      return {
        latency: 210,
        interference: 10,
        accuracy: 100,
        completedBreathingBeforeTest: true,
        apexVariant: "aurora",
        sessionId: "MOS-DEV-T00S",
      };
    case "tier00x":
    case "tier_lofoten":
      return {
        latency: 165,
        interference: 0,
        accuracy: 100,
        completedBreathingBeforeTest: true,
        apexVariant: "void",
        sessionId: "MOS-DEV-T0X",
      };
    case "tier01":
      return {
        latency: 205,
        interference: TIER_BASELINE_LOSS[1],
        accuracy: 100,
        completedBreathingBeforeTest: true,
        apexVariant: null,
        sessionId: "MOS-DEV-T001",
      };
    case "tier02":
      return {
        latency: 255,
        interference: TIER_BASELINE_LOSS[2],
        accuracy: 100,
        completedBreathingBeforeTest: true,
        apexVariant: null,
        sessionId: "MOS-DEV-T002",
      };
    case "tier03":
      return {
        latency: 310,
        interference: TIER_BASELINE_LOSS[3],
        accuracy: 75,
        completedBreathingBeforeTest: false,
        apexVariant: null,
        sessionId: "MOS-DEV-T003",
      };
    case "tier04":
      return {
        latency: 380,
        interference: TIER_BASELINE_LOSS[4],
        accuracy: 50,
        completedBreathingBeforeTest: false,
        apexVariant: null,
        sessionId: "MOS-DEV-T004",
      };
  }
}
