import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import * as THREE from "three";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building2,
  Calculator,
  CheckCircle,
  ClipboardCheck,
  Clock,
  CircleDollarSign,
  Eye,
  EyeOff,
  FileCheck,
  Hash,
  Landmark,
  Lock,
  Megaphone,
  Play,
  Radio,
  Receipt,
  ShieldCheck,
  Terminal,
  UserCheck,
  Wallet
} from "lucide-react";
import {
  demoFlow,
  display,
  fixture,
  judgeEvidence,
  manifest,
  settlementPath,
  transcript
} from "./demoData";

type ViewKey = "merchant" | "public" | "lender" | "auditor";
type StepKey = (typeof demoFlow)[number]["key"];

type NavItem = {
  key: ViewKey;
  label: string;
  icon: LucideIcon;
};

const navItems: NavItem[] = [
  { key: "merchant", label: "Merchant", icon: Terminal },
  { key: "public", label: "Market", icon: Eye },
  { key: "lender", label: "Lender", icon: Landmark },
  { key: "auditor", label: "Auditor", icon: ShieldCheck }
];

const heroStats = [
  {
    value: "0",
    label: "sales fields exposed"
  },
  {
    value: "79",
    label: "contract tests passing"
  },
  {
    value: "3",
    label: "private proof roles"
  }
];

const privacyCards = [
  {
    title: "Encrypted close",
    copy: "The POS submits a sealed daily report and the market only sees an encrypted report hash.",
    icon: Lock
  },
  {
    title: "Private settlement",
    copy: "The settlement window computes repayment from decrypted bytes and binds it to a receipt hash.",
    icon: Calculator
  },
  {
    title: "Auditor-only proof",
    copy: "Authorized auditors can inspect the receipt; public observers cannot probe another viewer's access.",
    icon: Receipt
  }
];

const operatingSteps = [
  "Public lending terms stay visible.",
  "Daily sales stay sealed.",
  "Compliance failures stay enforceable."
];

