# EveLab: implementation plan

This document is the handoff for continuing EveLab. It records the current state
of the repository in enough detail to work without re-deriving it, then plans
each remaining phase.

Read sections 1 to 5 before writing code. They contain the invariants that make
this project work; breaking one of them is worse than shipping nothing.

---

## 1. What EveLab is

**An open-source visual IDE for Eve agents.** Build visually, own the code, run
it with Eve.

The product edits a **real Eve project**: `agent.ts`, `instructions.md`,
`tools/`, `skills/`, `subagents/`. EveLab is the authoring, editing, debugging
and deployment layer over that project. It is not a new agent runtime and must
not become a proprietary workflow format.

The test of any feature is one question:

> What Eve primitive does this represent, where does it live in the Eve project,
> and can EveLab round-trip it without losing information?

If the answer is unclear, go read Eve's current docs or implementation. **Do not
invent Eve APIs.**

---

## 2. Invariants

These are settled. Changing one is a deliberate architectural decision, not a
refactor.

1. **Files on disk are canonical.** EveLab parses them into a project model,
   edits the model, and writes files back. Postgres holds metadata only.
2. **GUI edits patch source; they never regenerate it.** `agent.ts` is edited by
   locating the config object through the TypeScript AST and replacing only the
   value ranges that changed. Imports, comments, helper code and any Eve option
   EveLab has no control for survive untouched.
3. **An unparseable file is never overwritten.** If `agent.ts` cannot be parsed,
   `generateProject` re-emits the original bytes.
4. **Unmodelled configuration is preserved, not hidden.** Config keys and
   frontmatter EveLab does not model live in `raw` fields, are shown read-only
   on the Runtime tab, and are re-emitted verbatim.
5. **Files EveLab does not own pass through byte for byte.** Only `agent.ts`,
   the instructions file, `tools/`, `skills/` and `subagents/` are generated.
   See `isGeneratedPath` in `packages/eve-project/src/types.ts`.
6. **EveLab presentation state lives outside the project.** Canvas positions are
   stored in `<workspace>/../layouts/<projectId>.json`. The project directory
   stays pure Eve.
7. **Importing code is not executing it, and not trusting it either.** Imported
   content is bounded, validated, and shown to the user before it is written.
8. **No page depends on JavaScript to become readable.** Page entrance animation
   is CSS. `motion/react` is only for motion that answers an interaction.
9. **Secrets are delegated.** EveLab does not store provider credentials. GitHub
   App private keys and OAuth secrets are read server-side only.
10. **Zod at every boundary.** Form data, action arguments, imported metadata and
    external API responses are all untrusted input.

---

## 3. Current state

Repo: `github.com/anishfn/evelab` (private). Node 26, pnpm 11, Turborepo.

```text
apps/web                 Next.js 15 app router, React 19
packages/eve-project     Project model, parser, generator, validator, graph
packages/db              Drizzle schema (metadata only): not wired up
packages/auth            Better Auth GitHub config: not wired up
packages/github          GitHub client, status, pull planning, commits
```

### 3.1 `packages/eve-project`

The most important package. 27 unit tests. Everything is exported from
`src/index.ts`.

| File | Contains |
| --- | --- |
| `types.ts` | Zod schemas and types: `EveProject`, `AgentConfig`, `ModelConfig`, `Tool`, `Skill`, `Subagent`, `ProjectFile`, plus `isGeneratedPath` |
| `parse.ts` | `parseProject(files) => { project, warnings }` |
| `generate.ts` | `generateProject(project) => ProjectFile[]`, `renderAgentTemplate` |
| `agent-source.ts` | `readAgentSource`, `patchAgentSource`, `readModelValue`, `renderModelValue`: the TypeScript AST layer |
| `validate.ts` | `validateProject(project) => ValidationIssue[]` |
| `graph.ts` | `getProjectGraph` (agent + subagents), `getCanvasGraph` (all capabilities, with ownership edges and a `filePath` per node) |
| `frontmatter.ts` | Flat YAML frontmatter read/write for markdown files |
| `ownership.ts` | `applyOwnershipChange`, `OwnershipError`: moves a tool or skill between the agent and its subagents, which is what dragging a canvas edge does |

