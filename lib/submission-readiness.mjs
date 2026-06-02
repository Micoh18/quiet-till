import { buildDemoVideoScript } from "./demo-video-script.mjs";
import { buildJudgeEvidence } from "./judge-evidence.mjs";

const readinessLevels = {
  readyLocal: "ready-local",
  readyDryRun: "ready-dry-run",
  pendingLive: "pending-live-skale",
  pendingSubmission: "pending-submission"
};

function buildSubmissionReadiness(overrides) {
  const evidence = buildJudgeEvidence(overrides);
  const video = buildDemoVideoScript(overrides);

  return {
    name: "Quiet Till Submission Readiness",
    version: 1,
    generatedAt: evidence.generatedAt,
    summary:
      "Tracks what is already reproducible in the repo, what is a declared fallback, and what still needs live hackathon submission evidence.",
    localEvidence: [
      {
        item: "Core contracts",
        status: readinessLevels.readyLocal,
        proof: "npm test",
        note: "Formula, permissions, settlement states, fallback vault, and privacy access checks are covered by Solidity tests."
      },
      {
        item: "Private report preparation",
        status: readinessLevels.readyLocal,
        proof: "npm run report:check",
        note: "Local check uses the official BITE mock path; live BITE requires SKALE env vars."
      },
      {
        item: "CTX-compatible settlement path",
        status: readinessLevels.readyDryRun,
        proof: "npm run skale:check",
        note: "Dry-run validates ABI, BITE envelope shape, planned submit call, and planned CTX request."
      },
      {
        item: "Public privacy surface",
        status: readinessLevels.readyLocal,
        proof: "npm run privacy:check",
        note: "Blocks obvious public ABI/event leaks for sales, exact repayment, auditor identity, and exact outstanding."
      },
      {
        item: "Demo story",
        status: readinessLevels.readyLocal,
        proof: "npm run transcript:check && npm run judge:check && npm run video:check",
        note: "Uses one deterministic flow across UI, judge evidence, and video script."
      },
      {
        item: "Full quality gate",
        status: readinessLevels.readyLocal,
        proof: "npm run verify",
        note: "Runs contracts, web build, manifests, privacy checks, local demo, evidence, video script, and audit."
      }
    ],
    declaredFallbacks: [
      {
        item: "Fallback payment token",
        status: readinessLevels.readyLocal,
        honestClaim:
          "The fallback ERC20 movement is intentionally public and demonstrates repayment movement only.",
        upgradePath: "Replace with SKALE confidential token settlement when the beta path is available."
      },
      {
        item: "Local decrypt callback",
        status: readinessLevels.readyLocal,
        honestClaim:
          "Local tests simulate post-decryption bytes while the contract also exposes the CTX callback shape.",
        upgradePath: "Run npm run skale:flow against a live SKALE Programmable Privacy chain."
      },
      {
        item: "Auditor disclosure",
        status: readinessLevels.readyLocal,
        honestClaim:
          "The MVP binds an offchain private receipt to an onchain hash and gates metadata reads by role.",
        upgradePath: "Use SKALE re-encryption if it is available in the hackathon environment."
      }
    ],
    liveSubmissionNeeds: [
      {
        item: "SKALE testnet deployment",
        status: readinessLevels.pendingLive,
        command: "npm run deploy:demo",
        requiredEvidence: "Deployment JSON with contract addresses and setup transaction hashes."
      },
      {
        item: "Live encrypted report and CTX request",
        status: readinessLevels.pendingLive,
        command: "npm run skale:flow",
        requiredEvidence: "Submit transaction hash, CTX request hash, request id, and public day status."
      },
      {
        item: "Demo video",
        status: readinessLevels.pendingSubmission,
        command: "npm run demo:video",
        requiredEvidence: "2-4 minute uploaded video link following the generated shot list."
      },
      {
        item: "DoraHacks submission",
        status: readinessLevels.pendingSubmission,
        command: "manual-submit",
        requiredEvidence: "Public repo URL, video URL, project description, and live/demo artifacts."
      }
    ],
    judgeProofs: {
      publicLeakShown: evidence.publicObserver.privacyDelta.publicModeLeaksGrossSales,
      quietTillHidesSales: evidence.passConditions.noQuietTillPublicGrossSales,
      lenderReceiptBinding: evidence.passConditions.lenderReceiptBinding,
      auditorDisclosureAuthorized: evidence.passConditions.auditorDisclosureAuthorized,
      tamperSensitivity: evidence.passConditions.tamperSensitivity,
      videoScriptReady: video.submissionChecklist.skalePrivacyNamed
    },
    commands: {
      localGate: "npm run verify",
      readiness: "npm run submit:readiness",
      liveDeploy: "npm run deploy:demo",
      livePrivateFlow: "npm run skale:flow",
      videoScript: "npm run demo:video"
    }
  };
}

export { buildSubmissionReadiness, readinessLevels };
