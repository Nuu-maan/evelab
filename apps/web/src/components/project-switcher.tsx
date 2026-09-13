"use client";

import Link from "next/link";
import { IconCheck, IconChevronUpDown, IconGridSquare, IconPlus } from "@/components/icons";
import { Icon } from "@/components/icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface SwitcherProject {
  id: string;
  name: string;
}

export function Avatar({ name, size }: { name: string; size?: "large" }) {
  return (
    <span className="avatar" data-size={size} aria-hidden="true">
      {name.trim().charAt(0) || "?"}
    </span>
  );
}

/** The project name at the top of the sidebar doubles as the way to switch. */
export function ProjectSwitcher({
  current,
  projects,
}: {
  current: SwitcherProject;
  projects: SwitcherProject[];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="switcher-trigger" type="button">
          <Avatar name={current.name} />
          <span className="switcher-name">{current.name}</span>
          <Icon icon={IconChevronUpDown} className="switcher-chevron" />
        </button>
      </DropdownMenuTrigger>

      {/* Radix labels the menu with its trigger; the menu's job is clearer than the project name. */}
      <DropdownMenuContent aria-label="Switch project" aria-labelledby={undefined} className="min-w-60">
        <DropdownMenuLabel>Projects</DropdownMenuLabel>
        <DropdownMenuGroup>
          {projects.map((project) => (
            <DropdownMenuItem key={project.id} asChild className="h-8">
              <Link href={`/projects/${project.id}`}>
                <Avatar name={project.name} />
                <span className="min-w-0 flex-1 truncate">{project.name}</span>
                {project.id === current.id && <Icon icon={IconCheck} />}
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="h-8">
          <Link href="/projects">
            <Icon icon={IconGridSquare} />
            All projects
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="h-8">
          <Link href="/projects/new">
            <Icon icon={IconPlus} />
            New project
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
