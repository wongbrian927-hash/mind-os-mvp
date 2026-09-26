import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateTierLevel } from "./calculateTier.ts";
import {
  FOREPERIOD_MAX_MS,
  FOREPERIOD_MIN_MS,
  STROOP_COUNT,
  buildStroopTrials,
  isBalancedStroopSet,
  isPredictableCorrectSides,
  isPredictableStroopOrder,
  randomForeperiodMs,
  reactionLatencyMs,
  scoreStroop,
  type StroopTrial,
} from "./focusSession.ts";

function mulberry32(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("color focus trials", () => {
  it("gives each color two answers and keeps both conditions", () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const trials = buildStroopTrials(mulberry32(seed));
      assert.equal(trials.length, STROOP_COUNT);
      assert.equal(isBalancedStroopSet(trials), true);
      assert.equal(isPredictableStroopOrder(trials), false);
      const perInk = { red: { congruent: 0, incongruent: 0 }, blue: { congruent: 0, incongruent: 0 }, green: { congruent: 0, incongruent: 0 } };
      for (const trial of trials) {
        perInk[trial.ink][trial.congruent ? "congruent" : "incongruent"] += 1;
      }
      for (const color of ["red", "blue", "green"] as const) {
        assert.equal(perInk[color].congruent, 1);
        assert.equal(perInk[color].incongruent, 1);
      }
      const correctOnLeft = trials.map((trial) => trial.options[0] === trial.ink);
      assert.equal(isPredictableCorrectSides(correctOnLeft), false);
      for (const trial of trials) {
        assert.equal(trial.options.length, 2);
        assert.equal(new Set(trial.options).size, 2);
        assert.equal(trial.options.includes(trial.ink), true);
        const alternate = trial.options.find((color) => color !== trial.ink);
        if (trial.congruent) {
          assert.notEqual(alternate, trial.ink);
        } else {
          assert.equal(alternate, trial.wordColor);
        }
      }
    }
  });

  it("keeps the word color as the other button when blue is printed in red", () => {
    let found = false;
    for (let seed = 1; seed <= 200 && !found; seed += 1) {
      const match = buildStroopTrials(mulberry32(seed)).find(
        (trial) => trial.wordColor === "blue" && trial.ink === "red",
      );
      if (!match) continue;
      found = true;
      assert.equal(match.congruent, false);
      assert.deepEqual([...match.options].sort(), ["blue", "red"]);
    }
    assert.equal(found, true);
  });

  it("flags button-order and condition patterns", () => {
    const cycle: StroopTrial[] = ["red", "blue", "green", "red", "blue", "green"].map((ink) => ({
      wordColor: ink as StroopTrial["ink"],
      ink: ink as StroopTrial["ink"],
      congruent: true,
      options: [ink as StroopTrial["ink"], "green"],
    }));
    assert.equal(isPredictableStroopOrder(cycle), true);

    const pairs: StroopTrial[] = ["red", "red", "blue", "blue", "green", "green"].map((ink, index) => ({
      wordColor: ink as StroopTrial["ink"],
      ink: ink as StroopTrial["ink"],
      congruent: index % 2 === 0,
      options: [ink as StroopTrial["ink"], "green"],
    }));
    assert.equal(isPredictableStroopOrder(pairs), true);
  });
});

describe("reaction foreperiod", () => {
  it("draws an inclusive 2–6 second wait and excludes it from the score", () => {
    assert.equal(randomForeperiodMs(() => 0), FOREPERIOD_MIN_MS);
    assert.equal(randomForeperiodMs(() => 0.999999), FOREPERIOD_MAX_MS);
    for (let seed = 1; seed <= 500; seed += 1) {
      const wait = randomForeperiodMs(mulberry32(seed));
      assert.ok(wait >= 2000 && wait <= 6000);
      assert.equal(Number.isInteger(wait), true);
    }

    const goAt = 10_000;
    assert.equal(reactionLatencyMs(null, goAt + 4000), null);
    assert.equal(reactionLatencyMs(goAt, goAt + 248), 248);
  });
});

describe("scoring", () => {
  it("keeps interference as a mean difference and accuracy as a percent of six", () => {
    const scored = scoreStroop([
      { congruent: true, latencyMs: 300, correct: true },
      { congruent: true, latencyMs: 300, correct: true },
      { congruent: true, latencyMs: 300, correct: true },
      { congruent: false, latencyMs: 380, correct: true },
      { congruent: false, latencyMs: 380, correct: true },
      { congruent: false, latencyMs: 380, correct: false },
    ]);
    assert.deepEqual(scored, { interferenceMs: 80, accuracyPct: 83 });
    assert.equal(scoreStroop([]), null);
    assert.equal(
      scoreStroop([{ congruent: true, latencyMs: 300, correct: true }]),
      null,
    );
  });

  it("leaves percent thresholds in place for the new accuracy steps", () => {
    const base = {
      latency: 200,
      interference: 0,
      lang: "en" as const,
      completedBreathingBeforeTest: false,
    };
    assert.equal(calculateTierLevel({ ...base, accuracy: 100 }), 1);
    assert.equal(calculateTierLevel({ ...base, accuracy: 83 }), 2);
    assert.equal(calculateTierLevel({ ...base, accuracy: 67 }), 4);
  });
});
