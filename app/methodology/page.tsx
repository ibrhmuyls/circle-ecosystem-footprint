import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MethodologyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Methodology</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This page explains what Circle Ecosystem Footprint can observe, what it cannot, and how it derives its
        composite footprint score. The score represents <strong>observed public on-chain participation</strong> — not
        identity, wealth, eligibility, or any official qualification.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>What this tool observes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Public transaction and token-transfer events from onchain explorers across Circle-supported networks.</p>
          <p>USDC / stablecoin transfers, contract interactions, and cross-chain activity where readable from verified evidence.</p>
          <p>Time distribution, counterparty diversity, transaction quality, and execution outcomes.</p>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>What this tool cannot observe</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Off-chain product usage, API calls, or private account relationships.</p>
          <p>Identity, affiliation, KYC status, wealth, intent, creditworthiness, or compliance conclusions.</p>
          <p>Airdrop eligibility, allowlist status, rewards, or any official Circle / Arc qualification.</p>
          <p>Any chain whose API is unavailable (shown explicitly as &quot;Data unavailable&quot;, never as &quot;no activity&quot;).</p>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Scoring model — 14 independent components</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            The composite score is <code>Σ(score) / Σ(max) × 100</code>. No component fills from simply owning or
            transferring USDC. Volume uses logarithmic scaling so large holders do not automatically reach the maximum.
          </p>
          <ul className="list-disc pl-5">
            <li>Network Coverage (10) — how many Circle-supported chains show verified activity</li>
            <li>USDC Activity Volume (12) — log-scaled, whale-resistant</li>
            <li>Active Months (10) — distinct months with activity</li>
            <li>Wallet Age (6) — first-to-last activity span</li>
            <li>Holding Behavior (10) — net position + multi-month persistence, not raw transfers</li>
            <li>Protocol Diversity (10) — distinct contracts/protocols interacted with</li>
            <li>Contract Interaction Diversity (8)</li>
            <li>CCTP Usage (8) — verified bridge message events</li>
            <li>Cross-chain Activity (6)</li>
            <li>Transaction Quality (6) — success ratio</li>
            <li>Recent Activity (4) — last 90 days</li>
            <li>Consistency (6) — low month-to-month variance</li>
            <li>Sybil Resistance (8) — penalizes burst / repetitive / wash patterns</li>
            <li>Evidence Confidence (6) — share of supported chains actually analyzed</li>
          </ul>
          <p>
            <strong>Sybil resistance:</strong> wallets showing burst transactions (≥30/min), repetitive identical
            transfers (≥50%), wash round-trips (≥2), or single-counterparty concentration (≥90%) are flagged and the
            total score is capped at 35/100.
          </p>
          <p>
            <strong>Data unavailable:</strong> when a supported chain cannot be analyzed (e.g. missing API key), it is
            reported as &quot;Data unavailable&quot; and reduces Evidence Confidence — never invented as zero activity.
          </p>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Registry sources</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <ul className="list-disc pl-5">
            <li><Link className="underline" href="https://docs.arc.io/arc/references/contract-addresses.md">Arc contract addresses</Link></li>
            <li><Link className="underline" href="https://docs.arc.io/arc/references/evm-differences.md">Arc EVM differences</Link></li>
            <li><Link className="underline" href="https://developers.circle.com/cctp/references/contract-addresses">Circle CCTP contract addresses</Link></li>
            <li><Link className="underline" href="https://developers.circle.com/gateway/references/contract-addresses">Circle Gateway contract addresses</Link></li>
            <li><Link className="underline" href="https://developers.circle.com/">Circle developer docs</Link></li>
          </ul>
        </CardContent>
      </Card>

      <div className="mt-6">
        <Button asChild variant="outline">
          <Link href="/">Back to analysis</Link>
        </Button>
      </div>
    </div>
  );
}
