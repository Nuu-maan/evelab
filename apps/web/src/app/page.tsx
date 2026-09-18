import type { Metadata } from "next";
import Link from "next/link";
import {
  IconArrowDown,
  IconArrowUpRight,
  IconCheck,
  IconChevronRight,
  IconGlobe,
  IconLogoGithub,
  IconPointer,
} from "@/components/icons";
import { BrandLogo } from "@/components/brand-logo";
import { Icon } from "@/components/icon";
import { KINDS } from "@/components/kinds";
import { Faq } from "@/components/landing/faq";
import { HeroScene } from "@/components/landing/hero-scene";
import { InView } from "@/components/landing/in-view";
import { LandingMenu } from "@/components/landing/landing-menu";
import { LandingTour } from "@/components/landing/landing-tour";
import { Mark } from "@/components/mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { signInAction } from "@/lib/actions";
import { BRANDS, type BrandId } from "@/lib/brands";
import { getAccount, isAuthEnabled } from "@/lib/session";
import { OPEN_GRAPH, REPOSITORY_URL, SITE_DESCRIPTION, SITE_NAME, siteUrl } from "@/lib/site";
import "@/app/landing.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: { ...OPEN_GRAPH, url: "/" },
};

const REPO = REPOSITORY_URL;

/** Only facts the page itself states: what evelab is, that it is free, and where the code lives. */
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
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        mainEntity: FAQ.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      },
    ],
  };
}

const KIND_ORDER = ["subagent", "tool", "skill", "connection", "channel"] as const;

const WORKS_WITH: BrandId[] = ["slack", "discord", "teams", "github", "linear", "notion", "stripe", "vercel"];

const INTEGRATIONS: BrandId[] = ["slack", "discord", "teams", "telegram", "twilio", "github", "linear", "notion"];

