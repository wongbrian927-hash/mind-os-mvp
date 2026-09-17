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
    btn: "[ 解鎖高清神經校準壁紙 ]",
    tabTier: "專屬 Tier 流體",
    tabBase: "基準校準門 Base",
    mobileTip: "長按圖片即可「加入相片」儲存高清桌布",
    downloadBtn: "直接下載 PNG",
    close: "關閉",
    basePortal: {
      title: "NEURAL BASE · PORTAL (高清)",
      desc: "Mind OS 基準神經校準入口。重置前額葉負載，回歸絕對安靜。",
    },
  },
  en: {
    btn: "[ UNLOCK NEURAL CALIBRATION ARTIFACT ]",
    tabTier: "TIER EXCLUSIVE",
    tabBase: "BASE PORTAL",
    mobileTip: "Long-press image to save HD artifact to photos",
    downloadBtn: "DOWNLOAD PNG",
    close: "CLOSE",
    basePortal: {
      title: "NEURAL BASE · PORTAL (HD)",
      desc: "Mind OS baseline calibration gateway. Reset prefrontal load to absolute quiet.",
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
      desc: "神經訊號已抽乾色相，進入單色鈦金屬態。僅限突破生理極限之架構師持有。",
    },
    en: {
      title: "ARTIFACT 00X · WHITE VOID (HD)",
      desc: "Neural signal drained of chroma — monochrome titanium state. Held only by architects who breach the physiological limit.",
    },
  },
  tier00: {
    src: "/wallpapers/tier00_aurora.png",
    zh: {
      title: "TIER 00 · AURORA APEX (高清)",
      desc: "雙頻神經超頻狀態，前額葉干擾損耗歸零，進入純淨紫綠極光流。",
    },
    en: {
      title: "TIER 00 · AURORA APEX (HD)",
      desc: "Dual-band neural overclock. Prefrontal interference loss at zero — pure violet-green aurora flow.",
    },
  },
  tier00_solar: {
    src: "/wallpapers/tier00_solar.png",
    zh: {
      title: "TIER 00 · SOLAR FLARE (高清)",
      desc: "絕對聚焦高能態，神經脈衝處於最高放電閾值。",
    },
    en: {
      title: "TIER 00 · SOLAR FLARE (HD)",
      desc: "Absolute-focus high-energy state. Neural pulse at peak discharge threshold.",
    },
  },
  tier01: {
    src: "/wallpapers/tier01.png",
    zh: {
      title: "TIER 01 · CRYO OCEAN (高清)",
      desc: "深層冷卻低延遲心流，訊號傳導順暢無阻。",
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
      desc: "自主神經協調態，筋膜張力平衡，呈現翡翠與柔粉交融流動。",
    },
    en: {
      title: "TIER 02 · NEURAL SILK (HD)",
      desc: "Autonomic coherence. Fascial tension balanced — jade and blush silk in motion.",
    },
  },
  tier03: {
    src: "/wallpapers/tier03.png",
    zh: {
      title: "TIER 03 · AMBER FLUID (高清)",
      desc: "前額葉正常運算負載，琥珀色常態神經活動流體。",
    },
    en: {
      title: "TIER 03 · AMBER FLUID (HD)",
      desc: "Prefrontal load in the normal band. Amber baseline neural fluid.",
    },
  },
  tier04: {
    src: "/wallpapers/tier04.png",
    zh: {
      title: "TIER 04 · CRIMSON IMPULSE (高清)",
      desc: "前額葉認知超載警示，高阻抗脈衝流動。",
    },
    en: {
      title: "TIER 04 · CRIMSON IMPULSE (HD)",
      desc: "Prefrontal overload alert. High-impedance impulse flow.",
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
