import type { z } from "zod";
import { GitHubError, type GitHubClient } from "../src/index.js";

export interface Call {
  route: string;
  params: Record<string, unknown>;
}

type Handler = (params: Record<string, unknown>) => unknown;

/** A GitHub API stand-in keyed by "METHOD /path". Unknown routes are a 404, like the real thing. */
export function fakeClient(routes: Record<string, Handler>, auth: "token" | "app" = "token") {
  const calls: Call[] = [];
  const client: GitHubClient = {
    auth,
    async request<T>(route: string, params: Record<string, unknown>, schema: z.ZodType<T>): Promise<T> {
      calls.push({ route, params });
      const handler = routes[route];
      if (!handler) throw new GitHubError(`No route for ${route}`, 404);
      const result = handler(params);
      if (result instanceof GitHubError) throw result;
      return schema.parse(result);
    },
  };
  return { client, calls };
}

export function sha(seed: string): string {
  return seed.repeat(40).slice(0, 40);
}

export function base64(text: string): string {
  return Buffer.from(text, "utf8").toString("base64");
}
