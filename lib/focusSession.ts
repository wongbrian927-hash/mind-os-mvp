export const STROOP_COLORS = ["red", "blue", "green"] as const;
export type InkColor = (typeof STROOP_COLORS)[number];

export type StroopTrial = {
  wordColor: InkColor;
  ink: InkColor;
  congruent: boolean;
  /** Left then right. Exactly one entry is the ink color. */
  options: [InkColor, InkColor];
};

export type StroopScoreInput = {
  congruent: boolean;
  latencyMs: number;
  correct: boolean;
};

/** Six trials: each ink is correct twice, with three congruent and three incongruent. */
export const STROOP_COUNT = 6;

/** Inclusive wait before the reaction screen turns green. Redrawn every trial. */
export const FOREPERIOD_MIN_MS = 2000;
export const FOREPERIOD_MAX_MS = 6000;

type StroopStimulus = Omit<StroopTrial, "options">;

const FALLBACK_TRIALS: StroopTrial[] = [
  { wordColor: "red", ink: "red", congruent: true, options: ["red", "green"] },
  { wordColor: "red", ink: "blue", congruent: false, options: ["red", "blue"] },
  { wordColor: "blue", ink: "red", congruent: false, options: ["red", "blue"] },
  { wordColor: "green", ink: "green", congruent: true, options: ["blue", "green"] },
  { wordColor: "blue", ink: "blue", congruent: true, options: ["red", "blue"] },
  { wordColor: "red", ink: "green", congruent: false, options: ["green", "red"] },
];

function mean(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function shuffle<T>(items: T[], random: () => number) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function otherColors(ink: InkColor) {
  return STROOP_COLORS.filter((color) => color !== ink);
}

/** A pure rotation (every word is the same step away from its ink) is easy to learn. */
function isSingleCycle(trials: StroopStimulus[]) {
  const index = new Map(STROOP_COLORS.map((color, position) => [color, position]));
  const deltas = trials.map((trial) => {
    const word = index.get(trial.wordColor) ?? 0;
    const ink = index.get(trial.ink) ?? 0;
    return (word - ink + STROOP_COLORS.length) % STROOP_COLORS.length;
  });
  return deltas.every((delta) => delta === deltas[0]);
}

function buildIncongruent(random: () => number): StroopStimulus[] {
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const trials = STROOP_COLORS.map((ink) => {
      const choices = otherColors(ink);
      const wordColor = choices[Math.floor(random() * choices.length)] ?? choices[0];
      return { wordColor, ink, congruent: false as const };
    });
    if (!isSingleCycle(trials)) return trials;
  }
  return FALLBACK_TRIALS.filter((trial) => !trial.congruent).map(
    ({ wordColor, ink, congruent }) => ({ wordColor, ink, congruent }),
  );
}

export function isBalancedStroopSet(trials: StroopStimulus[]) {
  if (trials.length !== STROOP_COUNT) return false;
  const inkCount: Record<InkColor, number> = { red: 0, blue: 0, green: 0 };
  let congruent = 0;
  for (const trial of trials) {
    inkCount[trial.ink] += 1;
    if (trial.congruent) {
      if (trial.wordColor !== trial.ink) return false;
      congruent += 1;
    } else if (trial.wordColor === trial.ink) {
      return false;
    }
  }
  return (
    congruent === STROOP_COUNT / 2 &&
    inkCount.red === 2 &&
    inkCount.blue === 2 &&
    inkCount.green === 2
  );
}

/**
 * Reject orders a person can ride without looking: long same-condition runs,
 * strict alternation, paired duplicates, or the button order repeating.
 */
