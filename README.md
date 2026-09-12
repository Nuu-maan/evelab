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
apps/web              Next.js app: shell, agent editor, tools, subagent graph, files
packages/eve-project  Project model, parser, generator, validator, graph (Vitest)
packages/db           Drizzle schema for metadata only: users, projects, repos, deployments, runs
packages/auth         Better Auth GitHub configuration
```

## What works today

- Create a project; EveLab writes a real Eve project to disk.
- Edit name, description, model, temperature and max output tokens; they are
  written into the existing `agent.ts` by patching only the values that changed.
- Edit `instructions.md` in Monaco with autosave and `⌘S`.
- Scaffold a TypeScript tool file; create and delete subagents.
- Read every project file, including ones added by hand outside EveLab, and edit
  any of them in the Files workbench.
- See the parent-to-subagent graph (React Flow).
- `⌘K` command palette.

## What is not built yet

MCP import, skill import, connections, channels, runs, GitHub sync, deployment,
and sign-in wiring. The pages exist and say so rather than showing placeholder
data. See [docs/decisions.md](docs/decisions.md) for the decisions that block
some of them.

## Tests

```bash
pnpm --filter @evelab/eve-project test
```

The parser and generator carry the coverage, because a lossy round trip is the
one bug that would make EveLab untrustworthy.