Fixtures live in `test/fixtures/{basic-agent,subagent-agent}`. Round-trip tests
assert `generateProject(parseProject(files)) === files`, byte for byte. **A new
fixture is the cheapest way to pin down new Eve syntax.**

Model shapes handled today: `model: "openai/gpt-5.6"` and
`model: { id, temperature, maxOutputTokens, ...raw }`, including shorthand
properties (`{ gateway }` stays shorthand).

### 3.1b `packages/github`

Server-side GitHub access. Everything is exported from `src/index.ts`; 25 unit
tests against a fake client, no network.

| File | Contains |
| --- | --- |
| `names.ts` | Repository name, branch name and repository path validation, `encodePath` |
| `blob.ts` | `gitBlobSha`: Git's id for file content |
| `tracked.ts` | `trackedFiles` (root `.gitignore` plus secrets), `isSecretPath` |
| `status.ts` | `SyncBase`, `computeChanges`, `computeStatus`, `advanceBase` |
| `merge.ts` | `planPull`: per-file three-way merge that reports conflicts |
| `client.ts` | `createGitHubClient` (token or App), `getInstallationClient`, `GitHubError`, `RemoteMovedError` |
| `repository.ts` | `listRepositories`, `getRepository`, `createRepository`, `getBranchHead`, `readRepositoryTree`, `commitFiles` |

### 3.2 `apps/web`

Routes, all under `src/app`:

```text
/                                    redirect to /projects
/projects                            dashboard (PlainShell)
/projects/new                        creation flow
/projects/import                     import an Eve project from GitHub
/projects/[id]                       overview
/projects/[id]/canvas                visual editor + inspector
/projects/[id]/agent                 General | Instructions | Model | Runtime
/projects/[id]/tools                 list + create TypeScript tool
/projects/[id]/skills                list + GitHub import
/projects/[id]/subagents             list + create
/projects/[id]/files                 file tree + Monaco workbench
/projects/[id]/source                source control: changes, diff, commit, pull
/projects/[id]/connections           stub
/projects/[id]/channels              stub
/projects/[id]/runs                  stub
/projects/[id]/deployments           stub
/projects/[id]/settings              path on disk, delete project
```

Every project route needs `export const dynamic = "force-dynamic"`: the
project state is on disk, and a statically prerendered page will also swallow
server action POSTs.

Server-side libraries (`src/lib`):

| File | Exports |
| --- | --- |
| `workspace.ts` | `workspaceRoot`, `resolveInProject`, `listProjects`, `projectExists`, `readProject`, `readProjectFiles`, `readProjectFile`, `writeProject`, `writeProjectFile`, `deleteProjectFile`, `createProject`, `deleteProject`, `slugify` |
| `actions.ts` | All server actions (see below) |
| `layout.ts` | `readLayout`, `writeLayout` for canvas positions |
| `models.ts` | `listModels`: AI Gateway discovery with a fallback catalogue |
| `skill-import.ts` | `fetchSkillCandidate`, `parseGitHubUrl`, `isSafeRelativePath`, `slugifySkillId` |
| `skill-types.ts` | `SkillCandidate` types, shared with client components |
| `panes.ts` | `paneStyle`: resizable pane widths from cookies, clamped, as CSS custom properties |
| `pane-config.ts` | `PANES` bounds and cookie names, shared by the server and the drag handle |
| `git.ts` | Source control bridge: sync record, `previewImport`, `importRepository`, `connectRepository`, `publishToNewRepository`, `commitProject`, `pullProject`, `discardChange`, `getSourceSummary` |
| `source-types.ts` | Source control types shared with client components |

Server actions in `actions.ts`: `createProjectAction`, `deleteProjectAction`,
`updateAgentAction`, `updateModelAction`, `saveInstructionsAction`,
`readFileAction`, `saveFileAction`, `createToolAction`, `createSubagentAction`,
`deleteSubagentAction`, `deleteToolAction`, `deleteSkillAction`,
`saveLayoutAction`, `changeOwnershipAction`, `previewSkillAction`,
`installSkillAction`, and for source control `previewImportAction`,
`importRepositoryAction`, `connectRepositoryAction`, `createRepositoryAction`,
`commitAction`, `pullAction`, `discardChangeAction`,
`disconnectRepositoryAction`.

Components worth knowing:

