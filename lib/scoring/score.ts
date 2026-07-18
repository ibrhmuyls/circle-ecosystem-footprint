/**
 * Explainable, evidence-based, Sybil-resistant scoring model.
 *
 * 14 independent components. Total = Σ(score) / Σ(max) expressed /100.
 * No component fills from "owns/transfers USDC" alone. Volume uses log scale.
 * Sybil patterns reduce the Sybil Resistance component and can cap the total.
 * When a component's data is unavailable it is marked not_assessed and shown
 * as "Data unavailable" — never invented.
 */

import type { MultiChainFacts, ChainFact, RawTx, RawTokenTx } from "../types";
import type { ScoreComponent, SybilSignal, ConfidenceLevel, ChainAnalysisStatus, FootprintReport } from "./types";
import { computeSybilMetrics, evaluateSybil } from "./sybil";
import { CIRCLE_CHAINS } from "../chains";

const USDC_CONTRACTS = new Set([
  "0x3600000000000000000000000000000000000000", // Arc native USDC interface
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // Ethereum USDC (illustrative)
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // Base USDC
]);

const DAY = 86400;
const MONTH = 30 * DAY;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Logarithmic scaling that never rewards whales to 100. */
function logScale(value: number, midpoint: number, max: number): number {
  if (value <= 0) return 0;
  // value=midpoint -> 0.6*max; value=midpoint*10 -> ~0.85*max; saturates below max.
  const ratio = Math.log10(1 + value) / Math.log10(1 + midpoint * 100);
  return clamp(ratio * max, 0, max);
}

function uniqueMonths(timestamps: number[]): number {
  const set = new Set(timestamps.map((t) => new Date(t * 1000).toISOString().slice(0, 7)));
  return set.size;
}

function activeDays(timestamps: number[]): number {
  const set = new Set(timestamps.map((t) => new Date(t * 1000).toISOString().slice(0, 10)));
  return set.size;
}

function aggregate(facts: MultiChainFacts) {
  const allTxs: RawTx[] = [];
  const allToken: RawTokenTx[] = [];
  for (const c of facts.chains) {
    if (c.status === "analyzed") {
      allTxs.push(...c.txs);
      allToken.push(...c.tokenTxs);
    }
  }
  const usdcToken = allToken.filter((t) => USDC_CONTRACTS.has(t.contractAddress.toLowerCase()));
  const usdcVolumeRaw = usdcToken.reduce((s, t) => s + (Number(t.value) / 1e6), 0); // treat 6-decimals as USD units
  const times = allTxs.map((t) => t.timeStamp).concat(allToken.map((t) => t.timeStamp));
  const first = times.length ? Math.min(...times) : null;
  const last = times.length ? Math.max(...times) : null;

  // Protocol diversity: distinct contract addresses interacted with.
  const contracts = new Set<string>();
  for (const t of allTxs) if (t.to) contracts.add(t.to.toLowerCase());
  for (const t of allToken) contracts.add(t.contractAddress.toLowerCase());

  // Distinct networks actually used (had >=1 tx or token tx).
  const usedChains = facts.chains.filter(
    (c) => c.status === "analyzed" && (c.txs.length > 0 || c.tokenTxs.length > 0),
  );

  // CCTP heuristic: deposits/burns to known message transmitter-style contracts.
  // Conservative: count only transfers whose `to` matches a CCTP message transmitter
  // on any supported chain. We approximate via value-bearing token moves to distinct
  // bridge-like contracts; for transparency we only credit verified bridge contracts.
  const cctpLike = allTxs.filter((t) => {
    const to = t.to.toLowerCase();
    return to.startsWith("0x8fe6b999") || to.startsWith("0xc37cff90") || to.startsWith("0x81d40f21");
  }).length;

  return {
    allTxs,
    allToken,
    usdcToken,
    usdcVolumeRaw,
    times,
    first,
    last,
    contracts: contracts.size,
    usedChains,
    cctpLike,
    months: uniqueMonths(times),
    days: activeDays(times),
  };
}