function scrollToDemo() {
  document.getElementById("demo")?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function LandingHeader({ onOpenDemo }: { onOpenDemo: () => void }) {
  return (
    <header className="landing-header">
      <a className="landing-brand" href="#top" aria-label="Quiet Till home">
        <span className="landing-brand-mark">
          <Lock aria-hidden="true" />
        </span>
        <span>
          <strong>Quiet Till</strong>
          <small>Programmable privacy</small>
        </span>
      </a>
      <nav className="landing-nav" aria-label="Landing sections">
        <a href="#problem">Model</a>
        <a href="#privacy">Privacy</a>
        <a href="#demo">Console</a>
      </nav>
      <button type="button" className="landing-nav-action" onClick={onOpenDemo} aria-label="Open demo">
        <Play aria-hidden="true" />
        Open console
      </button>
    </header>
  );
}

function HeroMatrix() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return undefined;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      canvas
    });
    const matrixGroup = new THREE.Group();
    const majorRadius = 2.16;
    const tubeRadius = 0.86;
    const radialSegments = 260;
    const tubeSegments = 76;
    const ringBlue = new THREE.Color(0x4f8dff);
    const rimBlue = new THREE.Color(0xb7d7ff);
    let animationFrame = 0;
    let width = 0;
    let height = 0;
    const pointer = {
      x: 0.5,
      y: 0.5
    };

    camera.position.set(0, 0, 7);
    scene.add(matrixGroup);
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    function clamp(value: number, min: number, max: number) {
      return Math.min(max, Math.max(min, value));
    }

    function torusPoint(u: number, v: number) {
      const tube = majorRadius + tubeRadius * Math.cos(v);

      return new THREE.Vector3(
        tube * Math.cos(u),
        tube * Math.sin(u),
        tubeRadius * Math.sin(v)
      );
    }

    function pointShade(point: THREE.Vector3, u: number, v: number) {
      const innerRim = Math.pow(clamp(-Math.cos(v), 0, 1), 1.9);
      const outerSkin = Math.pow(clamp(Math.cos(v), 0, 1), 1.35);
      const sideLight = Math.pow(Math.abs(Math.cos(u)), 0.72);
      const upperLift = clamp((point.y + 1.95) / 4.2, 0.18, 1);
      const depthLift = clamp((point.z + tubeRadius) / (tubeRadius * 2), 0.1, 1);

      return clamp((0.16 + innerRim * 0.72 + outerSkin * 0.22 + sideLight * 0.34) * upperLift * (0.58 + depthLift * 0.42), 0.08, 1);
    }

    const linePositions: number[] = [];
    const lineColors: number[] = [];
    const pointPositions: number[] = [];
    const pointColors: number[] = [];

    function pushVertex(target: number[], point: THREE.Vector3) {
      target.push(point.x, point.y, point.z);
    }

    function pushColor(target: number[], shade: number, tint = ringBlue) {
      target.push(tint.r * shade, tint.g * shade, tint.b * shade);
    }

    function pushLine(a: THREE.Vector3, b: THREE.Vector3, u: number, v: number, tint = ringBlue) {
      const shadeA = pointShade(a, u, v);
      const shadeB = pointShade(b, u, v);

      pushVertex(linePositions, a);
      pushVertex(linePositions, b);
      pushColor(lineColors, shadeA, tint);
      pushColor(lineColors, shadeB, tint);
    }

    for (let i = 0; i < radialSegments; i += 1) {
      const u = (i / radialSegments) * Math.PI * 2;
      const nextU = ((i + 1) / radialSegments) * Math.PI * 2;

      for (let j = 0; j < tubeSegments; j += 1) {
        const v = (j / tubeSegments) * Math.PI * 2;
        const nextV = ((j + 1) / tubeSegments) * Math.PI * 2;
        const point = torusPoint(u, v);
        const alongRing = torusPoint(nextU, v);
        const aroundTube = torusPoint(u, nextV);
        const diagonal = torusPoint(nextU, nextV);
        const shade = pointShade(point, u, v);

        pushVertex(pointPositions, point);
        pushColor(pointColors, shade * 1.18, ringBlue);
        pushLine(point, alongRing, u, v);

        pushLine(point, aroundTube, u, v);

        if (j % 3 === 0) {
          pushLine(point, diagonal, u, v);
        }
      }
    }

    function createRing(radius: number, shade: number) {
      const positions: number[] = [];
      const colors: number[] = [];

      for (let i = 0; i < radialSegments; i += 1) {
        const u = (i / radialSegments) * Math.PI * 2;
        const nextU = ((i + 1) / radialSegments) * Math.PI * 2;
        const a = new THREE.Vector3(radius * Math.cos(u), radius * Math.sin(u), 0.035);
        const b = new THREE.Vector3(radius * Math.cos(nextU), radius * Math.sin(nextU), 0.035);

        pushVertex(positions, a);
        pushVertex(positions, b);
        pushColor(colors, shade, rimBlue);
        pushColor(colors, shade, rimBlue);
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

      return geometry;
    }

    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
    lineGeometry.setAttribute("color", new THREE.Float32BufferAttribute(lineColors, 3));

    const pointGeometry = new THREE.BufferGeometry();
    pointGeometry.setAttribute("position", new THREE.Float32BufferAttribute(pointPositions, 3));
    pointGeometry.setAttribute("color", new THREE.Float32BufferAttribute(pointColors, 3));

    const lineMaterial = new THREE.LineBasicMaterial({
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.5,
      transparent: true,
      vertexColors: true
    });
    const glowMaterial = new THREE.LineBasicMaterial({
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.8,
      transparent: true,
      vertexColors: true
    });
    const pointMaterial = new THREE.PointsMaterial({
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.36,
      size: 0.014,
      sizeAttenuation: true,
      transparent: true,
      vertexColors: true
    });

    const meshLines = new THREE.LineSegments(lineGeometry, lineMaterial);
    const meshPoints = new THREE.Points(pointGeometry, pointMaterial);
    const innerRim = new THREE.LineSegments(createRing(majorRadius - tubeRadius * 0.98, 1.05), glowMaterial);
    const outerRim = new THREE.LineSegments(createRing(majorRadius + tubeRadius * 0.98, 0.42), glowMaterial);

    matrixGroup.add(meshLines, meshPoints, outerRim, innerRim);

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const isCompact = rect.width < 620;

      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
      matrixGroup.position.set(isCompact ? 0.12 : 0.42, isCompact ? 0.38 : 0.28, 0);
      matrixGroup.scale.set(isCompact ? 1.28 : 1.42, isCompact ? 0.84 : 0.88, 1);
    }

    function handlePointerMove(event: PointerEvent) {
      const rect = canvas.getBoundingClientRect();

      pointer.x = (event.clientX - rect.left) / Math.max(1, rect.width);
      pointer.y = (event.clientY - rect.top) / Math.max(1, rect.height);
    }

    function draw(time: number) {
      const pulse = 0.5 + Math.sin(time * 0.001) * 0.5;
      const pointerX = pointer.x - 0.5;
      const pointerY = pointer.y - 0.5;

      matrixGroup.rotation.x = -0.035 + pointerY * 0.055;
      matrixGroup.rotation.y = -0.13 + pointerX * 0.09;
      matrixGroup.rotation.z = -0.01 + Math.sin(time * 0.00016) * 0.012;
      lineMaterial.opacity = 0.29 + pulse * 0.07;
      glowMaterial.opacity = 0.72 + pulse * 0.18;
      pointMaterial.opacity = 0.29 + pulse * 0.08;
      renderer.render(scene, camera);

      animationFrame = window.requestAnimationFrame(draw);
    }

    resize();
    animationFrame = window.requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
    canvas.addEventListener("pointermove", handlePointerMove);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointermove", handlePointerMove);
      lineGeometry.dispose();
      pointGeometry.dispose();
      innerRim.geometry.dispose();
      outerRim.geometry.dispose();
      lineMaterial.dispose();
      glowMaterial.dispose();
      pointMaterial.dispose();
      renderer.dispose();
    };
  }, []);

  return <canvas className="hero-matrix" ref={canvasRef} aria-hidden="true" />;
}

