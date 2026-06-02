import assert from "node:assert/strict";
import { buildDemoFlow, buildTranscript } from "../lib/demo-fixture.mjs";

function main() {
  const transcript = buildTranscript();

  assert.equal(transcript.name, "Quiet Till Demo Transcript");
  assert.equal(transcript.version, 1);
  assert.equal(transcript.scenario.merchant, "La Barra");
  assert.equal(transcript.scenario.dayIndex, 4);
  assert.equal(transcript.publicMode.visibleToMarket.grossSales, 1_240);
  assert.equal(transcript.publicMode.visibleToMarket.projectedRepayment, 99);
  assert.equal(transcript.publicMode.visibleToMarket.competitorSignal.code, "STRONG_DAY");
  assert.equal(transcript.privateMode.visibleToMarket.grossSales, null);
  assert.equal(transcript.privateMode.visibleToMarket.projectedRepayment, null);
  assert.equal(
    transcript.privateMode.visibleToMarket.encryptedReportHash,
    "0xb78c4790e0235c77f196a6ff65c1032eda11a10562d7664de22fd59a78b52af8"
  );
  assert.equal(
    transcript.privateMode.visibleToMarket.privateReceiptHash,
    "0x8e05af5fbae10a8897a460032a3d9684bffe2ec13e35c8b0ceb247411a0de8b7"
  );
  assert.equal(transcript.privateMode.visibleToLender.paymentStatus, "PaymentRecorded");
  assert.equal(transcript.privateMode.visibleToLender.tokenSymbol, "qUSD");
  assert.equal(transcript.privateMode.visibleToLender.repaymentAmount, 99);
  assert.equal(transcript.privateMode.visibleToLender.outstandingAfter, 9_901);
  assert.equal(transcript.privateMode.visibleToLender.fallbackPaymentIsPublic, true);
  assert.equal(
    transcript.privateMode.visibleToLender.privateReceiptHash,
    transcript.privateMode.visibleToMarket.privateReceiptHash
  );
  assert.equal(transcript.privateMode.visibleToAuditor.grossSales, 1_240);
  assert.equal(transcript.privateMode.visibleToAuditor.repaymentAmount, 99);
  assert.equal(transcript.privateMode.visibleToAuditor.outstandingBefore, 10_000);
  assert.equal(transcript.privateMode.visibleToAuditor.outstandingAfter, 9_901);
  assert.equal(transcript.privateMode.visibleToAuditor.receiptHashVerified, true);
  assert.equal(
    transcript.privateMode.visibleToAuditor.privateReceipt.receiptHash,
    transcript.privateMode.visibleToMarket.privateReceiptHash
  );
  assert.notEqual(
    transcript.privateMode.visibleToAuditor.tamperedGrossSalesReceiptHash,
    transcript.privateMode.visibleToMarket.privateReceiptHash
  );
  assert.equal(transcript.expectedDelta.publicModeLeaksGrossSales, true);
  assert.equal(transcript.expectedDelta.privateModeLeaksGrossSales, false);
  assert.equal(
    transcript.expectedDelta.privateReceiptHash,
    transcript.privateMode.visibleToMarket.privateReceiptHash
  );

  const flow = buildDemoFlow();

  assert.deepEqual(
    flow.map((step) => step.key),
    ["public-leak", "encrypted-report", "ctx-settlement", "lender-receipt", "auditor-proof"]
  );
  assert.deepEqual(
    flow.map((step) => step.view),
    ["public", "merchant", "merchant", "lender", "auditor"]
  );
  assert.equal(flow[0].tone, "danger");
  assert.equal(flow[3].event.includes("Lender sees 99 qUSD"), true);
  assert.equal(flow[4].event.includes("tampered sales"), true);

  console.log("Demo transcript check passed.");
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
