"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createChannelAction } from "@/lib/actions";

type Platform = "slack" | "discord" | "linear" | "github" | "linq" | "photon" | "teams" | "telegram" | "mcp";

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
  mcp: {
    label: "MCP clients",
    connect: "none",
    connector: "",
    setup: "Exposes the agent to MCP clients. The route is open on localhost only until you change its auth.",
  },
};

export function ChannelForm({ projectId, existing }: { projectId: string; existing: string[] }) {
  const router = useRouter();
  const available = (Object.keys(PLATFORMS) as Platform[]).filter((platform) => !existing.includes(platform));
  const [platform, setPlatform] = useState<Platform | undefined>(available[0]);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  if (!platform) return <p className="hint">Every platform EveLab can write is already set up.</p>;
  const info = PLATFORMS[platform];

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim() || undefined;
    setPending(true);
    setError(undefined);
    const result = await createChannelAction({
      projectId,
      kind: platform,
      connector: text("connector"),
      botName: text("botName"),
      botUsername: text("botUsername"),
    });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.refresh();
  };

  return (
    <form className="inspector-form" onSubmit={(event) => void submit(event)} key={platform}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="channel-platform">Platform</FieldLabel>
          <select
            id="channel-platform"
            className="native-select"
            value={platform}
            onChange={(event) => setPlatform(event.target.value as Platform)}
          >
            {available.map((value) => (
              <option key={value} value={value}>
                {PLATFORMS[value].label}
              </option>
            ))}
          </select>
          {info.setup && <FieldDescription>{info.setup}</FieldDescription>}
        </Field>

        {info.connect !== "none" && (
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
              <code className="mono">
                vercel connect create {platform} --name my-agent --triggers
              </code>
              , then attach the trigger path <code className="mono">/eve/v1/{platform}</code>. Connect keeps the
              platform token and verifies each webhook.
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
      </FieldGroup>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="row">
        <Button type="submit" disabled={pending}>
          Add {info.label}
        </Button>
      </div>
    </form>
  );
}
