import { createCipheriv, createDecipheriv, createHash } from "node:crypto";

import {
  getAddress
} from "viem";

import { canonicalJson, hashJson } from "./json-hash.mjs";

const disclosureEnvelopeDomain = "QUIET_TILL_AUDITOR_DISCLOSURE_ENVELOPE_V1";
const disclosureEnvelopeMode = "local-aes-gcm-reencryption-fallback";

function hexFromBytes(bytes) {
  return `0x${Buffer.from(bytes).toString("hex")}`;
}

function bytesFromHex(value, label) {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]*$/.test(value) || value.length % 2 !== 0) {
    throw new Error(`${label} must be a 0x-prefixed even-length hex string`);
  }

  return Buffer.from(value.slice(2), "hex");
}

function keyFromMaterial(keyMaterial) {
  if (typeof keyMaterial !== "string" || keyMaterial.length < 16) {
    throw new Error("auditor disclosure key material must be at least 16 characters");
  }

  return createHash("sha256")
    .update("QUIET_TILL_AUDITOR_DISCLOSURE_KEY_V1:")
    .update(keyMaterial)
    .digest();
}

function deterministicIv({ recipient, receiptHash }) {
  return createHash("sha256")
    .update(disclosureEnvelopeDomain)
    .update(recipient)
    .update(receiptHash)
    .digest()
    .subarray(0, 12);
}

function envelopeAad({ recipient, receiptHash }) {
  return {
    domain: disclosureEnvelopeDomain,
    mode: disclosureEnvelopeMode,
    recipient,
    receiptHash
  };
}

function buildAuditorDisclosureEnvelope({ receipt, auditor, keyMaterial, iv }) {
  const recipient = getAddress(auditor ?? receipt.auditor);
  const receiptHash = receipt.receiptHash;

  if (typeof receiptHash !== "string" || !receiptHash.startsWith("0x")) {
    throw new Error("receipt.receiptHash is required");
  }

  const plaintext = canonicalJson(receipt);
  const aad = envelopeAad({ recipient, receiptHash });
  const aadBytes = Buffer.from(canonicalJson(aad), "utf8");
  const ivBytes = iv === undefined ? deterministicIv({ recipient, receiptHash }) : bytesFromHex(iv, "iv");
  const cipher = createCipheriv(
    "aes-256-gcm",
    keyFromMaterial(keyMaterial),
    ivBytes
  );
  cipher.setAAD(aadBytes);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();
  const encryptedPayload = {
    version: 1,
    ...aad,
    plaintextHash: hashJson(receipt),
    aadHash: hashJson(aad),
    keyFingerprint: hashJson({
      domain: disclosureEnvelopeDomain,
      recipient,
      keyMaterial
    }),
    iv: hexFromBytes(ivBytes),
    ciphertext: hexFromBytes(ciphertext),
    authTag: hexFromBytes(authTag)
  };

  return {
    ...encryptedPayload,
    envelopeHash: hashJson(encryptedPayload)
  };
}

function decryptAuditorDisclosureEnvelope({ envelope, keyMaterial }) {
  const aad = envelopeAad({
    recipient: getAddress(envelope.recipient),
    receiptHash: envelope.receiptHash
  });
  const aadBytes = Buffer.from(canonicalJson(aad), "utf8");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    keyFromMaterial(keyMaterial),
    bytesFromHex(envelope.iv, "iv")
  );

  decipher.setAAD(aadBytes);
  decipher.setAuthTag(bytesFromHex(envelope.authTag, "authTag"));

  const plaintext = Buffer.concat([
    decipher.update(bytesFromHex(envelope.ciphertext, "ciphertext")),
    decipher.final()
  ]).toString("utf8");
  const receipt = JSON.parse(plaintext);

  if (hashJson(receipt) !== envelope.plaintextHash) {
    throw new Error("disclosure envelope plaintext hash mismatch");
  }

  if (receipt.receiptHash !== envelope.receiptHash) {
    throw new Error("disclosure envelope receipt hash mismatch");
  }

  return receipt;
}

function assertAuditorDisclosureEnvelope({ envelope, keyMaterial, expectedReceiptHash }) {
  const receipt = decryptAuditorDisclosureEnvelope({ envelope, keyMaterial });

  if (receipt.receiptHash !== expectedReceiptHash) {
    throw new Error(`Disclosure envelope receipt mismatch: expected ${expectedReceiptHash}, got ${receipt.receiptHash}`);
  }

  return receipt;
}

export {
  assertAuditorDisclosureEnvelope,
  buildAuditorDisclosureEnvelope,
  canonicalJson,
  decryptAuditorDisclosureEnvelope,
  disclosureEnvelopeDomain,
  disclosureEnvelopeMode,
  hashJson
};
