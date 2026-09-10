"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ResultCard from "@/app/components/ResultCard";
import DevTierMockPanel from "@/app/components/DevTierMockPanel";
import {
  MOCK_TIERS,
  buildMockTrialData,
  parseMockTierKey,
  type MockTierKey,
} from "@/app/dev/mockTiers";

const IS_DEV = process.env.NODE_ENV === "development";

type Lang = "zh" | "en";
type BreathPhase = "inhale" | "exhale";
type ReactionPhase = "ready" | "buffer" | "waiting" | "go" | "recorded" | "too_soon";
type SessionStage = "srt" | "stroop" | "summary";
type StroopPhase = "intro" | "stimulus" | "gap";
type InkColor = "red" | "blue";

type StroopTrial = {
  wordColor: InkColor;
  ink: InkColor;
  congruent: boolean;
};

type StroopResult = {
  congruent: boolean;
  latencyMs: number;
  correct: boolean;
};

const TARGET_CYCLES = 3;
const REACTION_TRIALS = 3;
const STROOP_COUNT = 4;
const BUFFER_SECONDS = 2;
const STROOP_BUFFER_SECONDS = 3;
const MIN_SCALE = 1;
const MAX_SCALE = 1.5;
const PHASE_DURATION_MS = 5000;
const TALLY_FORM_URL = "https://tally.so/r/0QWeRA";

const PHASE_MS: Record<BreathPhase, number> = {
  inhale: PHASE_DURATION_MS,
  exhale: PHASE_DURATION_MS,
};

const INK_HEX: Record<InkColor, string> = {
  red: "#f43f5e",
  blue: "#3b82f6",
};

const COPY = {
  zh: {
    subtitle: "呼吸 · 專注 · 反應",
    breathTitle: "5-5 諧振呼吸",
    phase: { inhale: "吸氣", exhale: "呼氣" } as Record<BreathPhase, string>,
    start: "開始",
    pause: "暫停",
    round: (x: number) => `循環 ${x} / 3`,
    breathSuggest: "建議先完成一次呼吸練習，以校準基準反應（非強制）",
    srtTitle: "第一階段 · 純反應測試",
    srtHint: "請在畫面變綠時立即按空白鍵 或 點擊此處 / Tap screen",
    startTest: "開始認知測試",
    startTestEn: "Start Cognitive Test",
    tooSoon: "太早喇，等變綠再撳或點擊",
    pressNow: "而家撳空白鍵或點擊此處",
    waitGreen: "等變綠，即刻撳空白鍵或點擊此處",
    retry: "重試",
    stroopTitle: "色彩專注測試",
    stroopRule: "只睇字體顏色，唔好睇字面意思",
    keyGuide: "R = 紅色 ｜ B = 藍色",
    keyHint: "建議：左手食指 R，右手食指 B",
    stroopCountdown: (n: number) => `測試將於 ${n} 秒後開始...`,
    btnRed: "🔴 紅色 (Red)",
    btnBlue: "🔵 藍色 (Blue)",
    word: { red: "紅", blue: "藍" } as Record<InkColor, string>,
    submit: "📋 填寫 30 秒體驗感受（跳轉問卷）",
    again: "再測一次",
  },
  en: {
    subtitle: "Breathe · Focus · React",
    breathTitle: "5-5 Coherence Breath",
    phase: { inhale: "In", exhale: "Out" } as Record<BreathPhase, string>,
    start: "Start",
    pause: "Pause",
    round: (x: number) => `Round ${x} / 3`,
    breathSuggest: "Suggested: complete one breath practice first to calibrate baseline (optional)",
    srtTitle: "Stage 1 · Simple Reaction",
    srtHint: "When green, press Space or tap here / Tap screen",
    startTest: "Start Cognitive Test",
    startTestEn: "Start Cognitive Test",
    tooSoon: "Too soon. Wait for green.",
    pressNow: "Press Space or tap now",
    waitGreen: "Wait for green, then press Space or tap",
    retry: "Retry",
    stroopTitle: "Color Focus Test",
    stroopRule: "Pick font COLOR, not the word",
    keyGuide: "R = Red ｜ B = Blue",
    keyHint: "Left hand R, Right hand B",
    stroopCountdown: (n: number) => `Starts in ${n}s...`,
    btnRed: "🔴 Red",
    btnBlue: "🔵 Blue",
    word: { red: "RED", blue: "BLUE" } as Record<InkColor, string>,
    submit: "📋 30-sec reflection (opens survey)",
    again: "Retry",
  },
} as const;

