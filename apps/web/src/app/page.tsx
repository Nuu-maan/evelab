import Link from "next/link";
import {
  IconArrowUpRight,
  IconCodeBracket,
  IconLogoGithub,
  IconRoute,
  IconSparkles,
} from "@/components/icons";
import { GraphPreview } from "@/components/graph-preview";
import { Icon, type IconData } from "@/components/icon";
import { KINDS } from "@/components/kinds";
import { SAMPLE_GRAPH } from "@/components/landing/sample-graph";
import { Mark } from "@/components/mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { signInAction } from "@/lib/actions";
import { getAccount, isAuthEnabled } from "@/lib/session";
import "@/app/landing.css";

export const dynamic = "force-dynamic";

const FEATURES: { icon: IconData; title: string; body: string }[] = [
  {
    icon: IconRoute,
    title: "The canvas is the architecture",
    body: "Your agent, its subagents, tools, skills, connections and channels, drawn as one graph. Drag a tool onto an agent to give it one. Wire a shared connection to three agents and it is still written once.",
  },
  {
    icon: IconCodeBracket,
    title: "Real code you own",
    body: "Every node is a file in a normal Eve project, the same one eve init creates. Edit it in the canvas or in the code editor, then download it as a zip or push it to GitHub.",
  },
  {
    icon: IconSparkles,
    title: "Set up in a minute",
    body: "Name the agent, pick a model and start building. Add an MCP server and pick its tools from a list, import a skill from GitHub, and let the assistant write instructions for you.",
  },
];

const STEPS = [
  { title: "Create a project", body: "Give it a name and a model. EveLab writes the project Eve would." },
  { title: "Build on the canvas", body: "Add subagents, tools, skills and connections, and wire them together." },
  { title: "Take the code", body: "Download a zip or push to GitHub, then run it anywhere with eve dev." },
];

const KIND_ORDER = ["subagent", "tool", "skill", "connection", "channel"] as const;

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

/**
 * The public front door. Everyone can read it; building needs an account once
 * sign-in is configured, and in local mode it opens straight into the app.
 */