- `components/sidebar.tsx`, `project-switcher.tsx`, `project-header.tsx`: the
  project shell. The sidebar is resizable; the header shows the breadcrumb,
  config status, Run and Deploy.
- `components/resize-handle.tsx`: drag or arrow-key handle on a pane edge.
  Writes a CSS custom property on the nearest `[data-panes]` element and a
  cookie, so dragging never re-renders React.
- `components/canvas/canvas-view.tsx`: React Flow canvas, palette drag and
  drop, reconnectable ownership edges, custom zoom controls, debounced position
  persistence. Nodes live in `useNodesState` so React Flow keeps their measured
  size; rebuilding them from props on every change is what made them blink.
- `components/canvas/layout.ts`: tidy-tree fallback layout, shared with the
  overview's `components/graph-preview.tsx` (a server-rendered SVG).
- `components/kinds.tsx`: icon, label and colour per capability kind.
- `components/files/`: `tree.ts` (pure tree model with compacted folders),
  `file-tree.tsx` (keyboard tree), `file-icon.tsx`.
- `components/canvas/canvas-inspector.tsx`: right-hand panel: opens the file
  behind the selected node in Monaco, saves with the button or `⌘S`.
- `components/canvas/canvas-create-panel.tsx`: the form a palette drop opens.
- `components/skill-import-dialog.tsx`: two-step import: read source, then
  install.
- `components/editor.tsx`: Monaco wrapper plus `languageFor(path)`, with
  themes matched to the app surfaces and semantic diagnostics off.
- `components/motion.tsx`: `Reveal`, `Stagger`, `StaggerItem`. **Server
  components using CSS animation.** Do not turn these back into client
  components.
- `components/interaction.ts`: `EASE_OUT`, `EXIT`, `DRAWER`, `SPRING` for
  `motion/react`.
- `components/plain-shell.tsx`: top bar for pages outside a project.

Storage today: projects are directories under `.evelab/workspace/<slug>/`,
overridable with `EVELAB_WORKSPACE`. Canvas layouts sit in
`.evelab/layouts/<slug>.json`.

### 3.3 What works

- Create a project; real Eve files are written.
- Edit agent name, description, model, temperature, max output tokens.
- Edit `instructions.md` in Monaco with autosave and `⌘S`.
- Canvas: agent, subagents, tools and skills as nodes coloured by kind; click a
  node to edit the file behind it; drag a palette chip to create a tool or
  subagent; drag nodes and keep their positions; drag an edge to move a tool or
  skill between the agent and a subagent.
- Overview: canvas preview, agent summary, capabilities, launch checklist.
- Create and delete tools, subagents and skills.
- Import a skill from a GitHub directory, including subdirectories, behind a
  review step that flags files which can run code.
- Files workbench over every project file, including files added by hand, with
  an explorer tree, file icons and keyboard navigation.
- Sidebar with project switcher, `⌘K` command palette, resizable panes that
  persist, live config validation in the header, light and dark.
- Import an Eve project from GitHub after reviewing it; connect or create a
  repository; see changes with a diff; commit (which pushes); pull with
  conflict detection; sync status in the header. Token mode.

### 3.4 What does not exist

- **Sign-in.** `packages/auth` is configured but not wired. Single user, no
  ownership checks, no session.
- **MCP import.** Blocked on Decision 6.
- **skills.sh import.** Blocked on not knowing their source format.
- **Connections and channels.** Stub pages.
- **Runs.** Blocked on Decision 2.
- **Deployment.** Follows GitHub.
- **GitHub App installation flow.** The App client exists, but installing the
  App per user needs sign-in (Phase 0.5). Token mode covers local use.

### 3.5 Known TODOs where Eve's API is assumed

Three places guess at Eve names and are marked `TODO` in code. They only affect
files EveLab creates from scratch; everything else works off the user's source.
**Verify each against current Eve docs before relying on it.**

1. `renderAgentTemplate` in `packages/eve-project/src/generate.ts`: the
   `new Agent({ ... })` shape and `import { Agent } from "eve"`.
2. `toolTemplate` in `apps/web/src/lib/actions.ts`: the `tool({ ... })` factory
   and its option names.
3. Subagent frontmatter keys in `packages/eve-project/src/parse.ts`: `name`,
   `description`, `model`, `tools`, `skills`.

