export type BenchmarkData = {
  avgSrt: number;
  interference: number;
  acc: number;
  reportAt: Date;
  /** A/B flag: true if user finished 3× 5-5 breath cycles before starting the cognitive test. */
  completedBreathingBeforeTest: boolean;
};
