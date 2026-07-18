import { NextResponse } from "next/server";
import { normalizeAddress } from "@/lib/validation";
import { collectMultiChain } from "@/lib/collect";
import { scoreWallet } from "@/lib/scoring/score";
import type { FootprintReport } from "@/lib/scoring/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/analyze — Body: { address } -> explainable multi-chain footprint. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const address = (body as { address?: unknown })?.address;
  if (typeof address !== "string" || address.trim().length === 0) {
    return NextResponse.json({ error: "Missing wallet address." }, { status: 400 });
  }

  let normalized;
  try {
    normalized = normalizeAddress(address.trim());
  } catch {
    return NextResponse.json({ error: "Invalid EVM wallet address." }, { status: 400 });
  }

  try {
    const facts = await collectMultiChain(normalized);
    const report: FootprintReport = scoreWallet(facts);
    return NextResponse.json(report, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Analysis failed. One or more supported-chain sources may be unavailable.",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 502 },
    );
  }
}
