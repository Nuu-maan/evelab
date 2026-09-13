import {
  IconAcronymJs,
  IconAcronymTs,
  IconAlignmentLeft,
  IconBookOpen,
  IconCodeBracket,
  IconFile,
  IconFolderClosed,
  IconFolderOpen,
  IconGitBranch,
  IconHash,
  IconImage,
  IconKey,
  IconLockClosed,
  IconSettingsSliders,
  IconTerminal,
} from "@/components/icons";
import { Icon, type IconData } from "@/components/icon";

type Tone = "blue" | "amber" | "purple" | "teal";

const IMAGE = new Set(["png", "jpg", "jpeg", "gif", "svg", "webp", "avif", "ico"]);

function iconFor(name: string): { icon: IconData; tone?: Tone } {
  const lower = name.toLowerCase();
  const extension = lower.includes(".") ? lower.slice(lower.lastIndexOf(".") + 1) : "";

  if (lower.endsWith(".lock") || lower.includes("-lock.") || lower.endsWith(".lockb")) {
    return { icon: IconLockClosed };
  }
  if (lower.startsWith(".env")) return { icon: IconKey, tone: "amber" };
  if (lower.startsWith(".git")) return { icon: IconGitBranch };
  if (lower.startsWith("readme")) return { icon: IconBookOpen };

  switch (extension) {
    case "ts":
    case "tsx":
    case "mts":
    case "cts":
      return { icon: IconAcronymTs, tone: "blue" };
    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
      return { icon: IconAcronymJs, tone: "amber" };
    case "json":
    case "jsonc":
      return { icon: IconCodeBracket, tone: "amber" };
    case "md":
    case "mdx":
    case "txt":
      return { icon: IconAlignmentLeft };
    case "yaml":
    case "yml":
    case "toml":
      return { icon: IconSettingsSliders, tone: "purple" };
    case "sh":
    case "bash":
    case "zsh":
    case "py":
      return { icon: IconTerminal, tone: "teal" };
    case "css":
    case "scss":
      return { icon: IconHash, tone: "blue" };
    default:
      return IMAGE.has(extension) ? { icon: IconImage, tone: "purple" } : { icon: IconFile };
  }
}

export function FileIcon({ name }: { name: string }) {
  const { icon, tone } = iconFor(name);
  return (
    <span className="file-icon" data-tone={tone} aria-hidden="true">
      <Icon icon={icon} />
    </span>
  );
}

/** The directories Eve gives meaning to wear the colour of what they contain. */
const FOLDER_KINDS: Record<string, string> = {
  tools: "tool",
  skills: "skill",
  subagents: "subagent",
};

export function FolderIcon({ path, open }: { path: string; open: boolean }) {
  return (
    <span className="file-icon" data-kind={FOLDER_KINDS[path]} aria-hidden="true">
      <Icon icon={open ? IconFolderOpen : IconFolderClosed} />
    </span>
  );
}
