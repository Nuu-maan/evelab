import ts from "typescript";

/**
 * Reads and surgically edits the definition object inside an Eve module:
 * `export default defineAgent({ ... })`, `defineTool({ ... })` and the rest.
 *
 * evelab never rewrites an existing module from a template: that would discard
 * imports, comments, helpers and any option evelab has no control for. It
 * locates the definition object literal and replaces only the value ranges it
 * owns, which keeps GUI edits and hand-written code compatible.
 */

export interface AgentSourceProperty {
  name: string;
  /** Verbatim source text of the value expression. */
  text: string;
  start: number;
  end: number;
}

export interface AgentSourceConfig {
  properties: Map<string, AgentSourceProperty>;
  /** Range of the definition object literal, braces included. */
  objectStart: number;
  objectEnd: number;
  /** End offset of the last property, used as the insertion point for new ones. */
  lastPropertyEnd?: number;
  /** Indentation of the existing properties, reused for new ones. */
  indent: string;
}

function createSourceFile(source: string): ts.SourceFile {
  return ts.createSourceFile("module.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function unwrap(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (
    ts.isAsExpression(current) ||
    ts.isParenthesizedExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isAwaitExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

/**
 * The module's exported definition expression. Follows `export default agent`
 * to the `const agent = defineAgent(...)` it names, and falls back to an
 * exported `const` for modules without a default export.
 */
function exportedExpression(file: ts.SourceFile): ts.Expression | undefined {
  const bindings = new Map<string, ts.Expression>();
  let exported: ts.Expression | undefined;
  let exportedConst: ts.Expression | undefined;

  for (const statement of file.statements) {
    if (ts.isVariableStatement(statement)) {
      const isExported = statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
      for (const declaration of statement.declarationList.declarations) {
        if (!declaration.initializer) continue;
        if (ts.isIdentifier(declaration.name)) bindings.set(declaration.name.text, declaration.initializer);
        if (isExported && !exportedConst) exportedConst = declaration.initializer;
      }
    } else if (ts.isExportAssignment(statement)) {
      exported = statement.expression;
    }
  }

  if (!exported) return exportedConst ? unwrap(exportedConst) : undefined;
  const inner = unwrap(exported);
  if (ts.isIdentifier(inner)) {
    const bound = bindings.get(inner.text);
    return bound ? unwrap(bound) : undefined;
  }
  return inner;
}

function findConfigObject(file: ts.SourceFile): ts.ObjectLiteralExpression | undefined {
  const expression = exportedExpression(file);
  if (!expression || (!ts.isCallExpression(expression) && !ts.isNewExpression(expression))) return undefined;
  const first = expression.arguments?.[0];
  return first && ts.isObjectLiteralExpression(first) ? first : undefined;
}

export function readAgentSource(source: string): AgentSourceConfig | undefined {
  const file = createSourceFile(source);
  const object = findConfigObject(file);
  if (!object) return undefined;

  const properties = new Map<string, AgentSourceProperty>();
  let lastPropertyEnd: number | undefined;
  let indent = "  ";

  for (const property of object.properties) {
    let name: string | undefined;
    let start: number;
    let end: number;

    if (ts.isPropertyAssignment(property)) {
      name =
        ts.isIdentifier(property.name) || ts.isStringLiteral(property.name) ? property.name.text : undefined;
      start = property.initializer.getStart(file);
      end = property.initializer.getEnd();
    } else if (ts.isShorthandPropertyAssignment(property)) {
      // `{ experimental }` is a value reference: the identifier is both name and text.
      name = property.name.text;
      start = property.name.getStart(file);
      end = property.name.getEnd();
    } else if (ts.isMethodDeclaration(property) && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) {
      // `async execute() {}` and `run() {}`: recorded so presence can be checked, never patched.
      name = property.name.text;
      start = property.getStart(file);
      end = property.getEnd();
    } else {
      continue;
    }
    if (!name) continue;

    properties.set(name, { name, text: source.slice(start, end), start, end });
    lastPropertyEnd = property.getEnd();
    indent = leadingWhitespace(source, property.getStart(file));
  }

  return {
    properties,
    objectStart: object.getStart(file),
    objectEnd: object.getEnd(),
    lastPropertyEnd,
    indent,
  };
}

function leadingWhitespace(source: string, offset: number): string {
  const lineStart = source.lastIndexOf("\n", offset - 1) + 1;
  return /^[ \t]*/.exec(source.slice(lineStart, offset))?.[0] ?? "  ";
}

function expressionOf(text: string): ts.Expression | undefined {
  const file = createSourceFile(`const value = ${text}`);
  const statement = file.statements[0];
  if (!statement || !ts.isVariableStatement(statement)) return undefined;
  const initializer = statement.declarationList.declarations[0]?.initializer;
  return initializer ? unwrap(initializer) : undefined;
}

function literalText(expression: ts.Expression): string | undefined {
  return ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression) ? expression.text : undefined;
}

/** Reads a string literal value, or undefined when the expression is computed. */
export function readStringValue(text: string): string | undefined {
  const expression = expressionOf(text);
  return expression ? literalText(expression) : undefined;
}

/** A top-level string literal property of the definition object, or undefined when absent or computed. */
export function readStringProperty(source: string, name: string): string | undefined {
  const text = readAgentSource(source)?.properties.get(name)?.text;
  return text === undefined ? undefined : readStringValue(text);
}

/**
 * The factory the exported definition calls, e.g. `defineAgent`, `defineTool`,
 * `slackChannel`, `defineMcpClientConnection`. Undefined for anything else.
 */
export function readDefinitionCallee(source: string): string | undefined {
  const expression = exportedExpression(createSourceFile(source));
  if (!expression || (!ts.isCallExpression(expression) && !ts.isNewExpression(expression))) return undefined;
  const target = expression.expression;
  if (ts.isIdentifier(target)) return target.text;
  if (ts.isPropertyAccessExpression(target)) return target.name.text;
  return undefined;
}

/** Module specifiers of every static import and re-export. */
export function readImports(source: string): string[] {
  const specifiers: string[] = [];
  for (const statement of createSourceFile(source).statements) {
    if ((ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) && statement.moduleSpecifier) {
      if (ts.isStringLiteral(statement.moduleSpecifier)) specifiers.push(statement.moduleSpecifier.text);
    }
  }
  return specifiers;
}

/** True when a module reaches other files by relative path, which a move would break. */
export function hasRelativeImports(source: string): boolean {
  return readImports(source).some((specifier) => specifier.startsWith(".")) || /import\(\s*["']\./.test(source);
}

/** The connector UID of `connect("uid")` or `connect({ connector: "uid" })`. */
export function readConnectorValue(text: string): string | undefined {
  const expression = expressionOf(text);
  if (!expression || !ts.isCallExpression(expression)) return undefined;
  const argument = expression.arguments[0];
  if (!argument) return undefined;
  const direct = literalText(argument);
  if (direct !== undefined) return direct;
  if (!ts.isObjectLiteralExpression(argument)) return undefined;
  for (const property of argument.properties) {
    if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name) && property.name.text === "connector") {
      return literalText(property.initializer);
    }
  }
  return undefined;
}

/** `{ allow: [...] }` or `{ block: [...] }` of string literals, as MCP `tools` and OpenAPI `operations` filters are written. */
export function readFilterValue(text: string): { mode: "allow" | "block"; names: string[] } | undefined {
  const expression = expressionOf(text);
  if (!expression || !ts.isObjectLiteralExpression(expression)) return undefined;
  for (const property of expression.properties) {
    if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name)) continue;
    const mode = property.name.text;
    if ((mode !== "allow" && mode !== "block") || !ts.isArrayLiteralExpression(property.initializer)) continue;
    const names = property.initializer.elements.map(literalText);
    if (names.some((name) => name === undefined)) return undefined;
    return { mode, names: names as string[] };
  }
  return undefined;
}

