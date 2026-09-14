/**
 * The agents listed on eve.dev/templates. `repository` is set only when the
 * template is its own GitHub repository, since import reads a whole repository
 * and cannot open a folder inside a monorepo. `source` links to the code either way.
 */
export interface EveTemplate {
  slug: string;
  name: string;
  summary: string;
  repository?: string;
  source?: string;
}

export const EVE_TEMPLATES: readonly EveTemplate[] = [
  {
    slug: "eve-sre-agent-template",
    name: "Incident response",
    summary: "Investigates alerts with Datadog, GitHub and Vercel evidence. Read only by default.",
    repository: "vercel-labs/eve-sre-agent-template",
  },
  {
    slug: "eve-software-factory-template",
    name: "Software factory",
    summary: "Turns GitHub and Linear tasks into reviewed draft pull requests.",
    repository: "vercel-labs/eve-software-factory-template",
  },
  {
    slug: "eve-design-template",
    name: "Design",
    summary: "A Slack helper that answers from your team's approved design guidance.",
    repository: "vercel-labs/eve-design-template",
  },
  {
    slug: "mux-video-agent",
    name: "Mux video",
    summary: "Creates and inspects Mux assets and clips, and asks before it changes anything.",
    repository: "muxinc/mux-video-agent",
  },
  {
    slug: "eve-chat-template",
    name: "Chat",
    summary: "A Next.js web chat with per-user memory, Better Auth, Drizzle and Neon.",
    source: "https://github.com/vercel/eve/tree/main/apps/templates/eve-chat-template",
  },
  {
    slug: "eve-llm-council-template",
    name: "LLM council",
    summary: "Asks four models at once, then a judge model sums up where they agree.",
    source: "https://github.com/vercel/eve/tree/main/apps/templates/eve-llm-council-template",
  },
  {
    slug: "weather-agent-fixture",
    name: "Weather",
    summary: "A small example with a typed tool and a markdown skill.",
    source: "https://github.com/vercel/eve/tree/main/apps/fixtures/weather-agent",
  },
  { slug: "eve-slack-agent", name: "Slack", summary: "A starter Slack agent with webhooks, Vercel Connect and an example tool." },
  { slug: "kody-eve-template", name: "GitHub maintainer", summary: "Emails a weekly issue digest, summarizes pull requests and works Linear issues." },
  { slug: "marketing-team-eve-template", name: "Marketing team", summary: "A lead agent routes work to content, social, SEO and email specialists." },
  { slug: "sanity-copilot-eve-template", name: "Sanity copilot", summary: "A Slack copilot that queries and edits Sanity content and schemas." },
  { slug: "typefully-eve-template", name: "Social media", summary: "Drafts posts and threads for X, LinkedIn, Threads, Bluesky and Mastodon through Typefully." },
];
