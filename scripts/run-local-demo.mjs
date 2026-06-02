import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { network } from "hardhat";
import {
  createPublicClient,
  createWalletClient,
  custom,
  parseEventLogs
} from "viem";

import { buildManifest, demo } from "../lib/demo-fixture.mjs";
import {
  assertPrivateReceiptHash,
  buildPrivateReceipt
} from "../lib/private-receipt.mjs";

const roleOrder = [
  "admin",
  "merchantOwner",
  "posAgent",
  "auditor",
  "lender",
  "decryptCallback"
];

const dayStatus = {
  Open: 0,
  ReportSubmitted: 1,
  DecryptRequested: 2,
  Settled: 3,
  Failed: 4,
  Missing: 5
};

const quiet = process.argv.includes("--quiet");

function jsonReplacer(_key, value) {
  return typeof value === "bigint" ? value.toString() : value;
}

async function loadArtifact(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function localChain(chainId) {
  return {
    id: chainId,
    name: "Hardhat In-Memory",
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18
    },
    rpcUrls: {
      default: {
        http: ["hardhat-in-memory"]
      }
    }
  };
}

function resolveManifestValue(value, deployed) {
  if (typeof value === "string" && value.startsWith("$contracts.")) {
    const contractName = value.split(".")[1];
    const contract = deployed[contractName];

    if (contract === undefined) {
      throw new Error(`Unknown contract placeholder: ${value}`);
    }

    return contract.address;
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveManifestValue(item, deployed));
  }

  return value;
}

async function deployContract({ artifact, args, publicClient, walletClient }) {
  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  assert.ok(receipt.contractAddress, "deployment did not return a contract address");

  return receipt.contractAddress;
}

