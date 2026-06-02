import {
  encodeAbiParameters,
  getAddress,
  keccak256,
  parseAbiParameters,
  toHex
} from "viem";

import { toBigIntValue } from "./private-receipt.mjs";

const paymentCommitmentDomain = keccak256(toHex("QUIET_TILL_CONFIDENTIAL_PAYMENT_COMMITMENT_V1"));

const paymentCommitmentAbi = parseAbiParameters(
  [
    "bytes32 domain",
    "uint256 chainId",
    "address paymentRail",
    "uint256 loanId",
    "uint256 dayIndex",
    "address payer",
    "address payee",
    "uint256 repaymentAmount",
    "uint256 nonce",
    "bytes32 privateReceiptHash"
  ].join(", ")
);

function buildPaymentCommitment({
  chainId,
  paymentRail,
  loanId,
  dayIndex,
  payer,
  payee,
  repaymentAmount,
  nonce,
  privateReceiptHash
}) {
  return keccak256(
    encodeAbiParameters(paymentCommitmentAbi, [
      paymentCommitmentDomain,
      toBigIntValue(chainId, "chainId"),
      getAddress(paymentRail),
      toBigIntValue(loanId, "loanId"),
      toBigIntValue(dayIndex, "dayIndex"),
      getAddress(payer),
      getAddress(payee),
      toBigIntValue(repaymentAmount, "repaymentAmount"),
      toBigIntValue(nonce, "nonce"),
      privateReceiptHash
    ])
  );
}

export {
  buildPaymentCommitment,
  paymentCommitmentDomain
};
