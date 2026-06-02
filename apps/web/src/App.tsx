import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building2,
  Calculator,
  CheckCircle,
  CircleDollarSign,
  Eye,
  EyeOff,
  FileCheck,
  Hash,
  Landmark,
  Lock,
  Megaphone,
  Radio,
  Receipt,
  ShieldCheck,
  Terminal,
  UserCheck,
  Wallet
} from "lucide-react";
import { display, fixture, manifest, settlementPath, transcript } from "./demoData";

type ViewKey = "merchant" | "public" | "auditor";

type NavItem = {
  key: ViewKey;
  label: string;
  icon: LucideIcon;
};

const navItems: NavItem[] = [
  { key: "merchant", label: "Merchant", icon: Terminal },
  { key: "public", label: "Market", icon: Eye },
  { key: "auditor", label: "Auditor", icon: ShieldCheck }
];

function Metric({
  label,
  value,
  tone = "neutral",
  icon: Icon
}: {
  label: string;
  value: string;
  tone?: "neutral" | "good" | "warn" | "danger";
  icon?: LucideIcon;
}) {
  return (
    <div className={`metric metric-${tone}`}>
      <div className="metric-label">
        {Icon ? <Icon aria-hidden="true" /> : null}
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
    </div>
  );
}

function StatusPill({
  icon: Icon,
  label,
  tone = "neutral"
}: {
  icon: LucideIcon;
  label: string;
  tone?: "neutral" | "good" | "warn" | "danger";
}) {
  return (
    <span className={`status-pill status-${tone}`}>
      <Icon aria-hidden="true" />
      {label}
    </span>
  );
}

function AppHeader() {
  return (
    <header className="topbar">
      <div className="brand-lock">
        <div className="brand-icon">
          <Lock aria-hidden="true" />
        </div>
        <div>
          <p>Quiet Till</p>
          <h1>Revenue settlement console</h1>
        </div>
      </div>
      <div className="top-status" aria-label="Demo state">
        <StatusPill icon={Radio} label={`Chain ${manifest.chainId}`} />
        <StatusPill icon={CircleDollarSign} label={fixture.token.symbol} tone="good" />
        <StatusPill icon={Hash} label="Deterministic fixture" tone="warn" />
      </div>
    </header>
  );
}

