"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toBlob, toPng } from "html-to-image";
import { QRCodeCanvas } from "qrcode.react";
import type { BenchmarkData } from "@/types/benchmark";
import {
  getTierConfig,
  interferenceDisplay,
  type ApexVariant,
  type TierLevel,
} from "@/lib/calculateTier";
import {
  compareAccuracy,
  compareInterference,
  compareReaction,
  type HistoryRun,
} from "@/lib/history";
import { PUBLIC_HOST, PUBLIC_URL } from "@/lib/config";
import Logo from "@/app/components/Logo";
import WallpaperModal from "@/app/components/WallpaperModal";
import { getBasePortalWallpaper, getTierWallpaper, WALLPAPER_I18N } from "@/lib/wallpapers";

export type ResultCardLang = "zh" | "en";
export type CardViewMode = "detailed" | "minimal";
export type { TierLevel, ApexVariant };

export type ResultCardProps = Pick<
  BenchmarkData,
  | "avgSrt"
  | "interference"
  | "acc"
  | "reportAt"
  | "completedBreathingBeforeTest"
  | "apexVariant"
> & {
  lang: ResultCardLang;
  onSaved?: () => void;
  /** Dev mock only — forces a fixed session id on the card. */
  sessionIdOverride?: string;
  /** Last valid run before this one (for subtle vs-last lines). */
  historyPrevious?: HistoryRun | null;
};

const COPY = {
  zh: {
    brand: "MIND OS",
    protocol: "NEURAL BENCHMARK",
    save: "儲存數據卡片（Save Image）",
    saving: "產生中…",
    saved: "已儲存",
    detailed: "詳細",
    minimal: "簡約",
    metricsHelp: "指標說明",
    metricsReaction:
      "反應時間：本次反應測試所有有效試次延遲的中位數（毫秒）。",
    metricsInterference:
      "干擾損耗：不一致試次平均延遲減去一致試次平均延遲（毫秒）。顯示時若差值 ≤ 0，以 0 表示。",
    metricsAccuracy:
      "準確率：色彩測試答對題數 ÷ 總題數，四捨五入至整數百分比。",
    reaction: "REACTION LATENCY",
    tier: "FOCUS TIER",
    interference: "INTERFERENCE LOSS",
    accuracy: "FOCUS ACCURACY",
    breath: "5-5 CALIBRATION",
    status: "FOCUS STATE",
    qrHint: "試下你嘅反應速度",
  },
  en: {
    brand: "MIND OS",
    protocol: "NEURAL BENCHMARK",
    save: "Save Image",
    saving: "Rendering…",
    saved: "Saved",
    detailed: "Detailed",
    minimal: "Minimal",
    metricsHelp: "Metric notes",
    metricsReaction:
      "Reaction time: median latency across all valid reaction trials (ms).",
    metricsInterference:
      "Interference loss: mean incongruent latency minus mean congruent latency (ms). Values ≤ 0 display as 0.",
    metricsAccuracy:
      "Accuracy: correct color-trial responses ÷ total color trials, rounded to a whole-number percent.",
    reaction: "REACTION LATENCY",
    tier: "FOCUS TIER",
    interference: "INTERFERENCE LOSS",
    accuracy: "FOCUS ACCURACY",
    breath: "5-5 CALIBRATION",
    status: "FOCUS STATE",
    qrHint: "Try your reaction speed",
  },
} as const;

