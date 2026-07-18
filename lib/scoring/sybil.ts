/**
 * Sybil / spam detection. Pure functions over aggregated transactions.
 * No hardcoded scores — every signal is a measured metric.
 */

import type { RawTx, RawTokenTx } from "../types";
import type { SybilSignal } from "./types";

const MINUTE = 60;

export type SybilMetrics = {
  burstTxPerMinute: number;
  repetitiveTransferRatio: number;
  washTransferCount: number;
  dominantCounterpartyShare: number;
  identicalValueRatio: number;
  totalTx: number;
};

export function computeSybilMetrics(txs: RawTx[], tokenTxs: RawTokenTx[], address: string): SybilMetrics {
  const all = [...txs, ...tokenTxs];
  const total = all.length;
  if (total === 0) {
    return {
      burstTxPerMinute: 0,
      repetitiveTransferRatio: 0,
      washTransferCount: 0,
      dominantCounterpartyShare: 0,
      identicalValueRatio: 0,
      totalTx: 0,
    };
  }

  // Burst: max transactions within any 60s window.
  const times = all.map((t) => t.timeStamp).sort((a, b) => a - b);
  let burst = 0;
  let left = 0;
  for (let right = 0; right < times.length; right++) {
    while (times[right] - times[left] > MINUTE) left++;
    burst = Math.max(burst, right - left + 1);
  }

  // Repetitive identical transfers: same counterparty + same value hash repeated.
  const tokenKeyCount = new Map<string, number>();
  for (const t of tokenTxs) {
    const key = `${t.to.toLowerCase()}|${t.value}`;
    tokenKeyCount.set(key, (tokenKeyCount.get(key) ?? 0) + 1);
  }
  let repetitive = 0;
  for (const c of tokenKeyCount.values()) if (c >= 3) repetitive += c;
  const repetitiveTransferRatio = repetitive / Math.max(1, tokenTxs.length);

  // Wash: A->B->A pattern with same value on token transfers (round-trip).
  const sorted = [...tokenTxs].sort((a, b) => a.timeStamp - b.timeStamp);
  let wash = 0;
  for (let i = 0; i + 1 < sorted.length; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const me = address.toLowerCase();
    if (
      a.value === b.value &&
      a.to.toLowerCase() === me &&
      b.from.toLowerCase() === me &&
      a.from.toLowerCase() === b.to.toLowerCase()
    ) {
      wash++;
    }
  }

  // Dominant counterparty share.
  const me = address.toLowerCase();
  const cp = new Map<string, number>();
  for (const t of tokenTxs) {
    const other = t.from.toLowerCase() === me ? t.to.toLowerCase() : t.from.toLowerCase();
    cp.set(other, (cp.get(other) ?? 0) + 1);
  }
  let maxCp = 0;
  for (const c of cp.values()) maxCp = Math.max(maxCp, c);
  const dominantCounterpartyShare = maxCp / Math.max(1, tokenTxs.length);

  // Identical value ratio (all token transfers).
  const valCount = new Map<string, number>();
  for (const t of tokenTxs) valCount.set(t.value, (valCount.get(t.value) ?? 0) + 1);
  let identical = 0;
  for (const c of valCount.values()) if (c >= 2) identical += c;
  const identicalValueRatio = identical / Math.max(1, tokenTxs.length);

  return {
    burstTxPerMinute: burst,
    repetitiveTransferRatio,
    washTransferCount: wash,
    dominantCounterpartyShare,
    identicalValueRatio,
    totalTx: total,
  };
}

export function evaluateSybil(m: SybilMetrics): { signals: SybilSignal[]; flagged: boolean } {
  const signals: SybilSignal[] = [];

  const burst = m.burstTxPerMinute;
  signals.push({
    id: "burst",
    label: "Transaction burst",
    detected: burst >= 30,
    severity: burst >= 100 ? "high" : burst >= 30 ? "medium" : "low",
    detail: `Max ${burst} transactions within a 60-second window.`,
    metric: burst,
  });

  const rep = m.repetitiveTransferRatio;
  signals.push({
    id: "repetitive",
    label: "Repetitive identical transfers",
    detected: rep >= 0.5,
    severity: rep >= 0.8 ? "high" : rep >= 0.5 ? "medium" : "low",
    detail: `${(rep * 100).toFixed(0)}% of token transfers are repeated identical counterparty+value pairs.`,
    metric: Number(rep.toFixed(2)),
  });

  const wash = m.washTransferCount;
  signals.push({
    id: "wash",
    label: "Wash / round-trip transfers",
    detected: wash >= 2,
    severity: wash >= 10 ? "high" : wash >= 2 ? "medium" : "low",
    detail: `${wash} detected A→B→A round-trip transfers of equal value.`,
    metric: wash,
  });

  const dom = m.dominantCounterpartyShare;
  signals.push({
    id: "dominant",
    label: "Single-counterparty concentration",
    detected: dom >= 0.9,
    severity: dom >= 0.97 ? "high" : dom >= 0.9 ? "medium" : "low",
    detail: `One counterparty accounts for ${(dom * 100).toFixed(0)}% of token transfers.`,
    metric: Number(dom.toFixed(2)),
  });

  const flagged = signals.filter((s) => s.detected && (s.severity === "high" || (s.severity === "medium" && s.id !== "burst"))).length >= 2;
  return { signals, flagged };
}
