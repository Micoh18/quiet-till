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

Early hackathon MVP.
