import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";

import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { buildManifest } from "../lib/demo-fixture.mjs";
import {
  jsonReplacer,
  loadArtifact,
  missingEnv,
  normalizePrivateKey,
  requireAddressEnv,
  requirePositiveIntegerEnv,
  resolveManifestValue,
  targetChain
} from "../lib/script-utils.mjs";

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
    missingEnv: missingEnv(requiredEnv),
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
      posAgent: requireAddressEnv("QUIET_TILL_POS_AGENT_ADDRESS"),
      auditor: requireAddressEnv("QUIET_TILL_AUDITOR_ADDRESS"),
      lender: requireAddressEnv("QUIET_TILL_LENDER_ADDRESS"),
      decryptCallback: requireAddressEnv("QUIET_TILL_DECRYPT_CALLBACK_ADDRESS")
    }
  };
}

async function deployDemo() {
  const missing = missingEnv(requiredEnv);

  if (missing.length > 0) {
    throw new Error(`Missing deployment env vars: ${missing.join(", ")}`);
  }

  const rpcUrl = process.env.QUIET_TILL_RPC_URL;
  const chainId = requirePositiveIntegerEnv("QUIET_TILL_CHAIN_ID");

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
