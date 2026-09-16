"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createChannelAction, createChatSdkChannelAction } from "@/lib/actions";

type Platform = "slack" | "discord" | "linear" | "github" | "linq" | "photon" | "teams" | "telegram" | "twilio" | "mcp";

/** A Chat SDK adapter or state store, passed from the server so the core package stays out of the client bundle. */
export interface ChatSdkOption {
  id: string;
  label: string;
  env: readonly string[];
}

/** What each platform needs, from its Eve channel docs. */
const PLATFORMS: Record<
  Platform,
  { label: string; connect: "required" | "optional" | "none"; connector: string; setup: string }
> = {
  slack: {
    label: "Slack",
    connect: "optional",
    connector: "slack/my-agent",
    setup: "Without a connector, eve reads SLACK_BOT_TOKEN and SLACK_SIGNING_SECRET from the environment.",
  },
  discord: { label: "Discord", connect: "required", connector: "discord/my-agent", setup: "" },
  linear: { label: "Linear", connect: "required", connector: "linear/my-agent", setup: "" },
  github: { label: "GitHub", connect: "required", connector: "github/my-agent", setup: "" },
  linq: { label: "Linq (iMessage and SMS)", connect: "required", connector: "linq/my-agent", setup: "" },
  photon: { label: "Photon (iMessage)", connect: "required", connector: "photon/my-agent", setup: "" },
  teams: {
    label: "Microsoft Teams",
    connect: "none",
    connector: "",
    setup: "Teams credentials come from the environment; see the Teams channel docs.",
  },
  telegram: {
    label: "Telegram",
    connect: "none",
    connector: "",
    setup: "The bot token comes from the environment; see the Telegram channel docs.",
  },
  twilio: {
    label: "Twilio (SMS and voice)",
    connect: "none",
    connector: "",
    setup:
      "Reads TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN from the environment. Point the number's webhooks at /eve/v1/twilio/messages and /eve/v1/twilio/voice.",
  },
  mcp: {
    label: "MCP clients",
    connect: "none",
    connector: "",
    setup: "Exposes the agent to MCP clients. The route is open on localhost only until you change its auth.",
  },
};

const CHAT_SDK = "chat-sdk:";

