import Link from "next/link";
import {
  IconArrowUpRight,
  IconCheck,
  IconChevronRight,
  IconCodeBracket,
  IconFileText,
  IconGlobe,
  IconLogoGithub,
  IconPointer,
} from "@/components/icons";
import { Icon } from "@/components/icon";
import { KINDS } from "@/components/kinds";
import { LandingDemo } from "@/components/landing/landing-demo";
import { Mark } from "@/components/mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { signInAction } from "@/lib/actions";
import { getAccount, isAuthEnabled } from "@/lib/session";
import "@/app/landing.css";

export const dynamic = "force-dynamic";

const REPO = "https://github.com/anishfn/evelab";

const KIND_ORDER = ["subagent", "tool", "skill", "connection", "channel"] as const;

const PRINCIPLES = [
  { icon: IconFileText, title: "Real files, not a runtime", body: "EveLab writes a plain Eve project. There is no EveLab SDK in your code and nothing extra to host." },
  { icon: IconCodeBracket, title: "Code and canvas stay in step", body: "Change a file in the editor and the canvas redraws. Attach a piece on the canvas and the code is written." },
  { icon: IconLogoGithub, title: "Open source", body: "Read how it works, run it on your own machine and shape it with the community on GitHub." },
];

/**
 * The public front door. The playground near the top does the selling: a
 * visitor builds a small agent and sees the Eve code EveLab writes before they
 * sign up. Everyone can read and play; building a real project needs an
 * account once sign-in is configured, and in local mode it opens straight into
 * the app.
 */
export default async function LandingPage() {
  const authEnabled = isAuthEnabled();
  const account = authEnabled ? await getAccount() : undefined;
  const canOpen = !authEnabled || Boolean(account);

  const start = (label: string, href: string, size: "sm" | "lg" = "lg") => {
    const className = size === "lg" ? "h-11 rounded-full px-6 text-[15px]" : "rounded-full px-4";
    return canOpen ? (
      <Button asChild size={size} className={className}>
        <Link href={href}>{label}</Link>
      </Button>
    ) : (
      <form action={signInAction}>
        <Button type="submit" size={size} className={className}>
          {label}
        </Button>
      </form>
    );
  };

  return (
    <div className="lp">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className="lp-header">
        <Link className="lp-brand" href="/" aria-label="EveLab home">
          <Mark />
          EveLab
        </Link>
        <nav className="lp-nav" aria-label="Sections">
          <a href="#demo">Demo</a>
          <a href="#how">How it works</a>
          <a href="#features">Features</a>
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
          <div className="lp-hero-main">
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
          </div>
          <div className="lp-hero-side">
            <p className="lp-lede">
              Wire subagents, tools, skills, connections and channels on a canvas. EveLab writes the TypeScript project file for
              file, the way eve init would, so it runs with eve dev and ships like any Eve agent.
            </p>
            <div className="lp-actions">
              {start(account ? "Open your projects" : "Start building", account ? "/projects" : "/projects/new")}
              <Button asChild variant="outline" size="lg" className="h-11 rounded-full px-6 text-[15px]">
                <a href="#demo">Try the demo</a>
              </Button>
            </div>
          </div>
        </section>

        <section className="lp-demo" id="demo" aria-label="Try EveLab">
          <p className="lp-demo-label">Live demo. No sign up. Drag a piece onto the agent.</p>
          <LandingDemo cta={start("Build this for real", "/projects/new", "sm")} />
        </section>

        <section className="lp-section" id="how" aria-labelledby="how-title">
          <div className="lp-section-head">
            <p className="lp-eyebrow">How it works</p>
            <h2 className="lp-heading" id="how-title">
              From idea to a running agent in three steps
            </h2>
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
                    <code>claude-opus-4.8</code>
                  </span>
                </div>
              </div>
              <div className="lp-step-text">
                <span className="lp-step-number">01</span>
                <h3 className="lp-card-title">Name your agent</h3>
                <p className="lp-card-body">Pick a name, a provider and a model. EveLab asks what eve init asks and writes the same files.</p>
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
                <p className="lp-card-body">Drag pieces onto agents and wire them together. Every card is a file and every wire is a real reference.</p>
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
                <p className="lp-card-body">Download a zip or push to GitHub, then run it anywhere with eve dev. Nothing ties it to EveLab.</p>
              </div>
            </li>
          </ol>
        </section>

        <section className="lp-section" id="features" aria-labelledby="features-title">
          <div className="lp-section-split">
            <div className="lp-section-head">
              <p className="lp-eyebrow">Features</p>
              <h2 className="lp-heading" id="features-title">
                Build agents the way you picture them
              </h2>
            </div>
            <p className="lp-section-lede">Everything an Eve agent is made of, on one canvas, with the code one click away.</p>
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
                <p className="lp-card-body">Drop a subagent, tool, skill or connection on an agent and EveLab writes its file.</p>
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
                <p className="lp-card-body">One tool, skill or connection can serve every agent that uses it, from a single file.</p>
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
                <p className="lp-card-body">Point a connection at an MCP server, see its tools and tick the ones your agent may call.</p>
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
                <p className="lp-card-body">Hierarchical, horizontal or freeform, with notes and sections to sketch around the agent.</p>
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

        <section className="lp-cta" aria-labelledby="cta-title">
          <h2 className="lp-display lp-display-small" id="cta-title">
            Draw your first agent
          </h2>
          <p className="lp-lede">Free and open source. Your project stays a plain Eve app you can take anywhere.</p>
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
          <a href="#demo">Demo</a>
          <a href="#how">How it works</a>
          <a href="#features">Features</a>
        </nav>
        <nav className="lp-footer-links" aria-label="Resources">
          <p className="lp-label">Resources</p>
          <a href="https://eve.dev/docs" target="_blank" rel="noreferrer">
            Eve docs
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
