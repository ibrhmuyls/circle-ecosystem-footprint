/**
 * Circle-supported networks registry (data-source configuration only).
 *
 * Arc Testnet: public Blockscout, no API key required.
 * Other EVM chains: Etherscan V2 — requires ETHERSCAN_API_KEY.
 *   When the key is absent the chain is reported as "not_assessed" (never
 *   fabricated as "no activity").
 *
 * Note: addresses/contracts for scoring are taken from the official Circle
 * registry, not hardcoded here. This file only declares which networks exist
 * and how to reach their public explorers.
 */

export type ChainConfig = {
  id: string;
  name: string;
  chainId: number;
  /** Blockscout-style explorer base (V2 API). */
  explorerBase: string;
  /** Etherscan-style base (used when key present). */
  etherscanBase: string | null;
  /** How this chain is sourced. */
  source: "blockscout" | "etherscan";
  /** True when no API key is required. */
  publicByDefault: boolean;
};

export const CIRCLE_CHAINS: ChainConfig[] = [
  {
    id: "arc-testnet",
    name: "Arc Testnet",
    chainId: 5042002,
    explorerBase: "https://testnet.arcscan.app",
    etherscanBase: null,
    source: "blockscout",
    publicByDefault: true,
  },
  {
    id: "ethereum",
    name: "Ethereum",
    chainId: 1,
    explorerBase: "https://etherscan.io",
    etherscanBase: "https://api.etherscan.io/v2",
    source: "etherscan",
    publicByDefault: false,
  },
  {
    id: "base",
    name: "Base",
    chainId: 8453,
    explorerBase: "https://basescan.org",
    etherscanBase: "https://api.etherscan.io/v2",
    source: "etherscan",
    publicByDefault: false,
  },
  {
    id: "arbitrum",
    name: "Arbitrum",
    chainId: 42161,
    explorerBase: "https://arbiscan.io",
    etherscanBase: "https://api.etherscan.io/v2",
    source: "etherscan",
    publicByDefault: false,
  },
  {
    id: "optimism",
    name: "Optimism",
    chainId: 10,
    explorerBase: "https://optimistic.etherscan.io",
    etherscanBase: "https://api.etherscan.io/v2",
    source: "etherscan",
    publicByDefault: false,
  },
  {
    id: "polygon",
    name: "Polygon PoS",
    chainId: 137,
    explorerBase: "https://polygonscan.com",
    etherscanBase: "https://api.etherscan.io/v2",
    source: "etherscan",
    publicByDefault: false,
  },
  {
    id: "avalanche",
    name: "Avalanche",
    chainId: 43114,
    explorerBase: "https://snowtrace.io",
    etherscanBase: "https://api.etherscan.io/v2",
    source: "etherscan",
    publicByDefault: false,
  },
  {
    id: "unichain",
    name: "Unichain",
    chainId: 130,
    explorerBase: "https://uniscan.xyz",
    etherscanBase: "https://api.etherscan.io/v2",
    source: "etherscan",
    publicByDefault: false,
  },
  {
    id: "linea",
    name: "Linea",
    chainId: 59144,
    explorerBase: "https://lineascan.build",
    etherscanBase: "https://api.etherscan.io/v2",
    source: "etherscan",
    publicByDefault: false,
  },
  {
    id: "worldchain",
    name: "World Chain",
    chainId: 480,
    explorerBase: "https://worldscan.xyz",
    etherscanBase: "https://api.etherscan.io/v2",
    source: "etherscan",
    publicByDefault: false,
  },
];

export const ARC_CHAIN_ID = 5042002;

export function etherscanKeyPresent(): boolean {
  return !!process.env.ETHERSCAN_API_KEY && process.env.ETHERSCAN_API_KEY.length > 0;
}
