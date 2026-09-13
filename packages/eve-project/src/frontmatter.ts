/**
 * Minimal YAML frontmatter reader and single-key editor.
 *
 * Deliberately supports only the flat `key: value` and `key: [a, b]` shapes that
 * Eve's markdown files use (`description`, `license`, schedule `cron`). Edits
 * rewrite one line and leave everything else, including keys this reader does
 * not understand, exactly as written.
 */

export type Frontmatter = Record<string, string | string[]>;

const FENCE = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n)?/;

export function parseFrontmatter(input: string): {
  data: Frontmatter;
  body: string;
} {
  const match = FENCE.exec(input);
  if (!match) return { data: {}, body: input };

  const data: Frontmatter = {};
  for (const line of match[1]!.split(/\r?\n/)) {
    // Indented lines belong to a nested value such as `metadata`; they are not top-level keys.
    if (!line.trim() || line.trimStart().startsWith("#") || /^\s/.test(line)) continue;
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    data[key] = parseValue(value);
  }
  return { data, body: input.slice(match[0].length) };
}

function parseValue(value: string): string | string[] {
  if (value.startsWith("[") && value.endsWith("]")) {
    return value
      .slice(1, -1)
      .split(",")
      .map((item) => unquote(item.trim()))
      .filter((item) => item.length > 0);
  }
  return unquote(value);
}

function unquote(value: string): string {
  if (value.length >= 2 && /^["'].*["']$/.test(value)) return value.slice(1, -1);
  return value;
}

function formatValue(value: string): string {
  return needsQuotes(value) ? JSON.stringify(value) : value;
}

function needsQuotes(value: string): boolean {
  return /^[\[\]{}#&*!|>%@`"']|:\s|^\s|\s$|[*#]/.test(value) || value === "";
}

export function stringifyFrontmatter(data: Frontmatter, body: string): string {
  const entries = Object.entries(data).filter(
    ([, value]) => value !== undefined && (Array.isArray(value) ? true : value !== ""),
  );
  if (entries.length === 0) return body;

  const lines = entries.map(([key, value]) =>
    Array.isArray(value) ? `${key}: [${value.join(", ")}]` : `${key}: ${formatValue(value)}`,
  );
  return `---\n${lines.join("\n")}\n---\n${body}`;
}

/**
 * Sets one top-level key, rewriting only its line. `undefined` removes the key,
 * and the fence with it when nothing is left.
 */
export function setFrontmatterValue(input: string, key: string, value: string | undefined): string {
  const match = FENCE.exec(input);
  const line = value === undefined ? undefined : `${key}: ${formatValue(value)}`;

  if (!match) {
    if (line === undefined) return input;
    return `---\n${line}\n---\n${input.startsWith("\n") ? "" : "\n"}${input}`;
  }

  const lines = match[1]!.split(/\r?\n/);
  const index = lines.findIndex((candidate) => new RegExp(`^${escapeRegExp(key)}\\s*:`).test(candidate));
  if (line === undefined) {
    if (index === -1) return input;
    lines.splice(index, 1);
  } else if (index === -1) {
    lines.push(line);
  } else {
    lines[index] = line;
  }

  const rest = input.slice(match[0].length);
  if (lines.every((candidate) => !candidate.trim())) return rest.replace(/^\r?\n/, "");
  return `---\n${lines.join("\n")}\n---${match[2] ?? ""}${rest}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
