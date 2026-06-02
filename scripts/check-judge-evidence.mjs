import assert from "node:assert/strict";
import { buildJudgeEvidence } from "../lib/judge-evidence.mjs";

function main() {
  const evidence = buildJudgeEvidence();

  assert.equal(evidence.name, "Quiet Till Judge Evidence Bundle");
  assert.equal(evidence.version, 1);
  assert.deepEqual(evidence.tracks, ["Compliant Onchain Finance", "Private Markets"]);
  assert.equal(evidence.demoMinuteFlow.length, 5);
  assert.deepEqual(
    evidence.demoMinuteFlow.map((step) => step.key),
    ["public-leak", "encrypted-report", "ctx-settlement", "lender-receipt", "auditor-proof"]
  );

  assert.equal(evidence.publicObserver.publicMode.visibleGrossSales, 1_240);
  assert.equal(evidence.publicObserver.publicMode.visibleProjectedRepayment, 99);
  assert.equal(evidence.publicObserver.quietTillMode.visibleGrossSales, null);
  assert.equal(evidence.publicObserver.quietTillMode.visibleProjectedRepayment, null);
  assert.equal(evidence.publicObserver.privacyDelta.publicModeLeaksGrossSales, true);
  assert.equal(evidence.publicObserver.privacyDelta.quietTillHidesGrossSales, true);
  assert.equal(evidence.publicObserver.privacyDelta.quietTillHidesProjectedRepayment, true);

  assert.equal(evidence.lenderEvidence.paymentStatus, "PaymentRecorded");
  assert.equal(evidence.lenderEvidence.tokenSymbol, "qUSD");
  assert.equal(evidence.lenderEvidence.repaymentAmount, 99);
  assert.equal(evidence.lenderEvidence.outstandingAfter, 9_901);
  assert.equal(evidence.lenderEvidence.receiptCommitmentMatches, true);
  assert.equal(evidence.lenderEvidence.fallbackPaymentIsPublic, true);

  assert.equal(evidence.auditorEvidence.receiptCommitmentMatches, true);
  assert.equal(evidence.auditorEvidence.grossSales, 1_240);
  assert.equal(evidence.auditorEvidence.repaymentAmount, 99);
  assert.equal(evidence.auditorEvidence.outstandingAfter, 9_901);
  assert.equal(evidence.tamperCheck.tamperDetected, true);
  assert.notEqual(
    evidence.tamperCheck.tamperedReceiptHash,
    evidence.publicObserver.quietTillMode.privateReceiptHash
  );

  assert.equal(evidence.skalePrivacyUse.encryptedReportStoredOnchain, true);
  assert.equal(evidence.skalePrivacyUse.ctxSubmitterPrecompile, "0x1B");
  assert.equal(evidence.skalePrivacyUse.publicLeakBlocked, true);
  assert.equal(evidence.passConditions.hasCompleteRoleFlow, true);
  assert.equal(evidence.passConditions.noQuietTillPublicGrossSales, true);
  assert.equal(evidence.passConditions.noQuietTillPublicProjectedRepayment, true);
  assert.equal(evidence.passConditions.lenderReceiptBinding, true);
  assert.equal(evidence.passConditions.publicReceiptBinding, true);
  assert.equal(evidence.passConditions.tamperSensitivity, true);

  console.log("Judge evidence check passed.");
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
