"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { IconArrowUpRight, IconChevronRight, IconLogoGithub } from "@/components/icons";
import { Icon } from "@/components/icon";
import { ThemeToggle } from "@/components/theme-toggle";

export interface LandingLink {
  label: string;
  href: string;
  external?: boolean;
}

/**
 * The public pages' menu on narrow screens. Two lines morph into a cross, and a
 * full-width panel drops in under the header with large links that stagger in,
 * then GitHub, the theme switch and the main action. Escape, a link, or the
 * button closes it, and the page behind stops scrolling while it is open.
 */
export function LandingMenu({ links, repository, children }: { links: LandingLink[]; repository: string; children?: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onResize = () => {
      if (window.matchMedia("(min-width: 761px)").matches) setOpen(false);
    };
    document.documentElement.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.documentElement.style.overflow = "";
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        className="lp-menu-button"
        aria-expanded={open}
        aria-controls="lp-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="lp-menu-lines" aria-hidden="true">
          <i />
          <i />
        </span>
      </button>

      <div id="lp-menu" className="lp-menu-panel" data-open={open || undefined} inert={!open}>
        <nav aria-label="Menu">
          <ul className="lp-menu-links">
            {links.map((link, index) => (
              <li key={link.href} style={{ ["--i" as string]: index }}>
                {link.external ? (
                  <a href={link.href} target="_blank" rel="noreferrer" onClick={close}>
                    {link.label}
                    <Icon icon={IconArrowUpRight} size={18} />
                  </a>
                ) : (
                  <Link href={link.href} onClick={close}>
                    {link.label}
                    <Icon icon={IconChevronRight} size={18} />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>
        <div className="lp-menu-footer" style={{ ["--i" as string]: links.length }}>
          <div className="lp-menu-row">
            <a className="lp-menu-github" href={repository} target="_blank" rel="noreferrer" onClick={close}>
              <Icon icon={IconLogoGithub} size={16} />
              Star on GitHub
            </a>
            <ThemeToggle />
          </div>
          {children && <div className="lp-menu-actions">{children}</div>}
        </div>
      </div>
    </>
  );
}
