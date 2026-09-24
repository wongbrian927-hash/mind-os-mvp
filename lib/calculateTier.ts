export type TierLevel = 0 | 1 | 2 | 3 | 4;
export type ResultCardLang = "zh" | "en";
export type ApexSkin = "aurora" | "midnight-sun";
export type ApexVariant = ApexSkin | "void";

export type TierInput = {
  latency: number;
  interference: number;
  accuracy: number;
  lang: ResultCardLang;
  /** True when user finished 3× 5-5 breath cycles before the test. */
  completedBreathingBeforeTest: boolean;
  /** Tier 00 dual-apex skin. Ignored for Tier 01–04. */
  apexVariant?: ApexVariant;
};

export type TierConfig = {
  level: TierLevel;
  /** Filled diamonds in the 5-scale gauge (Tier00=5 … Tier04=1). */
  diamondFilled: number;
  accent: string;
  accentSoft: string;
  glow: string;
  cardShadow: string;
  cardBorder: string;
  cardBackground: string;
  progress: number;
  title: string;
  titleEn: string;
  percentLabel: string;
  /** Plain-language focus meaning shown before the branded title. */
  focusPlain: string;
  statusPrimary: string;
  statusSecondary: string;
  diagnosis: string;
  /** Optional supporting line under diagnosis (retest hint, etc.). */
  diagnosisSupport: string | null;
  /** Optional practice invite under the run summary. Tier 03–04 only. */
  practiceNote: string | null;
  /** Soft footer note: single-run framing. */
  sessionNote: string | null;
  interferenceLabel: string;
  breathLabel: string;
  isApex: boolean;
  variant: ApexVariant | null;
  /** CSS linear-gradient for bars / accents (export-safe). */
  spectrumGradient: string | null;
  /** Per-diamond solid colors — avoids bg-clip-text export bugs. */
  diamondColors: string[] | null;
  latencyFilter: string | null;
  /** Multi-layer radial glow overlaid on card background. */
  radialGlow: string | null;
};

/** Baseline mock / reference interference loss — strictly monotonic by tier. */
export const TIER_BASELINE_LOSS: Record<TierLevel, number> = {
  0: 0,
  1: 25,
  2: 75,
  3: 180,
  4: 320,
};

export const APEX_VARIANT_PRESETS: Record<
  ApexSkin,
  {
    accent: string;
    accentSoft: string;
    glow: string;
    cardShadow: string;
    cardBorder: string;
    cardBackground: string;
    spectrumGradient: string;
    diamondColors: string[];
    latencyFilter: string;
    radialGlow: string;
    percentLabel: string;
    breathLabel: string;
  }
> = {
  aurora: {
    accent: "#60EFFF",
    accentSoft: "rgba(96, 239, 255, 0.14)",
    glow: "0 0 12px rgba(96, 239, 255, 0.5)",
    cardShadow: "0 0 35px rgba(96, 239, 255, 0.14)",
    cardBorder: "rgba(96, 239, 255, 0.28)",
    cardBackground: "#06090E",
    spectrumGradient:
      "linear-gradient(135deg, #00FF87 0%, #60EFFF 50%, #A855F7 100%)",
    diamondColors: ["#00FF87", "#33F5B5", "#60EFFF", "#8480F5", "#A855F7"],
    latencyFilter:
      "drop-shadow(0 0 16px rgba(96, 239, 255, 0.4)) drop-shadow(0 0 30px rgba(168, 85, 247, 0.2))",
    radialGlow: [
      "radial-gradient(ellipse 80% 50% at 18% 0%, rgba(0,255,135,0.16), transparent 55%)",
      "radial-gradient(ellipse 70% 45% at 85% 28%, rgba(168,85,247,0.14), transparent 52%)",
      "radial-gradient(ellipse 90% 40% at 50% 100%, rgba(96,239,255,0.1), transparent 48%)",
    ].join(", "),
    percentLabel: "TOP 1%",
    breathLabel: "PERFECT SYNC",
  },
  "midnight-sun": {
    accent: "#FFA751",
    accentSoft: "rgba(255, 167, 81, 0.14)",
    glow: "0 0 12px rgba(255, 180, 0, 0.45)",
    cardShadow: "0 0 35px rgba(255, 167, 81, 0.14)",
    cardBorder: "rgba(255, 167, 81, 0.3)",
    cardBackground: "#0B090A",
    spectrumGradient:
      "linear-gradient(135deg, #FFE259 0%, #FFA751 50%, #FF5858 100%)",
    diamondColors: ["#FFE259", "#FFC455", "#FFA751", "#FF7F54", "#FF5858"],
    latencyFilter:
      "drop-shadow(0 0 16px rgba(255, 180, 0, 0.4)) drop-shadow(0 0 30px rgba(255, 88, 88, 0.2))",
    radialGlow: [
      "radial-gradient(ellipse 95% 42% at 50% 100%, rgba(255,167,81,0.2), transparent 55%)",
      "radial-gradient(ellipse 60% 35% at 15% 0%, rgba(255,226,89,0.1), transparent 48%)",
      "radial-gradient(ellipse 50% 30% at 90% 20%, rgba(255,88,88,0.08), transparent 45%)",
    ].join(", "),
    percentLabel: "TOP 1%",
    breathLabel: "SOLAR EQUILIBRIUM",
  },
};

