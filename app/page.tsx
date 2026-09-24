"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import BrandHeader from "@/app/components/BrandHeader";
import HomeRewardPreview from "@/app/components/HomeRewardPreview";
import ResultCard from "@/app/components/ResultCard";
import DevTierMockPanel from "@/app/components/DevTierMockPanel";
import {
  MOCK_TIERS,
  buildMockTrialData,
  parseMockTierKey,
  type MockTierKey,
} from "@/app/dev/mockTiers";
import {
  isAbnormalSession,
  isTier00XEligible,
  isStandardTierZero,
  meetsTier00Metrics,
  pickRandomApexVariant,
  type ApexVariant,
} from "@/lib/calculateTier";
import {
  appendValidRun,
  buildHistoryTierLabel,
  createHistoryId,
  getLastValidRun,
  type HistoryRun,
} from "@/lib/history";
import {
  getDevTierFixture,
  parseDevTier,
  type DevTierOverride,
} from "@/lib/devTierOverride";
import {
  captureBreathingComplete,
  captureBreathingStart,
  captureCardSaved,
  captureLandingView,
  captureTestComplete,
  captureTestStart,
} from "@/lib/analytics";

const IS_DEV = process.env.NODE_ENV === "development";

type Lang = "zh" | "en";
type BreathPhase = "inhale" | "exhale";
type ReactionPhase =
  | "ready"
  | "instruction"
  | "countdown"
  | "waiting"
  | "go"
  | "recorded"
  | "too_soon";
type SessionStage = "srt" | "stroop" | "summary";
type StroopPhase = "instruction" | "countdown" | "stimulus" | "gap";
type InkColor = "red" | "blue";
type CountdownStep = "3" | "2" | "1" | "START";

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
const REACTION_TRIALS = 5;
const FOREPERIOD_MIN_MS = 1500;
const FOREPERIOD_MAX_MS = 6000;
const FALSE_START_MS = 50;
const STROOP_COUNT = 4;
const COUNTDOWN_DIGIT_MS = 800;
const COUNTDOWN_START_MS = 500;
const COUNTDOWN_STEPS: CountdownStep[] = ["3", "2", "1", "START"];
const MIN_SCALE = 1;
const MAX_SCALE = 1.5;
const PHASE_DURATION_MS = 5000;
const PHASE_MS: Record<BreathPhase, number> = {
  inhale: PHASE_DURATION_MS,
  exhale: PHASE_DURATION_MS,
};
const BREATH_OPTIONAL_SECONDS =
  (TARGET_CYCLES * (PHASE_MS.inhale + PHASE_MS.exhale)) / 1000;

const INK_HEX: Record<InkColor, string> = {
  red: "#f43f5e",
  blue: "#3b82f6",
};

