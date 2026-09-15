import type { Metadata } from "next";
import Link from "next/link";
import {
  IconArrowDown,
  IconArrowUpRight,
  IconCheck,
  IconChevronRight,
  IconCodeBracket,
  IconDownload,
  IconFileText,
  IconGitBranch,
  IconGlobe,
  IconLogoGithub,
  IconPointer,
} from "@/components/icons";
import { BrandLogo } from "@/components/brand-logo";
import { Icon } from "@/components/icon";
import { KINDS } from "@/components/kinds";
import { LandingTour } from "@/components/landing/landing-tour";
import { Mark } from "@/components/mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { signInAction } from "@/lib/actions";
import { BRANDS, type BrandId } from "@/lib/brands";
import { getAccount, isAuthEnabled } from "@/lib/session";
import { OPEN_GRAPH, SITE_DESCRIPTION, SITE_NAME, siteUrl } from "@/lib/site";
import "@/app/landing.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: { ...OPEN_GRAPH, url: "/" },
};

const REPO = "https://github.com/anishfn/evelab";

/** Only facts the page itself states: what EveLab is, that it is free, and where the code lives. */
function structuredData() {
  const url = siteUrl().toString();
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", "@id": `${url}#website`, url, name: SITE_NAME, description: SITE_DESCRIPTION },
      {
        "@type": "SoftwareApplication",
        "@id": `${url}#app`,
        name: SITE_NAME,
        url,
        description: SITE_DESCRIPTION,
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Web",
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        sameAs: [REPO],
      },
    ],
  };
}

const KIND_ORDER = ["subagent", "tool", "skill", "connection", "channel"] as const;

const PRINCIPLES = [
  { icon: IconFileText, title: "Real files", body: "A plain Eve project. No EveLab SDK inside." },
  { icon: IconCodeBracket, title: "Always in sync", body: "Edit the code, the canvas redraws. Edit the canvas, the code updates." },
  { icon: IconLogoGithub, title: "Open source", body: "Free to use, and built in the open on GitHub." },
];

const HERO_POINTS = ["For Eve agents", "Drawn on a canvas", "Shipped as real code"];

const WORKS_WITH: BrandId[] = ["slack", "discord", "teams", "github", "linear", "notion", "stripe", "vercel"];

const INTEGRATIONS: BrandId[] = ["slack", "discord", "teams", "telegram", "twilio", "github", "linear", "notion"];

const TOUR_POINTS = ["A canvas drawn from your files", "Monaco for every file", "Commit, push and pull with GitHub", "A zip you can run with eve dev"];

/** The agent the hero is about, drawn with the canvas's own pieces: channels above, what it uses below. */
function HeroDiagram() {
  return (
    <div className="lp-diagram" aria-hidden="true">
      <div className="lp-dg-row lp-dg-channels">
        {(["slack", "discord"] as const).map((brand) => (
          <span key={brand} className="lp-dg-node">
            <span className="lp-dg-tile" data-shape="square">
              <BrandLogo brand={brand} size={24} />
            </span>
            <span className="lp-dg-label">{brand}</span>
          </span>
        ))}
      </div>
      <svg className="lp-dg-wires" viewBox="0 0 360 40">
        <path d="M120 0 C120 20 180 20 180 40" />
        <path d="M240 0 C240 20 180 20 180 40" />
      </svg>
      <div className="lp-dg-agent">
        <span className="lp-dg-agent-icon">
          <Icon icon={KINDS.agent.icon} size={18} />
        </span>
        <span className="lp-dg-agent-text">
          <b>support-desk</b>
          <code>claude-opus-5</code>
        </span>
      </div>
      <svg className="lp-dg-wires" viewBox="0 0 360 40">
        <path d="M180 0 C180 20 60 20 60 40" />
        <path d="M180 0 V40" />
        <path d="M180 0 C180 20 300 20 300 40" />
      </svg>
      <div className="lp-dg-row lp-dg-resources">
        <span className="lp-dg-node" data-kind="tool">
          <span className="lp-dg-tile">
            <Icon icon={KINDS.tool.icon} size={22} />
          </span>
          <span className="lp-dg-label">search_docs</span>
        </span>
        <span className="lp-dg-node" data-kind="skill">
          <span className="lp-dg-tile">
            <Icon icon={KINDS.skill.icon} size={22} />
          </span>
          <span className="lp-dg-label">triage</span>
        </span>
        <span className="lp-dg-node" data-kind="connection">
          <span className="lp-dg-tile" data-brand="">
            <BrandLogo brand="linear" size={22} />
          </span>
          <span className="lp-dg-label">linear</span>
        </span>
      </div>
    </div>
  );
}

