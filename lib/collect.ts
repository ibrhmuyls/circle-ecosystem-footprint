/**
 * Multi-chain facts collector.
 *
 * For each Circle-supported chain, fetches public transaction + token-transfer
 * history. Arc Testnet uses public Blockscout (no key). Other EVM chains use
 * Etherscan V2 only when ETHERSCAN_API_KEY is present; otherwise the chain is
 * reported as "not_assessed" — never as "no activity".
 */

import type { Address, MultiChainFacts, ChainFact, RawTx, RawTokenTx } from "./types";
import { CIRCLE_CHAINS, etherscanKeyPresent } from "./chains";
import { cached } from "./cache";

type BlockscoutTx = {
  hash: string;
  block_number: number;
  timestamp: string;
  from: { hash: string } | string;
  to: { hash: string } | string | null;
  input: string;
  gas_used: string;
  status: string;
};

type BlockscoutToken = {
  hash: string;
  block_number: number;
  timestamp: string;
  from: { hash: string };
  to: { hash: string };
  token: { address: string; symbol: string | null };
  total: { value: string };
};

function toUnix(v: string | number): number {
  if (typeof v === "number") return v;
  const n = Date.parse(v);
  return Number.isNaN(n) ? 0 : Math.floor(n / 1000);
}

function normAddr(a: { hash: string } | string | null): string {
  if (!a) return "";
  return typeof a === "string" ? a : a.hash;
}

async function fetchBlockscout(chain: { explorerBase: string }, address: string, endpoint: string) {
  const url = `${chain.explorerBase}/api/v2/addresses/${address}/${endpoint}`;
  const res = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
  if (!res.ok) throw new Error(`blockscout ${endpoint} ${res.status}`);
  return (await res.json()) as { items?: unknown[] };
}

async function collectArc(chainId: number, chainName: string, explorerBase: string, address: string): Promise<ChainFact> {
  const start = Date.now();
  try {
    const [txRes, tokRes] = await Promise.all([
      cached(`arc-tx-${chainId}-${address}`, 60, () => fetchBlockscout({ explorerBase }, address, "transactions")),
      cached(`arc-tok-${chainId}-${address}`, 60, () => fetchBlockscout({ explorerBase }, address, "token-transfers")),
    ]);
    const txs: RawTx[] = (txRes.items ?? []).slice(0, 10000).map((it) => {
      const t = it as BlockscoutTx;
      return {
        hash: t.hash,
        blockNumber: Number(t.block_number),
        timeStamp: toUnix(t.timestamp),
        from: normAddr(t.from),
        to: normAddr(t.to),
        input: t.input ?? "",
        gasUsed: Number(t.gas_used ?? 0),
        isError: t.status === "pending" ? "1" : "0",
      };
    });
    const tokenTxs: RawTokenTx[] = (tokRes.items ?? []).slice(0, 10000).map((it) => {
      const t = it as BlockscoutToken;
      return {
        hash: t.hash,
        blockNumber: Number(t.block_number),
        timeStamp: toUnix(t.timestamp),
        from: normAddr(t.from),
        to: normAddr(t.to),
        contractAddress: t.token?.address ?? "",
        tokenSymbol: t.token?.symbol ?? null,
        value: t.total?.value ?? "0",
      };
    });
    return {
      chainId,
      chainName,
      status: "analyzed",
      reason: "Blockscout public API",
      txs,
      tokenTxs,
      apiUsed: "Blockscout V2",
      latencyMs: Date.now() - start,
      fetchedAt: Date.now(),
    };
  } catch (err) {
    return {
      chainId,
      chainName,
      status: "rpc_failure",
      reason: err instanceof Error ? err.message : "blockscout failure",
      txs: [],
      tokenTxs: [],
      apiUsed: "Blockscout V2",
      latencyMs: Date.now() - start,
      fetchedAt: Date.now(),
    };
  }
}

async function collectEtherscan(chainId: number, chainName: string, apiBase: string, address: string, key: string): Promise<ChainFact> {
  const start = Date.now();
  try {
    const mk = (action: string, module: string) =>
      `${apiBase}?chainid=${chainId}&module=${module}&action=${action}&address=${address}&apikey=${key}`;
    const [txRes, tokRes] = await Promise.all([
      cached(`es-tx-${chainId}-${address}`, 60, async () => {
        const r = await fetch(mk("txlist", "account"));
        if (!r.ok) throw new Error(`etherscan txlist ${r.status}`);
        return (await r.json()) as { status: string; result: RawTx[] | string };
      }),
      cached(`es-tok-${chainId}-${address}`, 60, async () => {
        const r = await fetch(mk("tokentx", "account"));
        if (!r.ok) throw new Error(`etherscan tokentx ${r.status}`);
        return (await r.json()) as { status: string; result: RawTokenTx[] | string };
      }),
    ]);
    const txs: RawTx[] =
      txRes.status === "1" && Array.isArray(txRes.result)
        ? (txRes.result as RawTx[]).map((t) => ({ ...t, isError: (t.isError ?? "0") as "0" | "1" }))
        : [];
    const tokenTxs: RawTokenTx[] =
      tokRes.status === "1" && Array.isArray(tokRes.result) ? (tokRes.result as RawTokenTx[]) : [];
    return {
      chainId,
      chainName,
      status: "analyzed",
      reason: "Etherscan V2",
      txs,
      tokenTxs,
      apiUsed: "Etherscan V2",
      latencyMs: Date.now() - start,
      fetchedAt: Date.now(),
    };
  } catch (err) {
    return {
      chainId,
      chainName,
      status: "rpc_failure",
      reason: err instanceof Error ? err.message : "etherscan failure",
      txs: [],
      tokenTxs: [],
      apiUsed: "Etherscan V2",
      latencyMs: Date.now() - start,
      fetchedAt: Date.now(),
    };
  }
}

export async function collectMultiChain(address: Address): Promise<MultiChainFacts> {
  const key = process.env.ETHERSCAN_API_KEY ?? "";
  const results = await Promise.all(
    CIRCLE_CHAINS.map((chain) => {
      if (chain.source === "blockscout") {
        return collectArc(chain.chainId, chain.name, chain.explorerBase, address);
      }
      if (!key) {
        return Promise.resolve({
          chainId: chain.chainId,
          chainName: chain.name,
          status: "not_assessed" as const,
          reason: "ETHERSCAN_API_KEY not set — chain not analyzed",
          txs: [],
          tokenTxs: [],
          apiUsed: null,
          latencyMs: null,
          fetchedAt: null,
        });
      }
      return collectEtherscan(chain.chainId, chain.name, chain.etherscanBase!, address, key);
    }),
  );
  return { address, chains: results, fetchedAt: Date.now() };
}
