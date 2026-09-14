import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { isAuthEnabled } from "@/lib/session";

/**
 * Lists an MCP server's tools before a connection's allow list is written.
 *
 * Everything a server returns is untrusted: names must look like tool names,
 * descriptions are cut short, and the UI shows both as plain text. EveLab only
 * lists tools here; it never calls one.
 */

export interface DiscoveredTool {
  name: string;
  description?: string;
}

/** A discovery failure with a message that is safe to show. */
export class McpDiscoveryError extends Error {}

const TIMEOUT_MS = 10_000;
const MAX_PAGES = 10;
const MAX_TOOLS = 500;
const TOOL_NAME = /^[A-Za-z0-9_.\-/]{1,128}$/;

function isPrivateAddress(address: string): boolean {
  const mapped = address.toLowerCase().replace(/^::ffff:/, "");
  if (isIP(mapped) === 4) {
    const [a = 0, b = 0] = mapped.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  return mapped === "::" || mapped === "::1" || /^f[cd]/.test(mapped) || mapped.startsWith("fe80");
}

async function checkUrl(value: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new McpDiscoveryError("Enter the server's full URL.");
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) {
    throw new McpDiscoveryError("Use an https URL.");
  }
  // A shared EveLab must not be usable to reach the network it runs on.
  if (isAuthEnabled()) {
    if (local) throw new McpDiscoveryError("That address is not reachable from EveLab.");
    const addresses = await lookup(url.hostname, { all: true }).catch(() => []);
    if (addresses.length === 0) throw new McpDiscoveryError("Could not find that server.");
    if (addresses.some((entry) => isPrivateAddress(entry.address))) {
      throw new McpDiscoveryError("That address is not reachable from EveLab.");
    }
  }
  return url;
}

/**
 * Every request times out, redirects are refused so a server cannot bounce
 * discovery elsewhere, and nothing is cached: Next's data cache would otherwise
 * try to store the stream and log an error when the client closes it.
 */
function guardedFetch(input: string | URL, init?: RequestInit): Promise<Response> {
  const signals = [AbortSignal.timeout(TIMEOUT_MS), ...(init?.signal ? [init.signal] : [])];
  return fetch(input, { ...init, cache: "no-store", redirect: "error", signal: AbortSignal.any(signals) });
}

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timed out")), TIMEOUT_MS * 2)),
  ]);
}

async function listWith(transport: Transport): Promise<DiscoveredTool[]> {
  const client = new Client({ name: "evelab", version: "1.0.0" });
  try {
    await client.connect(transport);
    const tools: DiscoveredTool[] = [];
    const seen = new Set<string>();
    let cursor: string | undefined;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const result = await client.listTools(cursor ? { cursor } : undefined);
      for (const tool of result.tools) {
        if (typeof tool.name !== "string" || !TOOL_NAME.test(tool.name) || seen.has(tool.name)) continue;
        seen.add(tool.name);
        const description = typeof tool.description === "string" ? tool.description.trim().slice(0, 300) : "";
        tools.push({ name: tool.name, description: description || undefined });
        if (tools.length >= MAX_TOOLS) return tools;
      }
      cursor = typeof result.nextCursor === "string" ? result.nextCursor : undefined;
      if (!cursor) break;
    }
    return tools;
  } finally {
    await client.close().catch(() => {});
  }
}

function explain(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  if (/\b(401|403)\b|unauthori[sz]ed|forbidden/i.test(text)) return "The server needs a token to list its tools.";
  if (/timed out|timeout|abort/i.test(text)) return "The server did not answer in time.";
  return "Could not list tools from that server.";
}

export async function discoverMcpTools(value: string, token?: string): Promise<DiscoveredTool[]> {
  const url = await checkUrl(value);
  const requestInit: RequestInit | undefined = token ? { headers: { Authorization: `Bearer ${token}` } } : undefined;
  try {
    // Streamable HTTP is the current transport; older servers only speak SSE.
    return await withTimeout(listWith(new StreamableHTTPClientTransport(url, { requestInit, fetch: guardedFetch })));
  } catch (streamable) {
    try {
      return await withTimeout(listWith(new SSEClientTransport(url, { requestInit, fetch: guardedFetch })));
    } catch {
      throw new McpDiscoveryError(explain(streamable));
    }
  }
}
