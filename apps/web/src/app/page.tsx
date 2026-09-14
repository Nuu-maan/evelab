import Link from "next/link";
import { IconArrowUpRight, IconChevronRight, IconLogoGithub } from "@/components/icons";
import { GraphPreview } from "@/components/graph-preview";
import { Icon } from "@/components/icon";
import { KINDS } from "@/components/kinds";
import { SAMPLE_GRAPH } from "@/components/landing/sample-graph";
import { Mark } from "@/components/mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { signInAction } from "@/lib/actions";
import { getAccount, isAuthEnabled } from "@/lib/session";
import "@/app/landing.css";

export const dynamic = "force-dynamic";

const KIND_ORDER = ["subagent", "tool", "skill", "connection", "channel"] as const;

const STEPS = [
  { title: "Create a project", body: "Name the agent and pick a model. EveLab writes the same project eve init would." },
  { title: "Build on the canvas", body: "Drag subagents, tools, skills and connections onto agents and wire them together." },
  { title: "Take the code", body: "Download a zip or push to GitHub, then run it anywhere with eve dev." },
];

const TREE = [
  { depth: 0, name: "support-desk/", folder: true },
  { depth: 1, name: "agent/", folder: true },
  { depth: 2, name: "agent.ts" },
  { depth: 2, name: "instructions.md" },
  { depth: 2, name: "channels/slack.ts" },
  { depth: 2, name: "subagents/billing/agent.ts" },
  { depth: 2, name: "lib/connections/github.ts", active: true },
  { depth: 1, name: "package.json" },
];

/** EveLab's two diamonds, drawn large for the hero. */
function HeroMark() {
  return (
    <svg className="lp-mark" viewBox="0 0 160 160" aria-hidden="true" focusable="false">
      <rect x="22" y="22" width="116" height="116" rx="10" transform="rotate(45 80 80)" fill="none" stroke="currentColor" strokeWidth="9" />
      <rect x="57" y="57" width="46" height="46" rx="4" transform="rotate(45 80 80)" fill="currentColor" />
    </svg>
  );
}

/**
 * The public front door, in the spirit of vercel.com: big type, lots of room,
 * and the product itself doing the explaining. Everyone can read it; building
 * needs an account once sign-in is configured, and in local mode it opens
 * straight into the app.
 */
