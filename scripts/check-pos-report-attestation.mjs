import assert from "node:assert/strict";

import { buildManifest, demo } from "../lib/demo-fixture.mjs";
import {
  signPosReportAttestation,
  verifyPosReportAttestation
} from "../lib/pos-report-attestation.mjs";
import {
  buildPosReportAttestationProof,
  demoPosAgentPrivateKey
} from "./pos-report-attestation.mjs";

const proof = await buildPosReportAttestationProof({
  privateKey: demoPosAgentPrivateKey
});

assert.equal(proof.name, "Quiet Till POS Report Attestation");
assert.equal(proof.version, 1);
assert.equal(proof.mode, "deterministic-demo");
assert.equal(proof.signer, proof.attestation.posAgent);
assert.equal(proof.verification.verified, true);
assert.equal(proof.verification.recoveredAddress, proof.attestation.posAgent);
assert.equal(proof.report.encryptedReportHash, proof.attestation.encryptedReportHash);
assert.equal(proof.report.plaintextCommitmentHash, proof.attestation.plaintextCommitmentHash);
assert.equal(proof.attestation.settlementWindow, demo.proof.settlementWindow);
assert.match(proof.attestation.attestationHash, /^0x[0-9a-f]{64}$/);
assert.match(proof.signature, /^0x[0-9a-fA-F]{130}$/);
assert.match(proof.signatureHash, /^0x[0-9a-f]{64}$/);

const wrongManifest = buildManifest({
  actors: {
    posAgent: proof.signer
  },
  report: {
    dayIndex: proof.attestation.dayIndex + 1
  }
});

await assert.rejects(
  () => verifyPosReportAttestation({
    manifest: wrongManifest,
    settlementWindow: demo.proof.settlementWindow,
    attestation: proof.attestation,
    signature: proof.signature
  }),
  /POS report attestation report identity mismatch|POS report attestation encrypted report hash mismatch|POS report attestation plaintext commitment hash mismatch/
);

const wrongPosManifest = buildManifest();

await assert.rejects(
  () => verifyPosReportAttestation({
    manifest: wrongPosManifest,
    settlementWindow: demo.proof.settlementWindow,
    attestation: proof.attestation,
    signature: proof.signature
  }),
  /POS report attestation signer is not the manifest POS agent/
);

await assert.rejects(
  () => signPosReportAttestation({
    attestation: proof.attestation,
    privateKey: "0x3333333333333333333333333333333333333333333333333333333333333333"
  }),
  /POS agent private key mismatch/
);

console.log("POS report attestation check passed.");
