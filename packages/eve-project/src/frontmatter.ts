/**
 * Minimal YAML frontmatter reader/writer.
 *
 * Deliberately supports only the flat `key: value` and `key: [a, b]` shapes that
 * Eve's markdown files use. Anything richer stays in the body rather than being
 * silently reinterpreted.
 */

export type Frontmatter = Record<string, string | string[]>;

const FENCE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function parseFrontmatter(input: string): {
  data: Frontmatter;
  body: string;
} {
  const match = FENCE.exec(input);
  if (!match) return { data: {}, body: input };

  const data: Frontmatter = {};
  for (const line of match[1]!.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
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

export function stringifyFrontmatter(data: Frontmatter, body: string): string {
  const entries = Object.entries(data).filter(
    ([, value]) => value !== undefined && (Array.isArray(value) ? true : value !== ""),
  );
  if (entries.length === 0) return body;

  const lines = entries.map(([key, value]) =>
    Array.isArray(value)
      ? `${key}: [${value.join(", ")}]`
      : `${key}: ${needsQuotes(value) ? JSON.stringify(value) : value}`,
  );
  return `---\n${lines.join("\n")}\n---\n${body}`;
}

function needsQuotes(value: string): boolean {
  return /^[\[\]{}#&*!|>%@`"']|:\s|^\s|\s$/.test(value) || value === "";
}