function randomWait() {
  return 1000 + Math.random() * 2000;
}

function isSpaceKey(event: KeyboardEvent) {
  return !event.repeat && (event.code === "Space" || event.key === " ");
}

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function buildStroopTrials(): StroopTrial[] {
  return shuffle([
    { wordColor: "red", ink: "red", congruent: true },
    { wordColor: "blue", ink: "blue", congruent: true },
    { wordColor: "red", ink: "blue", congruent: false },
    { wordColor: "blue", ink: "red", congruent: false },
  ]);
}

function mean(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function readScale(element: HTMLElement | null) {
  if (!element) return MIN_SCALE;
  const value = window.getComputedStyle(element).transform;
  if (!value || value === "none") return MIN_SCALE;
  const match = value.match(/^matrix\((.+)\)$/);
  if (!match) return MIN_SCALE;
  const sx = Number(match[1].split(",")[0]);
  return Number.isFinite(sx) ? sx : MIN_SCALE;
}

/** Kept for rollback; gated by SHOW_LOCK (default false). */
const SHOW_LOCK = false;

function LockIcon() {
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 text-slate-500">
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M7 11V8a5 5 0 0 1 10 0v3" />
        <rect x="5" y="11" width="14" height="10" rx="2" />
      </svg>
    </div>
  );
}

