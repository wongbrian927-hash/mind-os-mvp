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
    metricsHelp: "指標說明",
    metricsReaction:
      "反應時間：本次反應測試所有有效試次延遲的中位數（毫秒）。",
    metricsInterference:
      "干擾損耗：不一致試次平均延遲減去一致試次平均延遲（毫秒）。顯示時若差值 ≤ 0，以 0 表示。",
    metricsAccuracy:
      "準確率：色彩測試答對題數 ÷ 總題數，四捨五入至整數百分比。",
    reaction: "REACTION LATENCY",
    tier: "FOCUS TIER",
    interference: "INTERFERENCE",
    accuracy: "ACCURACY",
    status: "FOCUS STATE",
    qrHint: "試下你嘅反應速度",
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
    interference: "INTERFERENCE",
    accuracy: "ACCURACY",
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
        return `今次反應與上次相同，準確率 ${acc}%。`;
      }
      if (delta < 0) {
        return `今次反應比上次快 ${Math.abs(delta)} ms，準確率 ${acc}%。`;
      }
      return `今次反應比上次慢 ${delta} ms，準確率 ${acc}%。`;
    }
    if (delta === 0) {
      return `Reaction matched last run. Accuracy ${acc}%.`;
    }
    if (delta < 0) {
      return `${Math.abs(delta)} ms faster than last. Accuracy ${acc}%.`;
    }
    return `${delta} ms slower than last. Accuracy ${acc}%.`;
  }
  return lang === "zh"
    ? `今次反應 ${avgSrt} ms，準確率 ${acc}%。`
    : `Reaction ${avgSrt} ms · Accuracy ${acc}%.`;
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
      className={`mt-1 font-mono text-[8px] leading-3 tracking-[0.04em] ${className}`}
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

