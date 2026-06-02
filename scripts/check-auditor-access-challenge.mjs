import assert from "node:assert/strict";

import { verifyAuditorAccessProof } from "../lib/auditor-access-challenge.mjs";
import { buildAuditorReceiptExport } from "../lib/auditor-receipt-export.mjs";
import {
  buildAuditorAccessProof,
  demoAuditorPrivateKey
} from "./auditor-access-challenge.mjs";

const proof = await buildAuditorAccessProof({ privateKey: demoAuditorPrivateKey });

assert.equal(proof.name, "Quiet Till Auditor Access Proof");
assert.equal(proof.version, 1);
assert.equal(proof.mode, "deterministic-demo");
assert.equal(proof.signer, proof.challenge.auditor);
assert.equal(proof.verification.verified, true);
assert.equal(proof.verification.recoveredAddress, proof.challenge.auditor);
assert.equal(proof.challenge.receiptHash, proof.receiptHash);
assert.equal(proof.challenge.exportHash, proof.exportHash);
assert.match(proof.challenge.challengeHash, /^0x[0-9a-f]{64}$/);
assert.match(proof.signature, /^0x[0-9a-fA-F]{130}$/);
assert.match(proof.signatureHash, /^0x[0-9a-f]{64}$/);

const wrongExport = buildAuditorReceiptExport({
  report: {
    dayIndex: 5
  }
});

await assert.rejects(
  () => verifyAuditorAccessProof({
    receiptExport: wrongExport,
    challenge: proof.challenge,
    signature: proof.signature
  }),
  /auditor access challenge receipt hash mismatch|auditor access challenge export hash mismatch|auditor access challenge recipient mismatch/
);

console.log("Auditor access challenge check passed.");
