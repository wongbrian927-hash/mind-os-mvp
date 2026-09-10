"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { toBlob, toPng } from "html-to-image";
import type { BenchmarkData } from "@/types/benchmark";
import {
  getTierConfig,
  interferenceDisplay,
  type ApexVariant,
  type TierLevel,
} from "@/lib/calculateTier";
import Logo from "@/app/components/Logo";

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
    detailed: "Clinical",
    minimal: "Minimal",
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

/**
 * Monospace 5-scale diamond gauge.
 * Uses per-glyph solid colors (not bg-clip-text) so html-to-image stays reliable.
 */
function DiamondGauge({
  filled,
  color,
  spectrumColors,
}: {
  filled: number;
  color: string;
  spectrumColors?: string[] | null;
}) {
  return (
    <span aria-hidden className="inline-flex font-mono text-[11px] tracking-[0.14em]">
      {Array.from({ length: 5 }, (_, index) => {
        const lit = index < filled;
        const tone =
          lit && spectrumColors && spectrumColors[index]
            ? spectrumColors[index]
            : lit
              ? color
              : "rgba(148,163,184,0.35)";
        return (
          <span key={index} style={{ color: tone }} className={index > 0 ? "ml-[0.14em]" : undefined}>
            {lit ? "◆" : "◇"}
          </span>
        );
      })}
    </span>
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

/** Capture the on-screen card node as-is (WYSIWYG), always 9:16. */
async function renderCardBlob(
  source: HTMLElement,
  backgroundColor: string,
): Promise<Blob> {
  await waitForFontsReady();

  const options = {
    pixelRatio: 3,
    cacheBust: true,
    backgroundColor,
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
}: ResultCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<CardViewMode>("detailed");
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
        completedBreathingBeforeTest,
        apexVariant: apexVariant ?? undefined,
      }),
    [acc, apexVariant, avgSrt, completedBreathingBeforeTest, interference, lang],
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
    () => sessionIdOverride ?? buildSessionId(avgSrt, interference, acc, reportAt),
    [acc, avgSrt, interference, reportAt, sessionIdOverride],
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
      await exportCardImage(cardRef.current, filename, tier.cardBackground);
      setToast(t.saved);
      onSaved?.();
    } catch {
      setToast(lang === "zh" ? "匯出失敗，請再試一次" : "Export failed. Try again.");
    } finally {
      setBusy(false);
      window.setTimeout(() => setToast(null), 2600);
    }
  }, [busy, lang, onSaved, sessionId, t.saved, tier.cardBackground]);

  const isApex = tier.isApex;
  const isMinimal = viewMode === "minimal";
  const labelMuted = isApex ? "text-slate-400" : "text-zinc-400";
  const labelSoft = isApex ? "text-slate-400" : "text-zinc-500";
  const metricPrimary = isApex ? "text-slate-50" : "text-[#0F1115]";
  const metricSub = isApex ? "text-slate-400" : "text-zinc-500";
  const rule = isApex ? "border-zinc-800" : "border-zinc-800/10";
  const titleTone = isApex ? "text-slate-100" : "text-zinc-800";
  const statusMono = isApex ? "text-slate-300" : "text-zinc-700";
  const diagnosisTone = isApex ? "text-slate-300" : "text-zinc-500";
  const sessionTone = isApex ? "text-slate-400" : "text-zinc-600";
  const watermarkTone = isApex ? "text-slate-500" : "text-zinc-500";

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4">
      <div className="flex items-center gap-2 self-end">
        <button
          type="button"
          onClick={() => setViewMode("detailed")}
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
          className={`relative aspect-[9/16] w-full overflow-hidden ${
            isApex ? "text-slate-50" : "bg-[#F8F9FA] text-[#0F1115]"
          }`}
          style={{
            fontFamily: "var(--font-geist-sans), Helvetica, Arial, sans-serif",
            border: `1px solid ${tier.cardBorder}`,
            boxShadow: tier.cardShadow,
            backgroundColor: tier.cardBackground,
          }}
        >
          {isApex && tier.radialGlow ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ backgroundImage: tier.radialGlow }}
            />
          ) : null}

          <div
            data-card-shell
            className={`absolute inset-0 z-[1] flex h-full min-h-0 flex-col px-7 py-8 sm:px-8 sm:py-9 ${
              isMinimal ? "justify-between gap-6" : "justify-between"
            }`}
          >
            <header
              data-card-block
              className={`flex shrink-0 items-start justify-between gap-4 border-b pb-4 ${rule}`}
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

            <section
              data-card-block
              className={`shrink-0 ${isMinimal ? "mt-2" : ""}`}
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
                  spectrumColors={tier.diamondColors}
                />
              </div>
              <p
                data-export-latency
                className={`font-mono font-medium tracking-tight ${metricPrimary} ${
                  isMinimal
                    ? "mt-4 text-7xl sm:text-8xl"
                    : "mt-2 text-6xl sm:text-7xl"
                }`}
                style={{
                  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                  filter: tier.latencyFilter ?? undefined,
                }}
              >
                {avgSrt}
                <span
                  data-export-latency-unit
                  className={`ml-2 align-baseline font-sans font-normal tracking-[0.18em] ${labelMuted} ${
                    isMinimal ? "text-base" : "text-sm"
                  }`}
                >
                  ms
                </span>
              </p>
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
                    className={`text-sm tracking-wide ${titleTone}`}
                  >
                    {tier.title}
                  </span>
                  <span
                    data-export-pill
                    className={`px-2 py-0.5 font-mono text-[9px] tracking-[0.12em] ${
                      isApex ? "rounded-sm border-2" : "rounded-full border"
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
              {!isMinimal ? (
                <p
                  data-export-mono
                  className={`mt-2 font-mono text-[9px] tracking-[0.2em] ${labelMuted}`}
                >
                  {tier.titleEn}
                </p>
              ) : null}
            </section>

            <section
              data-card-block
              className={`grid shrink-0 grid-cols-2 border-y ${rule} ${
                isMinimal ? "gap-5 py-6" : "gap-5 py-5"
              }`}
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
                {!isMinimal ? (
                  <p data-export-mono className={`mt-2 text-[10px] leading-4 ${metricSub}`}>
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
                  className={`mt-2 font-mono text-3xl tracking-tight ${metricPrimary}`}
                  style={{ fontFamily: "var(--font-geist-mono), ui-monospace, monospace" }}
                >
                  {acc}
                  <span className={`ml-1 font-sans text-[10px] tracking-[0.16em] ${labelMuted}`}>
                    %
                  </span>
                </p>
                {!isMinimal ? (
                  <p data-export-mono className={`mt-2 text-[10px] leading-4 ${metricSub}`}>
                    ACC
                  </p>
                ) : null}
              </div>
            </section>

            <section data-card-block className="shrink-0">
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
                  className={`font-mono tracking-tight ${
                    isMinimal ? "text-3xl" : "text-2xl"
                  }`}
                  style={{
                    fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                    color: tier.accent,
                    textShadow: isApex
                      ? `0 0 14px ${tier.accentSoft}`
                      : undefined,
                  }}
                >
                  {tier.breathLabel}
                </p>
                {!isMinimal ? (
                  <DiamondGauge
                    filled={tier.diamondFilled}
                    color={tier.accent}
                    spectrumColors={tier.diamondColors}
                  />
                ) : null}
              </div>
            </section>

            {isMinimal ? (
              <section data-card-block className="shrink-0">
                <div className={`flex items-end justify-between border-t pt-4 ${rule}`}>
                  <p
                    data-export-label
                    className={`text-[8px] uppercase tracking-[0.22em] ${labelMuted}`}
                  >
                    {t.watermark}
                  </p>
                  <p
                    data-export-mono
                    className={`font-mono text-[9px] tracking-[0.16em] ${watermarkTone}`}
                  >
                    {sessionId}
                  </p>
                </div>
              </section>
            ) : (
              <section
                data-card-block
                className={
                  isApex
                    ? "rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-3"
                    : undefined
                }
              >
                <p
                  data-export-label
                  className={`text-[8px] uppercase tracking-[0.22em] ${labelMuted}`}
                >
                  {t.status}
                </p>
                <div className="mt-3 space-y-2">
                  <p
                    data-export-mono
                    className={`font-mono text-[11px] tracking-[0.08em] ${statusMono}`}
                  >
                    {tier.statusPrimary}
                  </p>
                  <p
                    data-export-mono
                    className={`font-mono text-[11px] tracking-[0.08em] ${statusMono}`}
                  >
                    {tier.statusSecondary}
                  </p>
                  <p
                    data-export-mono
                    className={`font-mono text-[11px] tracking-[0.08em] ${statusMono}`}
                  >
                    {protocolLabel}
                  </p>
                </div>
                <p
                  data-export-body
                  className={`mt-4 text-[12px] leading-5 ${diagnosisTone}`}
                >
                  {tier.diagnosis}
                </p>
                <div className={`mt-5 flex items-end justify-between border-t pt-4 ${rule}`}>
                  <p
                    data-export-label
                    className={`text-[8px] uppercase tracking-[0.22em] ${labelMuted}`}
                  >
                    {t.watermark}
                  </p>
                  <p
                    data-export-mono
                    className={`font-mono text-[9px] tracking-[0.16em] ${watermarkTone}`}
                  >
                    {sessionId}
                  </p>
                </div>
              </section>
            )}
          </div>
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