/** Plain questions a first visitor asks, answered in a sentence or two. The same text feeds the FAQ structured data. */
const FAQ = [
  {
    question: "What is Eve?",
    answer:
      "Eve is a framework for building AI agents in TypeScript. An Eve agent is a folder of plain files: instructions, tools, skills, connections and channels.",
  },
  {
    question: "Do I need evelab to run my agent?",
    answer:
      "No. evelab writes a normal Eve project. Run it with eve dev, deploy it like any other Eve agent, and keep editing it in any code editor.",
  },
  {
    question: "Can I open an agent I already have?",
    answer: "Yes. Import any Eve repository from GitHub and evelab draws the canvas from its files.",
  },
  {
    question: "Is evelab free?",
    answer: "Yes. evelab is free to use and open source. The code is on GitHub.",
  },
];

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
        <Link className="lp-brand" href="/" aria-label="evelab home">
          <Mark />
          evelab
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
          <span className="lp-header-theme">
            <ThemeToggle />
          </span>
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
              <form action={signInAction} className="lp-header-login">
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
          <LandingMenu
            repository={REPO}
            links={[
              { label: "Tour", href: "#demo" },
              { label: "Features", href: "#features" },
              { label: "Integrations", href: "#integrations" },
              { label: "Questions", href: "#faq" },
              { label: "Templates", href: "/templates" },
              { label: "Docs", href: "https://eve.dev/docs", external: true },
            ]}
          >
            {canOpen ? (
              <Button asChild size="lg" className="h-11 rounded-full text-[15px]">
                <Link href={account ? "/projects" : "/projects/new"}>{account ? "Open your projects" : "Start building"}</Link>
              </Button>
            ) : (
              <form action={signInAction}>
                <Button type="submit" size="lg" className="h-11 rounded-full text-[15px]">
                  Log in with GitHub
                </Button>
              </form>
            )}
          </LandingMenu>
        </div>
      </header>

      <main id="main">
        <section className="lp-hero" aria-labelledby="hero-title">
          <div className="lp-hero-copy">
            <a className="lp-kicker" href={REPO} target="_blank" rel="noreferrer">
              <i aria-hidden="true" />
              Free and open source
              <Icon icon={IconChevronRight} size={12} />
            </a>
            <h1 className="lp-display" id="hero-title">
              Draw your agent.
              <br />
              Get real code.
            </h1>
            <p className="lp-hero-lede">
              evelab is the visual IDE for AI agents. Design your agent on a canvas, plug in tools and channels, and ship
              real TypeScript you own.
            </p>
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

          <HeroScene />
        </section>

        <section className="lp-logos" aria-labelledby="logos-title">
          <p className="lp-logos-title" id="logos-title">
            Connect your agent to the apps your team already uses
          </p>
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
          <InView className="lp-section-split">
            <h2 className="lp-heading" id="demo-title">
              See it in action
            </h2>
            <p className="lp-section-lede">Build an agent, read the code it writes, then take it with you. It all happens in one place.</p>
          </InView>
          <InView className="lp-demo" delay={0.08}>
            <LandingTour />
          </InView>
        </section>

        <section className="lp-section" id="how" aria-labelledby="how-title">
          <InView className="lp-section-split">
            <h2 className="lp-heading" id="how-title">
              From idea to a working
              <br />
              agent in three steps
            </h2>
            <p className="lp-section-lede">No setup to learn. If you can sketch it, you can build it.</p>
          </InView>
          <InView delay={0.08}>
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
                <p className="lp-card-body">Name a new agent and pick a model, or import one from GitHub.</p>
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
                <h3 className="lp-card-title">Add what it needs</h3>
                <p className="lp-card-body">Drag tools, skills and channels onto your agent. Each one becomes a file.</p>
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
                <h3 className="lp-card-title">Run it anywhere</h3>
                <p className="lp-card-body">Download a zip or push to GitHub, then start it with eve dev.</p>
              </div>
            </li>
          </ol>
          </InView>
        </section>

        <section className="lp-section" id="features" aria-labelledby="features-title">
          <InView className="lp-section-split">
            <h2 className="lp-heading" id="features-title">
              Build agents the way
              <br />
              you picture them
            </h2>
            <p className="lp-section-lede">The canvas and the code stay in sync. Change one and the other follows.</p>
          </InView>

          <InView delay={0.08}>
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
                <h3 className="lp-card-title">Drag and drop</h3>
                <p className="lp-card-body">Drop a piece on an agent and evelab writes its file.</p>
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
                <h3 className="lp-card-title">Share pieces</h3>
                <p className="lp-card-body">Write a tool or skill once and give it to as many agents as you like.</p>
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
                <h3 className="lp-card-title">Plug in MCP servers</h3>
                <p className="lp-card-body">Paste a server URL, see its tools, and choose which ones your agent can use.</p>
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
                <p className="lp-card-body">Arrange the canvas as a tree, a row or freely, and leave notes for your team.</p>
              </div>
            </li>
          </ul>
          </InView>
        </section>

        <section className="lp-section" id="integrations" aria-labelledby="integrations-title">
          <InView className="lp-section-split">
            <h2 className="lp-heading" id="integrations-title">
              Meet people where
              <br />
              they already talk
            </h2>
            <p className="lp-section-lede">Put your agent in Slack, Discord, Teams and more. Every integration is wired up and ready to run.</p>
          </InView>

          <InView delay={0.08}>
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
          </InView>
          <a className="lp-more" href="https://eve.dev/integrations" target="_blank" rel="noreferrer">
            See every integration on eve.dev
            <Icon icon={IconArrowUpRight} size={14} />
          </a>
        </section>

        <section className="lp-section" id="faq" aria-labelledby="faq-title">
          <InView className="lp-faq">
            <h2 className="lp-heading" id="faq-title">
              Questions
            </h2>
            <Faq items={FAQ} />
          </InView>
        </section>

        <section className="lp-cta" aria-labelledby="cta-title">
          <h2 className="lp-display lp-display-small" id="cta-title">
            Build your first agent
          </h2>
          <p className="lp-lede">It is free, it is open source, and the code is yours to keep.</p>
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
            evelab
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
          <a href="#faq">Questions</a>
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
