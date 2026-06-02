import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { privateKeyToAccount } from "viem/accounts";

import {
  buildAuditorAccessChallenge,
  signAuditorAccessChallenge,
  verifyAuditorAccessProof
} from "../lib/auditor-access-challenge.mjs";
import { buildAuditorReceiptExport } from "../lib/auditor-receipt-export.mjs";
import { normalizePrivateKey } from "../lib/script-utils.mjs";

const demoAuditorPrivateKey = "0x1111111111111111111111111111111111111111111111111111111111111111";

async function buildAuditorAccessProof({ privateKey = demoAuditorPrivateKey } = {}) {
  const auditorAccount = privateKeyToAccount(privateKey);
  const receiptExport = buildAuditorReceiptExport({
    actors: {
      auditor: auditorAccount.address
    }
  });
  const challenge = buildAuditorAccessChallenge({ receiptExport });
  const signed = await signAuditorAccessChallenge({ challenge, privateKey });
  const verification = await verifyAuditorAccessProof({
    receiptExport,
    challenge,
    signature: signed.signature
  });

  return {
    name: "Quiet Till Auditor Access Proof",
    version: 1,
    mode: privateKey === demoAuditorPrivateKey ? "deterministic-demo" : "live-key",
    receiptHash: receiptExport.receiptHash,
    exportHash: receiptExport.exportHash,
    challenge,
    signature: signed.signature,
    signatureHash: signed.signatureHash,
    signer: signed.signer,
    verification
  };
}

async function writeAuditorAccessProof(filePath, proof) {
  const destination = resolve(filePath);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(proof, null, 2)}\n`, "utf8");
  return destination;
}

async function main() {
  const live = process.argv.includes("--live");
  const privateKey = live
    ? normalizePrivateKey(process.env.QUIET_TILL_AUDITOR_PRIVATE_KEY, "QUIET_TILL_AUDITOR_PRIVATE_KEY")
    : demoAuditorPrivateKey;
  const proof = await buildAuditorAccessProof({ privateKey });
  const outIndex = process.argv.indexOf("--out");

  if (outIndex !== -1) {
    const outPath = process.argv[outIndex + 1];

    if (!outPath) {
      throw new Error("--out requires a file path");
    }

    const destination = await writeAuditorAccessProof(outPath, proof);
    console.log(`Wrote auditor access proof to ${destination}`);
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

export { buildAuditorAccessProof, demoAuditorPrivateKey, writeAuditorAccessProof };
