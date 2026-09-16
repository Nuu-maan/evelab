"use client";

import { useState } from "react";
import { ConnectionForm, type ConnectionPreset } from "@/components/connection-form";
import { IntegrationCard, IntegrationDialog } from "@/components/integration-card";
import { KINDS } from "@/components/kinds";
import { Input } from "@/components/ui/input";
import { BRANDS, type BrandId } from "@/lib/brands";

interface Entry {
  key: string;
  name: string;
  description: string;
  tag: string;
  brand?: BrandId;
  preset: ConnectionPreset;
  /** A named service, so a connection of the same name means it is already added. */
  service?: boolean;
}

/**
 * Hosted MCP servers from eve.dev/integrations, each with the URL and the
 * `connect("<service>")` auth its `eve add connection/<service>` writes.
 */
const service = (id: BrandId, url: string, description: string = BRANDS[id].description): Entry => ({
  key: id,
  name: BRANDS[id].name,
  description,
  tag: "MCP",
  brand: id,
  service: true,
  preset: { name: id, kind: "mcp", url, auth: "connect", connector: id, description },
});

const ENTRIES: Entry[] = [
  // eve.dev files Linear twice; its logo and name come from the channel, so the MCP server keeps its own line.
  service("linear", "https://mcp.linear.app/mcp", "Issues, projects, cycles, and comments via Linear's MCP server."),
  service("notion", "https://mcp.notion.com/mcp"),
  service("vercel", "https://mcp.vercel.com"),
  service("sentry", "https://mcp.sentry.dev/mcp"),
  service("stripe", "https://mcp.stripe.com"),
  service("supabase", "https://mcp.supabase.com/mcp"),
  service("neon", "https://mcp.neon.tech/mcp"),
  service("posthog", "https://mcp.posthog.com/mcp"),
  service("airtable", "https://mcp.airtable.com/mcp"),
  service("datadog", "https://mcp.datadoghq.com/api/mcp"),
  {
    key: "custom-mcp",
    name: "MCP server",
    description: "Any hosted MCP server by URL. evelab can list its tools so you pick the ones to allow.",
    tag: "MCP",
    preset: { kind: "mcp" },
  },
  {
    key: "openapi",
    name: "OpenAPI document",
    description: "Any REST API described by an OpenAPI document, one tool per operation.",
    tag: "OpenAPI",
    preset: { kind: "openapi" },
  },
];

export function ConnectionCatalog({ projectId, existing }: { projectId: string; existing: string[] }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Entry>();
  const needle = query.trim().toLowerCase();
  const visible = ENTRIES.filter((entry) => `${entry.name} ${entry.description} ${entry.tag}`.toLowerCase().includes(needle));

  return (
    <div className="flex flex-col gap-4">
      <Input
        type="search"
        className="max-w-xs"
        placeholder="Search services"
        aria-label="Search services"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {visible.length === 0 ? (
        <p className="hint">No service matches {query.trim()}. Use MCP server or OpenAPI document for anything else.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((entry) => (
            <li key={entry.key}>
              <IntegrationCard
                name={entry.name}
                description={entry.description}
                tag={entry.tag}
                brand={entry.brand}
                icon={KINDS.connection.icon}
                added={entry.service && existing.includes(entry.key)}
                onSelect={() => setOpen(entry)}
              />
            </li>
          ))}
        </ul>
      )}

      <IntegrationDialog
        open={Boolean(open)}
        onClose={() => setOpen(undefined)}
        name={open?.name ?? ""}
        description={open?.description ?? ""}
        brand={open?.brand}
        icon={KINDS.connection.icon}
      >
        {open && <ConnectionForm key={open.key} projectId={projectId} preset={open.preset} onCreated={() => setOpen(undefined)} />}
      </IntegrationDialog>
    </div>
  );
}
