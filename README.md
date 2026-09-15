# EveLab

**The open-source visual IDE for Eve agents.**

Build visually. Own the code. Run it with Eve.

EveLab edits a real Eve project, the one `eve init` creates: `agent/agent.ts`,
`agent/instructions.md`, and `tools/`, `skills/`, `subagents/`, `connections/`,
`channels/` and `schedules/` under `agent/`. There is no proprietary workflow
format and no state that only lives inside the GUI. Every project is a normal
folder you can open in an editor, commit, and run without EveLab.

## Run it

```bash
pnpm install
pnpm start   # production build, then serve on http://localhost:3000
```

For hot reload while working on EveLab itself:

```bash
pnpm --filter @evelab/web dev
```

The dev server listens on your network too, so you can open the printed
`Network` address on a phone on the same Wi-Fi. If the page cannot be reached,
allow the port through your firewall, for example
`sudo ufw allow from 192.168.0.0/24 to any port 3000 proto tcp`.

Projects are stored in `.evelab/workspace/<slug>/`. Set `EVELAB_WORKSPACE` to
keep them somewhere else. Canvas layouts live beside the workspace in
`.evelab/layouts/`, so the project folders stay pure Eve.

## What EveLab can do today

### Projects

- A projects page with a live preview of each architecture, the model, what
  each project is made of, file count and when it last changed.
- Filter by name, id or model, and sort by recent or name.
- Create a project from a guided form, or import an existing Eve project from
  GitHub.

### The canvas

The canvas is the architecture of your agent, drawn from its files.

- **Nodes, in the style of n8n.** Agents are cards with an icon and a name.
  Tools, skills and connections are round tiles, channels are square ones. Click
  any node to see everything about it in the inspector on the right, including
  its source, which you can edit in place.
- **Ports and wires.** Each agent has a diamond port per kind of thing it can
  have. Drag from a port onto a resource to attach it, or select a wire and
  press Detach. Resources shared by several agents live once in `lib/` and are
  re-exported where they are used.
- **An Excalidraw-style toolbar.** Drag a subagent, tool, skill, connection or
  channel onto an agent and EveLab asks which existing one to add, or creates a
  new one. Keys 1 to 5 do the same, 6 and 7 add notes and sections, V selects
  and H pans.
- **Layouts and wires.** Hierarchical, horizontal or freeform layouts; curved,
  elbow or straight wires; folding an agent to hide what it owns; notes and
  coloured sections for sketching around the architecture.
- Undo and redo, copy and paste to attach resources, zoom and fit, a minimap,
  snap to grid, and a canvas lock.

### Building the agent

- **Agent page.** Name, description, model and reasoning are written into the
  existing `agent.ts` by changing only the values that moved. Instructions are
  edited in Monaco with autosave.
- **Tools, skills, subagents, connections, channels and schedules** each have a
  page to list, create and remove them. Connections cover hosted MCP servers and
  OpenAPI services with Vercel Connect or token auth. Channels cover Slack,
  Discord, Linear, GitHub, Teams, Telegram, Twilio, MCP clients and Chat SDK
  adapters. Every one is a single file, written the way Eve's docs and `eve add`
  write it.
- **Integrations.** A catalog of eve's registry: channels, extensions
  (agent-browser, Browserbase, KERNEL) mounted under `agent/extensions/`, and
  memory providers (file memory, Supermemory, Upstash AgentKit) under
  `agent/memory/`. Adding one writes the file `eve add` writes and its packages
  into `package.json`; credentials stay in the environment.
- **Skill import.** Import a GitHub directory with a `SKILL.md`, a skills.sh
  link or `@skills/owner/repo/skill`. EveLab lists every file, flags the ones
  that can run code, and installs nothing until you confirm.
- **Assistant** (`Ctrl+I`). An AI SDK assistant through AI Gateway that reads
  the project and writes instructions, tools, subagents, connections and
  schedules through the same file operations as the rest of the app.
- **README and `.env.example`.** Each project gets a generated README and an
  `.env.example` listing the variables its agent needs, kept in step as the
  project changes.

### Files

- An editor-style explorer next to Monaco: file-type icons, compacted folders
  and full keyboard support.
- Create files and folders, rename (`F2`) and delete (`Delete`, with a
  confirmation). Empty folders stay visible. Paths are validated on the server,
  and every change reaches the canvas.

### Taking the code with you

- **Download ZIP** from the Export menu: every project file in a folder named
  after the project, without `node_modules`, `.git` or build output.
