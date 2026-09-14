import type { Metadata } from "next";
import Link from "next/link";
import { IconArrowUpRight, IconLogoGithub } from "@/components/icons";
import { Icon } from "@/components/icon";
import { Mark } from "@/components/mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { EVE_TEMPLATES } from "@/lib/eve-templates";
import { OPEN_GRAPH } from "@/lib/site";
import "@/app/landing.css";
import "@/app/templates.css";

const TITLE = "Eve agent templates";
const DESCRIPTION = "Real Eve agents from eve.dev. Import one into EveLab to see its graph and code.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/templates" },
  openGraph: { ...OPEN_GRAPH, url: "/templates", title: TITLE, description: DESCRIPTION },
};

/** A public list of the eve.dev templates, each one import away from a canvas. */
export default function TemplatesPage() {
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
          <Link href="/#demo">Tour</Link>
          <Link href="/#features">Features</Link>
          <Link href="/templates" aria-current="page">
            Templates
          </Link>
          <a href="https://eve.dev/docs" target="_blank" rel="noreferrer">
            Docs
          </a>
        </nav>
        <div className="lp-header-actions">
          <ThemeToggle />
          <Button asChild size="sm">
            <Link href="/projects">Open app</Link>
          </Button>
        </div>
      </header>

      <main id="main">
        <section className="lp-section tpl-section" aria-labelledby="templates-title">
          <div className="lp-section-head">
            <p className="lp-eyebrow">Templates</p>
            <h1 className="lp-heading" id="templates-title">
              Start from a real Eve agent
            </h1>
          </div>
          <p className="lp-section-lede">Import one to see its graph and code. Or open it on eve.dev.</p>

          <ul className="tpl-grid">
            {EVE_TEMPLATES.map((template) => (
              <li key={template.slug} className="tpl-card">
                <h2 className="lp-card-title">{template.name}</h2>
                <p className="lp-card-body">{template.summary}</p>
                <div className="tpl-actions">
                  {template.repository && (
                    <Button asChild size="sm" className="rounded-full">
                      <Link href={`/projects/import?repo=${template.repository}`}>Import</Link>
                    </Button>
                  )}
                  {(template.repository || template.source) && (
                    <Button asChild size="sm" variant="outline" className="rounded-full">
                      <a href={template.source ?? `https://github.com/${template.repository}`} target="_blank" rel="noreferrer">
                        <Icon icon={IconLogoGithub} size={14} />
                        Source
                      </a>
                    </Button>
                  )}
                  <Button asChild size="sm" variant="ghost" className="rounded-full">
                    <a href={`https://eve.dev/templates/${template.slug}`} target="_blank" rel="noreferrer">
                      eve.dev
                      <Icon icon={IconArrowUpRight} size={14} />
                    </a>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
