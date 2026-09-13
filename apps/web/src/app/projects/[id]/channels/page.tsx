import Link from "next/link";
import { agentPath, CHAT_SDK_ADAPTERS, CHAT_SDK_STATES, type ChannelKind } from "@evelab/eve-project";
import { ChannelForm } from "@/components/channel-form";
import { ConfirmSubmit } from "@/components/confirm";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { deleteChannelAction } from "@/lib/actions";
import { readProject } from "@/lib/workspace";

export const dynamic = "force-dynamic";

const LABELS: Partial<Record<ChannelKind, string>> = {
  eve: "HTTP session API",
  slack: "Slack",
  discord: "Discord",
  teams: "Microsoft Teams",
  telegram: "Telegram",
  twilio: "Twilio",
  github: "GitHub",
  linear: "Linear",
  linq: "Linq",
  photon: "Photon",
  mcp: "MCP",
  "chat-sdk": "Chat SDK adapter",
  custom: "Custom channel",
  disabled: "Disabled route",
};

export default async function ChannelsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await readProject(id);
  const directory = agentPath(project.root, "channels/");
  const hasEve = project.channels.some((channel) => channel.id === "eve");

  return (
    <div className="page">
      <Reveal>
        <header className="page-header">
          <div className="page-heading">
            <h1 className="page-title">Channels</h1>
            <p className="page-description">
              How people reach the agent. Each file under <code className="mono">{directory}</code> is one
              channel, served at <code className="mono">/eve/v1/&lt;name&gt;</code>. The same agent answers
              everywhere; tools and instructions need no channel-specific code.
            </p>
          </div>
        </header>
      </Reveal>

      <Stagger className="section">
        {!hasEve && (
          <StaggerItem>
            <Card size="sm">
              <CardHeader>
                <CardTitle className="font-mono">eve</CardTitle>
                <CardDescription>
                  The default HTTP session API, supplied by Eve because the project has no channels/eve.ts.
                </CardDescription>
                <CardAction>
                  <Badge variant="secondary">Built in</Badge>
                </CardAction>
              </CardHeader>
            </Card>
          </StaggerItem>
        )}
        {project.channels.map((channel) => {
          const path = `${directory}${channel.file}`;
          return (
            <StaggerItem key={channel.id}>
              <Card size="sm">
                <CardHeader>
                  <CardTitle className="font-mono">{channel.id}</CardTitle>
                  <CardDescription>
                    {channel.kind === "eve"
                      ? "Sessions, streaming and the eve TUI. Replaces Eve's default to change who may call it."
                      : `Webhook route /eve/v1/${channel.id}`}
                  </CardDescription>
                  <CardAction className="flex items-center gap-4">
                    <Badge variant="secondary">{LABELS[channel.kind] ?? "Channel"}</Badge>
                    <Button asChild variant="ghost">
                      <Link href={`/projects/${id}/files?path=${encodeURIComponent(path)}`}>Edit</Link>
                    </Button>
                    <form action={deleteChannelAction}>
                      <input type="hidden" name="projectId" value={id} />
                      <input type="hidden" name="channelId" value={channel.id} />
                      <ConfirmSubmit
                        title={`Remove ${channel.id}?`}
                        description={
                          channel.kind === "eve"
                            ? `Deletes ${path}. Eve then serves its default HTTP channel again.`
                            : `Deletes ${path}. The platform stops reaching the agent after the next deploy.`
                        }
                        confirmLabel="Remove"
                      >
                        Remove
                      </ConfirmSubmit>
                    </form>
                  </CardAction>
                </CardHeader>
                {channel.source.includes("placeholderAuth()") && (
                  <CardContent>
                    <p className="hint">
                      Uses placeholderAuth(), which refuses browser requests in production. Replace it with your
                      app&apos;s auth before a browser calls the deployed agent.
                    </p>
                  </CardContent>
                )}
              </Card>
            </StaggerItem>
          );
        })}
      </Stagger>

      <Reveal delay={0.1}>
        <Card>
          <CardHeader>
            <CardTitle>Add a channel</CardTitle>
            <CardDescription>
              Writes {directory}&lt;platform&gt;.ts in the shape <code className="mono">eve add channel/&lt;platform&gt;</code>{" "}
              creates, or a Chat SDK adapter for WhatsApp, Google Chat and other services eve has no native channel for.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChannelForm
              projectId={id}
              existing={project.channels.map((channel) => channel.id)}
              chatSdkAdapters={Object.entries(CHAT_SDK_ADAPTERS).map(([key, value]) => ({ id: key, label: value.label, env: value.env }))}
              chatSdkStates={Object.entries(CHAT_SDK_STATES).map(([key, value]) => ({ id: key, label: value.label, env: value.env }))}
            />
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}