export function pickRandomApexVariant(): ApexSkin {
  return Math.random() < 0.5 ? "aurora" : "midnight-sun";
}

function latencyBand(latency: number): Exclude<TierLevel, 0> {
  if (latency > 340) return 4;
  if (latency >= 281) return 3;
  if (latency >= 231) return 2;
  return 1;
}

function interferenceBand(loss: number): Exclude<TierLevel, 0> {
  if (loss > 220) return 4;
  if (loss >= 101) return 3;
  if (loss >= 41) return 2;
  return 1;
}

function accuracyBand(accuracy: number): Exclude<TierLevel, 0> {
  if (accuracy < 70) return 4;
  if (accuracy < 80) return 3;
  if (accuracy < 90) return 2;
  return 1;
}

type TierGateInput = Pick<
  TierInput,
  "latency" | "interference" | "accuracy" | "completedBreathingBeforeTest"
>;

/** Hidden TIER 00X · Monochrome Void — deterministic; no probability. */
export function isTier00XEligible(data: TierGateInput) {
  return (
    data.completedBreathingBeforeTest === true &&
    data.latency < 200 &&
    data.interference <= 0 &&
    data.accuracy === 100
  );
}

/** TIER 00 score bands only — breath gate lives in `isStandardTierZero`. */
export function meetsTier00Metrics(
  data: Pick<TierInput, "latency" | "interference" | "accuracy">,
) {
  return data.latency < 215 && data.interference < 25 && data.accuracy === 100;
}

/** Ordinary TIER 00 — aurora / midnight-sun, TOP 1%. */
export function isStandardTierZero(data: TierGateInput) {
  return meetsTier00Metrics(data) && data.completedBreathingBeforeTest;
}

export function isTierZero(data: TierGateInput) {
  return isTier00XEligible(data) || isStandardTierZero(data);
}

/**
 * Worst-dimension wins (higher tier number = more degraded).
 * Ensures Interference Loss and overall grade stay monotonically aligned.
 * Hidden TIER 00 is evaluated before standard TIER 00.
 */
export function calculateTierLevel(data: TierInput): TierLevel {
  if (isTier00XEligible(data) || isStandardTierZero(data)) return 0;
  return Math.max(
    latencyBand(data.latency),
    interferenceBand(data.interference),
    accuracyBand(data.accuracy),
  ) as Exclude<TierLevel, 0>;
}

export function interferenceDisplay(ms: number) {
  if (ms <= 0) return "0";
  return `+${ms}`;
}

function emptyApexFields() {
  return {
    variant: null as ApexVariant | null,
    spectrumGradient: null as string | null,
    diamondColors: null as string[] | null,
    latencyFilter: null as string | null,
    radialGlow: null as string | null,
  };
}

const SESSION_NOTE = {
  zh: "僅反映今次表現。",
  en: "This run only.",
} as const;

const RETEST_SUPPORT = {
  zh: "分心或裝置延遲時，可再測一次。",
  en: "Distracted or laggy? Try again.",
} as const;

const PRACTICE_NOTE = {
  zh: "想轉換一下節奏？可以試試 30 秒呼吸。",
  en: "Want a change of pace? Try the 30-second breath.",
} as const;

