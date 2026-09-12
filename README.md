# EveLab

**The open-source visual IDE for Eve agents.**

Build visually. Own the code. Run it with Eve.

EveLab edits a real Eve project: `agent.ts`, `instructions.md`, `tools/`,
`skills/`, `subagents/`. There is no proprietary workflow format, and no state
that exists only inside the GUI. Every project in `.evelab/workspace/` is a
normal directory you can open in an editor, commit, and run without EveLab.

## Run it

```bash
pnpm install
pnpm --filter @evelab/web dev
```

Projects are stored in `.evelab/workspace/<slug>/`. Set `EVELAB_WORKSPACE` to
put them somewhere else.

Optional environment:

| Variable | Effect when set |
| --- | --- |
| `AI_GATEWAY_API_KEY` | Model list comes from the gateway instead of the built-in fallback |
| `DATABASE_URL` | Enables the metadata database (`packages/db`) |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | Enables GitHub sign-in (`packages/auth`) |

With none of them set, EveLab runs as a local single-user tool.

## Layout

```text
apps/web              Next.js app: shell, canvas, agent editor, tools, skills, files
packages/eve-project  Project model, parser, generator, validator, graph (Vitest)
packages/db           Drizzle schema for metadata only: users, projects, repos, deployments, runs
packages/auth         Better Auth GitHub configuration
```

## What works today

**The canvas.** Every capability is a node: the agent, its subagents, its tools,
its skills. Drag a chip from the left onto the canvas to create a tool or a
subagent, or to import a skill. Click any node and the file behind it opens in
the right-hand inspector, in Monaco, with `⌘S` to save. Editing a skill on the
canvas is editing its `SKILL.md`, not a GUI stand-in for it. Node positions are
remembered outside the project, so the project directory stays pure Eve.

**Skill import from GitHub.** Paste a link to a directory containing `SKILL.md`.
EveLab reads it, including subdirectories like `scripts/`, lists every file,
flags the ones that can run code, and installs nothing until you confirm.

**The agent.** Name, description, model, temperature and max output tokens are
written into the existing `agent.ts` by patching only the values that changed.
`instructions.md` is edited in Monaco with autosave.

**The files.** Every project file, including ones added by hand outside EveLab,
is readable and editable in the Files workbench.

**Everything else.** `⌘K` command palette, `⌘S` save, live config validation in
the top bar, light and dark, and no page that depends on JavaScript to become
readable.

## What is not built yet

MCP import, skill import, connections, channels, runs, GitHub sync, deployment,
and sign-in wiring. The pages exist and say so rather than showing placeholder
data. See [docs/decisions.md](docs/decisions.md) for the decisions that block
some of them.

## Tests

```bash
pnpm test                                  # unit tests across the workspace

cd apps/web
CHROMIUM_PATH=/usr/bin/chromium pnpm e2e   # canvas flows in a real browser
```

The parser and generator carry most of the coverage, because a lossy round trip
is the one bug that would make EveLab untrustworthy. The browser suite covers
the canvas: selecting a node opens the right file, saving writes it to disk
without disturbing the rest, creating a tool produces real source, and node
positions survive a reload.

`pnpm e2e` reuses a server you already have running. Point `CHROMIUM_PATH` at a
local Chromium, or run `pnpm exec playwright install chromium` instead.

One operational note: stop `pnpm start` or `pnpm dev` before running
`pnpm build`. A running server holds `.next` open, and the build then fails with
a confusing `PageNotFoundError` or a missing `.next/types/app/layout.ts`. If you
hit either, `rm -rf apps/web/.next apps/web/*.tsbuildinfo` and build again.