const COPY = {
  zh: {
    subtitle: "呼吸 · 專注 · 反應",
    heroTitle: "測試你此刻的反應與專注",
    heroSubtitle: "約 1 分鐘完成，取得個人數據與專屬 Tier。",
    rewardTeaser: "完成後解鎖你的 Tier 與專屬視覺",
    startTest: "開始測試",
    startBreath: "先做 30 秒呼吸",
    breathOptionalNote: "呼吸練習可選",
    breathTitle: "5-5 諧振呼吸",
    breathDone: "呼吸校準已完成。準備好就可以開始測試。",
    phase: { inhale: "吸氣", exhale: "呼氣" } as Record<BreathPhase, string>,
    start: "開始",
    pause: "暫停",
    resume: "繼續",
    round: (x: number) => `循環 ${x} / ${TARGET_CYCLES}`,
    srtTitle: "反應速度測試",
    srtInstructionTitle: "畫面變綠時，立刻點擊螢幕",
    srtInstructionBody: "變綠之前請勿點擊。太早點擊會判定為無效，並重新開始該次。",
    srtInstructionMobile: "手機：用手指點擊畫面中央區域。",
    srtInstructionDesktop: "電腦：亦可按空白鍵（Space）。",
    srtHint: "請在畫面變綠時立即按空白鍵 或 點擊此處",
    readyCta: "準備好了",
    tooSoon: "太早喇，等變綠再撳或點擊",
    pressNow: "而家撳空白鍵或點擊此處",
    waitGreen: "等變綠，即刻撳空白鍵或點擊此處",
    retry: "重試",
    stroopTitle: "色彩干擾測試",
    stroopInstructionTitle: "看到顏色後，選擇文字的顏色",
    stroopInstructionBody: "請忽略文字本身的意思，只判斷它顯示的顏色。",
    stroopExampleRed:
      "如果「藍色」兩個字以紅色顯示 → 選「紅」",
    stroopExampleBlue:
      "如果「紅色」兩個字以藍色顯示 → 選「藍」",
    stroopMobileHint: "畫面下方會顯示",
    stroopDesktopKeys: "電腦亦可使用鍵盤：紅 [R]　藍 [B]",
    btnRed: "紅",
    btnBlue: "藍",
    word: { red: "紅", blue: "藍" } as Record<InkColor, string>,
    again: "再測一次",
    abnormalTitle: "這次測試可能受到中斷或延遲影響。",
    abnormalRetry: "重新測試",
    abnormalView: "仍然查看結果",
    abnormalHistoryNote:
      "這次測試可能受到中斷或延遲影響，未加入歷史比較。",
    baselineSaved: "BASELINE SAVED",
    baselineHint: "下次測試會顯示變化",
    compareFooter: "與上一次有效測試比較",
    tier00BreathHint:
      "你嘅反應時間已達 TIER 00 水準，但 TIER 00 需要先完成 5-5 呼吸校準才作評定。\n下次先完成呼吸，再做測試。",
    disclaimer:
      "MIND OS 結果僅反映今次作答表現，供個人參考，不構成任何醫療或臨床診斷。Mind OS 會用 PostHog 及隨機匿名識別碼記錄測試開始、完成、Tier、反應時間、干擾與準確率的整數總結、是否完成呼吸練習，以及結果卡下載等使用事件，用途是了解功能使用情況及改善產品；不會記錄姓名、電郵或逐題答案。",
  },
  en: {
    subtitle: "Breathe · Focus · React",
    heroTitle: "Test your reaction and focus",
    heroSubtitle: "About 1 minute. Get your personal data and exclusive Tier.",
    rewardTeaser: "Finish to unlock your Tier and exclusive visuals",
    startTest: "Start test",
    startBreath: "Breathe for 30 seconds",
    breathOptionalNote: "Breathing is optional",
    breathTitle: "5-5 Coherence Breath",
    breathDone: "Breathing calibration complete. Start the test when ready.",
    phase: { inhale: "In", exhale: "Out" } as Record<BreathPhase, string>,
    start: "Start",
    pause: "Pause",
    resume: "Resume",
    round: (x: number) => `Round ${x} / ${TARGET_CYCLES}`,
    srtTitle: "Reaction Speed Test",
    srtInstructionTitle: "When the screen turns green, tap immediately",
    srtInstructionBody: "Do not tap before green. Early taps are invalid and that trial restarts.",
    srtInstructionMobile: "Mobile: tap the center of the screen.",
    srtInstructionDesktop: "Desktop: you can also press Space.",
    srtHint: "When green, press Space or tap here",
    readyCta: "I'm ready",
    tooSoon: "Too soon. Wait for green.",
    pressNow: "Press Space or tap now",
    waitGreen: "Wait for green, then press Space or tap",
    retry: "Retry",
    stroopTitle: "Color Interference Test",
    stroopInstructionTitle: "Choose the color the word is shown in",
    stroopInstructionBody: "Ignore the word meaning. Respond only to the display color.",
    stroopExampleRed: 'If “BLUE” appears in red → choose Red',
    stroopExampleBlue: 'If “RED” appears in blue → choose Blue',
    stroopMobileHint: "Buttons appear below:",
    stroopDesktopKeys: "Desktop keys: Red [R] · Blue [B]",
    btnRed: "Red",
    btnBlue: "Blue",
    word: { red: "RED", blue: "BLUE" } as Record<InkColor, string>,
    again: "Retry",
    abnormalTitle: "This run may have been interrupted or delayed.",
    abnormalRetry: "Retake test",
    abnormalView: "View results anyway",
    abnormalHistoryNote:
      "This run may have been interrupted or delayed, so it was not added to history.",
    baselineSaved: "BASELINE SAVED",
    baselineHint: "Your next run will show the change",
    compareFooter: "Compared with your last valid run",
    tier00BreathHint:
      "Your reaction time reached TIER 00 level, but TIER 00 requires completing 5-5 calibration first.\nRun the breathing calibration before your next test.",
    disclaimer:
      "MIND OS results reflect this run only for personal reference, and do not constitute medical or clinical diagnosis. Mind OS uses PostHog and a random anonymous identifier to record usage events: test start, test completion, tier, integer summaries of reaction time, interference, and accuracy, whether the breathing exercise was completed, and result-card downloads. This is used to understand how features are used and to improve the product. Names, email addresses, and individual trial answers are not recorded.",
  },
} as const;

