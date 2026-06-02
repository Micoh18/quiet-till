import assert from "node:assert/strict";

import {
  assertPrivateReceiptHash,
  buildPrivateReceipt,
  privateReceiptHash,
  receiptDomain
} from "../lib/private-receipt.mjs";

const baseInput = {
  chainId: 31_337,
  settlementWindow: "0x000000000000000000000000000000000000001b",
  auditor: "0x00000000000000000000000000000000000000a4",
  report: {
    loanId: 1,
    merchantId: 101,
    dayIndex: 4,
    grossSales: 1_240,
    nonce: 99
  },
  repaymentBps: 800,
  repaymentAmount: 99,
  outstandingBefore: 10_000,
  outstandingAfter: 9_901,
  settledAt: 0,
  encodedPlaintext: "0x1234"
};

const expectedHash = "0xd6b31b4a7139c57e08515968278a51a3276ef4fcba1f16bc31190d2cb8e97bdd";
const receipt = buildPrivateReceipt(baseInput);
const tamperedHash = privateReceiptHash({
  ...receipt,
  grossSales: receipt.grossSales + 1
});

assert.equal(receiptDomain, "0x0a801a419f09f555e79bc4734b54f734adecf34348013d79c10b2d69e3cea7cf");
assert.equal(receipt.receiptHash, expectedHash);
assertPrivateReceiptHash(receipt, expectedHash);
assert.notEqual(tamperedHash, expectedHash, "tampering with gross sales must change the receipt hash");

console.log("Private receipt check passed.");
