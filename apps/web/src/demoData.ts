import { buildDemoFlow, buildManifest, buildTranscript, demo } from "../../../lib/demo-fixture.mjs";

export const manifest = buildManifest();
export const transcript = buildTranscript();
export const demoFlow = buildDemoFlow();
export const fixture = demo;

export const display = {
  amount(value: number) {
    return `${new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 0
    }).format(value)} qUSD`;
  },
  percentFromBps(value: number) {
    return `${new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 2
    }).format(value / 100)}%`;
  },
  shortHash(value: string) {
    return `${value.slice(0, 10)}...${value.slice(-8)}`;
  }
};

export const settlementPath = [
  {
    label: "ReportSubmitted",
    publicValue: "hash only",
    privateValue: "sales payload sealed"
  },
  {
    label: "DecryptRequested",
    publicValue: "window status",
    privateValue: "callback authorized"
  },
  {
    label: "Settled",
    publicValue: "receipt hash",
    privateValue: "repayment computed"
  }
];
