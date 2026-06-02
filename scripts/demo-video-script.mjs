import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildDemoVideoScript, renderDemoVideoScript } from "../lib/demo-video-script.mjs";

async function writeScript(filePath, rendered) {
  const destination = resolve(filePath);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, rendered, "utf8");
  return destination;
}

async function main() {
  const script = buildDemoVideoScript();
  const rendered = renderDemoVideoScript(script);
  const json = process.argv.includes("--json");
  const outIndex = process.argv.indexOf("--out");

  if (outIndex !== -1) {
    const outPath = process.argv[outIndex + 1];

    if (!outPath) {
      throw new Error("--out requires a file path");
    }

    const destination = await writeScript(
      outPath,
      json ? `${JSON.stringify(script, null, 2)}\n` : rendered
    );
    console.log(`Wrote demo video script to ${destination}`);
    return;
  }

  console.log(json ? JSON.stringify(script, null, 2) : rendered);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export { buildDemoVideoScript, renderDemoVideoScript };