function LandingHero({ onOpenDemo }: { onOpenDemo: () => void }) {
  return (
    <section className="landing-hero" id="top" aria-labelledby="landing-title">
      <div className="hero-frame">
        <LandingHeader onOpenDemo={onOpenDemo} />
        <div className="hero-content">
          <div className="hero-copy-panel">
            <a className="hero-kicker" href="#privacy">
              <ShieldCheck aria-hidden="true" />
              Quiet Till Engine v0.1
              <span>Read proof</span>
              <ArrowRight aria-hidden="true" />
            </a>
            <h1 id="landing-title">
              Settle hidden
              <span>revenue.</span>
            </h1>
            <p className="hero-copy">
              Private revenue financing for merchants: POS reports are encrypted, repayments settle onchain, and auditors can verify while competitors see only hashes.
            </p>
            <div className="hero-actions">
              <button type="button" className="hero-primary" onClick={onOpenDemo}>
                <Play aria-hidden="true" />
                Open console
              </button>
              <a className="hero-secondary" href="#privacy">
                <EyeOff aria-hidden="true" />
                Privacy boundary
              </a>
            </div>
          </div>
          <div className="hero-visual-panel" aria-label="Private settlement graph">
            <HeroMatrix />
            <div className="visual-proof-card">
              <Hash aria-hidden="true" />
              <span>Market view</span>
              <strong>receipt hash only</strong>
            </div>
          </div>
        </div>
        <div className="hero-stats" aria-label="Product signals">
          {heroStats.map((stat) => {
            return (
              <div className="hero-stat" key={stat.label}>
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function LandingSections() {
  return (
    <>
      <section className="landing-band" id="problem" aria-labelledby="problem-title">
        <div className="section-heading">
          <span>Problem</span>
          <h2 id="problem-title">Sales data is loan data, but it should not become market data.</h2>
        </div>
        <div className="problem-grid">
          <article>
            <Megaphone aria-hidden="true" />
            <h3>Public settlement leaks leverage</h3>
            <p>
              A revenue-based lender needs daily sales. A competitor, supplier, or rival lender should not get the same signal for free.
            </p>
          </article>
          <article>
            <EyeOff aria-hidden="true" />
            <h3>Quiet Till keeps the till quiet</h3>
            <p>
              The public chain can verify state transitions, missed-report covenants, and receipt hashes while the register stays sealed.
            </p>
          </article>
        </div>
      </section>

      <section className="landing-band privacy-band" id="privacy" aria-labelledby="privacy-title">
        <div className="section-heading">
          <span>Privacy model</span>
          <h2 id="privacy-title">Programmable privacy is the settlement engine, not a wrapper.</h2>
        </div>
        <div className="privacy-card-grid">
          {privacyCards.map((card) => {
            const Icon = card.icon;

            return (
              <article className="privacy-card" key={card.title}>
                <Icon aria-hidden="true" />
                <h3>{card.title}</h3>
                <p>{card.copy}</p>
              </article>
            );
          })}
        </div>
        <div className="operating-model">
          <div>
            <span>Operating model</span>
            <strong>Visible enough for finance. Private enough for commerce.</strong>
          </div>
          <ol>
            {operatingSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}

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
  activeStep,
  onChange,
  onStepChange
}: {
  activeView: ViewKey;
  activeStep: StepKey;
  onChange: (view: ViewKey) => void;
  onStepChange: (step: StepKey) => void;
}) {
  const activeStepIndex = demoFlow.findIndex((step) => step.key === activeStep);
  const activeLog = demoFlow.slice(0, activeStepIndex + 1).reverse();

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

      <div className="flow-runner" aria-label="Settlement flow">
        <div className="flow-heading">
          <Play aria-hidden="true" />
          <span>Demo run</span>
        </div>
        <div className="flow-steps">
          {demoFlow.map((step, index) => {
            const selected = step.key === activeStep;
            const complete = index <= activeStepIndex;

            return (
              <button
                key={step.key}
                type="button"
                className={[
                  "flow-step",
                  selected ? "flow-step-active" : "",
                  complete ? "flow-step-complete" : ""
                ].join(" ")}
                onClick={() => {
                  onStepChange(step.key);
                  onChange(step.view as ViewKey);
                }}
              >
                <span>{index + 1}</span>
                <strong>{step.label}</strong>
              </button>
            );
          })}
        </div>
        <div className="flow-log">
          {activeLog.map((step) => (
            <div className={`log-entry log-${step.tone}`} key={step.key}>
              <strong>{step.status}</strong>
              <span>{step.event}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function MerchantView({ activeStep, onAdvance }: { activeStep: StepKey; onAdvance: () => void }) {
  const actionLabel =
    activeStep === "ctx-settlement" || activeStep === "late-cure"
      ? "Open lender receipt"
      : activeStep === "encrypted-report"
        ? "Request CTX close"
        : `Seal day ${fixture.report.dayIndex}`;

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
          <code>{display.shortHash(`0x${BigInt(fixture.report.nonce).toString(16)}`)}</code>
        </div>
        <div className="register-row">
          <span>Report hash</span>
          <code>{display.shortHash(manifest.privateReport.encryptedReportHash)}</code>
        </div>
        <div className="register-row">
          <span>Plaintext commitment</span>
          <code>{display.shortHash(manifest.privateReport.plaintextCommitmentHash)}</code>
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
        <button type="button" className="primary-action" onClick={onAdvance}>
          <Lock aria-hidden="true" />
          {actionLabel}
        </button>
        <StatusPill icon={CheckCircle} label="Settlement window armed" tone="good" />
      </div>
    </section>
  );
}

function PublicView({ onAdvance }: { onAdvance: () => void }) {
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

      <div className="action-row">
        <button type="button" className="primary-action" onClick={onAdvance}>
          <Lock aria-hidden="true" />
          Start private path
        </button>
        <StatusPill icon={EyeOff} label="Private path keeps sales hidden" tone="good" />
      </div>
    </section>
  );
}

function JudgeEvidencePanel() {
  const publicMode = judgeEvidence.publicObserver.publicMode;
  const privateMode = judgeEvidence.publicObserver.quietTillMode;
  const privateGrossSales =
    privateMode.visibleGrossSales === null
      ? "hidden"
      : display.amount(privateMode.visibleGrossSales);
  const conditions = [
    {
      label: "No public sales",
      passed: judgeEvidence.passConditions.noQuietTillPublicGrossSales
    },
    {
      label: "No public repayment",
      passed: judgeEvidence.passConditions.noQuietTillPublicProjectedRepayment
    },
    {
      label: "Receipt binds",
      passed: judgeEvidence.passConditions.publicReceiptBinding
    },
    {
      label: "Tamper caught",
      passed: judgeEvidence.passConditions.tamperSensitivity
    },
    {
      label: "Late cure sealed",
      passed:
        judgeEvidence.passConditions.lateCureDoesNotLeakSales &&
        judgeEvidence.passConditions.lateCureDoesNotCreateMarketReceipt &&
        judgeEvidence.passConditions.lateCureClearsMissingStrike
    },
    {
      label: "Missing day sealed",
      passed:
        judgeEvidence.passConditions.missingReportDoesNotLeakSales &&
        judgeEvidence.passConditions.missingReportDoesNotCreateReceipt
    },
    {
      label: "Covenant defaults",
      passed: judgeEvidence.passConditions.repeatedMissingReportsDefaultLoan
    }
  ];

  return (
    <div className="judge-evidence" aria-label="Judge evidence bundle">
      <div className="evidence-header">
        <ClipboardCheck aria-hidden="true" />
        <div>
          <span>Judge evidence</span>
          <strong>{judgeEvidence.tracks.join(" + ")}</strong>
        </div>
      </div>
      <div className="evidence-grid">
        <div className="evidence-column evidence-leak">
          <span>Public mode leak</span>
          <strong>{display.amount(publicMode.visibleGrossSales)}</strong>
          <small>{publicMode.competitorSignal}</small>
        </div>
        <div className="evidence-column evidence-private">
          <span>Quiet Till market view</span>
          <strong>{privateGrossSales}</strong>
          <small>{display.shortHash(privateMode.privateReceiptHash)}</small>
        </div>
        <div className="evidence-column evidence-tamper">
          <span>Tamper check</span>
          <strong>{judgeEvidence.tamperCheck.tamperDetected ? "detected" : "missed"}</strong>
          <small>{display.shortHash(judgeEvidence.tamperCheck.tamperedReceiptHash)}</small>
        </div>
        <div className="evidence-column evidence-sla">
          <span>Report covenant</span>
          <strong>{judgeEvidence.complianceSla.loanStatusAfterDefaultTrigger}</strong>
          <small>
            Cure day {judgeEvidence.complianceSla.curedDayIndex}, then{" "}
            {judgeEvidence.complianceSla.defaultAfterMissedReports} misses default
          </small>
        </div>
      </div>
      <div className="condition-row">
        {conditions.map((condition) => (
          <span className="condition-pill" key={condition.label}>
            {condition.label === "Late cure sealed" ||
            condition.label === "Missing day sealed" ||
            condition.label === "Covenant defaults" ? (
              <Clock aria-hidden="true" />
            ) : (
              <CheckCircle aria-hidden="true" />
            )}
            {condition.label}: {condition.passed ? "pass" : "fail"}
          </span>
        ))}
      </div>
    </div>
  );
}

function LenderView({ onAdvance }: { onAdvance: () => void }) {
  const lender = transcript.privateMode.visibleToLender;

  return (
    <section className="view-grid view-lender" aria-labelledby="lender-heading">
      <div className="view-title">
        <Landmark aria-hidden="true" />
        <div>
          <p>Lender receipt</p>
          <h2 id="lender-heading">Settlement received</h2>
        </div>
      </div>

      <div className="lender-ledger">
        <Metric
          icon={CircleDollarSign}
          label="Recorded payment"
          value={display.amount(lender.repaymentAmount)}
          tone="good"
        />
        <Metric
          icon={Landmark}
          label="Outstanding after"
          value={display.amount(lender.outstandingAfter)}
        />
        <Metric
          icon={Receipt}
          label="Payment status"
          value={lender.paymentStatus}
          tone="good"
        />
      </div>

      <div className="lender-receipt">
        <div className="proof-status">
          <StatusPill icon={CheckCircle} label="Bound to private receipt" tone="good" />
          <StatusPill icon={Wallet} label={lender.tokenSymbol} />
        </div>
        <div className="lender-proof-grid">
          <div>
            <span>Lender</span>
            <code>{display.shortHash(lender.lender)}</code>
          </div>
          <div>
            <span>Private receipt hash</span>
            <code>{display.shortHash(lender.privateReceiptHash)}</code>
          </div>
          <div>
            <span>Private pay commitment</span>
            <code>{display.shortHash(lender.privatePaymentCommitmentHash)}</code>
          </div>
          <div>
            <span>Payment privacy</span>
            <code>{lender.fallbackPaymentIsPublic ? "fallback public token" : "confidential token"}</code>
          </div>
        </div>
      </div>

      <div className="payment-boundary">
        <StatusPill icon={AlertTriangle} label="Payment privacy fallback" tone="warn" />
        <p>{lender.confidentialPaymentStatus}</p>
      </div>

      <div className="action-row">
        <button type="button" className="primary-action" onClick={onAdvance}>
          <ShieldCheck aria-hidden="true" />
          Open auditor proof
        </button>
        <StatusPill icon={Hash} label="Receipt hash links every role" tone="good" />
      </div>
    </section>
  );
}

function AuditorView() {
  const auditor = transcript.privateMode.visibleToAuditor;
  const authorization = auditor.authorization;
  const receipt = auditor.privateReceipt;
  const disclosureEnvelope = auditor.disclosureEnvelope;
  const receiptExportHash = judgeEvidence.auditorEvidence.receiptExportHash;

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

      <div className="disclosure-gate">
        <div className="gate-heading">
          <ShieldCheck aria-hidden="true" />
          <div>
            <span>Selective disclosure</span>
            <strong>{authorization.disclosureMode}</strong>
          </div>
        </div>
        <div className="gate-grid">
          <div>
            <span>Authorized auditor</span>
            <code>{display.shortHash(authorization.auditor)}</code>
          </div>
          <div>
            <span>Auditor access</span>
            <strong>{authorization.canViewReceipt ? "allowed" : "blocked"}</strong>
          </div>
          <div>
            <span>Public observer</span>
            <strong>{authorization.publicObserverCanViewReceipt ? "allowed" : "blocked"}</strong>
          </div>
          <div>
            <span>Envelope hash</span>
            <code>{display.shortHash(disclosureEnvelope.envelopeHash)}</code>
          </div>
          <div>
            <span>Envelope mode</span>
            <strong>{disclosureEnvelope.mode}</strong>
          </div>
          <div>
            <span>Ciphertext</span>
            <code>{display.shortHash(disclosureEnvelope.ciphertext)}</code>
          </div>
        </div>
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
            <span>Receipt export hash</span>
            <code>{display.shortHash(receiptExportHash)}</code>
          </div>
          <div>
            <span>Tampered sales hash</span>
            <code>{display.shortHash(auditor.tamperedGrossSalesReceiptHash)}</code>
          </div>
        </div>
      </div>

      <JudgeEvidencePanel />

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

function DemoConsole() {
  const [activeView, setActiveView] = useState<ViewKey>("public");
  const [activeStep, setActiveStep] = useState<StepKey>(demoFlow[0].key);

  function moveToStep(stepIndex: number) {
    const nextStep = demoFlow[Math.min(stepIndex, demoFlow.length - 1)];

    setActiveStep(nextStep.key);
    setActiveView(nextStep.view as ViewKey);
  }

  function advanceStep() {
    const currentIndex = demoFlow.findIndex((step) => step.key === activeStep);
    moveToStep(currentIndex + 1);
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <section className="workspace">
        <ScenarioRail
          activeView={activeView}
          activeStep={activeStep}
          onChange={setActiveView}
          onStepChange={setActiveStep}
        />
        <section className="demo-surface">
          {activeView === "merchant" ? <MerchantView activeStep={activeStep} onAdvance={advanceStep} /> : null}
          {activeView === "public" ? <PublicView onAdvance={advanceStep} /> : null}
          {activeView === "lender" ? <LenderView onAdvance={advanceStep} /> : null}
          {activeView === "auditor" ? <AuditorView /> : null}
        </section>
      </section>
    </div>
  );
}

export function App() {
  return (
    <main className="site-shell">
      <LandingHero onOpenDemo={scrollToDemo} />
      <LandingSections />
      <section className="demo-section" id="demo" aria-labelledby="demo-title">
        <div className="section-heading demo-heading">
          <span>Interactive demo</span>
          <h2 id="demo-title">Settlement console</h2>
          <p>
            The MVP console stays here for judges and builders: roles, hashes, and the private settlement path in one compact surface.
          </p>
        </div>
        <DemoConsole />
      </section>
    </main>
  );
}
