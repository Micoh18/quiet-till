import { getAddress, recoverMessageAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { canonicalJson, hashJson } from "./json-hash.mjs";

const posReportAttestationDomain = "QUIET_TILL_POS_REPORT_ATTESTATION_V1";

function buildPosReportAttestation({ manifest, settlementWindow, issuedAt = new Date(0).toISOString() }) {
  if (settlementWindow === undefined) {
    throw new Error("settlementWindow is required for POS report attestation");
  }

  const report = manifest.privateReport.plaintext;
  const attestation = {
    domain: posReportAttestationDomain,
    version: 1,
    chainId: manifest.chainId,
    settlementWindow: getAddress(settlementWindow),
    posAgent: getAddress(manifest.actors.posAgent),
    merchantId: report.merchantId,
    loanId: report.loanId,
    dayIndex: report.dayIndex,
    encryptedReportHash: manifest.privateReport.encryptedReportHash,
    plaintextCommitmentHash: manifest.privateReport.plaintextCommitmentHash,
    issuedAt
  };

  return {
    ...attestation,
    attestationHash: hashJson(attestation)
  };
}

function posReportAttestationPayload(attestation) {
  const { attestationHash, ...payload } = attestation;
  return payload;
}

function posReportAttestationMessage(attestation) {
  return canonicalJson(posReportAttestationPayload(attestation));
}

async function signPosReportAttestation({ attestation, privateKey }) {
  const account = privateKeyToAccount(privateKey);
  const signer = getAddress(account.address);
  const posAgent = getAddress(attestation.posAgent);

  if (signer !== posAgent) {
    throw new Error(`POS agent private key mismatch: expected ${posAgent}, got ${signer}`);
  }

  const message = posReportAttestationMessage(attestation);
  const signature = await account.signMessage({ message });

  return {
    signer,
    message,
    signature,
    signatureHash: hashJson({
      domain: posReportAttestationDomain,
      attestationHash: attestation.attestationHash,
      signature
    })
  };
}

async function verifyPosReportAttestation({ manifest, settlementWindow, attestation, signature }) {
  if (attestation.domain !== posReportAttestationDomain) {
    throw new Error(`unexpected POS report attestation domain: ${attestation.domain}`);
  }

  if (attestation.chainId !== manifest.chainId) {
    throw new Error("POS report attestation chain mismatch");
  }

  if (settlementWindow !== undefined && getAddress(attestation.settlementWindow) !== getAddress(settlementWindow)) {
    throw new Error("POS report attestation settlement window mismatch");
  }

  if (getAddress(attestation.posAgent) !== getAddress(manifest.actors.posAgent)) {
    throw new Error("POS report attestation signer is not the manifest POS agent");
  }

  const report = manifest.privateReport.plaintext;

  if (
    attestation.merchantId !== report.merchantId ||
    attestation.loanId !== report.loanId ||
    attestation.dayIndex !== report.dayIndex
  ) {
    throw new Error("POS report attestation report identity mismatch");
  }

  if (attestation.encryptedReportHash !== manifest.privateReport.encryptedReportHash) {
    throw new Error("POS report attestation encrypted report hash mismatch");
  }

  if (attestation.plaintextCommitmentHash !== manifest.privateReport.plaintextCommitmentHash) {
    throw new Error("POS report attestation plaintext commitment hash mismatch");
  }

  const actualAttestationHash = hashJson(posReportAttestationPayload(attestation));

  if (actualAttestationHash !== attestation.attestationHash) {
    throw new Error(`POS report attestation hash mismatch: expected ${attestation.attestationHash}, got ${actualAttestationHash}`);
  }

  const recoveredAddress = getAddress(await recoverMessageAddress({
    message: posReportAttestationMessage(attestation),
    signature
  }));

  if (recoveredAddress !== getAddress(attestation.posAgent)) {
    throw new Error(`POS report attestation signature mismatch: expected ${attestation.posAgent}, got ${recoveredAddress}`);
  }

  return {
    verified: true,
    recoveredAddress
  };
}

export {
  buildPosReportAttestation,
  posReportAttestationDomain,
  posReportAttestationMessage,
  posReportAttestationPayload,
  signPosReportAttestation,
  verifyPosReportAttestation
};
