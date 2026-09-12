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

**Explicit commits.** Local edits autosave; Git commits will be deliberate.

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

**Canvas edges are ownership, and the agent's ownership is implicit.** A tool
or skill that no subagent lists in its frontmatter belongs to the main agent.
Dragging an edge onto a subagent adds the id to that subagent's `tools` or
`skills`; dropping it on empty canvas removes it; moving it to the agent clears
every subagent's claim. Nothing in `agent.ts` is touched. The rule lives in
`applyOwnershipChange` in `packages/eve-project`, next to the parser that
defines those keys, and is covered by round-trip tests.

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

**Single user.** One user, many projects. `project_members` exists in the schema
so sharing can be added without rewriting ownership.

**Secrets stay delegated.** EveLab does not store provider credentials. GitHub
App private keys and OAuth secrets are read server-side only.

## Open

**Where the Eve runtime executes during development.** Same server, dedicated
worker, remote development runtime, or a deployed environment. The Runs page is
empty until this is answered, because EveLab drives Eve rather than
re-implementing it. This blocks Runs, Traces and the run half of the demo.

**The exact Eve API surface.** Three places assume names that must be checked
against current Eve docs before they are relied on, each marked `TODO` in code:

- `renderAgentTemplate` in `packages/eve-project/src/generate.ts` (the
  `new Agent({...})` shape, used only for projects created from scratch).
- `toolTemplate` in `apps/web/src/lib/actions.ts` (the `tool({...})` factory).
- The subagent frontmatter keys in `packages/eve-project/src/parse.ts`.

Everything else works off the user's own source and does not depend on these
names being right.

**skills.sh import.** Only GitHub is supported today. The skills.sh source
format needs confirming before EveLab claims to read it.

**MCP representation.** Whether MCP servers are Eve-native configuration files
or another representation EveLab should preserve exactly. Import is not built
until this is known, so EveLab cannot invent a second format by accident.

**Skill import review.** Planned as: show source, list every file, warn about
executable content, confirm, then install. Importing code is not executing it,
and it is not the same as trusting it either.
