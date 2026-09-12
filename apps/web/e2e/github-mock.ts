import { createHash } from "node:crypto";
import { createServer, type IncomingMessage, type Server } from "node:http";

/**
 * Just enough of GitHub's REST and Git database API, in memory, for the source
 * control journey. The web server is pointed at it with GITHUB_API_URL, so
 * requests are intercepted at the network layer, not inside the app.
 */

interface Entry {
  mode: string;
  sha: string;
}

interface Repository {
  fullName: string;
  defaultBranch: string;
  private: boolean;
}

export interface LoggedRequest {
  method: string;
  path: string;
  body: Record<string, unknown>;
}

const sha1 = (value: string) => createHash("sha1").update(value).digest("hex");

export function gitBlobSha(content: string | Buffer): string {
  const body = typeof content === "string" ? Buffer.from(content, "utf8") : content;
  return createHash("sha1").update(`blob ${body.length}\0`).update(body).digest("hex");
}

export class GitHubMock {
  readonly requests: LoggedRequest[] = [];
  private readonly blobs = new Map<string, Buffer>();
  private readonly trees = new Map<string, Record<string, Entry>>();
  private readonly commits = new Map<string, { tree: string; parents: string[] }>();
  private readonly refs = new Map<string, string>();
  private readonly repositories = new Map<string, Repository>();
  private server?: Server;

  addRepository(fullName: string, defaultBranch = "main"): void {
    this.repositories.set(fullName, { fullName, defaultBranch, private: true });
  }

  /** Commits files straight to a branch, the way a teammate pushing to GitHub would. */
  push(fullName: string, branch: string, files: Record<string, string | Buffer>, message = "Remote change"): string {
    const tree: Record<string, Entry> = {};
    for (const [path, content] of Object.entries(files)) {
      tree[path] = { mode: "100644", sha: this.storeBlob(content) };
    }
    const parent = this.refs.get(`${fullName}#${branch}`);
    const commit = this.storeCommit(this.storeTree(tree), parent ? [parent] : [], message);
    this.refs.set(`${fullName}#${branch}`, commit);
    return commit;
  }

  /** Commits changes on top of the branch, keeping every other file. `null` deletes. */
  commitChanges(fullName: string, branch: string, changes: Record<string, string | null>, message = "Remote change"): string {
    const parent = this.refs.get(`${fullName}#${branch}`);
    const tree = parent ? { ...this.trees.get(this.commits.get(parent)!.tree)! } : {};
    for (const [path, content] of Object.entries(changes)) {
      if (content === null) delete tree[path];
      else tree[path] = { mode: tree[path]?.mode ?? "100644", sha: this.storeBlob(content) };
    }
    const commit = this.storeCommit(this.storeTree(tree), parent ? [parent] : [], message);
    this.refs.set(`${fullName}#${branch}`, commit);
    return commit;
  }

  fileAt(fullName: string, branch: string, path: string): string | undefined {
    const head = this.refs.get(`${fullName}#${branch}`);
    const entry = head ? this.trees.get(this.commits.get(head)!.tree)![path] : undefined;
    return entry ? this.blobs.get(entry.sha)!.toString("utf8") : undefined;
  }

  pathsAt(fullName: string, branch: string): string[] {
    const head = this.refs.get(`${fullName}#${branch}`);
    return head ? Object.keys(this.trees.get(this.commits.get(head)!.tree)!).sort() : [];
  }

