import {
  encodeAbiParameters,
  getAddress,
  keccak256,
  parseAbiParameters,
  toHex
} from "viem";

const receiptDomain = keccak256(toHex("QUIET_TILL_PRIVATE_RECEIPT_V1"));

const privateReceiptAbi = parseAbiParameters(
  [
    "bytes32 domain",
    "uint256 chainId",
    "address settlementWindow",
    "uint256 loanId",
    "uint256 merchantId",
    "uint256 dayIndex",
    "uint256 grossSales",
    "uint256 repaymentAmount",
    "uint256 nonce"
  ].join(", ")
);

function toBigIntValue(value, label) {
  const parsed = BigInt(value);

  if (parsed < 0n) {
    throw new Error(`${label} must be greater than or equal to zero`);
  }

  return parsed;
}

function privateReceiptHash({
  chainId,
  settlementWindow,
  loanId,
  merchantId,
  dayIndex,
  grossSales,
  repaymentAmount,
  nonce
}) {
  return keccak256(
    encodeAbiParameters(privateReceiptAbi, [
      receiptDomain,
      toBigIntValue(chainId, "chainId"),
      getAddress(settlementWindow),
      toBigIntValue(loanId, "loanId"),
      toBigIntValue(merchantId, "merchantId"),
      toBigIntValue(dayIndex, "dayIndex"),
      toBigIntValue(grossSales, "grossSales"),
      toBigIntValue(repaymentAmount, "repaymentAmount"),
      toBigIntValue(nonce, "nonce")
    ])
  );
}

function buildPrivateReceipt({
  chainId,
  settlementWindow,
  auditor,
  report,
  repaymentBps,
  repaymentAmount,
  outstandingBefore,
  outstandingAfter,
  settledAt,
  encodedPlaintext
}) {
  const receipt = {
    version: 1,
    domain: "QUIET_TILL_PRIVATE_RECEIPT_V1",
    chainId: Number(chainId),
    settlementWindow: getAddress(settlementWindow),
    auditor: getAddress(auditor),
    loanId: Number(report.loanId),
    merchantId: Number(report.merchantId),
    dayIndex: Number(report.dayIndex),
    grossSales: Number(report.grossSales),
    repaymentBps: Number(repaymentBps),
    repaymentAmount: Number(repaymentAmount),
    outstandingBefore: Number(outstandingBefore),
    outstandingAfter: Number(outstandingAfter),
    nonce: Number(report.nonce),
    settledAt: Number(settledAt),
    encodedPlaintext
  };

  return {
    ...receipt,
    receiptHash: privateReceiptHash(receipt)
  };
}

function assertPrivateReceiptHash(receipt, expectedHash) {
  const actualHash = privateReceiptHash(receipt);

  if (actualHash !== expectedHash) {
    throw new Error(`Private receipt hash mismatch: expected ${expectedHash}, got ${actualHash}`);
  }
}

export {
  assertPrivateReceiptHash,
  buildPrivateReceipt,
  privateReceiptHash,
  receiptDomain
};
