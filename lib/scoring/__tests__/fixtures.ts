import type { MultiChainFacts, ChainFact, RawTx, RawTokenTx, Address } from "../../types";
import { CIRCLE_CHAINS } from "../../chains";

export const ME = "0x1111111111111111111111111111111111111111" as Address;
export const OTHER = "0x2222222222222222222222222222222222222222" as Address;
export const ARC_USDC = "0x3600000000000000000000000000000000000000";

function chain(id: string, txs: RawTx[], tokenTxs: RawTokenTx[], status: ChainFact["status"] = "analyzed"): ChainFact {
  const cfg = CIRCLE_CHAINS.find((c) => c.id === id)!;
  return {
    chainId: cfg.chainId,
    chainName: cfg.name,
    status,
    reason: status === "analyzed" ? "test" : "test-not-assessed",
    txs,
    tokenTxs,
    apiUsed: status === "analyzed" ? "test" : null,
    latencyMs: 1,
    fetchedAt: Date.now(),
  };
}

function tx(from: string, to: string, ts: number, isError: "0" | "1" = "0"): RawTx {
  return { hash: `0x${Math.random().toString(16).slice(2,10)}`, blockNumber: 1, timeStamp: ts, from, to, input: "0x", gasUsed: 21000, isError };
}
function usdc(from: string, to: string, ts: number, value: string): RawTokenTx {
  return { hash: `0x${Math.random().toString(16).slice(2,10)}`, blockNumber: 1, timeStamp: ts, from, to, contractAddress: ARC_USDC, tokenSymbol: "USDC", value };
}

const NOW = Math.floor(Date.now() / 1000);
const MONTH = 30 * 86400;

/** Scenario A: only a few USDC transfers (must NOT score high). */
export function fewUsdc(): MultiChainFacts {
  return {
    address: ME,
    fetchedAt: NOW,
    chains: [
      chain("arc-testnet", [], [
        usdc(OTHER, ME, NOW - 10 * MONTH, "1000000"),
        usdc(ME, OTHER, NOW - 9 * MONTH, "500000"),
      ]),
      ...CIRCLE_CHAINS.filter((c) => c.id !== "arc-testnet").map((c) => chain(c.id, [], [], "not_assessed")),
    ],
  };
}

/** Scenario B: heavy cross-chain user (diverse counterparties, no Sybil pattern). */
export function heavyCrossChain(): MultiChainFacts {
  const mk = (id: string, monthsBack: number, n: number) => {
    const txs: RawTx[] = [];
    const toks: RawTokenTx[] = [];
    for (let i = 0; i < n; i++) {
      // distinct counterparty per tx to avoid dominant-counterparty false positive
      const cp = `0x${(i + 1).toString().padStart(40, "0")}`;
      txs.push(tx(ME, cp, NOW - monthsBack * MONTH - i * 3 * 86400));
      toks.push(usdc(cp, ME, NOW - monthsBack * MONTH - i * 3 * 86400, String(1000000 + i * 137))); // varied values
    }
    return chain(id, txs, toks);
  };
  return {
    address: ME,
    fetchedAt: NOW,
    chains: [
      mk("arc-testnet", 11, 8),
      mk("base", 10, 8),
      mk("arbitrum", 9, 8),
      mk("ethereum", 8, 8),
      ...CIRCLE_CHAINS.filter((c) => !["arc-testnet", "base", "arbitrum", "ethereum"].includes(c.id)).map((c) => chain(c.id, [], [], "not_assessed")),
    ],
  };
}

/** Scenario C: long-term holder (inbound USDC, varied amounts, holds across months). */
export function longTermHolder(): MultiChainFacts {
  const toks: RawTokenTx[] = [];
  for (let m = 11; m >= 1; m--) {
    // varied inbound amounts month to month (not identical repeats)
    toks.push(usdc(OTHER, ME, NOW - m * MONTH, String(1000000 + m * 917)));
    if (m % 4 === 0) toks.push(usdc(ME, OTHER, NOW - m * MONTH + 10 * 86400, "300000")); // occasional outbound, different value
  }
  return {
    address: ME,
    fetchedAt: NOW,
    chains: [
      chain("arc-testnet", [], toks),
      ...CIRCLE_CHAINS.filter((c) => c.id !== "arc-testnet").map((c) => chain(c.id, [], [], "not_assessed")),
    ],
  };
}

/** Scenario D: inactive wallet (no activity). */
export function inactive(): MultiChainFacts {
  return {
    address: ME,
    fetchedAt: NOW,
    chains: CIRCLE_CHAINS.map((c) => chain(c.id, [], [], "not_assessed")),
  };
}

/** Scenario E: spam / Sybil wallet (burst + repetitive identical transfers). */
export function spam(): MultiChainFacts {
  const toks: RawTokenTx[] = [];
  const base = NOW - 60;
  for (let i = 0; i < 400; i++) {
    toks.push(usdc(OTHER, ME, base + i, "1000000")); // identical value, same counterparty, within ~7 min
  }
  return {
    address: ME,
    fetchedAt: NOW,
    chains: [chain("arc-testnet", [], toks), ...CIRCLE_CHAINS.filter((c) => c.id !== "arc-testnet").map((c) => chain(c.id, [], [], "not_assessed"))],
  };
}
