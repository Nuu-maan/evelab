import Link from "next/link";
import { agentPath, INTEGRATION_CATALOG, integrationPath, type CatalogIntegration } from "@evelab/eve-project";
import { ConfirmSubmit } from "@/components/confirm";
import { IntegrationAddButton } from "@/components/integration-add-button";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { removeIntegrationAction } from "@/lib/actions";
import { getProject } from "@/lib/workspace";

export const dynamic = "force-dynamic";

type AgentRoot = Parameters<typeof agentPath>[0];

/** eve's channels EveLab writes, keyed by the value the channel form preselects. */
const CHANNELS = [
  { value: "slack", id: "slack", name: "Slack", summary: "Mention the agent in channels and DMs, with Connect-managed auth." },
  { value: "discord", id: "discord", name: "Discord", summary: "Run the agent as a bot across servers and threads." },
  { value: "teams", id: "teams", name: "Microsoft Teams", summary: "Bring the agent into Teams chats and channels." },
  { value: "telegram", id: "telegram", name: "Telegram", summary: "A Telegram bot for 1:1 and group chats." },
  { value: "twilio", id: "twilio", name: "Twilio", summary: "SMS and speech-transcribed calls on a phone number." },
  { value: "github", id: "github", name: "GitHub", summary: "Drive the agent from issues, pull requests and comments." },
  { value: "linear", id: "linear", name: "Linear", summary: "Delegate issues and comments through Agent Sessions." },
  { value: "linq", id: "linq", name: "Linq", summary: "iMessage and SMS conversations through Linq." },
  { value: "photon", id: "photon", name: "Photon", summary: "iMessage through Photon." },
  { value: "mcp", id: "mcp", name: "MCP clients", summary: "Expose the agent to any MCP client." },
  { value: "chat-sdk:whatsapp", id: "whatsapp", name: "WhatsApp", summary: "WhatsApp Business Cloud through the Chat SDK." },
  { value: "chat-sdk:gchat", id: "gchat", name: "Google Chat", summary: "Spaces and DMs through the Chat SDK." },
];

const GRID = "grid gap-3 md:grid-cols-2 xl:grid-cols-3";

function GroupHeading({ title, description }: { title: string; description: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-[15px] font-medium tracking-tight">{title}</h2>
      <p className="hint">{description}</p>
    </div>
  );
}

function CatalogCard({ projectId, root, item, added }: { projectId: string; root: AgentRoot; item: CatalogIntegration; added: boolean }) {
  return (
    <Card size="sm" className="h-full">
      <CardHeader>
        <CardTitle>{item.name}</CardTitle>
        <CardDescription>{item.summary}</CardDescription>
        <CardAction>
          {added ? (
            <Badge variant="secondary">Added</Badge>
          ) : (
            <IntegrationAddButton projectId={projectId} integrationId={item.id} name={item.name} />
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-1 text-[13px] text-muted-foreground">
        <code className="mono">{agentPath(root, integrationPath(item))}</code>
        {item.env.length > 0 && (
          <span>
            Reads <code className="mono">{item.env.join(", ")}</code>
          </span>
        )}
      </CardContent>
    </Card>
  );
}

export default async function IntegrationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  const channels = new Set(project.channels.map((channel) => channel.id));
  const paths = new Set(project.files.map((file) => file.path));
  const installed = [
    ...project.extensions.map((extension) => ({ id: extension.id, path: extension.file, slot: "Extension", detail: extension.package })),
    ...project.memory.map((slot) => ({ id: slot.id, path: slot.file, slot: "Memory", detail: slot.description || undefined })),
  ];
  const catalog = (slot: CatalogIntegration["slot"]) => INTEGRATION_CATALOG.filter((item) => item.slot === slot);
  const added = (item: CatalogIntegration) => paths.has(agentPath(project.root, integrationPath(item)));

  return (
    <div className="page">
      <Reveal>
        <header className="page-header">
          <div className="page-heading">
            <h1 className="page-title">Integrations</h1>
            <p className="page-description">
              Channels, extensions and memory from eve&apos;s integration registry. Each one writes the file{" "}
              <code className="mono">eve add</code> writes and adds its packages to package.json. Credentials stay in the
              deployment&apos;s environment or Vercel Connect.
            </p>
          </div>
        </header>
      </Reveal>

      {installed.length > 0 && (
        <Reveal className="flex flex-col gap-3">
          <GroupHeading title="Added" description="Mounted extensions and memory providers in this project." />
          <Stagger className="section">
            {installed.map((entry) => (
              <StaggerItem key={entry.path}>
                <Card size="sm">
                  <CardHeader>
                    <CardTitle className="font-mono">{entry.id}</CardTitle>
                    <CardDescription>{entry.detail ? `${entry.path} · ${entry.detail}` : entry.path}</CardDescription>
                    <CardAction className="flex items-center gap-4">
                      <Badge variant="secondary">{entry.slot}</Badge>
                      <Button asChild variant="ghost">
                        <Link href={`/projects/${id}/files?path=${encodeURIComponent(entry.path)}`}>Edit</Link>
                      </Button>
                      <form action={removeIntegrationAction}>
                        <input type="hidden" name="projectId" value={id} />
                        <input type="hidden" name="path" value={entry.path} />
                        <ConfirmSubmit
                          title={`Remove ${entry.id}?`}
                          description={`Deletes ${entry.path}. Its packages stay in package.json.`}
                          confirmLabel="Remove"
                        >
                          Remove
                        </ConfirmSubmit>
                      </form>
                    </CardAction>
                  </CardHeader>
                </Card>
              </StaggerItem>
            ))}
          </Stagger>
        </Reveal>
      )}

      <Reveal delay={0.05} className="flex flex-col gap-3">
        <GroupHeading
          title="Channels"
          description={
            <>
              How people reach the agent, one file each under <code className="mono">{agentPath(project.root, "channels/")}</code>.
            </>
          }
        />
        <ul className={GRID}>
          {CHANNELS.map((channel) => (
            <li key={channel.value}>
              <Card size="sm" className="h-full">
                <CardHeader>
                  <CardTitle>{channel.name}</CardTitle>
                  <CardDescription>{channel.summary}</CardDescription>
                  <CardAction>
                    {channels.has(channel.id) ? (
                      <Badge variant="secondary">Added</Badge>
                    ) : (
                      <Button asChild size="sm" variant="outline">
                        <Link
                          href={`/projects/${id}/channels?platform=${encodeURIComponent(channel.value)}#add`}
                          aria-label={`Set up ${channel.name}`}
                        >
                          Set up
                        </Link>
                      </Button>
                    )}
                  </CardAction>
                </CardHeader>
              </Card>
            </li>
          ))}
        </ul>
      </Reveal>

      <Reveal delay={0.1} className="flex flex-col gap-3">
        <GroupHeading
          title="Extensions"
          description="Packaged tools, channels and skills. The file name is the namespace, so browser.ts adds browser__navigate."
        />
        <ul className={GRID}>
          {catalog("extensions").map((item) => (
            <li key={item.id}>
              <CatalogCard projectId={id} root={project.root} item={item} added={added(item)} />
            </li>
          ))}
        </ul>
      </Reveal>

      <Reveal delay={0.15} className="flex flex-col gap-3">
        <GroupHeading title="Memory" description="Durable memory the agent recalls across sessions, scoped to each caller." />
        <ul className={GRID}>
          {catalog("memory").map((item) => (
            <li key={item.id}>
              <CatalogCard projectId={id} root={project.root} item={item} added={added(item)} />
            </li>
          ))}
        </ul>
      </Reveal>
    </div>
  );
}
