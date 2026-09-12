import { BookOpen, Bot, Users, Wrench, type LucideIcon } from "lucide-react";
import type { CanvasNodeKind } from "@evelab/eve-project";

/** One icon and colour per capability kind, shared by the canvas, overview and palette. */
export const KINDS: Record<CanvasNodeKind, { label: string; plural: string; icon: LucideIcon }> = {
  agent: { label: "Agent", plural: "Agents", icon: Bot },
  subagent: { label: "Subagent", plural: "Subagents", icon: Users },
  tool: { label: "Tool", plural: "Tools", icon: Wrench },
  skill: { label: "Skill", plural: "Skills", icon: BookOpen },
};

export function KindTile({ kind, size }: { kind: CanvasNodeKind; size?: "large" }) {
  const Icon = KINDS[kind].icon;
  return (
    <span className="kind-tile" data-kind={kind} data-size={size} aria-hidden="true">
      <Icon strokeWidth={2} />
    </span>
  );
}

export function KindCount({ kind, count }: { kind: CanvasNodeKind; count: number }) {
  const { icon: Icon, label, plural } = KINDS[kind];
  return (
    <span className="kind-count" data-kind={kind}>
      <Icon aria-hidden="true" strokeWidth={2} />
      {count}
      <span className="visually-hidden">{count === 1 ? label : plural}</span>
    </span>
  );
}
