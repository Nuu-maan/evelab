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

**MCP representation.** Whether MCP servers are Eve-native configuration files
or another representation EveLab should preserve exactly. Import is not built
until this is known, so EveLab cannot invent a second format by accident.

**Skill import review.** Planned as: show source, list every file, warn about
executable content, confirm, then install. Importing code is not executing it,
and it is not the same as trusting it either.