function VoidHairline({ className = "my-3" }: { className?: string }) {
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

/** Capture the fixed 9:16 share card exactly as rendered. */
async function renderCardBlob(
  source: HTMLElement,
  backgroundColor: string,
): Promise<Blob> {
  await waitForFontsReady();
  void source.offsetHeight;

  const rect = source.getBoundingClientRect();
  const width = Math.ceil(rect.width);
  const height = Math.ceil(rect.height);

  const options = {
    pixelRatio: 3,
    cacheBust: true,
    backgroundColor,
    width,
    height,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: "none",
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
  const showTierPath =
    historyPrevious !== null && historyPrevious.tier !== historyTierLabel;
  const focusMetricSummary = buildFocusMetricSummary({
    lang,
    avgSrt,
    acc,
    previous: historyPrevious,
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
    if (!cardRef.current || isExporting || !qrReady) return;
    setIsExporting(true);
    setToast(null);
    try {
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
    <div className="mx-auto flex w-full max-w-[420px] flex-col items-center gap-4">
      {/* Fixed 9:16 share card — 1080×1920 baseline */}
      <div className="relative w-full">
        <div
          ref={cardRef}
          className={`relative aspect-[9/16] w-full overflow-hidden ${
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
            className="absolute inset-0 z-[1] flex flex-col px-6 pb-8 pt-9 sm:px-7 sm:pb-9 sm:pt-10"
          >
            {/* 1. Header */}
            <header
              data-card-block
              className={`flex shrink-0 items-start justify-between gap-3 ${
                isVoid ? "" : `border-b pb-3 ${rule}`
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
                  className={`mt-1 font-mono text-[8px] tracking-[0.22em] ${labelMuted}`}
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
                  className={`mt-1 font-mono text-[8px] tracking-[0.14em] ${sessionTone}`}
                >
                  {sessionId}
                </p>
              </div>
            </header>
            {isVoid ? <VoidHairline className="my-2.5" /> : null}

            {/* 2. Primary metric — Reaction */}
            <section data-card-block className="mt-4 shrink-0">
              <div className="flex items-center justify-between gap-2">
                <p
                  data-export-label
                  className={`text-[7px] font-medium uppercase tracking-[0.24em] ${labelMuted}`}
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
                className={`mt-1.5 font-mono font-medium leading-none tracking-tight ${
                  isVoid
                    ? "text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]"
                    : metricPrimary
                } text-[4.25rem] sm:text-[4.75rem]`}
                style={{
                  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                  filter: isVoid ? undefined : tier.latencyFilter ?? undefined,
                }}
              >
                {avgSrt}
                <span
                  data-export-latency-unit
                  className={`ml-1.5 align-baseline font-sans text-sm font-normal tracking-[0.16em] ${
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
                <VoidHairline className="mt-3 mb-0" />
              ) : (
                <div
                  data-export-bar
                  className="mt-3 h-[2px] w-full overflow-hidden"
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

            {/* 3. Focus Tier + plain status */}
            <section data-card-block className="mt-3.5 shrink-0">
              <div className="flex items-center justify-between gap-2">
                <p
                  data-export-label
                  className={`text-[7px] uppercase tracking-[0.22em] ${labelMuted}`}
                >
                  {t.tier}
                </p>
                <span
                  data-export-pill
                  className={`shrink-0 px-2 py-0.5 font-mono text-[8px] tracking-[0.1em] ${
                    isApex || isVoid ? "rounded-sm border-2" : "rounded-full border"
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
              <div className="mt-1.5 flex min-w-0 items-center gap-2">
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
                <p
                  data-export-title
                  className={`min-w-0 truncate text-[15px] font-medium tracking-wide ${titleTone}`}
                >
                  {isVoid ? "MONOCHROME VOID" : tier.title}
                </p>
              </div>
              <p
                className={`mt-1 text-[13px] leading-snug tracking-wide ${diagnosisTone}`}
              >
                {tier.focusPlain}
              </p>
              {!isVoid ? (
                <p
                  data-export-mono
                  className={`mt-1 font-mono text-[8px] tracking-[0.18em] ${labelMuted}`}
                >
                  {tier.titleEn}
                </p>
              ) : null}
              {showTierPath && historyPrevious ? (
                <p
                  data-export-mono
                  className={`mt-1 font-mono text-[8px] tracking-[0.12em] ${cmpTone}`}
                >
                  {historyPrevious.tier}
                  <span className="mx-1 opacity-60">→</span>
                  {historyTierLabel}
                </p>
              ) : null}
            </section>

            {/* 4. Secondary metrics */}
            <section
              data-card-block
              className={`mt-3.5 grid shrink-0 grid-cols-2 gap-4 border-y py-3.5 ${rule}`}
            >
              <div className="min-w-0">
                <p
                  data-export-label
                  className={`text-[7px] uppercase tracking-[0.2em] ${labelMuted}`}
                >
                  {t.interference}
                </p>
                <p
                  data-export-metric
                  className={`mt-1 font-mono text-[1.65rem] leading-none tracking-tight ${metricPrimary}`}
                  style={{
                    fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                  }}
                >
                  {lossDisplay}
                  <span
                    className={`ml-1 font-sans text-[9px] tracking-[0.14em] ${labelMuted}`}
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
                  <p className={`mt-1.5 truncate text-[9px] leading-3 ${metricSub}`}>
                    {tier.interferenceLabel}
                  </p>
                )}
              </div>
              <div className="min-w-0">
                <p
                  data-export-label
                  className={`text-[7px] uppercase tracking-[0.2em] ${labelMuted}`}
                >
                  {t.accuracy}
                </p>
                <p
                  data-export-metric
                  className={`mt-1 font-mono text-[1.65rem] leading-none tracking-tight ${metricPrimary}`}
                  style={{
                    fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                  }}
                >
                  {acc}
                  <span
                    className={`ml-1 font-sans text-[9px] tracking-[0.14em] ${labelMuted}`}
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
                  <p className={`mt-1.5 text-[9px] leading-3 ${metricSub}`}>ACC</p>
                )}
              </div>
            </section>

            {/* 5. Focus State — breath code + plain meaning */}
            <section
              data-card-block
              className={`mt-3.5 shrink-0 ${
                isApex || isCritical
                  ? `rounded-lg border px-3 py-2.5 ${
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
                className={`text-[7px] uppercase tracking-[0.2em] ${labelMuted}`}
              >
                {t.status}
              </p>
              <div className="mt-1.5 flex items-baseline justify-between gap-3">
                <p
                  data-export-metric
                  className="font-mono text-xl tracking-tight"
                  style={
                    isVoid
                      ? {
                          fontFamily:
                            "var(--font-geist-mono), ui-monospace, monospace",
                          color: "#e4e4e7",
                        }
                      : {
                          fontFamily:
                            "var(--font-geist-mono), ui-monospace, monospace",
                          color: tier.accent,
                          textShadow: isApex
                            ? `0 0 12px ${tier.accentSoft}`
                            : undefined,
                        }
                  }
                >
                  {tier.breathLabel}
                </p>
                <p
                  data-export-title
                  className={`min-w-0 truncate text-right text-[13px] tracking-wide ${titleTone}`}
                >
                  {tier.focusPlain}
                </p>
              </div>
              {/* 6. Short read — 1–2 lines */}
              <p
                data-export-body
                className={`mt-2 text-[11px] leading-4 ${diagnosisTone}`}
              >
                {tier.diagnosis}
              </p>
              <p
                data-export-body
                className={`mt-1 text-[11px] leading-4 ${diagnosisTone}`}
              >
                {focusMetricSummary}
              </p>
              {tier.sessionNote ? (
                <p
                  data-export-body
                  className={`mt-1.5 font-mono text-[8px] tracking-[0.1em] ${labelMuted}`}
                >
                  {tier.sessionNote}
                </p>
              ) : null}
            </section>

            {/* Spacer pushes footer to bottom of 9:16 frame */}
            <div className="min-h-3 flex-1" aria-hidden />

            {/* 7. Footer — URL + QR / signature */}
            {isVoid ? (
              <footer
                data-card-block
                className="flex w-full shrink-0 items-end justify-between gap-3 pt-2"
              >
                <span className="font-mono text-[8px] text-zinc-500">
                  {PUBLIC_HOST}
                </span>
                <ArchitectSignature />
              </footer>
            ) : (
              <footer
                data-card-block
                className={`flex shrink-0 items-end justify-between gap-3 border-t pt-3 ${rule}`}
              >
                <div className="min-w-0">
                  <p
                    data-export-label
                    className={`text-[8px] tracking-[0.18em] ${labelMuted}`}
                  >
                    {PUBLIC_HOST}
                  </p>
                  <p className={`mt-1 text-[7px] tracking-wide ${labelMuted}`}>
                    {t.qrHint}
                  </p>
                </div>
                <div
                  className="h-11 w-11 shrink-0 overflow-hidden"
                  data-export-qr
                >
                  <QRCodeCanvas
                    value={shareUrl}
                    size={44}
                    level="M"
                    marginSize={1}
                    bgColor="transparent"
                    fgColor={isDarkCard ? "#ffffff" : "#0F1115"}
                    className="block"
                  />
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
