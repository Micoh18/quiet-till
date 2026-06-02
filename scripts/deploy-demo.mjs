import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { buildManifest } from "../lib/demo-fixture.mjs";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const quiet = args.has("--quiet");

const requiredEnv = [
  "QUIET_TILL_RPC_URL",
  "QUIET_TILL_CHAIN_ID",
  "QUIET_TILL_ADMIN_PRIVATE_KEY",
  "QUIET_TILL_MERCHANT_OWNER_PRIVATE_KEY",
  "QUIET_TILL_POS_AGENT_ADDRESS",
  "QUIET_TILL_AUDITOR_ADDRESS",
  "QUIET_TILL_LENDER_ADDRESS",
  "QUIET_TILL_DECRYPT_CALLBACK_ADDRESS"
];

function jsonReplacer(_key, value) {
  return typeof value === "bigint" ? value.toString() : value;
}

async function loadArtifact(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function targetChain({ chainId, rpcUrl }) {
  return {
    id: Number(chainId),
    name: "Quiet Till target",
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18
    },
    rpcUrls: {
      default: {
        http: [rpcUrl]
      }
    }
  };
}

function normalizePrivateKey(value, envName) {
  if (value === undefined || value.trim() === "") {
    throw new Error(`Missing ${envName}`);
  }

  const trimmed = value.trim();
  const privateKey = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;

  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error(`${envName} must be a 32-byte hex private key`);
  }

  return privateKey;
}

function requireAddress(envName) {
  const value = process.env[envName];

  if (value === undefined || value.trim() === "") {
    throw new Error(`Missing ${envName}`);
  }

  if (!/^0x[0-9a-fA-F]{40}$/.test(value.trim())) {
    throw new Error(`${envName} must be an EVM address`);
  }

  return value.trim();
}

