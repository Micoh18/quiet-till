import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const artifacts = {
  DailySettlementWindow: "artifacts/contracts/DailySettlementWindow.sol/DailySettlementWindow.json",
  RevenueLoan: "artifacts/contracts/RevenueLoan.sol/RevenueLoan.json",
  AuditorDisclosure: "artifacts/contracts/AuditorDisclosure.sol/AuditorDisclosure.json",
  ConfidentialPaymentRail: "artifacts/contracts/ConfidentialPaymentRail.sol/ConfidentialPaymentRail.json",
  SettlementVault: "artifacts/contracts/SettlementVault.sol/SettlementVault.json"
};

const sourceFiles = [
  "contracts/DailySettlementWindow.sol",
  "contracts/RevenueLoan.sol",
  "contracts/AuditorDisclosure.sol",
  "contracts/ConfidentialPaymentRail.sol"
];

const coreEventForbiddenInputs = new Set([
  "grossSales",
  "repaymentAmount",
  "outstanding",
  "outstandingBefore",
  "outstandingAfter",
  "auditor"
]);

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function abiEntries(artifact, type) {
  return artifact.abi.filter((entry) => entry.type === type);
}

function namesFor(entries) {
  return entries.map((entry) => entry.name).filter(Boolean).sort();
}

function assertNoAbiFunction(artifact, functionName, label) {
  const functionNames = new Set(namesFor(abiEntries(artifact, "function")));

  assert.equal(
    functionNames.has(functionName),
    false,
    `${label} must not expose ${functionName}() in its public ABI`
  );
}

function flattenInputs(inputs = []) {
  const flattened = [];

  for (const input of inputs) {
    flattened.push(input);

    if (Array.isArray(input.components)) {
      flattened.push(...flattenInputs(input.components));
    }
  }

  return flattened;
}

function assertEventInputsDoNotLeak(artifact, label, forbiddenInputs) {
  for (const event of abiEntries(artifact, "event")) {
    for (const input of flattenInputs(event.inputs)) {
      if (forbiddenInputs.has(input.name)) {
        throw new Error(`${label}.${event.name} leaks forbidden event input: ${input.name}`);
      }
    }
  }
}

async function assertNoPublicSensitiveMappings() {
  for (const sourceFile of sourceFiles) {
    const source = await readFile(sourceFile, "utf8");
    const forbiddenPublicMappings = [
      /\bmapping\s*\([^;]+?\)\s+public\s+loans\b/,
      /\bmapping\s*\([^;]+?\)\s+public\s+receiptMeta\b/,
      /\bmapping\s*\([^;]+?\)\s+public\s+settlementDays\b/
    ];

    for (const pattern of forbiddenPublicMappings) {
      assert.equal(
        pattern.test(source),
        false,
        `${sourceFile} contains a forbidden public sensitive mapping`
      );
    }
  }
}

function assertFallbackLeakIsIsolated(settlementVault) {
  const events = abiEntries(settlementVault, "event");
  const fallbackEvent = events.find((event) => event.name === "PublicFallbackPaymentSettled");

  assert.ok(fallbackEvent, "SettlementVault must keep its explicit public fallback event");
  assert.ok(
    flattenInputs(fallbackEvent.inputs).some((input) => input.name === "amount"),
    "PublicFallbackPaymentSettled should make the fallback amount explicit, not accidental"
  );
}

const loaded = Object.fromEntries(
  await Promise.all(
    Object.entries(artifacts).map(async ([name, path]) => [name, await readJson(path)])
  )
);

assertEventInputsDoNotLeak(
  loaded.DailySettlementWindow,
  "DailySettlementWindow",
  coreEventForbiddenInputs
);
assertEventInputsDoNotLeak(loaded.RevenueLoan, "RevenueLoan", coreEventForbiddenInputs);
assertEventInputsDoNotLeak(
  loaded.AuditorDisclosure,
  "AuditorDisclosure",
  coreEventForbiddenInputs
);
assertEventInputsDoNotLeak(
  loaded.ConfidentialPaymentRail,
  "ConfidentialPaymentRail",
  coreEventForbiddenInputs
);

assertNoAbiFunction(loaded.RevenueLoan, "loans", "RevenueLoan");
assertNoAbiFunction(loaded.AuditorDisclosure, "receiptMeta", "AuditorDisclosure");
assertNoAbiFunction(loaded.DailySettlementWindow, "settlementDays", "DailySettlementWindow");

assertFallbackLeakIsIsolated(loaded.SettlementVault);
await assertNoPublicSensitiveMappings();

console.log("Privacy surface check passed.");