async function runLocalDemo() {
  const connection = await network.create();

  try {
    const accounts = await connection.provider.request({
      method: "eth_accounts",
      params: []
    });
    const chainIdHex = await connection.provider.request({
      method: "eth_chainId",
      params: []
    });
    const chainId = Number(chainIdHex);
    const chain = localChain(chainId);
    const transport = custom(connection.provider);
    const publicClient = createPublicClient({ chain, transport });
    const actorOverrides = Object.fromEntries(
      roleOrder.map((role, index) => [role, accounts[index]])
    );
    const walletClients = Object.fromEntries(
      roleOrder.map((role) => [
        role,
        createWalletClient({
          account: actorOverrides[role],
          chain,
          transport
        })
      ])
    );
    const manifest = buildManifest({
      actors: actorOverrides,
      chainId
    });
    const deployed = {};

    for (const contract of manifest.contracts) {
      const artifact = await loadArtifact(contract.artifact);
      const args = resolveManifestValue(contract.constructorArgs ?? [], deployed);
      const address = await deployContract({
        artifact,
        args,
        publicClient,
        walletClient: walletClients.admin
      });

      deployed[contract.name] = {
        address,
        abi: artifact.abi
      };
    }

    async function writeContract({ contractName, functionName, args = [], from = "admin" }) {
      const contract = deployed[contractName];
      const hash = await walletClients[from].writeContract({
        address: contract.address,
        abi: contract.abi,
        functionName,
        args: resolveManifestValue(args, deployed)
      });

      return publicClient.waitForTransactionReceipt({ hash });
    }

    function readContract({ contractName, functionName, args = [], from }) {
      const contract = deployed[contractName];

      return publicClient.readContract({
        address: contract.address,
        abi: contract.abi,
        functionName,
        args,
        account: from === undefined ? undefined : actorOverrides[from]
      });
    }

    for (const call of manifest.setupCalls) {
      await writeContract({
        contractName: call.contract,
        functionName: call.function,
        args: call.args,
        from: call.from ?? "admin"
      });
    }

    await writeContract({
      contractName: "PublicModeSimulator",
      functionName: "reportPublicSales",
      args: [
        demo.merchant.id,
        manifest.privateReport.plaintext.dayIndex - 1,
        900,
        demo.loan.repaymentBps
      ]
    });
    await writeContract({
      contractName: "PublicModeSimulator",
      functionName: "reportPublicSales",
      args: [
        manifest.privateReport.plaintext.merchantId,
        manifest.privateReport.plaintext.dayIndex,
        manifest.privateReport.plaintext.grossSales,
        demo.loan.repaymentBps
      ]
    });

    const publicReport = await readContract({
      contractName: "PublicModeSimulator",
      functionName: "getReport",
      args: [manifest.privateReport.plaintext.merchantId, manifest.privateReport.plaintext.dayIndex]
    });
    assert.equal(Number(publicReport.grossSales), manifest.privateReport.plaintext.grossSales);
    assert.equal(Number(publicReport.projectedRepayment), manifest.expectedSettlement.repaymentAmount);

    await writeContract({
      contractName: "DailySettlementWindow",
      functionName: "submitEncryptedReportWithCommitment",
      args: [
        manifest.privateReport.plaintext.loanId,
        manifest.privateReport.plaintext.dayIndex,
        manifest.privateReport.encryptedReportPlaceholder,
        manifest.privateReport.plaintextCommitmentHash
      ],
      from: "posAgent"
    });

    const requestReceipt = await writeContract({
      contractName: "DailySettlementWindow",
      functionName: "requestDailySettlement",
      args: [manifest.privateReport.plaintext.loanId, manifest.privateReport.plaintext.dayIndex],
      from: "lender"
    });
    const requestedEvents = parseEventLogs({
      abi: deployed.DailySettlementWindow.abi,
      eventName: "DailySettlementRequested",
      logs: requestReceipt.logs
    });

    assert.equal(requestedEvents.length, 1, "expected one settlement request event");

    const requestId = requestedEvents[0].args.requestId;

    const decryptReceipt = await writeContract({
      contractName: "DailySettlementWindow",
      functionName: "onDecrypt",
      args: [requestId, manifest.privateReport.encodedPlaintext],
      from: "decryptCallback"
    });
    const decryptBlock = await publicClient.getBlock({
      blockNumber: decryptReceipt.blockNumber
    });

    const publicDayStatus = await readContract({
      contractName: "DailySettlementWindow",
      functionName: "getPublicDayStatus",
      args: [manifest.privateReport.plaintext.loanId, manifest.privateReport.plaintext.dayIndex]
    });
    const outstanding = await readContract({
      contractName: "RevenueLoan",
      functionName: "getOutstanding",
      args: [manifest.privateReport.plaintext.loanId],
      from: "lender"
    });
    const lenderBalance = await readContract({
      contractName: "MockPaymentToken",
      functionName: "balanceOf",
      args: [manifest.actors.lender]
    });
    const auditorCanView = await readContract({
      contractName: "AuditorDisclosure",
      functionName: "canViewReceipt",
      args: [publicDayStatus[2], manifest.actors.auditor],
      from: "auditor"
    });
    const auditorReceipt = buildPrivateReceipt({
      chainId,
      settlementWindow: deployed.DailySettlementWindow.address,
      auditor: manifest.actors.auditor,
      report: manifest.privateReport.plaintext,
      repaymentBps: demo.loan.repaymentBps,
      repaymentAmount: manifest.expectedSettlement.repaymentAmount,
      outstandingBefore: demo.loan.principal,
      outstandingAfter: manifest.expectedSettlement.outstandingAfter,
      settledAt: decryptBlock.timestamp,
      encodedPlaintext: manifest.privateReport.encodedPlaintext
    });

    assert.equal(Number(publicDayStatus[0]), dayStatus.Settled);
    assert.equal(publicDayStatus[1], manifest.privateReport.encryptedReportHash);
    assert.notEqual(publicDayStatus[2], "0x0000000000000000000000000000000000000000000000000000000000000000");
    assertPrivateReceiptHash(auditorReceipt, publicDayStatus[2]);
    assert.equal(Number(outstanding), manifest.expectedSettlement.outstandingAfter);
    assert.equal(Number(lenderBalance), manifest.expectedSettlement.repaymentAmount);
    assert.equal(auditorCanView, true);

    const missingDayIndex = manifest.privateReport.plaintext.dayIndex + 1;
    const latestBlock = await publicClient.getBlock();
    const missingReportDueAt = latestBlock.timestamp + 60n;

    await writeContract({
      contractName: "DailySettlementWindow",
      functionName: "openReportWindow",
      args: [
        manifest.privateReport.plaintext.loanId,
        missingDayIndex,
        missingReportDueAt
      ],
      from: "lender"
    });
    await connection.provider.request({
      method: "evm_increaseTime",
      params: [61]
    });
    await writeContract({
      contractName: "DailySettlementWindow",
      functionName: "markReportMissing",
      args: [manifest.privateReport.plaintext.loanId, missingDayIndex],
      from: "lender"
    });

    const missingDayStatus = await readContract({
      contractName: "DailySettlementWindow",
      functionName: "getPublicDayStatus",
      args: [manifest.privateReport.plaintext.loanId, missingDayIndex]
    });
    const missingDeadline = await readContract({
      contractName: "DailySettlementWindow",
      functionName: "getReportDeadline",
      args: [manifest.privateReport.plaintext.loanId, missingDayIndex]
    });

    assert.equal(Number(missingDayStatus[0]), dayStatus.Missing);
    assert.equal(missingDayStatus[1], "0x0000000000000000000000000000000000000000000000000000000000000000");
    assert.equal(missingDayStatus[2], "0x0000000000000000000000000000000000000000000000000000000000000000");
    assert.equal(missingDeadline, missingReportDueAt);

    return {
      name: "Quiet Till Local Settlement Demo",
      chainId,
      actors: manifest.actors,
      contracts: Object.fromEntries(
        Object.entries(deployed).map(([name, contract]) => [name, contract.address])
      ),
      publicMode: {
        visibleGrossSales: Number(publicReport.grossSales),
        projectedRepayment: Number(publicReport.projectedRepayment),
        competitorSignal: Number(publicReport.competitorSignal)
      },
      privateMode: {
        status: "Settled",
        encryptedReportHash: publicDayStatus[1],
        privateReceiptHash: publicDayStatus[2],
        publicGrossSales: null,
        outstandingAfter: Number(outstanding),
        lenderFallbackTokenBalance: Number(lenderBalance),
        auditorCanView,
        auditorReceipt
      },
      complianceSla: {
        missingDayIndex,
        missingReportStatus: "Missing",
        missingReportDueAt,
        missingReportLeaksSales: false,
        missingReportHasReceipt: false
      }
    };
  } finally {
    await connection.close();
  }
}

const result = await runLocalDemo();

if (quiet) {
  console.log("Local demo check passed.");
} else {
  console.log(JSON.stringify(result, jsonReplacer, 2));
}
