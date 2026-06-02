import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { buildManifest } from "./demo-manifest.mjs";

const expectedContractOrder = [
  "MerchantRegistry",
  "RevenueLoan",
  "AuditorDisclosure",
  "MockPaymentToken",
  "SettlementVault",
  "DailySettlementWindow"
];

const expectedSetupCalls = [
  "MerchantRegistry.registerMerchant",
  "RevenueLoan.createLoan",
  "RevenueLoan.activateLoan",
  "DailySettlementWindow.setDecryptCallback",
  "DailySettlementWindow.setSettlementVault",
  "RevenueLoan.setSettlementWindow",
  "AuditorDisclosure.setSettlementWindow",
  "SettlementVault.setSettlementWindow",
  "MockPaymentToken.mint",
  "MockPaymentToken.approve"
];

async function assertArtifactExists(artifactPath) {
  await access(resolve(artifactPath));
}

async function main() {
  const manifest = buildManifest();

  assert.equal(manifest.name, "Quiet Till Local Demo");
  assert.equal(manifest.version, 1);
  assert.equal(manifest.chainId, 31337);
  assert.deepEqual(
    manifest.contracts.map((contract) => contract.name),
    expectedContractOrder
  );
  assert.deepEqual(
    manifest.setupCalls.map((call) => `${call.contract}.${call.function}`),
    expectedSetupCalls
  );
  assert.equal(manifest.privateReport.plaintext.loanId, 1);
  assert.equal(manifest.privateReport.plaintext.merchantId, 101);
  assert.equal(manifest.privateReport.plaintext.dayIndex, 4);
  assert.equal(manifest.privateReport.plaintext.grossSales, 1_240);
  assert.equal(manifest.privateReport.encodedPlaintext.length, 322);
  assert.equal(
    manifest.privateReport.encryptedReportHash,
    "0xb78c4790e0235c77f196a6ff65c1032eda11a10562d7664de22fd59a78b52af8"
  );
  assert.equal(manifest.expectedSettlement.repaymentAmount, 99);
  assert.equal(manifest.expectedSettlement.outstandingAfter, 9_901);
  assert.equal(manifest.expectedSettlement.repaymentAmountHex, "0x63");

  await Promise.all(manifest.contracts.map((contract) => assertArtifactExists(contract.artifact)));

  console.log("Demo manifest check passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
