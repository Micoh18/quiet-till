import assert from "node:assert/strict";
import { buildDemoVideoScript, renderDemoVideoScript } from "../lib/demo-video-script.mjs";

function main() {
  const script = buildDemoVideoScript();
  const rendered = renderDemoVideoScript(script);

  assert.equal(script.name, "Quiet Till Demo Video Script");
  assert.equal(script.version, 1);
  assert.equal(script.targetDurationSeconds, 180);
  assert.equal(script.segments.length, 7);
  assert.deepEqual(
    script.segments.map((segment) => segment.view),
    ["market", "public", "merchant", "merchant", "lender", "auditor", "auditor"]
  );
  assert.equal(script.guardrails.some((guardrail) => guardrail.includes("ZK")), true);
  assert.deepEqual(script.proofPoints.flowKeys, [
    "public-leak",
    "encrypted-report",
    "ctx-settlement",
    "lender-receipt",
    "auditor-proof"
  ]);
  assert.equal(script.submissionChecklist.publicLeakShown, true);
  assert.equal(script.submissionChecklist.privateSalesHidden, true);
  assert.equal(script.submissionChecklist.lenderReceiptShown, true);
  assert.equal(script.submissionChecklist.auditorTamperCheckShown, true);
  assert.equal(rendered.includes("0:20-0:50 - Public chain leak"), true);
  assert.equal(rendered.includes("Do not call the MVP ZK."), true);
  assert.equal(rendered.includes("lender-receipt"), true);

  console.log("Demo video script check passed.");
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
