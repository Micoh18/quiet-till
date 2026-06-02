import { readFile } from "node:fs/promises";

function jsonReplacer(_key, value) {
  return typeof value === "bigint" ? value.toString() : value;
}

async function loadJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function loadArtifact(path) {
  return loadJson(path);
}

function targetChain({ chainId, rpcUrl, name = "Quiet Till target" }) {
  return {
    id: Number(chainId),
    name,
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

function requireEnv(name) {
  const value = process.env[name];

  if (value === undefined || value.trim() === "") {
    throw new Error(`Missing ${name}`);
  }

  return value.trim();
}

function assertAddress(value, label) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`${label} must be an EVM address`);
  }
}

function requireAddressEnv(name) {
  const value = requireEnv(name);
  assertAddress(value, name);
  return value;
}

function missingEnv(requiredEnv) {
  return requiredEnv.filter((name) => process.env[name] === undefined || process.env[name]?.trim() === "");
}

function requirePositiveIntegerEnv(name) {
  const value = Number(requireEnv(name));

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return value;
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

export {
  assertAddress,
  jsonReplacer,
  loadArtifact,
  loadJson,
  missingEnv,
  normalizePrivateKey,
  requireAddressEnv,
  requireEnv,
  requirePositiveIntegerEnv,
  resolveManifestValue,
  targetChain
};
