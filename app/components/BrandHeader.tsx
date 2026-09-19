"use client";

import Link from "next/link";
import Logo from "@/app/components/Logo";

type BrandHeaderProps = {
  subtitle: string;
  /** Same-route soft reset so Logo returns to the ready home screen. */
  onNavigateHome?: () => void;
};

export default function BrandHeader({ subtitle, onNavigateHome }: BrandHeaderProps) {
  return (
    <Link
      href="/"
      aria-label="返回 Mind OS 主頁"
      onClick={() => {
        onNavigateHome?.();
      }}
      className="min-w-0 cursor-pointer text-left transition-opacity hover:opacity-80"
    >
      <div className="flex items-center gap-2.5">
        <Logo size={22} className="shrink-0 text-slate-300" />
        <p className="text-[11px] font-medium tracking-[0.36em] text-slate-400/80 sm:tracking-[0.42em]">
          MIND OS
        </p>
      </div>
      <p className="mt-1 truncate text-[10px] tracking-widest text-slate-500 sm:text-xs">
        {subtitle}
      </p>
    </Link>
  );
}