export function isPredictableStroopOrder(trials: StroopStimulus[]) {
  const congruence = trials.map((trial) => trial.congruent);
  let run = 1;
  for (let i = 1; i < congruence.length; i += 1) {
    run = congruence[i] === congruence[i - 1] ? run + 1 : 1;
    if (run >= 3) return true;
  }
  const alternating = congruence.every(
    (value, index) => index === 0 || value !== congruence[index - 1],
  );
  if (alternating) return true;

  const inks = trials.map((trial) => trial.ink);
  const paired =
    inks.length === STROOP_COUNT &&
    inks[0] === inks[1] &&
    inks[2] === inks[3] &&
    inks[4] === inks[5];
  if (paired) return true;
  if (inks.slice(0, 3).join() === inks.slice(3).join()) return true;

  const positions = inks.map((ink) => STROOP_COLORS.indexOf(ink));
  const forward = positions.join() === "0,1,2,0,1,2";
  const backward = positions.join() === "2,1,0,2,1,0";
  return forward || backward;
}

/** True when the correct button sits on one side in a run, a flip-flop, or an uneven split. */
export function isPredictableCorrectSides(correctOnLeft: boolean[]) {
  if (correctOnLeft.filter(Boolean).length !== STROOP_COUNT / 2) return true;
  let run = 1;
  for (let i = 1; i < correctOnLeft.length; i += 1) {
    run = correctOnLeft[i] === correctOnLeft[i - 1] ? run + 1 : 1;
    if (run >= 3) return true;
  }
  const alternating = correctOnLeft.every(
    (side, index) => index === 0 || side !== correctOnLeft[index - 1],
  );
  if (alternating) return true;
  const flags = correctOnLeft.map((side) => (side ? "L" : "R"));
  return flags.slice(0, 3).join("") === flags.slice(3).join("");
}

function otherOption(trial: StroopStimulus, random: () => number): InkColor {
  if (!trial.congruent) return trial.wordColor;
  const choices = otherColors(trial.ink);
  return choices[Math.floor(random() * choices.length)] ?? choices[0];
}

function withChoiceButtons(stimuli: StroopStimulus[], random: () => number): StroopTrial[] | null {
  const correctOnLeft = shuffle([true, true, true, false, false, false], random);
  if (isPredictableCorrectSides(correctOnLeft)) return null;
  return stimuli.map((trial, index) => {
    const alternate = otherOption(trial, random);
    const onLeft = correctOnLeft[index] ?? false;
    const options: [InkColor, InkColor] = onLeft ? [trial.ink, alternate] : [alternate, trial.ink];
    return { ...trial, options };
  });
}

export function buildStroopTrials(random: () => number = Math.random): StroopTrial[] {
  const congruent: StroopStimulus[] = STROOP_COLORS.map((color) => ({
    wordColor: color,
    ink: color,
    congruent: true,
  }));

  for (let attempt = 0; attempt < 48; attempt += 1) {
    const stimuli = shuffle([...congruent, ...buildIncongruent(random)], random);
    if (!isBalancedStroopSet(stimuli) || isPredictableStroopOrder(stimuli)) continue;
    const trials = withChoiceButtons(stimuli, random);
    if (trials) return trials;
  }
  return FALLBACK_TRIALS;
}

export function randomForeperiodMs(random: () => number = Math.random) {
  const span = FOREPERIOD_MAX_MS - FOREPERIOD_MIN_MS + 1;
  return FOREPERIOD_MIN_MS + Math.floor(random() * span);
}

/** Milliseconds after the green frame is stamped. Null until that stamp exists. */
export function reactionLatencyMs(goAt: number | null, now: number) {
  if (goAt === null) return null;
  return Math.round(now - goAt);
}

/**
 * Interference is the gap between condition means, so extra trials do not inflate it.
 * Accuracy is correct answers divided by the trials actually taken.
 * Both condition groups must exist; an empty side would turn the gap into a raw mean.
 */
export function scoreStroop(results: StroopScoreInput[]) {
  const congruent = results.filter((item) => item.congruent).map((item) => item.latencyMs);
  const incongruent = results.filter((item) => !item.congruent).map((item) => item.latencyMs);
  if (results.length === 0 || congruent.length === 0 || incongruent.length === 0) return null;
  return {
    interferenceMs: Math.round(mean(incongruent) - mean(congruent)),
    accuracyPct: Math.round(
      (results.filter((item) => item.correct).length / results.length) * 100,
    ),
  };
}
