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

**Canvas edges show where to grab.** Ownership edges are rounded orthogonal
paths in the capability's colour. A movable edge shows a dot at each end on
hover, sitting over React Flow's reconnect anchor, and handles grow a ring
rather than scaling, because a scaled handle covers the anchor and turns a drag
meant for the edge into a new connection.

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

## Open

**Where the Eve runtime executes during development.** Same server, dedicated
worker, remote development runtime, or a deployed environment. The Runs page is
empty until this is answered, because EveLab drives Eve rather than
re-implementing it. This blocks Runs, Traces and the run half of the demo.

**skills.sh import.** skills.sh lists skills that live in GitHub repositories,
and `eve add @skills/<owner>/<repo>/<skill>` installs them from there, so the
GitHub import already reads them. A search over the registry is not built.

**Skill import review.** Planned as: show source, list every file, warn about
executable content, confirm, then install. Importing code is not executing it,
and it is not the same as trusting it either.
