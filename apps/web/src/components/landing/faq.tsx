"use client";

import { useId, useState } from "react";
import { IconChevronDown } from "@/components/icons";
import { Icon } from "@/components/icon";

/**
 * The landing page's questions as an accordion: one answer open at a time,
 * sliding open and shut. Every answer stays in the page, only collapsed, so it
 * is still there for search engines and for find in page.
 */
export function Faq({ items }: { items: { question: string; answer: string }[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const id = useId();

  return (
    <div className="lp-faq-list">
      {items.map((item, index) => {
        const expanded = open === index;
        return (
          <div key={item.question} className="lp-faq-item" data-open={expanded || undefined}>
            <h3>
              <button
                type="button"
                id={`${id}-q${index}`}
                className="lp-faq-question"
                aria-expanded={expanded}
                aria-controls={`${id}-a${index}`}
                onClick={() => setOpen(expanded ? null : index)}
              >
                {item.question}
                <Icon icon={IconChevronDown} size={16} />
              </button>
            </h3>
            <div id={`${id}-a${index}`} role="region" aria-labelledby={`${id}-q${index}`} className="lp-faq-answer" inert={!expanded}>
              <div>
                <p>{item.answer}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