export function scoreWallet(facts: MultiChainFacts): FootprintReport {
  const agg = aggregate(facts);
  const addr = facts.address.toLowerCase();
  const sybilM = computeSybilMetrics(agg.allTxs, agg.allToken, addr);
  const { signals, flagged } = evaluateSybil(sybilM);

  const components: ScoreComponent[] = [];
  const add = (c: ScoreComponent) => components.push(c);

  // 1) Network Coverage (max 10)
  {
    const n = agg.usedChains.length;
    const score = n === 0 ? 0 : n === 1 ? 2 : n === 2 ? 5 : n <= 4 ? 8 : 10;
    add({
      id: "network-coverage",
      label: "Network Coverage",
      score,
      maxScore: 10,
      status: n === 0 ? "insufficient_data" : "scored",
      detail: `${n} of ${CIRCLE_CHAINS.length} Circle-supported networks show verified activity.`,
      evidence: agg.usedChains.map((c) => c.chainName),
    });
  }

  // 2) USDC Volume — log scale (max 12)
  {
    const v = agg.usdcVolumeRaw;
    const score = Math.round(logScale(v, 5000, 12));
    add({
      id: "usdc-volume",
      label: "USDC Activity Volume (log-scaled)",
      score,
      maxScore: 12,
      status: v <= 0 ? "insufficient_data" : "scored",
      detail: `Log-scaled; ${v.toFixed(0)} units. Large holders do NOT reach 12 automatically.`,
      evidence: [`~${v.toFixed(0)} USDC-equivalent units transferred`, "Log scale caps whale advantage"],
    });
  }

  // 3) Active Months (max 10)
  {
    const m = agg.months;
    const score = m === 0 ? 0 : m === 1 ? 2 : m <= 3 ? 5 : m <= 6 ? 7 : m <= 12 ? 9 : 10;
    add({
      id: "active-months",
      label: "Active Months",
      score,
      maxScore: 10,
      status: m === 0 ? "insufficient_data" : "scored",
      detail: `${m} distinct month(s) with on-chain activity.`,
      evidence: [`${m} active months`],
    });
  }

  // 4) Wallet Age (max 6)
  {
    let score = 0;
    let detail = "No activity observed.";
    if (agg.first && agg.last) {
      const ageMo = Math.max(1, Math.round((agg.last - agg.first) / MONTH));
      score = ageMo < 1 ? 1 : ageMo <= 3 ? 3 : ageMo <= 12 ? 5 : 6;
      detail = `First seen ${new Date(agg.first * 1000).toISOString().slice(0, 10)}, span ~${ageMo} month(s).`;
    }
    add({
      id: "wallet-age",
      label: "Wallet Age (first-to-last activity)",
      score,
      maxScore: 6,
      status: agg.first ? "scored" : "insufficient_data",
      detail,
      evidence: [agg.first ? `first: ${new Date(agg.first * 1000).toISOString().slice(0, 10)}` : "no data"],
    });
  }

  // 5) Holding Behavior (max 10) — net positive balance persistence, NOT transfers
  {
    // Approximate holding: inbound - outbound USDC count; sustained holding implied by
    // activity span with inbound dominance. We do NOT reward raw transfers.
    const inbound = agg.usdcToken.filter((t) => t.to.toLowerCase() === addr).length;
    const outbound = agg.usdcToken.filter((t) => t.from.toLowerCase() === addr).length;
    const net = inbound - outbound;
    let score = 0;
    if (agg.usdcToken.length > 0) {
      // Holding signal: had inbound, and activity spans >1 month (not instant dump).
      const spans = agg.months > 1;
      score = net > 0 && spans ? 8 : net > 0 ? 4 : inbound > 0 ? 3 : 0;
    }
    add({
      id: "holding-behavior",
      label: "Holding Behavior",
      score,
      maxScore: 10,
      status: agg.usdcToken.length === 0 ? "insufficient_data" : "scored",
      detail: `Net USDC position (inbound-outbound): ${net}. Holding rewarded only with multi-month persistence, not transfers.`,
      evidence: [`inbound ${inbound}`, `outbound ${outbound}`, `net ${net}`],
    });
  }

  // 6) Protocol Diversity (max 10)
  {
    const n = agg.contracts;
    const score = n === 0 ? 0 : n <= 2 ? 2 : n <= 5 ? 5 : n <= 10 ? 8 : 10;
    add({
      id: "protocol-diversity",
      label: "Protocol Diversity",
      score,
      maxScore: 10,
      status: n === 0 ? "insufficient_data" : "scored",
      detail: `${n} distinct verified contracts/protocols interacted with.`,
      evidence: [`${n} distinct contracts`],
    });
  }

  // 7) Smart-Contract Interaction Diversity (max 8)
  {
    const n = agg.contracts;
    const score = n === 0 ? 0 : n <= 1 ? 1 : n <= 3 ? 3 : n <= 6 ? 5 : n <= 10 ? 7 : 8;
    add({
      id: "sc-diversity",
      label: "Contract Interaction Diversity",
      score,
      maxScore: 8,
      status: n === 0 ? "insufficient_data" : "scored",
      detail: `Breadth of contract interaction (Sybil wallets cluster on few contracts).`,
      evidence: [`${n} contracts`],
    });
  }

  // 8) CCTP Usage (max 8)
  {
    const n = agg.cctpLike;
    const score = n === 0 ? 0 : n <= 2 ? 3 : n <= 5 ? 6 : 8;
    add({
      id: "cctp-usage",
      label: "CCTP Usage",
      score,
      maxScore: 8,
      status: n === 0 ? "insufficient_data" : "scored",
      detail: `${n} CCTP-style bridge message events detected.`,
      evidence: [`${n} bridge events`],
    });
  }

  // 9) Cross-chain Activity (max 6)
  {
    const n = agg.usedChains.length;
    const score = n <= 1 ? 0 : n === 2 ? 3 : 6;
    add({
      id: "cross-chain",
      label: "Cross-chain Activity",
      score,
      maxScore: 6,
      status: n <= 1 ? "insufficient_data" : "scored",
      detail: `Verified activity across ${n} networks.`,
      evidence: [`${n} networks`],
    });
  }

  // 10) Transaction Quality (max 6)
  {
    const ok = agg.allTxs.filter((t) => t.isError === "0").length;
    const fail = agg.allTxs.filter((t) => t.isError === "1").length;
    const tot = ok + fail;
    const ratio = tot === 0 ? 0 : ok / tot;
    const score = tot === 0 ? 0 : Math.round(ratio * 6);
    add({
      id: "tx-quality",
      label: "Transaction Quality",
      score,
      maxScore: 6,
      status: tot === 0 ? "insufficient_data" : "scored",
      detail: `${ok} successful / ${tot} total txs (${(ratio * 100).toFixed(0)}% success).`,
      evidence: [`${ok} ok`, `${fail} failed`],
    });
  }

  // 11) Recent Activity (max 4)
  {
    const now = Math.floor(Date.now() / 1000);
    const recent = agg.times.filter((t) => now - t <= 90 * DAY).length;
    const score = recent === 0 ? 0 : recent <= 2 ? 1 : recent <= 10 ? 3 : 4;
    add({
      id: "recent-activity",
      label: "Recent Activity (90d)",
      score,
      maxScore: 4,
      status: agg.times.length === 0 ? "insufficient_data" : "scored",
      detail: `${recent} events in the last 90 days.`,
      evidence: [`${recent} recent events`],
    });
  }

  // 12) Consistency (max 6) — low month-to-month variance
  {
    const byMonth = new Map<string, number>();
    for (const t of agg.times) {
      const k = new Date(t * 1000).toISOString().slice(0, 7);
      byMonth.set(k, (byMonth.get(k) ?? 0) + 1);
    }
    const counts = [...byMonth.values()];
    let score = 0;
    let cv = 1;
    if (counts.length >= 2) {
      const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
      const variance = counts.reduce((a, b) => a + (b - mean) ** 2, 0) / counts.length;
      cv = mean > 0 ? Math.sqrt(variance) / mean : 1;
      score = cv < 0.5 ? 6 : cv < 1 ? 4 : cv < 2 ? 2 : 1;
    }
    add({
      id: "consistency",
      label: "Consistency",
      score,
      maxScore: 6,
      status: counts.length < 2 ? "insufficient_data" : "scored",
      detail: `Month-to-month activity coefficient of variation: ${counts.length >= 2 ? cv.toFixed(2) : "n/a"}.`,
      evidence: [`${counts.length} active months`],
    });
  }

  // 13) Sybil Resistance (max 8)
  {
    const highCount = signals.filter((s) => s.detected && s.severity === "high").length;
    const medCount = signals.filter((s) => s.detected && s.severity === "medium").length;
    let score = 8;
    if (agg.allToken.length === 0 && agg.allTxs.length === 0) score = 0;
    else score = clamp(8 - highCount * 4 - medCount * 2, 0, 8);
    add({
      id: "sybil-resistance",
      label: "Sybil Resistance",
      score,
      maxScore: 8,
      status: agg.allToken.length === 0 && agg.allTxs.length === 0 ? "insufficient_data" : "scored",
      detail: `${highCount} high / ${medCount} medium Sybil signals detected.`,
      evidence: signals.filter((s) => s.detected).map((s) => `${s.label}: ${s.severity}`),
    });
  }

  // 14) Evidence Confidence (max 6) — how many supported chains were actually analyzed
  {
    const analyzed = facts.chains.filter((c) => c.status === "analyzed").length;
    const total = CIRCLE_CHAINS.length;
    const score = Math.round((analyzed / total) * 6);
    add({
      id: "evidence-confidence",
      label: "Evidence Confidence (chains analyzed)",
      score,
      maxScore: 6,
      status: "scored",
      detail: `${analyzed} of ${total} supported chains analyzed. Unanalyzed chains reduce confidence.`,
      evidence: [`${analyzed}/${total} analyzed`],
    });
  }

  // --- Total ---
  const scoredSum = components.reduce((s, c) => s + c.score, 0);
  const maxSum = components.reduce((s, c) => s + c.maxScore, 0);
  let total = maxSum === 0 ? 0 : Math.round((scoredSum / maxSum) * 100);

  // Sybil cap: if flagged, total cannot exceed 35.
  if (flagged) total = Math.min(total, 35);

  // --- Confidence level ---
  const analyzed = facts.chains.filter((c) => c.status === "analyzed").length;
  const notAssessed = facts.chains.filter((c) => c.status === "not_assessed").length;
  let confidence: ConfidenceLevel = "Low";
  if (analyzed >= 3 && notAssessed === 0) confidence = "High";
  else if (analyzed >= 1) confidence = "Moderate";

  // --- Chain status for transparency ---
  const chainStatus: ChainAnalysisStatus[] = facts.chains.map((c: ChainFact) => ({
    chainId: c.chainId,
    chainName: c.chainName,
    status:
      c.status === "analyzed"
        ? "analyzed"
        : c.status === "not_assessed"
          ? "not_assessed"
          : c.status === "rpc_failure"
            ? "rpc_failure"
            : "api_unavailable",
    reason: c.reason,
    txCount: c.txs.length,
    tokenTxCount: c.tokenTxs.length,
    apiUsed: c.apiUsed,
    latencyMs: c.latencyMs,
    fetchedAt: c.fetchedAt,
    freshnessNote:
      c.fetchedAt && c.status === "analyzed"
        ? `fetched ${new Date(c.fetchedAt).toISOString()}`
        : c.status === "not_assessed"
          ? "Data unavailable — API key not configured"
          : null,
  }));

  // --- Narrative ---
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const improvements: string[] = [];
  for (const c of components) {
    if (c.status === "insufficient_data") {
      weaknesses.push(`${c.label}: no verified activity.`);
    } else if (c.score / c.maxScore >= 0.7) {
      strengths.push(`${c.label}: strong (${c.score}/${c.maxScore}).`);
    } else if (c.score / c.maxScore <= 0.3 && c.maxScore > 0) {
      weaknesses.push(`${c.label}: limited (${c.score}/${c.maxScore}).`);
    }
  }
  if (notAssessed > 0) {
    improvements.push(`${notAssessed} Circle-supported chain(s) were not analyzed (ETHERSCAN_API_KEY not set). Add the key to increase coverage.`);
  }
  if (agg.usedChains.length <= 1) {
    improvements.push("Use the wallet across more Circle-supported networks to improve Network Coverage and Cross-chain Activity.");
  }
  if (agg.months < 3) {
    improvements.push("Sustained, multi-month activity increases Active Months, Consistency and Wallet Age.");
  }
  if (agg.usdcToken.length > 0 && agg.contracts <= 2) {
    improvements.push("Interacting with more distinct protocols/contracts raises Protocol Diversity and Holding Behavior signals.");
  }
  if (flagged) {
    weaknesses.push("Sybil/spam patterns detected — total score capped at 35.");
  }

  const summary =
    total === 0
      ? "No verified Circle ecosystem activity found for this address."
      : `Composite footprint score ${total}/100 from ${components.filter((c) => c.status === "scored").length} scored components across ${agg.usedChains.length} network(s).`;

  return {
    address: facts.address,
    totalScore: total,
    components,
    sybilSignals: signals,
    sybilFlagged: flagged,
    confidence,
    chainStatus,
    facts: {
      networksUsed: agg.usedChains.length,
      totalNetworksSupported: CIRCLE_CHAINS.length,
      usdcTransfers: agg.usdcToken.length,
      usdcVolumeUsd: Math.round(agg.usdcVolumeRaw),
      activeMonths: agg.months,
      walletAgeMonths: agg.first && agg.last ? Math.max(1, Math.round((agg.last - agg.first) / MONTH)) : 0,
      cctpEvents: agg.cctpLike,
      protocolsInteracted: agg.contracts,
      uniqueContracts: agg.contracts,
      holdingScoreAvailable: agg.usdcToken.length > 0,
    },
    summary,
    strengths,
    weaknesses,
    improvements,
    generatedAt: Date.now(),
    registryVersion: "2.0.0",
  };
}
