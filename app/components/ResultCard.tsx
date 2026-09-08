"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { toBlob, toPng } from "html-to-image";
import type { BenchmarkData } from "@/types/benchmark";

export type ResultCardLang = "zh" | "en";
export type CardAspect = "story" | "square";
export type TierLevel = 1 | 2 | 3 | 4;

export type ResultCardProps = Pick<
  BenchmarkData,
  "avgSrt" | "interference" | "acc" | "reportAt" | "completedBreathingBeforeTest"
> & {
  lang: ResultCardLang;
  onSaved?: () => void;
};

type TierInput = {
  latency: number;
  interference: number;
  accuracy: number;
  lang: ResultCardLang;
};

type TierConfig = {
  level: TierLevel;
  accent: string;
  accentSoft: string;
  glow: string;
  progress: number;
  title: string;
  titleEn: string;
  percentLabel: string;
  statusPrimary: string;
  statusSecondary: string;
  diagnosis: string;
  symbol: "diamond" | "circle" | "triangle" | "slash";
  interferenceLabel: string;
  breathLabel: string;
};

const COPY = {
  zh: {
    brand: "MIND OS",
    protocol: "NEURAL BENCHMARK",
    save: "儲存數據卡片（Save Image）",
    saving: "產生中…",
    saved: "已儲存",
    story: "9:16",
    square: "1:1",
    reaction: "REACTION LATENCY",
    tier: "FOCUS TIER",
    interference: "INTERFERENCE LOSS",
    accuracy: "FOCUS ACCURACY",
    breath: "5-5 CALIBRATION",
    status: "STATUS LABELS",
    watermark: "Mind OS · Bio-Quant Protocol",
  },
  en: {
    brand: "MIND OS",
    protocol: "NEURAL BENCHMARK",
    save: "Save Image",
    saving: "Rendering…",
    saved: "Saved",
    story: "9:16",
    square: "1:1",
    reaction: "REACTION LATENCY",
    tier: "FOCUS TIER",
    interference: "INTERFERENCE LOSS",
    accuracy: "FOCUS ACCURACY",
    breath: "5-5 CALIBRATION",
    status: "STATUS LABELS",
    watermark: "Mind OS · Bio-Quant Protocol",
  },
} as const;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function formatLocalStamp(date: Date) {
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}  ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatUtcStamp(date: Date) {
  return `${date.getUTCFullYear()}.${pad(date.getUTCMonth() + 1)}.${pad(date.getUTCDate())}  ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
}

function buildSessionId(avgSrt: number, interference: number, acc: number, at: Date) {
  const raw = `${avgSrt}|${interference}|${acc}|${at.getTime()}`;
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i += 1) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hex = (hash >>> 0).toString(16).toUpperCase().padStart(8, "0");
  return `MOS-${hex.slice(0, 4)}-${hex.slice(4)}`;
}

function resolveTierLevel(latency: number, interference: number, accuracy: number): TierLevel {
  if (latency >= 360 || accuracy < 50) return 4;
  if (latency >= 290 || interference > 80 || accuracy < 75) return 3;
  if (latency >= 240 || interference > 40) return 2;
  return 1;
}

function interferenceDisplay(ms: number) {
  if (ms <= 0) return "0";
  return `+${ms}`;
}

/** Map Latency + Interference + Accuracy → linked visual / clinical state. */
export function getTierConfig(data: TierInput): TierConfig {
  const { latency, interference, accuracy, lang } = data;
  const isZh = lang === "zh";
  const level = resolveTierLevel(latency, interference, accuracy);
  const displayLoss = interferenceDisplay(interference);

  if (level === 1) {
    return {
      level: 1,
      accent: "#10B981",
      accentSoft: "rgba(16,185,129,0.18)",
      glow: "0 0 10px rgba(16,185,129,0.55)",
      progress: 0.92,
      title: isZh ? "超感神經" : "Hyper-Neural",
      titleEn: "TIER 01",
      percentLabel: "TOP 5%",
      statusPrimary: "Trapezius: Decompressed",
      statusSecondary: "Focus Index: Top 5%",
      diagnosis: isZh
        ? "視覺神經衝動傳導迅速，文字衝突抑制達到零損耗閾值。"
        : "Visual impulse transmission is rapid. Conflict suppression sits at the zero-loss threshold.",
      symbol: "diamond",
      interferenceLabel:
        interference <= 0
          ? isZh
            ? "Zero Interference"
            : "Zero Interference"
          : isZh
            ? "極低干擾"
            : "High Resilience",
      breathLabel: isZh ? "STABLE" : "STABLE",
    };
  }

  if (level === 2) {
    return {
      level: 2,
      accent: "#0EA5E9",
      accentSoft: "rgba(14,165,233,0.18)",
      glow: "0 0 10px rgba(14,165,233,0.5)",
      progress: 0.72,
      title: isZh ? "敏銳清晰" : "Sharp Clarity",
      titleEn: "TIER 02",
      percentLabel: "TOP 30%",
      statusPrimary: "Trapezius: Neutral",
      statusSecondary: "Focus Index: Top 30%",
      diagnosis: isZh
        ? "視覺傳導維持敏捷，抗干擾濾波在可接受區間內穩定運作。"
        : "Visual conduction remains sharp. Interference filtering is stable within range.",
      symbol: "circle",
      interferenceLabel:
        interference <= 0
          ? "Zero Interference"
          : isZh
            ? "平衡抑制"
            : "Balanced Control",
      breathLabel: isZh ? "ALIGNED" : "ALIGNED",
    };
  }

  if (level === 3) {
    return {
      level: 3,
      accent: "#F59E0B",
      accentSoft: "rgba(245,158,11,0.2)",
      glow: "0 0 10px rgba(245,158,11,0.5)",
      progress: 0.48,
      title: isZh ? "認知負載" : "Cognitive Load",
      titleEn: "TIER 03",
      percentLabel: "TOP 60%",
      statusPrimary: "Trapezius: Elevated",
      statusSecondary: "Focus Index: Baseline",
      diagnosis: isZh
        ? "反應通道尚可，但文字意義干擾上升，抑制控制負載偏高。"
        : "Response channels remain intact, but semantic interference elevates inhibitory load.",
      symbol: "triangle",
      interferenceLabel:
        interference > 80
          ? isZh
            ? "顯著干擾"
            : "High Load"
          : isZh
            ? "中度干擾"
            : "Moderate Load",
      breathLabel: isZh ? "DRIFT" : "DRIFT",
    };
  }

  return {
    level: 4,
    accent: "#E11D48",
    accentSoft: "rgba(225,29,72,0.18)",
    glow: "0 0 10px rgba(225,29,72,0.45)",
    progress: 0.22,
    title: isZh ? "神經疲勞" : "Neural Fatigue",
    titleEn: "TIER 04",
    percentLabel: "RECHARGE",
    statusPrimary: "Trapezius: Guarded",
    statusSecondary: "Focus Index: Recharge",
    diagnosis: isZh
      ? "大腦處於疲勞狀態，建議再做一次 5-5 諧振呼吸深層重置。"
      : "The system is fatigued. Another 5-5 coherence round is indicated for deep reset.",
    symbol: "slash",
    interferenceLabel:
      interference > 80
        ? isZh
          ? "高負載干擾"
          : "Overloaded"
        : isZh
          ? "疲勞區間"
          : "Fatigue Band",
    breathLabel: isZh ? "UNSTABLE" : "UNSTABLE",
  };
}

function TierSymbol({
  symbol,
  color,
}: {
  symbol: TierConfig["symbol"];
  color: string;
}) {
  if (symbol === "diamond") {
    return (
      <span
        aria-hidden
        className="inline-block h-2.5 w-2.5 rotate-45 border"
        style={{ borderColor: color, backgroundColor: color }}
      />
    );
  }
  if (symbol === "circle") {
    return (
      <span
        aria-hidden
        className="inline-block h-2.5 w-2.5 rounded-full border-2"
        style={{ borderColor: color }}
      />
    );
  }
  if (symbol === "triangle") {
    return (
      <span
        aria-hidden
        className="inline-block"
        style={{
          width: 0,
          height: 0,
          borderLeft: "5px solid transparent",
          borderRight: "5px solid transparent",
          borderBottom: `9px solid ${color}`,
        }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="inline-block h-3 w-[1.5px] rotate-45"
      style={{ backgroundColor: color }}
    />
  );
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

const EXPORT_WIDTH = 1080;
const EXPORT_STORY_HEIGHT = 1920;
const EXPORT_SQUARE_HEIGHT = 1080;

function getExportPixelRatio(layoutWidth: number, layoutHeight: number) {
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  let pixelRatio = Math.min(3, Math.max(2, dpr) * 1.5);
  const longEdge = Math.max(layoutWidth, layoutHeight) * pixelRatio;
  if (longEdge > 4096) {
    pixelRatio = 4096 / Math.max(layoutWidth, layoutHeight);
  }
  return pixelRatio;
}

async function waitForFontsAndPaint() {
  try {
    if (typeof document !== "undefined" && "fonts" in document) {
      await document.fonts.ready;
    }
  } catch {
    // best-effort
  }
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, 50);
  });
}

function applyExportLayout(clone: HTMLElement, aspect: CardAspect) {
  const height = aspect === "story" ? EXPORT_STORY_HEIGHT : EXPORT_SQUARE_HEIGHT;
  const padY = aspect === "story" ? 96 : 72;
  const padX = 80;

  clone.setAttribute("data-export-root", "true");
  clone.className = clone.className
    .replace(/aspect-\[9\/16\]/g, "")
    .replace(/aspect-square/g, "");

  Object.assign(clone.style, {
    width: `${EXPORT_WIDTH}px`,
    height: `${height}px`,
    maxWidth: `${EXPORT_WIDTH}px`,
    minHeight: "0",
    aspectRatio: "auto",
    position: "relative",
    display: "block",
    overflow: "hidden",
    transform: "none",
    margin: "0",
    boxSizing: "border-box",
  });

  const shell = clone.querySelector("[data-card-shell]") as HTMLElement | null;
  if (shell) {
    shell.classList.remove("absolute", "inset-0");
    Object.assign(shell.style, {
      position: "relative",
      inset: "auto",
      top: "0",
      right: "0",
      bottom: "0",
      left: "0",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      width: "100%",
      height: "100%",
      minHeight: "0",
      maxHeight: "100%",
      padding: `${padY}px ${padX}px`,
      boxSizing: "border-box",
      margin: "0",
    });
  }

  // Drop preview-only vertical margins; spacing comes from justify-between.
  clone.querySelectorAll("[data-card-block]").forEach((node) => {
    const el = node as HTMLElement;
    el.style.marginTop = "0";
    el.style.marginBottom = "0";
    el.style.flexShrink = "0";
  });

  const latency = clone.querySelector("[data-export-latency]") as HTMLElement | null;
  if (latency) {
    latency.style.fontSize = aspect === "story" ? "118px" : "96px";
    latency.style.lineHeight = "1";
    latency.style.letterSpacing = "-0.04em";
  }

  const latencyUnit = clone.querySelector("[data-export-latency-unit]") as HTMLElement | null;
  if (latencyUnit) {
    latencyUnit.style.fontSize = "28px";
  }

  clone.querySelectorAll("[data-export-label]").forEach((node) => {
    const el = node as HTMLElement;
    el.style.fontSize = "18px";
    el.style.letterSpacing = "0.28em";
  });

  clone.querySelectorAll("[data-export-metric]").forEach((node) => {
    const el = node as HTMLElement;
    el.style.fontSize = aspect === "story" ? "64px" : "52px";
    el.style.lineHeight = "1.05";
  });

  clone.querySelectorAll("[data-export-title]").forEach((node) => {
    const el = node as HTMLElement;
    el.style.fontSize = "28px";
  });

  clone.querySelectorAll("[data-export-body]").forEach((node) => {
    const el = node as HTMLElement;
    el.style.fontSize = "22px";
    el.style.lineHeight = "1.55";
  });

  clone.querySelectorAll("[data-export-mono]").forEach((node) => {
    const el = node as HTMLElement;
    el.style.fontSize = "20px";
  });

  clone.querySelectorAll("[data-export-pill]").forEach((node) => {
    const el = node as HTMLElement;
    el.style.fontSize = "16px";
    el.style.padding = "8px 14px";
  });

  const bar = clone.querySelector("[data-export-bar]") as HTMLElement | null;
  if (bar) {
    bar.style.height = "4px";
    bar.style.marginTop = "28px";
    bar.style.marginBottom = "8px";
  }

  return { width: EXPORT_WIDTH, height };
}

function createExportMount(source: HTMLElement, aspect: CardAspect) {
  const mount = document.createElement("div");
  mount.setAttribute("data-mind-os-export-mount", "true");
  mount.style.cssText = [
    "position:fixed",
    "left:-12000px",
    "top:0",
    "width:1080px",
    "height:auto",
    "overflow:visible",
    "pointer-events:none",
    "opacity:1",
    "z-index:-1",
  ].join(";");

  const clone = source.cloneNode(true) as HTMLElement;
  const size = applyExportLayout(clone, aspect);
  mount.style.width = `${size.width}px`;
  mount.style.height = `${size.height}px`;
  mount.appendChild(clone);
  document.body.appendChild(mount);
  return { mount, clone, size };
}

async function renderExportBlob(
  source: HTMLElement,
  aspect: CardAspect,
): Promise<Blob> {
  const { mount, clone, size } = createExportMount(source, aspect);

  try {
    await waitForFontsAndPaint();

    const pixelRatio = getExportPixelRatio(size.width, size.height);
    const options = {
      width: size.width,
      height: size.height,
      pixelRatio,
      cacheBust: true,
      backgroundColor: "#F8F9FA",
      style: {
        width: `${size.width}px`,
        height: `${size.height}px`,
        maxWidth: `${size.width}px`,
        minHeight: "0px",
        aspectRatio: "auto",
        transform: "none",
        margin: "0",
      },
    };

    // Pass 1: prime Safari / html-to-image font embed cache (discarded).
    await toPng(clone, options);
    await new Promise<void>((resolve) => window.setTimeout(resolve, 30));

    // Pass 2: real capture.
    const blob = await toBlob(clone, options);
    if (!blob) throw new Error("Failed to render image blob");
    return blob;
  } finally {
    mount.remove();
  }
}

async function saveExportBlob(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: "image/png" });

  if (isIos()) {
    if (typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: "Mind OS Neural Benchmark",
      });
      return;
    }
    const url = URL.createObjectURL(blob);
    // iOS Safari often ignores <a download>; open blob so user can long-press save.
    const opened = window.open(url, "_blank");
    if (!opened) {
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener";
      link.click();
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = filename;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

async function exportCardImage(
  source: HTMLElement,
  filename: string,
  aspect: CardAspect,
) {
  const blob = await renderExportBlob(source, aspect);
  await saveExportBlob(blob, filename);
}

export default function ResultCard({
  lang,
  avgSrt,
  interference,
  acc,
  reportAt,
  completedBreathingBeforeTest,
  onSaved,
}: ResultCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [aspect, setAspect] = useState<CardAspect>("story");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const t = COPY[lang];
  const tier = useMemo(
    () =>
      getTierConfig({
        latency: avgSrt,
        interference,
        accuracy: acc,
        lang,
      }),
    [acc, avgSrt, interference, lang],
  );
  const protocolLabel =
    lang === "zh"
      ? completedBreathingBeforeTest
        ? "已完成呼吸校準後測得"
        : "未經呼吸校準（基準測試）"
      : completedBreathingBeforeTest
        ? "Protocol: Post-Calibration (5-5)"
        : "Protocol: Baseline Direct";
  const sessionId = useMemo(
    () => buildSessionId(avgSrt, interference, acc, reportAt),
    [acc, avgSrt, interference, reportAt],
  );
  const localStamp = formatLocalStamp(reportAt);
  const utcStamp = formatUtcStamp(reportAt);
  const lossDisplay = interferenceDisplay(interference);

  const handleSave = useCallback(async () => {
    if (!cardRef.current || busy) return;
    setBusy(true);
    setToast(null);
    try {
      const filename = `mind-os-${sessionId.toLowerCase()}.png`;
      await exportCardImage(cardRef.current, filename, aspect);
      setToast(t.saved);
      onSaved?.();
    } catch {
      setToast(lang === "zh" ? "匯出失敗，請再試一次" : "Export failed. Try again.");
    } finally {
      setBusy(false);
      window.setTimeout(() => setToast(null), 2600);
    }
  }, [aspect, busy, lang, onSaved, sessionId, t.saved]);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4">
      <div className="flex items-center gap-2 self-end">
        <button
          type="button"
          onClick={() => setAspect("story")}
          className={`rounded-full border px-3 py-1 font-mono text-[10px] tracking-[0.18em] transition ${
            aspect === "story"
              ? "border-zinc-300 bg-zinc-100 text-zinc-900"
              : "border-white/15 text-slate-400"
          }`}
        >
          {t.story}
        </button>
        <button
          type="button"
          onClick={() => setAspect("square")}
          className={`rounded-full border px-3 py-1 font-mono text-[10px] tracking-[0.18em] transition ${
            aspect === "square"
              ? "border-zinc-300 bg-zinc-100 text-zinc-900"
              : "border-white/15 text-slate-400"
          }`}
        >
          {t.square}
        </button>
      </div>

      <div
        ref={cardRef}
        className={`relative w-full overflow-hidden border border-zinc-800/10 bg-[#F8F9FA] text-[#0F1115] ${
          aspect === "story" ? "aspect-[9/16]" : "aspect-square"
        }`}
        style={{ fontFamily: "var(--font-geist-sans), Helvetica, Arial, sans-serif" }}
      >
        <div
          data-card-shell
          className="absolute inset-0 flex h-full flex-col justify-between px-7 py-8 sm:px-8 sm:py-9"
        >
          <header
            data-card-block
            className="flex items-start justify-between gap-4 border-b border-zinc-800/10 pb-4"
          >
            <div>
              <p
                data-export-label
                className="font-mono text-[10px] tracking-[0.32em] text-zinc-500"
              >
                {t.brand}
              </p>
              <p
                data-export-mono
                className="mt-1 font-mono text-[9px] tracking-[0.28em] text-zinc-400"
              >
                {t.protocol}
              </p>
            </div>
            <div className="text-right">
              <p
                data-export-mono
                className="font-mono text-[9px] tracking-[0.16em] text-zinc-500"
              >
                {localStamp}
              </p>
              <p
                data-export-mono
                className="mt-1 font-mono text-[8px] tracking-[0.14em] text-zinc-400"
              >
                {utcStamp}
              </p>
              <p
                data-export-mono
                className="mt-2 font-mono text-[9px] tracking-[0.18em] text-zinc-600"
              >
                {sessionId}
              </p>
            </div>
          </header>

          <section data-card-block>
            <div className="flex items-start justify-between gap-3">
              <p
                data-export-label
                className="text-[8px] font-medium uppercase tracking-[0.28em] text-zinc-400"
              >
                {t.reaction}
              </p>
              <TierSymbol symbol={tier.symbol} color={tier.accent} />
            </div>
            <p
              data-export-latency
              className="mt-2 font-mono text-6xl font-medium tracking-tight text-[#0F1115] sm:text-7xl"
              style={{ fontFamily: "var(--font-geist-mono), ui-monospace, monospace" }}
            >
              {avgSrt}
              <span
                data-export-latency-unit
                className="ml-2 align-baseline font-sans text-sm font-normal tracking-[0.18em] text-zinc-400"
              >
                ms
              </span>
            </p>
            <div
              data-export-bar
              className="mt-5 h-[2px] w-full"
              style={{ backgroundColor: tier.accentSoft }}
            >
              <div
                className="h-full transition-[width] duration-500"
                style={{
                  width: `${Math.round(tier.progress * 100)}%`,
                  backgroundColor: tier.accent,
                }}
              />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p
                data-export-label
                className="text-[8px] uppercase tracking-[0.24em] text-zinc-400"
              >
                {t.tier}
              </p>
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: tier.accent, boxShadow: tier.glow }}
                />
                <span
                  data-export-title
                  className="text-sm tracking-wide text-zinc-800"
                >
                  {tier.title}
                </span>
                <span
                  data-export-pill
                  className="rounded-full border px-2 py-0.5 font-mono text-[9px] tracking-[0.16em]"
                  style={{
                    borderColor: `${tier.accent}55`,
                    color: tier.accent,
                  }}
                >
                  {tier.percentLabel}
                </span>
              </div>
            </div>
            <p
              data-export-mono
              className="mt-2 font-mono text-[9px] tracking-[0.2em] text-zinc-400"
            >
              {tier.titleEn}
            </p>
          </section>

          <section
            data-card-block
            className="grid grid-cols-2 gap-5 border-y border-zinc-800/10 py-5"
          >
            <div>
              <p
                data-export-label
                className="text-[8px] uppercase tracking-[0.22em] text-zinc-400"
              >
                {t.interference}
              </p>
              <p
                data-export-metric
                className="mt-2 font-mono text-3xl tracking-tight text-[#0F1115]"
                style={{ fontFamily: "var(--font-geist-mono), ui-monospace, monospace" }}
              >
                {lossDisplay}
                <span className="ml-1 font-sans text-[10px] tracking-[0.16em] text-zinc-400">
                  ms
                </span>
              </p>
              <p data-export-mono className="mt-2 text-[10px] leading-4 text-zinc-500">
                {tier.interferenceLabel}
              </p>
            </div>
            <div>
              <p
                data-export-label
                className="text-[8px] uppercase tracking-[0.22em] text-zinc-400"
              >
                {t.accuracy}
              </p>
              <p
                data-export-metric
                className="mt-2 font-mono text-3xl tracking-tight text-[#0F1115]"
                style={{ fontFamily: "var(--font-geist-mono), ui-monospace, monospace" }}
              >
                {acc}
                <span className="ml-1 font-sans text-[10px] tracking-[0.16em] text-zinc-400">
                  %
                </span>
              </p>
              <p data-export-mono className="mt-2 text-[10px] leading-4 text-zinc-500">
                ACC
              </p>
            </div>
          </section>

          <section data-card-block>
            <p
              data-export-label
              className="text-[8px] uppercase tracking-[0.22em] text-zinc-400"
            >
              {t.breath}
            </p>
            <div className="mt-3 flex items-end justify-between">
              <p
                data-export-metric
                className="font-mono text-2xl tracking-tight"
                style={{
                  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                  color: tier.accent,
                }}
              >
                {tier.breathLabel}
              </p>
              <div className="flex gap-1.5">
                {Array.from({ length: 4 }).map((_, index) => (
                  <span
                    key={index}
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      backgroundColor:
                        index < tier.level ? tier.accent : "rgba(24,24,27,0.15)",
                    }}
                  />
                ))}
              </div>
            </div>
          </section>

          <section data-card-block>
            <p
              data-export-label
              className="text-[8px] uppercase tracking-[0.22em] text-zinc-400"
            >
              {t.status}
            </p>
            <div className="mt-3 space-y-2">
              <p
                data-export-mono
                className="font-mono text-[11px] tracking-[0.08em] text-zinc-700"
              >
                {tier.statusPrimary}
              </p>
              <p
                data-export-mono
                className="font-mono text-[11px] tracking-[0.08em] text-zinc-700"
              >
                {tier.statusSecondary}
              </p>
              <p
                data-export-mono
                className="font-mono text-[11px] tracking-[0.08em] text-zinc-700"
              >
                {protocolLabel}
              </p>
            </div>
            <p
              data-export-body
              className="mt-4 text-[12px] leading-5 text-zinc-500"
            >
              {tier.diagnosis}
            </p>
            <div className="mt-5 flex items-end justify-between border-t border-zinc-800/10 pt-4">
              <p
                data-export-label
                className="text-[8px] uppercase tracking-[0.22em] text-zinc-400"
              >
                {t.watermark}
              </p>
              <p
                data-export-mono
                className="font-mono text-[9px] tracking-[0.16em] text-zinc-500"
              >
                {sessionId}
              </p>
            </div>
          </section>
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          void handleSave();
        }}
        disabled={busy}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#f8fafc] px-5 text-sm font-medium tracking-wide text-slate-900 transition hover:bg-white disabled:opacity-60"
      >
        {busy ? t.saving : t.save}
      </button>
      {toast ? (
        <p className="text-center text-xs tracking-wide text-slate-500">{toast}</p>
      ) : null}
    </div>
  );
}
