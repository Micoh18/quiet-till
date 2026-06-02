import assert from "node:assert/strict";
import { buildSubmissionReadiness, readinessLevels } from "../lib/submission-readiness.mjs";

function main() {
  const readiness = buildSubmissionReadiness();

  assert.equal(readiness.name, "Quiet Till Submission Readiness");
  assert.equal(readiness.version, 1);
  assert.equal(readiness.localEvidence.length, 6);
  assert.equal(readiness.declaredFallbacks.length, 3);
  assert.equal(readiness.liveSubmissionNeeds.length, 4);
  assert.equal(
    readiness.localEvidence.every((item) =>
      [readinessLevels.readyLocal, readinessLevels.readyDryRun].includes(item.status)
    ),
    true
  );
  assert.equal(
    readiness.liveSubmissionNeeds.every((item) =>
      [readinessLevels.pendingLive, readinessLevels.pendingSubmission].includes(item.status)
    ),
    true
  );
  assert.deepEqual(
    readiness.liveSubmissionNeeds.map((item) => item.item),
    [
      "SKALE testnet deployment",
      "Live encrypted report and CTX request",
      "Demo video",
      "DoraHacks submission"
    ]
  );
  assert.equal(readiness.judgeProofs.publicLeakShown, true);
  assert.equal(readiness.judgeProofs.quietTillHidesSales, true);
  assert.equal(readiness.judgeProofs.lenderReceiptBinding, true);
  assert.equal(readiness.judgeProofs.auditorDisclosureAuthorized, true);
  assert.equal(readiness.judgeProofs.tamperSensitivity, true);
  assert.equal(readiness.judgeProofs.videoScriptReady, true);
  assert.equal(readiness.commands.localGate, "npm run verify");
  assert.equal(readiness.commands.liveDeploy, "npm run deploy:demo");
  assert.equal(readiness.commands.livePrivateFlow, "npm run skale:flow");

  console.log("Submission readiness check passed.");
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