function randomWait() {
  return FOREPERIOD_MIN_MS + Math.random() * (FOREPERIOD_MAX_MS - FOREPERIOD_MIN_MS);
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

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function sampleStdDev(values: number[]) {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance =
    values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function interquartileRange(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const quantile = (p: number) => {
    const idx = (sorted.length - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  };
  return quantile(0.75) - quantile(0.25);
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

export default function HomePage() {
  return (
    <Suspense fallback={<HomeFallback />}>
      <Home />
    </Suspense>
  );
}

function HomeFallback() {
  return (
    <div className="relative flex min-h-full flex-1 flex-col bg-[#0f172a] text-[#f8fafc]" />
  );
}

function Home() {
  const searchParams = useSearchParams();
  const [lang, setLang] = useState<Lang>("zh");
  const t = COPY[lang];

  const [isRunning, setIsRunning] = useState(false);
  const [breathStarted, setBreathStarted] = useState(false);
  const [breathPanelOpen, setBreathPanelOpen] = useState(false);
  const [phase, setPhase] = useState<BreathPhase>("inhale");
  const [secondsLeft, setSecondsLeft] = useState(5);
  const [cycles, setCycles] = useState(0);
  const [scale, setScale] = useState(MIN_SCALE);
  const [transitionMs, setTransitionMs] = useState(300);
  const [completedBreathingBeforeTest, setCompletedBreathingBeforeTest] =
    useState(false);

  const [sessionStage, setSessionStage] = useState<SessionStage>("srt");
  const [reactionPhase, setReactionPhase] = useState<ReactionPhase>("ready");
  const [countdownLabel, setCountdownLabel] = useState<CountdownStep | null>(null);
  const [latencies, setLatencies] = useState<number[]>([]);
  const [lastLatency, setLastLatency] = useState<number | null>(null);

  const [stroopPhase, setStroopPhase] = useState<StroopPhase>("instruction");
  const [stroopTrials, setStroopTrials] = useState<StroopTrial[]>([]);
  const [stroopIndex, setStroopIndex] = useState(0);
  const [stroopResults, setStroopResults] = useState<StroopResult[]>([]);
  const [reportAt, setReportAt] = useState<Date | null>(null);
  const [mockSessionId, setMockSessionId] = useState<string | null>(null);
  /** Locked at result generation — never re-roll on re-render / save / share. */
  const [apexVariant, setApexVariant] = useState<ApexVariant | null>(null);
  const [resultSuspect, setResultSuspect] = useState(false);
  const [forceShowResult, setForceShowResult] = useState(false);
  const [historyPrevious, setHistoryPrevious] = useState<HistoryRun | null>(null);
  const [historyNotice, setHistoryNotice] = useState<
    "none" | "baseline" | "compare" | "invalid"
  >("none");

  const orbRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef<BreathPhase>("inhale");
  const runningRef = useRef(false);
  const cyclesRef = useRef(0);
  const remainingRef = useRef(PHASE_MS.inhale);
  const phaseStartedAtRef = useRef(0);
  const breathTimerRef = useRef<number | null>(null);
  const tickTimerRef = useRef<number | null>(null);
  const waitTimerRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const goAtRef = useRef<number | null>(null);

  const sessionStageRef = useRef<SessionStage>("srt");
  const reactionPhaseRef = useRef<ReactionPhase>("ready");
  const latenciesRef = useRef<number[]>([]);
  const stroopPhaseRef = useRef<StroopPhase>("instruction");
  const stroopTrialsRef = useRef<StroopTrial[]>([]);
  const stroopIndexRef = useRef(0);
  const stroopResultsRef = useRef<StroopResult[]>([]);
  const stroopShownAtRef = useRef<number | null>(null);
  const stroopLockedRef = useRef(false);
  const sessionInterruptedRef = useRef(false);

  const startReactionTestRef = useRef<() => void>(() => {});
  const handleReactionRef = useRef<() => void>(() => {});
  const handleStroopKeyRef = useRef<(color: InkColor) => void>(() => {});
  const advanceBreathRef = useRef<() => void>(() => {});

  const completedBreathingBeforeTestRef = useRef(false);
  completedBreathingBeforeTestRef.current = completedBreathingBeforeTest;
  const attemptIdRef = useRef<string | null>(null);
  const isRetestRef = useRef(false);
  const attemptNumberRef = useRef(0);
  const attemptTierIdRef = useRef<string | null>(null);
  const testCompleteSentRef = useRef<string | null>(null);
  const breathingStartSentRef = useRef(false);

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
        captureBreathingComplete();
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
      setCompletedBreathingBeforeTest(false);
      breathingStartSentRef.current = false;
    }
    const startingFresh = cyclesRef.current === 0 && !breathingStartSentRef.current;
    runningRef.current = true;
    setIsRunning(true);
    setBreathStarted(true);
    setBreathPanelOpen(true);
    if (startingFresh) {
      breathingStartSentRef.current = true;
      captureBreathingStart();
    }
    window.setTimeout(() => {
      startBreathPhase(phaseRef.current, remainingRef.current);
    }, 30);
  };

  const openBreathPractice = () => {
    setBreathPanelOpen(true);
    if (!runningRef.current && cyclesRef.current < TARGET_CYCLES) {
      startBreathing();
    }
    window.requestAnimationFrame(() => {
      document
        .getElementById("breath-practice-panel")
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
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

  const runCountdown = useCallback((onComplete: () => void) => {
    clearTimer(countdownTimerRef);
    let stepIndex = 0;
    setCountdownLabel(COUNTDOWN_STEPS[0]);

    const scheduleNext = () => {
      const current = COUNTDOWN_STEPS[stepIndex];
      const delay =
        current === "START" ? COUNTDOWN_START_MS : COUNTDOWN_DIGIT_MS;
      countdownTimerRef.current = window.setTimeout(() => {
        stepIndex += 1;
        if (stepIndex >= COUNTDOWN_STEPS.length) {
          countdownTimerRef.current = null;
          setCountdownLabel(null);
          onComplete();
          return;
        }
        setCountdownLabel(COUNTDOWN_STEPS[stepIndex]);
        scheduleNext();
      }, delay);
    };

    scheduleNext();
  }, []);

  const enterStroop = useCallback(() => {
    clearTimer(countdownTimerRef);
    setCountdownLabel(null);
    const trials = buildStroopTrials();
    stroopTrialsRef.current = trials;
    stroopResultsRef.current = [];
    stroopIndexRef.current = 0;
    stroopLockedRef.current = true;
    stroopShownAtRef.current = null;
    sessionStageRef.current = "stroop";
    stroopPhaseRef.current = "instruction";
    setStroopTrials(trials);
    setStroopResults([]);
    setStroopIndex(0);
    setSessionStage("stroop");
    setStroopPhase("instruction");
  }, []);

  const startReactionTest = useCallback(() => {
    if (reactionPhaseRef.current !== "ready") return;
    if (sessionStageRef.current !== "srt") return;
    // Pause breath timers before cognitive trials begin.
    if (runningRef.current) {
      const elapsed = performance.now() - phaseStartedAtRef.current;
      remainingRef.current = Math.max(0, remainingRef.current - elapsed);
      runningRef.current = false;
      setIsRunning(false);
      clearTimer(breathTimerRef);
      clearTimer(tickTimerRef);
      setTransitionMs(0);
      setScale(readScale(orbRef.current));
    }
    setBreathPanelOpen(false);
    clearTimer(countdownTimerRef);
    setCountdownLabel(null);
    latenciesRef.current = [];
    setLatencies([]);
    setLastLatency(null);
    sessionInterruptedRef.current = false;
    setResultSuspect(false);
    setForceShowResult(false);
    setHistoryPrevious(null);
    setHistoryNotice("none");
    reactionPhaseRef.current = "instruction";
    setReactionPhase("instruction");
    const attemptId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `attempt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    attemptNumberRef.current += 1;
    attemptIdRef.current = attemptId;
    isRetestRef.current = getLastValidRun() !== null;
    attemptTierIdRef.current = null;
    testCompleteSentRef.current = null;
    captureTestStart({
      attempt_id: attemptId,
      is_retest: isRetestRef.current,
      did_complete_breathing: completedBreathingBeforeTestRef.current,
      attempt_number: attemptNumberRef.current,
    });
  }, []);

  startReactionTestRef.current = startReactionTest;

  const confirmReactionReady = useCallback(() => {
    if (sessionStageRef.current !== "srt") return;
    if (reactionPhaseRef.current !== "instruction") return;
    reactionPhaseRef.current = "countdown";
    setReactionPhase("countdown");
    runCountdown(() => {
      armTrial();
    });
  }, [armTrial, runCountdown]);

  const confirmStroopReady = useCallback(() => {
    if (sessionStageRef.current !== "stroop") return;
    if (stroopPhaseRef.current !== "instruction") return;
    stroopPhaseRef.current = "countdown";
    setStroopPhase("countdown");
    stroopLockedRef.current = true;
    runCountdown(() => {
      beginStroopStimulus(0);
    });
  }, [beginStroopStimulus, runCountdown]);

  const handleReaction = useCallback(() => {
    const current = reactionPhaseRef.current;
    if (sessionStageRef.current !== "srt") return;
    if (
      current === "ready" ||
      current === "instruction" ||
      current === "countdown" ||
      current === "recorded"
    ) {
      return;
    }

    const markFalseStart = () => {
      reactionPhaseRef.current = "too_soon";
      clearTimer(waitTimerRef);
      setReactionPhase("too_soon");
      waitTimerRef.current = window.setTimeout(() => {
        armTrial();
      }, 900);
    };

    if (current === "waiting") {
      markFalseStart();
      return;
    }

    if (current !== "go" || goAtRef.current === null) return;

    const ms = Math.round(performance.now() - goAtRef.current);
    if (ms < FALSE_START_MS) {
      goAtRef.current = null;
      markFalseStart();
      return;
    }

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
        const avgLatency = Math.round(median(latenciesRef.current));
        const congruent = nextResults.filter((item) => item.congruent).map((item) => item.latencyMs);
        const incongruent = nextResults
          .filter((item) => !item.congruent)
          .map((item) => item.latencyMs);
        const interferenceMs = Math.round(mean(incongruent) - mean(congruent));
        const accuracyPct = Math.round(
          (nextResults.filter((item) => item.correct).length / STROOP_COUNT) * 100,
        );
        const gate = {
          latency: avgLatency,
          interference: interferenceMs,
          accuracy: accuracyPct,
          completedBreathingBeforeTest: completedBreathingBeforeTestRef.current,
        };
        const lockedVariant: ApexVariant | null = isTier00XEligible(gate)
          ? "void"
          : isStandardTierZero(gate)
            ? pickRandomApexVariant()
            : null;

        const suspect = isAbnormalSession({
          latencies: latenciesRef.current,
          stroopLatencies: nextResults.map((item) => item.latencyMs),
          interrupted: sessionInterruptedRef.current,
        });
        const tierId = buildHistoryTierLabel({
          latency: avgLatency,
          interference: interferenceMs,
          accuracy: accuracyPct,
          completedBreathingBeforeTest: completedBreathingBeforeTestRef.current,
          apexVariant: lockedVariant,
        });
        const attemptId = attemptIdRef.current;
        if (attemptId && testCompleteSentRef.current !== attemptId) {
          testCompleteSentRef.current = attemptId;
          attemptTierIdRef.current = tierId;
          captureTestComplete({
            attempt_id: attemptId,
            tier_id: tierId,
            is_retest: isRetestRef.current,
            did_complete_breathing: completedBreathingBeforeTestRef.current,
            attempt_number: attemptNumberRef.current,
            latency_ms: avgLatency,
            interference_ms: interferenceMs,
            accuracy: accuracyPct,
          });
        }

        if (suspect) {
          setHistoryPrevious(null);
          setHistoryNotice("invalid");
        } else {
          const previous = getLastValidRun();
          appendValidRun({
            id: createHistoryId(),
            timestamp: new Date().toISOString(),
            reactionMs: avgLatency,
            stroopAccuracy: accuracyPct,
            interferenceMs: Math.max(0, interferenceMs),
            tier: tierId,
            valid: true,
          });
          setHistoryPrevious(previous);
          setHistoryNotice(previous ? "compare" : "baseline");
        }

        sessionStageRef.current = "summary";
        setApexVariant(lockedVariant);
        setResultSuspect(suspect);
        setForceShowResult(false);
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
    const onKeyDown = (event: KeyboardEvent) => {
      const stage = sessionStageRef.current;

      if (stage === "srt") {
        if (!isSpaceKey(event)) return;
        const srtPhase = reactionPhaseRef.current;
        if (srtPhase === "instruction" || srtPhase === "countdown") {
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
    const onVisibility = () => {
      if (document.visibilityState !== "hidden") return;
      const stage = sessionStageRef.current;
      if (stage === "srt") {
        const phase = reactionPhaseRef.current;
        if (
          phase === "waiting" ||
          phase === "go" ||
          phase === "countdown" ||
          phase === "recorded"
        ) {
          sessionInterruptedRef.current = true;
        }
        return;
      }
      if (stage === "stroop") {
        const phase = stroopPhaseRef.current;
        if (phase === "stimulus" || phase === "gap" || phase === "countdown") {
          sessionInterruptedRef.current = true;
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    return () => {
      clearTimer(breathTimerRef);
      clearTimer(tickTimerRef);
      clearTimer(waitTimerRef);
      clearTimer(countdownTimerRef);
    };
  }, []);

  const retrySession = () => {
    clearTimer(waitTimerRef);
    clearTimer(breathTimerRef);
    clearTimer(tickTimerRef);
    clearTimer(countdownTimerRef);
    runningRef.current = false;
    latenciesRef.current = [];
    stroopResultsRef.current = [];
    stroopTrialsRef.current = [];
    sessionInterruptedRef.current = false;
    sessionStageRef.current = "srt";
    reactionPhaseRef.current = "ready";
    stroopPhaseRef.current = "instruction";
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
    setStroopPhase("instruction");
    setCountdownLabel(null);
    setReportAt(null);
    setMockSessionId(null);
    setApexVariant(null);
    setResultSuspect(false);
    setForceShowResult(false);
    setHistoryPrevious(null);
    setHistoryNotice("none");
    setIsRunning(false);
    setBreathStarted(false);
    setBreathPanelOpen(false);
    cyclesRef.current = 0;
    phaseRef.current = "inhale";
    remainingRef.current = PHASE_MS.inhale;
    breathingStartSentRef.current = false;
    setCycles(0);
    setPhase("inhale");
    setSecondsLeft(5);
    setScale(MIN_SCALE);
    setTransitionMs(300);
    setCompletedBreathingBeforeTest(false);
  };

  const goHome = () => {
    retrySession();
    cyclesRef.current = 0;
    phaseRef.current = "inhale";
    remainingRef.current = PHASE_MS.inhale;
    setCycles(0);
    setPhase("inhale");
    setSecondsLeft(5);
    setScale(MIN_SCALE);
    setTransitionMs(300);
    setCompletedBreathingBeforeTest(false);
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
      stroopPhaseRef.current = "instruction";

      // Lock apex skin once at inject: explicit mock override, or 50/50 for bare tier0.
      const lockedVariant =
        payload.apexVariant ??
        (key === "tier0" || key === "tier00" ? pickRandomApexVariant() : null);

      setLatencies(nextLatencies);
      setLastLatency(nextLatencies[nextLatencies.length - 1] ?? null);
      setStroopResults(nextStroop);
      setCompletedBreathingBeforeTest(payload.completedBreathingBeforeTest);
      setMockSessionId(payload.sessionId);
      setApexVariant(lockedVariant);
      setReportAt(new Date());
      setSessionStage("summary");
      setResultSuspect(false);
      setForceShowResult(false);
      setHistoryPrevious(null);
      setHistoryNotice("none");
      sessionInterruptedRef.current = false;
    },
    [],
  );

  // DEV ONLY - remove before launch
  const injectDevTier = useCallback((key: DevTierOverride) => {
    const payload = getDevTierFixture(key);
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
    stroopPhaseRef.current = "instruction";

    setLatencies(nextLatencies);
    setLastLatency(nextLatencies[nextLatencies.length - 1] ?? null);
    setStroopResults(nextStroop);
    setCompletedBreathingBeforeTest(payload.completedBreathingBeforeTest);
    setMockSessionId(payload.sessionId);
    setApexVariant(payload.apexVariant);
    setReportAt(new Date());
    setSessionStage("summary");
    setResultSuspect(false);
    setForceShowResult(false);
    setHistoryPrevious(null);
    setHistoryNotice("none");
    sessionInterruptedRef.current = false;
  }, []);

  useEffect(() => {
    // DEV ONLY - remove before launch
    const devKey = parseDevTier(searchParams.get("devTier"));
    if (devKey) {
      injectDevTier(devKey);
      return;
    }
    if (!IS_DEV) return;
    const key = parseMockTierKey(searchParams.get("mock"));
    if (!key) return;
    injectMockTier(key);
  }, [injectDevTier, injectMockTier, searchParams]);

  useEffect(() => {
    captureLandingView();
  }, []);

  useEffect(() => {
    if (latencies.length !== REACTION_TRIALS) return;
    console.log("[Mind OS] SRT variability", {
      trials: latencies,
      median: Math.round(median(latencies)),
      sd: Number(sampleStdDev(latencies).toFixed(1)),
      iqr: Number(interquartileRange(latencies).toFixed(1)),
    });
  }, [latencies]);

  const avgSrt =
    latencies.length === REACTION_TRIALS ? Math.round(median(latencies)) : null;
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
  const currentStroop = stroopTrials[stroopIndex];
  const isReadyHome = sessionStage === "srt" && reactionPhase === "ready";
  const showBreathPanel = isReadyHome && breathPanelOpen;
  const breathComplete =
    completedBreathingBeforeTest && cycles >= TARGET_CYCLES;

  return (
    <div className="relative flex min-h-full flex-1 flex-col bg-[#0f172a] text-[#f8fafc]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(56,189,248,0.1),_transparent_55%)]"
      />

      <header className="fixed inset-x-0 top-0 z-20 flex items-start justify-between gap-4 px-4 pt-4 sm:px-8 sm:pt-8">
        <BrandHeader subtitle={t.subtitle} onNavigateHome={goHome} />
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
        className={`relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 px-4 pt-16 sm:gap-6 sm:px-10 sm:pt-10 ${
          sessionStage === "summary" || isReadyHome
            ? "overflow-y-auto pb-10 sm:pb-12"
            : "overflow-hidden pb-6 sm:pb-10"
        }`}
      >
        {isReadyHome ? (
          <section className="flex flex-col items-center rounded-3xl border border-white/5 bg-white/[0.03] px-4 py-7 text-center sm:px-8 sm:py-10">
            <h1 className="max-w-xl text-balance text-2xl font-medium leading-snug tracking-wide text-[#f8fafc] sm:text-3xl sm:leading-snug">
              {t.heroTitle}
            </h1>
            <p className="mt-5 max-w-md text-sm leading-6 tracking-wide text-slate-300 sm:mt-6 sm:text-base sm:leading-7">
              {t.heroSubtitle}
            </p>
            <button
              type="button"
              onClick={startReactionTest}
              className="mt-8 flex min-h-14 w-full max-w-sm items-center justify-center rounded-full bg-sky-300 px-8 py-4 text-sm font-semibold tracking-[0.18em] text-slate-900 shadow-[0_0_48px_rgba(125,211,252,0.35)] transition hover:bg-sky-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-200 sm:mt-10"
            >
              {t.startTest}
            </button>
            {!breathComplete ? (
              <button
                type="button"
                onClick={openBreathPractice}
                className="mt-3 flex min-h-12 w-full max-w-sm items-center justify-center rounded-full border border-white/15 bg-white/5 px-6 py-3 text-xs tracking-[0.2em] text-slate-200 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
              >
                {t.startBreath}
              </button>
            ) : null}
            <p className="mt-4 max-w-sm text-[11px] leading-5 tracking-wide text-slate-500">
              {t.breathOptionalNote}
            </p>
            <div className="mt-7 w-full sm:mt-9">
              <HomeRewardPreview caption={t.rewardTeaser} />
            </div>
          </section>
        ) : null}

        {showBreathPanel ? (
          <section
            id="breath-practice-panel"
            className="flex flex-col items-center justify-center rounded-3xl border border-white/5 bg-white/[0.03] px-4 py-5 text-center sm:px-6 sm:py-8"
          >
            <p className="text-[11px] tracking-[0.35em] text-slate-400">{t.breathTitle}</p>
            {breathComplete ? (
              <p className="mt-4 max-w-sm text-sm leading-6 text-sky-200">{t.breathDone}</p>
            ) : null}

            <div className="relative mx-auto mt-6 flex h-56 w-56 flex-col items-center justify-center overflow-visible sm:mt-8 sm:h-64 sm:w-64">
              <div
                ref={orbRef}
                className="absolute inset-0 m-auto h-44 w-44 rounded-full will-change-transform sm:h-48 sm:w-48"
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

            <div className="mt-5 flex items-center justify-center gap-8 text-[11px] tracking-[0.2em] text-slate-500 sm:tracking-[0.28em]">
              {(["inhale", "exhale"] as BreathPhase[]).map((item) => (
                <span
                  key={item}
                  className={phase === item && breathStarted ? "text-sky-200" : "text-slate-600"}
                >
                  {t.phase[item]} {PHASE_MS[item] / 1000}s
                </span>
              ))}
            </div>

            {!breathComplete ? (
              <div className="mt-5 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={startBreathing}
                  disabled={isRunning}
                  className="h-11 min-w-[96px] rounded-full bg-sky-300 px-5 text-xs tracking-[0.28em] text-slate-900 transition hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-40 sm:min-w-[120px] sm:px-6"
                >
                  {breathStarted || cycles > 0 ? t.resume : t.start}
                </button>
                <button
                  type="button"
                  onClick={pauseBreathing}
                  disabled={!isRunning}
                  className="h-11 min-w-[96px] rounded-full border border-white/15 bg-white/5 px-5 text-xs tracking-[0.28em] text-[#f8fafc] transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 sm:min-w-[120px] sm:px-6"
                >
                  {t.pause}
                </button>
              </div>
            ) : null}

            <div className="mt-5 flex items-center justify-center gap-3">
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
            {breathComplete ? (
              <button
                type="button"
                onClick={startReactionTest}
                className="mt-6 flex min-h-14 w-full max-w-sm items-center justify-center rounded-full bg-sky-300 px-8 py-4 text-sm font-semibold tracking-[0.18em] text-slate-900 shadow-[0_0_48px_rgba(125,211,252,0.35)] transition hover:bg-sky-200"
              >
                {t.startTest}
              </button>
            ) : null}
            <p className="mt-3 text-[10px] tracking-wide text-slate-600">
              {BREATH_OPTIONAL_SECONDS}s · 5+5 × {TARGET_CYCLES}
            </p>
          </section>
        ) : null}

        {!isReadyHome ? (
        <section
          className={`flex min-h-0 flex-1 flex-col items-center justify-center text-center ${
            sessionStage === "summary"
              ? "rounded-none border-0 bg-transparent px-0 py-0"
              : "rounded-3xl border border-white/5 bg-white/[0.03] px-4 py-5 sm:min-h-[28rem] sm:flex-none sm:px-6 sm:py-10"
          }`}
        >
          {sessionStage === "srt" && reactionPhase === "instruction" ? (
            <div className="flex w-full max-w-md flex-col items-center justify-center px-1">
              <p className="text-[11px] tracking-[0.35em] text-slate-400">{t.srtTitle}</p>
              <h2 className="mt-5 text-balance text-xl font-medium leading-snug tracking-wide text-[#f8fafc] sm:text-2xl">
                {t.srtInstructionTitle}
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-300">{t.srtInstructionBody}</p>
              <p className="mt-5 text-sm leading-6 text-slate-400">{t.srtInstructionMobile}</p>
              <p className="mt-2 hidden text-sm leading-6 text-slate-500 sm:block">
                {t.srtInstructionDesktop}
              </p>
              <button
                type="button"
                onClick={confirmReactionReady}
                className="mt-10 flex min-h-14 w-full items-center justify-center rounded-full bg-sky-300 px-8 py-4 text-sm font-semibold tracking-[0.18em] text-slate-900 shadow-[0_0_48px_rgba(125,211,252,0.35)] transition hover:bg-sky-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-200"
              >
                {t.readyCta}
              </button>
            </div>
          ) : sessionStage === "srt" && reactionPhase === "countdown" ? (
            <div className="flex flex-col items-center justify-center">
              <p className="text-[11px] tracking-[0.35em] text-slate-400">{t.srtTitle}</p>
              <p
                className={`mt-12 font-light tabular-nums text-[#f8fafc] ${
                  countdownLabel === "START" ? "text-4xl tracking-[0.2em]" : "text-7xl"
                }`}
              >
                {countdownLabel}
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
              <p className="mt-5 text-xs tracking-[0.18em] text-slate-500 sm:hidden">
                Tap screen
              </p>
              <p className="mt-5 hidden text-xs tracking-[0.18em] text-slate-500 sm:block">
                Space / Tap screen
              </p>
            </button>
          ) : sessionStage === "stroop" && stroopPhase === "instruction" ? (
            <div className="flex w-full max-w-md flex-col items-center justify-center px-1">
              <p className="text-[11px] tracking-[0.35em] text-slate-400">{t.stroopTitle}</p>
              <h2 className="mt-5 text-balance text-xl font-medium leading-snug tracking-wide text-[#f8fafc] sm:text-2xl">
                {t.stroopInstructionTitle}
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                {t.stroopInstructionBody}
              </p>
              <div className="mt-6 w-full space-y-3 text-left text-sm leading-7 text-slate-400">
                <p>{t.stroopExampleRed}</p>
                <p>{t.stroopExampleBlue}</p>
              </div>
              <p className="mt-7 text-xs tracking-[0.2em] text-slate-500">{t.stroopMobileHint}</p>
              <div className="mt-3 grid w-full grid-cols-2 gap-3">
                <div className="rounded-xl bg-rose-500/90 py-4 text-center text-lg font-bold text-white">
                  {t.btnRed}
                </div>
                <div className="rounded-xl bg-blue-500/90 py-4 text-center text-lg font-bold text-white">
                  {t.btnBlue}
                </div>
              </div>
              <p className="mt-4 hidden text-xs leading-5 tracking-wide text-slate-500 sm:block">
                {t.stroopDesktopKeys}
              </p>
              <button
                type="button"
                onClick={confirmStroopReady}
                className="mt-8 flex min-h-14 w-full items-center justify-center rounded-full bg-sky-300 px-8 py-4 text-sm font-semibold tracking-[0.18em] text-slate-900 shadow-[0_0_48px_rgba(125,211,252,0.35)] transition hover:bg-sky-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-200"
              >
                {t.readyCta}
              </button>
            </div>
          ) : sessionStage === "stroop" && stroopPhase === "countdown" ? (
            <div className="flex flex-col items-center justify-center">
              <p className="text-[11px] tracking-[0.35em] text-slate-400">{t.stroopTitle}</p>
              <p
                className={`mt-12 font-light tabular-nums text-[#f8fafc] ${
                  countdownLabel === "START" ? "text-4xl tracking-[0.2em]" : "text-7xl"
                }`}
              >
                {countdownLabel}
              </p>
            </div>
          ) : sessionStage === "stroop" ? (
            <div className="flex w-full max-w-md flex-col items-center justify-center">
              <p className="text-[11px] tracking-[0.35em] text-slate-400">{t.stroopTitle}</p>
              <div className="mt-10 flex min-h-28 items-center justify-center sm:mt-12 sm:min-h-32">
                {stroopPhase === "stimulus" && currentStroop ? (
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
                {Math.min(stroopIndex + 1, STROOP_COUNT)} / {STROOP_COUNT}
              </p>
              <div className="mt-5 grid w-full grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={stroopPhase !== "stimulus"}
                  onClick={() => handleStroopKey("red")}
                  onTouchStart={(event) => {
                    if (stroopPhase !== "stimulus") return;
                    event.preventDefault();
                    handleStroopKey("red");
                  }}
                  className="min-h-16 rounded-xl bg-rose-500 py-5 text-xl font-bold text-white shadow-[0_0_24px_rgba(244,63,94,0.35)] transition active:scale-95 disabled:pointer-events-none disabled:opacity-40"
                >
                  {t.btnRed}
                </button>
                <button
                  type="button"
                  disabled={stroopPhase !== "stimulus"}
                  onClick={() => handleStroopKey("blue")}
                  onTouchStart={(event) => {
                    if (stroopPhase !== "stimulus") return;
                    event.preventDefault();
                    handleStroopKey("blue");
                  }}
                  className="min-h-16 rounded-xl bg-blue-500 py-5 text-xl font-bold text-white shadow-[0_0_24px_rgba(59,130,246,0.35)] transition active:scale-95 disabled:pointer-events-none disabled:opacity-40"
                >
                  {t.btnBlue}
                </button>
              </div>
              <p className="mt-4 hidden text-xs tracking-wide text-slate-500 sm:block">
                {t.stroopDesktopKeys}
              </p>
            </div>
          ) : avgSrt !== null &&
            rawInterference !== null &&
            acc !== null &&
            reportAt &&
            resultSuspect &&
            !forceShowResult ? (
            <div className="flex w-full max-w-md flex-col items-center px-2 text-center">
              <p className="text-[11px] tracking-[0.35em] text-slate-400">
                MIND OS
              </p>
              <p className="mt-6 text-balance text-lg font-medium leading-relaxed tracking-wide text-[#f8fafc] sm:text-xl">
                {t.abnormalTitle}
              </p>
              <p className="mt-4 max-w-sm text-xs leading-5 tracking-wide text-slate-500">
                {t.abnormalHistoryNote}
              </p>
              <button
                type="button"
                onClick={retrySession}
                className="mt-10 flex min-h-14 w-full items-center justify-center rounded-full bg-sky-300 px-8 py-4 text-sm font-semibold tracking-[0.18em] text-slate-900 shadow-[0_0_48px_rgba(125,211,252,0.35)] transition hover:bg-sky-200"
              >
                {t.abnormalRetry}
              </button>
              <button
                type="button"
                onClick={() => setForceShowResult(true)}
                className="mt-3 flex min-h-12 w-full items-center justify-center rounded-full border border-white/15 bg-white/5 px-6 py-3 text-xs tracking-[0.2em] text-slate-300 transition hover:bg-white/10"
              >
                {t.abnormalView}
              </button>
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
              apexVariant={apexVariant}
              sessionIdOverride={mockSessionId ?? undefined}
              onCardSave={(method) => {
                const attemptId = attemptIdRef.current;
                const tierId = attemptTierIdRef.current;
                if (!attemptId || !tierId || testCompleteSentRef.current !== attemptId) return;
                captureCardSaved({
                  attempt_id: attemptId,
                  tier_id: tierId,
                  did_complete_breathing: completedBreathingBeforeTestRef.current,
                  method,
                });
              }}
              historyPrevious={
                historyNotice === "compare" ? historyPrevious : null
              }
            />
          ) : null}
        </section>
        ) : null}
        {sessionStage === "summary" && !(resultSuspect && !forceShowResult) ? (
          <div className="mx-auto mb-12 flex w-full max-w-md flex-col gap-2">
            {historyNotice === "baseline" ? (
              <div className="mb-3 text-center">
                <p className="font-mono text-[10px] tracking-[0.28em] text-slate-400">
                  {t.baselineSaved}
                </p>
                <p className="mt-1.5 text-[11px] leading-5 text-slate-600">
                  {t.baselineHint}
                </p>
              </div>
            ) : null}
            {historyNotice === "compare" ? (
              <p className="mb-3 text-center font-mono text-[9px] tracking-[0.16em] text-slate-600">
                {t.compareFooter}
              </p>
            ) : null}
            {historyNotice === "invalid" ? (
              <p className="mb-3 text-center text-[11px] leading-5 text-slate-500">
                {t.abnormalHistoryNote}
              </p>
            ) : null}
            {avgSrt !== null &&
            rawInterference !== null &&
            acc !== null &&
            meetsTier00Metrics({
              latency: avgSrt,
              interference: rawInterference,
              accuracy: acc,
            }) &&
            !completedBreathingBeforeTest ? (
              <p
                data-export-hide
                className="whitespace-pre-line text-center text-xs tracking-wide text-slate-500"
              >
                {t.tier00BreathHint}
              </p>
            ) : null}
            <button
              type="button"
              onClick={retrySession}
              className="w-full rounded-full border border-zinc-700 bg-zinc-800/80 py-3.5 text-sm tracking-wide text-zinc-200 backdrop-blur-sm transition-colors hover:bg-zinc-700"
            >
              {t.again}
            </button>
          </div>
        ) : null}
      </main>

      {IS_DEV ? <DevTierMockPanel onInject={injectMockTier} /> : null}

      <p
        aria-label="Disclaimer"
        className="relative z-[5] mx-auto mt-auto w-full max-w-3xl shrink-0 px-4 pb-8 pt-6 text-center font-mono text-[9px] leading-relaxed tracking-widest text-white/20 transition-opacity duration-300 hover:text-white/50 sm:pb-10 sm:pt-8 sm:text-[10px]"
      >
        {t.disclaimer}
      </p>
    </div>
  );
}
