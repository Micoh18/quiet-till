import assert from "node:assert/strict";

import {
  assertAuditorReceiptExport,
  auditorReceiptExportDomain,
  buildAuditorReceiptExport
} from "../lib/auditor-receipt-export.mjs";

const bundle = buildAuditorReceiptExport();

assert.equal(bundle.name, "Quiet Till Auditor Receipt Export");
assert.equal(bundle.version, 1);
assert.equal(bundle.domain, auditorReceiptExportDomain);
assert.equal(bundle.recipient, "0x1000000000000000000000000000000000000004");
assert.equal(bundle.receiptHash, "0x0af07f4bf9d1a370ff86b672ddbd0053f9595087867001d798576e78f1c88628");
assert.equal(bundle.receipt.grossSales, 1_240);
assert.equal(bundle.receipt.repaymentAmount, 99);
assert.equal(bundle.receipt.outstandingBefore, 10_000);
assert.equal(bundle.receipt.outstandingAfter, 9_901);
assert.equal(bundle.disclosureEnvelope.receiptHash, bundle.receiptHash);
assert.equal(bundle.verification.receiptHashVerified, true);
assert.equal(bundle.verification.receiptHashMatchesPublicState, true);
assert.equal(bundle.verification.disclosureEnvelopeBindsReceipt, true);
assert.equal(
  bundle.verification.encodedPlaintextHash,
  "0xda06e5e6268974807a2425dd277a50b37959e5e42f0f8588c1eb5dcaa331bed7"
);
assert.equal(bundle.verification.plaintextCommitmentMatches, true);
assert.equal(bundle.verification.tamperDetected, true);
assert.equal(bundle.verification.publicObserverCanViewReceipt, false);
assert.equal(bundle.privacyBoundary.intendedRecipient, "authorized auditor");
assert.equal(bundle.privacyBoundary.sensitiveReceiptFields.includes("grossSales"), true);
assert.match(bundle.exportHash, /^0x[0-9a-f]{64}$/);
assertAuditorReceiptExport(bundle);

const tamperedBundle = {
  ...bundle,
  receipt: {
    ...bundle.receipt,
    grossSales: bundle.receipt.grossSales + 1
  }
};

assert.throws(
  () => assertAuditorReceiptExport(tamperedBundle),
  /Auditor receipt export hash mismatch|Auditor receipt hash mismatch/
);

console.log("Auditor receipt export check passed.");
