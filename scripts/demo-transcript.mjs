import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildManifest } from "./demo-manifest.mjs";

function competitorSignalFromSales({ baselineSales, grossSales }) {
  if (baselineSales === 0) {
    return {
      code: "NO_BASELINE",
      label: "No prior public sales baseline.",
      risk: "The first public report immediately reveals a raw daily sales number."
    };
  }

  if (grossSales * 100 >= baselineSales * 125) {
    return {
      code: "STRONG_DAY",
      label: "Sales are at least 25% above the public baseline.",
      risk: "A supplier or competitor can identify a strong trading day and adjust terms."
    };
  }

  if (grossSales * 100 <= baselineSales * 75) {
    return {
      code: "WEAK_DAY",
      label: "Sales are at least 25% below the public baseline.",
      risk: "A rival lender can infer stress from the public sales drop."
    };
  }

  return {
    code: "STABLE",
    label: "Sales are close to the public baseline.",
    risk: "Even stable sales become a public operating signal over time."
  };
}

function buildTranscript() {
  const manifest = buildManifest();
  const publicBaselineSales = 900;
  const publicSignal = competitorSignalFromSales({
    baselineSales: publicBaselineSales,
    grossSales: manifest.privateReport.plaintext.grossSales
  });

  return {
    name: "Quiet Till Demo Transcript",
    version: 1,
    generatedAt: manifest.generatedAt,
    scenario: {
      merchant: "La Barra",
      loanPrincipal: manifest.setupCalls[1].args[4],
      repaymentBps: manifest.setupCalls[1].args[5],
      dayIndex: manifest.privateReport.plaintext.dayIndex
    },
    publicMode: {
      title: "Public chain settlement leaks the register",
      visibleToMarket: {
        merchantId: manifest.privateReport.plaintext.merchantId,
        dayIndex: manifest.privateReport.plaintext.dayIndex,
        grossSales: manifest.privateReport.plaintext.grossSales,
        projectedRepayment: manifest.expectedSettlement.repaymentAmount,
        publicBaselineSales,
        competitorSignal: publicSignal
      },
      judgeTakeaway:
        "The contract can calculate repayment, but the market learns the merchant's daily sales."
    },
    privateMode: {
      title: "Quiet Till settlement keeps the register silent",
      visibleToMarket: {
        reportStatus: "ReportSubmitted",
        encryptedReportHash: manifest.privateReport.encryptedReportHash,
        privateReceiptHash: "$computed.onDecrypt.privateReceiptHash",
        grossSales: null,
        projectedRepayment: null
      },
      visibleToAuditor: {
        grossSales: manifest.privateReport.plaintext.grossSales,
        repaymentBps: manifest.setupCalls[1].args[5],
        repaymentAmount: manifest.expectedSettlement.repaymentAmount,
        outstandingAfter: manifest.expectedSettlement.outstandingAfter,
        encodedPlaintext: manifest.privateReport.encodedPlaintext
      },
      judgeTakeaway:
        "The same repayment is verifiable after settlement, while public observers only see hashes and state."
    },
    expectedDelta: {
      publicModeLeaksGrossSales: true,
      privateModeLeaksGrossSales: false,
      repaymentAmount: manifest.expectedSettlement.repaymentAmount,
      outstandingAfter: manifest.expectedSettlement.outstandingAfter
    }
  };
}

async function writeTranscript(filePath, transcript) {
  const destination = resolve(filePath);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(transcript, null, 2)}\n`, "utf8");
  return destination;
}

async function main() {
  const transcript = buildTranscript();
  const outIndex = process.argv.indexOf("--out");

  if (outIndex !== -1) {
    const outPath = process.argv[outIndex + 1];

    if (!outPath) {
      throw new Error("--out requires a file path");
    }

    const destination = await writeTranscript(outPath, transcript);
    console.log(`Wrote demo transcript to ${destination}`);
    return;
  }

  console.log(JSON.stringify(transcript, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export { buildTranscript };
