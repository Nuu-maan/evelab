# Decisions

## Settled

**Source of truth.** Files on disk are canonical. EveLab parses them into a
project model, edits the model, and writes files back. Postgres holds metadata
only: users, projects, repositories, deployments, runs.

**Round trip before features.** `packages/eve-project` proves
parse -> model -> generate returns the original bytes for files EveLab owns, and
passes through every file it does not. Features are built on top of that, not
around it.

**GUI edits patch source, they do not regenerate it.** `agent.ts` is edited by
replacing the value ranges that changed, located through the TypeScript AST.
Imports, comments, helper code, and any Eve option EveLab has no control for
survive untouched. An unparseable `agent.ts` is never overwritten.

**Unmodelled configuration is preserved, not hidden.** Config keys EveLab has no
GUI for appear on the Runtime tab as read-only source text and are re-emitted
verbatim. That is why the Runtime tab has no controls yet: an option gets a
control once its Eve representation is confirmed, not because it exists.

**GitHub is optional.** A project exists first and can gain a repository later.
Project identity is not a repository.

**Explicit commits.** Local edits autosave; Git commits are deliberate and need a
message.

**The canvas edits files, not a model of files.** Selecting a node opens the
file that defines it. There is no canvas-only representation of a skill or a
tool that could drift from its source. Node positions are EveLab presentation
state and live outside the project directory, so losing them costs a re-layout
and nothing else.

**Imported skills are reviewed before they are installed.** Import reads the
source, lists every file including subdirectories, flags files that can run
code, and writes nothing until the user confirms. Only `github.com` over https
is accepted; symlinks and submodules are refused; depth, file count and total
size are bounded; and any path that is not a plain relative path is rejected
rather than rewritten.

**Entrance animation is CSS, interaction motion is JavaScript.** Content must
never depend on hydration to become visible, so page entrances are CSS
animations that degrade to a visible element. motion/react is used only where
motion responds to interaction: the inspector, dialogs, and indicators that move
between items. All of it respects reduced-motion.

**EveLab reads Eve's real layout, checked against eve 0.54.3.** An agent is
`agent/` (or the same slots at the package root): `agent.ts` with
`defineAgent`, `instructions.md`, and one file per entity under `tools/`,
`skills/`, `subagents/<name>/`, `connections/`, `channels/` and `schedules/`.
Names come from file paths, and the root agent's name from `package.json`.
New projects get exactly what `eve init` writes, and new files use the shapes
from Eve's docs (`defineTool`, `defineMcpClientConnection`,
`defineOpenAPIConnection`, markdown schedules). MCP servers and OpenAPI services
are connection files, so there is no separate EveLab format for them.

**Canvas edges are ownership, and ownership is a directory.** A declared
subagent inherits nothing from its parent: it has only what lives in its own
`subagents/<name>/` directory. Dragging an edge onto a subagent moves the tool,
skill or connection file into that directory, and dropping it on empty canvas
moves it back to the agent. A file that imports others by relative path is
refused, because moving it would break the import. The rule lives in
`applyOwnershipChange` in `packages/eve-project` and is covered by tests.

**Pane widths are presentation state in cookies.** The server reads them so the
layout renders at the user's width without a jump, and clamps them because the
client writes them. They never enter the project or the database.

**Motion follows frequency.** Things summoned from the keyboard many times a
day, like the command palette, open instantly. Panels, dialogs and menus use
short ease-out transitions with faster exits. Only `transform` and `opacity`
animate, and `MotionConfig` honours reduced motion for everything in
motion/react.

**Styles live next to the surface that owns them.** `globals.css` holds tokens
and `ui.css` shared components; `shell.css`, `canvas.css`, `explorer.css` and
`overview.css` are imported by the component or page they style.

**Commits are created on GitHub, so committing is pushing.** EveLab has no local
object store. It builds each commit with GitHub's Git database API on top of the
last synced commit and fast-forwards the branch, refusing when GitHub has moved.
There is no separate push step and no local commit that could go stale.

**The sync record lives outside the project.** `<workspace>/../git/<id>.json`
holds the repository, branch, last synced commit and the text of the files in
it. Status is a comparison of blob ids against it, the diff view reads it, and a
pull merges against it. It moves to `git_repositories` once the database is
wired; only the installation id is ever stored, never a token.

**Pulls merge per file, all or nothing.** A file GitHub changed is taken when
the local copy is untouched; a file changed on both sides is a conflict, and any
conflict means nothing is written. There is no line-level merge to get wrong.

**What never crosses.** `.env` files are never imported or committed, whatever
`.gitignore` says. Symlinks, submodules, binaries and oversized files are not
imported, and commits leave them untouched on GitHub. Repository paths go
through the same traversal checks as every other write.

**A personal access token is the local interim.** With no sign-in, `GITHUB_TOKEN`
authenticates source control. The GitHub App path (`getInstallationClient`) is in
`packages/github` and takes precedence when configured, but installing the App
per user waits for sign-in.

**shadcn/ui on the Geist tokens.** Controls, dialogs, menus and forms come from
shadcn/ui so they share one accessible, keyboard-complete implementation. Its
roles (`--primary`, `--muted`, `--border` and the rest) are aliases of the Geist
tokens rather than a second palette, and hand-written surface CSS lives in
`@layer components` so utilities never lose a specificity fight to it.

**Canvas edges show where to grab.** Ownership edges are soft curves that stay a
quiet hairline at rest; hover or selection colours them with the capability's
kind and runs a slow flow from owner to capability. A movable edge shows a dot at
each end on hover, sitting over React Flow's reconnect anchor, and handles grow a
ring rather than scaling, because a scaled handle covers the anchor and turns a
drag meant for the edge into a new connection.

