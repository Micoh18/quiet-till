import { encodeAbiParameters, parseAbiParameters } from "viem";

const salesReportAbi = parseAbiParameters(
  "uint256 loanId, uint256 merchantId, uint256 dayIndex, uint256 grossSales, uint256 nonce"
);

function salesReportValue(report) {
  return [
    BigInt(report.loanId),
    BigInt(report.merchantId),
    BigInt(report.dayIndex),
    BigInt(report.grossSales),
    BigInt(report.nonce)
  ];
}

function encodeSalesReportPlaintext(report) {
  return encodeAbiParameters(salesReportAbi, salesReportValue(report));
}

export { encodeSalesReportPlaintext, salesReportAbi };