- **Push to GitHub**: connect a repository or create one, review changes with a
  side-by-side diff, and commit with a message. Pull brings in commits made
  elsewhere and refuses to overwrite a file that changed on both sides. `.env`
  files never leave the machine.

### Everywhere

- Sidebar with a project switcher, `Ctrl+K` command palette, `Ctrl+P` quick
  open and `Ctrl+S` save.
- Light and dark themes with a toggle; the choice is remembered per browser.
- Resizable panes that keep their width, and pages that stay readable without
  JavaScript.
- Optional GitHub sign-in with private projects, for running EveLab as a shared
  service.

## Coming soon

These are built in part but switched off in the app, which says "Coming soon"
rather than showing half-working screens. Their code is kept in place.

- **Runs.** Start `eve dev`, talk to the agent, and follow a live timeline of
  messages, tool calls, approvals, subagent delegation, errors and token usage.
- **Observability.** Usage, cost, latency, tool failures and errors from
  recorded runs, with links to Vercel Observability for deployed agents.
- **Deployments.** `eve deploy` to a Vercel project, with the environment
  variables your source reads and a history of each deploy.

The Run and Deploy buttons in the header, and "Run now" on schedules, are
disabled until these ship.

## Left to do

- **Turn runs, observability and deployments back on**, including running each
  agent's dev server in Vercel Sandbox and deploying as a Vercel Workflow run.
- **Faster development builds.** Move the shared packages from `./file.js`
  imports to extensionless imports so the dev server can use Turbopack instead
  of webpack.
- **MCP tool discovery.** List a server's tools before writing a connection's
  allow list.
- **Vercel Connect connector management.** Create connectors and attach their
  trigger paths from EveLab instead of the Vercel CLI or dashboard.
- **GitHub App installation flow** per user, alongside the existing token mode.
- **Launch polish.** One end-to-end browser journey from creating a project to
  deploying it, an accessibility pass in both themes, and screenshots for this
  README.

[plan.md](plan.md) has the detailed plan, the architecture and the rules to work
within. [docs/decisions.md](docs/decisions.md) records what is settled and what
is blocked.

## Environment

Everything is optional. With nothing set, EveLab runs as a local single-user
tool against the filesystem. [.env.example](.env.example) lists every variable
with notes.

| Variable | Effect when set |
| --- | --- |
| `EVELAB_WORKSPACE` | Where projects are stored |
| `AI_GATEWAY_API_KEY` | Live model list and the assistant through AI Gateway |
| `EVELAB_ASSISTANT_MODEL` | Model id for the assistant, `anthropic/claude-sonnet-5` by default |
| `GITHUB_TOKEN` | Source control: import, commit, pull and push, with a token that can read and write repository contents |
| `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_INSTALLATION_ID` | Source control through a GitHub App instead of a token |
| `DATABASE_URL`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | Together, GitHub sign-in and private projects. Run `pnpm --filter @evelab/db db:migrate` first |
| `BLOB_READ_WRITE_TOKEN` | Stores layouts, and later run and deployment history, in Vercel Blob |
| `VERCEL_TOKEN`, `VERCEL_OIDC_TOKEN`, `VERCEL_TEAM_ID`, `VERCEL_PROJECT_ID` | Used by runs in Vercel Sandbox and by deployments once they are switched back on |

## Layout

```text
apps/web              Next.js app: projects, canvas, agent editor, resources, files, source control
packages/eve-project  Project model, parser, generator, validator and graph (Vitest)
packages/github       GitHub client: tree reading, status, pull planning, commits (Vitest)
packages/db           Drizzle schema for metadata only: users, projects, repositories
packages/auth         Better Auth GitHub configuration
```

## Tests

```bash
pnpm test                                  # unit tests across the workspace
pnpm typecheck                             # TypeScript across the workspace

cd apps/web
CHROMIUM_PATH=/usr/bin/chromium pnpm e2e   # browser suite
```

The parser and generator carry most of the coverage, because a lossy round trip
is the one bug that would make EveLab untrustworthy. The browser suite covers
the canvas, the shell, the explorer and source control, which runs against an
in-memory GitHub reached through `GITHUB_API_URL`. Set `E2E_DATABASE_URL` to an
empty Postgres database to add the sign-in suite.

Stop `pnpm start` or `pnpm dev` before running `pnpm build`. A running server
holds `.next` open and the build fails with a confusing `PageNotFoundError`. If
that happens, `rm -rf apps/web/.next apps/web/*.tsbuildinfo` and build again.