export default async function LandingPage() {
  const authEnabled = isAuthEnabled();
  const account = authEnabled ? await getAccount() : undefined;
  const canOpen = !authEnabled || Boolean(account);

  const start = (label: string) =>
    canOpen ? (
      <Button asChild size="lg" className="h-11 rounded-full px-6 text-[15px]">
        <Link href="/projects">{account ? "Open your projects" : label}</Link>
      </Button>
    ) : (
      <form action={signInAction}>
        <Button type="submit" size="lg" className="h-11 rounded-full px-6 text-[15px]">
          {label}
        </Button>
      </form>
    );

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
          <a href="#canvas">Canvas</a>
          <a href="#code">Code</a>
          <a href="#setup">Setup</a>
          <a href="https://eve.dev/docs" target="_blank" rel="noreferrer">
            Docs
          </a>
        </nav>
        <div className="lp-header-actions">
          <ThemeToggle />
          <Button asChild variant="outline" size="sm" className="lp-header-link">
            <a href="https://github.com/anishfn/evelab" target="_blank" rel="noreferrer">
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
            <h1 className="lp-display" id="hero-title">
              Visual agents,
              <br />
              real code
            </h1>
            <div className="lp-actions">
              {start("Start building")}
              <Button asChild variant="outline" size="lg" className="h-11 rounded-full px-6 text-[15px]">
                <a href="#canvas">See the canvas</a>
              </Button>
            </div>
          </div>
          <div className="lp-hero-mark">
            <HeroMark />
          </div>
          <ul className="lp-hero-lines">
            <li>For Eve agents</li>
            <li>Drawn on a canvas</li>
            <li>Shipped as code you own</li>
          </ul>
        </section>

        <section className="lp-strip" aria-label="What an agent is made of">
          {KIND_ORDER.map((kind) => (
            <span key={kind} className="lp-strip-item" data-kind={kind}>
              <Icon icon={KINDS[kind].icon} size={22} />
              {KINDS[kind].plural}
            </span>
          ))}
        </section>

        <section className="lp-section" id="canvas" aria-labelledby="canvas-title">
          <h2 className="lp-heading" id="canvas-title">
            Build agents the way
            <br />
            you picture them
          </h2>
          <div className="lp-feature lp-feature-window-first">
            <figure className="lp-window lp-window-canvas" aria-label="An example agent on the EveLab canvas">
              <div className="lp-window-bar" aria-hidden="true">
                <span className="lp-window-dots">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="lp-window-title">support-desk · Canvas</span>
              </div>
              <div className="lp-board">
                <svg className="lp-board-dots" aria-hidden="true">
                  <pattern id="lp-dots" width="20" height="20" patternUnits="userSpaceOnUse">
                    <circle cx="10" cy="10" r="1" fill="currentColor" />
                  </pattern>
                  <rect width="100%" height="100%" fill="url(#lp-dots)" />
                </svg>
                <GraphPreview graph={SAMPLE_GRAPH} positions={{}} className="lp-graph" />
              </div>
            </figure>
            <div className="lp-feature-text">
              <p className="lp-statement">
                <strong>The canvas is the architecture.</strong> <span>Every card, port and wire is a real file in your project.</span>
              </p>
              <p className="lp-label">Features</p>
              <ul className="lp-list">
                <li>Drag pieces onto agents</li>
                <li>Shared tools, skills and connections</li>
                <li>Hierarchical, horizontal or freeform layouts</li>
                <li>Notes and sections to sketch around it</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="lp-section" id="code" aria-labelledby="code-title">
          <h2 className="lp-heading lp-heading-end" id="code-title">
            From canvas to code,
            <br />
            nothing hidden
          </h2>
          <div className="lp-feature">
            <div className="lp-feature-text">
              <p className="lp-statement">
                <strong>Every node is a file.</strong>{" "}
                <span>Close EveLab and the project still runs with eve dev, commits to Git and deploys like any Eve agent.</span>
              </p>
              <p className="lp-label">Features</p>
              <ul className="lp-list">
                <li>The same files eve init creates</li>
                <li>A code editor that updates the canvas</li>
                <li>Download the project as a zip</li>
                <li>Push to a new or existing GitHub repository</li>
              </ul>
            </div>
            <figure className="lp-window lp-code" aria-label="The generated project">
              <div className="lp-window-bar" aria-hidden="true">
                <span className="lp-window-dots">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="lp-window-title">lib/connections/github.ts</span>
              </div>
              <div className="lp-code-body">
                <ul className="lp-tree" aria-label="Project files">
                  {TREE.map((entry) => (
                    <li
                      key={entry.name + entry.depth}
                      style={{ paddingInlineStart: `${8 + entry.depth * 14}px` }}
                      data-folder={entry.folder || undefined}
                      data-active={entry.active || undefined}
                    >
                      {entry.name}
                    </li>
                  ))}
                </ul>
                <pre className="lp-snippet">
                  <code>{`import { defineMcpClientConnection } from "eve/connections";

export default defineMcpClientConnection({
  url: "https://api.githubcopilot.com/mcp/",
  description: "Repositories, issues and pull requests.",
  tools: { allow: ["search_issues", "get_issue"] },
});`}</code>
                </pre>
              </div>
            </figure>
          </div>
        </section>

        <section className="lp-section" id="setup" aria-labelledby="setup-title">
          <h2 className="lp-heading" id="setup-title">
            Set up in a minute
          </h2>
          <ol className="lp-steps">
            {STEPS.map((step, index) => (
              <li key={step.title} className="lp-step">
                <span className="lp-step-number">0{index + 1}</span>
                <h3 className="lp-step-title">{step.title}</h3>
                <p className="lp-step-body">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="lp-cta" aria-labelledby="cta-title">
          <h2 className="lp-display lp-display-small" id="cta-title">
            Draw your first agent
          </h2>
          <div className="lp-actions">
            {start("Get started")}
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
          <p>The open-source visual IDE for Eve agents.</p>
        </div>
        <nav className="lp-footer-links" aria-label="Product">
          <p className="lp-label">Product</p>
          <a href="#canvas">Canvas</a>
          <a href="#code">Code</a>
          <a href="#setup">Setup</a>
        </nav>
        <nav className="lp-footer-links" aria-label="Resources">
          <p className="lp-label">Resources</p>
          <a href="https://eve.dev/docs" target="_blank" rel="noreferrer">
            Eve docs
            <Icon icon={IconChevronRight} size={12} />
          </a>
          <a href="https://github.com/anishfn/evelab" target="_blank" rel="noreferrer">
            GitHub
            <Icon icon={IconChevronRight} size={12} />
          </a>
        </nav>
      </footer>
    </div>
  );
}
