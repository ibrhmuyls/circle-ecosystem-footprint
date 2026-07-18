import { describe, it, expect } from "vitest";
import { scoreWallet } from "../score";
import { fewUsdc, heavyCrossChain, longTermHolder, inactive, spam } from "./fixtures";

describe("Scoring redesign — validation scenarios", () => {
  it("A wallet with only a few USDC transfers must NEVER reach 100 (or even 50)", () => {
    const r = scoreWallet(fewUsdc());
    expect(r.totalScore).toBeLessThan(50);
    expect(r.totalScore).toBeGreaterThanOrEqual(0);
    // USDC volume component must not fill from 2 transfers
    const vol = r.components.find((c) => c.id === "usdc-volume")!;
    expect(vol.score).toBeLessThan(vol.maxScore);
  });

  it("Heavy cross-chain user scores higher than few-USDC wallet", () => {
    const a = scoreWallet(fewUsdc()).totalScore;
    const b = scoreWallet(heavyCrossChain()).totalScore;
    expect(b).toBeGreaterThan(a);
    // cross-chain + network coverage should be strong for heavy user
    const xc = scoreWallet(heavyCrossChain()).components.find((c) => c.id === "cross-chain")!;
    expect(xc.score).toBeGreaterThan(0);
  });

  it("Long-term holder has strong Holding Behavior and Active Months", () => {
    const r = scoreWallet(longTermHolder());
    const holding = r.components.find((c) => c.id === "holding-behavior")!;
    const months = r.components.find((c) => c.id === "active-months")!;
    expect(holding.score).toBeGreaterThan(0);
    expect(months.score).toBeGreaterThan(3); // ~11 months
  });

  it("Inactive wallet scores 0 and reports data unavailable, not invented values", () => {
    const r = scoreWallet(inactive());
    expect(r.totalScore).toBe(0);
    expect(r.summary).toMatch(/No verified Circle ecosystem activity/i);
    const na = r.components.filter((c) => c.status === "not_assessed" || c.status === "insufficient_data");
    expect(na.length).toBeGreaterThan(0);
  });

  it("Spam wallet is Sybil-flagged and capped at 35", () => {
    const r = scoreWallet(spam());
    expect(r.sybilFlagged).toBe(true);
    expect(r.totalScore).toBeLessThanOrEqual(35);
    const burst = r.sybilSignals.find((s) => s.id === "burst")!;
    expect(burst.detected).toBe(true);
  });

  it("Scores are differentiated across archetypes", () => {
    const scores = [fewUsdc(), heavyCrossChain(), longTermHolder(), inactive(), spam()].map(
      (f) => scoreWallet(f).totalScore,
    );
    const distinct = new Set(scores);
    expect(distinct.size).toBeGreaterThan(3); // significantly different
  });

  it("Not-assessed chains reduce confidence and are never 'no activity'", () => {
    const r = scoreWallet(fewUsdc());
    expect(r.confidence).not.toBe("High"); // only Arc analyzed
    const notAssessed = r.chainStatus.filter((c) => c.status === "not_assessed");
    expect(notAssessed.length).toBeGreaterThan(0);
    expect(notAssessed.every((c) => c.freshnessNote?.includes("Data unavailable"))).toBe(true);
  });
});
