# Quiet Till

Private revenue settlement for onchain lending.

Quiet Till lets a merchant repay from encrypted daily sales: lenders get paid, auditors can verify, and public observers cannot read the register.

## What It Is

Quiet Till is a SKALE Programmable Privacy demo for revenue-based financing.

A merchant reports daily sales through an encrypted transaction. The settlement contract calculates repayment from those sales and updates the loan state without publishing the merchant's register to the market.

## Why It Matters

Revenue-based lending needs sales data. Public blockchains make that data visible by default, which can leak commercial intelligence to competitors, suppliers, and rival lenders.

Quiet Till keeps the sensitive business signal private while preserving verifiable settlement.

## Core Demo

1. A merchant has an active revenue-based loan.
2. A POS agent submits an encrypted daily sales report.
3. The settlement window closes.
4. The contract computes repayment from the encrypted report.
5. The lender receives settlement evidence.
6. An authorized auditor can inspect the details.
7. Public observers see settlement status, not daily sales.

## Built For

SKALE Programmable Privacy Hackathon.

## Status

Early hackathon MVP with the first contract layer in place.

## Current Contract Surface

- `MerchantRegistry`: registers merchants, POS agents, and auditors.
- `RevenueLoan`: stores revenue-based loan terms, applies capped daily repayments, and keeps exact outstanding snapshots behind participant-only ABI reads.
- `AuditorDisclosure`: records private receipt metadata for authorized auditors.
- `DailySettlementWindow`: stores encrypted report payloads, requests settlement, accepts an authorized decrypt callback, and rejects outlier sales reports above an admin-configured gross sales limit.
- `MockPaymentToken`: provides a public ERC20-style fallback token for local demos.
- `SettlementVault`: moves fallback token repayments from borrower to lender when settlement completes.
- `PublicModeSimulator`: publishes sales and competitor signals for the public-mode comparison.

The current settlement tests use encoded plaintext to simulate the post-decryption callback. The next integration step is wiring SKALE BITE/CTX so the encrypted report path is backed by the live privacy primitive instead of a test callback.

Decrypt failures can now be marked by the authorized callback without revealing sales data. Failed days keep the encrypted report hash and can be retried through a new settlement request.

The fallback token payment is intentionally public. It is useful for demonstrating repayment movement while confidential tokens remain a separate integration target.

## Development

Install dependencies:

```bash
npm install
```

Compile contracts:

```bash
npm run build
```

Run tests:

```bash
npm test
```

Run the local web demo console:

```bash
npm run web:dev
```

Build the web demo console:

```bash
npm run web:build
```

Build a deterministic local demo manifest:

```bash
npm run demo:manifest
```

Print the deterministic public-vs-private demo transcript:

```bash
npm run demo:transcript
```

Run a full in-memory local demo:

```bash
npm run demo:local
```

Check the manifest against compiled artifacts and expected repayment math:

```bash
npm run demo:check
```

Run the full local quality gate:

```bash
npm run verify
```

The demo manifest describes contract constructor arguments, setup calls, the encoded sales report payload, and the expected repayment result for "La Barra". It is deterministic input for scripts and UI work; it is not production encrypted data.

The transcript turns that manifest into the core demo story: public mode leaks gross sales and a competitor signal, while private mode exposes only status and hashes to the market and keeps the revenue details for the auditor path.

`npm run demo:local` deploys the contracts on an in-memory Hardhat network, seeds "La Barra", publishes the intentionally leaky public-mode report, submits the encrypted private report, requests settlement, simulates the authorized decrypt callback, transfers the fallback qUSD repayment, and verifies that the auditor disclosure path can view the private receipt.

## Privacy Boundary

Quiet Till does not emit daily gross sales in public settlement events. Public observers can see report status and receipt hashes, while authorized auditors can verify private receipt details through the disclosure path.

`RevenueLoan` exposes public loan terms and status without an exact outstanding getter for arbitrary callers. Lenders, borrowers, auditors, the admin, and the settlement window can read exact loan snapshots through authorized calls.

Fallback ERC20 payments can reveal repayment amounts. The long-term path is to replace that fallback vault with SKALE confidential token settlement once the beta path is ready for the demo environment.

`PublicModeSimulator` is intentionally leaky. It is a demo comparison surface, not the private settlement path.