/**
 * Replaces the given properties in the definition object, leaving every byte
 * outside those value ranges untouched. Names in `remove` are deleted with
 * their whole line.
 */
export function patchAgentSource(
  source: string,
  patch: Record<string, string>,
  remove: readonly string[] = [],
): string {
  const withoutRemoved = remove.length > 0 ? removeProperties(source, remove) : source;
  return Object.keys(patch).length > 0 ? applyPatch(withoutRemoved, patch) : withoutRemoved;
}

function removeProperties(source: string, names: readonly string[]): string {
  const file = createSourceFile(source);
  const object = findConfigObject(file);
  if (!object) throw new Error("The module does not contain a recognisable definition object");

  const ranges: Array<{ start: number; end: number }> = [];
  for (const property of object.properties) {
    const name =
      (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) &&
      (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))
        ? property.name.text
        : undefined;
    if (!name || !names.includes(name)) continue;
    const start = source.lastIndexOf("\n", property.getStart(file) - 1) + 1;
    let end = property.getEnd();
    if (source[end] === ",") end += 1;
    if (source[end] === "\n") end += 1;
    ranges.push({ start, end });
  }

  let output = source;
  for (const range of ranges.sort((a, b) => b.start - a.start)) {
    output = output.slice(0, range.start) + output.slice(range.end);
  }
  return output;
}

function applyPatch(source: string, patch: Record<string, string>): string {
  const config = readAgentSource(source);
  if (!config) throw new Error("The module does not contain a recognisable definition object");

  const edits: Array<{ start: number; end: number; text: string }> = [];
  const additions: string[] = [];

  for (const [name, text] of Object.entries(patch)) {
    const existing = config.properties.get(name);
    if (existing) edits.push({ start: existing.start, end: existing.end, text });
    else additions.push(`${name}: ${text}`);
  }

  let output = source;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    output = output.slice(0, edit.start) + edit.text + output.slice(edit.end);
  }

  if (additions.length > 0) {
    // Recompute the object range: earlier value edits may have shifted it.
    const updated = readAgentSource(output);
    if (!updated) throw new Error("The module became unparseable while applying edits");
    const { indent } = updated;

    if (updated.lastPropertyEnd === undefined) {
      const closing = updated.objectEnd - 1;
      const inserted = `\n${indent}${additions.join(`,\n${indent}`)},\n`;
      output = output.slice(0, closing) + inserted + output.slice(closing);
    } else {
      // Insert after the last property, reusing its trailing comma if present.
      const comma = output.indexOf(",", updated.lastPropertyEnd);
      const hasComma = comma !== -1 && output.slice(updated.lastPropertyEnd, comma).trim().length === 0;
      const at = hasComma ? comma + 1 : updated.lastPropertyEnd;
      const inserted = `${hasComma ? "" : ","}\n${indent}${additions.join(`,\n${indent}`)},`;
      output = output.slice(0, at) + inserted + output.slice(at);
    }
  }

  return output;
}
