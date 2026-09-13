"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { connectRepositoryAction, createRepositoryAction } from "@/lib/actions";
import type { RepositoryOption } from "@/lib/source-types";
import "@/app/source.css";

export function ConnectRepository({
  projectId,
  suggestedName,
  repositories,
  listError,
  canCreate,
}: {
  projectId: string;
  suggestedName: string;
  repositories: RepositoryOption[];
  listError?: string;
  canCreate: boolean;
}) {
  const router = useRouter();
  const [repository, setRepository] = useState("");
  const [branch, setBranch] = useState("");
  const [name, setName] = useState(suggestedName);
  const [isPrivate, setIsPrivate] = useState(true);
  const [message, setMessage] = useState("Initial commit from EveLab");
  const [busy, setBusy] = useState<"connect" | "create" | undefined>();
  const [error, setError] = useState<{ form: "connect" | "create"; text: string } | undefined>();

  const defaultBranch = repositories.find((option) => option.fullName === repository)?.defaultBranch;

  const connect = async () => {
    setBusy("connect");
    setError(undefined);
    const result = await connectRepositoryAction({ projectId, repository, branch: branch || undefined });
    setBusy(undefined);
    if (!result.ok) setError({ form: "connect", text: result.message });
    else router.refresh();
  };

  const create = async () => {
    setBusy("create");
    setError(undefined);
    const result = await createRepositoryAction({ projectId, name, isPrivate, message });
    setBusy(undefined);
    if (!result.ok) setError({ form: "create", text: result.message });
    else router.refresh();
  };

  return (
    <div className="grid-2 source-connect">
      <Card role="region" aria-label="Connect a repository">
        <form
          className="contents"
          onSubmit={(event) => {
            event.preventDefault();
            void connect();
          }}
        >
          <CardHeader>
            <CardTitle>Connect a repository</CardTitle>
            <CardDescription>
              Its branch becomes the starting point. Anything that differs in this project shows up as
              a change you can review and commit.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="connect-repository">Repository</FieldLabel>
                <Input
                  className="font-mono"
                  id="connect-repository"
                  list="connect-repository-options"
                  placeholder="owner/name"
                  value={repository}
                  onChange={(event) => setRepository(event.target.value)}
                  required
                />
                <datalist id="connect-repository-options">
                  {repositories.map((option) => (
                    <option key={option.fullName} value={option.fullName}>
                      {option.private ? "Private" : "Public"}
                    </option>
                  ))}
                </datalist>
                {listError && <FieldError>{listError}</FieldError>}
              </Field>
              <Field>
                <FieldLabel htmlFor="connect-branch">Branch</FieldLabel>
                <Input
                  className="font-mono"
                  id="connect-branch"
                  placeholder={defaultBranch ?? "Default branch"}
                  value={branch}
                  onChange={(event) => setBranch(event.target.value)}
                />
              </Field>
              {error?.form === "connect" && <FieldError>{error.text}</FieldError>}
            </FieldGroup>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit" disabled={!repository || Boolean(busy)}>
              {busy === "connect" ? "Connecting" : "Connect"}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card role="region" aria-label="Create a repository">
        <form
          className="contents"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          <CardHeader>
            <CardTitle>Create a repository</CardTitle>
            <CardDescription>
              A new repository on your account with this project as its first commit. Files your
              .gitignore excludes, and every .env file, stay here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field data-disabled={!canCreate || undefined}>
                <FieldLabel htmlFor="create-name">Repository name</FieldLabel>
                <Input
                  className="font-mono"
                  id="create-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  disabled={!canCreate}
                />
              </Field>
              <Field data-disabled={!canCreate || undefined}>
                <FieldLabel htmlFor="create-message">Commit message</FieldLabel>
                <Input
                  id="create-message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  required
                  disabled={!canCreate}
                />
              </Field>
              <Field orientation="horizontal" data-disabled={!canCreate || undefined}>
                <Checkbox
                  id="create-private"
                  checked={isPrivate}
                  onCheckedChange={(checked) => setIsPrivate(checked === true)}
                  disabled={!canCreate}
                />
                <FieldLabel htmlFor="create-private" className="font-normal">
                  Private repository
                </FieldLabel>
              </Field>
              {!canCreate && (
                <FieldDescription>
                  Creating personal repositories needs GITHUB_TOKEN rather than a GitHub App.
                </FieldDescription>
              )}
              {error?.form === "create" && <FieldError>{error.text}</FieldError>}
            </FieldGroup>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit" disabled={!canCreate || !name || !message || Boolean(busy)}>
              {busy === "create" ? "Creating" : "Create repository and push"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
