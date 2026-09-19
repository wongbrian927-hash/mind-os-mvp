import type { ApexVariant, ResultCardLang, TierLevel } from "@/lib/calculateTier";

export type WallpaperAsset = {
  title: string;
  src: string;
  desc: string;
};

type WallpaperCopy = {
  title: string;
  desc: string;
};

export const WALLPAPER_I18N = {
  zh: {
    btn: "[ 解鎖高清專屬壁紙 ]",
    tabTier: "專屬 Tier 流體",
    tabBase: "基準校準門 Base",
    mobileTip: "長按圖片即可「加入相片」儲存高清桌布",
    downloadBtn: "直接下載 PNG",
    close: "關閉",
    basePortal: {
      title: "NEURAL BASE · PORTAL (高清)",
      desc: "Mind OS 基準校準入口。重置系統負載，回歸安靜。",
    },
  },
  en: {
    btn: "[ UNLOCK HD EXCLUSIVE ARTIFACT ]",
    tabTier: "TIER EXCLUSIVE",
    tabBase: "BASE PORTAL",
    mobileTip: "Long-press image to save HD artifact to photos",
    downloadBtn: "DOWNLOAD PNG",
    close: "CLOSE",
    basePortal: {
      title: "NEURAL BASE · PORTAL (HD)",
      desc: "Mind OS baseline calibration gateway. Reset system load to quiet.",
    },
  },
} as const;

export const BASE_PORTAL_WALLPAPER = {
  src: "/wallpapers/base_portal.png",
};

export const TIER_WALLPAPERS: Record<
  string,
  { src: string; zh: WallpaperCopy; en: WallpaperCopy }
> = {
  tier00x: {
    src: "/wallpapers/tier00x.png",
    zh: {
      title: "ARTIFACT 00X · WHITE VOID (高清)",
      desc: "今次 run 的單色峰值態視覺。Signal 極乾淨，僅限罕見同步表現解鎖。",
    },
    en: {
      title: "ARTIFACT 00X · WHITE VOID (HD)",
      desc: "Monochrome peak-state visual from this run. Clean signal — unlocked only by rare sync.",
    },
  },
  tier00: {
    src: "/wallpapers/tier00_aurora.png",
    zh: {
      title: "TIER 00 · AURORA APEX (高清)",
      desc: "雙頻超頻同步態。干擾損耗趨近於零，進入純淨紫綠極光流。",
    },
    en: {
      title: "TIER 00 · AURORA APEX (HD)",
      desc: "Dual-band overclock sync. Interference loss near zero — pure violet-green aurora flow.",
    },
  },
  tier00_solar: {
    src: "/wallpapers/tier00_solar.png",
    zh: {
      title: "TIER 00 · SOLAR FLARE (高清)",
      desc: "絕對聚焦高能態，系統處於峰值放電節奏。",
    },
    en: {
      title: "TIER 00 · SOLAR FLARE (HD)",
      desc: "Absolute-focus high-energy state. System at peak discharge rhythm.",
    },
  },
  tier01: {
    src: "/wallpapers/tier01.png",
    zh: {
      title: "TIER 01 · CRYO OCEAN (高清)",
      desc: "深層冷卻低延遲流體，訊號傳導順暢無阻。",
    },
    en: {
      title: "TIER 01 · CRYO OCEAN (HD)",
      desc: "Deep-cooled low-latency flow. Signal conduction unobstructed.",
    },
  },
  tier02: {
    src: "/wallpapers/tier02.png",
    zh: {
      title: "TIER 02 · NEURAL SILK (高清)",
      desc: "系統協調態，張力平衡，呈現翡翠與柔粉交融流動。",
    },
    en: {
      title: "TIER 02 · NEURAL SILK (HD)",
      desc: "System coherence. Tension balanced — jade and blush silk in motion.",
    },
  },
  tier03: {
    src: "/wallpapers/tier03.png",
    zh: {
      title: "TIER 03 · AMBER FLUID (高清)",
      desc: "今次負載偏高的琥珀色流體視覺。",
    },
    en: {
      title: "TIER 03 · AMBER FLUID (HD)",
      desc: "Amber fluid visual for an elevated-load run.",
    },
  },
  tier04: {
    src: "/wallpapers/tier04.png",
    zh: {
      title: "TIER 04 · CRIMSON IMPULSE (高清)",
      desc: "今次延遲偏高的赤紅脈衝流體。可以再測一次。",
    },
    en: {
      title: "TIER 04 · CRIMSON IMPULSE (HD)",
      desc: "Crimson impulse fluid for a high-latency run. Try another pass anytime.",
    },
  },
};

export function resolveTierWallpaperKey(
  level: TierLevel,
  variant: ApexVariant | null,
): string {
  if (variant === "void") return "tier00x";
  if (level === 0 && variant === "midnight-sun") return "tier00_solar";
  if (level === 0) return "tier00";
  if (level === 1) return "tier01";
  if (level === 2) return "tier02";
  if (level === 3) return "tier03";
  return "tier04";
}

export function getTierWallpaper(
  level: TierLevel,
  variant: ApexVariant | null,
  lang: ResultCardLang,
): WallpaperAsset {
  const key = resolveTierWallpaperKey(level, variant);
  const asset = TIER_WALLPAPERS[key] ?? TIER_WALLPAPERS.tier04;
  const copy = asset[lang];
  return { src: asset.src, title: copy.title, desc: copy.desc };
}

export function getBasePortalWallpaper(lang: ResultCardLang): WallpaperAsset {
  const copy = WALLPAPER_I18N[lang].basePortal;
  return {
    src: BASE_PORTAL_WALLPAPER.src,
    title: copy.title,
    desc: copy.desc,
  };
}
