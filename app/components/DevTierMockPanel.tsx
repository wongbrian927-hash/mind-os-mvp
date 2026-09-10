"use client";

import { useState } from "react";
import { MOCK_TIERS, type MockTierKey } from "@/app/dev/mockTiers";

type DevTierMockPanelProps = {
  onInject: (key: MockTierKey) => void;
};

/** Floating debug menu — only mount when NODE_ENV === "development". */
export default function DevTierMockPanel({ onInject }: DevTierMockPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {open ? (
        <div className="w-52 rounded-xl border border-white/15 bg-slate-950/95 p-3 shadow-xl backdrop-blur">
          <p className="mb-2 font-mono text-[9px] tracking-[0.2em] text-violet-300">
            DEV · TIER MOCK
          </p>
          <div className="flex flex-col gap-1.5">
            {(Object.keys(MOCK_TIERS) as MockTierKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  onInject(key);
                  setOpen(false);
                }}
                className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-left font-mono text-[10px] tracking-wide text-slate-200 transition hover:border-violet-400/40 hover:bg-violet-500/10"
              >
                {MOCK_TIERS[key].label}
              </button>
            ))}
          </div>
          <p className="mt-2 font-mono text-[8px] leading-4 text-slate-500">
            URL: ?mock=tier0 … tier4
          </p>
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded-full border border-violet-400/40 bg-violet-600/90 px-3 py-2 font-mono text-[10px] tracking-[0.16em] text-white shadow-lg transition hover:bg-violet-500"
      >
        {open ? "CLOSE" : "MOCK"}
      </button>
    </div>
  );
}
