import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  encodeAbiParameters,
  keccak256,
  numberToHex,
  parseAbiParameters,
  toHex
} from "viem";

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
    nonce: 99
  }
};

const addressBook = {
  MerchantRegistry: "$contracts.MerchantRegistry.address",
  RevenueLoan: "$contracts.RevenueLoan.address",
  AuditorDisclosure: "$contracts.AuditorDisclosure.address",
  MockPaymentToken: "$contracts.MockPaymentToken.address",
  SettlementVault: "$contracts.SettlementVault.address",
  DailySettlementWindow: "$contracts.DailySettlementWindow.address"
};

const salesReportAbi = parseAbiParameters(
  "uint256 loanId, uint256 merchantId, uint256 dayIndex, uint256 grossSales, uint256 nonce"
);

function repaymentFor({ grossSales, repaymentBps, maxDailyRepayment, outstanding }) {
  const rawRepayment = Math.floor((grossSales * repaymentBps) / 10_000);
  return Math.min(rawRepayment, maxDailyRepayment, outstanding);
}

function salesReportValue() {
  return [
    BigInt(demo.loan.id),
    BigInt(demo.merchant.id),
    BigInt(demo.report.dayIndex),
    BigInt(demo.report.grossSales),
    BigInt(demo.report.nonce)
  ];
}

function buildManifest() {
  const encodedSalesReport = encodeAbiParameters(salesReportAbi, salesReportValue());
  const encryptedReportPlaceholder = toHex("quiet-till:encrypted-sales-report:demo");
  const encryptedReportHash = keccak256(encryptedReportPlaceholder);
  const expectedRepayment = repaymentFor({
    grossSales: demo.report.grossSales,
    repaymentBps: demo.loan.repaymentBps,
    maxDailyRepayment: demo.loan.maxDailyRepayment,
    outstanding: demo.loan.principal
  });

  return {
    name: "Quiet Till Local Demo",
    version: 1,
    generatedAt: new Date(0).toISOString(),
    note: "This manifest is deterministic demo input. It does not contain encrypted production data.",
    chainId: demo.chainId,
    actors: demo.actors,
    contracts: [
      {
        name: "MerchantRegistry",
        artifact: "artifacts/contracts/MerchantRegistry.sol/MerchantRegistry.json",
        constructorArgs: [demo.actors.admin]
      },
      {
        name: "RevenueLoan",
        artifact: "artifacts/contracts/RevenueLoan.sol/RevenueLoan.json",
        constructorArgs: [demo.actors.admin, addressBook.MerchantRegistry]
      },
      {
        name: "AuditorDisclosure",
        artifact: "artifacts/contracts/AuditorDisclosure.sol/AuditorDisclosure.json",
        constructorArgs: [demo.actors.admin]
      },
      {
        name: "MockPaymentToken",
        artifact: "artifacts/contracts/MockPaymentToken.sol/MockPaymentToken.json",
        constructorArgs: [demo.token.name, demo.token.symbol, demo.token.decimals, demo.actors.admin]
      },
      {
        name: "SettlementVault",
        artifact: "artifacts/contracts/SettlementVault.sol/SettlementVault.json",
        constructorArgs: [demo.actors.admin, addressBook.MockPaymentToken]
      },
      {
        name: "DailySettlementWindow",
        artifact: "artifacts/contracts/DailySettlementWindow.sol/DailySettlementWindow.json",
        constructorArgs: [
          demo.actors.admin,
          addressBook.MerchantRegistry,
          addressBook.RevenueLoan,
          addressBook.AuditorDisclosure
        ]
      }
    ],
    setupCalls: [
      {
        contract: "MerchantRegistry",
        function: "registerMerchant",
        args: [
          demo.merchant.id,
          demo.actors.merchantOwner,
          demo.actors.posAgent,
          demo.actors.auditor,
          demo.merchant.displayName
        ]
      },
      {
        contract: "RevenueLoan",
        function: "createLoan",
        args: [
          demo.loan.id,
          demo.merchant.id,
          demo.actors.lender,
          demo.actors.merchantOwner,
          demo.loan.principal,
          demo.loan.repaymentBps,
          demo.loan.maxDailyRepayment
        ]
      },
      {
        contract: "RevenueLoan",
        function: "activateLoan",
        args: [demo.loan.id]
      },
      {
        contract: "DailySettlementWindow",
        function: "setDecryptCallback",
        args: [demo.actors.decryptCallback]
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
        args: [demo.actors.merchantOwner, demo.token.borrowerStartingBalance]
      },
      {
        contract: "MockPaymentToken",
        function: "approve",
        from: "merchantOwner",
        args: [addressBook.SettlementVault, demo.token.vaultAllowance]
      }
    ],
    privateReport: {
      abi: "tuple(uint256 loanId, uint256 merchantId, uint256 dayIndex, uint256 grossSales, uint256 nonce)",
      plaintext: {
        loanId: demo.loan.id,
        merchantId: demo.merchant.id,
        dayIndex: demo.report.dayIndex,
        grossSales: demo.report.grossSales,
        nonce: demo.report.nonce
      },
      encodedPlaintext: encodedSalesReport,
      encryptedReportPlaceholder,
      encryptedReportHash
    },
    expectedSettlement: {
      repaymentAmount: expectedRepayment,
      outstandingAfter: demo.loan.principal - expectedRepayment,
      repaymentAmountHex: numberToHex(expectedRepayment)
    }
  };
}

async function writeManifest(filePath, manifest) {
  const destination = resolve(filePath);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return destination;
}

async function main() {
  const manifest = buildManifest();
  const outIndex = process.argv.indexOf("--out");

  if (outIndex !== -1) {
    const outPath = process.argv[outIndex + 1];

    if (!outPath) {
      throw new Error("--out requires a file path");
    }

    const destination = await writeManifest(outPath, manifest);
    console.log(`Wrote demo manifest to ${destination}`);
    return;
  }

  console.log(JSON.stringify(manifest, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export { buildManifest };
