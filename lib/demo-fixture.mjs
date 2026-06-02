import {
  getAddress,
  keccak256,
  numberToHex,
  toHex
} from "viem";

import { encodeSalesReportPlaintext, salesReportAbi } from "./sales-report.mjs";
import {
  buildPrivateReceipt,
  privateReceiptHash
} from "./private-receipt.mjs";
import { buildPaymentCommitment } from "./private-payment-commitment.mjs";

const demoAuditorDisclosureKeyMaterial = "quiet-till-local-auditor-demo-key-v1";

const demoAuditorDisclosureEnvelopeTemplate = {
  version: 1,
  domain: "QUIET_TILL_AUDITOR_DISCLOSURE_ENVELOPE_V1",
  mode: "local-aes-gcm-reencryption-fallback",
  plaintextHash: "0x4efdce08ae31a212e3854b6ff12f196d20cf471505adf077d6f13ee9c137914c",
  aadHash: "0xeed60bd09c48a0de7bef7f3612eecbdd7daa555e228f001a173731093ded5706",
  keyFingerprint: "0x8743c558f0f8595410dc1f640ff7cf3f3e774e9d10314e0cb43322b1fa1506af",
  iv: "0xd4641f75cc42e737a2469906",
  ciphertext:
    "0x964f5662d4b01d7aedcedce4dd0d01dc7a477b5cea273f5c53c0075dc0f4676d22e2c2362e231c312a0024eefa4f767cb4b92fa6f47dbd992f0b1f7f92cfa78db551aa1bf42a2d68b66190e931a1f927a5942200176cd435836110723f2e47f2993ff30dec53e915e326b18abd8d54fbb3a49eccccf24956088d0523989e5bcdc0b776aa7e1de342d36123c38fcd392a02bed9ca5cb42e2eee11ee7158b369fc061fa82d94233b3ef180ed35699c7ab372e103b3d2ce17a315db68a74aa36c5b86a8a8cb4369658a05f70e654ec8ebae49581a7389a771a0688ce3c8f0ed1c92507a52ed327ee78d865e2770300e2478da25970132e65febc954ac5766e72ddfaf29e2175a36cb88799cd992b64b5447aa11b7ec2ec216262b4f67bbca6348ef1390aa52a1b82d7a2e818a3c15f71b794e51a60dbd04d8e89f2ab7ea9ec4798764ea476cfad947e69d70df220230096869794f0b6ece0a926b44614056629e14834f761ad440c7854deb894fb3ce4c4bbe2df3971e92d9e6b3cf46521aaf2085810791c90495a3fadea48718f05010e5b0654bab69550b382647e8b243d7785608baf7c26ed7aeb53122b610b70261eaa49a74a3b0ac45d10a355dd70140ea278d26089a7ee56391b91198f72811bd0a33a4bed72a0002e3191f831fbc274c61a636ce56481c24539c18207b79c75c3904bb2b9a2560435a2a0aaa362cb612f992c57f136f574ef460e6c542c1f845f1a4ed0fe2b7fa4fc579530799a536e9418b91c5d0df501caf310c65e77c43c53169938d825f7113a8196522ac03192c10225be79b4116702e9a438f8da8b15ca6ccf6a069522a5611a0d134ab61bff890912c9d79983a384af0361929164aa1aee5a474d2b37b3842214361aa62264e66f2b4297c75350d6d581f565634cde21f8596aa020c7f0de4682d7709e6024bd20edb19aa2cce6c3e7e7b2a3b8810f36cd43e41ab4cad09f298d66b0c8c98340a62cdbab62567096ddc87083a8f376fe59e6c3a1846fb66278a5264e33699f17c62c8b2a1a59f9f6dbdfb5aeeaef1dfbb3c12e7730f14a7ac02b6b3b7e8b86a8914b34580d253ac1beabb85873b4982339866af7041407d626e22cfde6a7fff31a64495b2c1d92884b67ffadaf6b1446459d0c624009c2104e3d3dc72",
  authTag: "0x78e3d92ab54c863e04477780366b36d9",
  envelopeHash: "0xa485b57d21703ab3847037d479ec257315bcfb7f61eb2a0a287c506b3293ace0"
};

function buildDemoAuditorDisclosureEnvelope({ receipt, auditor }) {
  return {
    ...demoAuditorDisclosureEnvelopeTemplate,
    recipient: getAddress(auditor),
    receiptHash: receipt.receiptHash
  };
}

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
    paymentRail: "0x00000000000000000000000000000000000000b1",
    settledAt: 0
  }
};

