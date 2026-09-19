type HomeRewardPreviewProps = {
  caption: string;
};

/** Compact teaser: Tier 00 Aurora wallpaper + mini result card. Visual only. */
export default function HomeRewardPreview({ caption }: HomeRewardPreviewProps) {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-center">
      <div className="relative h-[7.25rem] w-[11.5rem] sm:h-[9.5rem] sm:w-[15rem]">
        {/* Wallpaper — behind */}
        <div
          aria-hidden
          className="absolute left-0 top-1 h-[92%] w-[52%] overflow-hidden rounded-lg border border-white/10 shadow-[0_8px_28px_rgba(0,0,0,0.35)] sm:left-1 sm:top-2 sm:w-[50%]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/wallpapers/tier00_aurora.png"
            alt=""
            className="h-full w-full object-cover"
            draggable={false}
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#06090E]/70 via-transparent to-transparent" />
          <span className="absolute bottom-1.5 left-1.5 font-mono text-[6px] tracking-[0.18em] text-cyan-100/80 sm:text-[7px]">
            TIER 00
          </span>
        </div>

        {/* Mini result card — in front */}
        <div
          aria-hidden
          className="absolute bottom-0 right-0 z-10 flex aspect-[9/16] h-[96%] w-[46%] flex-col overflow-hidden rounded-lg border border-cyan-300/25 bg-[#06090E] p-1.5 shadow-[0_0_24px_rgba(96,239,255,0.12)] sm:w-[44%] sm:p-2"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 80% 50% at 18% 0%, rgba(0,255,135,0.16), transparent 55%), radial-gradient(ellipse 70% 45% at 85% 28%, rgba(168,85,247,0.14), transparent 52%)",
          }}
        >
          <p className="font-mono text-[5px] tracking-[0.2em] text-cyan-200/70 sm:text-[6px]">
            MIND OS
          </p>
          <p className="mt-1 text-[7px] font-medium tracking-wide text-zinc-100 sm:mt-1.5 sm:text-[8px]">
            TIER 00
          </p>
          <p
            className="mt-auto font-mono text-[11px] tabular-nums leading-none text-cyan-200 sm:text-sm"
            style={{
              filter:
                "drop-shadow(0 0 8px rgba(96,239,255,0.35))",
            }}
          >
            198
            <span className="ml-0.5 text-[6px] text-cyan-200/60 sm:text-[7px]">
              ms
            </span>
          </p>
          <p className="mt-1 font-mono text-[5px] tracking-[0.14em] text-zinc-500 sm:text-[6px]">
            TOP 1%
          </p>
        </div>
      </div>
      <p className="mt-3 max-w-xs text-center text-[11px] leading-5 tracking-wide text-slate-500 sm:mt-4 sm:text-xs">
        {caption}
      </p>
    </div>
  );
}
