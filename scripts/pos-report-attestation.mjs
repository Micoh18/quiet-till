import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { privateKeyToAccount } from "viem/accounts";

import { buildManifest, demo } from "../lib/demo-fixture.mjs";
import {
  buildPosReportAttestation,
  signPosReportAttestation,
  verifyPosReportAttestation
} from "../lib/pos-report-attestation.mjs";
import {
  normalizePrivateKey,
  requireAddressEnv
} from "../lib/script-utils.mjs";

const demoPosAgentPrivateKey = "0x2222222222222222222222222222222222222222222222222222222222222222";

async function buildPosReportAttestationProof({
  privateKey = demoPosAgentPrivateKey,
  settlementWindow = demo.proof.settlementWindow
} = {}) {
  const posAccount = privateKeyToAccount(privateKey);
  const manifest = buildManifest({
    actors: {
      posAgent: posAccount.address
    }
  });
  const attestation = buildPosReportAttestation({
    manifest,
    settlementWindow
  });
  const signed = await signPosReportAttestation({
    attestation,
    privateKey
  });
  const verification = await verifyPosReportAttestation({
    manifest,
    settlementWindow,
    attestation,
    signature: signed.signature
  });

  return {
    name: "Quiet Till POS Report Attestation",
    version: 1,
    mode: privateKey === demoPosAgentPrivateKey ? "deterministic-demo" : "live-key",
    report: {
      chainId: manifest.chainId,
      settlementWindow,
      posAgent: manifest.actors.posAgent,
      merchantId: manifest.privateReport.plaintext.merchantId,
      loanId: manifest.privateReport.plaintext.loanId,
      dayIndex: manifest.privateReport.plaintext.dayIndex,
      encryptedReportHash: manifest.privateReport.encryptedReportHash,
      plaintextCommitmentHash: manifest.privateReport.plaintextCommitmentHash
    },
    attestation,
    signature: signed.signature,
    signatureHash: signed.signatureHash,
    signer: signed.signer,
    verification
  };
}

async function writePosReportAttestationProof(filePath, proof) {
  const destination = resolve(filePath);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(proof, null, 2)}\n`, "utf8");
  return destination;
}

async function main() {
  const live = process.argv.includes("--live");
  const privateKey = live
    ? normalizePrivateKey(process.env.QUIET_TILL_POS_AGENT_PRIVATE_KEY, "QUIET_TILL_POS_AGENT_PRIVATE_KEY")
    : demoPosAgentPrivateKey;
  const settlementWindow = live
    ? requireAddressEnv("QUIET_TILL_DAILY_SETTLEMENT_WINDOW_ADDRESS")
    : demo.proof.settlementWindow;
  const proof = await buildPosReportAttestationProof({
    privateKey,
    settlementWindow
  });
  const outIndex = process.argv.indexOf("--out");

  if (outIndex !== -1) {
    const outPath = process.argv[outIndex + 1];

    if (!outPath) {
      throw new Error("--out requires a file path");
    }

    const destination = await writePosReportAttestationProof(outPath, proof);
    console.log(`Wrote POS report attestation to ${destination}`);
    return;
  }

  console.log(JSON.stringify(proof, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export {
  buildPosReportAttestationProof,
  demoPosAgentPrivateKey,
  writePosReportAttestationProof
};
