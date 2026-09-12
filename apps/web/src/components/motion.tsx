import type { ReactNode } from "react";

/**
 * Entrance helpers.
 *
 * These are server components on purpose. The animation is CSS, so content is
 * visible with no JavaScript, and nothing is gated behind hydration. Motion
 * that responds to interaction (panels, dialogs, moving indicators) uses
 * motion/react inside client components instead.
 */

export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  /** Seconds, to match the interaction helpers. */
  delay?: number;
  className?: string;
}) {
  return (
    <div
      className={className ? `reveal ${className}` : "reveal"}
      style={delay ? { ["--reveal-delay" as string]: `${Math.round(delay * 1000)}ms` } : undefined}
    >
      {children}
    </div>
  );
}

export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className ? `stagger ${className}` : "stagger"}>{children}</div>;
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}