function buildFocusMetricSummary(input: {
  lang: ResultCardLang;
  avgSrt: number;
  acc: number;
  previous: HistoryRun | null;
}): string {
  const { lang, avgSrt, acc, previous } = input;
  if (previous) {
    const delta = avgSrt - previous.reactionMs;
    if (lang === "zh") {
      if (delta === 0) {
        return `今次反應時間與上次相同（${avgSrt} ms），作答準確率 ${acc}%。`;
      }
      if (delta < 0) {
        return `今次反應時間比上次快 ${Math.abs(delta)} ms，作答準確率 ${acc}%。`;
      }
      return `今次反應時間比上次慢 ${delta} ms，作答準確率 ${acc}%。`;
    }
    if (delta === 0) {
      return `Reaction matched last run (${avgSrt} ms). Accuracy ${acc}%.`;
    }
    if (delta < 0) {
      return `Reaction was ${Math.abs(delta)} ms faster than last run. Accuracy ${acc}%.`;
    }
    return `Reaction was ${delta} ms slower than last run. Accuracy ${acc}%.`;
  }
  return lang === "zh"
    ? `今次反應時間 ${avgSrt} ms，作答準確率 ${acc}%。`
    : `This run: reaction ${avgSrt} ms, accuracy ${acc}%.`;
}

function CmpLine({
  arrow,
  label,
  className,
}: {
  arrow: "↑" | "↓" | "→";
  label: string;
  className: string;
}) {
  return (
    <p
      data-export-mono
      className={`mt-1 font-mono text-[9px] leading-4 tracking-[0.06em] ${className}`}
    >
      <span className="mr-1 opacity-80">{arrow}</span>
      {label}
    </p>
  );
}

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

/**
 * Monospace 5-scale diamond gauge.
 * Uses per-glyph solid colors (not bg-clip-text) so html-to-image stays reliable.
 */
function DiamondGauge({
  filled,
  color,
  spectrumColors,
  emptyColor,
  voidMode,
}: {
  filled: number;
  color: string;
  spectrumColors?: string[] | null;
  emptyColor?: string;
  voidMode?: boolean;
}) {
  return (
    <span aria-hidden className="inline-flex font-mono text-[11px] tracking-[0.14em]">
      {Array.from({ length: 5 }, (_, index) => {
        if (voidMode) {
          return (
            <span
              key={index}
              className={`${index > 0 ? "ml-[0.14em] " : ""}text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]`}
            >
              ◆
            </span>
          );
        }
        const lit = index < filled;
        const tone =
          lit && spectrumColors && spectrumColors[index]
            ? spectrumColors[index]
            : lit
              ? color
              : (emptyColor ?? "rgba(148,163,184,0.35)");
        return (
          <span key={index} style={{ color: tone }} className={index > 0 ? "ml-[0.14em]" : undefined}>
            {lit ? "◆" : "◇"}
          </span>
        );
      })}
    </span>
  );
}

function VoidHairline({ className = "my-4" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`h-[1px] w-full bg-gradient-to-r from-transparent via-zinc-200/50 to-transparent ${className}`}
    />
  );
}

function ArchitectSignature() {
  return (
    <div className="flex flex-col items-end">
      <img
        src="/signature-bwong.png"
        alt=""
        width={128}
        height={72}
        draggable={false}
        className="h-9 w-auto select-none object-contain object-right opacity-90"
      />
      <span className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.25em] text-zinc-500">
        SYSTEM ARCHITECT
      </span>
    </div>
  );
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

async function waitForFontsReady() {
  try {
    if (typeof document !== "undefined" && "fonts" in document) {
      await document.fonts.ready;
    }
  } catch {
    // best-effort
  }
}

/** Capture the on-screen card node as-is (WYSIWYG), using full content height. */
async function renderCardBlob(
  source: HTMLElement,
  backgroundColor: string,
): Promise<Blob> {
  await waitForFontsReady();

  // Force a layout pass, then measure the full unclipped content box.
  void source.offsetHeight;
  const shell = source.querySelector<HTMLElement>("[data-card-shell]");
  const width = Math.ceil(
    Math.max(
      source.getBoundingClientRect().width,
      source.scrollWidth,
      shell?.scrollWidth ?? 0,
    ),
  );
  const height = Math.ceil(
    Math.max(
      source.scrollHeight,
      source.offsetHeight,
      source.getBoundingClientRect().height,
      shell?.scrollHeight ?? 0,
      shell?.offsetHeight ?? 0,
    ),
  );

  const options = {
    pixelRatio: 3,
    cacheBust: true,
    backgroundColor,
    width,
    height,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      minHeight: `${height}px`,
      overflow: "visible",
      // Neutralize aspect constraints that can clip the export clone.
      aspectRatio: "auto",
      minAspectRatio: "auto",
    },
  };

  await toPng(source, options);
  await new Promise<void>((resolve) => window.setTimeout(resolve, 30));

  const blob = await toBlob(source, options);
  if (!blob) throw new Error("Failed to render image blob");
  return blob;
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
  backgroundColor: string,
) {
  const blob = await renderCardBlob(source, backgroundColor);
  await saveExportBlob(blob, filename);
}