  async start(port: number): Promise<void> {
    this.server = createServer(async (request, response) => {
      const body = await readBody(request);
      const url = new URL(request.url ?? "/", "http://localhost");
      const method = request.method ?? "GET";
      this.requests.push({ method, path: url.pathname, body });
      const { status, json } = this.handle(method, url, body);
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify(json));
    });
    await new Promise<void>((resolve) => this.server!.listen(port, "127.0.0.1", resolve));
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) => (this.server ? this.server.close(() => resolve()) : resolve()));
  }

  private storeBlob(content: string | Buffer): string {
    const buffer = typeof content === "string" ? Buffer.from(content, "utf8") : content;
    const sha = gitBlobSha(buffer);
    this.blobs.set(sha, buffer);
    return sha;
  }

  private storeTree(tree: Record<string, Entry>): string {
    const sha = sha1(JSON.stringify(Object.entries(tree).sort()));
    this.trees.set(sha, tree);
    return sha;
  }

  private storeCommit(tree: string, parents: string[], message: string): string {
    const sha = sha1(JSON.stringify({ tree, parents, message, at: this.commits.size }));
    this.commits.set(sha, { tree, parents });
    return sha;
  }

  private repositoryJson(repository: Repository) {
    return {
      full_name: repository.fullName,
      default_branch: repository.defaultBranch,
      private: repository.private,
      html_url: `https://github.com/${repository.fullName}`,
      permissions: { push: true },
    };
  }

  private handle(method: string, url: URL, body: Record<string, unknown>): { status: number; json: unknown } {
    const segments = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    const notFound = { status: 404, json: { message: "Not Found" } };

    if (method === "GET" && url.pathname === "/user/repos") {
      return { status: 200, json: [...this.repositories.values()].map((repo) => this.repositoryJson(repo)) };
    }
    if (method === "POST" && url.pathname === "/user/repos") {
      const fullName = `e2e-user/${String(body.name)}`;
      this.addRepository(fullName);
      return { status: 201, json: this.repositoryJson(this.repositories.get(fullName)!) };
    }
    if (segments[0] !== "repos" || segments.length < 3) return notFound;

    const fullName = `${segments[1]}/${segments[2]}`;
    const repository = this.repositories.get(fullName);
    if (!repository) return notFound;
    const rest = segments.slice(3);

    if (rest.length === 0 && method === "GET") return { status: 200, json: this.repositoryJson(repository) };

    if (rest[0] === "git" && (rest[1] === "ref" || rest[1] === "refs") && rest[2] === "heads") {
      const branch = rest.slice(3).join("/");
      const key = `${fullName}#${branch}`;
      if (method === "GET") {
        const head = this.refs.get(key);
        if (head) return { status: 200, json: { object: { sha: head } } };
        const empty = ![...this.refs.keys()].some((ref) => ref.startsWith(`${fullName}#`));
        return empty ? { status: 409, json: { message: "Git Repository is empty." } } : notFound;
      }
      if (method === "PATCH") {
        const next = String(body.sha);
        const current = this.refs.get(key);
        if (!body.force && current && !this.commits.get(next)?.parents.includes(current)) {
          return { status: 422, json: { message: "Update is not a fast forward" } };
        }
        this.refs.set(key, next);
        return { status: 200, json: { object: { sha: next } } };
      }
    }

    if (rest[0] === "git" && rest[1] === "commits") {
      if (method === "GET") {
        const commit = this.commits.get(rest[2] ?? "");
        return commit ? { status: 200, json: { sha: rest[2], tree: { sha: commit.tree } } } : notFound;
      }
      if (method === "POST") {
        const sha = this.storeCommit(String(body.tree), body.parents as string[], String(body.message));
        return { status: 201, json: { sha } };
      }
    }

    if (rest[0] === "git" && rest[1] === "trees") {
      if (method === "GET") {
        const tree = this.trees.get(rest[2] ?? "");
        if (!tree) return notFound;
        return {
          status: 200,
          json: {
            sha: rest[2],
            truncated: false,
            tree: Object.entries(tree).map(([path, entry]) => ({
              path,
              mode: entry.mode,
              type: "blob",
              sha: entry.sha,
              size: this.blobs.get(entry.sha)!.length,
            })),
          },
        };
      }
      if (method === "POST") {
        const base = typeof body.base_tree === "string" ? { ...this.trees.get(body.base_tree) } : {};
        for (const item of body.tree as { path: string; mode: string; sha?: string | null; content?: string }[]) {
          if (item.sha === null) delete base[item.path];
          else if (typeof item.content === "string") base[item.path] = { mode: item.mode, sha: this.storeBlob(item.content) };
          else if (item.sha) base[item.path] = { mode: item.mode, sha: item.sha };
        }
        return { status: 201, json: { sha: this.storeTree(base) } };
      }
    }

    if (method === "GET" && rest[0] === "git" && rest[1] === "blobs") {
      const blob = this.blobs.get(rest[2] ?? "");
      return blob
        ? { status: 200, json: { content: blob.toString("base64"), encoding: "base64", size: blob.length } }
        : notFound;
    }

    if (method === "PUT" && rest[0] === "contents") {
      const branch = String(body.branch ?? repository.defaultBranch);
      const content = Buffer.from(String(body.content), "base64");
      const commit = this.push(fullName, branch, { [rest.slice(1).join("/")]: content }, String(body.message));
      return { status: 201, json: { commit: { sha: commit } } };
    }

    return notFound;
  }
}

async function readBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}
