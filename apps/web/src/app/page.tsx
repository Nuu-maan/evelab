import Image from "next/image";
import Link from "next/link";
import { IconArrowUpRight, IconChevronRight, IconLogoGithub } from "@/components/icons";
import { Icon } from "@/components/icon";
import { KINDS } from "@/components/kinds";
import { Mark } from "@/components/mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { signInAction } from "@/lib/actions";
import { getAccount, isAuthEnabled } from "@/lib/session";
import "@/app/landing.css";

export const dynamic = "force-dynamic";

const FEATURES = [
  { kind: "subagent", title: "Drag pieces onto agents", body: "Drop a subagent, tool, skill or connection on an agent and EveLab writes its file." },
  { kind: "tool", title: "Share what agents need", body: "One tool, skill or connection can serve every agent that uses it." },
  { kind: "connection", title: "Discover MCP tools", body: "Point a connection at an MCP server and pick the tools your agent may call." },
  { kind: "channel", title: "Lay it out your way", body: "Hierarchical, horizontal or freeform, with notes and sections to sketch around it." },
] as const;

/** A real screenshot of EveLab, swapped for its dark twin when the page is dark. */
function Shot({ name, alt, priority }: { name: string; alt: string; priority?: boolean }) {
  const sizes = "(max-width: 1448px) calc(100vw - 48px), 1400px";
  return (
    <div className="lp-shot">
      <Image className="lp-shot-light" src={`/landing/${name}-light.webp`} width={2880} height={1800} alt={alt} sizes={sizes} priority={priority} />
      <Image className="lp-shot-dark" src={`/landing/${name}-dark.webp`} width={2880} height={1800} alt="" aria-hidden="true" sizes={sizes} />
    </div>
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
          <Button asChild variant="outline" size="sm" className="lp-header-link max-[760px]:hidden">
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
          <h1 className="lp-display" id="hero-title">
            Visual agents,
            <br />
            real code
          </h1>
          <p className="lp-lede">
            EveLab is a visual IDE for Eve agents. Design an agent on a canvas and EveLab writes the project file for file, so
            it runs with eve dev and ships like any Eve agent.
          </p>
          <div className="lp-actions">
            {start("Start building")}
            <Button asChild variant="outline" size="lg" className="h-11 rounded-full px-6 text-[15px]">
              <a href="#canvas">See how it works</a>
            </Button>
          </div>
        </section>

        <section className="lp-section" id="canvas" aria-labelledby="canvas-title">
          <div className="lp-section-head">
            <p className="lp-eyebrow">Canvas</p>
            <h2 className="lp-heading" id="canvas-title">
              Build agents the way you picture them
            </h2>
            <p className="lp-section-lede">
              Every card on the canvas is a file in your project and every wire is a real reference. Drag pieces onto an agent
              and EveLab writes the code.
            </p>
          </div>
          <Shot name="canvas" alt="The EveLab canvas showing an agent wired to its subagents, tools, skills, connections and channels" priority />
          <ul className="lp-grid">
            {FEATURES.map((feature) => (
              <li key={feature.title} className="lp-cell" data-kind={feature.kind}>
                <Icon icon={KINDS[feature.kind].icon} size={20} />
                <h3 className="lp-cell-title">{feature.title}</h3>
                <p className="lp-cell-body">{feature.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="lp-section" id="code" aria-labelledby="code-title">
          <div className="lp-feature">
            <div className="lp-section-head">
              <p className="lp-eyebrow">Code</p>
              <h2 className="lp-heading" id="code-title">
                Every node is a file
              </h2>
              <p className="lp-section-lede">
                Open any file in the editor. Change the code and the canvas follows. Close EveLab and the project still runs,
                commits to Git and deploys like any Eve agent.
              </p>
              <ul className="lp-list">
                <li>The same files eve init creates</li>
                <li>A code editor that updates the canvas</li>
                <li>Create, rename and delete files and folders</li>
              </ul>
            </div>
            <Shot name="code" alt="The EveLab file editor with a connection file open beside the project tree" />
          </div>
        </section>

        <section className="lp-section" id="setup" aria-labelledby="setup-title">
          <div className="lp-section-head">
            <p className="lp-eyebrow">Setup</p>
            <h2 className="lp-heading" id="setup-title">
              From zero to real code in a minute
            </h2>
          </div>
          <ol className="lp-cards">
            <li className="lp-card">
              <Shot name="create" alt="The new project wizard asking for the agent's name and description" />
              <span className="lp-step-number">01</span>
              <h3 className="lp-cell-title">Create a project</h3>
              <p className="lp-cell-body">Name the agent and pick a provider and model. EveLab asks what eve init asks and writes the same files.</p>
            </li>
            <li className="lp-card">
              <Shot name="export" alt="The Export menu with Download ZIP and Push to GitHub" />
              <span className="lp-step-number">02</span>
              <h3 className="lp-cell-title">Take the code</h3>
              <p className="lp-cell-body">Download a zip or push to a new or existing GitHub repository, then run it anywhere with eve dev.</p>
            </li>
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
          <a className="lp-credit" href="https://eve.dev" target="_blank" rel="noreferrer">
            Built for eve
          </a>
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
