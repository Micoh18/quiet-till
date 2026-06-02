import assert from "node:assert/strict";
import { buildTranscript } from "./demo-transcript.mjs";

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
  assert.equal(transcript.privateMode.visibleToAuditor.grossSales, 1_240);
  assert.equal(transcript.privateMode.visibleToAuditor.repaymentAmount, 99);
  assert.equal(transcript.privateMode.visibleToAuditor.outstandingAfter, 9_901);
  assert.equal(transcript.expectedDelta.publicModeLeaksGrossSales, true);
  assert.equal(transcript.expectedDelta.privateModeLeaksGrossSales, false);

  console.log("Demo transcript check passed.");
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
