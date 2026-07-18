/**
 * Scoring model types — explainable, evidence-based, Sybil-resistant.
 *
 * Design principles (mandated):
 *  - No hardcoded scores. Every component is computed from verified facts.
 *  - Owning/transferring USDC alone never fills any component.
 *  - No normalization that pushes everyone toward 100.
 *  - If data for a component cannot be obtained, it is marked "not_assessed"
 *    and shown as "Data unavailable" — never invented.
 *  - The total is Σ component score / Σ component max, expressed /100.
 */

export type ComponentStatus = "scored" | "not_assessed" | "insufficient_data";

export type ScoreComponent = {
  id: string;
  label: string;
  /** Points earned (0..maxScore). */
  score: number;
  /** Maximum points for this component. */
  maxScore: number;
  status: ComponentStatus;
  /** Human-readable explanation of how the score was derived. */
  detail: string;
  /** Supporting evidence lines (counts, ranges). */
  evidence: string[];
  /** True when the component could not be computed (API unavailable etc.). */
  dataUnavailable?: boolean;
};

export type SybilSignal = {
  id: string;
  label: string;
  detected: boolean;
  severity: "low" | "medium" | "high";
  detail: string;
  metric: number;
};

export type ChainAnalysisStatus = {
  chainId: number;
  chainName: string;
  status: "analyzed" | "skipped" | "not_assessed" | "rpc_failure" | "api_unavailable";
  reason: string;
  txCount: number;
  tokenTxCount: number;
  apiUsed: string | null;
  latencyMs: number | null;
  fetchedAt: number | null;
  freshnessNote: string | null;
};

export type ConfidenceLevel = "Low" | "Moderate" | "High";

export type FootprintReport = {
  address: string;
  /**
   * Composite score, 0..100, computed ONLY over components whose data was
   * actually available (status "scored" or "insufficient_data"). Components
   * marked "not_assessed" are EXCLUDED from the denominator — missing data
   * never silently penalizes the wallet. This number is a PARTIAL ESTIMATE
   * whenever coverage < 100% and must not be read as a reputation score.
   */
  totalScore: number;
  /** Breakdown of every component with score/max. */
  components: ScoreComponent[];
  /** Independent Sybil/spam signals. */
  sybilSignals: SybilSignal[];
  /** Global Sybil flag — when true, total is capped and labelled. */
  sybilFlagged: boolean;
  confidence: ConfidenceLevel;
  /**
   * True when not all supported networks were analyzed. The totalScore is
   * then explicitly a partial estimate, not a complete assessment.
   */
  partialEstimate: boolean;
  /** Fraction of supported networks actually analyzed (0..1). */
  coverageFraction: number;
  /** Number of components that could be measured (excludes not_assessed). */
  measurableComponents: number;
  /** Number of components that could NOT be measured (not_assessed). */
  unavailableComponents: number;
  /** Per-network analysis status (multi-chain transparency). */
  chainStatus: ChainAnalysisStatus[];
  /** Aggregate facts used (for the UI summary). */
  facts: {
    networksUsed: number;
    totalNetworksSupported: number;
    analyzedChains: number;
    usdcTransfersObserved: number;
    usdcVolumeUsdObserved: number;
    activeMonths: number;
    walletAgeMonths: number;
    cctpEventsVerified: number;
    protocolsInteracted: number;
    uniqueContracts: number;
  };
  /** User-facing narrative blocks. */
  summary: string;
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
  /** When the report was produced. */
  generatedAt: number;
  /** Registry version used. */
  registryVersion: string;
};
