import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

/**
 * One setting as Vercel lays it out: a title and a sentence on what it does,
 * the control, then a footer with a hint on the left and the action on the right.
 */
export function SettingCard({
  title,
  description,
  footer,
  action,
  children,
}: {
  title: string;
  description?: ReactNode;
  footer?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Card className="setting-card gap-0 overflow-hidden py-0">
      <div className="setting-card-body">
        <h3 className="setting-card-title">{title}</h3>
        {description && <p className="setting-card-description">{description}</p>}
        {children && <div className="setting-card-content">{children}</div>}
      </div>
      {(footer || action) && (
        <div className="setting-card-footer">
          <div className="setting-card-hint">{footer}</div>
          {action && <div className="setting-card-action">{action}</div>}
        </div>
      )}
    </Card>
  );
}
