import { keccak256 } from "viem";

import { buildManifest, buildTranscript } from "./demo-fixture.mjs";
import { hashJson } from "./json-hash.mjs";
import { privateReceiptHash } from "./private-receipt.mjs";

const auditorReceiptExportDomain = "QUIET_TILL_AUDITOR_RECEIPT_EXPORT_V1";

function exportPayload(bundle) {
  const { exportHash, ...payload } = bundle;
  return payload;
}

function buildAuditorReceiptExport(overrides) {
  const manifest = buildManifest(overrides);
  const transcript = buildTranscript(overrides);
  const auditor = transcript.privateMode.visibleToAuditor;
  const receipt = auditor.privateReceipt;
  const disclosureEnvelope = auditor.disclosureEnvelope;
  const encodedPlaintextHash = keccak256(auditor.encodedPlaintext);
  const bundle = {
    name: "Quiet Till Auditor Receipt Export",
    version: 1,
    domain: auditorReceiptExportDomain,
    generatedAt: transcript.generatedAt,
    recipient: auditor.authorization.auditor,
    receiptHash: receipt.receiptHash,
    receipt,
    disclosureEnvelope,
    verification: {
      receiptHashVerified: auditor.receiptHashVerified,
      receiptHashMatchesPublicState:
        receipt.receiptHash === transcript.privateMode.visibleToMarket.privateReceiptHash,
      disclosureEnvelopeBindsReceipt: disclosureEnvelope.receiptHash === receipt.receiptHash,
      encodedPlaintextHash,
      plaintextCommitmentHash: manifest.privateReport.plaintextCommitmentHash,
      plaintextCommitmentMatches: encodedPlaintextHash === manifest.privateReport.plaintextCommitmentHash,
      tamperedGrossSalesReceiptHash: auditor.tamperedGrossSalesReceiptHash,
      tamperDetected: auditor.tamperedGrossSalesReceiptHash !== receipt.receiptHash,
      publicObserverCanViewReceipt: auditor.authorization.publicObserverCanViewReceipt
    },
    privacyBoundary: {
      intendedRecipient: "authorized auditor",
      publicObserverFields: [
        "receiptHash",
        "disclosureEnvelope.envelopeHash",
        "disclosureEnvelope.ciphertext"
      ],
      sensitiveReceiptFields: [
        "grossSales",
        "repaymentAmount",
        "outstandingBefore",
        "outstandingAfter",
        "encodedPlaintext"
      ]
    }
  };

  return {
    ...bundle,
    exportHash: hashJson(bundle)
  };
}

function assertAuditorReceiptExport(bundle) {
  if (bundle.domain !== auditorReceiptExportDomain) {
    throw new Error(`Unexpected auditor receipt export domain: ${bundle.domain}`);
  }

  const actualExportHash = hashJson(exportPayload(bundle));

  if (actualExportHash !== bundle.exportHash) {
    throw new Error(`Auditor receipt export hash mismatch: expected ${bundle.exportHash}, got ${actualExportHash}`);
  }

  const actualReceiptHash = privateReceiptHash(bundle.receipt);

  if (actualReceiptHash !== bundle.receiptHash) {
    throw new Error(`Auditor receipt hash mismatch: expected ${bundle.receiptHash}, got ${actualReceiptHash}`);
  }

  if (bundle.disclosureEnvelope.receiptHash !== bundle.receiptHash) {
    throw new Error("Auditor disclosure envelope does not bind the exported receipt hash");
  }

  if (!bundle.verification.receiptHashMatchesPublicState) {
    throw new Error("Auditor receipt export is not bound to public settlement state");
  }

  if (!bundle.verification.plaintextCommitmentMatches) {
    throw new Error("Auditor receipt export plaintext commitment mismatch");
  }

  if (!bundle.verification.tamperDetected) {
    throw new Error("Auditor receipt export did not detect receipt tampering");
  }

  if (bundle.verification.publicObserverCanViewReceipt) {
    throw new Error("Auditor receipt export grants public observer access");
  }
}

export {
  assertAuditorReceiptExport,
  auditorReceiptExportDomain,
  buildAuditorReceiptExport
};
