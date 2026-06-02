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
    "0x0af07f4bf9d1a370ff86b672ddbd0053f9595087867001d798576e78f1c88628"
  );
  assert.equal(transcript.privateMode.visibleToLender.paymentStatus, "PaymentRecorded");
  assert.equal(transcript.privateMode.visibleToLender.tokenSymbol, "qUSD");
  assert.equal(transcript.privateMode.visibleToLender.repaymentAmount, 99);
  assert.equal(transcript.privateMode.visibleToLender.outstandingAfter, 9_901);
  assert.equal(
    transcript.privateMode.visibleToLender.privatePaymentCommitmentHash,
    "0x4ab387899f9fe69c8e350a6a9fba5d970b0a6839c36f86609867748d76d62424"
  );
  assert.equal(transcript.privateMode.visibleToLender.fallbackPaymentIsPublic, true);
  assert.equal(
    transcript.privateMode.visibleToLender.privateReceiptHash,
    transcript.privateMode.visibleToMarket.privateReceiptHash
  );
  assert.equal(transcript.privateMode.visibleToAuditor.authorization.canViewReceipt, true);
  assert.equal(transcript.privateMode.visibleToAuditor.authorization.publicObserverCanViewReceipt, false);
  assert.equal(
    transcript.privateMode.visibleToAuditor.authorization.disclosureMode,
    "Encrypted auditor receipt envelope"
  );
  assert.equal(
    transcript.privateMode.visibleToMarket.auditorDisclosureEnvelopeHash,
    "0xa485b57d21703ab3847037d479ec257315bcfb7f61eb2a0a287c506b3293ace0"
  );
  assert.equal(
    transcript.privateMode.visibleToAuditor.disclosureEnvelope.envelopeHash,
    transcript.privateMode.visibleToMarket.auditorDisclosureEnvelopeHash
  );
  assert.equal(
    transcript.privateMode.visibleToAuditor.disclosureEnvelope.receiptHash,
    transcript.privateMode.visibleToMarket.privateReceiptHash
  );
  assert.equal(
    transcript.privateMode.visibleToAuditor.disclosureEnvelope.mode,
    "local-aes-gcm-reencryption-fallback"
  );
  assert.equal(
    transcript.privateMode.visibleToAuditor.disclosureEnvelope.plaintextHash,
    "0x4efdce08ae31a212e3854b6ff12f196d20cf471505adf077d6f13ee9c137914c"
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
  assert.equal(transcript.complianceSla.missingDayIndex, 5);
  assert.equal(transcript.complianceSla.defaultTriggerDayIndex, 6);
  assert.equal(transcript.complianceSla.missingStatus, "Missing");
  assert.equal(transcript.complianceSla.defaultAfterMissedReports, 2);
  assert.equal(transcript.complianceSla.loanStatusAfterDefaultTrigger, "Defaulted");
  assert.equal(transcript.complianceSla.missingReportLeaksGrossSales, false);
  assert.equal(transcript.complianceSla.missingReportCreatesReceipt, false);
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
