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
  COLOR_TASK_TWO_CHOICE,
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
  sessionIdOverride?: string;
  historyPrevious?: HistoryRun | null;
  /** Fired once when the user starts a result-card download or iOS share. */
  onCardSave?: (method: "download" | "share") => void;
};

/** Fixed Save Image / Share canvas — compact content height (~1080×1600). */
const SHARE_EXPORT_WIDTH = 1080;
const SHARE_EXPORT_HEIGHT = 1600;
const SHARE_ASPECT = `${SHARE_EXPORT_WIDTH} / ${SHARE_EXPORT_HEIGHT}`;
/** Minimum space below QR / footer bottom edge inside the card. */
const SHARE_FOOTER_SAFE_PAD = 12;

const COPY = {
  zh: {
    brand: "MIND OS",
    protocol: "NEURAL BENCHMARK",
    save: "儲存數據卡片（Save Image）",
    saving: "產生中…",
    saved: "已儲存",
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
    status: "STATUS LABELS",
    qrHint: "試下你嘅反應速度",
    protocolCalibrated: "已完成呼吸校準後測得",
    protocolBaseline: "未經呼吸校準（基準測試）",
  },
  en: {
    brand: "MIND OS",
    protocol: "NEURAL BENCHMARK",
    save: "Save Image",
    saving: "Rendering…",
    saved: "Saved",
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
    status: "STATUS LABELS",
    qrHint: "Try your reaction speed",
    protocolCalibrated: "Protocol: Post-Calibration (5-5)",
    protocolBaseline: "Protocol: Baseline Direct",
  },
} as const;

function buildShareSummary(input: {
  lang: ResultCardLang;
  avgSrt: number;
  acc: number;
  previous: HistoryRun | null;
  diagnosis: string;
}): string {
  const { lang, avgSrt, acc, previous, diagnosis } = input;
  if (previous) {
    const delta = avgSrt - previous.reactionMs;
    if (lang === "zh") {
      if (delta === 0) return `今次反應與上次相同，準確率維持 ${acc}%。`;
      if (delta < 0) return `今次反應比上次快 ${Math.abs(delta)} ms，準確率維持 ${acc}%。`;
      return `今次反應時間偏慢（慢 ${delta} ms），準確率維持 ${acc}%。`;
    }
    if (delta === 0) return `Reaction matched last run. Accuracy ${acc}%.`;
    if (delta < 0) return `${Math.abs(delta)} ms faster than last. Accuracy ${acc}%.`;
    return `Reaction slower by ${delta} ms. Accuracy ${acc}%.`;
  }
  // Fallback: short diagnosis already written for this run.
  return diagnosis || (lang === "zh"
    ? `今次反應 ${avgSrt} ms，準確率 ${acc}%。`
    : `Reaction ${avgSrt} ms · Accuracy ${acc}%.`);
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
      className={`mt-0.5 font-mono text-[8px] leading-3 tracking-[0.04em] ${className}`}
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
    <span aria-hidden className="inline-flex font-mono text-[10px] tracking-[0.12em]">
      {Array.from({ length: 5 }, (_, index) => {
        if (voidMode) {
          return (
            <span
              key={index}
              className={`${index > 0 ? "ml-[0.12em] " : ""}text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]`}
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
          <span key={index} style={{ color: tone }} className={index > 0 ? "ml-[0.12em]" : undefined}>
            {lit ? "◆" : "◇"}
          </span>
        );
      })}
    </span>
  );
}

function VoidHairline({ className = "my-2" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`h-px w-full bg-gradient-to-r from-transparent via-zinc-200/50 to-transparent ${className}`}
    />
  );
}