function missingEnv() {
  return requiredEnv.filter((name) => process.env[name] === undefined || process.env[name]?.trim() === "");
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

async function deployContract({ artifact, args: constructorArgs, publicClient, walletClient }) {
  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args: constructorArgs
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  assert.ok(receipt.contractAddress, "deployment did not return a contract address");

  return {
    address: receipt.contractAddress,
    deploymentHash: hash
  };
}

async function buildDryRunPlan() {
  const manifest = buildManifest();
  const deployed = {};
  let addressNonce = 1n;

  for (const contract of manifest.contracts) {
    const artifact = await loadArtifact(contract.artifact);
    const resolvedArgs = resolveManifestValue(contract.constructorArgs ?? [], deployed);

    assert.ok(artifact.abi.length > 0, `${contract.name} artifact ABI is empty`);
    assert.ok(artifact.bytecode.startsWith("0x"), `${contract.name} artifact bytecode is invalid`);

    deployed[contract.name] = {
      address: `0x${addressNonce.toString(16).padStart(40, "0")}`,
      constructorArgs: resolvedArgs
    };
    addressNonce += 1n;
  }

  const setupCalls = manifest.setupCalls.map((call) => ({
    contract: call.contract,
    function: call.function,
    from: call.from ?? "admin",
    args: resolveManifestValue(call.args ?? [], deployed)
  }));

  return {
    mode: "dry-run",
    ok: true,
    requiredEnv,
    missingEnv: missingEnv(),
    contracts: Object.fromEntries(
      Object.entries(deployed).map(([name, deployment]) => [
        name,
        {
          placeholderAddress: deployment.address,
          constructorArgCount: deployment.constructorArgs.length
        }
      ])
    ),
    setupCalls
  };
}

function deploymentActors() {
  const admin = privateKeyToAccount(
    normalizePrivateKey(process.env.QUIET_TILL_ADMIN_PRIVATE_KEY, "QUIET_TILL_ADMIN_PRIVATE_KEY")
  );
  const merchantOwner = privateKeyToAccount(
    normalizePrivateKey(
      process.env.QUIET_TILL_MERCHANT_OWNER_PRIVATE_KEY,
      "QUIET_TILL_MERCHANT_OWNER_PRIVATE_KEY"
    )
  );

  return {
    accounts: {
      admin,
      merchantOwner
    },
    manifestActors: {
      admin: admin.address,
      merchantOwner: merchantOwner.address,
      posAgent: requireAddress("QUIET_TILL_POS_AGENT_ADDRESS"),
      auditor: requireAddress("QUIET_TILL_AUDITOR_ADDRESS"),
      lender: requireAddress("QUIET_TILL_LENDER_ADDRESS"),
      decryptCallback: requireAddress("QUIET_TILL_DECRYPT_CALLBACK_ADDRESS")
    }
  };
}

async function deployDemo() {
  const missing = missingEnv();

  if (missing.length > 0) {
    throw new Error(`Missing deployment env vars: ${missing.join(", ")}`);
  }

  const rpcUrl = process.env.QUIET_TILL_RPC_URL;
  const chainId = Number(process.env.QUIET_TILL_CHAIN_ID);

  if (!Number.isInteger(chainId) || chainId <= 0) {
    throw new Error("QUIET_TILL_CHAIN_ID must be a positive integer");
  }

  const chain = targetChain({ chainId, rpcUrl });
  const transport = http(rpcUrl);
  const publicClient = createPublicClient({ chain, transport });
  const liveChainId = await publicClient.getChainId();

  if (liveChainId !== chainId) {
    throw new Error(`RPC chain id mismatch: expected ${chainId}, got ${liveChainId}`);
  }

  const { accounts, manifestActors } = deploymentActors();
  const walletClients = {
    admin: createWalletClient({
      account: accounts.admin,
      chain,
      transport
    }),
    merchantOwner: createWalletClient({
      account: accounts.merchantOwner,
      chain,
      transport
    })
  };
  const manifest = buildManifest({
    actors: manifestActors,
    chainId
  });
  const deployed = {};

  for (const contract of manifest.contracts) {
    const artifact = await loadArtifact(contract.artifact);
    const constructorArgs = resolveManifestValue(contract.constructorArgs ?? [], deployed);
    const deployment = await deployContract({
      artifact,
      args: constructorArgs,
      publicClient,
      walletClient: walletClients.admin
    });

    deployed[contract.name] = {
      ...deployment,
      abi: artifact.abi
    };
  }

  async function writeContract({ contractName, functionName, args: callArgs = [], from = "admin" }) {
    const walletClient = walletClients[from];

    if (walletClient === undefined) {
      throw new Error(`No private key configured for setup role: ${from}`);
    }

    const contract = deployed[contractName];
    const hash = await walletClient.writeContract({
      address: contract.address,
      abi: contract.abi,
      functionName,
      args: resolveManifestValue(callArgs, deployed)
    });
    await publicClient.waitForTransactionReceipt({ hash });

    return hash;
  }

  const setupTransactions = [];

  for (const call of manifest.setupCalls) {
    setupTransactions.push({
      contract: call.contract,
      function: call.function,
      from: call.from ?? "admin",
      hash: await writeContract({
        contractName: call.contract,
        functionName: call.function,
        args: call.args,
        from: call.from ?? "admin"
      })
    });
  }

  return {
    mode: "deploy",
    name: "Quiet Till Demo Deployment",
    chainId,
    actors: manifest.actors,
    contracts: Object.fromEntries(
      Object.entries(deployed).map(([name, deployment]) => [
        name,
        {
          address: deployment.address,
          deploymentHash: deployment.deploymentHash
        }
      ])
    ),
    setupTransactions,
    privacyNote:
      "This deployment seeds the public fallback token path. Confidential token settlement remains a separate SKALE beta integration."
  };
}

const result = dryRun ? await buildDryRunPlan() : await deployDemo();

if (process.env.QUIET_TILL_DEPLOY_OUTPUT !== undefined && !dryRun) {
  await writeFile(process.env.QUIET_TILL_DEPLOY_OUTPUT, `${JSON.stringify(result, jsonReplacer, 2)}\n`);
}

if (quiet) {
  console.log(dryRun ? "Deploy plan check passed." : "Demo deployment completed.");
} else {
  console.log(JSON.stringify(result, jsonReplacer, 2));
}
