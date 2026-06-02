import { keccak256 } from "viem";

import { buildDemoFlow, buildManifest, buildTranscript } from "./demo-fixture.mjs";

function buildJudgeEvidence(overrides) {
  const manifest = buildManifest(overrides);
  const transcript = buildTranscript(overrides);
  const flow = buildDemoFlow(overrides);
  const publicMode = transcript.publicMode.visibleToMarket;
  const privateMarket = transcript.privateMode.visibleToMarket;
  const lender = transcript.privateMode.visibleToLender;
  const auditor = transcript.privateMode.visibleToAuditor;
  const receipt = auditor.privateReceipt;
  const receiptCommitmentMatches =
    privateMarket.privateReceiptHash === receipt.receiptHash &&
    privateMarket.privateReceiptHash === auditor.receiptHash;
  const encodedPlaintextHash = keccak256(auditor.encodedPlaintext);
  const plaintextCommitmentMatches = encodedPlaintextHash === manifest.privateReport.plaintextCommitmentHash;
  const tamperDetected = auditor.tamperedGrossSalesReceiptHash !== privateMarket.privateReceiptHash;

  return {
    name: "Quiet Till Judge Evidence Bundle",
    version: 1,
    generatedAt: manifest.generatedAt,
    purpose:
      "Compact verifier for the demo: what leaks publicly, what stays private, and what an auditor can prove.",
    tracks: ["Compliant Onchain Finance", "Private Markets"],
    scenario: {
      merchant: transcript.scenario.merchant,
      chainId: manifest.chainId,
      loanId: manifest.privateReport.plaintext.loanId,
      merchantId: manifest.privateReport.plaintext.merchantId,
      dayIndex: manifest.privateReport.plaintext.dayIndex,
      repaymentRule: {
        repaymentBps: transcript.scenario.repaymentBps,
        maxDailyRepayment: manifest.setupCalls[1].args[6]
      }
    },
    demoMinuteFlow: flow.map((step, index) => ({
      order: index + 1,
      key: step.key,
      view: step.view,
      label: step.label,
      status: step.status,
      event: step.event
    })),
    publicObserver: {
      publicMode: {
        visibleGrossSales: publicMode.grossSales,
        visibleProjectedRepayment: publicMode.projectedRepayment,
        competitorSignal: publicMode.competitorSignal.code,
        risk: publicMode.competitorSignal.risk
      },
      quietTillMode: {
        reportStatus: privateMarket.reportStatus,
        encryptedReportHash: privateMarket.encryptedReportHash,
        privateReceiptHash: privateMarket.privateReceiptHash,
        visibleGrossSales: privateMarket.grossSales,
        visibleProjectedRepayment: privateMarket.projectedRepayment
      },
      privacyDelta: {
        publicModeLeaksGrossSales: transcript.expectedDelta.publicModeLeaksGrossSales,
        quietTillHidesGrossSales: privateMarket.grossSales === null,
        quietTillHidesProjectedRepayment: privateMarket.projectedRepayment === null
      }
    },
    lenderEvidence: {
      lender: lender.lender,
      paymentStatus: lender.paymentStatus,
      tokenSymbol: lender.tokenSymbol,
      repaymentAmount: lender.repaymentAmount,
      outstandingAfter: lender.outstandingAfter,
      privateReceiptHash: lender.privateReceiptHash,
      receiptCommitmentMatches: lender.privateReceiptHash === privateMarket.privateReceiptHash,
      fallbackPaymentIsPublic: lender.fallbackPaymentIsPublic,
      confidentialPaymentStatus: lender.confidentialPaymentStatus
    },
    auditorEvidence: {
      authorization: auditor.authorization,
      receiptHash: receipt.receiptHash,
      receiptCommitmentMatches,
      grossSales: auditor.grossSales,
      repaymentBps: auditor.repaymentBps,
      repaymentAmount: auditor.repaymentAmount,
      outstandingBefore: auditor.outstandingBefore,
      outstandingAfter: auditor.outstandingAfter,
      encodedPlaintextHash,
      plaintextCommitmentHash: manifest.privateReport.plaintextCommitmentHash,
      plaintextCommitmentMatches,
      receiptDomain: receipt.domain
    },
    tamperCheck: {
      tamperedField: "grossSales + 1",
      tamperedReceiptHash: auditor.tamperedGrossSalesReceiptHash,
      tamperDetected
    },
    complianceSla: {
      missingDayIndex: transcript.complianceSla.missingDayIndex,
      missingStatus: transcript.complianceSla.missingStatus,
      missingReportLeaksGrossSales: transcript.complianceSla.missingReportLeaksGrossSales,
      missingReportCreatesReceipt: transcript.complianceSla.missingReportCreatesReceipt,
      judgeTakeaway: transcript.complianceSla.judgeTakeaway
    },
    skalePrivacyUse: {
      encryptedReportStoredOnchain: true,
      biteReportPreparation: "scripts/prepare-private-report.mjs",
      ctxSettlementCallback: "DailySettlementWindow.onDecrypt(bytes[] decryptedArguments, bytes[] plaintextArguments)",
      ctxSubmitterPrecompile: "0x1B",
      plaintextCommitmentChecked: plaintextCommitmentMatches,
      publicLeakBlocked: privateMarket.grossSales === null && privateMarket.projectedRepayment === null
    },
    passConditions: {
      hasCompleteRoleFlow: flow.length === 5,
      noQuietTillPublicGrossSales: privateMarket.grossSales === null,
      noQuietTillPublicProjectedRepayment: privateMarket.projectedRepayment === null,
      lenderReceiptBinding: lender.privateReceiptHash === privateMarket.privateReceiptHash,
      auditorDisclosureAuthorized:
        auditor.authorization.canViewReceipt && !auditor.authorization.publicObserverCanViewReceipt,
      plaintextCommitmentBinding: plaintextCommitmentMatches,
      publicReceiptBinding: receiptCommitmentMatches,
      tamperSensitivity: tamperDetected,
      missingReportDoesNotLeakSales: transcript.complianceSla.missingReportLeaksGrossSales === false,
      missingReportDoesNotCreateReceipt: transcript.complianceSla.missingReportCreatesReceipt === false
    }
  };
}

export { buildJudgeEvidence };