export default function Home() {
  const [lang, setLang] = useState<Lang>("zh");
  const t = COPY[lang];

  const [isRunning, setIsRunning] = useState(false);
  const [breathStarted, setBreathStarted] = useState(false);
  const [phase, setPhase] = useState<BreathPhase>("inhale");
  const [secondsLeft, setSecondsLeft] = useState(5);
  const [cycles, setCycles] = useState(0);
  const [scale, setScale] = useState(MIN_SCALE);
  const [transitionMs, setTransitionMs] = useState(300);
  const [completedBreathingBeforeTest, setCompletedBreathingBeforeTest] =
    useState(false);

  const [sessionStage, setSessionStage] = useState<SessionStage>("srt");
  const [reactionPhase, setReactionPhase] = useState<ReactionPhase>("ready");
  const [bufferCount, setBufferCount] = useState(BUFFER_SECONDS);
  const [latencies, setLatencies] = useState<number[]>([]);
  const [lastLatency, setLastLatency] = useState<number | null>(null);

  const [stroopPhase, setStroopPhase] = useState<StroopPhase>("intro");
  const [stroopTrials, setStroopTrials] = useState<StroopTrial[]>([]);
  const [stroopIndex, setStroopIndex] = useState(0);
  const [stroopResults, setStroopResults] = useState<StroopResult[]>([]);
  const [reportAt, setReportAt] = useState<Date | null>(null);
  const [mockSessionId, setMockSessionId] = useState<string | null>(null);
  const [mockApexVariant, setMockApexVariant] = useState<
    import("@/lib/calculateTier").ApexVariant | null
  >(null);

  const orbRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef<BreathPhase>("inhale");
  const runningRef = useRef(false);
  const cyclesRef = useRef(0);
  const remainingRef = useRef(PHASE_MS.inhale);
  const phaseStartedAtRef = useRef(0);
  const breathTimerRef = useRef<number | null>(null);
  const tickTimerRef = useRef<number | null>(null);
  const waitTimerRef = useRef<number | null>(null);
  const goAtRef = useRef<number | null>(null);

  const sessionStageRef = useRef<SessionStage>("srt");
  const reactionPhaseRef = useRef<ReactionPhase>("ready");
  const latenciesRef = useRef<number[]>([]);
  const stroopPhaseRef = useRef<StroopPhase>("intro");
  const stroopTrialsRef = useRef<StroopTrial[]>([]);
  const stroopIndexRef = useRef(0);
  const stroopResultsRef = useRef<StroopResult[]>([]);
  const stroopShownAtRef = useRef<number | null>(null);
  const stroopLockedRef = useRef(false);

  const startReactionTestRef = useRef<() => void>(() => {});
  const handleReactionRef = useRef<() => void>(() => {});
  const handleStroopKeyRef = useRef<(color: InkColor) => void>(() => {});
  const advanceBreathRef = useRef<() => void>(() => {});

  const clearTimer = (ref: { current: number | null }) => {
    if (ref.current !== null) {
      window.clearTimeout(ref.current);
      ref.current = null;
    }
  };

  const applyPhaseVisual = useCallback((nextPhase: BreathPhase, remaining: number) => {
    setTransitionMs(remaining);
    setScale(nextPhase === "inhale" ? MAX_SCALE : MIN_SCALE);
  }, []);

  const scheduleBreathTick = useCallback(() => {
    clearTimer(tickTimerRef);
    const update = () => {
      if (!runningRef.current) return;
      const elapsed = performance.now() - phaseStartedAtRef.current;
      const remaining = Math.max(0, remainingRef.current - elapsed);
      setSecondsLeft(Math.max(1, Math.ceil(remaining / 1000)));
      tickTimerRef.current = window.setTimeout(update, 200);
    };
    update();
  }, []);

  const startBreathPhase = useCallback(
    (nextPhase: BreathPhase, remaining = PHASE_MS[nextPhase]) => {
      phaseRef.current = nextPhase;
      remainingRef.current = remaining;
      phaseStartedAtRef.current = performance.now();
      setPhase(nextPhase);
      setSecondsLeft(Math.max(1, Math.ceil(remaining / 1000)));

      const isFreshPhase = remaining >= PHASE_MS[nextPhase];
      if (isFreshPhase) {
        // Snap to phase start scale, then ease to end scale over 5s.
        setTransitionMs(0);
        setScale(nextPhase === "inhale" ? MIN_SCALE : MAX_SCALE);
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            applyPhaseVisual(nextPhase, remaining);
          });
        });
      } else {
        // Resume from paused mid-phase scale toward the phase end-state.
        applyPhaseVisual(nextPhase, remaining);
      }

      clearTimer(breathTimerRef);
      breathTimerRef.current = window.setTimeout(() => {
        advanceBreathRef.current();
      }, remaining);
      scheduleBreathTick();
    },
    [applyPhaseVisual, scheduleBreathTick],
  );

  const advanceBreath = useCallback(() => {
    const current = phaseRef.current;
    if (current === "exhale") {
      const nextCycles = cyclesRef.current + 1;
      cyclesRef.current = nextCycles;
      setCycles(nextCycles);
      if (nextCycles >= TARGET_CYCLES) {
        runningRef.current = false;
        setIsRunning(false);
        setCompletedBreathingBeforeTest(true);
        phaseRef.current = "inhale";
        remainingRef.current = PHASE_MS.inhale;
        setPhase("inhale");
        setSecondsLeft(5);
        setTransitionMs(300);
        setScale(MIN_SCALE);
        setBreathStarted(false);
        clearTimer(breathTimerRef);
        clearTimer(tickTimerRef);
        return;
      }
      startBreathPhase("inhale");
      return;
    }
    startBreathPhase("exhale");
  }, [startBreathPhase]);

  advanceBreathRef.current = advanceBreath;

  const startBreathing = () => {
    if (runningRef.current) return;
    if (cyclesRef.current >= TARGET_CYCLES) {
      cyclesRef.current = 0;
      phaseRef.current = "inhale";
      remainingRef.current = PHASE_MS.inhale;
      setCycles(0);
      setPhase("inhale");
      setScale(MIN_SCALE);
      setTransitionMs(0);
    }
    runningRef.current = true;
    setIsRunning(true);
    setBreathStarted(true);
    window.setTimeout(() => {
      startBreathPhase(phaseRef.current, remainingRef.current);
    }, 30);
  };

  const pauseBreathing = () => {
    if (!runningRef.current) return;
    const elapsed = performance.now() - phaseStartedAtRef.current;
    remainingRef.current = Math.max(0, remainingRef.current - elapsed);
    runningRef.current = false;
    setIsRunning(false);
    clearTimer(breathTimerRef);
    clearTimer(tickTimerRef);
    setTransitionMs(0);
    setScale(readScale(orbRef.current));
    setSecondsLeft(Math.max(1, Math.ceil(remainingRef.current / 1000)));
  };

  const armTrial = useCallback(() => {
    clearTimer(waitTimerRef);
    goAtRef.current = null;
    reactionPhaseRef.current = "waiting";
    setReactionPhase("waiting");
    waitTimerRef.current = window.setTimeout(() => {
      goAtRef.current = performance.now();
      reactionPhaseRef.current = "go";
      setReactionPhase("go");
    }, randomWait());
  }, []);

  const beginStroopStimulus = useCallback((index: number) => {
    stroopLockedRef.current = false;
    stroopIndexRef.current = index;
    stroopPhaseRef.current = "stimulus";
    stroopShownAtRef.current = performance.now();
    setStroopIndex(index);
    setStroopPhase("stimulus");
  }, []);

  const enterStroop = useCallback(() => {
    const trials = buildStroopTrials();
    stroopTrialsRef.current = trials;
    stroopResultsRef.current = [];
    stroopIndexRef.current = 0;
    stroopLockedRef.current = true;
    stroopShownAtRef.current = null;
    sessionStageRef.current = "stroop";
    stroopPhaseRef.current = "intro";
    setStroopTrials(trials);
    setStroopResults([]);
    setStroopIndex(0);
    setSessionStage("stroop");
    setStroopPhase("intro");
    setBufferCount(STROOP_BUFFER_SECONDS);
  }, []);

  const startReactionTest = useCallback(() => {
    if (reactionPhaseRef.current !== "ready") return;
    if (sessionStageRef.current !== "srt") return;
    latenciesRef.current = [];
    setLatencies([]);
    setLastLatency(null);
    setBufferCount(BUFFER_SECONDS);
    reactionPhaseRef.current = "buffer";
    setReactionPhase("buffer");
  }, []);

  startReactionTestRef.current = startReactionTest;

  const handleReaction = useCallback(() => {
    const current = reactionPhaseRef.current;
    if (sessionStageRef.current !== "srt") return;
    if (current === "buffer" || current === "ready") return;

    if (current === "waiting") {
      reactionPhaseRef.current = "too_soon";
      clearTimer(waitTimerRef);
      setReactionPhase("too_soon");
      waitTimerRef.current = window.setTimeout(() => {
        armTrial();
      }, 900);
      return;
    }

    if (current !== "go" || goAtRef.current === null) return;

    const ms = Math.round(performance.now() - goAtRef.current);
    const next = [...latenciesRef.current, ms];
    latenciesRef.current = next;
    reactionPhaseRef.current = "recorded";
    goAtRef.current = null;
    setLatencies(next);
    setLastLatency(ms);
    setReactionPhase("recorded");

    if (next.length >= REACTION_TRIALS) {
      waitTimerRef.current = window.setTimeout(() => {
        enterStroop();
      }, 700);
      return;
    }

    waitTimerRef.current = window.setTimeout(() => {
      armTrial();
    }, 650);
  }, [armTrial, enterStroop]);

  handleReactionRef.current = handleReaction;

  const handleStroopKey = useCallback(
    (color: InkColor) => {
      if (stroopPhaseRef.current !== "stimulus" || stroopLockedRef.current) return;
      if (stroopShownAtRef.current === null) return;

      stroopLockedRef.current = true;
      const trial = stroopTrialsRef.current[stroopIndexRef.current];
      if (!trial) return;

      const nextResults = [
        ...stroopResultsRef.current,
        {
          congruent: trial.congruent,
          latencyMs: Math.round(performance.now() - stroopShownAtRef.current),
          correct: color === trial.ink,
        },
      ];
      stroopResultsRef.current = nextResults;
      setStroopResults(nextResults);

      const nextIndex = stroopIndexRef.current + 1;
      if (nextIndex >= STROOP_COUNT) {
        sessionStageRef.current = "summary";
        setReportAt(new Date());
        setSessionStage("summary");
        return;
      }

      stroopPhaseRef.current = "gap";
      setStroopPhase("gap");
      waitTimerRef.current = window.setTimeout(() => {
        beginStroopStimulus(nextIndex);
      }, 550);
    },
    [beginStroopStimulus],
  );

  handleStroopKeyRef.current = handleStroopKey;

  useEffect(() => {
    if (reactionPhase !== "buffer") return;
    setBufferCount(BUFFER_SECONDS);
    let remaining = BUFFER_SECONDS;
    const id = window.setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        window.clearInterval(id);
        armTrial();
        return;
      }
      setBufferCount(remaining);
    }, 1000);
    return () => window.clearInterval(id);
  }, [armTrial, reactionPhase]);

  useEffect(() => {
    if (sessionStage !== "stroop" || stroopPhase !== "intro") return;
    setBufferCount(STROOP_BUFFER_SECONDS);
    let remaining = STROOP_BUFFER_SECONDS;
    const id = window.setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        window.clearInterval(id);
        beginStroopStimulus(0);
        return;
      }
      setBufferCount(remaining);
    }, 1000);
    return () => window.clearInterval(id);
  }, [beginStroopStimulus, sessionStage, stroopPhase]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const stage = sessionStageRef.current;

      if (stage === "srt") {
        if (!isSpaceKey(event)) return;
        const srtPhase = reactionPhaseRef.current;
        if (srtPhase === "buffer") {
          event.preventDefault();
          return;
        }
        if (srtPhase === "ready") {
          event.preventDefault();
          startReactionTestRef.current();
          return;
        }
        if (srtPhase !== "waiting" && srtPhase !== "go") return;
        event.preventDefault();
        handleReactionRef.current();
        return;
      }

      if (stage !== "stroop") return;
      if (stroopPhaseRef.current !== "stimulus") {
        event.preventDefault();
        return;
      }
      if (event.repeat) return;
      const key = event.key.toLowerCase();
      if (key !== "r" && key !== "b") return;
      event.preventDefault();
      handleStroopKeyRef.current(key === "r" ? "red" : "blue");
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    return () => {
      clearTimer(breathTimerRef);
      clearTimer(tickTimerRef);
      clearTimer(waitTimerRef);
    };
  }, []);

  const retrySession = () => {
    clearTimer(waitTimerRef);
    latenciesRef.current = [];
    stroopResultsRef.current = [];
    stroopTrialsRef.current = [];
    sessionStageRef.current = "srt";
    reactionPhaseRef.current = "ready";
    stroopPhaseRef.current = "intro";
    stroopIndexRef.current = 0;
    stroopShownAtRef.current = null;
    stroopLockedRef.current = false;
    setLatencies([]);
    setLastLatency(null);
    setStroopResults([]);
    setStroopTrials([]);
    setStroopIndex(0);
    setSessionStage("srt");
    setReactionPhase("ready");
    setStroopPhase("intro");
    setBufferCount(BUFFER_SECONDS);
    setReportAt(null);
    setMockSessionId(null);
    setMockApexVariant(null);
  };

  const injectMockTier = useCallback(
    (key: MockTierKey) => {
      if (!IS_DEV) return;
      const payload = MOCK_TIERS[key];
      const { latencies: nextLatencies, stroopResults: nextStroop } =
        buildMockTrialData(payload);

      clearTimer(breathTimerRef);
      clearTimer(tickTimerRef);
      clearTimer(waitTimerRef);
      runningRef.current = false;
      setIsRunning(false);
      setBreathStarted(false);

      latenciesRef.current = nextLatencies;
      stroopResultsRef.current = nextStroop;
      sessionStageRef.current = "summary";
      reactionPhaseRef.current = "ready";
      stroopPhaseRef.current = "intro";

      setLatencies(nextLatencies);
      setLastLatency(nextLatencies[nextLatencies.length - 1] ?? null);
      setStroopResults(nextStroop);
      setCompletedBreathingBeforeTest(payload.completedBreathingBeforeTest);
      setMockSessionId(payload.sessionId);
      setMockApexVariant(payload.apexVariant ?? null);
      setReportAt(new Date());
      setSessionStage("summary");
    },
    [],
  );

  useEffect(() => {
    if (!IS_DEV) return;
    const key = parseMockTierKey(
      new URLSearchParams(window.location.search).get("mock"),
    );
    if (!key) return;
    injectMockTier(key);
  }, [injectMockTier]);

  const avgSrt =
    latencies.length === REACTION_TRIALS ? Math.round(mean(latencies)) : null;
  const rawInterference =
    stroopResults.length === STROOP_COUNT
      ? Math.round(
          mean(stroopResults.filter((item) => !item.congruent).map((item) => item.latencyMs)) -
            mean(stroopResults.filter((item) => item.congruent).map((item) => item.latencyMs)),
        )
      : null;
  const acc =
    stroopResults.length === STROOP_COUNT
      ? Math.round(
          (stroopResults.filter((item) => item.correct).length / STROOP_COUNT) * 100,
        )
      : null;
  const tallyHref =
    avgSrt !== null && rawInterference !== null && acc !== null
      ? `${TALLY_FORM_URL}?avg_srt=${avgSrt}&interference=${rawInterference}&acc=${acc}&lang=${lang}&calibrated=${completedBreathingBeforeTest ? 1 : 0}`
      : TALLY_FORM_URL;

  const currentStroop = stroopTrials[stroopIndex];
  const breathVisibleOnMobile =
    sessionStage === "srt" && reactionPhase === "ready";

  return (
    <div className="relative flex min-h-full flex-1 flex-col bg-[#0f172a] text-[#f8fafc]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(56,189,248,0.1),_transparent_55%)]"
      />

      <header className="fixed inset-x-0 top-0 z-20 flex items-start justify-between gap-4 px-4 pt-4 sm:px-8 sm:pt-8">
        <div className="min-w-0 text-left">
          <p className="text-[11px] font-medium tracking-[0.36em] text-slate-400/80 sm:tracking-[0.42em]">
            MIND OS
          </p>
          <p className="mt-1 truncate text-[10px] tracking-widest text-slate-500 sm:text-xs">
            {t.subtitle}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-0.5 text-[11px] tracking-[0.2em] text-slate-500">
          <button
            type="button"
            onClick={() => setLang("en")}
            className={lang === "en" ? "text-slate-200" : "hover:text-slate-300"}
          >
            EN
          </button>
          <span className="text-slate-600">|</span>
          <button
            type="button"
            onClick={() => setLang("zh")}
            className={lang === "zh" ? "text-slate-200" : "hover:text-slate-300"}
          >
            繁中
          </button>
        </div>
      </header>

      <main
        className={`relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 px-4 pb-6 pt-16 sm:gap-8 sm:px-10 sm:py-10 ${
          sessionStage === "summary" ? "overflow-y-auto" : "overflow-hidden"
        }`}
      >
        <section
          className={`flex-col items-center justify-center rounded-3xl border border-white/5 bg-white/[0.03] px-4 py-5 text-center sm:px-6 sm:py-10 ${
            breathVisibleOnMobile ? "flex" : "hidden sm:flex"
          }`}
        >
          <p className="text-[11px] tracking-[0.35em] text-slate-400">{t.breathTitle}</p>

          <div className="relative mx-auto mt-6 flex h-64 w-64 flex-col items-center justify-center overflow-visible sm:mt-10 sm:h-72 sm:w-72">
            <div
              ref={orbRef}
              className="absolute inset-0 m-auto h-48 w-48 rounded-full will-change-transform"
              style={{
                transform: `scale(${scale})`,
                transformOrigin: "center center",
                transitionProperty: "transform",
                transitionDuration: `${transitionMs}ms`,
                transitionTimingFunction: "ease-in-out",
                background:
                  "radial-gradient(circle at 30% 30%, rgba(125,211,252,0.95), rgba(14,165,233,0.35) 58%, rgba(99,102,241,0.2) 100%)",
                boxShadow: "0 0 80px rgba(56,189,248,0.28)",
              }}
            />
            <div className="pointer-events-none relative z-10 flex flex-col items-center justify-center">
              {breathStarted ? (
                <>
                  <span className="text-3xl font-bold tabular-nums tracking-tight text-[#f8fafc]">
                    {secondsLeft}
                  </span>
                  <span className="mt-2 text-sm tracking-[0.28em] text-sky-200/80 opacity-80">
                    {t.phase[phase]}
                  </span>
                </>
              ) : null}
            </div>
          </div>

          <div className="mt-5 flex items-center justify-center gap-8 text-[11px] tracking-[0.2em] text-slate-500 sm:mt-8 sm:tracking-[0.28em]">
            {(["inhale", "exhale"] as BreathPhase[]).map((item) => (
              <span
                key={item}
                className={phase === item && breathStarted ? "text-sky-200" : "text-slate-600"}
              >
                {t.phase[item]} {PHASE_MS[item] / 1000}s
              </span>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-center gap-3 sm:mt-8">
            <button
              type="button"
              onClick={startBreathing}
              disabled={isRunning}
              className="h-11 min-w-[96px] rounded-full bg-sky-300 px-5 text-xs tracking-[0.28em] text-slate-900 transition hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-40 sm:min-w-[120px] sm:px-6"
            >
              {lang === "en" ? "Start" : t.start}
            </button>
            <button
              type="button"
              onClick={pauseBreathing}
              disabled={!isRunning}
              className="h-11 min-w-[96px] rounded-full border border-white/15 bg-white/5 px-5 text-xs tracking-[0.28em] text-[#f8fafc] transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 sm:min-w-[120px] sm:px-6"
            >
              {lang === "en" ? "Pause" : t.pause}
            </button>
          </div>

          <div className="mt-5 flex items-center justify-center gap-3 sm:mt-8">
            {Array.from({ length: TARGET_CYCLES }).map((_, index) => (
              <span
                key={index}
                className={`h-1.5 w-8 rounded-full ${
                  index < cycles ? "bg-sky-300" : "bg-white/10"
                }`}
              />
            ))}
          </div>
          <p className="mt-3 text-[11px] tracking-widest text-slate-500">
            {t.round(Math.min(cycles, TARGET_CYCLES))}
          </p>
        </section>

        <section
          className={`flex min-h-0 flex-1 flex-col items-center justify-center text-center ${
            sessionStage === "summary"
              ? "rounded-none border-0 bg-transparent px-0 py-0"
              : "rounded-3xl border border-white/5 bg-white/[0.03] px-4 py-5 sm:min-h-[28rem] sm:flex-none sm:px-6 sm:py-10"
          }`}
        >
          {sessionStage === "srt" && reactionPhase === "ready" ? (
            <div className="flex flex-col items-center justify-center">
              {SHOW_LOCK ? <LockIcon /> : null}
              <p className="max-w-sm text-xs leading-5 text-zinc-400">
                {t.breathSuggest}
              </p>
              <p className="mt-5 text-[11px] tracking-[0.35em] text-slate-400">
                {t.srtTitle}
              </p>
              <button
                type="button"
                onClick={startReactionTest}
                disabled={false}
                className="mt-8 min-h-16 rounded-full bg-sky-300 px-10 py-4 text-slate-900 shadow-[0_0_48px_rgba(125,211,252,0.35)] transition hover:bg-sky-200"
              >
                <span className="block text-sm font-semibold tracking-[0.18em]">
                  {t.startTest}
                </span>
                {lang === "zh" ? (
                  <span className="mt-1 block text-[11px] tracking-[0.16em] text-slate-700">
                    {t.startTestEn}
                  </span>
                ) : null}
              </button>
            </div>
          ) : sessionStage === "srt" && reactionPhase === "buffer" ? (
            <div className="flex flex-col items-center justify-center">
              <p className="text-[11px] tracking-[0.35em] text-slate-400">{t.srtTitle}</p>
              <p className="mt-5 max-w-md text-base font-medium leading-7 tracking-wide text-sky-200">
                {t.srtHint}
              </p>
              <p className="mt-10 text-6xl font-light tabular-nums text-[#f8fafc]">
                {bufferCount}
              </p>
              <p className="mt-4 text-xs tracking-[0.28em] text-slate-500">
                {lang === "zh" ? "準備" : "Ready"}
              </p>
            </div>
          ) : sessionStage === "srt" ? (
            <button
              type="button"
              onClick={handleReaction}
              onTouchStart={(event) => {
                event.preventDefault();
                handleReaction();
              }}
              className="flex w-full max-w-md cursor-pointer select-none flex-col items-center justify-center rounded-2xl px-2 py-4"
            >
              <p className="text-[11px] tracking-[0.35em] text-slate-400">{t.srtTitle}</p>
              <p className="mt-3 text-sm text-slate-400">
                {reactionPhase === "too_soon"
                  ? t.tooSoon
                  : reactionPhase === "go"
                    ? t.pressNow
                    : t.waitGreen}
              </p>
              <p className="mt-4 max-w-md text-sm font-medium leading-7 tracking-wide text-sky-200 sm:text-base">
                {t.srtHint}
              </p>
              <div
                className="mt-8 flex h-36 w-36 items-center justify-center rounded-full transition-colors duration-200 sm:mt-10 sm:h-44 sm:w-44"
                style={{
                  background:
                    reactionPhase === "go"
                      ? "#22c55e"
                      : reactionPhase === "too_soon"
                        ? "#f43f5e"
                        : "#334155",
                  boxShadow:
                    reactionPhase === "go"
                      ? "0 0 70px rgba(34, 197, 94, 0.45)"
                      : "none",
                }}
              >
                <span className="text-sm tabular-nums tracking-[0.2em] text-[#f8fafc]/80">
                  {reactionPhase === "too_soon"
                    ? t.retry
                    : reactionPhase === "recorded" && lastLatency !== null
                      ? `${lastLatency} ms`
                      : `${latencies.length + 1} / ${REACTION_TRIALS}`}
                </span>
              </div>
              <p className="mt-5 text-xs tracking-[0.18em] text-slate-500">
                Space / Tap screen
              </p>
            </button>
          ) : sessionStage === "stroop" ? (
            <div className="flex flex-col items-center justify-center">
              <p className="text-[11px] tracking-[0.35em] text-slate-400">{t.stroopTitle}</p>
              <p className="mt-4 max-w-sm text-sm leading-7 text-slate-400">{t.stroopRule}</p>
              <div className="mt-6 flex flex-col items-center justify-center gap-2 text-sm">
                <p className="tracking-wide text-slate-300">{t.keyGuide}</p>
                <p className="text-xs tracking-wide text-slate-500">{t.keyHint}</p>
              </div>
              <div className="mt-8 flex min-h-24 items-center justify-center sm:mt-12 sm:min-h-28">
                {stroopPhase === "intro" ? (
                  <p className="max-w-xs px-2 text-sm font-medium leading-7 tracking-wide text-sky-200 sm:max-w-sm sm:text-lg sm:leading-8">
                    {t.stroopCountdown(bufferCount)}
                  </p>
                ) : stroopPhase === "stimulus" && currentStroop ? (
                  <p
                    className="text-7xl font-medium tracking-[0.28em]"
                    style={{ color: INK_HEX[currentStroop.ink] }}
                  >
                    {t.word[currentStroop.wordColor]}
                  </p>
                ) : (
                  <p className="text-sm tracking-widest text-slate-600">·</p>
                )}
              </div>
              <p className="mt-6 text-xs tracking-[0.28em] text-slate-500 sm:mt-8">
                {stroopPhase === "intro" ? 0 : Math.min(stroopIndex + 1, STROOP_COUNT)} /{" "}
                {STROOP_COUNT}
              </p>
              {stroopPhase === "stimulus" ? (
                <div className="mt-5 grid w-full max-w-md grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleStroopKey("red")}
                    onTouchStart={(event) => {
                      event.preventDefault();
                      handleStroopKey("red");
                    }}
                    className="rounded-xl bg-rose-500 py-4 text-lg font-bold text-white shadow-[0_0_24px_rgba(244,63,94,0.35)] transition active:scale-95"
                  >
                    {t.btnRed}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStroopKey("blue")}
                    onTouchStart={(event) => {
                      event.preventDefault();
                      handleStroopKey("blue");
                    }}
                    className="rounded-xl bg-blue-500 py-4 text-lg font-bold text-white shadow-[0_0_24px_rgba(59,130,246,0.35)] transition active:scale-95"
                  >
                    {t.btnBlue}
                  </button>
                </div>
              ) : null}
            </div>
          ) : avgSrt !== null &&
            rawInterference !== null &&
            acc !== null &&
            reportAt ? (
            <ResultCard
              lang={lang}
              avgSrt={avgSrt}
              interference={rawInterference}
              acc={acc}
              reportAt={reportAt}
              completedBreathingBeforeTest={completedBreathingBeforeTest}
              sessionIdOverride={mockSessionId ?? undefined}
              apexVariantOverride={mockApexVariant ?? undefined}
            />
          ) : null}
        </section>
        {sessionStage === "summary" ? (
          <div className="mx-auto flex w-full max-w-md flex-col gap-2">
            <a
              href={tallyHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/15 bg-transparent px-5 text-sm tracking-wide text-slate-200 transition hover:bg-white/5"
            >
              {t.submit}
            </a>
            <button
              type="button"
              onClick={retrySession}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-transparent px-5 text-xs tracking-[0.28em] text-slate-500 transition hover:bg-white/5"
            >
              {t.again}
            </button>
          </div>
        ) : null}
      </main>

      {IS_DEV ? <DevTierMockPanel onInject={injectMockTier} /> : null}
    </div>
  );
}
