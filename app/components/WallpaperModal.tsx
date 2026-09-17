"use client";

import { useCallback, useEffect, useState } from "react";
import type { ResultCardLang } from "@/lib/calculateTier";
import type { WallpaperAsset } from "@/lib/wallpapers";
import { WALLPAPER_I18N } from "@/lib/wallpapers";

type WallpaperTab = "tier" | "base";

type WallpaperModalProps = {
  lang: ResultCardLang;
  tierWallpaper: WallpaperAsset;
  baseWallpaper: WallpaperAsset;
  onClose: () => void;
};

function wallpaperFileName(src: string, title: string) {
  const fromPath = src.split("/").pop();
  if (fromPath && fromPath.endsWith(".png")) return fromPath;
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "mind-os-wallpaper"}.png`;
}

async function handleSaveWallpaper(imageUrl: string, fileName: string) {
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const file = new File([blob], fileName, { type: blob.type || "image/png" });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: fileName,
      });
      return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    console.error("Failed to save wallpaper:", error);
  }
}

export default function WallpaperModal({
  lang,
  tierWallpaper,
  baseWallpaper,
  onClose,
}: WallpaperModalProps) {
  const [tab, setTab] = useState<WallpaperTab>("tier");
  const [isSaving, setIsSaving] = useState(false);
  const copy = WALLPAPER_I18N[lang];
  const activeWallpaper = tab === "base" ? baseWallpaper : tierWallpaper;

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const onSave = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await handleSaveWallpaper(
        activeWallpaper.src,
        wallpaperFileName(activeWallpaper.src, activeWallpaper.title),
      );
    } finally {
      setIsSaving(false);
    }
  }, [activeWallpaper.src, activeWallpaper.title, isSaving]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={activeWallpaper.title}
      onClick={onClose}
    >
      <div
        className="flex max-h-full w-full max-w-md flex-col items-center"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex w-full items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setTab("tier")}
            className={`rounded-lg border px-3 py-1.5 font-mono text-[10px] tracking-wider transition-colors ${
              tab === "tier"
                ? "border-zinc-400 bg-zinc-800 text-zinc-100"
                : "border-zinc-700 bg-zinc-900/60 text-zinc-400 hover:bg-zinc-800"
            }`}
          >
            [ {copy.tabTier} ]
          </button>
          <button
            type="button"
            onClick={() => setTab("base")}
            className={`rounded-lg border px-3 py-1.5 font-mono text-[10px] tracking-wider transition-colors ${
              tab === "base"
                ? "border-zinc-400 bg-zinc-800 text-zinc-100"
                : "border-zinc-700 bg-zinc-900/60 text-zinc-400 hover:bg-zinc-800"
            }`}
          >
            [ {copy.tabBase} ]
          </button>
        </div>

        <img
          key={activeWallpaper.src}
          src={activeWallpaper.src}
          alt={activeWallpaper.title}
          className="max-h-[60vh] w-auto rounded-xl border border-zinc-800 object-contain shadow-2xl"
        />

        <p className="mt-4 text-center font-mono text-xs tracking-wider text-zinc-200">
          {activeWallpaper.title}
        </p>
        <p className="mt-2 max-w-sm text-center text-xs leading-5 text-zinc-400">
          {activeWallpaper.desc}
        </p>
        <p className="mt-2 font-mono text-[11px] text-zinc-500">{copy.mobileTip}</p>
        <button
          type="button"
          onClick={() => {
            void onSave();
          }}
          disabled={isSaving}
          className="mt-3 rounded border border-zinc-600 px-4 py-1.5 font-mono text-xs text-zinc-200 transition-colors hover:bg-zinc-800 disabled:opacity-60"
        >
          {copy.downloadBtn}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 font-mono text-[10px] tracking-widest text-zinc-500 transition-colors hover:text-zinc-300"
        >
          {copy.close}
        </button>
      </div>
    </div>
  );
}