export default function ResultCard({
  lang,
  avgSrt,
  interference,
  acc,
  reportAt,
  completedBreathingBeforeTest,
  apexVariant,
  onSaved,
  sessionIdOverride,
  historyPrevious = null,
}: ResultCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<CardViewMode>("detailed");
  const [isExporting, setIsExporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [qrReady, setQrReady] = useState(false);
  const [showWallpaperModal, setShowWallpaperModal] = useState(false);
  const [metricsOpen, setMetricsOpen] = useState(false);

  const t = COPY[lang];
  const tier = useMemo(
    () =>
      getTierConfig({
        latency: avgSrt,
        interference,
        accuracy: acc,
        lang,
        completedBreathingBeforeTest,
        apexVariant: apexVariant ?? undefined,
      }),
    [acc, apexVariant, avgSrt, completedBreathingBeforeTest, interference, lang],
  );
  const sessionId = useMemo(
    () => sessionIdOverride ?? buildSessionId(avgSrt, interference, acc, reportAt),
    [acc, avgSrt, interference, reportAt, sessionIdOverride],
  );
  const localStamp = formatLocalStamp(reportAt);
  const utcStamp = formatUtcStamp(reportAt);
  const lossDisplay = interferenceDisplay(interference);
  const isApex = tier.isApex;
  const isCritical = tier.level === 4;
  const isVoid = tier.variant === "void";
  const isDarkCard = isApex || isCritical;
  const currentTier = isVoid ? "00x" : String(tier.level).padStart(2, "0");
  const shareUrl = `${PUBLIC_URL}/?source=share_card&tier=${currentTier}`;
  const wallpaperCopy = WALLPAPER_I18N[lang];
  const tierWallpaper = useMemo(
    () => getTierWallpaper(tier.level, tier.variant, lang),
    [lang, tier.level, tier.variant],
  );
  const baseWallpaper = useMemo(() => getBasePortalWallpaper(lang), [lang]);

  const historyTierLabel = isVoid
    ? "TIER 00X"
    : `TIER ${String(tier.level).padStart(2, "0")}`;
  const reactionCmp = historyPrevious
    ? compareReaction(avgSrt, historyPrevious.reactionMs, lang)
    : null;
  const accuracyCmp = historyPrevious
    ? compareAccuracy(acc, historyPrevious.stroopAccuracy, lang)
    : null;
  const interferenceCmp =
    historyPrevious && historyPrevious.interferenceMs !== null
      ? compareInterference(interference, historyPrevious.interferenceMs, lang)
      : null;
  const cmpTone = isVoid
    ? "text-zinc-500"
    : isDarkCard
      ? "text-slate-500"
      : "text-zinc-400";

  useEffect(() => {
    setQrReady(false);
    let cancelled = false;
    let inner = 0;
    const outer = window.requestAnimationFrame(() => {
      inner = window.requestAnimationFrame(() => {
        if (!cancelled) setQrReady(true);
      });
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(outer);
      window.cancelAnimationFrame(inner);
    };
  }, [shareUrl, isDarkCard]);

  const handleSave = useCallback(async () => {
    if (!cardRef.current || isExporting || !qrReady) return;
    setIsExporting(true);
    setToast(null);
    try {
      // Let React commit: drop animate-pulse before capture (Tier 04 frame-timing).
      await new Promise<void>((resolve) => window.setTimeout(resolve, 50));
      if (!cardRef.current) return;
      const filename = `mind-os-${sessionId.toLowerCase()}.png`;
      await exportCardImage(cardRef.current, filename, tier.cardBackground);
      setToast(t.saved);
      onSaved?.();
    } catch {
      setToast(lang === "zh" ? "匯出失敗，請再試一次" : "Export failed. Try again.");
    } finally {
      setIsExporting(false);
      window.setTimeout(() => setToast(null), 2600);
    }
  }, [isExporting, lang, onSaved, qrReady, sessionId, t.saved, tier.cardBackground]);

  const isMinimal = viewMode === "minimal";
  const showTierPath =
    !isMinimal &&
    historyPrevious !== null &&
    historyPrevious.tier !== historyTierLabel;
  const brandedFocusLabel = isVoid
    ? tier.title
    : `${tier.title} · ${tier.percentLabel}`;
  const focusMetricSummary = buildFocusMetricSummary({
    lang,
    avgSrt,
    acc,
    previous: historyPrevious,
  });
  const labelMuted = isVoid
    ? "text-zinc-400"
    : isDarkCard
      ? "text-slate-400"
      : "text-zinc-400";
  const labelSoft = isVoid
    ? "text-zinc-400"
    : isDarkCard
      ? "text-slate-400"
      : "text-zinc-500";
  const metricPrimary = isVoid
    ? "text-white"
    : isDarkCard
      ? "text-zinc-100"
      : "text-[#0F1115]";
  const metricSub = isVoid
    ? "text-zinc-400"
    : isDarkCard
      ? "text-slate-400"
      : "text-zinc-500";
  const rule = isVoid
    ? "border-zinc-700/60"
    : isDarkCard
      ? "border-zinc-800"
      : "border-zinc-800/10";
  const titleTone = isVoid
    ? "text-white"
    : isDarkCard
      ? "text-zinc-100"
      : "text-zinc-800";
  const statusMono = isVoid
    ? "text-zinc-400"
    : isDarkCard
      ? "text-slate-300"
      : "text-zinc-700";
  const diagnosisTone = isVoid
    ? "text-zinc-400"
    : isDarkCard
      ? "text-slate-300"
      : "text-zinc-500";
  const sessionTone = isVoid
    ? "text-zinc-400"
    : isDarkCard
      ? "text-slate-400"
      : "text-zinc-600";

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4">
      <div
        className={`flex items-center gap-2 self-end ${
          isExporting ? "invisible pointer-events-none" : ""
        }`}
      >
        <button
          type="button"
          onClick={() => setViewMode("detailed")}
          disabled={isExporting}
          className={`rounded-full border px-3 py-1 font-mono text-[10px] tracking-[0.18em] transition ${
            viewMode === "detailed"
              ? "border-zinc-300 bg-zinc-100 text-zinc-900"
              : "border-white/15 text-slate-400"
          }`}
        >
          {t.detailed}
        </button>
        <button
          type="button"
          onClick={() => setViewMode("minimal")}
          disabled={isExporting}
          className={`rounded-full border px-3 py-1 font-mono text-[10px] tracking-[0.18em] transition ${
            viewMode === "minimal"
              ? "border-zinc-300 bg-zinc-100 text-zinc-900"
              : "border-white/15 text-slate-400"
          }`}
        >
          {t.minimal}
        </button>
      </div>

      <div className="relative w-full">
        <div
          ref={cardRef}
          className={`relative w-full overflow-visible [min-aspect-ratio:9/16] ${
            isCritical
              ? `${isExporting ? "" : "animate-pulse"} border border-red-900/80 bg-zinc-950 text-zinc-100 shadow-[0_0_25px_rgba(220,38,38,0.25)]`
              : isVoid
                ? "border border-zinc-700/60 bg-[#09090b] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-800/20 via-[#09090b] to-black text-white shadow-[0_0_25px_rgba(255,255,255,0.06)]"
                : isApex
                  ? "text-slate-50"
                  : "bg-[#F8F9FA] text-[#0F1115]"
          }`}
          style={{
            fontFamily: "var(--font-geist-sans), Helvetica, Arial, sans-serif",
            border: isCritical || isVoid ? undefined : `1px solid ${tier.cardBorder}`,
            boxShadow: isCritical || isVoid ? undefined : tier.cardShadow,
            backgroundColor: isVoid ? undefined : tier.cardBackground,
            // Force full opacity while exporting so pulse mid-frame never leaks into PNG.
            opacity: isCritical && isExporting ? 1 : undefined,
          }}
        >
          {isApex && !isVoid && tier.radialGlow ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ backgroundImage: tier.radialGlow }}
            />
          ) : null}

          <div
            data-card-shell
            className={`relative z-[1] flex min-h-full w-full flex-col ${
              isMinimal
                ? "gap-6 px-8 py-10 sm:gap-8 sm:px-9 sm:py-12"
                : "gap-0 px-7 py-8 sm:px-8 sm:py-9"
            }`}
          >
            <header
              data-card-block
              className={`flex shrink-0 items-start justify-between gap-4 ${
                isVoid ? "" : `border-b ${rule}`
              } ${isMinimal ? "pb-5" : "pb-4"}`}
            >
              <div>
                <div className={`flex items-center gap-2 ${labelSoft}`}>
                  <Logo size={16} className="shrink-0" />
                  <p
                    data-export-label
                    className="font-mono text-[10px] tracking-[0.32em]"
                  >
                    {t.brand}
                  </p>
                </div>
                {!isMinimal ? (
                  <p
                    data-export-mono
                    className={`mt-1 font-mono text-[9px] tracking-[0.28em] ${labelMuted}`}
                  >
                    {t.protocol}
                  </p>
                ) : null}
              </div>
              <div className="text-right">
                {!isMinimal ? (
                  <>
                    <p
                      data-export-mono
                      className={`font-mono text-[9px] tracking-[0.16em] ${labelSoft}`}
                    >
                      {localStamp}
                    </p>
                    <p
                      data-export-mono
                      className={`mt-1 font-mono text-[8px] tracking-[0.14em] ${labelMuted}`}
                    >
                      {utcStamp}
                    </p>
                  </>
                ) : null}
                <p
                  data-export-mono
                  className={`font-mono text-[9px] tracking-[0.18em] ${sessionTone} ${
                    isMinimal ? "" : "mt-2"
                  }`}
                >
                  {sessionId}
                </p>
              </div>
            </header>
            {isVoid ? <VoidHairline className="my-2" /> : null}

            <section
              data-card-block
              className={`shrink-0 ${isMinimal ? "py-2" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <p
                  data-export-label
                  className={`text-[8px] font-medium uppercase tracking-[0.28em] ${labelMuted}`}
                >
                  {t.reaction}
                </p>
                <DiamondGauge
                  filled={tier.diamondFilled}
                  color={tier.accent}
                  spectrumColors={isVoid ? null : tier.diamondColors}
                  voidMode={isVoid}
                />
              </div>
              <p
                data-export-latency
                className={`font-mono font-medium tracking-tight ${
                  isVoid
                    ? "text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]"
                    : metricPrimary
                } ${isMinimal ? "mt-4 text-7xl sm:text-8xl" : "mt-2 text-6xl sm:text-7xl"}`}
                style={{
                  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                  filter: isVoid ? undefined : tier.latencyFilter ?? undefined,
                }}
              >
                {avgSrt}
                <span
                  data-export-latency-unit
                  className={`ml-2 align-baseline font-sans font-normal tracking-[0.18em] ${
                    isVoid
                      ? "text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]"
                      : labelMuted
                  } ${isMinimal ? "text-base" : "text-sm"}`}
                >
                  ms
                </span>
              </p>
              {reactionCmp ? (
                <CmpLine
                  arrow={reactionCmp.arrow}
                  label={reactionCmp.label}
                  className={cmpTone}
                />
              ) : null}
              {isVoid ? (
                <VoidHairline />
              ) : (
                <div
                  data-export-bar
                  className={`h-[2px] w-full overflow-hidden ${
                    isMinimal ? "mt-6" : "mt-5"
                  }`}
                  style={{ backgroundColor: tier.accentSoft }}
                >
                  <div
                    className="h-full transition-[width] duration-500"
                    style={{
                      width: `${Math.round(tier.progress * 100)}%`,
                      background: tier.spectrumGradient ?? tier.accent,
                      backgroundColor: tier.accent,
                    }}
                  />
                </div>
              )}
              {isVoid ? (
                <div
                  className={`flex flex-col gap-2 ${isMinimal ? "mt-5" : "mt-4"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p
                      data-export-label
                      className={`shrink-0 text-[8px] uppercase tracking-[0.24em] ${labelMuted}`}
                    >
                      {t.tier}
                    </p>
                    <span
                      data-export-pill
                      className="shrink-0 rounded-sm border border-zinc-500/50 bg-zinc-800/40 px-2 py-0.5 font-mono text-[8px] tracking-[0.08em] text-zinc-200"
                    >
                      {tier.percentLabel}
                    </span>
                  </div>
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]"
                    />
                    <span
                      data-export-title
                      className={`min-w-0 text-sm tracking-wide ${titleTone}`}
                    >
                      {tier.title}
                    </span>
                  </div>
                </div>
              ) : (
              <div
                className={`flex items-center justify-between gap-3 ${
                  isMinimal ? "mt-5" : "mt-4"
                }`}
              >
                <p
                  data-export-label
                  className={`text-[8px] uppercase tracking-[0.24em] ${labelMuted}`}
                >
                  {t.tier}
                </p>
                <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                  <span
                    className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{
                      background: tier.spectrumGradient ?? tier.accent,
                      backgroundColor: tier.accent,
                      boxShadow: tier.glow,
                    }}
                  />
                  <span
                    data-export-title
                    className={`tracking-wide text-sm ${titleTone}`}
                  >
                    {tier.title}
                  </span>
                  <span
                    data-export-pill
                    className={`px-2 py-0.5 font-mono text-[9px] tracking-[0.12em] ${
                      isApex
                        ? "rounded-sm border-2"
                        : "rounded-full border"
                    }`}
                    style={{
                      borderColor: isApex ? tier.accent : `${tier.accent}55`,
                      color: tier.accent,
                      boxShadow: isApex
                        ? `inset 0 0 0 1px ${tier.accentSoft}`
                        : undefined,
                    }}
                  >
                    {tier.percentLabel}
                  </span>
                </div>
              </div>
              )}
              {isVoid ? null : (
                <p
                  data-export-mono
                  className={`mt-2 font-mono text-[9px] tracking-[0.2em] ${labelMuted}`}
                >
                  {tier.titleEn}
                </p>
              )}
              {showTierPath && historyPrevious ? (
                <p
                  data-export-mono
                  className={`mt-1.5 font-mono text-[9px] tracking-[0.14em] ${cmpTone}`}
                >
                  {historyPrevious.tier}
                  <span className="mx-1.5 opacity-60">→</span>
                  {historyTierLabel}
                </p>
              ) : null}
            </section>

            <section
              data-card-block
              className={`grid shrink-0 grid-cols-2 ${
                isVoid ? "" : `border-y ${rule}`
              } ${isMinimal ? "gap-5 py-7" : isVoid ? "gap-4 py-3" : "gap-5 py-5"}`}
            >
              <div>
                <p
                  data-export-label
                  className={`text-[8px] uppercase tracking-[0.22em] ${labelMuted}`}
                >
                  {t.interference}
                </p>
                <p
                  data-export-metric
                  className={`mt-2 font-mono text-3xl tracking-tight ${metricPrimary}`}
                  style={{ fontFamily: "var(--font-geist-mono), ui-monospace, monospace" }}
                >
                  {lossDisplay}
                  <span className={`ml-1 font-sans text-[10px] tracking-[0.16em] ${labelMuted}`}>
                    ms
                  </span>
                </p>
                {!isMinimal && interferenceCmp ? (
                  <CmpLine
                    arrow={interferenceCmp.arrow}
                    label={interferenceCmp.label}
                    className={cmpTone}
                  />
                ) : null}
                {!isMinimal ? (
                  <p className={`mt-2 text-[10px] leading-4 ${metricSub}`}>
                    {tier.interferenceLabel}
                  </p>
                ) : null}
              </div>
              <div>
                <p
                  data-export-label
                  className={`text-[8px] uppercase tracking-[0.22em] ${labelMuted}`}
                >
                  {t.accuracy}
                </p>
                <p
                  data-export-metric
                  className={`mt-2 font-mono tracking-tight ${metricPrimary} text-3xl`}
                  style={{ fontFamily: "var(--font-geist-mono), ui-monospace, monospace" }}
                >
                  {acc}
                  <span className={`ml-1 font-sans text-[10px] tracking-[0.16em] ${labelMuted}`}>
                    %
                  </span>
                </p>
                {accuracyCmp ? (
                  <CmpLine
                    arrow={accuracyCmp.arrow}
                    label={
                      isMinimal
                        ? accuracyCmp.label.replace(" vs last", "")
                        : accuracyCmp.label
                    }
                    className={cmpTone}
                  />
                ) : null}
                {!isMinimal ? (
                  <p className={`mt-2 text-[10px] leading-4 ${metricSub}`}>ACC</p>
                ) : null}
              </div>
            </section>

            <section
              data-card-block
              className={`shrink-0 ${isMinimal ? "py-1" : ""}`}
            >
              {!isMinimal ? (
                <p
                  data-export-label
                  className={`text-[8px] uppercase tracking-[0.22em] ${labelMuted}`}
                >
                  {t.breath}
                </p>
              ) : null}
              <div
                className={`flex items-end justify-between gap-3 ${
                  isMinimal ? "" : "mt-3"
                }`}
              >
                <p
                  data-export-metric
                  className={`font-mono ${
                    isVoid
                      ? `tracking-widest text-zinc-200 drop-shadow-[0_0_8px_rgba(255,255,255,0.25)] ${isMinimal ? "text-xl" : "text-2xl"}`
                      : `tracking-tight ${isMinimal ? "text-xl" : "text-2xl"}`
                  }`}
                  style={
                    isVoid
                      ? {
                          fontFamily:
                            "var(--font-geist-mono), ui-monospace, monospace",
                        }
                      : {
                          fontFamily:
                            "var(--font-geist-mono), ui-monospace, monospace",
                          color: tier.accent,
                          textShadow: isApex
                            ? `0 0 14px ${tier.accentSoft}`
                            : undefined,
                        }
                  }
                >
                  {tier.breathLabel}
                </p>
                {!isMinimal ? (
                  <DiamondGauge
                    filled={tier.diamondFilled}
                    color={tier.accent}
                    spectrumColors={isVoid ? null : tier.diamondColors}
                    voidMode={isVoid}
                  />
                ) : null}
              </div>
            </section>

            {!isMinimal ? (
              <section
                data-card-block
                className={`mt-4 shrink-0 ${
                  isApex || isCritical
                    ? `rounded-lg border px-3 py-3 ${
                        isCritical
                          ? "border-red-900/50 bg-zinc-900/80"
                          : isVoid
                            ? "border-zinc-700/50 bg-black/40"
                            : "border-zinc-800 bg-zinc-900/60"
                      }`
                    : ""
                }`}
              >
                <p
                  data-export-label
                  className={`text-[8px] uppercase tracking-[0.22em] ${labelMuted}`}
                >
                  {t.status}
                </p>
                <p
                  data-export-title
                  className={`mt-3 text-base font-medium tracking-wide ${titleTone}`}
                >
                  {tier.focusPlain}
                </p>
                <p
                  data-export-mono
                  className={`mt-1.5 font-mono text-[11px] tracking-[0.12em] ${statusMono}`}
                >
                  {brandedFocusLabel}
                </p>
                <p
                  data-export-body
                  className={`mt-4 whitespace-pre-line text-[12px] leading-5 ${diagnosisTone}`}
                >
                  {focusMetricSummary}
                </p>
                {tier.diagnosisSupport ? (
                  <p
                    data-export-body
                    className={`mt-2 text-[11px] leading-5 ${diagnosisTone} opacity-80`}
                  >
                    {tier.diagnosisSupport}
                  </p>
                ) : null}
                {tier.sessionNote ? (
                  <p
                    data-export-body
                    className={`mt-2 font-mono text-[9px] tracking-[0.12em] ${labelMuted}`}
                  >
                    {tier.sessionNote}
                  </p>
                ) : null}
              </section>
            ) : null}

            {/* Guaranteed gap between content and footer (40px). */}
            <div aria-hidden className="h-10 w-full shrink-0" />

            {isVoid ? <VoidHairline className="mb-0" /> : null}

            {isVoid ? (
              <footer
                data-card-block
                className="mt-auto flex w-full shrink-0 items-end justify-between pl-2 pr-4 pt-3"
              >
                <span className="font-mono text-[9px] text-zinc-500">
                  {PUBLIC_HOST}
                </span>
                <ArchitectSignature />
              </footer>
            ) : (
              <footer
                data-card-block
                className={`mt-auto flex shrink-0 items-end justify-between gap-3 border-t pt-4 ${rule}`}
              >
                <p
                  data-export-label
                  className={`min-w-0 text-[8px] tracking-[0.22em] ${labelMuted}`}
                >
                  {PUBLIC_HOST}
                </p>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <p
                    className={`whitespace-nowrap text-right text-[7px] leading-tight tracking-wide ${labelMuted}`}
                  >
                    {t.qrHint}
                  </p>
                  <div className="h-12 w-12 shrink-0 overflow-hidden" data-export-qr>
                    <QRCodeCanvas
                      value={shareUrl}
                      size={48}
                      level="M"
                      marginSize={1}
                      bgColor="transparent"
                      fgColor={isDarkCard ? "#ffffff" : "#0F1115"}
                      className="block"
                    />
                  </div>
                </div>
              </footer>
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          void handleSave();
        }}
        disabled={isExporting || !qrReady}
        data-export-hide
        className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#f8fafc] px-5 text-sm font-medium tracking-wide text-slate-900 transition hover:bg-white disabled:opacity-60"
      >
        {isExporting ? t.saving : t.save}
      </button>
      <button
        type="button"
        data-export-hide
        onClick={() => setShowWallpaperModal(true)}
        className="flex items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-2.5 font-mono text-xs tracking-wider text-zinc-300 transition-all hover:bg-zinc-800"
      >
        {wallpaperCopy.btn}
      </button>
      <div data-export-hide className="w-full">
        <button
          type="button"
          onClick={() => setMetricsOpen((value) => !value)}
          className="w-full text-center font-mono text-[10px] tracking-[0.18em] text-slate-500 transition hover:text-slate-300"
          aria-expanded={metricsOpen}
        >
          {metricsOpen ? `▾ ${t.metricsHelp}` : `▸ ${t.metricsHelp}`}
        </button>
        {metricsOpen ? (
          <div className="mt-2 space-y-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3 text-left text-[11px] leading-5 tracking-wide text-slate-400">
            <p>{t.metricsReaction}</p>
            <p>{t.metricsInterference}</p>
            <p>{t.metricsAccuracy}</p>
          </div>
        ) : null}
      </div>
      {toast ? (
        <p className="text-center text-xs tracking-wide text-slate-500">{toast}</p>
      ) : null}
      {showWallpaperModal ? (
        <WallpaperModal
          lang={lang}
          tierWallpaper={tierWallpaper}
          baseWallpaper={baseWallpaper}
          onClose={() => setShowWallpaperModal(false)}
        />
      ) : null}
    </div>
  );
}
