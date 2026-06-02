import {
  keccak256,
  numberToHex,
  toHex
} from "viem";

import { encodeSalesReportPlaintext, salesReportAbi } from "./sales-report.mjs";
import {
  buildPrivateReceipt,
  privateReceiptHash
} from "./private-receipt.mjs";

const demo = {
  chainId: 31337,
  actors: {
    admin: "0x1000000000000000000000000000000000000001",
    merchantOwner: "0x1000000000000000000000000000000000000002",
    posAgent: "0x1000000000000000000000000000000000000003",
    auditor: "0x1000000000000000000000000000000000000004",
    lender: "0x1000000000000000000000000000000000000005",
    decryptCallback: "0x1000000000000000000000000000000000000006"
  },
  merchant: {
    id: 101,
    displayName: "La Barra"
  },
  loan: {
    id: 1,
    principal: 10_000,
    repaymentBps: 800,
    maxDailyRepayment: 500
  },
  token: {
    name: "Quiet Till Mock Dollar",
    symbol: "qUSD",
    decimals: 2,
    borrowerStartingBalance: 10_000,
    vaultAllowance: 500
  },
  report: {
    dayIndex: 4,
    grossSales: 1_240,
    nonce: "24197857200151252728969465429440056815"
  },
  proof: {
    settlementWindow: "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
    settledAt: 0
  }
};

const addressBook = {
  MerchantRegistry: "$contracts.MerchantRegistry.address",
  RevenueLoan: "$contracts.RevenueLoan.address",
  AuditorDisclosure: "$contracts.AuditorDisclosure.address",
  MockPaymentToken: "$contracts.MockPaymentToken.address",
  SettlementVault: "$contracts.SettlementVault.address",
  DailySettlementWindow: "$contracts.DailySettlementWindow.address",
  PublicModeSimulator: "$contracts.PublicModeSimulator.address"
};

function withDemoOverrides(overrides = {}) {
  return {
    ...demo,
    ...overrides,
    actors: {
      ...demo.actors,
      ...(overrides.actors ?? {})
    },
    merchant: {
      ...demo.merchant,
      ...(overrides.merchant ?? {})
    },
    loan: {
      ...demo.loan,
      ...(overrides.loan ?? {})
    },
    token: {
      ...demo.token,
      ...(overrides.token ?? {})
    },
    report: {
      ...demo.report,
      ...(overrides.report ?? {})
    },
    proof: {
      ...demo.proof,
      ...(overrides.proof ?? {})
    }
  };
}

function repaymentFor({ grossSales, repaymentBps, maxDailyRepayment, outstanding }) {
  const rawRepayment = Math.floor((grossSales * repaymentBps) / 10_000);
  return Math.min(rawRepayment, maxDailyRepayment, outstanding);
}

function competitorSignalFromSales({ baselineSales, grossSales }) {
  if (baselineSales === 0) {
    return {
      code: "NO_BASELINE",
      label: "No prior public sales baseline.",
      risk: "The first public report immediately reveals a raw daily sales number."
    };
  }

  if (grossSales * 100 >= baselineSales * 125) {
    return {
      code: "STRONG_DAY",
      label: "Sales are at least 25% above the public baseline.",
      risk: "A supplier or competitor can identify a strong trading day and adjust terms."
    };
  }

  if (grossSales * 100 <= baselineSales * 75) {
    return {
      code: "WEAK_DAY",
      label: "Sales are at least 25% below the public baseline.",
      risk: "A rival lender can infer stress from the public sales drop."
    };
  }

  return {
    code: "STABLE",
    label: "Sales are close to the public baseline.",
    risk: "Even stable sales become a public operating signal over time."
  };
}