const addressBook = {
  MerchantRegistry: "$contracts.MerchantRegistry.address",
  RevenueLoan: "$contracts.RevenueLoan.address",
  AuditorDisclosure: "$contracts.AuditorDisclosure.address",
  MockPaymentToken: "$contracts.MockPaymentToken.address",
  SettlementVault: "$contracts.SettlementVault.address",
  ConfidentialPaymentRail: "$contracts.ConfidentialPaymentRail.address",
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
        name: "ConfidentialPaymentRail",
        artifact: "artifacts/contracts/ConfidentialPaymentRail.sol/ConfidentialPaymentRail.json",
        constructorArgs: [demoInput.actors.admin]
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
        contract: "DailySettlementWindow",
        function: "setConfidentialPaymentRail",
        args: [addressBook.ConfidentialPaymentRail]
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
        contract: "ConfidentialPaymentRail",
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
      curedDayIndex: demoInput.report.dayIndex + 1,
      missingDayIndex: demoInput.report.dayIndex + 2,
      defaultTriggerDayIndex: demoInput.report.dayIndex + 3,
      deadlineGraceSeconds: 60,
      curePeriodSeconds: 86_400,
      missingStatus: "Missing",
      cureStatus: "Cured",
      missedReportCountAfterCure: 0,
      defaultAfterMissedReports: 2,
      loanStatusAfterDefaultTrigger: "Defaulted",
      publicGrossSalesOnCure: null,
      publicReceiptHashOnCure: null,
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
  const auditorDisclosureEnvelope = buildDemoAuditorDisclosureEnvelope({
    receipt: auditorReceipt,
    auditor: manifest.actors.auditor
  });
  const paymentCommitmentHash = buildPaymentCommitment({
    chainId: manifest.chainId,
    paymentRail: demoInput.proof.paymentRail,
    loanId: manifest.privateReport.plaintext.loanId,
    dayIndex: manifest.privateReport.plaintext.dayIndex,
    payer: manifest.actors.merchantOwner,
    payee: manifest.actors.lender,
    repaymentAmount: manifest.expectedSettlement.repaymentAmount,
    nonce: manifest.privateReport.plaintext.nonce,
    privateReceiptHash: auditorReceipt.receiptHash
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
        auditorDisclosureEnvelopeHash: auditorDisclosureEnvelope.envelopeHash,
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
        privatePaymentCommitmentHash: paymentCommitmentHash,
        fallbackPaymentIsPublic: true,
        confidentialPaymentStatus:
          "Private payment rail records an amount-hiding commitment; fallback token transfer remains public."
      },
      visibleToAuditor: {
        authorization: {
          auditor: manifest.actors.auditor,
          canViewReceipt: true,
          publicObserverCanViewReceipt: false,
          disclosureMode: "Encrypted auditor receipt envelope"
        },
        disclosureEnvelope: auditorDisclosureEnvelope,
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
      curedDayIndex: manifest.reportSla.curedDayIndex,
      missingDayIndex: manifest.reportSla.missingDayIndex,
      defaultTriggerDayIndex: manifest.reportSla.defaultTriggerDayIndex,
      missingStatus: manifest.reportSla.missingStatus,
      cureStatus: manifest.reportSla.cureStatus,
      curePeriodSeconds: manifest.reportSla.curePeriodSeconds,
      missedReportCountAfterCure: manifest.reportSla.missedReportCountAfterCure,
      defaultAfterMissedReports: manifest.reportSla.defaultAfterMissedReports,
      loanStatusAfterDefaultTrigger: manifest.reportSla.loanStatusAfterDefaultTrigger,
      lateCureLeaksGrossSales: manifest.reportSla.publicGrossSalesOnCure !== null,
      lateCureCreatesReceiptForMarket: manifest.reportSla.publicReceiptHashOnCure !== null,
      missingReportLeaksGrossSales: manifest.reportSla.publicGrossSalesOnMissing !== null,
      missingReportCreatesReceipt: manifest.reportSla.publicReceiptHashOnMissing !== null,
      judgeTakeaway:
        "A missed close can be cured by a late encrypted report; repeated uncured misses can default the loan without estimating the merchant's sales."
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
      key: "late-cure",
      view: "merchant",
      label: "Late cure",
      status: "Strike removed",
      event: `Day ${transcript.complianceSla.curedDayIndex} is marked missing, then cured inside ${transcript.complianceSla.curePeriodSeconds / 3_600}h with a sealed report; sales stay hidden.`,
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

export {
  buildDemoFlow,
  buildManifest,
  buildTranscript,
  competitorSignalFromSales,
  demo,
  demoAuditorDisclosureKeyMaterial,
  repaymentFor,
  salesReportAbi,
  withDemoOverrides
};
