import type { ApexVariant } from "@/lib/calculateTier";

export type BenchmarkData = {
  avgSrt: number;
  interference: number;
  acc: number;
  reportAt: Date;
  /** A/B flag: true if user finished 3× 5-5 breath cycles before starting the cognitive test. */
  completedBreathingBeforeTest: boolean;
  /**
   * Locked Tier 00 dual-apex skin for this session result.
   * Set once at result generation (50/50). Null when not Tier 00.
   */
  apexVariant: ApexVariant | null;
};
