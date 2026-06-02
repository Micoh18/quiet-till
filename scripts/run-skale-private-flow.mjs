import assert from "node:assert/strict";

import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  parseEventLogs
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { buildManifest } from "../lib/demo-fixture.mjs";
import {
  encryptSalesReportForCTX,
  mockEncryptSalesReportForCTX
} from "../lib/private-report.mjs";
import {
  assertAddress,
  jsonReplacer,
  loadArtifact,
  loadJson,
  missingEnv,
  normalizePrivateKey,
  requireEnv,
  requirePositiveIntegerEnv,
  targetChain
} from "../lib/script-utils.mjs";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const quiet = args.has("--quiet");

const defaultDeploymentFile = "deployments/quiet-till-demo.json";
const defaultCallbackGas = 500_000n;

const requiredLiveEnv = [
  "QUIET_TILL_RPC_URL",
  "QUIET_TILL_CHAIN_ID",
  "QUIET_TILL_POS_AGENT_PRIVATE_KEY",
  "QUIET_TILL_LENDER_PRIVATE_KEY"
];

function deploymentFilePath() {
  return process.env.QUIET_TILL_DEPLOYMENT_FILE
    ?? process.env.QUIET_TILL_DEPLOY_OUTPUT
    ?? defaultDeploymentFile;
}

function optionalPositiveBigIntEnv(name, fallback) {
  const value = process.env[name];

  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  const parsed = BigInt(value.trim());

  if (parsed < 0n) {
    throw new Error(`${name} must be greater than or equal to zero`);
  }

  return parsed;
}

function requireContractAddress(deployment, contractName) {
  const address = deployment.contracts?.[contractName]?.address;

  if (address === undefined) {
    throw new Error(`Deployment is missing ${contractName}.address`);
  }

  assertAddress(address, `${contractName}.address`);

  return getAddress(address);
}

function assertActorMatchesDeployment({ deployment, actorName, actualAddress, envName }) {
  const expected = deployment.actors?.[actorName];

  if (expected === undefined) {
    return;
  }

  assertAddress(expected, `deployment.actors.${actorName}`);

  if (getAddress(expected) !== getAddress(actualAddress)) {
    throw new Error(`${envName} does not match deployment actor ${actorName}`);
  }
}

function ctxCallbackGas() {
  const gas = optionalPositiveBigIntEnv("QUIET_TILL_CTX_CALLBACK_GAS", defaultCallbackGas);

  if (gas === 0n) {
    throw new Error("QUIET_TILL_CTX_CALLBACK_GAS must be greater than zero");
  }

  return gas;
}

function ctxCallbackFundingWei() {
  return optionalPositiveBigIntEnv("QUIET_TILL_CTX_CALLBACK_FUNDING_WEI", 0n);
}

async function loadWindowArtifact() {
  return loadArtifact("artifacts/contracts/DailySettlementWindow.sol/DailySettlementWindow.json");
}

async function buildDryRunPlan() {
  const manifest = buildManifest();
  const artifact = await loadWindowArtifact();
  const encryptedReportEnvelope = await mockEncryptSalesReportForCTX({
    encodedPlaintext: manifest.privateReport.encodedPlaintext
  });
  const functionNames = new Set(
    artifact.abi.filter((entry) => entry.type === "function").map((entry) => entry.name)
  );

  for (const functionName of [
    "submitEncryptedReportWithCommitment",
    "requestDailySettlementViaCTX",
    "getPublicDayStatus"
  ]) {
    assert.equal(functionNames.has(functionName), true, `DailySettlementWindow ABI missing ${functionName}`);
  }

  return {
    mode: "dry-run",
    ok: true,
    requiredLiveEnv,
    optionalEnv: [
      "QUIET_TILL_DEPLOYMENT_FILE",
      "QUIET_TILL_DEPLOY_OUTPUT",
      "QUIET_TILL_CTX_CALLBACK_GAS",
      "QUIET_TILL_CTX_CALLBACK_FUNDING_WEI"
    ],
    missingEnv: missingEnv(requiredLiveEnv),
    deploymentFile: deploymentFilePath(),
    plaintext: manifest.privateReport.plaintext,
    encryptedReportHash: encryptedReportEnvelope.encryptedReportHash,
    plannedCalls: [
      {
        from: "posAgent",
        contract: "DailySettlementWindow",
        function: "submitEncryptedReportWithCommitment",
        args: [
          manifest.privateReport.plaintext.loanId,
          manifest.privateReport.plaintext.dayIndex,
          "$biteEncryptedReport",
          manifest.privateReport.plaintextCommitmentHash
        ]
      },
      {
        from: "lender",
        contract: "DailySettlementWindow",
        function: "requestDailySettlementViaCTX",
        args: [
          manifest.privateReport.plaintext.loanId,
          manifest.privateReport.plaintext.dayIndex,
          ctxCallbackGas().toString()
        ],
        valueWei: ctxCallbackFundingWei().toString()
      }
    ]
  };
}

