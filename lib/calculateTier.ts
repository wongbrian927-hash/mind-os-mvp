export type TierLevel = 0 | 1 | 2 | 3 | 4;
export type ResultCardLang = "zh" | "en";
export type ApexVariant = "aurora" | "midnight-sun";

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
  statusPrimary: string;
  statusSecondary: string;
  diagnosis: string;
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
  ApexVariant,
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
    percentLabel: "★ TOP 0.01% · AURORA APEX",
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
    percentLabel: "★ TOP 0.01% · MIDNIGHT SOLAR",
    breathLabel: "SOLAR EQUILIBRIUM",
  },
};

export function pickRandomApexVariant(): ApexVariant {
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

export function isTierZero(
  data: Pick<
    TierInput,
    "latency" | "interference" | "accuracy" | "completedBreathingBeforeTest"
  >,
) {
  return (
    data.latency < 180 &&
    data.interference <= 0 &&
    data.accuracy === 100 &&
    data.completedBreathingBeforeTest
  );
}

/**
 * Worst-dimension wins (higher tier number = more degraded).
 * Ensures Interference Loss and overall grade stay monotonically aligned.
 */
export function calculateTierLevel(data: TierInput): TierLevel {
  if (isTierZero(data)) return 0;
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

/** Map Latency + Interference + Accuracy (+ breath calibration) → linked visual / clinical state. */
export function getTierConfig(data: TierInput): TierConfig {
  const { interference, lang, completedBreathingBeforeTest, apexVariant } = data;
  const isZh = lang === "zh";
  const level = calculateTierLevel(data);
  const diamondFilled = (5 - level) as 1 | 2 | 3 | 4 | 5;

  if (level === 0) {
    const variant = apexVariant ?? "aurora";
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
      title: isZh ? "神經超頻" : "Neural Overclock",
      titleEn: "TIER 00",
      percentLabel: preset.percentLabel,
      statusPrimary: "Trapezius: Deep Released",
      statusSecondary: "Focus Index: APEX 0.01%",
      diagnosis: isZh
        ? "神經傳導閾值達到生理極限，前額葉抑制損耗趨近於零，處於極致心流與自主神經高度協調狀態。"
        : "Neural conduction is at the physiological limit. Prefrontal inhibitory loss approaches zero — peak flow with high autonomic coherence.",
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
      title: isZh ? "超感神經" : "Hyper-Neural",
      titleEn: "TIER 01",
      percentLabel: "TOP 5%",
      statusPrimary: "Trapezius: Decompressed",
      statusSecondary: "Focus Index: Top 5%",
      diagnosis: isZh
        ? "視覺神經衝動傳導迅速，文字衝突抑制維持在極低損耗區間。"
        : "Visual impulse transmission is rapid. Conflict suppression stays in the low-loss band.",
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
      statusPrimary: "Trapezius: Neutral",
      statusSecondary: "Focus Index: Top 30%",
      diagnosis: isZh
        ? "視覺傳導維持敏捷，抗干擾濾波在可接受區間內穩定運作。"
        : "Visual conduction remains sharp. Interference filtering is stable within range.",
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
      title: isZh ? "認知負載" : "Cognitive Load",
      titleEn: "TIER 03",
      percentLabel: "TOP 60%",
      statusPrimary: "Trapezius: Elevated",
      statusSecondary: "Focus Index: Baseline",
      diagnosis: isZh
        ? "反應通道尚可，但文字意義干擾上升，抑制控制負載偏高。"
        : "Response channels remain intact, but semantic interference elevates inhibitory load.",
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
    glow: "0 0 10px rgba(225,29,72,0.45)",
    cardShadow: "none",
    cardBorder: "rgba(24, 24, 27, 0.1)",
    cardBackground: "#F8F9FA",
    progress: 0.22,
    title: isZh ? "神經疲勞" : "Neural Fatigue",
    titleEn: "TIER 04",
    percentLabel: "RECHARGE",
    statusPrimary: "Trapezius: Guarded",
    statusSecondary: "Focus Index: Recharge",
    diagnosis: isZh
      ? "大腦處於疲勞狀態，建議再做一次 5-5 諧振呼吸深層重置。"
      : "The system is fatigued. Another 5-5 coherence round is indicated for deep reset.",
    interferenceLabel:
      interference > 220
        ? isZh
          ? "高負載干擾"
          : "Overloaded"
        : isZh
          ? "疲勞區間"
          : "Fatigue Band",
    breathLabel: "DRIFT",
    isApex: false,
    ...emptyApexFields(),
  };
}