---

## 4. Working in this repo

```bash
pnpm install
pnpm --filter @evelab/web dev          # http://localhost:3000
pnpm test                              # unit tests, all packages
pnpm typecheck                         # all packages
cd apps/web && CHROMIUM_PATH=/usr/bin/chromium pnpm e2e   # browser tests
```

Environment (all optional; with none set EveLab runs as a local single-user tool):

| Variable | Effect |
| --- | --- |
| `EVELAB_WORKSPACE` | Where projects are stored |
| `AI_GATEWAY_API_KEY` | Live model discovery instead of the fallback list |
| `GITHUB_TOKEN` | Source control (import, commit, pull) and a higher rate limit for skill import |
| `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_INSTALLATION_ID` | Source control through a GitHub App; takes precedence over the token |
| `GITHUB_API_URL` | GitHub API base URL; the e2e suite points it at a mock |
| `DATABASE_URL` | Enables `packages/db` |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET` | Enables sign-in |

### Conventions

- Comments explain **why**, not what. Match the density of the surrounding code.
- Prose in the UI is plain and specific. State what a control writes to disk.
  Stub pages say what is missing and why, rather than showing placeholder data.
- No `any`. `strict` is on everywhere.
- CSS lives in `src/app`: `globals.css` (tokens, entrance animation), `ui.css`
  (shared components), and one file per surface (`shell.css`, `canvas.css`,
  `explorer.css`, `overview.css`) imported by the component that owns it. No
  Tailwind, no CSS-in-JS. Use the
  existing custom properties; do not introduce new raw colours or sizes.
- Monochrome first, after Vercel's design language. Colour only where it carries
  meaning: status, destructive, and capability kind (`--kind-*`).
- No gradients, and no em dashes in UI copy, docs or commit messages.
- Motion follows frequency: keyboard-summoned UI does not animate; panels and
  dialogs use `--ease-out` with faster exits; only `transform` and `opacity`.
- Destructive actions confirm.

### Gotchas

- **Stop `pnpm dev` and `pnpm start` before `pnpm build`.** A running server
  holds `.next` open and the build fails with `PageNotFoundError` or a missing
  `.next/types/app/layout.ts`. Recover with
  `rm -rf apps/web/.next apps/web/*.tsbuildinfo`.
- Workspace packages are TypeScript source with ESM-style `.js` specifiers.
  `next.config.ts` adds a webpack `extensionAlias` so this resolves; keep it.
- `server-only` throws under Vitest. `apps/web/vitest.config.ts` aliases it to a
  stub.
- Monaco drops characters from fast `keyboard.type` in Playwright. Use
  `keyboard.insertText`.
- Server actions invoked as plain form POSTs need multipart bodies; that is how
  the e2e suite and any manual `curl` testing must send them.

---

## 5. Open decisions that gate work

### Decision 2: Where does the Eve runtime execute during development?

**Gates Phase 8 (Runs) and the run half of the launch demo.** Options:

- **A. In-process on the Next.js server.** Simplest; couples agent execution to
  the web server, and arbitrary project code would run inside EveLab's process.
- **B. A dedicated worker or container per run.** Isolated, matches the security
  boundary EveLab needs, more infrastructure.
- **C. A remote development runtime** that Eve provides. Best if it exists.
- **D. Trigger a deployed preview environment and stream its events.** No local
  runtime at all; slower loop.

Recommendation: **B** for a hosted product, **A only behind an explicit opt-in
flag for local self-hosting**. Confirm against Eve's actual runtime and
deployment model before building either. EveLab drives Eve; it does not
re-implement it.

### Decision 6: How does Eve represent MCP servers?

**Gates the MCP importer.** Find out whether MCP servers are Eve-native
configuration files, entries inside `agent.ts`, or something else, and preserve
that representation exactly. Do not design an EveLab format.

### Decision 11: Secrets

Prefer delegated credentials (Vercel Connect, environment secrets). If a phase
seems to need EveLab to hold a provider secret, re-read the requirement first.

---

## 6. Phases

Ordered by recommended execution. Phase numbers match the original spec.

### Phase 7: GitHub (done in token mode)

**Status.** Shipped: `packages/github`, import with review, connect, create and
publish, status in the header, diff view, commit (created on GitHub, so it is
also the push), pull with all-or-nothing conflict detection, discard, and
disconnect. Unit tests cover status, names, tree mapping and commit bodies; the
e2e suite runs the whole journey against a mock GitHub. Reads were also checked
against real GitHub.

Deferred: the per-user GitHub App installation flow (needs Phase 0.5), storing
the sync record in `git_repositories` (needs the database), repository lists
beyond the first 100, nested `.gitignore` files, projects in a repository
subdirectory, and switching branches after connecting.

**Why first:** unblocked, completes the "your project is yours" promise, and
unlocks Phase 9. Importing an existing Eve repository is a §47 requirement and
lands here.

**Goal:** connect a repository, import an existing Eve project, and commit, push
and pull changes.

**Design**

- Use a **GitHub App** plus Octokit, server-side only. The App private key must
  never reach the browser. Store the installation id, not tokens.
- Auth: this phase needs a user identity to attach installations to, so do
  **Phase 0.5 (sign-in) first or alongside it**. For a purely local
  single-user mode, a personal access token in the environment is an acceptable
  interim path, but keep the App path as the real one.
- Commits are **explicit**, never automatic (Decision 8). Local edits autosave to
  disk; committing is a deliberate action.
- Default branch only for now. Branch selection comes later.
- Import path: clone or read the tree through the API, run `parseProject`, run
  `validateProject`, and show the user any warnings before the project appears.
  Reuse the round-trip guarantee; do not write a second parser.

**New package:** `packages/github`

```ts
getInstallationOctokit(installationId: string)
listRepositories(installationId: string)
createRepository(installationId: string, name: string, isPrivate: boolean)
readRepositoryTree(repo, ref): Promise<ProjectFile[]>
commitFiles(repo, branch, message, files, baseSha): Promise<{ sha: string }>
getStatus(repo, branch, localFiles): Promise<GitStatus>
```

`GitStatus` should answer the three questions the UI needs: which files differ
from the last synced commit, how many local changes are unpushed, and whether
the remote has moved.

**Files to touch**

- `packages/github/*`: new.
- `packages/db/src/schema.ts`: `gitRepositories` already exists; use it.
- `apps/web/src/lib/git.ts`: server-side bridge between the workspace and the
  GitHub package.
- `apps/web/src/lib/actions.ts`: `connectRepositoryAction`,
  `importRepositoryAction`, `commitAction`, `pushAction`, `pullAction`.
- `apps/web/src/app/projects/[id]/settings/page.tsx`: repository connection UI.
- `apps/web/src/app/projects/new/page.tsx`: add "Import from GitHub".
- `apps/web/src/app/projects/[id]/layout.tsx`: Git status in the header
  (`● Synced`, `● Modified`, `↑ 2 to push`, `↓ 1 remote change`).
- A diff view: reuse Monaco's diff editor in `components/editor.tsx`.

**Security**

- Validate every repository full name against `owner/name` before use.
- Treat the repository tree as untrusted: enforce the same path rules as
  `isSafeRelativePath`, refuse symlinks and submodules, and bound file count and
  total size on import.
- Never write outside the project directory. Reuse `resolveInProject`.
- Do not execute anything from an imported repository.

**Acceptance**

- Connect an existing repository, import it, and the parsed project matches what
  is on GitHub, with warnings surfaced for anything EveLab could not read.
- Edit a file in EveLab, see the top bar go to `Modified`, commit with a
  message, push, and the commit appears on GitHub with only the expected diff.
- Pull a change made on GitHub and see it in the Files workbench.
- Export: a project with no repository can create one and push.

**Tests**

- Unit: `GitStatus` computation, path and name validation, tree to
  `ProjectFile[]` mapping (fixtures, no network).
- E2E: import a repository (mock the GitHub API at the network layer), edit,
  commit, and assert the request body contains exactly the changed files.

---

### Phase 0.5: Wire sign-in and the database (do this next)

**Why:** ownership, and a prerequisite for GitHub App installations and anything
hosted. `packages/auth` and `packages/db` are configured but inert.

**Design**

- Better Auth with the GitHub provider, Drizzle adapter, server-side only.
- Keep the local single-user path working: when `DATABASE_URL` and the GitHub
  OAuth variables are unset, the app must behave exactly as it does today.
  `isAuthEnabled()` already exists for this.
- When auth is enabled, every project route checks ownership. Projects gain a
  database row (`projects`, `project_members`) whose `slug` maps to the
  workspace directory.
- One user, many projects. No organisations (Decision 9).

**Files to touch**

- `apps/web/src/app/api/auth/[...all]/route.ts`: new, Better Auth handler.
- `apps/web/src/lib/session.ts`: `getSession`, `requireProjectAccess`.
- `apps/web/src/lib/actions.ts`: authorise every mutation.
- `apps/web/src/app/projects/*`: sign-in state in the shell, sign-in page.
- `packages/db`: generate and commit the first migration.

**Acceptance**

- With no environment configured: the app works as today, no sign-in UI.
- With it configured: GitHub sign-in works, a second account cannot see or
  mutate the first account's projects, and every server action rejects
  unauthorised calls (verified by calling one directly, not just via the UI).

**Tests**

- Unit: `requireProjectAccess` allows owner, rejects everyone else.
- E2E: sign-in redirect, and a project page 404s for a signed-out user when auth
  is enabled.

---

### Phase 3b: MCP import

**Blocked on Decision 6.** Do the research before writing code.

**Design once unblocked**

- Flow: enter server URL and config, connect, discover capabilities, list tools,
  select, install into the project **in Eve's own representation**.
- Model MCP servers in `EveProject` only after the file representation is known.
  Add a `mcp-agent` fixture and a round-trip test first, then build the UI.
- Treat all MCP metadata as untrusted: tool names, descriptions and schemas are
  attacker-controlled strings. Validate with Zod, and never render them as
  anything but text.
- Credentials go to environment or a secret store, not into project files.

**Acceptance**

- Import a real MCP server, select a subset of tools, and the resulting files
  are byte-identical to what a hand-written Eve project would contain.
- Round-trip test over the new fixture passes.
- The canvas shows MCP tools with `origin: "mcp"`.

---

### Phase 6: Connections and channels

**Goal:** connecting an external service feels native, without EveLab becoming
an OAuth platform.

**Design**

- Use **Vercel Connect** as the connection infrastructure. EveLab stores no raw
  provider credentials.
- Connections page: connected list with status and account, available list with
  search, detail view with capabilities and a disconnect action.
- Channels page: enable and configure the channels Eve supports, writing to
  `channels/` in Eve's representation. Confirm that representation first, the
  same way as MCP.
- Do not build a generic event or workflow engine on this page.

**Files to touch**

- `packages/eve-project/src/types.ts`: add `channels` to the model, plus a
  fixture and round-trip test, before any UI.
- `apps/web/src/app/projects/[id]/connections/page.tsx`,
  `channels/page.tsx`: replace the stubs.
- `apps/web/src/lib/connect.ts`: server-side Vercel Connect calls.

**Acceptance**

- Connect a service, see accurate status, disconnect it.
- Configure a channel and the generated files match a hand-written project.
- No provider secret is ever written to the workspace or the database.

---

### Phase 8: Runs

**Blocked on Decision 2.** Answer it first.

**Goal:** run an agent and understand what happened, from the same interface
that built it.

**Design**

- EveLab **drives Eve**. No re-implementation of the agent loop, and no second
  runtime built on the AI SDK.
- Run lifecycle: create a `runs` row, start execution on the chosen target,
  stream events, persist a timeline, record the final result or error.
- Timeline events: user message, agent started, tool call, subagent invocation,
  tool result, final response, error. Each event needs input, output, duration
  and metadata.
- Stream to the UI with Server-Sent Events or a readable stream; do not poll.
- Prefer Eve's and Vercel's own observability output over inventing telemetry.
  EveLab is the presentation layer.

**Files to touch**

- `packages/eve-runtime/*`: new; the adapter to whichever target Decision 2
  picks. Keep it thin and swappable.
- `apps/web/src/app/projects/[id]/runs/page.tsx`: list.
- `apps/web/src/app/projects/[id]/runs/[runId]/page.tsx`: timeline, event
  inspector.
- `apps/web/src/lib/actions.ts`: `startRunAction`, `cancelRunAction`.
- `packages/db/src/schema.ts`: `runs` exists; add `run_events` if the timeline
  needs persisting.
- Top bar `Run` button and `⌘Enter`.

**Security**

- Project code is untrusted. It must not execute inside EveLab's server process
  in the hosted product, and the execution target must not inherit EveLab's
  credentials or filesystem access.

**Acceptance**

- Start a run from the UI, watch the timeline populate live, and open an event
  to see its input, output and duration.
- A failing run shows the error and does not leave a run stuck as `Running`.
- Cancelling a run stops it.

**Tests**

- Unit: event normalisation from runtime output to timeline model.
- E2E: start a run against a stub runtime and assert the timeline renders and
  the final result appears.

---

### Phase 9: Deployment

**Depends on Phase 7**, since deploying means deploying a commit.

**Design**

- Deploy the Eve project the same way any Eve project deploys. Do not invent a
  deployment abstraction.
- Show environment, status, deployment id, commit, date, URL and a logs link.
- Rollback and preview promotion come later.

**Files to touch**

- `apps/web/src/app/projects/[id]/deployments/page.tsx`.
- `apps/web/src/lib/deploy.ts`.
- `packages/db/src/schema.ts`: `deployments` exists.

**Acceptance**

- Deploy from the UI, see status change, open the deployed agent, and confirm
  the deployment references the expected commit.
- Deployment credentials are server-side only.

---

### Phase 4b: skills.sh import

Small, once their source format is known. Reuse the existing review step; only
the fetch layer differs. Keep `parseGitHubUrl` and `fetchSkillCandidate` as the
model: validate the host, bound the fetch, flag executable files, confirm before
writing.

---

### Phase 10: Polish for the public demo

The launch sequence from the spec, end to end, on one agent:

```text
create project → select model → write instructions → import skill → add MCP
→ create subagent on the canvas → connect GitHub → run → inspect the run
→ open the generated Eve project → deploy
```

Work needed beyond the phases above:

- Keyboard shortcuts audit: `⌘K`, `⌘S`, `⌘P` quick open, `⌘Enter` run.
- Empty states for every new surface.
- A Playwright journey covering the whole sequence.
- Accessibility pass: landmarks, focus order, labels, contrast in both themes.
- README and screenshots for the public repo.

---

## 7. Definition of done (spec §47)

| # | Step | State |
| --- | --- | --- |
| 1 | Sign in with GitHub | Phase 0.5 |
| 2 | Create project | Done |
| 3 | Choose gateway, provider, model | Done |
| 4 | Write `instructions.md` | Done |
| 5 | Add a TypeScript tool | Done |
| 6 | Import an MCP server | Phase 3b |
| 7 | Import a skill | Done (GitHub) |
| 8 | Create a subagent | Done |
| 9 | Connect a Vercel Connect service | Phase 6 |
| 10 | Configure a channel | Phase 6 |
| 11 | Run the agent | Phase 8 |
| 12 | Inspect the run timeline | Phase 8 |
| 13 | Open the generated Eve files | Done |
| 14 | Commit to GitHub | Done (token mode) |
| 15 | Deploy | Phase 9 |
| 16 | Verify the deployed agent works | Phase 9 |

Plus: **import an existing Eve repository**: done.

---

## 8. Definition of done for any single phase

Before calling a phase finished:

1. `pnpm typecheck` and `pnpm test` pass.
2. New Eve file representations have a fixture and a byte-for-byte round-trip
   test **before** any UI is built on them.
3. Every new mutation validates its input with Zod and authorises the caller.
4. Every new surface has an empty state, a loading path and an error path.
5. The pages work with JavaScript disabled as far as reading goes, and in light
   and dark.
6. At least one Playwright test covers the phase's main flow.
7. A production build succeeds.
8. `README.md` and `docs/decisions.md` are updated: what now works, what is
   still missing, and any decision that was settled.

---

## 9. What not to do

- Do not invent Eve APIs or configuration formats. Research first.
- Do not build a second agent runtime, including on the AI SDK.
- Do not store project files as database JSON.
- Do not add a marketplace, gallery, collaboration, teams, comments, or
  multiplayer editing. They are explicitly deferred.
- Do not create packages before the boundary is real.
- Do not regenerate a file when a targeted patch will do.
- Do not add a decorative animation, gradient, or card to make a page feel
  finished. If a page feels thin, the content or hierarchy is wrong.
