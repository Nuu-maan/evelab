import ts from "typescript";
import type { ModelConfig } from "./types.js";

/**
 * Reads and surgically edits the agent config object inside `agent.ts`.
 *
 * EveLab never rewrites an imported `agent.ts` from a template: doing so would
 * discard imports, comments, helpers and any Eve option EveLab has no GUI for.
 * Instead it locates the config object literal and replaces only the value
 * ranges it owns, which keeps GUI edits and hand-written code compatible.
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
  /** Range of the config object literal, braces included. */
  objectStart: number;
  objectEnd: number;
  /** End offset of the last property, used as the insertion point for new ones. */
  lastPropertyEnd?: number;
  /** Indentation of the existing properties, reused for new ones. */
  indent: string;
}

function createSourceFile(source: string): ts.SourceFile {
  return ts.createSourceFile("agent.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

/**
 * The config object is the first object literal passed to a call or `new`
 * expression that is exported, e.g. `export default new Agent({ ... })`.
 */
function findConfigObject(file: ts.SourceFile): ts.ObjectLiteralExpression | undefined {
  let found: ts.ObjectLiteralExpression | undefined;

  const fromExpression = (expression: ts.Expression): ts.ObjectLiteralExpression | undefined => {
    let current: ts.Expression = expression;
    while (ts.isAsExpression(current) || ts.isParenthesizedExpression(current)) {
      current = current.expression;
    }
    if (!ts.isCallExpression(current) && !ts.isNewExpression(current)) return undefined;
    const first = current.arguments?.[0];
    return first && ts.isObjectLiteralExpression(first) ? first : undefined;
  };

  const visit = (node: ts.Node): void => {
    if (found) return;
    if (ts.isExportAssignment(node)) {
      found = fromExpression(node.expression);
    } else if (ts.isVariableStatement(node)) {
      const isExported = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      if (isExported) {
        for (const declaration of node.declarationList.declarations) {
          if (found) break;
          if (declaration.initializer) found = fromExpression(declaration.initializer);
        }
      }
    }
    if (!found) ts.forEachChild(node, visit);
  };

  ts.forEachChild(file, visit);
  return found;
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
        ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)
          ? property.name.text
          : undefined;
      start = property.initializer.getStart(file);
      end = property.initializer.getEnd();
    } else if (ts.isShorthandPropertyAssignment(property)) {
      // `{ gateway }` is a value reference: the identifier is both name and text.
      name = property.name.text;
      start = property.name.getStart(file);
      end = property.name.getEnd();
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

/** Reads a string literal value, or undefined when the expression is dynamic. */
export function readStringValue(text: string): string | undefined {
  const file = createSourceFile(`const value = ${text}`);
  const statement = file.statements[0];
  if (!statement || !ts.isVariableStatement(statement)) return undefined;
  const initializer = statement.declarationList.declarations[0]?.initializer;
  if (!initializer) return undefined;
  if (ts.isStringLiteral(initializer) || ts.isNoSubstitutionTemplateLiteral(initializer)) {
    return initializer.text;
  }
  return undefined;
}

/**
 * Reads `model`, which Eve projects write either as a bare model id string or
 * as an options object. Unrecognised keys survive in `raw`.
 */
export function readModelValue(text: string): ModelConfig | undefined {
  const asString = readStringValue(text);
  if (asString !== undefined) return { id: asString, raw: {} };

  const file = createSourceFile(`const value = ${text}`);
  const statement = file.statements[0];
  if (!statement || !ts.isVariableStatement(statement)) return undefined;
  const initializer = statement.declarationList.declarations[0]?.initializer;
  if (!initializer || !ts.isObjectLiteralExpression(initializer)) return undefined;

  const source = `const value = ${text}`;
  const model: ModelConfig = { id: "", raw: {} };
  for (const property of initializer.properties) {
    let key: string;
    let valueText: string;
    if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name)) {
      key = property.name.text;
      valueText = source.slice(property.initializer.getStart(file), property.initializer.getEnd());
    } else if (ts.isShorthandPropertyAssignment(property)) {
      key = property.name.text;
      valueText = key;
    } else {
      continue;
    }
    if (key === "id" || key === "model") {
      model.id = readStringValue(valueText) ?? valueText;
    } else if (key === "temperature" || key === "maxOutputTokens") {
      const numeric = Number(valueText);
      if (Number.isFinite(numeric)) {
        model[key] = numeric;
        continue;
      }
      model.raw[key] = valueText;
    } else {
      model.raw[key] = valueText;
    }
  }
  return model.id ? model : undefined;
}

export function renderModelValue(model: ModelConfig): string {
  const extra = Object.entries(model.raw);
  const hasOptions =
    model.temperature !== undefined || model.maxOutputTokens !== undefined || extra.length > 0;
  if (!hasOptions) return JSON.stringify(model.id);

  const lines = [`id: ${JSON.stringify(model.id)}`];
  if (model.temperature !== undefined) lines.push(`temperature: ${model.temperature}`);
  if (model.maxOutputTokens !== undefined) lines.push(`maxOutputTokens: ${model.maxOutputTokens}`);
  // `{ gateway }` stays shorthand rather than becoming `gateway: gateway`.
  for (const [key, value] of extra) lines.push(key === value ? key : `${key}: ${value}`);
  return `{\n    ${lines.join(",\n    ")},\n  }`;
}

/**
 * Replaces the given properties in the config object, leaving every byte
 * outside those value ranges untouched. Properties set to `undefined` are left
 * alone; removal is deliberately not supported through this path.
 */
export function patchAgentSource(source: string, patch: Record<string, string>): string {
  const config = readAgentSource(source);
  if (!config) {
    throw new Error("agent.ts does not contain a recognisable agent config object");
  }

  const edits: Array<{ start: number; end: number; text: string }> = [];
  const additions: string[] = [];

  for (const [name, text] of Object.entries(patch)) {
    const existing = config.properties.get(name);
    if (existing) {
      edits.push({ start: existing.start, end: existing.end, text });
    } else {
      additions.push(`${name}: ${text}`);
    }
  }

  let output = source;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    output = output.slice(0, edit.start) + edit.text + output.slice(edit.end);
  }

  if (additions.length > 0) {
    // Recompute the object range: earlier value edits may have shifted it.
    const updated = readAgentSource(output);
    if (!updated) throw new Error("agent.ts became unparseable while applying edits");
    const { indent } = updated;

    if (updated.lastPropertyEnd === undefined) {
      const closing = updated.objectEnd - 1;
      const inserted = `\n${indent}${additions.join(`,\n${indent}`)},\n`;
      output = output.slice(0, closing) + inserted + output.slice(closing);
    } else {
      // Insert after the last property, reusing its trailing comma if present.
      const comma = output.indexOf(",", updated.lastPropertyEnd);
      const hasComma =
        comma !== -1 && output.slice(updated.lastPropertyEnd, comma).trim().length === 0;
      const at = hasComma ? comma + 1 : updated.lastPropertyEnd;
      const inserted = `${hasComma ? "" : ","}\n${indent}${additions.join(`,\n${indent}`)},`;
      output = output.slice(0, at) + inserted + output.slice(at);
    }
  }

  return output;
}