function buildManifest(overrides) {
  const demoInput = withDemoOverrides(overrides);
  const encodedSalesReport = encodeSalesReportPlaintext({
    loanId: demoInput.loan.id,
    merchantId: demoInput.merchant.id,
    dayIndex: demoInput.report.dayIndex,
    grossSales: demoInput.report.grossSales,
    nonce: demoInput.report.nonce
  });
  const plaintextCommitmentHash = keccak256(encodedSalesReport);
  const encryptedReportPlaceholder = toHex("quiet-till:encrypted-sales-report:demo");
  const encryptedReportHash = keccak256(encryptedReportPlaceholder);
  const expectedRepayment = repaymentFor({
    grossSales: demoInput.report.grossSales,
    repaymentBps: demoInput.loan.repaymentBps,
    maxDailyRepayment: demoInput.loan.maxDailyRepayment,
    outstanding: demoInput.loan.principal
  });

  return {
    name: "Quiet Till Local Demo",
    version: 1,
    generatedAt: new Date(0).toISOString(),
    note: "This manifest is deterministic demo input. It does not contain encrypted production data.",
    chainId: demoInput.chainId,
    actors: demoInput.actors,
    contracts: [
      {
        name: "MerchantRegistry",
        artifact: "artifacts/contracts/MerchantRegistry.sol/MerchantRegistry.json",
        constructorArgs: [demoInput.actors.admin]
      },
      {
        name: "RevenueLoan",
        artifact: "artifacts/contracts/RevenueLoan.sol/RevenueLoan.json",
        constructorArgs: [demoInput.actors.admin, addressBook.MerchantRegistry]
      },
      {
        name: "AuditorDisclosure",
        artifact: "artifacts/contracts/AuditorDisclosure.sol/AuditorDisclosure.json",
        constructorArgs: [demoInput.actors.admin]
      },
      {
        name: "MockPaymentToken",
        artifact: "artifacts/contracts/MockPaymentToken.sol/MockPaymentToken.json",
        constructorArgs: [demoInput.token.name, demoInput.token.symbol, demoInput.token.decimals, demoInput.actors.admin]
      },
      {
        name: "SettlementVault",
        artifact: "artifacts/contracts/SettlementVault.sol/SettlementVault.json",
        constructorArgs: [demoInput.actors.admin, addressBook.MockPaymentToken]
      },
      {
        name: "DailySettlementWindow",
        artifact: "artifacts/contracts/DailySettlementWindow.sol/DailySettlementWindow.json",
        constructorArgs: [
          demoInput.actors.admin,
          addressBook.MerchantRegistry,
          addressBook.RevenueLoan,
          addressBook.AuditorDisclosure
        ]
      },
      {
        name: "PublicModeSimulator",
        artifact: "artifacts/contracts/PublicModeSimulator.sol/PublicModeSimulator.json",
        constructorArgs: []
      }
    ],
    setupCalls: [
      {
        contract: "MerchantRegistry",
        function: "registerMerchant",
        args: [
          demoInput.merchant.id,
          demoInput.actors.merchantOwner,
          demoInput.actors.posAgent,
          demoInput.actors.auditor,
          demoInput.merchant.displayName
        ]
      },
      {
        contract: "RevenueLoan",
        function: "createLoan",
        args: [
          demoInput.loan.id,
          demoInput.merchant.id,
          demoInput.actors.lender,
          demoInput.actors.merchantOwner,
          demoInput.loan.principal,
          demoInput.loan.repaymentBps,
          demoInput.loan.maxDailyRepayment
        ]
      },
      {
        contract: "RevenueLoan",
        function: "activateLoan",
        args: [demoInput.loan.id]
      },
      {
        contract: "DailySettlementWindow",
        function: "setDecryptCallback",
        args: [demoInput.actors.decryptCallback]
      },
      {
        contract: "DailySettlementWindow",
        function: "setSettlementVault",
        args: [addressBook.SettlementVault]
      },
      {
        contract: "RevenueLoan",
        function: "setSettlementWindow",
        args: [addressBook.DailySettlementWindow]
      },
      {
        contract: "AuditorDisclosure",
        function: "setSettlementWindow",
        args: [addressBook.DailySettlementWindow]
      },
      {
        contract: "SettlementVault",
        function: "setSettlementWindow",
        args: [addressBook.DailySettlementWindow]
      },
      {
        contract: "MockPaymentToken",
        function: "mint",
        args: [demoInput.actors.merchantOwner, demoInput.token.borrowerStartingBalance]
      },
      {
        contract: "MockPaymentToken",
        function: "approve",
        from: "merchantOwner",
        args: [addressBook.SettlementVault, demoInput.token.vaultAllowance]
      }
    ],
    privateReport: {
      abi: "tuple(uint256 loanId, uint256 merchantId, uint256 dayIndex, uint256 grossSales, uint256 nonce)",
      plaintext: {
        loanId: demoInput.loan.id,
        merchantId: demoInput.merchant.id,
        dayIndex: demoInput.report.dayIndex,
        grossSales: demoInput.report.grossSales,
        nonce: demoInput.report.nonce
      },
      encodedPlaintext: encodedSalesReport,
      plaintextCommitmentHash,
      encryptedReportPlaceholder,
      encryptedReportHash
    },
    reportSla: {
      missingDayIndex: demoInput.report.dayIndex + 1,
      defaultTriggerDayIndex: demoInput.report.dayIndex + 2,
      deadlineGraceSeconds: 60,
      missingStatus: "Missing",
      defaultAfterMissedReports: 2,
      loanStatusAfterDefaultTrigger: "Defaulted",
      publicGrossSalesOnMissing: null,
      publicReceiptHashOnMissing: null
    },
    expectedSettlement: {
      repaymentAmount: expectedRepayment,
      outstandingAfter: demoInput.loan.principal - expectedRepayment,
      repaymentAmountHex: numberToHex(expectedRepayment)
    }
  };
}

