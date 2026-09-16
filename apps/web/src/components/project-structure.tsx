import type { CanvasNodeKind } from "@evelab/eve-project";
import { Icon } from "@/components/icon";
import { KINDS } from "@/components/kinds";

type PieceKind = Exclude<CanvasNodeKind, "agent">;

const BELOW: PieceKind[] = ["subagent", "tool", "skill", "connection"];

/**
 * A project's shape at a glance, drawn the same way for every project: its
 * channels above the root agent, then one tile per kind it uses, each with a
 * count. It never depends on how the canvas was arranged, so a card with fifty
 * pieces reads as clearly as a card with two.
 */
export function ProjectStructure({ counts }: { counts: Record<PieceKind, number> }) {
  const below = BELOW.filter((kind) => counts[kind] > 0);

  return (
    <div className="structure" aria-hidden="true">
      {counts.channel > 0 && (
        <>
          <Tile kind="channel" count={counts.channel} />
          <span className="structure-trunk" />
        </>
      )}
      <span className="structure-agent">
        <span className="structure-agent-icon">
          <Icon icon={KINDS.agent.icon} size={14} />
        </span>
        <span className="structure-agent-lines">
          <i />
          <i />
        </span>
      </span>
      {below.length > 0 && (
        <>
          <span className="structure-trunk" />
          <span className="structure-branches">
            {below.map((kind) => (
              <Tile key={kind} kind={kind} count={counts[kind]} />
            ))}
          </span>
        </>
      )}
    </div>
  );
}

function Tile({ kind, count }: { kind: PieceKind; count: number }) {
  return (
    <span className="structure-tile" data-kind={kind}>
      <Icon icon={KINDS[kind].icon} size={15} />
      <span className="structure-count">{count}</span>
    </span>
  );
}