function ScenarioRail({
  activeView,
  onChange
}: {
  activeView: ViewKey;
  onChange: (view: ViewKey) => void;
}) {
  return (
    <aside className="scenario-rail" aria-label="Demo views">
      <div className="merchant-card">
        <div className="merchant-avatar">
          <Building2 aria-hidden="true" />
        </div>
        <div>
          <p>Merchant</p>
          <h2>{fixture.merchant.displayName}</h2>
        </div>
      </div>

      <div className="nav-stack" role="tablist" aria-label="Quiet Till demo paths">
        {navItems.map((item) => {
          const Icon = item.icon;
          const selected = activeView === item.key;

          return (
            <button
              key={item.key}
              type="button"
              className={selected ? "nav-button nav-button-active" : "nav-button"}
              onClick={() => onChange(item.key)}
              role="tab"
              aria-selected={selected}
            >
              <Icon aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="loan-strip">
        <Metric
          icon={Wallet}
          label="Principal"
          value={display.amount(fixture.loan.principal)}
        />
        <Metric
          icon={Calculator}
          label="Revenue share"
          value={display.percentFromBps(fixture.loan.repaymentBps)}
        />
        <Metric
          icon={Activity}
          label="Day index"
          value={`Day ${fixture.report.dayIndex}`}
        />
      </div>
    </aside>
  );
}

function MerchantView() {
  return (
    <section className="view-grid view-merchant" aria-labelledby="merchant-heading">
      <div className="view-title">
        <Terminal aria-hidden="true" />
        <div>
          <p>POS agent</p>
          <h2 id="merchant-heading">Encrypted sales close</h2>
        </div>
      </div>

      <div className="register-screen">
        <div className="register-row">
          <span>Local gross sales</span>
          <strong>{display.amount(fixture.report.grossSales)}</strong>
        </div>
        <div className="register-row">
          <span>Nonce</span>
          <strong>{fixture.report.nonce}</strong>
        </div>
        <div className="register-row">
          <span>Report hash</span>
          <code>{display.shortHash(manifest.privateReport.encryptedReportHash)}</code>
        </div>
      </div>

      <div className="privacy-path">
        {settlementPath.map((step, index) => (
          <div className="path-step" key={step.label}>
            <div className="path-index">{index + 1}</div>
            <div>
              <strong>{step.label}</strong>
              <span>{step.privateValue}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="action-row">
        <button type="button" className="primary-action">
          <Lock aria-hidden="true" />
          Seal day {fixture.report.dayIndex}
        </button>
        <StatusPill icon={CheckCircle} label="Settlement window armed" tone="good" />
      </div>
    </section>
  );
}

function PublicView() {
  const publicSignal = transcript.publicMode.visibleToMarket.competitorSignal;
  const marketSales =
    transcript.publicMode.visibleToMarket.grossSales === null
      ? "hidden"
      : display.amount(transcript.publicMode.visibleToMarket.grossSales);
  const privateSales =
    transcript.privateMode.visibleToMarket.grossSales === null
      ? "hidden"
      : display.amount(transcript.privateMode.visibleToMarket.grossSales);

  return (
    <section className="comparison-view" aria-labelledby="market-heading">
      <div className="view-title">
        <Eye aria-hidden="true" />
        <div>
          <p>Public observer</p>
          <h2 id="market-heading">Market intelligence delta</h2>
        </div>
      </div>

      <div className="delta-banner" aria-label="Privacy delta">
        <div className="delta-chip delta-leak">
          <Eye aria-hidden="true" />
          <span>Public mode</span>
          <strong>{marketSales}</strong>
        </div>
        <div className="delta-chip delta-quiet">
          <EyeOff aria-hidden="true" />
          <span>Quiet Till</span>
          <strong>{privateSales}</strong>
        </div>
      </div>

      <div className="comparison-columns">
        <div className="leak-column">
          <div className="column-heading">
            <Megaphone aria-hidden="true" />
            <div>
              <p>Public-mode chain</p>
              <h3>Register exposed</h3>
            </div>
          </div>
          <Metric icon={Eye} label="Gross sales" value={marketSales} tone="danger" />
          <Metric
            icon={Calculator}
            label="Projected repayment"
            value={display.amount(transcript.publicMode.visibleToMarket.projectedRepayment)}
            tone="danger"
          />
          <Metric
            icon={AlertTriangle}
            label="Competitor signal"
            value={publicSignal.code}
            tone="warn"
          />
          <p className="risk-copy">{publicSignal.risk}</p>
        </div>

        <div className="delta-column" aria-hidden="true">
          <ArrowRight />
          <span>same loan</span>
          <ArrowRight />
        </div>

        <div className="quiet-column">
          <div className="column-heading">
            <EyeOff aria-hidden="true" />
            <div>
              <p>Quiet Till path</p>
              <h3>Register sealed</h3>
            </div>
          </div>
          <Metric icon={EyeOff} label="Gross sales" value={privateSales} tone="good" />
          <Metric
            icon={Receipt}
            label="Market receipt"
            value={transcript.privateMode.visibleToMarket.reportStatus}
            tone="good"
          />
          <Metric
            icon={Hash}
            label="Encrypted report"
            value={display.shortHash(
              transcript.privateMode.visibleToMarket.encryptedReportHash
            )}
          />
          <p className="risk-copy muted">
            {transcript.privateMode.judgeTakeaway}
          </p>
        </div>
      </div>
    </section>
  );
}

function AuditorView() {
  const auditor = transcript.privateMode.visibleToAuditor;
  const receipt = auditor.privateReceipt;

  return (
    <section className="view-grid view-auditor" aria-labelledby="auditor-heading">
      <div className="view-title">
        <ShieldCheck aria-hidden="true" />
        <div>
          <p>Authorized disclosure</p>
          <h2 id="auditor-heading">Auditor settlement receipt</h2>
        </div>
      </div>

      <div className="audit-ledger">
        <Metric
          icon={FileCheck}
          label="Gross sales"
          value={display.amount(auditor.grossSales)}
          tone="good"
        />
        <Metric
          icon={Calculator}
          label="Repayment"
          value={display.amount(auditor.repaymentAmount)}
          tone="good"
        />
        <Metric
          icon={Landmark}
          label="Outstanding"
          value={display.amount(auditor.outstandingAfter)}
        />
        <Metric
          icon={UserCheck}
          label="Repayment rule"
          value={display.percentFromBps(auditor.repaymentBps)}
        />
      </div>

      <div className="receipt-proof">
        <div className="proof-status">
          <StatusPill
            icon={CheckCircle}
            label={auditor.receiptHashVerified ? "Receipt hash verified" : "Receipt mismatch"}
            tone={auditor.receiptHashVerified ? "good" : "danger"}
          />
          <StatusPill icon={Hash} label={`Day ${receipt.dayIndex}`} />
        </div>
        <div className="proof-grid">
          <div>
            <span>Public receipt hash</span>
            <code>{display.shortHash(transcript.privateMode.visibleToMarket.privateReceiptHash)}</code>
          </div>
          <div>
            <span>Auditor receipt hash</span>
            <code>{display.shortHash(receipt.receiptHash)}</code>
          </div>
          <div>
            <span>Tampered sales hash</span>
            <code>{display.shortHash(auditor.tamperedGrossSalesReceiptHash)}</code>
          </div>
        </div>
      </div>

      <div className="encoded-block">
        <div>
          <span>Encoded plaintext</span>
          <code>{display.shortHash(auditor.encodedPlaintext)}</code>
        </div>
        <div>
          <span>Receipt domain</span>
          <code>{receipt.domain}</code>
        </div>
      </div>
    </section>
  );
}

export function App() {
  const [activeView, setActiveView] = useState<ViewKey>("public");

  return (
    <main className="app-shell">
      <AppHeader />
      <section className="workspace">
        <ScenarioRail activeView={activeView} onChange={setActiveView} />
        <section className="demo-surface">
          {activeView === "merchant" ? <MerchantView /> : null}
          {activeView === "public" ? <PublicView /> : null}
          {activeView === "auditor" ? <AuditorView /> : null}
        </section>
      </section>
    </main>
  );
}
