import assert from "node:assert/strict";

import { buildTranscript } from "../lib/demo-fixture.mjs";
import {
  buildPaymentCommitment,
  paymentCommitmentDomain
} from "../lib/private-payment-commitment.mjs";

const transcript = buildTranscript();
const report = transcript.privateMode.visibleToAuditor.privateReceipt;
const lender = transcript.privateMode.visibleToLender;
const expectedCommitmentHash = "0x4ab387899f9fe69c8e350a6a9fba5d970b0a6839c36f86609867748d76d62424";
const tamperedAmountHash = buildPaymentCommitment({
  chainId: transcript.scenario.chainId ?? 31337,
  paymentRail: "0x00000000000000000000000000000000000000b1",
  loanId: report.loanId,
  dayIndex: report.dayIndex,
  payer: "0x1000000000000000000000000000000000000002",
  payee: lender.lender,
  repaymentAmount: lender.repaymentAmount + 1,
  nonce: report.nonce,
  privateReceiptHash: report.receiptHash
});

assert.equal(paymentCommitmentDomain, "0x5a1b2ea24e80dd0e4dbf3c6031704ee9890cbfeeb44d1999a4108d84f0c1eb05");
assert.equal(lender.privatePaymentCommitmentHash, expectedCommitmentHash);
assert.notEqual(tamperedAmountHash, expectedCommitmentHash, "tampering with repayment amount must change commitment");

console.log("Private payment commitment check passed.");
