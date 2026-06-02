import assert from "node:assert/strict";

import { buildManifest } from "../lib/demo-fixture.mjs";
import {
  encryptSalesReportForCTX,
  mockEncryptSalesReportForCTX
} from "../lib/private-report.mjs";

const args = new Set(process.argv.slice(2));
const mock = args.has("--mock");
const quiet = args.has("--quiet");

function jsonReplacer(_key, value) {
  return typeof value === "bigint" ? value.toString() : value;
}

function requireEnv(name) {
  const value = process.env[name];

  if (value === undefined || value.trim() === "") {
    throw new Error(`Missing ${name}`);
  }

  return value.trim();
}

async function prepareReport() {
  const manifest = buildManifest();
  const encodedPlaintext = manifest.privateReport.encodedPlaintext;
  const envelope = mock
    ? await mockEncryptSalesReportForCTX({ encodedPlaintext })
    : await encryptSalesReportForCTX({
        rpcUrl: requireEnv("QUIET_TILL_RPC_URL"),
        ctxSubmitterAddress: requireEnv("QUIET_TILL_DAILY_SETTLEMENT_WINDOW_ADDRESS"),
        encodedPlaintext
      });

  assert.ok(envelope.encryptedReport.startsWith("0x"), "encrypted report must be hex");
  assert.ok(envelope.encryptedReport.length > encodedPlaintext.length, "ciphertext should wrap the report");
  assert.notEqual(
    envelope.encryptedReportHash,
    manifest.privateReport.encryptedReportHash,
    "BITE envelope must not reuse the deterministic placeholder hash"
  );

  return {
    name: "Quiet Till Private Report Envelope",
    mode: envelope.mode,
    note:
      envelope.mode === "bite-mock-local"
        ? "Local BITEMockup output. Use without --mock and SKALE env vars for live BITE encryption."
        : "SKALE BITE ciphertext prepared for DailySettlementWindow CTX.",
    plaintext: manifest.privateReport.plaintext,
    ctxSubmitterAddress: envelope.ctxSubmitterAddress,
    encodedPlaintext: envelope.encodedPlaintext,
    encryptedReport: envelope.encryptedReport,
    encryptedReportHash: envelope.encryptedReportHash,
    submitCall: {
      contract: "DailySettlementWindow",
      function: "submitEncryptedReport",
      args: [
        manifest.privateReport.plaintext.loanId,
        manifest.privateReport.plaintext.dayIndex,
        envelope.encryptedReport
      ]
    },
    ctxCloseCall: {
      contract: "DailySettlementWindow",
      function: "requestDailySettlementViaCTX",
      args: [
        manifest.privateReport.plaintext.loanId,
        manifest.privateReport.plaintext.dayIndex,
        "$callbackGas"
      ]
    }
  };
}

const result = await prepareReport();

if (quiet) {
  console.log("Private report envelope check passed.");
} else {
  console.log(JSON.stringify(result, jsonReplacer, 2));
}