function buildTranscript(overrides) {
  const demoInput = withDemoOverrides(overrides);
  const manifest = buildManifest(overrides);
  const publicBaselineSales = 900;
  const publicSignal = competitorSignalFromSales({
    baselineSales: publicBaselineSales,
    grossSales: manifest.privateReport.plaintext.grossSales
  });
  const auditorReceipt = buildPrivateReceipt({
    chainId: manifest.chainId,
    settlementWindow: demoInput.proof.settlementWindow,
    auditor: manifest.actors.auditor,
    report: manifest.privateReport.plaintext,
    repaymentBps: manifest.setupCalls[1].args[5],
    repaymentAmount: manifest.expectedSettlement.repaymentAmount,
    outstandingBefore: manifest.setupCalls[1].args[4],
    outstandingAfter: manifest.expectedSettlement.outstandingAfter,
    settledAt: demoInput.proof.settledAt,
    encodedPlaintext: manifest.privateReport.encodedPlaintext
  });
  const tamperedGrossSalesReceiptHash = privateReceiptHash({
    ...auditorReceipt,
    grossSales: auditorReceipt.grossSales + 1
  });

  return {
    name: "Quiet Till Demo Transcript",
    version: 1,
    generatedAt: manifest.generatedAt,
    scenario: {
      merchant: "La Barra",
      loanPrincipal: manifest.setupCalls[1].args[4],
      repaymentBps: manifest.setupCalls[1].args[5],
      dayIndex: manifest.privateReport.plaintext.dayIndex
    },
    publicMode: {
      title: "Public chain settlement leaks the register",
      visibleToMarket: {
        merchantId: manifest.privateReport.plaintext.merchantId,
        dayIndex: manifest.privateReport.plaintext.dayIndex,
        grossSales: manifest.privateReport.plaintext.grossSales,
        projectedRepayment: manifest.expectedSettlement.repaymentAmount,
        publicBaselineSales,
        competitorSignal: publicSignal
      },
      judgeTakeaway:
        "The contract can calculate repayment, but the market learns the merchant's daily sales."
    },
    privateMode: {
      title: "Quiet Till settlement keeps the register silent",
      visibleToMarket: {
        reportStatus: "ReportSubmitted",
        encryptedReportHash: manifest.privateReport.encryptedReportHash,
        privateReceiptHash: auditorReceipt.receiptHash,
        grossSales: null,
        projectedRepayment: null
      },
      visibleToLender: {
        lender: manifest.actors.lender,
        tokenSymbol: demoInput.token.symbol,
        paymentStatus: "PaymentRecorded",
        repaymentAmount: manifest.expectedSettlement.repaymentAmount,
        outstandingAfter: manifest.expectedSettlement.outstandingAfter,
        privateReceiptHash: auditorReceipt.receiptHash,
        fallbackPaymentIsPublic: true,
        confidentialPaymentStatus: "Confidential token settlement remains a beta integration target."
      },
      visibleToAuditor: {
        authorization: {
          auditor: manifest.actors.auditor,
          canViewReceipt: true,
          publicObserverCanViewReceipt: false,
          disclosureMode: "Role-authorized receipt metadata"
        },
        grossSales: manifest.privateReport.plaintext.grossSales,
        repaymentBps: manifest.setupCalls[1].args[5],
        repaymentAmount: manifest.expectedSettlement.repaymentAmount,
        outstandingBefore: manifest.setupCalls[1].args[4],
        outstandingAfter: manifest.expectedSettlement.outstandingAfter,
        encodedPlaintext: manifest.privateReport.encodedPlaintext,
        privateReceipt: auditorReceipt,
        receiptHash: auditorReceipt.receiptHash,
        receiptHashVerified: true,
        tamperedGrossSalesReceiptHash
      },
      judgeTakeaway:
        "The same repayment is verifiable after settlement, while public observers only see hashes and state."
    },
    complianceSla: {
      missingDayIndex: manifest.reportSla.missingDayIndex,
      defaultTriggerDayIndex: manifest.reportSla.defaultTriggerDayIndex,
      missingStatus: manifest.reportSla.missingStatus,
      defaultAfterMissedReports: manifest.reportSla.defaultAfterMissedReports,
      loanStatusAfterDefaultTrigger: manifest.reportSla.loanStatusAfterDefaultTrigger,
      missingReportLeaksGrossSales: manifest.reportSla.publicGrossSalesOnMissing !== null,
      missingReportCreatesReceipt: manifest.reportSla.publicReceiptHashOnMissing !== null,
      judgeTakeaway:
        "Repeated missed closes can default the loan through public covenant state without estimating the merchant's sales."
    },
    expectedDelta: {
      publicModeLeaksGrossSales: true,
      privateModeLeaksGrossSales: false,
      repaymentAmount: manifest.expectedSettlement.repaymentAmount,
      outstandingAfter: manifest.expectedSettlement.outstandingAfter,
      privateReceiptHash: auditorReceipt.receiptHash
    }
  };
}

