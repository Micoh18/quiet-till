import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildSubmissionReadiness } from "../lib/submission-readiness.mjs";

async function writeReadiness(filePath, readiness) {
  const destination = resolve(filePath);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(readiness, null, 2)}\n`, "utf8");
  return destination;
}

async function main() {
  const readiness = buildSubmissionReadiness();
  const outIndex = process.argv.indexOf("--out");

  if (outIndex !== -1) {
    const outPath = process.argv[outIndex + 1];

    if (!outPath) {
      throw new Error("--out requires a file path");
    }

    const destination = await writeReadiness(outPath, readiness);
    console.log(`Wrote submission readiness to ${destination}`);
    return;
  }

  console.log(JSON.stringify(readiness, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export { buildSubmissionReadiness };
