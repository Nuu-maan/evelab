import {
  BookOpen,
  Braces,
  File,
  FileCog,
  FileText,
  Folder,
  FolderOpen,
  GitBranch,
  Hash,
  Image,
  KeyRound,
  Lock,
  SquareTerminal,
  type LucideIcon,
} from "lucide-react";

type Tone = "blue" | "amber" | "purple" | "teal";

/** A language badge for the formats that have no good pictogram, drawn like the other icons. */
function badge(label: string) {
  function Badge(props: { strokeWidth?: number }) {
    return (
      <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">
        <rect
          x="1.75"
          y="1.75"
          width="12.5"
          height="12.5"
          rx="2.5"
          stroke="currentColor"
          strokeWidth={props.strokeWidth ?? 1.5}
        />
        <text
          x="8"
          y="11.1"
          textAnchor="middle"
          fill="currentColor"
          fontSize="6.4"
          fontWeight="700"
          fontFamily="var(--font-geist-sans), sans-serif"
        >
          {label}
        </text>
      </svg>
    );
  }
  return Badge;
}

const TypeScript = badge("TS");
const JavaScript = badge("JS");

const IMAGE = new Set(["png", "jpg", "jpeg", "gif", "svg", "webp", "avif", "ico"]);

function iconFor(name: string): { icon: LucideIcon | ReturnType<typeof badge>; tone?: Tone } {
  const lower = name.toLowerCase();
  const extension = lower.includes(".") ? lower.slice(lower.lastIndexOf(".") + 1) : "";

  if (lower.endsWith(".lock") || lower.includes("-lock.") || lower.endsWith(".lockb")) {
    return { icon: Lock };
  }
  if (lower.startsWith(".env")) return { icon: KeyRound, tone: "amber" };
  if (lower.startsWith(".git")) return { icon: GitBranch };
  if (lower.startsWith("readme")) return { icon: BookOpen };

  switch (extension) {
    case "ts":
    case "tsx":
    case "mts":
    case "cts":
      return { icon: TypeScript, tone: "blue" };
    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
      return { icon: JavaScript, tone: "amber" };
    case "json":
    case "jsonc":
      return { icon: Braces, tone: "amber" };
    case "md":
    case "mdx":
    case "txt":
      return { icon: FileText };
    case "yaml":
    case "yml":
    case "toml":
      return { icon: FileCog, tone: "purple" };
    case "sh":
    case "bash":
    case "zsh":
    case "py":
      return { icon: SquareTerminal, tone: "teal" };
    case "css":
    case "scss":
      return { icon: Hash, tone: "blue" };
    default:
      return IMAGE.has(extension) ? { icon: Image, tone: "purple" } : { icon: File };
  }
}

export function FileIcon({ name }: { name: string }) {
  const { icon: Icon, tone } = iconFor(name);
  return (
    <span className="file-icon" data-tone={tone} aria-hidden="true">
      <Icon strokeWidth={1.5} />
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
  const Icon = open ? FolderOpen : Folder;
  return (
    <span className="file-icon" data-kind={FOLDER_KINDS[path]} aria-hidden="true">
      <Icon strokeWidth={1.5} />
    </span>
  );
}
