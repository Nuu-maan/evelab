"use client";

import Link from "next/link";
import { IconGridSquare } from "@/components/icons";
import { Icon } from "@/components/icon";
import { Avatar } from "@/components/project-switcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/lib/actions";

/**
 * The signed-in account as one avatar button, as on vercel.com: the name and
 * signing out live in its menu, so the top bar stays a single tidy row at any
 * width.
 */
export function AccountMenu({ name, image }: { name: string; image?: string | null }) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button type="button" className="account-trigger" aria-label={`Account: ${name}`}>
          <Avatar name={name} image={image} size="large" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-56">
        <DropdownMenuLabel className="truncate font-medium text-foreground">{name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/projects">
            <Icon icon={IconGridSquare} />
            Projects
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={signOutAction}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
