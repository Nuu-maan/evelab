import { IconGraduationCap, IconMessage, IconPlug, IconRobot, IconUsers, IconWrench } from "@/components/icons";
import type { CanvasNodeKind } from "@evelab/eve-project";
import { Icon, type IconData } from "@/components/icon";

/** One icon and colour per capability kind, shared by the canvas, overview and palette. */
export const KINDS: Record<CanvasNodeKind, { label: string; plural: string; icon: IconData }> = {
  agent: { label: "Agent", plural: "Agents", icon: IconRobot },
  subagent: { label: "Subagent", plural: "Subagents", icon: IconUsers },
  tool: { label: "Tool", plural: "Tools", icon: IconWrench },
  skill: { label: "Skill", plural: "Skills", icon: IconGraduationCap },
  connection: { label: "Connection", plural: "Connections", icon: IconPlug },
  channel: { label: "Channel", plural: "Channels", icon: IconMessage },
};

export function KindTile({ kind, size }: { kind: CanvasNodeKind; size?: "large" }) {
  return (
    <span className="kind-tile" data-kind={kind} data-size={size} aria-hidden="true">
      <Icon icon={KINDS[kind].icon} size={size === "large" ? 16 : 14} />
    </span>
  );
}

export function KindCount({ kind, count }: { kind: CanvasNodeKind; count: number }) {
  const { icon, label, plural } = KINDS[kind];
  return (
    <span className="kind-count" data-kind={kind}>
      <Icon icon={icon} size={14} />
      {count}
      <span className="visually-hidden">{count === 1 ? label : plural}</span>
    </span>
  );
}