function ArchitectSignature() {
  return (
    <div className="flex flex-col items-end">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/signature-bwong.png"
        alt=""
        width={96}
        height={54}
        draggable={false}
        className="h-7 w-auto select-none object-contain object-right opacity-90"
      />
      <span className="mt-0.5 font-mono text-[7px] uppercase tracking-[0.22em] text-zinc-500">
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

/**
 * Ensure footer / QR sit fully inside the laid-out card (preview size).
 * Export upscales this layout — it must already fit on screen.
 */
function assertShareFooterFits(source: HTMLElement) {
  const cardRect = source.getBoundingClientRect();
  const qr = source.querySelector<HTMLElement>("[data-export-qr]");
  const footer = source.querySelector("footer");
  const target = qr ?? footer;
  if (!target) return;

  const bottom = target.getBoundingClientRect().bottom;
  const limit = cardRect.bottom - SHARE_FOOTER_SAFE_PAD;
  if (bottom > limit + 0.5) {
    throw new Error(
      `Share card footer overflows bounds (bottom ${bottom.toFixed(1)} > limit ${limit.toFixed(1)})`,
    );
  }
}

/**
 * On-screen card box, including content that stretches the box past the
 * 1080:1600 aspect ratio. A narrow phone width keeps absolute type sizes, so the
 * card grows taller than width × 1600/1080. offsetHeight already includes
 * that growth in Chrome; shell bottom covers browsers that keep the ratio box.
 */
function measureShareLayout(source: HTMLElement) {
  const layoutWidth = source.offsetWidth;
  const cardTop = source.getBoundingClientRect().top;
  const shell = source.querySelector<HTMLElement>("[data-card-shell]");
  const shellExtent = shell ? shell.getBoundingClientRect().bottom - cardTop : 0;
  const layoutHeight = Math.max(
    source.offsetHeight,
    source.scrollHeight,
    Math.ceil(shellExtent),
  );
  return { layoutWidth, layoutHeight };
}

/** Canvas height for a width-fit scale. Desktop stays 1600; narrower layouts grow. */
function shareExportHeight(layoutWidth: number, layoutHeight: number) {
  const scaled = layoutHeight * (SHARE_EXPORT_WIDTH / layoutWidth);
  if (Math.abs(scaled - SHARE_EXPORT_HEIGHT) <= 2) return SHARE_EXPORT_HEIGHT;
  return Math.ceil(scaled);
}

/**
 * Capture the on-screen card WYSIWYG, then upscale to 1080px wide.
 *
 * The preview is laid out inside max-w-[380px] with absolute rem/px type.
 * Expanding CSS width to 1080px does NOT scale fonts — it leaves content
 * tiny in the top-left. Instead, keep natural layout size and scale the
 * clone so it fills the export canvas. Height follows the measured card,
 * so a taller mobile layout is not cropped to 1600.
 */
async function renderCardBlob(
  source: HTMLElement,
  backgroundColor: string,
): Promise<Blob> {
  await waitForFontsReady();
  void source.offsetHeight;
  assertShareFooterFits(source);

  const { layoutWidth, layoutHeight } = measureShareLayout(source);
  if (layoutWidth < 1 || layoutHeight < 1) {
    throw new Error("Share card has no layout size to export");
  }

  const scale = SHARE_EXPORT_WIDTH / layoutWidth;
  const exportHeight = shareExportHeight(layoutWidth, layoutHeight);

  const options = {
    // Scale via CSS transform only — do not also bump pixelRatio.
    pixelRatio: 1,
    cacheBust: true,
    backgroundColor,
    width: SHARE_EXPORT_WIDTH,
    height: exportHeight,
    canvasWidth: SHARE_EXPORT_WIDTH,
    canvasHeight: exportHeight,
    style: {
      // Keep the preview layout box; scale it up into the export canvas.
      width: `${layoutWidth}px`,
      height: `${layoutHeight}px`,
      maxWidth: `${layoutWidth}px`,
      minWidth: `${layoutWidth}px`,
      minHeight: `${layoutHeight}px`,
      maxHeight: `${layoutHeight}px`,
      margin: "0",
      overflow: "visible",
      transform: `scale(${scale})`,
      transformOrigin: "top left",
    } as Partial<CSSStyleDeclaration>,
    filter: (node: HTMLElement) => {
      if (typeof node.hasAttribute === "function" && node.hasAttribute("data-export-hide")) {
        return false;
      }
      return true;
    },
  };

  await toPng(source, options);
  await new Promise<void>((resolve) => window.setTimeout(resolve, 40));

  const blob = await toBlob(source, options);
  if (!blob) throw new Error("Failed to render image blob");
  return blob;
}

async function saveExportBlob(
  blob: Blob,
  filename: string,
  onStart?: (method: "download" | "share") => void,
) {
  const file = new File([blob], filename, { type: "image/png" });

  if (isIos()) {
    if (typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
      onStart?.("share");
      await navigator.share({
        files: [file],
        title: "Mind OS Neural Benchmark",
      });
      return;
    }
    onStart?.("download");
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

  onStart?.("download");
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
  onStart?: (method: "download" | "share") => void,
) {
  const blob = await renderCardBlob(source, backgroundColor);
  await saveExportBlob(blob, filename, onStart);
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
  onCardSave,
}: ResultCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [qrReady, setQrReady] = useState(false);
  const saveLockRef = useRef(false);
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
  const colorComparable = historyPrevious?.colorTask === COLOR_TASK_TWO_CHOICE;
  const accuracyCmp = colorComparable
    ? compareAccuracy(acc, historyPrevious.stroopAccuracy, lang)
    : null;
  const interferenceCmp =
    colorComparable && historyPrevious.interferenceMs !== null
      ? compareInterference(interference, historyPrevious.interferenceMs, lang)
      : null;
  const showTierPath = colorComparable && historyPrevious.tier !== historyTierLabel;

  const protocolLabel = completedBreathingBeforeTest
    ? t.protocolCalibrated
    : t.protocolBaseline;
  const shareSummary = buildShareSummary({
    lang,
    avgSrt,
    acc,
    previous: colorComparable ? historyPrevious : null,
    diagnosis: tier.diagnosis,
  });

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
    if (!cardRef.current || saveLockRef.current || isExporting || !qrReady) return;
    saveLockRef.current = true;
    setIsExporting(true);
    setToast(null);
    try {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 50));
      if (!cardRef.current) return;
      const filename = `mind-os-${sessionId.toLowerCase()}.png`;
      await exportCardImage(cardRef.current, filename, tier.cardBackground, onCardSave);
      setToast(t.saved);
      onSaved?.();
    } catch {
      setToast(lang === "zh" ? "匯出失敗，請再試一次" : "Export failed. Try again.");
    } finally {
      saveLockRef.current = false;
      setIsExporting(false);
      window.setTimeout(() => setToast(null), 2600);
    }
  }, [isExporting, lang, onCardSave, onSaved, qrReady, sessionId, t.saved, tier.cardBackground]);

  const cmpTone = isVoid
    ? "text-zinc-500"
    : isDarkCard
      ? "text-slate-500"
      : "text-zinc-400";
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
    ? "text-zinc-500"
    : isDarkCard
      ? "text-slate-500"
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
    <div className="mx-auto flex w-full max-w-[380px] flex-col items-center gap-4">
      {/* Fixed 1080×1600 share card — content flow, no footer stretch */}
      <div className="relative w-full">
        <div
          ref={cardRef}
          data-share-card
          className={`relative flex w-full flex-col ${
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
            opacity: isCritical && isExporting ? 1 : undefined,
            aspectRatio: SHARE_ASPECT,
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
            className="relative z-[1] flex w-full flex-col px-5 pb-4 pt-5"
          >
            {/* 1. HEADER */}
            <header
              data-card-block
              className={`flex shrink-0 items-start justify-between gap-2 ${
                isVoid ? "" : `border-b pb-2 ${rule}`
              }`}
            >
              <div className="min-w-0">
                <div className={`flex items-center gap-1.5 ${labelSoft}`}>
                  <Logo size={14} className="shrink-0" />
                  <p
                    data-export-label
                    className="font-mono text-[9px] tracking-[0.28em]"
                  >
                    {t.brand}
                  </p>
                </div>
                <p
                  data-export-mono
                  className={`mt-0.5 font-mono text-[8px] tracking-[0.22em] ${labelMuted}`}
                >
                  {t.protocol}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p
                  data-export-mono
                  className={`font-mono text-[8px] tracking-[0.12em] ${labelSoft}`}
                >
                  {localStamp}
                </p>
                <p
                  data-export-mono
                  className={`mt-0.5 font-mono text-[8px] tracking-[0.14em] ${sessionTone}`}
                >
                  {sessionId}
                </p>
              </div>
            </header>
            {isVoid ? <VoidHairline className="my-1.5" /> : null}

            {/* 2. REACTION LATENCY */}
            <section data-card-block className="mt-2.5 shrink-0">
              <div className="flex items-center justify-between gap-2">
                <p
                  data-export-label
                  className={`text-[7px] font-medium uppercase tracking-[0.22em] ${labelMuted}`}
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
                className={`mt-1 font-mono font-medium leading-none tracking-tight ${
                  isVoid
                    ? "text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]"
                    : metricPrimary
                } text-[3.25rem]`}
                style={{
                  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                  filter: isVoid ? undefined : tier.latencyFilter ?? undefined,
                }}
              >
                {avgSrt}
                <span
                  data-export-latency-unit
                  className={`ml-1.5 align-baseline font-sans text-xs font-normal tracking-[0.14em] ${
                    isVoid
                      ? "text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]"
                      : labelMuted
                  }`}
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
                <VoidHairline className="mt-2 mb-0" />
              ) : (
                <div
                  data-export-bar
                  className="mt-2 h-[2px] w-full"
                  style={{ backgroundColor: tier.accentSoft }}
                >
                  <div
                    className="h-full"
                    style={{
                      width: `${Math.round(tier.progress * 100)}%`,
                      background: tier.spectrumGradient ?? tier.accent,
                      backgroundColor: tier.accent,
                    }}
                  />
                </div>
              )}
            </section>

            {/* 3. FOCUS TIER */}
            <section data-card-block className="mt-2 shrink-0">
              <p
                data-export-label
                className={`text-[7px] uppercase tracking-[0.2em] ${labelMuted}`}
              >
                {t.tier}
              </p>
              <div className="mt-1 flex min-w-0 items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{
                      background: isVoid
                        ? "#fff"
                        : (tier.spectrumGradient ?? tier.accent),
                      backgroundColor: isVoid ? "#fff" : tier.accent,
                      boxShadow: isVoid
                        ? "0 0 8px rgba(255,255,255,0.7)"
                        : tier.glow,
                    }}
                  />
                  <span
                    data-export-title
                    className={`min-w-0 truncate text-[13px] font-medium tracking-wide ${titleTone}`}
                  >
                    {isVoid ? "MONOCHROME VOID" : tier.title}
                  </span>
                </div>
                <span
                  data-export-pill
                  className={`shrink-0 px-1.5 py-0.5 font-mono text-[7px] tracking-[0.08em] ${
                    isApex || isVoid ? "rounded-sm border" : "rounded-full border"
                  }`}
                  style={{
                    borderColor: isVoid
                      ? "rgba(161,161,170,0.5)"
                      : isApex
                        ? tier.accent
                        : `${tier.accent}55`,
                    color: isVoid ? "#e4e4e7" : tier.accent,
                  }}
                >
                  {tier.percentLabel}
                </span>
              </div>
              <p className={`mt-0.5 text-[11px] leading-snug ${diagnosisTone}`}>
                {tier.focusPlain}
              </p>
              {!isVoid ? (
                <p
                  data-export-mono
                  className={`mt-0.5 font-mono text-[7px] tracking-[0.16em] ${labelMuted}`}
                >
                  {tier.titleEn}
                </p>
              ) : null}
              {showTierPath && historyPrevious ? (
                <p
                  data-export-mono
                  className={`mt-0.5 font-mono text-[7px] tracking-[0.1em] ${cmpTone}`}
                >
                  {historyPrevious.tier}
                  <span className="mx-1 opacity-60">→</span>
                  {historyTierLabel}
                </p>
              ) : null}
            </section>

            {/* 4. SECONDARY METRICS */}
            <section
              data-card-block
              className={`mt-2 grid shrink-0 grid-cols-2 gap-3 border-y py-2 ${rule}`}
            >
              <div className="min-w-0">
                <p
                  data-export-label
                  className={`text-[7px] uppercase tracking-[0.18em] ${labelMuted}`}
                >
                  {t.interference}
                </p>
                <p
                  data-export-metric
                  className={`mt-0.5 font-mono text-[1.35rem] leading-none tracking-tight ${metricPrimary}`}
                  style={{
                    fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                  }}
                >
                  {lossDisplay}
                  <span
                    className={`ml-1 font-sans text-[8px] tracking-[0.12em] ${labelMuted}`}
                  >
                    ms
                  </span>
                </p>
                {interferenceCmp ? (
                  <CmpLine
                    arrow={interferenceCmp.arrow}
                    label={interferenceCmp.label}
                    className={cmpTone}
                  />
                ) : (
                  <p className={`mt-0.5 truncate text-[8px] leading-3 ${metricSub}`}>
                    {tier.interferenceLabel}
                  </p>
                )}
              </div>
              <div className="min-w-0">
                <p
                  data-export-label
                  className={`text-[7px] uppercase tracking-[0.18em] ${labelMuted}`}
                >
                  {t.accuracy}
                </p>
                <p
                  data-export-metric
                  className={`mt-0.5 font-mono text-[1.35rem] leading-none tracking-tight ${metricPrimary}`}
                  style={{
                    fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                  }}
                >
                  {acc}
                  <span
                    className={`ml-1 font-sans text-[8px] tracking-[0.12em] ${labelMuted}`}
                  >
                    %
                  </span>
                </p>
                {accuracyCmp ? (
                  <CmpLine
                    arrow={accuracyCmp.arrow}
                    label={accuracyCmp.label}
                    className={cmpTone}
                  />
                ) : (
                  <p className={`mt-0.5 text-[8px] leading-3 ${metricSub}`}>ACC</p>
                )}
              </div>
            </section>

            {/* 5. CALIBRATION + DRIFT — compressed */}
            <section data-card-block className="mt-2 shrink-0">
              <p
                data-export-label
                className={`text-[7px] uppercase tracking-[0.18em] ${labelMuted}`}
              >
                {t.breath}
              </p>
              <div className="mt-1 flex items-end justify-between gap-2">
                <p
                  data-export-metric
                  className="font-mono text-[1.15rem] leading-none tracking-tight"
                  style={{
                    fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                    color: isVoid ? "#e4e4e7" : tier.accent,
                    textShadow:
                      isApex && !isVoid
                        ? `0 0 12px ${tier.accentSoft}`
                        : undefined,
                  }}
                >
                  {tier.breathLabel}
                </p>
                <DiamondGauge
                  filled={tier.diamondFilled}
                  color={tier.accent}
                  spectrumColors={isVoid ? null : tier.diamondColors}
                  voidMode={isVoid}
                />
              </div>
            </section>

            {/* 6. STATUS LABELS — significantly compressed */}
            <section data-card-block className="mt-2 shrink-0">
              <p
                data-export-label
                className={`text-[7px] uppercase tracking-[0.18em] ${labelMuted}`}
              >
                {t.status}
              </p>
              <div className="mt-1 space-y-0">
                <p
                  data-export-mono
                  className={`font-mono text-[10px] leading-4 tracking-[0.04em] ${statusMono}`}
                >
                  {tier.statusPrimary}
                </p>
                <p
                  data-export-mono
                  className={`font-mono text-[10px] leading-4 tracking-[0.04em] ${statusMono}`}
                >
                  {tier.statusSecondary}
                </p>
                <p
                  data-export-mono
                  className={`font-mono text-[10px] leading-4 tracking-[0.04em] ${statusMono}`}
                >
                  {protocolLabel}
                </p>
              </div>
              <p
                data-export-body
                className={`mt-1.5 text-[10px] leading-snug ${diagnosisTone}`}
              >
                {shareSummary}
              </p>
              {tier.practiceNote ? (
                <p
                  data-export-body
                  data-practice-note
                  className={`mt-0.5 text-[10px] leading-snug ${diagnosisTone}`}
                >
                  {tier.practiceNote}
                </p>
              ) : null}
              {tier.sessionNote ? (
                <p
                  data-export-body
                  className={`mt-0.5 font-mono text-[7px] tracking-[0.08em] ${labelMuted}`}
                >
                  {tier.sessionNote}
                </p>
              ) : null}
            </section>

            {/* 7. FOOTER — tighter gap so the QR stays inside the export frame */}
            {isVoid ? (
              <footer
                data-card-block
                className="mt-8 flex w-full shrink-0 items-end justify-between gap-3 border-t border-zinc-700/60 pt-2.5"
              >
                <span className="font-mono text-[8px] text-zinc-500">
                  {PUBLIC_HOST}
                </span>
                <ArchitectSignature />
              </footer>
            ) : (
              <footer
                data-card-block
                className={`mt-8 flex shrink-0 items-end justify-between gap-3 border-t pt-2.5 ${rule}`}
              >
                <p
                  data-export-label
                  className={`min-w-0 text-[8px] tracking-[0.16em] ${labelMuted}`}
                >
                  {PUBLIC_HOST}
                </p>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <p
                    className={`whitespace-nowrap text-right text-[7px] leading-tight tracking-wide ${labelMuted}`}
                  >
                    {t.qrHint}
                  </p>
                  <div className="h-10 w-10 shrink-0" data-export-qr>
                    <QRCodeCanvas
                      value={shareUrl}
                      size={40}
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
