import { BITE, BITEMockup } from "@skalenetwork/bite";
import { isAddress, isHex, keccak256 } from "viem";

import { encodeSalesReportPlaintext, salesReportAbi } from "./sales-report.mjs";

function assertHex(value, label) {
  if (!isHex(value)) {
    throw new Error(`${label} must be a hex string`);
  }
}

function assertAddress(value, label) {
  if (!isAddress(value)) {
    throw new Error(`${label} must be an EVM address`);
  }
}

function buildReportEnvelope({ mode, encodedPlaintext, encryptedReport, ctxSubmitterAddress }) {
  assertHex(encodedPlaintext, "encodedPlaintext");
  assertHex(encryptedReport, "encryptedReport");

  return {
    mode,
    ctxSubmitterAddress,
    encodedPlaintext,
    encryptedReport,
    encryptedReportHash: keccak256(encryptedReport)
  };
}

async function encryptSalesReportForCTX({ rpcUrl, ctxSubmitterAddress, encodedPlaintext }) {
  if (typeof rpcUrl !== "string" || rpcUrl.trim() === "") {
    throw new Error("rpcUrl is required for BITE encryption");
  }

  assertAddress(ctxSubmitterAddress, "ctxSubmitterAddress");
  assertHex(encodedPlaintext, "encodedPlaintext");

  const bite = new BITE(rpcUrl);
  const encryptedReport = await bite.encryptMessageForCTX(encodedPlaintext, ctxSubmitterAddress);

  return buildReportEnvelope({
    mode: "skale-bite-ctx",
    ctxSubmitterAddress,
    encodedPlaintext,
    encryptedReport
  });
}

async function mockEncryptSalesReportForCTX({ encodedPlaintext }) {
  assertHex(encodedPlaintext, "encodedPlaintext");

  const bite = new BITEMockup();
  const encryptedReport = await bite.encryptMessage(encodedPlaintext);

  return buildReportEnvelope({
    mode: "bite-mock-local",
    ctxSubmitterAddress: null,
    encodedPlaintext,
    encryptedReport
  });
}

export {
  buildReportEnvelope,
  encodeSalesReportPlaintext,
  encryptSalesReportForCTX,
  mockEncryptSalesReportForCTX,
  salesReportAbi
};