/** Map Latency + Interference + Accuracy (+ breath calibration) → linked visual / system state. */
export function getTierConfig(data: TierInput): TierConfig {
  const { interference, lang, completedBreathingBeforeTest, apexVariant } = data;
  const isZh = lang === "zh";
  const level = calculateTierLevel(data);
  const diamondFilled = (5 - level) as 1 | 2 | 3 | 4 | 5;
  const sessionNote = isZh ? SESSION_NOTE.zh : SESSION_NOTE.en;
  const retestSupport = isZh ? RETEST_SUPPORT.zh : RETEST_SUPPORT.en;

  if (apexVariant === "void" || (isTier00XEligible(data) && apexVariant !== "aurora" && apexVariant !== "midnight-sun")) {
    return {
      level: 0,
      diamondFilled: 5,
      accent: "#FAFAFA",
      accentSoft: "rgba(255,255,255,0.06)",
      glow: "0 0 8px rgba(255,255,255,0.45)",
      cardShadow: "0 0 25px rgba(255,255,255,0.06)",
      cardBorder: "rgba(63, 63, 70, 0.6)",
      cardBackground: "#09090b",
      progress: 1,
      title: "TIER 00X · MONOCHROME VOID",
      titleEn: "TIER 00X · MONOCHROME VOID",
      percentLabel: "TITANIUM PURITY · TOP 0.01%",
      focusPlain: isZh ? "極致同步" : "Peak sync",
      statusPrimary: "Trapezius: Deep Released",
      statusSecondary: "Focus Index: Titanium Purity",
      diagnosis: isZh
        ? "今次訊號極乾淨，干擾趨近於零。"
        : "Signal is clean — interference near zero.",
      diagnosisSupport: null,
      practiceNote: null,
      sessionNote,
      interferenceLabel: "Zero Interference",
      breathLabel: "VOID LOCK",
      isApex: true,
      variant: "void",
      spectrumGradient: null,
      diamondColors: null,
      latencyFilter: "drop-shadow(0 0 10px rgba(255,255,255,0.3))",
      radialGlow: null,
    };
  }

  if (level === 0) {
    const variant: ApexSkin =
      apexVariant === "midnight-sun" ? "midnight-sun" : "aurora";
    const preset = APEX_VARIANT_PRESETS[variant];
    return {
      level: 0,
      diamondFilled: 5,
      accent: preset.accent,
      accentSoft: preset.accentSoft,
      glow: preset.glow,
      cardShadow: preset.cardShadow,
      cardBorder: preset.cardBorder,
      cardBackground: preset.cardBackground,
      progress: 1,
      title: isZh ? "系統超頻" : "System Overclock",
      titleEn: "TIER 00",
      percentLabel: preset.percentLabel,
      focusPlain: isZh ? "狀態極佳" : "Peak form",
      statusPrimary: "Trapezius: Deep Released",
      statusSecondary: "Focus Index: Top 1%",
      diagnosis: isZh
        ? "今次反應引擎完全對齊，干擾趨近於零。"
        : "Reaction engine locked in sync. Interference near zero.",
      diagnosisSupport: null,
      practiceNote: null,
      sessionNote,
      interferenceLabel: "Zero Interference",
      breathLabel: preset.breathLabel,
      isApex: true,
      variant,
      spectrumGradient: preset.spectrumGradient,
      diamondColors: preset.diamondColors,
      latencyFilter: preset.latencyFilter,
      radialGlow: preset.radialGlow,
    };
  }

  if (level === 1) {
    return {
      level: 1,
      diamondFilled,
      accent: "#10B981",
      accentSoft: "rgba(16,185,129,0.18)",
      glow: "0 0 10px rgba(16,185,129,0.55)",
      cardShadow: "none",
      cardBorder: "rgba(24, 24, 27, 0.1)",
      cardBackground: "#F8F9FA",
      progress: 0.92,
      title: isZh ? "超感同步" : "Hyper Sync",
      titleEn: "TIER 01",
      percentLabel: "TOP 5%",
      focusPlain: isZh ? "反應很快" : "Very sharp",
      statusPrimary: "Trapezius: Decompressed",
      statusSecondary: "Focus Index: Top 5%",
      diagnosis: isZh
        ? "今次反應很快，干擾維持在低水平。"
        : "Fast reaction this run. Interference stayed low.",
      diagnosisSupport: null,
      practiceNote: null,
      sessionNote,
      interferenceLabel: isZh ? "極低干擾" : "High Resilience",
      breathLabel: completedBreathingBeforeTest ? "ALIGNED" : "STABLE",
      isApex: false,
      ...emptyApexFields(),
    };
  }

  if (level === 2) {
    return {
      level: 2,
      diamondFilled,
      accent: "#0EA5E9",
      accentSoft: "rgba(14,165,233,0.18)",
      glow: "0 0 10px rgba(14,165,233,0.5)",
      cardShadow: "none",
      cardBorder: "rgba(24, 24, 27, 0.1)",
      cardBackground: "#F8F9FA",
      progress: 0.72,
      title: isZh ? "敏銳清晰" : "Sharp Clarity",
      titleEn: "TIER 02",
      percentLabel: "TOP 30%",
      focusPlain: isZh ? "表現穩定" : "Steady run",
      statusPrimary: "Trapezius: Neutral",
      statusSecondary: "Focus Index: Top 30%",
      diagnosis: isZh
        ? "今次表現穩陣，屬正常區間。"
        : "Solid run — within a normal range.",
      diagnosisSupport: null,
      practiceNote: null,
      sessionNote,
      interferenceLabel: isZh ? "平衡抑制" : "Balanced Control",
      breathLabel: completedBreathingBeforeTest ? "ALIGNED" : "STABLE",
      isApex: false,
      ...emptyApexFields(),
    };
  }

  if (level === 3) {
    return {
      level: 3,
      diamondFilled,
      accent: "#F59E0B",
      accentSoft: "rgba(245,158,11,0.2)",
      glow: "0 0 10px rgba(245,158,11,0.5)",
      cardShadow: "none",
      cardBorder: "rgba(24, 24, 27, 0.1)",
      cardBackground: "#F8F9FA",
      progress: 0.48,
      title: isZh ? "負載偏高" : "Elevated Load",
      titleEn: "TIER 03",
      percentLabel: "TOP 60%",
      focusPlain: isZh ? "有啲慢熱" : "A bit off",
      statusPrimary: "Trapezius: Elevated",
      statusSecondary: "Focus Index: Baseline",
      diagnosis: isZh
        ? "今次有啲慢熱，但唔代表系統壞咗。"
        : "A bit slow to warm up — not a broken system.",
      diagnosisSupport: retestSupport,
      practiceNote: isZh ? PRACTICE_NOTE.zh : PRACTICE_NOTE.en,
      sessionNote,
      interferenceLabel: isZh ? "中度干擾" : "Moderate Load",
      breathLabel: "DRIFT",
      isApex: false,
      ...emptyApexFields(),
    };
  }

  return {
    level: 4,
    diamondFilled,
    accent: "#E11D48",
    accentSoft: "rgba(225,29,72,0.18)",
    glow: "0 0 12px rgba(220,38,38,0.55)",
    cardShadow: "0 0 25px rgba(220, 38, 38, 0.25)",
    cardBorder: "rgba(127, 29, 29, 0.8)",
    cardBackground: "#09090b",
    progress: 0.22,
    title: isZh ? "赤紅脈衝" : "Crimson Impulse",
    titleEn: "TIER 04",
    percentLabel: "RECHARGE",
    focusPlain: isZh ? "需要回氣" : "Needs a reset",
    statusPrimary: "Trapezius: Guarded",
    statusSecondary: "Focus Index: Recharge",
    diagnosis: isZh
      ? "今次反應偏慢，建議再測一次。"
      : "Slower reaction this run. Worth another pass.",
    diagnosisSupport: retestSupport,
    practiceNote: isZh ? PRACTICE_NOTE.zh : PRACTICE_NOTE.en,
    sessionNote,
    interferenceLabel:
      interference > 220
        ? isZh
          ? "高延遲干擾"
          : "High Latency"
        : isZh
          ? "延遲偏高"
          : "Elevated Latency",
    breathLabel: "DRIFT",
    isApex: false,
    ...emptyApexFields(),
  };
}

/** Flag sessions that look interrupted / device-lagged — presentation only. */
export function isAbnormalSession(input: {
  latencies: number[];
  stroopLatencies: number[];
  interrupted: boolean;
}) {
  if (input.interrupted) return true;
  const ABNORMAL_SRT_MS = 2000;
  const ABNORMAL_STROOP_MS = 3500;
  if (input.latencies.some((ms) => ms >= ABNORMAL_SRT_MS)) return true;
  if (input.stroopLatencies.some((ms) => ms >= ABNORMAL_STROOP_MS)) return true;
  if (input.latencies.length >= 3) {
    const sorted = [...input.latencies].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const med =
      sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
    const max = sorted[sorted.length - 1];
    if (med > 0 && max >= Math.max(ABNORMAL_SRT_MS, med * 4)) return true;
  }
  return false;
}