export function ChannelForm({
  projectId,
  existing,
  chatSdkAdapters,
  chatSdkStates,
  initial,
  hidePicker,
  onCreated,
}: {
  onCreated?: () => void;
  /** The platform was already chosen from a catalog card, so the list is not shown. */
  hidePicker?: boolean;
  /** A platform to preselect, such as "twilio" or "chat-sdk:whatsapp", when it is still available. */
  initial?: string;
  projectId: string;
  existing: string[];
  chatSdkAdapters: ChatSdkOption[];
  chatSdkStates: ChatSdkOption[];
}) {
  const router = useRouter();
  const native = (Object.keys(PLATFORMS) as Platform[]).filter((platform) => !existing.includes(platform));
  const adapters = chatSdkAdapters.filter((adapter) => !existing.includes(adapter.id));
  // Chat SDK comes first: one adapter model for every platform, with credentials left to the environment.
  const first = adapters[0] ? `${CHAT_SDK}${adapters[0].id}` : native[0];
  const available = [...adapters.map((option) => `${CHAT_SDK}${option.id}`), ...native];
  const [choice, setChoice] = useState<string | undefined>(initial && available.includes(initial) ? initial : first);
  const [state, setState] = useState(chatSdkStates.find((option) => option.id === "redis")?.id ?? chatSdkStates[0]?.id ?? "");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  if (!choice) return <p className="hint">Every channel evelab can write is already set up.</p>;
  const adapter = choice.startsWith(CHAT_SDK) ? chatSdkAdapters.find((option) => `${CHAT_SDK}${option.id}` === choice) : undefined;
  const platform = adapter ? undefined : (choice as Platform);
  const info = platform ? PLATFORMS[platform] : undefined;
  const stateOption = chatSdkStates.find((option) => option.id === state);
  const label = adapter ? adapter.label : info!.label;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim() || undefined;
    setPending(true);
    setError(undefined);
    const result = adapter
      ? await createChatSdkChannelAction({ projectId, adapter: adapter.id, state })
      : await createChannelAction({
          projectId,
          kind: platform!,
          connector: text("connector"),
          botName: text("botName"),
          botUsername: text("botUsername"),
          allowFrom: text("allowFrom"),
          fromNumber: text("fromNumber"),
        });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onCreated?.();
    router.refresh();
  };

  return (
    <form className="inspector-form" onSubmit={(event) => void submit(event)} key={choice}>
      <FieldGroup>
        <Field>
          {!hidePicker && <FieldLabel htmlFor="channel-platform">Platform</FieldLabel>}
          {!hidePicker && (
          <Select value={choice} onValueChange={setChoice}>
            <SelectTrigger id="channel-platform" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {adapters.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Vercel Chat SDK</SelectLabel>
                  {adapters.map((option) => (
                    <SelectItem key={option.id} value={`${CHAT_SDK}${option.id}`}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
              {native.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Eve native channels</SelectLabel>
                  {native.map((value) => (
                    <SelectItem key={value} value={value}>
                      {PLATFORMS[value].label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
          )}
          {adapter ? (
            <FieldDescription>
              Vercel Chat SDK behind eve&apos;s chat-sdk channel, served at <code className="mono">/eve/v1/{adapter.id}</code>.
              The same bot code works on every platform, and evelab adds the adapter packages to package.json.
            </FieldDescription>
          ) : (
            info?.setup && <FieldDescription>{info.setup}</FieldDescription>
          )}
        </Field>

        {adapter && (
          <Field>
            <FieldLabel htmlFor="channel-state">State store</FieldLabel>
            <Select value={state} onValueChange={setState}>
              <SelectTrigger id="channel-state" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {chatSdkStates.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>
              Keeps thread subscriptions and deduplication. Memory forgets on every restart, so use Redis once deployed.
            </FieldDescription>
          </Field>
        )}

        {adapter && (
          <div className="channel-env" aria-label="Environment variables this channel reads">
            <p className="timeline-label">Set on the deployment</p>
            <ul>
              {[...adapter.env, ...(stateOption?.env ?? [])].map((name) => (
                <li key={name}>
                  <code className="mono">{name}</code>
                </li>
              ))}
            </ul>
          </div>
        )}

        {info && info.connect !== "none" && (
          <Field>
            <FieldLabel htmlFor="channel-connector">Vercel Connect connector</FieldLabel>
            <Input
              className="font-mono"
              id="channel-connector"
              name="connector"
              placeholder={info.connector}
              required={info.connect === "required"}
            />
            <FieldDescription>
              Create it with{" "}
              <code className="mono">vercel connect create {platform} --name my-agent --triggers</code>, then attach the
              trigger path <code className="mono">/eve/v1/{platform}</code>. Connect keeps the platform token and verifies
              each webhook.
            </FieldDescription>
          </Field>
        )}

        {platform === "github" && (
          <Field>
            <FieldLabel htmlFor="channel-bot">Bot name</FieldLabel>
            <Input className="font-mono" id="channel-bot" name="botName" placeholder="my-agent" required />
          </Field>
        )}
        {platform === "telegram" && (
          <Field>
            <FieldLabel htmlFor="channel-username">Bot username</FieldLabel>
            <Input className="font-mono" id="channel-username" name="botUsername" placeholder="my_bot" required />
          </Field>
        )}
        {platform === "twilio" && (
          <>
            <Field>
              <FieldLabel htmlFor="channel-allow">Allowed caller</FieldLabel>
              <Input className="font-mono" id="channel-allow" name="allowFrom" placeholder="+15551234567" required />
              <FieldDescription>Only this number can reach the agent by SMS or voice.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="channel-from">Send from</FieldLabel>
              <Input className="font-mono" id="channel-from" name="fromNumber" placeholder="+15557654321" />
              <FieldDescription>Your Twilio number, for replies by SMS. Leave empty for voice only.</FieldDescription>
            </Field>
          </>
        )}
      </FieldGroup>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="row">
        <Button type="submit" disabled={pending}>
          Add {label}
        </Button>
      </div>
    </form>
  );
}
