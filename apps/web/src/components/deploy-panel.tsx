"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { deployAction } from "@/lib/actions";
import type { Deployment } from "@/lib/deploy";

const TONE: Record<Deployment["status"], string> = { building: "modified", ready: "ready", failed: "error" };
const LABEL: Record<Deployment["status"], string> = { building: "Building", ready: "Ready", failed: "Failed" };

/** Starts `eve deploy` and follows it. The page re-renders from the server while anything builds. */
export function DeployPanel({
  projectId,
  deployments,
  available,
  reason,
}: {
  projectId: string;
  deployments: Deployment[];
  available: boolean;
  reason?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const building = deployments.some((deployment) => deployment.status === "building");

  useEffect(() => {
    if (!building) return;
    const timer = setInterval(() => router.refresh(), 1500);
    return () => clearInterval(timer);
  }, [building, router]);

  const deploy = async () => {
    setPending(true);
    setError(undefined);
    const result = await deployAction(projectId);
    setPending(false);
    if (!result.ok) setError(result.message);
    router.refresh();
  };

  return (
    <div className="section">
      <div className="row">
        <Button onClick={() => void deploy()} disabled={!available || pending || building}>
          {building ? "Deploying" : "Deploy to production"}
        </Button>
        {!available && reason && <span className="hint">{reason}</span>}
        {error && (
          <span className="form-error" role="alert">
            {error}
          </span>
        )}
      </div>

      {deployments.length === 0 ? (
        <p className="hint">No deployments yet.</p>
      ) : (
        <ul className="section" aria-label="Deployments">
          {deployments.map((deployment) => (
            <li key={deployment.id}>
              <Card size="sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="status" data-tone={TONE[deployment.status]}>
                      {LABEL[deployment.status]}
                    </span>
                    {deployment.url ? (
                      <a className="mono truncate" href={deployment.url} target="_blank" rel="noreferrer noopener">
                        {deployment.url}
                      </a>
                    ) : (
                      <span className="mono hint">{deployment.project}</span>
                    )}
                  </CardTitle>
                  <CardDescription className="tabular-nums">
                    {new Date(deployment.startedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                    {deployment.finishedAt &&
                      `, ${Math.max(1, Math.round((Date.parse(deployment.finishedAt) - Date.parse(deployment.startedAt)) / 1000))} s`}
                  </CardDescription>
                  <CardAction className="flex items-center gap-2">
                    <Badge variant="secondary">Production</Badge>
                    {deployment.commit && (
                      <Badge variant="secondary" className="font-mono">
                        {deployment.commit.slice(0, 7)}
                      </Badge>
                    )}
                  </CardAction>
                </CardHeader>
                {deployment.log.length > 0 && (
                  <CardContent>
                    <details open={deployment.status !== "ready"}>
                      <summary className="hint">Log</summary>
                      <pre className="code mono" style={{ maxHeight: 280, overflow: "auto", fontSize: 12 }}>
                        {deployment.log.join("\n")}
                      </pre>
                    </details>
                  </CardContent>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
