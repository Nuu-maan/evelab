"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { installIntegrationAction } from "@/lib/actions";

export function IntegrationAddButton({ projectId, integrationId, name }: { projectId: string; integrationId: string; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  const add = () =>
    startTransition(async () => {
      setError(undefined);
      const result = await installIntegrationAction(projectId, integrationId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" variant="outline" disabled={pending} onClick={add} aria-label={`Add ${name}`}>
        {pending ? "Adding" : "Add"}
      </Button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
