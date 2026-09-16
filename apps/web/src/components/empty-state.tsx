import type { ReactNode } from "react";
import { Icon, type IconData } from "@/components/icon";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

/** shadcn's Empty, framed the way every evelab empty state is: say what is missing and why. */
export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: IconData;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Empty className="border bg-card py-12">
      <EmptyHeader className="max-w-md">
        {icon && (
          <EmptyMedia variant="icon">
            <Icon icon={icon} />
          </EmptyMedia>
        )}
        <EmptyTitle>{title}</EmptyTitle>
        {children && <EmptyDescription className="text-pretty">{children}</EmptyDescription>}
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}
