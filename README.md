# EveLab

**The open-source visual IDE for Eve agents.**

Build visually. Own the code. Run it with Eve.

EveLab edits a real Eve project, the one `eve init` creates: `agent/agent.ts`,
`agent/instructions.md`, and `tools/`, `skills/`, `subagents/`, `connections/`,
`channels/` and `schedules/` under `agent/`. There is no proprietary workflow
format, and no state that exists only inside the GUI. Every project in `.evelab/workspace/` is a
normal directory you can open in an editor, commit, and run without EveLab.

## Run it

```bash
pnpm install
pnpm start   # production build, then serve on http://localhost:3000
```

For hot reload while working on EveLab itself, run `pnpm --filter @evelab/web dev`
instead.

Projects are stored in `.evelab/workspace/<slug>/`. Set `EVELAB_WORKSPACE` to
put them somewhere else.

Optional environment:

| Variable | Effect when set |
| --- | --- |
| `DATABASE_URL`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `BETTER_AUTH_SECRET` | Together, enable GitHub sign-in and private projects. Run `pnpm --filter @evelab/db db:migrate` first |
| `BETTER_AUTH_URL` | Where EveLab is served; the GitHub OAuth app's callback is `<url>/api/auth/callback/github` |
| `GITHUB_TOKEN` | Enables source control: import, commit and pull, with a token that can read and write repository contents |
| `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_INSTALLATION_ID` | Source control through a GitHub App instead of a token |
| `VERCEL_TOKEN` | Enables deploying from the Deployments page with `eve deploy` |
| `AI_GATEWAY_API_KEY` | Passed to `eve dev` for runs when the project has no `.env.local` from `eve link` |
| `EVELAB_ALLOW_LOCAL_RUNTIME` | `1` lets a signed-in EveLab run `eve dev` on its own server |

With none of them set, EveLab runs as a local single-user tool.

**Connections, channels and schedules.** Add a hosted MCP server or an OpenAPI
service with Vercel Connect or token auth, reach the agent from Slack, Discord,
Linear, GitHub, Teams, Telegram or MCP clients, and give it cron schedules. Each
is one file under `agent/`, written the way Eve's docs and `eve add` write it;
credentials stay with Vercel Connect or the deployment environment.

**Runs.** Start `eve dev` from the Runs page and talk to the agent. The timeline
streams from Eve's own session API: messages, tool calls with input, output and
duration, approvals you can answer, subagent delegation, errors, and token usage
and cost per turn. Runs are recorded, so they stay readable after the dev server
stops, and a schedule can be fired once from the Schedules page.

**Deploy.** The Deployments page runs `eve deploy` for a Vercel project of your
choice, lists the environment variables your source reads so the deployment has
them, and records each deploy with its URL, commit and log. On Vercel the agent
runs on Workflow, Sandbox, Cron and AI Gateway without a provider key.

**Skills from skills.sh.** Import `@skills/owner/repo/skill` or a skills.sh link
as well as a GitHub directory, with the same review of every file first.

## Layout

```text
apps/web              Next.js app: shell, canvas, agent editor, tools, skills, files
packages/eve-project  Project model, parser, generator, validator, graph (Vitest)
packages/github       GitHub client: tree reading, status, pull planning, commits (Vitest)
packages/db           Drizzle schema for metadata only: users, projects, repos, deployments, runs
packages/auth         Better Auth GitHub configuration
```

## What works today

**The canvas.** Every capability is a node, coloured by what it is: the agent,
its subagents, its tools, its skills, its connections. Drag a chip from the left
onto the canvas to create a tool, a subagent or an MCP connection, or to import a
skill. Click any node and the file
behind it opens in the right-hand inspector, in Monaco, with `⌘S` to save.
Editing a skill on the canvas is editing its `SKILL.md`, not a GUI stand-in for
it.

Edges are ownership. In Eve a subagent inherits nothing, so dragging the end of
an edge onto a subagent moves that file into the subagent's own directory, and
dropping it on empty canvas moves it back to the agent. Node positions
are remembered outside the project, so the project directory stays pure Eve.

**The overview.** A drawing of the canvas as you arranged it, the model and
instructions at a glance, every tool, skill and subagent, and a launch checklist
that says plainly which steps are not built yet.

**Skill import from GitHub.** Paste a link to a directory containing `SKILL.md`.
EveLab reads it, including subdirectories like `scripts/`, lists every file,
flags the ones that can run code, and installs nothing until you confirm.

**The agent.** Name, description, model, temperature and max output tokens are
written into the existing `agent.ts` by patching only the values that changed.
`instructions.md` is edited in Monaco with autosave.

**The files.** Every project file, including ones added by hand outside EveLab,
is readable and editable in the Files workbench: a tree with file-type icons,
compacted folders and full keyboard support, next to Monaco.

**Source control.** Import an existing Eve project from GitHub: EveLab reads the
branch, shows every file it found and everything it skipped (symlinks,
submodules, binaries, `.env` files), and writes exactly the commit you reviewed.
Any project can connect to a repository or create one. Edits show up as changes
with a side-by-side diff; committing is explicit, needs a message, and creates the
commit on GitHub directly. Pull brings in commits made elsewhere, file by file,
and refuses to write anything if a file changed on both sides. The project's
`.gitignore` is honoured, and `.env` files never leave the machine.

**Everything else.** A sidebar with a project switcher, `⌘K` command palette,
`⌘S` save, panes you can resize by dragging (and that keep their width), live
config validation in the header, light and dark, and no page that depends on
JavaScript to become readable.

## What is not built yet

MCP import, skills.sh import, connections, channels, runs, deployment, and the
GitHub App installation flow. The pages exist and say so rather than showing
placeholder data.

[plan.md](plan.md) is the detailed plan for the remaining phases, including the
current architecture and the invariants to work within.
[docs/decisions.md](docs/decisions.md) records what is settled and what is
blocked.

## Tests

```bash
pnpm test                                  # unit tests across the workspace

cd apps/web
CHROMIUM_PATH=/usr/bin/chromium pnpm e2e   # canvas flows in a real browser
```

The parser and generator carry most of the coverage, because a lossy round trip
is the one bug that would make EveLab untrustworthy. The browser suite covers
the canvas and the shell: selecting a node opens the right file, saving writes it
to disk without disturbing the rest, dragging an edge rewrites exactly one
subagent's frontmatter, creating a tool produces real source, node positions and
pane widths survive a reload, and the explorer works from the keyboard. The source
control journey (import, commit, pull, conflicts, publishing a new repository)
runs against an in-memory GitHub the web server reaches through `GITHUB_API_URL`.

Set `E2E_DATABASE_URL` to an empty Postgres database to add the sign-in suite. It
starts a second server with auth on, applies the migrations, and checks that
signed-out visitors are sent to GitHub, that a project is a 404 to anyone but its
owner, and that another account firing a server action directly is refused.

`pnpm e2e` reuses a server you already have running. Point `CHROMIUM_PATH` at a
local Chromium, or run `pnpm exec playwright install chromium` instead.

One operational note: stop `pnpm start` or `pnpm dev` before running
`pnpm build`. A running server holds `.next` open, and the build then fails with
a confusing `PageNotFoundError` or a missing `.next/types/app/layout.ts`. If you
hit either, `rm -rf apps/web/.next apps/web/*.tsbuildinfo` and build again.
