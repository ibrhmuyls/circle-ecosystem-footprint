import Link from "next/link";
import { normalizeAddress } from "@/lib/validation";
import { collectMultiChain } from "@/lib/collect";
import { scoreWallet } from "@/lib/scoring/score";
import type { FootprintReport } from "@/lib/scoring/types";
import { ErrorState } from "@/components/ErrorState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

function Bar({ score, max }: { score: number; max: number }) {
  const pct = max === 0 ? 0 : Math.round((score / max) * 100);
  return (
    <div className="h-2 w-full overflow-hidden rounded bg-muted">
      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
    </div>
  );
}

function Section({ title, items, tone }: { title: string; items: string[]; tone: "good" | "bad" | "info" }) {
  if (items.length === 0) return null;
  const cls =
    tone === "good" ? "border-l-4 border-green-500" : tone === "bad" ? "border-l-4 border-red-500" : "border-l-4 border-blue-500";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className={`space-y-1 pl-3 text-sm ${cls}`}>
          {items.map((it, i) => (
            <li key={i} className="text-muted-foreground">{it}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function AnalysisDetails({ report }: { report: FootprintReport }) {
  const analyzed = report.chainStatus.filter((c) => c.status === "analyzed").length;
  const skipped = report.chainStatus.filter((c) => c.status !== "analyzed");
  return (
    <details className="rounded-md border bg-muted/30 p-4 text-sm">
      <summary className="cursor-pointer font-medium">Analysis details</summary>
      <div className="mt-3 space-y-3">
        <div>
          <p className="mb-1 font-medium text-foreground">Chains analyzed ({analyzed}/{report.chainStatus.length})</p>
          <ul className="space-y-1 pl-4">
            {report.chainStatus.filter((c) => c.status === "analyzed").map((c) => (
              <li key={c.chainId} className="text-muted-foreground">
                {c.chainName}: {c.txCount} tx, {c.tokenTxCount} token tx — {c.apiUsed} ({c.freshnessNote ?? "ok"})
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-1 font-medium text-foreground">Chains skipped / unavailable ({skipped.length})</p>
          <ul className="space-y-1 pl-4">
            {skipped.map((c) => (
              <li key={c.chainId} className="text-muted-foreground">
                {c.chainName}: {c.freshnessNote ?? c.reason} {c.status === "rpc_failure" ? `(RPC failure: ${c.reason})` : ""}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-1 font-medium text-foreground">APIs used</p>
          <p className="text-muted-foreground">
            {Array.from(new Set(report.chainStatus.map((c) => c.apiUsed).filter(Boolean))).join(", ") || "none"}
          </p>
        </div>
        <div>
          <p className="mb-1 font-medium text-foreground">Data freshness</p>
          <p className="text-muted-foreground">
            Generated {new Date(report.generatedAt).toLocaleString()} · Registry v{report.registryVersion}
          </p>
        </div>
      </div>
    </details>
  );
}

export default async function AnalyzePage({ searchParams }: { searchParams: Promise<{ address?: string }> }) {
  const params = await searchParams;
  const rawAddress = params.address;

  if (!rawAddress) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24">
        <Card>
          <CardHeader>
            <CardTitle>Circle Ecosystem Footprint</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Independent, read-only analysis of publicly observable activity across Arc and verifiable Circle infrastructure.
            </p>
            <form method="get" className="mt-4 flex gap-2">
              <input name="address" placeholder="Paste an EVM address" className="flex-1 rounded-md border bg-background px-3 py-2 text-sm" />
              <Button type="submit">Analyze</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  let address;
  try {
    address = normalizeAddress(rawAddress);
  } catch {
    return <ErrorState message="Invalid address format." onRetry={() => {}} />;
  }

  let report: FootprintReport | null = null;
  try {
    const facts = await collectMultiChain(address);
    report = scoreWallet(facts);
  } catch {
    return <ErrorState message="Analysis failed. Sources may be unavailable." onRetry={() => {}} />;
  }

  if (!report) return <ErrorState message="Unable to analyze this address." onRetry={() => {}} />;

  const sybil = report.sybilSignals.filter((s) => s.detected);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Circle Ecosystem Footprint</h1>
          <p className="mt-1 break-all font-mono text-sm text-muted-foreground">{report.address}</p>
        </div>
        <div className="text-left sm:text-right">
          <div className="text-3xl font-bold">{report.totalScore}/100</div>
          <div className="text-xs text-muted-foreground">Composite footprint score</div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Confidence</CardTitle></CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${report.confidence === "Low" ? "text-red-500" : report.confidence === "Moderate" ? "text-yellow-500" : "text-green-500"}`}>{report.confidence}</div>
            <p className="text-xs text-muted-foreground">{report.facts.networksUsed}/{report.facts.totalNetworksSupported} networks analyzed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Networks Used</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{report.facts.networksUsed}</div>
            <p className="text-xs text-muted-foreground">of {report.facts.totalNetworksSupported} supported</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">USDC Transfers</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{report.facts.usdcTransfers}</div>
            <p className="text-xs text-muted-foreground">~{report.facts.usdcVolumeUsd} units (log-scaled)</p>
          </CardContent>
        </Card>
      </div>

      {/* 1. Summary */}
      <Card className="mb-6">
        <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">{report.summary}</p></CardContent>
      </Card>

      {/* Sybil warning */}
      {report.sybilFlagged && (
        <div className="mb-6 rounded-md border border-red-500 bg-red-500/10 p-4 text-sm text-red-500">
          Sybil / spam patterns detected. Total score capped at 35. Signals: {sybil.map((s) => s.label).join(", ")}.
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Section title="Strengths" items={report.strengths} tone="good" />
        <Section title="Weaknesses" items={report.weaknesses} tone="bad" />
        <Section title="Improvement opportunities" items={report.improvements} tone="info" />
      </div>

      {/* 5. Detailed scoring */}
      <Card className="mb-6">
        <CardHeader><CardTitle>Detailed scoring</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {report.components.map((c) => (
            <div key={c.id}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{c.label}</span>
                <span className="font-mono text-muted-foreground">
                  {c.status === "not_assessed" || c.status === "insufficient_data" ? "Data unavailable" : `${c.score}/${c.maxScore}`}
                </span>
              </div>
              <Bar score={c.score} max={c.maxScore} />
              <p className="mt-1 text-xs text-muted-foreground">{c.detail}</p>
            </div>
          ))}
          <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm font-semibold">
            <span>TOTAL</span>
            <span className="font-mono">{report.totalScore}/100</span>
          </div>
        </CardContent>
      </Card>

      <div className="mb-6">
        <AnalysisDetails report={report} />
      </div>

      <div className="mb-6 rounded-md border bg-muted/40 p-4 text-xs text-muted-foreground">
        <p className="mb-1 font-medium text-foreground">Disclaimer</p>
        <p>
          This is an independent analytics tool. It does not determine airdrop eligibility, rewards, allowlists, account status,
          compliance status, identity, affiliation, wealth, or any official Circle / Arc qualification. It analyzes only publicly
          observable on-chain evidence associated with the supplied address. Observed on-chain activity is not proof of identity,
          intent, eligibility, compliance, or wealth.
        </p>
      </div>

      <form method="get" className="mt-8">
        <input type="hidden" name="address" value={report.address} />
        <Button type="submit" variant="outline">Refresh analysis</Button>
      </form>
    </div>
  );
}