function buildDemoFlow(overrides) {
  const transcript = buildTranscript(overrides);
  const manifest = buildManifest(overrides);
  const auditor = transcript.privateMode.visibleToAuditor;

  return [
    {
      key: "public-leak",
      view: "public",
      label: "Public leak",
      status: "Sales exposed",
      event: `${transcript.scenario.merchant} reports ${transcript.publicMode.visibleToMarket.grossSales} qUSD and the market derives ${transcript.publicMode.visibleToMarket.competitorSignal.code}.`,
      tone: "danger"
    },
    {
      key: "encrypted-report",
      view: "merchant",
      label: "Encrypted report",
      status: "Ciphertext stored",
      event: `POS stores ${manifest.privateReport.encryptedReportHash.slice(0, 10)}...${manifest.privateReport.encryptedReportHash.slice(-8)} and commits to the sealed plaintext.`,
      tone: "good"
    },
    {
      key: "ctx-settlement",
      view: "merchant",
      label: "CTX settlement",
      status: "Repayment computed",
      event: `Settlement applies ${transcript.expectedDelta.repaymentAmount} qUSD and leaves outstanding at ${transcript.expectedDelta.outstandingAfter} qUSD.`,
      tone: "good"
    },
    {
      key: "lender-receipt",
      view: "lender",
      label: "Lender receipt",
      status: "Payment recorded",
      event: `Lender sees ${transcript.privateMode.visibleToLender.repaymentAmount} ${transcript.privateMode.visibleToLender.tokenSymbol} recorded against the private receipt hash.`,
      tone: "good"
    },
    {
      key: "auditor-proof",
      view: "auditor",
      label: "Auditor proof",
      status: "Receipt verified",
      event: `Auditor receipt matches ${auditor.receiptHash.slice(0, 10)}...${auditor.receiptHash.slice(-8)}; tampered sales produce a different hash.`,
      tone: "good"
    }
  ];
}

export { buildDemoFlow, buildManifest, buildTranscript, competitorSignalFromSales, demo, repaymentFor, salesReportAbi, withDemoOverrides };