/**
 * The public front door, laid out after vercel.com: a tall hero with the
 * product drawn in the middle, a row of what it connects to, then one idea per
 * section with plenty of room around it. Everyone can read and play; building a
 * real project needs an account once sign-in is configured.
 */
export default async function LandingPage() {
  const authEnabled = isAuthEnabled();
  const account = authEnabled ? await getAccount() : undefined;
  const canOpen = !authEnabled || Boolean(account);

  const start = (label: string, href: string) => {
    const className = "h-11 rounded-full px-6 text-[15px]";
    return canOpen ? (
      <Button asChild size="lg" className={className}>
        <Link href={href}>{label}</Link>
      </Button>
    ) : (
      <form action={signInAction}>
        <Button type="submit" size="lg" className={className}>
          {label}
        </Button>
      </form>
    );
  };

  return (
    <div className="lp">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData()) }} />
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className="lp-header">
        <Link className="lp-brand" href="/" aria-label="EveLab home">
          <Mark />
          EveLab
        </Link>
        <nav className="lp-nav" aria-label="Sections">
          <a href="#demo">Tour</a>
          <a href="#features">Features</a>
          <a href="#integrations">Integrations</a>
          <Link href="/templates">Templates</Link>
          <a href="https://eve.dev/docs" target="_blank" rel="noreferrer">
            Docs
          </a>
        </nav>
        <div className="lp-header-actions">
          <ThemeToggle />
          <Button asChild variant="outline" size="sm" className="lp-header-link max-[760px]:hidden">
            <a href={REPO} target="_blank" rel="noreferrer">
              <Icon icon={IconLogoGithub} size={14} />
              GitHub
            </a>
          </Button>
          {canOpen ? (
            <Button asChild size="sm">
              <Link href="/projects">{account ? "Projects" : "Open app"}</Link>
            </Button>
          ) : (
            <>
              <form action={signInAction}>
                <Button type="submit" variant="outline" size="sm">
                  Log in
                </Button>
              </form>
              <form action={signInAction}>
                <Button type="submit" size="sm">
                  Get started
                </Button>
              </form>
            </>
          )}
        </div>
      </header>

      <main id="main">
        <section className="lp-hero" aria-labelledby="hero-title">
          <div className="lp-hero-copy">
            <a className="lp-kicker" href={REPO} target="_blank" rel="noreferrer">
              <i aria-hidden="true" />
              Open source visual IDE for eve
              <Icon icon={IconChevronRight} size={12} />
            </a>
            <h1 className="lp-display" id="hero-title">
              Draw your agent.
              <br />
              Get real code.
            </h1>
            <div className="lp-actions">
              {start(account ? "Open your projects" : "Start building", account ? "/projects" : "/projects/new")}
              <Button asChild variant="outline" size="lg" className="h-11 rounded-full px-6 text-[15px]">
                <a href="#demo">
                  Watch the tour
                  <Icon icon={IconArrowDown} size={14} />
                </a>
              </Button>
            </div>
          </div>

          <HeroDiagram />

          <ul className="lp-hero-points">
            {HERO_POINTS.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </section>

        <section className="lp-logos" aria-label="Services an agent can connect to">
          <ul>
            {WORKS_WITH.map((brand) => (
              <li key={brand}>
                <BrandLogo brand={brand} size={22} />
                {BRANDS[brand].name}
              </li>
            ))}
          </ul>
        </section>

        <section className="lp-section" id="demo" aria-labelledby="demo-title">
          <div className="lp-section-split">
            <h2 className="lp-heading" id="demo-title">
              Watch an agent
              <br />
              take shape
            </h2>
            <div className="lp-aside">
              <p className="lp-label">What you get</p>
              <ul>
                {TOUR_POINTS.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="lp-demo">
            <LandingTour />
          </div>
        </section>

        <section className="lp-section" id="how" aria-labelledby="how-title">
          <div className="lp-section-split">
            <h2 className="lp-heading" id="how-title">
              From idea to a running
              <br />
              agent in three steps
            </h2>
            <p className="lp-section-lede">Start or import, draw it, take the code.</p>
          </div>
          <ol className="lp-steps">
            <li className="lp-step">
              <div className="lp-step-visual" aria-hidden="true">
                <div className="lp-mini-form">
                  <span className="lp-mini-field">
                    <span>Name</span>
                    <code>support-desk</code>
                  </span>
                  <span className="lp-mini-field">
                    <span>Provider</span>
                    <code>AI Gateway</code>
                  </span>
                  <span className="lp-mini-field">
                    <span>Model</span>
                    <code>claude-opus-5</code>
                  </span>
                </div>
              </div>
              <div className="lp-step-text">
                <span className="lp-step-number">01</span>
                <h3 className="lp-card-title">Start or import</h3>
                <p className="lp-card-body">Create a new agent, or import an Eve repo from GitHub.</p>
              </div>
            </li>
            <li className="lp-step">
              <div className="lp-step-visual" aria-hidden="true">
                <div className="lp-mini-kinds">
                  {KIND_ORDER.map((kind) => (
                    <span key={kind} className="lp-mini-kind" data-kind={kind}>
                      <Icon icon={KINDS[kind].icon} size={14} />
                      {KINDS[kind].plural}
                    </span>
                  ))}
                </div>
              </div>
              <div className="lp-step-text">
                <span className="lp-step-number">02</span>
                <h3 className="lp-card-title">Draw the architecture</h3>
                <p className="lp-card-body">Drag pieces onto agents. Every card is a file.</p>
              </div>
            </li>
            <li className="lp-step">
              <div className="lp-step-visual" aria-hidden="true">
                <div className="lp-mini-term">
                  <span>
                    <b>$</b> npm install
                  </span>
                  <span>
                    <b>$</b> npm run dev
                  </span>
                </div>
              </div>
              <div className="lp-step-text">
                <span className="lp-step-number">03</span>
                <h3 className="lp-card-title">Take the code</h3>
                <p className="lp-card-body">Download a zip or push to GitHub. Run it with eve dev.</p>
              </div>
            </li>
          </ol>
        </section>

        <section className="lp-section" id="features" aria-labelledby="features-title">
          <div className="lp-section-split">
            <h2 className="lp-heading" id="features-title">
              Build agents the way
              <br />
              you picture them
            </h2>
            <p className="lp-section-lede">Everything an Eve agent needs, on one canvas.</p>
          </div>

          <ul className="lp-bento">
            <li className="lp-feature-card">
              <div className="lp-feature-visual" aria-hidden="true">
                <div className="lp-fx-drop">
                  <span className="lp-fx-chip lp-fx-dragged" data-kind="tool">
                    <Icon icon={KINDS.tool.icon} size={13} />
                    search_docs
                    <Icon icon={IconPointer} size={16} className="lp-fx-cursor" />
                  </span>
                  <span className="lp-fx-agent">
                    <span className="lp-fx-agent-icon">
                      <Icon icon={KINDS.agent.icon} size={15} />
                    </span>
                    support-desk
                  </span>
                </div>
              </div>
              <div className="lp-feature-text">
                <h3 className="lp-card-title">Drag pieces onto agents</h3>
                <p className="lp-card-body">Drop a piece on an agent. Its file is written for you.</p>
              </div>
            </li>

            <li className="lp-feature-card">
              <div className="lp-feature-visual" aria-hidden="true">
                <div className="lp-fx-share">
                  <span className="lp-fx-share-row">
                    <span className="lp-fx-chip" data-kind="subagent">
                      <Icon icon={KINDS.subagent.icon} size={13} />
                      billing
                    </span>
                    <span className="lp-fx-chip" data-kind="subagent">
                      <Icon icon={KINDS.subagent.icon} size={13} />
                      researcher
                    </span>
                  </span>
                  <svg className="lp-fx-wires" data-kind="tool" viewBox="0 0 240 48">
                    <path d="M60 0 C60 26, 120 22, 120 48" />
                    <path d="M180 0 C180 26, 120 22, 120 48" />
                  </svg>
                  <span className="lp-fx-tile" data-kind="tool">
                    <Icon icon={KINDS.tool.icon} size={18} />
                  </span>
                  <span className="lp-fx-caption">search_docs, shared by 2 agents</span>
                </div>
              </div>
              <div className="lp-feature-text">
                <h3 className="lp-card-title">Share what agents need</h3>
                <p className="lp-card-body">One tool or skill can serve many agents.</p>
              </div>
            </li>

            <li className="lp-feature-card">
              <div className="lp-feature-visual" aria-hidden="true">
                <div className="lp-fx-mcp" data-kind="connection">
                  <span className="lp-fx-url">
                    <Icon icon={IconGlobe} size={13} />
                    mcp.linear.app/mcp
                    <span className="lp-fx-found">3 tools found</span>
                  </span>
                  <ul>
                    <li data-on="">
                      <span className="lp-fx-check">
                        <Icon icon={IconCheck} size={11} />
                      </span>
                      list_issues
                    </li>
                    <li data-on="">
                      <span className="lp-fx-check">
                        <Icon icon={IconCheck} size={11} />
                      </span>
                      get_issue
                    </li>
                    <li>
                      <span className="lp-fx-check" />
                      create_issue
                    </li>
                  </ul>
                </div>
              </div>
              <div className="lp-feature-text">
                <h3 className="lp-card-title">Discover MCP tools</h3>
                <p className="lp-card-body">Paste an MCP URL and pick the tools to allow.</p>
              </div>
            </li>

            <li className="lp-feature-card">
              <div className="lp-feature-visual" aria-hidden="true">
                <div className="lp-fx-layouts">
                  <span className="lp-fx-layout" data-on="">
                    <svg viewBox="0 0 56 40">
                      <rect x="22" y="2" width="12" height="8" rx="2" />
                      <rect x="4" y="30" width="12" height="8" rx="2" />
                      <rect x="22" y="30" width="12" height="8" rx="2" />
                      <rect x="40" y="30" width="12" height="8" rx="2" />
                      <path d="M28 10 V20 M10 30 V20 H46 V30 M28 20 V30" />
                    </svg>
                    Hierarchy
                  </span>
                  <span className="lp-fx-layout">
                    <svg viewBox="0 0 56 40">
                      <rect x="2" y="16" width="12" height="8" rx="2" />
                      <rect x="42" y="2" width="12" height="8" rx="2" />
                      <rect x="42" y="16" width="12" height="8" rx="2" />
                      <rect x="42" y="30" width="12" height="8" rx="2" />
                      <path d="M14 20 H28 M28 6 V34 M28 6 H42 M28 20 H42 M28 34 H42" />
                    </svg>
                    Horizontal
                  </span>
                  <span className="lp-fx-layout">
                    <svg viewBox="0 0 56 40">
                      <rect x="4" y="6" width="12" height="8" rx="2" />
                      <rect x="30" y="2" width="12" height="8" rx="2" />
                      <rect x="18" y="26" width="12" height="8" rx="2" />
                      <rect x="40" y="22" width="12" height="14" rx="2" className="lp-fx-note" />
                      <path d="M16 10 C22 10, 24 6, 30 6 M10 14 C10 22, 16 30, 18 30" />
                    </svg>
                    Freeform
                  </span>
                </div>
              </div>
              <div className="lp-feature-text">
                <h3 className="lp-card-title">Lay it out your way</h3>
                <p className="lp-card-body">Hierarchy, horizontal or freeform, with notes.</p>
              </div>
            </li>
          </ul>

          <ul className="lp-principles">
            {PRINCIPLES.map((principle) => (
              <li key={principle.title}>
                <Icon icon={principle.icon} size={18} />
                <h3 className="lp-card-title">{principle.title}</h3>
                <p className="lp-card-body">{principle.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="lp-section" id="integrations" aria-labelledby="integrations-title">
          <div className="lp-section-split">
            <h2 className="lp-heading" id="integrations-title">
              Reach people where
              <br />
              they already are
            </h2>
            <p className="lp-section-lede">Channels and services from eve&apos;s registry, written the way eve add writes them.</p>
          </div>

          <ul className="lp-int-grid">
            {INTEGRATIONS.map((brand) => (
              <li key={brand} className="lp-int-card">
                <span className="lp-int-top">
                  <span className="lp-int-mark">
                    <BrandLogo brand={brand} size={20} />
                  </span>
                  <span className="lp-int-tag">{BRANDS[brand].tag}</span>
                </span>
                <h3 className="lp-int-name">{BRANDS[brand].name}</h3>
                <p className="lp-card-body">{BRANDS[brand].description}</p>
              </li>
            ))}
          </ul>
          <a className="lp-more" href="https://eve.dev/integrations" target="_blank" rel="noreferrer">
            Every integration on eve.dev
            <Icon icon={IconArrowUpRight} size={14} />
          </a>
        </section>

        <section className="lp-section" id="export" aria-labelledby="export-title">
          <div className="lp-section-split">
            <h2 className="lp-heading" id="export-title">
              Your code,
              <br />
              ready to ship
            </h2>
            <p className="lp-section-lede">No lock-in. Take your project anytime.</p>
          </div>

          <ul className="lp-bento lp-bento-3">
            <li className="lp-feature-card">
              <div className="lp-feature-visual" aria-hidden="true">
                <div className="lp-fx-zip">
                  <span className="lp-fx-zip-head">
                    <Icon icon={IconDownload} size={14} />
                    support-desk.zip
                    <span>12 files</span>
                  </span>
                  <ul>
                    <li>agent/agent.ts</li>
                    <li>agent/instructions.md</li>
                    <li>agent/tools/search_docs.ts</li>
                    <li>agent/connections/github.ts</li>
                    <li>package.json</li>
                  </ul>
                </div>
              </div>
              <div className="lp-feature-text">
                <h3 className="lp-card-title">Download a zip</h3>
                <p className="lp-card-body">All files, ready for npm install and eve dev.</p>
              </div>
            </li>

            <li className="lp-feature-card">
              <div className="lp-feature-visual" aria-hidden="true">
                <div className="lp-fx-commit">
                  <span className="lp-fx-commit-repo">
                    <Icon icon={IconLogoGithub} size={14} />
                    you/support-desk
                    <span className="lp-fx-branch">
                      <Icon icon={IconGitBranch} size={12} />
                      main
                    </span>
                  </span>
                  <span className="lp-fx-commit-row">
                    <span>Add search_docs tool and github connection</span>
                    <code>a1c9e2f</code>
                  </span>
                  <span className="lp-fx-commit-done">
                    <Icon icon={IconCheck} size={13} />
                    Pushed 3 changed files
                  </span>
                </div>
              </div>
              <div className="lp-feature-text">
                <h3 className="lp-card-title">Push to GitHub</h3>
                <p className="lp-card-body">Commit to a new or existing repo.</p>
              </div>
            </li>

            <li className="lp-feature-card">
              <div className="lp-feature-visual" aria-hidden="true">
                <div className="lp-fx-pull">
                  <span className="lp-fx-pull-step">
                    <Icon icon={IconLogoGithub} size={14} />
                    Edited on GitHub
                  </span>
                  <span className="lp-fx-pull-arrow">
                    <Icon icon={IconArrowDown} size={14} />
                    Pull
                  </span>
                  <span className="lp-fx-pull-step" data-done="">
                    <Icon icon={IconCheck} size={14} />
                    Canvas redrawn from the files
                  </span>
                </div>
              </div>
              <div className="lp-feature-text">
                <h3 className="lp-card-title">Pull changes back</h3>
                <p className="lp-card-body">Edited elsewhere? Pull, and the canvas redraws.</p>
              </div>
            </li>
          </ul>
        </section>

        <section className="lp-cta" aria-labelledby="cta-title">
          <h2 className="lp-display lp-display-small" id="cta-title">
            Draw your first agent
          </h2>
          <p className="lp-lede">Free and open source. Your code stays yours.</p>
          <div className="lp-actions">
            {start(account ? "Open your projects" : "Get started", account ? "/projects" : "/projects/new")}
            <Button asChild variant="outline" size="lg" className="h-11 rounded-full px-6 text-[15px]">
              <a href="https://eve.dev/docs" target="_blank" rel="noreferrer">
                Read the Eve docs
                <Icon icon={IconArrowUpRight} />
              </a>
            </Button>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-footer-brand">
          <span className="lp-brand">
            <Mark />
            EveLab
          </span>
          <p>The open source visual IDE for Eve agents.</p>
          <a className="lp-credit" href="https://eve.dev" target="_blank" rel="noreferrer">
            Built for eve
          </a>
        </div>
        <nav className="lp-footer-links" aria-label="Product">
          <p className="lp-label">Product</p>
          <a href="#demo">Tour</a>
          <a href="#how">How it works</a>
          <a href="#features">Features</a>
          <a href="#integrations">Integrations</a>
          <a href="#export">Export</a>
          <Link href="/templates">Templates</Link>
        </nav>
        <nav className="lp-footer-links" aria-label="Resources">
          <p className="lp-label">Resources</p>
          <a href="https://eve.dev/docs" target="_blank" rel="noreferrer">
            Eve docs
            <Icon icon={IconChevronRight} size={12} />
          </a>
          <a href="https://eve.dev/integrations" target="_blank" rel="noreferrer">
            Eve integrations
            <Icon icon={IconChevronRight} size={12} />
          </a>
          <a href={REPO} target="_blank" rel="noreferrer">
            GitHub
            <Icon icon={IconChevronRight} size={12} />
          </a>
        </nav>
      </footer>
    </div>
  );
}
