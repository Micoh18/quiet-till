import assert from "node:assert/strict";

import {
  assertAuditorDisclosureEnvelope,
  buildAuditorDisclosureEnvelope,
  decryptAuditorDisclosureEnvelope,
  disclosureEnvelopeDomain,
  disclosureEnvelopeMode
} from "../lib/auditor-disclosure-envelope.mjs";
import {
  buildTranscript,
  demoAuditorDisclosureKeyMaterial
} from "../lib/demo-fixture.mjs";
import { buildPrivateReceipt } from "../lib/private-receipt.mjs";

const auditorKeyMaterial = "quiet-till-local-auditor-demo-key-v1";
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

const receipt = buildPrivateReceipt(baseInput);
const envelope = buildAuditorDisclosureEnvelope({
  receipt,
  keyMaterial: auditorKeyMaterial
});
const decryptedReceipt = assertAuditorDisclosureEnvelope({
  envelope,
  keyMaterial: auditorKeyMaterial,
  expectedReceiptHash: receipt.receiptHash
});
const tamperedEnvelope = {
  ...envelope,
  ciphertext: `${envelope.ciphertext.slice(0, -2)}00`
};

assert.equal(envelope.domain, disclosureEnvelopeDomain);
assert.equal(envelope.mode, disclosureEnvelopeMode);
assert.equal(envelope.recipient, baseInput.auditor);
assert.equal(envelope.receiptHash, receipt.receiptHash);
assert.equal(envelope.plaintextHash, "0x168d32c3ecb753f05381e6411e7a6094150e2fb2fad43a4b37a6e9fee74e6543");
assert.equal(envelope.envelopeHash, "0x721467ae233baa901c3badda0629cb539173d790056d44a8d1a8f64c51ce599f");
assert.equal(envelope.ciphertext.startsWith("0x"), true);
assert.equal(envelope.authTag.length, 34);
assert.equal(decryptedReceipt.receiptHash, receipt.receiptHash);
assert.equal(decryptedReceipt.grossSales, receipt.grossSales);

assert.throws(() => decryptAuditorDisclosureEnvelope({
  envelope,
  keyMaterial: "wrong-local-auditor-demo-key-v1"
}));
assert.throws(() => decryptAuditorDisclosureEnvelope({
  envelope: tamperedEnvelope,
  keyMaterial: auditorKeyMaterial
}));

const transcript = buildTranscript();
const transcriptReceipt = transcript.privateMode.visibleToAuditor.privateReceipt;
const transcriptEnvelope = transcript.privateMode.visibleToAuditor.disclosureEnvelope;
const generatedTranscriptEnvelope = buildAuditorDisclosureEnvelope({
  receipt: transcriptReceipt,
  keyMaterial: demoAuditorDisclosureKeyMaterial
});

assert.deepEqual(transcriptEnvelope, generatedTranscriptEnvelope);

console.log("Auditor disclosure envelope check passed.");