export default async function LandingPage() {
  const authEnabled = isAuthEnabled();
  const account = authEnabled ? await getAccount() : undefined;
  const canOpen = !authEnabled || Boolean(account);

  const primary = canOpen ? (
    <Button asChild size="lg">
      <Link href="/projects">
        {account ? "Open your projects" : "Open EveLab"}
        <Icon icon={IconArrowUpRight} />
      </Link>
    </Button>
  ) : (
    <form action={signInAction}>
      <Button type="submit" size="lg">
        <Icon icon={IconLogoGithub} />
        Continue with GitHub
      </Button>
    </form>
  );

  return (
    <div className="landing">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="landing-bar">
        <Link className="topbar-brand" href="/">
          <Mark />
          EveLab
        </Link>
        <nav className="landing-nav" aria-label="Sections">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <a href="https://eve.dev/docs" target="_blank" rel="noreferrer">
            Eve docs
          </a>
        </nav>
        <div className="topbar-actions">
          <ThemeToggle />
          {canOpen ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/projects">{account ? "Projects" : "Open app"}</Link>
            </Button>
          ) : (
            <form action={signInAction}>
              <Button type="submit" variant="outline" size="sm">
                Sign in
              </Button>
            </form>
          )}
        </div>
      </header>

      <main id="main">
        <section className="landing-hero" aria-labelledby="hero-title">
          <p className="landing-kicker">Open source · Built for Eve</p>
          <h1 className="landing-title" id="hero-title">
            Design AI agents on a canvas.
            <br />
            Get the code.
          </h1>
          <p className="landing-lede">
            EveLab turns an agent into a graph you can see and change: subagents, tools, skills, connections and
            channels. Everything you draw is written as a real Eve project that you own and can run anywhere.
          </p>
          <div className="landing-actions">
            {primary}
            <Button asChild variant="ghost" size="lg">
              <a href="#how-it-works">See how it works</a>
            </Button>
          </div>
          {authEnabled && !account && (
            <p className="landing-note">Free to use. Sign in with GitHub and your projects stay private to you.</p>
          )}

          <figure className="landing-canvas" aria-label="An example agent on the EveLab canvas">
            <div className="landing-window-bar" aria-hidden="true">
              <span className="landing-window-dots">
                <i />
                <i />
                <i />
              </span>
              <span className="landing-window-title">support-desk · Canvas</span>
            </div>
            <div className="landing-canvas-board">
              <svg className="landing-dots" aria-hidden="true">
                <pattern id="landing-dots" width="20" height="20" patternUnits="userSpaceOnUse">
                  <circle cx="10" cy="10" r="1" fill="currentColor" />
                </pattern>
                <rect width="100%" height="100%" fill="url(#landing-dots)" />
              </svg>
              <GraphPreview graph={SAMPLE_GRAPH} positions={{}} className="landing-graph" />
            </div>
            <figcaption className="landing-legend">
              {KIND_ORDER.map((kind) => (
                <span key={kind} className="landing-legend-item" data-kind={kind}>
                  <Icon icon={KINDS[kind].icon} size={14} />
                  {KINDS[kind].plural}
                </span>
              ))}
            </figcaption>
          </figure>
        </section>

        <section className="landing-section" id="features" aria-labelledby="features-title">
          <h2 className="landing-section-title" id="features-title">
            Everything an agent is made of, in one place
          </h2>
          <div className="landing-features">
            {FEATURES.map((feature) => (
              <article key={feature.title} className="landing-feature">
                <span className="landing-feature-icon" aria-hidden="true">
                  <Icon icon={feature.icon} size={18} />
                </span>
                <h3 className="landing-feature-title">{feature.title}</h3>
                <p className="landing-feature-body">{feature.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section landing-split" aria-labelledby="code-title">
          <div className="landing-split-text">
            <h2 className="landing-section-title" id="code-title">
              Every node is a file
            </h2>
            <p className="landing-lede">
              Click the github connection on the canvas and you are looking at the file behind it. There is no
              hidden format: close EveLab and the project still runs with eve dev, commits to Git and deploys like
              any other Eve agent.
            </p>
            <ul className="landing-checks">
              <li>Download the whole project as a zip</li>
              <li>Push it to a new or existing GitHub repository</li>
              <li>Edit files directly, and the canvas follows</li>
            </ul>
          </div>
          <div className="landing-code" aria-label="The generated project">
            <ul className="landing-tree" aria-label="Project files">
              {TREE.map((entry) => (
                <li
                  key={entry.name + entry.depth}
                  style={{ paddingInlineStart: `${entry.depth * 16}px` }}
                  data-folder={entry.folder || undefined}
                  data-active={entry.active || undefined}
                >
                  {entry.name}
                </li>
              ))}
            </ul>
            <pre className="landing-snippet">
              <code>{`import { defineMcpClientConnection } from "eve/connections";

export default defineMcpClientConnection({
  url: "https://api.githubcopilot.com/mcp/",
  description: "Repositories, issues and pull requests.",
  tools: { allow: ["search_issues", "get_issue"] },
});`}</code>
            </pre>
          </div>
        </section>

        <section className="landing-section" id="how-it-works" aria-labelledby="steps-title">
          <h2 className="landing-section-title" id="steps-title">
            From idea to code in three steps
          </h2>
          <ol className="landing-steps">
            {STEPS.map((step, index) => (
              <li key={step.title} className="landing-step">
                <span className="landing-step-number">{index + 1}</span>
                <h3 className="landing-feature-title">{step.title}</h3>
                <p className="landing-feature-body">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="landing-cta" aria-labelledby="cta-title">
          <h2 className="landing-section-title" id="cta-title">
            Draw your first agent
          </h2>
          <p className="landing-lede">It takes a minute, and the code is yours from the first node.</p>
          <div className="landing-actions">
            {primary}
            <Button asChild variant="outline" size="lg">
              <a href="https://eve.dev/docs" target="_blank" rel="noreferrer">
                Read the Eve docs
                <Icon icon={IconArrowUpRight} />
              </a>
            </Button>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <span className="topbar-brand">
          <Mark />
          EveLab
        </span>
        <span>The open-source visual IDE for Eve agents.</span>
        <a href="https://github.com/anishfn/evelab" target="_blank" rel="noreferrer">
          <Icon icon={IconLogoGithub} size={14} />
          GitHub
        </a>
      </footer>
    </div>
  );
}
