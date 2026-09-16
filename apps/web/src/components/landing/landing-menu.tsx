"use client";

import Link from "next/link";
import { IconMenu } from "@/components/icons";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export interface LandingLink {
  label: string;
  href: string;
  external?: boolean;
}

/** The header's section links for narrow screens, where the inline nav has no room. */
export function LandingMenu({ links, repository }: { links: LandingLink[]; repository: string }) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="lp-menu" aria-label="Open menu">
          <Icon icon={IconMenu} size={18} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-56">
        {links.map((link) => (
          <DropdownMenuItem key={link.href} asChild className="h-10 text-[15px]">
            {link.external ? (
              <a href={link.href} target="_blank" rel="noreferrer">
                {link.label}
              </a>
            ) : (
              <Link href={link.href}>{link.label}</Link>
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="h-10 text-[15px]">
          <a href={repository} target="_blank" rel="noreferrer">
            GitHub
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
