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
- `RevenueLoan`: stores revenue-based loan terms and applies capped daily repayments.
- `AuditorDisclosure`: records private receipt metadata for authorized auditors.
- `DailySettlementWindow`: stores encrypted report payloads, requests settlement, and accepts an authorized decrypt callback.

The current settlement tests use encoded plaintext to simulate the post-decryption callback. The next integration step is wiring SKALE BITE/CTX so the encrypted report path is backed by the live privacy primitive instead of a test callback.

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

## Privacy Boundary

Quiet Till does not emit daily gross sales in public settlement events. Public observers can see report status and receipt hashes, while authorized auditors can verify private receipt details through the disclosure path.