**Sign-in is all or nothing.** Better Auth with GitHub turns on only when
`DATABASE_URL`, the OAuth client id and secret, and `BETTER_AUTH_SECRET` are all
set. Anything less is local mode, where every check is a no-op and the app
behaves exactly as it did before sign-in existed.

**The database says who owns a directory, not what is in it.** A project row
maps a workspace directory (its slug) to an owner through `project_members`.
Directories on disk with no row, such as projects created before sign-in was
turned on, are invisible when sign-in is on.

**A project you cannot open does not exist.** Project pages answer 404 to
signed-out visitors and to other accounts alike, and server actions throw the
same "Project not found." Every action checks access itself, after validating
its input and before touching the project, because a server action can be
called without the page that renders it.

**Single user.** One user, many projects. `project_members` exists in the schema
so sharing can be added without rewriting ownership.

**Secrets stay delegated.** EveLab does not store provider credentials. GitHub
App private keys and OAuth secrets are read server-side only.

**Runs drive `eve dev`, deployments drive `eve deploy`.** EveLab never runs an
agent loop of its own. In local mode the Runs page starts `eve dev --no-ui` in the
project directory and talks to Eve's HTTP session API, proxying the NDJSON stream
to the browser and recording every event by `meta.id` beside the workspace. The
child gets a scrubbed environment: EveLab's GitHub token, database URL and auth
secret are never passed. A multi-user EveLab (sign-in on) refuses to run project
code on its own server unless `EVELAB_ALLOW_LOCAL_RUNTIME=1`; there, agents run
on Vercel, where Workflow, Sandbox and Cron isolate them. Deploying is
`eve deploy --non-interactive --yes --project`, with the server's `VERCEL_TOKEN`.

**Deploy configuration is EveLab state; the project stays pure Eve.** The Vercel
project name, team and deployment history live in
`<workspace>/../deployments/<id>.json`. `eve deploy` may write `.vercel/` inside
the project, which the Files view ignores and `.gitignore` excludes, as it does
for any Eve project.

**skills.sh is read through its registry.** A skills.sh reference resolves to the
same registry item `eve add @skills/...` installs, with every file inline. It
passes the same path, size and executable checks as a GitHub import.

**Vercel first, with a fallback for everything.** Each backend concern uses the
Vercel product built for it: Sandbox for running agents, AI Gateway through the
AI SDK for the assistant, Blob for EveLab's own state, Connect for credentials,
Chat SDK for channels eve has no native route for, and Observability for deployed
agents. `lib/vercel-platform.ts` reads the environment and the Settings page says
what is on. Nothing is required: without credentials EveLab runs agents locally,
stores state beside the workspace, and the assistant explains how to connect.

**The dev runtime prefers a sandbox.** With Sandbox credentials, Start creates a
microVM, uploads the project, installs dependencies there and runs `eve dev` on
the sandbox's own domain. Saves are pushed into the running sandbox through a
project change event. Only without credentials does a local EveLab run `eve dev`
as a child process, and a shared EveLab refuses that unless opted in.

**The assistant edits through the same operations as the UI.** Creating a tool,
subagent, connection or schedule goes through `lib/project-ops.ts` whether a
person or the assistant asks, so the files are identical either way. The
assistant has no general file-write tool.

**Canvas drag is pointer-driven.** A palette chip is carried by a spring-driven
copy that leans into horizontal movement, settles on drop and flies back on a
miss. Native drag and drop cannot tilt or animate its drag image.

**Shared resources live in `lib/`, and agents re-export them.** Eve gives a
subagent nothing from its parent and shares code through `lib/`. A tool, skill or
connection used by several agents is defined once in `agent/lib/<kind>/<name>.ts`,
and each agent that uses it gets a one-line `export { default } from
"#lib/<kind>/<name>.ts"` in its own slot, or a relative path when package.json has
no `#*` import map. Markdown and packaged skills become `defineSkill` modules when
they are first shared, because only a module can be re-exported. Detaching never
deletes a definition. `attachResource` and `detachResource` in
`packages/eve-project` hold the rule, and the canvas draws each shared resource
once, with an edge from every agent that uses it. This shape was compiled against
eve 0.54.3 with no diagnostics.

**Every subagent is written with a model.** Eve's compiler rejects a subagent
`agent.ts` without one, so a new subagent takes its own model, then the root
agent's, then eve init's default, and validation flags one that has none.

**The canvas is an architecture editor, not a workflow builder.** Three regions:
resources on the left, the graph in the middle, the selection on the right. Edges
are relationships ("has tool", "contains", "routes to"), and attaching is an
explicit action from a handle, a drop onto an agent, the Add menu or the
inspector. Layout is dagre, with positions, layout mode and folded agents stored
as presentation state beside the workspace. Undo covers moves, attaches and
detaches; deleting files always asks first.

**New projects ask what eve init asks.** Provider first (AI Gateway via project,
AI Gateway key, ChatGPT subscription, or a provider's own SDK), then a searchable
model list with eve init's recommended models first, then reasoning effort. The
agent.ts written for each answer matches eve init's, and EveLab still never
stores a key.

**Chat SDK is the default way to add a channel.** Slack, Discord, Teams, GitHub,
Linear, WhatsApp, Google Chat and Telegram all go through eve's `chatSdkChannel`
with a Chat SDK adapter, credentials read from the environment. Eve's native
channels remain available beside them.

## Open

**skills.sh import.** skills.sh lists skills that live in GitHub repositories,
and `eve add @skills/<owner>/<repo>/<skill>` installs them from there, so the
GitHub import already reads them. A search over the registry is not built.

**Skill import review.** Planned as: show source, list every file, warn about
executable content, confirm, then install. Importing code is not executing it,
and it is not the same as trusting it either.