async function runSkalePrivateFlow() {
  const missing = missingEnv(requiredLiveEnv);

  if (missing.length > 0) {
    throw new Error(`Missing live flow env vars: ${missing.join(", ")}`);
  }

  const deployment = await loadJson(deploymentFilePath());
  const rpcUrl = requireEnv("QUIET_TILL_RPC_URL");
  const chainId = requirePositiveIntegerEnv("QUIET_TILL_CHAIN_ID");

  if (deployment.chainId !== undefined && Number(deployment.chainId) !== chainId) {
    throw new Error(`Deployment chain id mismatch: expected ${deployment.chainId}, got ${chainId}`);
  }

  const chain = targetChain({ chainId, rpcUrl, name: "Quiet Till SKALE target" });
  const transport = http(rpcUrl);
  const publicClient = createPublicClient({ chain, transport });
  const liveChainId = await publicClient.getChainId();

  if (liveChainId !== chainId) {
    throw new Error(`RPC chain id mismatch: expected ${chainId}, got ${liveChainId}`);
  }

  const posAgent = privateKeyToAccount(
    normalizePrivateKey(process.env.QUIET_TILL_POS_AGENT_PRIVATE_KEY, "QUIET_TILL_POS_AGENT_PRIVATE_KEY")
  );
  const lender = privateKeyToAccount(
    normalizePrivateKey(process.env.QUIET_TILL_LENDER_PRIVATE_KEY, "QUIET_TILL_LENDER_PRIVATE_KEY")
  );

  assertActorMatchesDeployment({
    deployment,
    actorName: "posAgent",
    actualAddress: posAgent.address,
    envName: "QUIET_TILL_POS_AGENT_PRIVATE_KEY"
  });
  assertActorMatchesDeployment({
    deployment,
    actorName: "lender",
    actualAddress: lender.address,
    envName: "QUIET_TILL_LENDER_PRIVATE_KEY"
  });

  const windowAddress = requireContractAddress(deployment, "DailySettlementWindow");
  const artifact = await loadWindowArtifact();
  const manifest = buildManifest({
    actors: deployment.actors,
    chainId
  });
  const envelope = await encryptSalesReportForCTX({
    rpcUrl,
    ctxSubmitterAddress: windowAddress,
    encodedPlaintext: manifest.privateReport.encodedPlaintext
  });
  const posWallet = createWalletClient({
    account: posAgent,
    chain,
    transport
  });
  const lenderWallet = createWalletClient({
    account: lender,
    chain,
    transport
  });

  const submitHash = await posWallet.writeContract({
    address: windowAddress,
    abi: artifact.abi,
    functionName: "submitEncryptedReportWithCommitment",
    args: [
      BigInt(manifest.privateReport.plaintext.loanId),
      BigInt(manifest.privateReport.plaintext.dayIndex),
      envelope.encryptedReport,
      manifest.privateReport.plaintextCommitmentHash
    ]
  });
  await publicClient.waitForTransactionReceipt({ hash: submitHash });

  const closeHash = await lenderWallet.writeContract({
    address: windowAddress,
    abi: artifact.abi,
    functionName: "requestDailySettlementViaCTX",
    args: [
      BigInt(manifest.privateReport.plaintext.loanId),
      BigInt(manifest.privateReport.plaintext.dayIndex),
      ctxCallbackGas()
    ],
    value: ctxCallbackFundingWei()
  });
  const closeReceipt = await publicClient.waitForTransactionReceipt({ hash: closeHash });
  const requestedEvents = parseEventLogs({
    abi: artifact.abi,
    eventName: "DailySettlementRequested",
    logs: closeReceipt.logs
  });
  const ctxEvents = parseEventLogs({
    abi: artifact.abi,
    eventName: "DailySettlementCTXSubmitted",
    logs: closeReceipt.logs
  });

  assert.equal(requestedEvents.length, 1, "expected one DailySettlementRequested event");
  assert.equal(ctxEvents.length, 1, "expected one DailySettlementCTXSubmitted event");

  const publicDayStatus = await publicClient.readContract({
    address: windowAddress,
    abi: artifact.abi,
    functionName: "getPublicDayStatus",
    args: [
      BigInt(manifest.privateReport.plaintext.loanId),
      BigInt(manifest.privateReport.plaintext.dayIndex)
    ]
  });

  return {
    mode: "live-skale-private-flow",
    chainId,
    deploymentFile: deploymentFilePath(),
    dailySettlementWindow: windowAddress,
    actors: {
      posAgent: posAgent.address,
      lender: lender.address
    },
    privateReport: {
      plaintext: manifest.privateReport.plaintext,
      encryptedReportHash: envelope.encryptedReportHash
    },
    transactions: {
      submitEncryptedReportWithCommitment: submitHash,
      requestDailySettlementViaCTX: closeHash
    },
    ctx: {
      requestId: requestedEvents[0].args.requestId,
      callbackSender: ctxEvents[0].args.callbackSender,
      callbackGas: ctxEvents[0].args.callbackGas.toString()
    },
    publicStatusAfterRequest: {
      status: publicDayStatus[0].toString(),
      encryptedReportHash: publicDayStatus[1],
      privateReceiptHash: publicDayStatus[2]
    }
  };
}

const result = dryRun ? await buildDryRunPlan() : await runSkalePrivateFlow();

if (quiet) {
  console.log(dryRun ? "SKALE private flow plan check passed." : "SKALE private flow submitted.");
} else {
  console.log(JSON.stringify(result, jsonReplacer, 2));
}
