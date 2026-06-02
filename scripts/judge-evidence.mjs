import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildJudgeEvidence } from "../lib/judge-evidence.mjs";

async function writeEvidence(filePath, evidence) {
  const destination = resolve(filePath);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  return destination;
}

async function main() {
  const evidence = buildJudgeEvidence();
  const outIndex = process.argv.indexOf("--out");

  if (outIndex !== -1) {
    const outPath = process.argv[outIndex + 1];

    if (!outPath) {
      throw new Error("--out requires a file path");
    }

    const destination = await writeEvidence(outPath, evidence);
    console.log(`Wrote judge evidence bundle to ${destination}`);
    return;
  }

  console.log(JSON.stringify(evidence, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export { buildJudgeEvidence };
