export interface FileTreeNode {
  /** Display name. Compacted directory chains read "apps/web". */
  name: string;
  /** Full project path. For a compacted chain, the path of its deepest directory. */
  path: string;
  kind: "directory" | "file";
  children: FileTreeNode[];
}

export interface FileTreeRow {
  node: FileTreeNode;
  depth: number;
}

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

function sortNodes(nodes: FileTreeNode[]): FileTreeNode[] {
  return nodes
    .sort((a, b) =>
      a.kind === b.kind ? collator.compare(a.name, b.name) : a.kind === "directory" ? -1 : 1,
    )
    .map((node) => ({ ...node, children: sortNodes(node.children) }));
}

/**
 * A directory whose only child is another directory collapses into one row, the
 * way editors show `apps/web`, so deep single-purpose paths do not cost a click
 * per level.
 */
function compact(node: FileTreeNode): FileTreeNode {
  let current = node;
  while (
    current.kind === "directory" &&
    current.children.length === 1 &&
    current.children[0]!.kind === "directory"
  ) {
    const only = current.children[0]!;
    current = { ...only, name: `${current.name}/${only.name}` };
  }
  return { ...current, children: current.children.map(compact) };
}

/** Directories first, then files, each in natural order. Folders with no files in them still appear. */
export function buildFileTree(paths: string[], folders: string[] = []): FileTreeNode[] {
  const root: FileTreeNode = { name: "", path: "", kind: "directory", children: [] };

  const add = (path: string, leaf: FileTreeNode["kind"]) => {
    const parts = path.split("/").filter(Boolean);
    let parent = root;
    parts.forEach((name, index) => {
      const kind = index === parts.length - 1 ? leaf : "directory";
      let child = parent.children.find((node) => node.name === name && node.kind === kind);
      if (!child) {
        child = { name, path: parts.slice(0, index + 1).join("/"), kind, children: [] };
        parent.children.push(child);
      }
      parent = child;
    });
  };

  for (const folder of folders) add(folder, "directory");
  for (const path of paths) add(path, "file");

  return sortNodes(root.children).map(compact);
}

/** Every directory path above a file, which is what has to be expanded to show it. */
export function ancestorsOf(path: string): string[] {
  const parts = path.split("/").filter(Boolean);
  return parts.slice(0, -1).map((_, index) => parts.slice(0, index + 1).join("/"));
}

/** The rows on screen, in order, for a given set of expanded directories. */
export function visibleRows(nodes: FileTreeNode[], expanded: ReadonlySet<string>, depth = 0): FileTreeRow[] {
  const rows: FileTreeRow[] = [];
  for (const node of nodes) {
    rows.push({ node, depth });
    if (node.kind === "directory" && expanded.has(node.path)) {
      rows.push(...visibleRows(node.children, expanded, depth + 1));
    }
  }
  return rows;
}
