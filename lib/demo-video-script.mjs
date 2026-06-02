import { buildDemoFlow, buildManifest, buildTranscript } from "./demo-fixture.mjs";
import { buildJudgeEvidence } from "./judge-evidence.mjs";

function money(value, symbol = "qUSD") {
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0
  }).format(value)} ${symbol}`;
}

function buildDemoVideoScript(overrides) {
  const manifest = buildManifest(overrides);
  const transcript = buildTranscript(overrides);
  const judgeEvidence = buildJudgeEvidence(overrides);
  const flow = buildDemoFlow(overrides);
  const publicMode = transcript.publicMode.visibleToMarket;
  const lender = transcript.privateMode.visibleToLender;
  const auditor = transcript.privateMode.visibleToAuditor;

  return {
    name: "Quiet Till Demo Video Script",
    version: 1,
    targetDurationSeconds: 180,
    generatedAt: manifest.generatedAt,
    guardrails: [
      "Do not call the MVP ZK.",
      "State that fallback token payments are public unless confidential tokens are integrated on the live SKALE environment.",
      "Show public-mode leakage before showing the private path."
    ],
    proofPoints: {
      encryptedReportHash: manifest.privateReport.encryptedReportHash,
      privateReceiptHash: transcript.privateMode.visibleToMarket.privateReceiptHash,
      tamperedReceiptHash: auditor.tamperedGrossSalesReceiptHash,
      flowKeys: flow.map((step) => step.key)
    },
    segments: [
      {
        startsAt: "0:00",
        endsAt: "0:20",
        view: "market",
        title: "Problem",
        action: "Open on the public/private comparison.",
        narration:
          "Revenue-based financing needs daily sales, but a public chain turns those sales into commercial intelligence."
      },
      {
        startsAt: "0:20",
        endsAt: "0:50",
        view: "public",
        title: "Public chain leak",
        action: `Show ${transcript.scenario.merchant} reporting ${money(publicMode.grossSales)} in public mode.`,
        narration: `The loan math works, but the market learns the register. The competitor signal is ${publicMode.competitorSignal.code}.`
      },
      {
        startsAt: "0:50",
        endsAt: "1:15",
        view: "merchant",
        title: "Encrypted POS report",
        action: "Click into the private path and show the ciphertext hash.",
        narration:
          "The POS agent submits an encrypted sales report. Public observers see a report hash, not gross sales."
      },
      {
        startsAt: "1:15",
        endsAt: "1:45",
        view: "merchant",
        title: "CTX settlement",
        action: "Request the close and show the settlement log advancing.",
        narration: `SKALE CTX decrypts at close, the contract computes ${money(transcript.expectedDelta.repaymentAmount)}, and outstanding becomes ${money(transcript.expectedDelta.outstandingAfter)}.`
      },
      {
        startsAt: "1:45",
        endsAt: "2:10",
        view: "lender",
        title: "Lender receipt",
        action: "Open the lender tab and show the payment receipt hash.",
        narration: `The lender sees a recorded ${money(lender.repaymentAmount, lender.tokenSymbol)} payment tied to the same private receipt hash.`
      },
      {
        startsAt: "2:10",
        endsAt: "2:40",
        view: "auditor",
        title: "Authorized audit",
        action: "Open the auditor proof and show the tamper check.",
        narration:
          "The authorized auditor can inspect sales, formula, repayment, and outstanding. A one-unit sales tamper produces a different hash."
      },
      {
        startsAt: "2:40",
        endsAt: "3:00",
        view: "auditor",
        title: "Close",
        action: "End on the judge evidence panel.",
        narration:
          "The business repays from real revenue without publishing its register. That is the SKALE privacy use case."
      }
    ],
    submissionChecklist: {
      publicLeakShown: judgeEvidence.publicObserver.privacyDelta.publicModeLeaksGrossSales,
      privateSalesHidden: judgeEvidence.passConditions.noQuietTillPublicGrossSales,
      lenderReceiptShown: judgeEvidence.passConditions.lenderReceiptBinding,
      auditorTamperCheckShown: judgeEvidence.passConditions.tamperSensitivity,
      skalePrivacyNamed: true
    }
  };
}

function renderDemoVideoScript(script) {
  const lines = [
    `# ${script.name}`,
    "",
    `Target duration: ${Math.round(script.targetDurationSeconds / 60)} minutes`,
    "",
    "## Guardrails",
    "",
    ...script.guardrails.map((item) => `- ${item}`),
    "",
    "## Shot List",
    ""
  ];

  for (const segment of script.segments) {
    lines.push(
      `### ${segment.startsAt}-${segment.endsAt} - ${segment.title}`,
      "",
      `View: ${segment.view}`,
      "",
      `Action: ${segment.action}`,
      "",
      `Narration: ${segment.narration}`,
      ""
    );
  }

  lines.push("## Proof Points", "");

  for (const [key, value] of Object.entries(script.proofPoints)) {
    lines.push(`- ${key}: ${Array.isArray(value) ? value.join(", ") : value}`);
  }

  lines.push("", "## Submission Checklist", "");

  for (const [key, value] of Object.entries(script.submissionChecklist)) {
    lines.push(`- ${key}: ${value ? "pass" : "fail"}`);
  }

  return `${lines.join("\n")}\n`;
}

export { buildDemoVideoScript, renderDemoVideoScript };
