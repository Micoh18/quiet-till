import { getAddress, recoverMessageAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { canonicalJson, hashJson } from "./json-hash.mjs";

const auditorAccessChallengeDomain = "QUIET_TILL_AUDITOR_ACCESS_CHALLENGE_V1";

function buildAuditorAccessChallenge({ receiptExport, issuedAt = new Date(0).toISOString(), expiresAt }) {
  const receipt = receiptExport.receipt;
  const challenge = {
    domain: auditorAccessChallengeDomain,
    version: 1,
    chainId: receipt.chainId,
    settlementWindow: receipt.settlementWindow,
    auditor: getAddress(receiptExport.recipient),
    loanId: receipt.loanId,
    merchantId: receipt.merchantId,
    dayIndex: receipt.dayIndex,
    receiptHash: receiptExport.receiptHash,
    exportHash: receiptExport.exportHash,
    issuedAt
  };

  if (expiresAt !== undefined) {
    challenge.expiresAt = expiresAt;
  }

  return {
    ...challenge,
    challengeHash: hashJson(challenge)
  };
}

function accessChallengePayload(challenge) {
  const { challengeHash, ...payload } = challenge;
  return payload;
}

function auditorAccessMessage(challenge) {
  return canonicalJson(accessChallengePayload(challenge));
}

async function signAuditorAccessChallenge({ challenge, privateKey }) {
  const account = privateKeyToAccount(privateKey);
  const signer = getAddress(account.address);
  const auditor = getAddress(challenge.auditor);

  if (signer !== auditor) {
    throw new Error(`auditor private key mismatch: expected ${auditor}, got ${signer}`);
  }

  const message = auditorAccessMessage(challenge);
  const signature = await account.signMessage({ message });

  return {
    signer,
    message,
    signature,
    signatureHash: hashJson({
      domain: auditorAccessChallengeDomain,
      challengeHash: challenge.challengeHash,
      signature
    })
  };
}

async function verifyAuditorAccessProof({ receiptExport, challenge, signature }) {
  if (challenge.domain !== auditorAccessChallengeDomain) {
    throw new Error(`unexpected auditor access challenge domain: ${challenge.domain}`);
  }

  if (challenge.receiptHash !== receiptExport.receiptHash) {
    throw new Error("auditor access challenge receipt hash mismatch");
  }

  if (challenge.exportHash !== receiptExport.exportHash) {
    throw new Error("auditor access challenge export hash mismatch");
  }

  if (getAddress(challenge.auditor) !== getAddress(receiptExport.recipient)) {
    throw new Error("auditor access challenge recipient mismatch");
  }

  const expectedChallengeHash = hashJson(accessChallengePayload(challenge));

  if (expectedChallengeHash !== challenge.challengeHash) {
    throw new Error(`auditor access challenge hash mismatch: expected ${challenge.challengeHash}, got ${expectedChallengeHash}`);
  }

  const recoveredAddress = getAddress(await recoverMessageAddress({
    message: auditorAccessMessage(challenge),
    signature
  }));

  if (recoveredAddress !== getAddress(challenge.auditor)) {
    throw new Error(`auditor access signature mismatch: expected ${challenge.auditor}, got ${recoveredAddress}`);
  }

  return {
    verified: true,
    recoveredAddress
  };
}

export {
  auditorAccessChallengeDomain,
  auditorAccessMessage,
  accessChallengePayload,
  buildAuditorAccessChallenge,
  signAuditorAccessChallenge,
  verifyAuditorAccessProof
};
