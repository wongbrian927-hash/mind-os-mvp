"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { toBlob, toPng } from "html-to-image";
import type { BenchmarkData } from "@/types/benchmark";
import {
  getTierConfig,
  interferenceDisplay,
  type TierLevel,
} from "@/lib/calculateTier";

export type ResultCardLang = "zh" | "en";
export type CardAspect = "story" | "square";
export type { TierLevel };

export type ResultCardProps = Pick<
  BenchmarkData,
  "avgSrt" | "interference" | "acc" | "reportAt" | "completedBreathingBeforeTest"
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

/** Monospace 5-scale diamond gauge: ◆ filled / ◇ hollow. */
function DiamondGauge({ filled, color }: { filled: number; color: string }) {
  const cells = Array.from({ length: 5 }, (_, index) => (index < filled ? "◆" : "◇"));
  return (
    <span
      aria-hidden
      className="inline-flex font-mono text-[11px] tracking-[0.14em]"
      style={{ color }}
    >
      {cells.join(" ")}
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

/** Capture the on-screen card node as-is (WYSIWYG). */
async function renderCardBlob(source: HTMLElement): Promise<Blob> {
  await waitForFontsReady();

  const options = {
    pixelRatio: 3,
    cacheBust: true,
    backgroundColor: "#F8F9FA",
  };

  // Warm Safari / html-to-image font cache without mutating layout.
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

async function exportCardImage(source: HTMLElement, filename: string) {
  const blob = await renderCardBlob(source);
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
  sessionIdOverride,
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
        completedBreathingBeforeTest,
      }),
    [acc, avgSrt, completedBreathingBeforeTest, interference, lang],
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
      await exportCardImage(cardRef.current, filename);
      setToast(t.saved);
      onSaved?.();
    } catch {
      setToast(lang === "zh" ? "匯出失敗，請再試一次" : "Export failed. Try again.");
    } finally {
      setBusy(false);
      window.setTimeout(() => setToast(null), 2600);
    }
  }, [busy, lang, onSaved, sessionId, t.saved]);

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
        className={`relative w-full overflow-hidden bg-[#F8F9FA] text-[#0F1115] ${
          aspect === "story" ? "aspect-[9/16]" : "aspect-square"
        }`}
        style={{
          fontFamily: "var(--font-geist-sans), Helvetica, Arial, sans-serif",
          border: `1px solid ${tier.cardBorder}`,
          boxShadow: tier.cardShadow,
        }}
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
              <DiamondGauge filled={tier.diamondFilled} color={tier.accent} />
            </div>
            <p
              data-export-latency
              className={`mt-2 font-mono text-6xl font-medium tracking-tight text-[#0F1115] sm:text-7xl ${
                tier.isApex ? "drop-shadow-[0_2px_8px_rgba(139,92,246,0.25)]" : ""
              }`}
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
              <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                <span
                  className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
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
                  className={`px-2 py-0.5 font-mono text-[9px] tracking-[0.12em] ${
                    tier.isApex ? "rounded-sm border-2" : "rounded-full border"
                  }`}
                  style={{
                    borderColor: tier.isApex ? tier.accent : `${tier.accent}55`,
                    color: tier.accent,
                    boxShadow: tier.isApex
                      ? `inset 0 0 0 1px ${tier.accentSoft}`
                      : undefined,
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
            <div className="mt-3 flex items-end justify-between gap-3">
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
              <DiamondGauge filled={tier.diamondFilled} color={tier.accent} />
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
