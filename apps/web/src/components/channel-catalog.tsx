"use client";

import { useState } from "react";
import { ChannelForm, type ChatSdkOption } from "@/components/channel-form";
import { IntegrationCard, IntegrationDialog } from "@/components/integration-card";
import { KINDS } from "@/components/kinds";
import { Input } from "@/components/ui/input";
import { BRANDS, type BrandId } from "@/lib/brands";

interface Entry {
  /** What the channel form preselects. */
  value: string;
  /** The channel id, which is also its file name. */
  id: string;
  name: string;
  description: string;
  tag: string;
  brand?: BrandId;
  /** Opens the form with the platform list, for adapters that have no card of their own. */
  picker?: boolean;
}

const brand = (value: string, id: BrandId, tag = "Channel", name?: string): Entry => ({
  value,
  id: value.replace(/^chat-sdk:/, ""),
  name: name ?? BRANDS[id].name,
  description: BRANDS[id].description,
  tag,
  brand: id,
});

/** eve's channels in the order eve.dev lists them, then the Chat SDK. */
const ENTRIES: Entry[] = [
  brand("slack", "slack"),
  brand("discord", "discord"),
  brand("teams", "teams"),
  brand("telegram", "telegram"),
  brand("twilio", "twilio"),
  brand("github", "github"),
  brand("linear", "linear", "Channel", "Linear"),
  brand("linq", "linq"),
  brand("photon", "photon"),
  { value: "mcp", id: "mcp", name: "MCP clients", description: "Expose the agent as an MCP server that any MCP client can call.", tag: "Channel" },
  brand("chat-sdk:whatsapp", "whatsapp", "Chat SDK"),
  brand("chat-sdk:gchat", "gchat", "Chat SDK"),
  {
    value: "chat-sdk",
    id: "",
    name: "Chat SDK adapter",
    description: "One bot for Slack, Discord, Teams, GitHub, Linear or Telegram through the Vercel Chat SDK.",
    tag: "Chat SDK",
    picker: true,
  },
];

/** Channels as eve.dev/integrations shows them: a searchable grid, and setup in a dialog. */
export function ChannelCatalog({
  projectId,
  existing,
  chatSdkAdapters,
  chatSdkStates,
  initial,
}: {
  projectId: string;
  existing: string[];
  chatSdkAdapters: ChatSdkOption[];
  chatSdkStates: ChatSdkOption[];
  initial?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Entry | undefined>(() =>
    ENTRIES.find((entry) => entry.value === initial && !existing.includes(entry.id)),
  );
  const needle = query.trim().toLowerCase();
  const visible = ENTRIES.filter((entry) => `${entry.name} ${entry.description} ${entry.tag}`.toLowerCase().includes(needle));

  return (
    <div className="flex flex-col gap-4">
      <Input
        type="search"
        className="max-w-xs"
        placeholder="Search channels"
        aria-label="Search channels"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {visible.length === 0 ? (
        <p className="hint">No channel matches {query.trim()}.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((entry) => (
            <li key={entry.value}>
              <IntegrationCard
                name={entry.name}
                description={entry.description}
                tag={entry.tag}
                brand={entry.brand}
                icon={KINDS.channel.icon}
                added={!entry.picker && existing.includes(entry.id)}
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
        icon={KINDS.channel.icon}
      >
        {open && (
          <ChannelForm
            projectId={projectId}
            existing={existing}
            chatSdkAdapters={chatSdkAdapters}
            chatSdkStates={chatSdkStates}
            initial={open.picker ? undefined : open.value}
            hidePicker={!open.picker}
            onCreated={() => setOpen(undefined)}
          />
        )}
      </IntegrationDialog>
    </div>
  );
}
