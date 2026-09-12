import { Octokit } from "@octokit/core";
import { createAppAuth } from "@octokit/auth-app";
import type { z } from "zod";

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "GitHubError";
  }
}

/** The branch moved on GitHub since the last sync. */
export class RemoteMovedError extends GitHubError {
  constructor() {
    super("GitHub has commits EveLab has not pulled. Pull first, then commit.", 409);
    this.name = "RemoteMovedError";
  }
}

export type GitHubAuth =
  | { kind: "token"; token: string }
  | { kind: "app"; appId: string; privateKey: string; installationId: string };

/**
 * A narrow request function. Every response is parsed with Zod before anything
 * reads it, and every failure becomes a GitHubError with a message fit to show.
 */
export interface GitHubClient {
  readonly auth: GitHubAuth["kind"];
  request<T>(route: string, params: Record<string, unknown>, schema: z.ZodType<T>): Promise<T>;
}

function describe(status: number | undefined): string {
  switch (status) {
    case undefined:
      return "Could not reach GitHub.";
    case 401:
      return "GitHub rejected the credentials.";
    case 403:
      return "GitHub refused the request. The token may lack access, or the rate limit was reached.";
    case 404:
      return "Not found on GitHub, or these credentials cannot see it.";
    case 409:
      return "The repository is empty.";
    case 422:
      return "GitHub rejected the change.";
    default:
      return `GitHub returned ${status}.`;
  }
}

function statusOf(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "status" in error) {
    const { status } = error as { status: unknown };
    return typeof status === "number" ? status : undefined;
  }
  return undefined;
}

/** Server-side only. Tokens and the App private key must never reach a browser. */
export function createGitHubClient(auth: GitHubAuth, options: { baseUrl?: string } = {}): GitHubClient {
  const baseUrl = options.baseUrl ?? "https://api.github.com";
  const octokit =
    auth.kind === "token"
      ? new Octokit({ auth: auth.token, baseUrl })
      : new Octokit({
          authStrategy: createAppAuth,
          auth: {
            appId: auth.appId,
            privateKey: auth.privateKey,
            installationId: Number(auth.installationId),
          },
          baseUrl,
        });

  return {
    auth: auth.kind,
    async request(route, params, schema) {
      let data: unknown;
      try {
        const response = await octokit.request(route, {
          ...params,
          headers: { "x-github-api-version": "2022-11-28" },
        });
        data = response.data;
      } catch (error) {
        throw new GitHubError(describe(statusOf(error)), statusOf(error));
      }
      const parsed = schema.safeParse(data);
      if (!parsed.success) throw new GitHubError("GitHub returned a response EveLab did not expect.");
      return parsed.data;
    },
  };
}

/**
 * Installation auth for the GitHub App: the App's private key signs a
 * short-lived installation token. Only the installation id is ever stored.
 */
export function getInstallationClient(
  installationId: string,
  env: Record<string, string | undefined> = process.env,
): GitHubClient {
  const appId = env.GITHUB_APP_ID;
  const privateKey = env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!appId || !privateKey) throw new GitHubError("The GitHub App is not configured.");
  return createGitHubClient(
    { kind: "app", appId, privateKey, installationId },
    { baseUrl: env.GITHUB_API_URL },
  );
}
