# Circle Ecosystem Footprint

> Independent, read-only analysis of publicly observable activity across **Arc** and verifiable **Circle** infrastructure (CCTP, Gateway, USDC, EURC).

This tool answers one question with on-chain evidence:

> **What publicly verifiable evidence exists that this exact EVM address has used Circle and Arc on-chain infrastructure across supported networks?**

It does **not** determine airdrop eligibility, rewards, allowlists, account status, compliance status, identity, affiliation, wealth, or any official Circle / Arc qualification. It analyzes only publicly observable on-chain evidence associated with the supplied address.

## What it does

- **Multi-chain, registry-driven.** All network and contract claims derive from a versioned, source-linked registry (`lib/registry/`) built from official Circle and Arc documentation.
- **Live Arc indexing.** Arc Testnet is indexed via the public Blockscout API — no API key required.
- **Gated mainnet indexing.** Other EVM chains (Ethereum, Base, Arbitrum, Avalanche, OP, Polygon, Unichain, Linea, Sonic, World Chain) are indexed via Etherscan V2 **only when** `ETHERSCAN_API_KEY` is set. Without a key they are reported as *not assessed* — never as "no activity".
- **Conservative scoring with hard caps.** Four independent outputs: Ecosystem Activity (0–100), Arc Footprint (0–100 or "No verified Arc footprint observed"), Evidence Coverage (+ band), and Confidence (Low / Moderate / High).
- **Evidence-first.** Every claim links to a verified contract or transaction. Generic transfers, Arc gas, and common EVM tooling (Permit2 / Multicall3) are never turned into Circle claims.

## Networks & capabilities

| Network | chainId | Live indexing | Verifiable products |
| --- | --- | --- | --- |
| Arc Testnet | 5042002 | ✅ Blockscout (no key) | CCTP V2, Gateway, USDC (native gas), EURC, StableFX, Arc system contracts |
| Ethereum, Avalanche, OP, Arbitrum, Base, Polygon, Unichain, Linea, Sonic, World Chain | see registry | ⏳ Etherscan V2 (key-gated) | CCTP V2, Gateway, USDC, EURC |

### Not inferable from public wallet data
Circle Wallets APIs, Circle Payments Network, Circle Mint / off-chain payment APIs, Circle Compliance Engine, and Circle account/identity systems are explicitly out of scope.

## Quick start

```bash
npm install
# optional: enable mainnet indexing
cp .env.example .env.local   # then set ETHERSCAN_API_KEY
npm run dev
```

Analyze any address: `/analyze?address=0xYourAddress`

### Run checks

```bash
npm run typecheck   # tsc --noEmit
npm run test        # vitest run
npm run build       # next build
```

## Registry & sources

Registry version **2.0.0** (retrieved 2026-07-17). Official sources:

- CCTP contracts — https://developers.circle.com/cctp/references/contract-addresses
- CCTP chains/domains — https://developers.circle.com/cctp/concepts/supported-chains-and-domains
- Gateway contracts — https://developers.circle.com/gateway/references/contract-addresses
- Gateway chains — https://developers.circle.com/gateway/references/supported-blockchains
- USDC — https://developers.circle.com/stablecoins/usdc-contract-addresses
- EURC — https://developers.circle.com/stablecoins/eurc-contract-addresses
- Arc contracts — https://docs.arc.io/arc/references/contract-addresses
- Arc network config — https://docs.arc.io/arc/references/connect-to-arc

## Disclaimer

This is an independent analytics tool. It does not determine airdrop eligibility, rewards, allowlists, account status, compliance status, identity, affiliation, wealth, or any official Circle / Arc qualification. It analyzes only publicly observable on-chain evidence associated with the supplied address. Observed on-chain activity is not proof of identity, intent, eligibility, compliance, or wealth.

---

*Not affiliated with or endorsed by Circle Internet Financial or Arc Network. Uses only publicly documented on-chain data and official registry references.*
