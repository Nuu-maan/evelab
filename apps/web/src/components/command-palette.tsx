"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  IconAlignmentLeft,
  IconArrowUpRight,
  IconChartActivity,
  IconCloudUpload,
  IconFile,
  IconFileText,
  IconGitBranch,
  IconGridSquare,
  IconRoute,
  IconSettingsGear,
} from "@/components/icons";
import { Icon, type IconData } from "@/components/icon";
import { KINDS } from "@/components/kinds";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";

interface Entry {
  label: string;
  hint: string;
  href: string;
  icon: IconData;
}

const OPEN_EVENT = "evelab:command-palette";

/** Opens the palette from anywhere, such as the sidebar's Find button. */
export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

/**
 * ⌘K navigation. It opens and closes instantly: something summoned from the
 * keyboard many times a day should never make the user wait for an animation.
 */
export function CommandPalette({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const groups = useMemo<{ heading: string; entries: Entry[] }[]>(() => {
    const base = `/projects/${projectId}`;
    return [
      {
        heading: "Go to",
        entries: [
          { label: "Open canvas", hint: "Visual editor", href: `${base}/canvas`, icon: IconRoute },
          { label: "Open overview", hint: "Project", href: base, icon: IconGridSquare },
          { label: "Browse files", hint: "Files", href: `${base}/files`, icon: IconFileText },
          { label: "Source control", hint: "GitHub", href: `${base}/source`, icon: IconGitBranch },
          { label: "View runs", hint: "Observe", href: `${base}/runs`, icon: IconChartActivity },
          { label: "View deployments", hint: "Deploy", href: `${base}/deployments`, icon: IconCloudUpload },
          { label: "Project settings", hint: "Settings", href: `${base}/settings`, icon: IconSettingsGear },
          { label: "All projects", hint: "Switch", href: "/projects", icon: IconArrowUpRight },
        ],
      },
      {
        heading: "Build",
        entries: [
          {
            label: "Edit instructions",
            hint: "instructions.md",
            href: `${base}/agent/instructions`,
            icon: IconAlignmentLeft,
          },
          { label: "Configure model", hint: "agent.ts", href: `${base}/agent/model`, icon: KINDS.agent.icon },
          { label: "Add tool", hint: "tools/", href: `${base}/tools`, icon: KINDS.tool.icon },
          { label: "Import skill", hint: "skills/", href: `${base}/skills`, icon: KINDS.skill.icon },
          { label: "Create subagent", hint: "subagents/", href: `${base}/subagents`, icon: KINDS.subagent.icon },
          { label: "Open agent.ts", hint: "Files", href: `${base}/files?path=agent.ts`, icon: IconFile },
        ],
      },
    ];
  }, [projectId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Commands"
      description="Jump to a page or start a change"
      className="top-[14vh] sm:max-w-xl data-open:animate-none! data-closed:animate-none!"
    >
      <Command>
        <CommandInput placeholder="Search commands" aria-label="Search commands" />
        <CommandList className="max-h-[min(420px,60vh)]">
          <CommandEmpty>No matching command</CommandEmpty>
          {groups.map((group) => (
            <CommandGroup key={group.heading} heading={group.heading}>
              {group.entries.map((entry) => (
                <CommandItem
                  key={entry.href}
                  value={`${entry.label} ${entry.hint}`}
                  onSelect={() => go(entry.href)}
                  className="h-9"
                >
                  <Icon icon={entry.icon} />
                  <span>{entry.label}</span>
                  <CommandShortcut className="tracking-normal">{entry.hint}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
