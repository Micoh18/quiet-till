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
5. A missed report can be cured with a late encrypted report inside a cure window.
6. The lender receives settlement evidence.
7. An authorized auditor can inspect the details.
8. Public observers see settlement status, not daily sales.

## Built For

SKALE Programmable Privacy Hackathon.

## Status

Early hackathon MVP with core contracts, a local demo, a BITE report-preparation path, and a CTX-compatible settlement callback in place.

## Current Contract Surface

- `MerchantRegistry`: registers merchants, POS agents, and auditors.
- `RevenueLoan`: stores revenue-based loan terms, applies capped daily repayments, tracks and cures missing-report covenant strikes before default, can default a loan after repeated uncured missed report windows, and keeps exact outstanding snapshots behind participant-only ABI reads.
- `AuditorDisclosure`: records private receipt metadata and exposes it only to the authorized auditor, admin, or settlement window.
- `DailySettlementWindow`: stores encrypted report payloads, can bind a report to an optional plaintext commitment hash, opens report windows with deadlines, marks missed report windows without publishing sales, accepts late encrypted reports inside a cure window, requests settlement, can submit a CTX request through the SKALE submitter precompile, accepts only the authorized manual or CTX decrypt callback, and rejects outlier sales reports above an admin-configured gross sales limit.
- `MockPaymentToken`: provides a public ERC20-style fallback token for local demos.
- `SettlementVault`: moves fallback token repayments from borrower to lender when settlement completes.
- `ConfidentialPaymentRail`: records amount-hiding payment commitments tied to private receipt hashes, modeling the confidential payment path without publishing repayment amounts.
- `PublicModeSimulator`: publishes sales and competitor signals for the public-mode comparison.

The local tests still use encoded plaintext to simulate the post-decryption bytes, but the contract now includes the CTX callback shape required by SKALE: `onDecrypt(bytes[] decryptedArguments, bytes[] plaintextArguments)`. The next integration step is running that path against a live SKALE Programmable Privacy chain.

Private auditor receipts are reconstructed offchain and checked against the onchain `privateReceiptHash`, so the auditor view has a verifiable binding to the settlement without publishing sales.

The auditor path now also builds a local AES-GCM disclosure envelope around the private receipt. This models the fallback described in the spec when SKALE re-encryption is not available: the public surface gets ciphertext and hashes, while the authorized auditor can open the receipt in the demo. It is labeled as a fallback, not as production re-encryption.

Decrypt failures can now be marked by the authorized callback without revealing sales data. Failed days keep the encrypted report hash and can be retried through a new settlement request.

The fallback token payment is intentionally public. It is useful for demonstrating repayment movement while confidential tokens remain a separate integration target. The separate confidential payment rail records a private payment commitment so the demo can show the intended amount-hiding path without pretending the fallback ERC20 transfer is confidential.

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

Prepare a private sales report envelope:

```bash
npm run report:prepare -- --mock
```

For live SKALE BITE encryption, set `QUIET_TILL_RPC_URL` and `QUIET_TILL_DAILY_SETTLEMENT_WINDOW_ADDRESS`, then run `npm run report:prepare` without `--mock`.

Print the deterministic public-vs-private demo transcript:

```bash
npm run demo:transcript
```

Print the compact judge evidence bundle:

```bash
npm run judge:evidence
```

Run a full in-memory local demo:

```bash
npm run demo:local
```

Validate the external deployment plan without secrets:

```bash
npm run deploy:check
```

Validate the live SKALE private-flow plan without secrets:

```bash
npm run skale:check
```

Check the public ABI privacy surface:

```bash
npm run privacy:check
```

Deploy and seed the demo contracts on a configured RPC target:

```bash
npm run deploy:demo
```

Submit the encrypted report and request CTX settlement on the deployed SKALE target:

```bash
npm run skale:flow
```

Check the manifest against compiled artifacts and expected repayment math:

```bash
npm run demo:check
```

Check local BITE report envelope generation:

```bash
npm run report:check
```

Check private receipt hashing:

```bash
npm run receipt:check
```

Check private payment commitment hashing:

```bash
npm run payment:check
```

Check the auditor disclosure envelope:

```bash
npm run disclosure:check
```

Check the judge evidence bundle:

```bash
npm run judge:check
```

Run the full local quality gate:

```bash
npm run verify
```

GitHub Actions runs the same `npm run verify` gate on pushes to `main` and on pull requests.

The demo manifest describes contract constructor arguments, setup calls, the encoded sales report payload, and the expected repayment result for "La Barra". It is deterministic input for scripts and UI work; it is not production encrypted data.

The transcript turns that manifest into the core demo story: public mode leaks gross sales and a competitor signal, while private mode exposes only status and hashes to the market and keeps the revenue details for the auditor path.

The judge evidence bundle compresses the same proof into a short JSON object: public leakage, private-market visibility, auditor receipt binding, tamper sensitivity, and the exact SKALE privacy surfaces used by the MVP.

The encrypted report path can include a plaintext commitment hash. When present, the settlement callback must decrypt to bytes matching that commitment before repayment is applied.

`npm run report:prepare -- --mock` uses the official `@skalenetwork/bite` mock to wrap the encoded report into a non-deterministic ciphertext envelope for local checks. Without `--mock`, the same script uses live BITE encryption for CTX and requires the deployed `DailySettlementWindow` address.

`npm run receipt:check` verifies the canonical private receipt domain, receipt hash calculation, and tamper sensitivity. `npm run demo:local` also reconstructs the auditor receipt and asserts that its hash matches the onchain `privateReceiptHash`.

`npm run demo:local` deploys the contracts on an in-memory Hardhat network, seeds "La Barra", publishes the intentionally leaky public-mode report, submits the encrypted private report, requests settlement, simulates the authorized decrypt callback, transfers the fallback qUSD repayment, and verifies that the auditor disclosure path can view the private receipt.

The local demo also opens follow-up report windows, advances the in-memory clock, marks one day as `Missing`, cures it with a late encrypted report, verifies that the covenant strike clears without revealing sales, and then verifies that repeated uncured missed closes can default the loan.

`npm run deploy:check` validates the same manifest and deployment order in dry-run mode. `npm run deploy:demo` requires the environment variables shown in `.env.example`, deploys the contracts to the configured RPC chain, runs the setup calls, and can write a JSON deployment summary through `QUIET_TILL_DEPLOY_OUTPUT`.

`npm run skale:check` validates the live private-flow plan without secrets. `npm run skale:flow` reads the deployment summary from `QUIET_TILL_DEPLOYMENT_FILE` or `QUIET_TILL_DEPLOY_OUTPUT`, verifies that the POS and lender private keys match the deployed actors, encrypts the sales report with live BITE, submits the encrypted report from the POS agent, and requests CTX settlement from the lender.

`npm run privacy:check` blocks obvious privacy regressions in public ABIs and contract sources, including public getters for sensitive mappings and forbidden event fields such as daily sales, exact repayment, auditor identity, or exact outstanding in core contracts.

## Privacy Boundary

Quiet Till does not emit daily gross sales in public settlement events. Public observers can see report status and receipt hashes, while authorized auditors can verify private receipt details through the disclosure path.

`DailySettlementWindow` keeps full settlement day storage private and exposes only a limited public status view with status, encrypted report hash, and private receipt hash.

Report deadlines, cure deadlines, and missing-report covenant strikes are public compliance state. A missing report can be marked onchain, cured through a late encrypted report, or left uncured until repeated missed closes default the loan. These events carry no gross sales, projected repayment, or private receipt hash.

`RevenueLoan` exposes public loan terms and status without an exact outstanding getter for arbitrary callers. Lenders, borrowers, auditors, the admin, and the settlement window can read exact loan snapshots through authorized calls.

`AuditorDisclosure` keeps receipt metadata behind authorized reads. Public observers can see the receipt hash, but not the disclosure metadata view used by the auditor path. Receipt registration events do not emit the auditor address, and access checks cannot be used by arbitrary callers to probe another viewer's authorization.

Fallback ERC20 payments can reveal repayment amounts. The confidential payment rail avoids publishing the amount by committing to it with the private report nonce and receipt hash, but it does not move confidential tokens. The long-term path is to replace the fallback vault with SKALE confidential token settlement once the beta path is ready for the demo environment.

`PublicModeSimulator` is intentionally leaky. It is a demo comparison surface, not the private settlement path.
