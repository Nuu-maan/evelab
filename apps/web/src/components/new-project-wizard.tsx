"use client";

import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { IconCheck, IconMagnifyingGlass } from "@/components/icons";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { GatewayModel } from "@/lib/models";
import { createProjectAction } from "@/lib/actions";
import "@/app/onboarding.css";

type Provider = "ai-gateway-project" | "ai-gateway-key" | "chatgpt" | "external";
type Direct = "anthropic" | "openai";
type Step = "name" | "provider" | "model" | "review";

/** The same four answers `eve init` offers, in its order and words. */
const PROVIDERS: { value: Provider; label: string; hint: string; badge?: string }[] = [
  {
    value: "ai-gateway-project",
    label: "AI Gateway via Project",
    hint: "Authenticates with AI Gateway automatically in a new or existing project. No keys to manage.",
    badge: "Recommended",
  },
  { value: "ai-gateway-key", label: "AI Gateway via AI_GATEWAY_API_KEY", hint: "Type your key." },
  { value: "chatgpt", label: "ChatGPT subscription", hint: "Sign in with your ChatGPT account." },
  {
    value: "external",
    label: "Other providers",
    hint: "Connect directly to a model provider via OPENAI_API_KEY or ANTHROPIC_API_KEY.",
  },
];

const DIRECT: Record<Direct, { label: string; env: string; factory: string; pkg: string }> = {
  anthropic: { label: "Anthropic", env: "ANTHROPIC_API_KEY", factory: "anthropic", pkg: "@ai-sdk/anthropic" },
  openai: { label: "OpenAI", env: "OPENAI_API_KEY", factory: "openai", pkg: "@ai-sdk/openai" },
};

/** eve init lists these first. */
const FEATURED = ["openai/gpt-5.6-luna-fast", "anthropic/claude-opus-4.8", "openai/gpt-5.5"];
const CHATGPT_DEFAULT = "openai/gpt-5.6-sol";

const STEPS: { id: Step; question: string }[] = [
  { id: "name", question: "What is your agent called?" },
  { id: "provider", question: "Which model provider do you want to use?" },
  { id: "model", question: "Which model should your agent use?" },
  { id: "review", question: "Ready to create it?" },
];

function contextLabel(window: number | undefined): string | undefined {
  if (!window) return undefined;
  return window >= 1_000_000 ? `${window / 1_000_000}M context` : `${Math.round(window / 1000)}K context`;
}

function bare(id: string): string {
  return id.slice(id.indexOf("/") + 1);
}

/** What agent/agent.ts will say, mirroring renderAgentConfigFor in the core package. */
function agentSource(provider: Provider, direct: Direct, model: string, reasoning: string): string {
  const effort = reasoning && reasoning !== "provider-default" ? `  reasoning: "${reasoning}",\n` : "";
  if (provider === "chatgpt") {
    return `import { defineAgent } from "eve";\nimport { chatgpt } from "eve/models/openai";\n\nexport default defineAgent({\n  model: chatgpt("${bare(model)}"),\n${effort}});\n`;
  }
  if (provider === "external") {
    const { factory, pkg } = DIRECT[direct];
    return `import { ${factory} } from "${pkg}";\nimport { defineAgent } from "eve";\n\nexport default defineAgent({\n  model: ${factory}("${bare(model)}"),\n${effort}});\n`;
  }
  return `import { defineAgent } from "eve";\n\nexport default defineAgent({\n  model: "${model}",\n${effort}});\n`;
}

/**
 * Creating a project the way `eve init` walks through it: a name, how the
 * agent reaches a model, then the model. Answered questions fold into one line
 * with a way back, so the page reads like the terminal session it mirrors.
 */
export function NewProjectWizard({ models, defaultModel }: { models: GatewayModel[]; defaultModel: string }) {
  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [provider, setProvider] = useState<Provider>("ai-gateway-project");
  const [direct, setDirect] = useState<Direct>("anthropic");
  const [model, setModel] = useState(defaultModel);
  const [reasoning, setReasoning] = useState("provider-default");
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const reached = STEPS.findIndex((entry) => entry.id === step);

  const choices = useMemo(() => {
    const language = models.filter((entry) => entry.id.includes("/"));
    let pool = language;
    if (provider === "chatgpt") pool = language.filter((entry) => entry.id.startsWith("openai/gpt-"));
    if (provider === "external") pool = language.filter((entry) => entry.provider === direct);
    const needle = query.trim().toLowerCase();
    const matches = pool.filter(
      (entry) => !needle || entry.id.toLowerCase().includes(needle) || entry.label.toLowerCase().includes(needle),
    );
    const featured = FEATURED.map((id) => matches.find((entry) => entry.id === id)).filter(
      (entry): entry is GatewayModel => Boolean(entry),
    );
    const rest = matches.filter((entry) => !FEATURED.includes(entry.id));
    return { featured, rest, all: [...featured, ...rest] };
  }, [direct, models, provider, query]);

  const selected = models.find((entry) => entry.id === model);
  const efforts = selected?.reasoning ?? [];
  const providerLabel =
    provider === "external" ? `${DIRECT[direct].label} with ${DIRECT[direct].env}` : PROVIDERS.find((entry) => entry.value === provider)!.label;

  const chooseProvider = (next: Provider, nextDirect = direct) => {
    setProvider(next);
    setDirect(nextDirect);
    setQuery("");
    // Keep the model when it still fits; otherwise start from what eve init would pick.
    const fits = (id: string) =>
      next === "chatgpt" ? id.startsWith("openai/gpt-") : next === "external" ? id.startsWith(`${nextDirect}/`) : true;
    if (!fits(model)) {
      const fallback =
        next === "chatgpt"
          ? CHATGPT_DEFAULT
          : next === "external"
            ? (FEATURED.find((id) => id.startsWith(`${nextDirect}/`)) ?? models.find((entry) => entry.provider === nextDirect)?.id)
            : defaultModel;
      if (fallback) setModel(fallback);
      setReasoning("provider-default");
    }
  };

  const moveInList = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Enter") return;
    event.preventDefault();
    if (event.key === "Enter") {
      if (choices.all.some((entry) => entry.id === model)) setStep("review");
      return;
    }
    const index = choices.all.findIndex((entry) => entry.id === model);
    const next = choices.all[Math.max(0, Math.min(choices.all.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)))];
    if (!next) return;
    setModel(next.id);
    setReasoning("provider-default");
    listRef.current?.querySelector<HTMLElement>(`[data-model="${CSS.escape(next.id)}"]`)?.scrollIntoView({ block: "nearest" });
  };

  const answers: Record<Step, ReactNode> = {
    name: (
      <>
        <span className="mono">{name}</span>
        {description && <span className="wizard-answer-muted"> {description}</span>}
      </>
    ),
    provider: providerLabel,
    model: (
      <>
        <span className="mono">{provider === "ai-gateway-project" || provider === "ai-gateway-key" ? model : bare(model)}</span>
        {reasoning !== "provider-default" && <span className="wizard-answer-muted"> {reasoning} reasoning</span>}
      </>
    ),
    review: null,
  };

  return (
    <form
      className="wizard"
      action={createProjectAction}
      onSubmit={() => setPending(true)}
      onKeyDown={(event) => {
        // Enter answers the current question; only the last one submits.
        if (event.key === "Enter" && step !== "review" && (event.target as HTMLElement).tagName === "INPUT") {
          event.preventDefault();
          if (step === "name" && name.trim()) setStep("provider");
        }
      }}
    >
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="description" value={description} />
      <input type="hidden" name="provider" value={provider === "external" ? direct : provider} />
      <input type="hidden" name="modelId" value={model} />
      <input type="hidden" name="reasoning" value={reasoning} />

      <ol className="wizard-steps">
        {STEPS.map((entry, index) => {
          const state = index < reached ? "done" : index === reached ? "current" : "todo";
          return (
            <li key={entry.id} className="wizard-step" data-state={state}>
              <span className="wizard-marker" aria-hidden="true">
                {state === "done" ? <Icon icon={IconCheck} size={14} /> : index + 1}
              </span>

              <div className="wizard-body">
                <div className="wizard-question-row">
                  <p className="wizard-question">{entry.question}</p>
                  {state === "done" && (
                    <button type="button" className="wizard-change" onClick={() => setStep(entry.id)}>
                      Change
                    </button>
                  )}
                </div>

                {state === "done" && <p className="wizard-answer">{answers[entry.id]}</p>}

                {state === "current" && entry.id === "name" && (
                  <div className="wizard-panel">
                    <FieldGroup>
                      <Field>
                        <FieldLabel htmlFor="wizard-name">Name</FieldLabel>
                        <Input
                          id="wizard-name"
                          value={name}
                          maxLength={80}
                          placeholder="support-triage"
                          autoFocus
                          onChange={(event) => setName(event.target.value)}
                        />
                        <FieldDescription>Eve names the agent after the package, so this becomes package.json&apos;s name.</FieldDescription>
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="wizard-description">Description</FieldLabel>
                        <Input
                          id="wizard-description"
                          value={description}
                          maxLength={280}
                          placeholder="Answers support tickets and escalates the hard ones."
                          onChange={(event) => setDescription(event.target.value)}
                        />
                        <FieldDescription>One sentence on what the agent is for. Optional.</FieldDescription>
                      </Field>
                    </FieldGroup>
                    <div className="wizard-actions">
                      <Button asChild variant="ghost">
                        <Link href="/projects/import">Import from GitHub instead</Link>
                      </Button>
                      <Button type="button" disabled={!name.trim()} onClick={() => setStep("provider")}>
                        Continue
                      </Button>
                    </div>
                  </div>
                )}

                {state === "current" && entry.id === "provider" && (
                  <div className="wizard-panel">
                    <div className="wizard-options" role="radiogroup" aria-label="Model provider">
                      {PROVIDERS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          role="radio"
                          aria-checked={provider === option.value}
                          className="wizard-option"
                          onClick={() => chooseProvider(option.value)}
                        >
                          <span className="wizard-radio" aria-hidden="true" />
                          <span className="wizard-option-text">
                            <span className="wizard-option-label">
                              {option.label}
                              {option.badge && <span className="wizard-badge">{option.badge}</span>}
                            </span>
                            <span className="wizard-option-hint">{option.hint}</span>
                          </span>
                        </button>
                      ))}
                    </div>

                    {provider === "external" && (
                      <div className="wizard-subchoice" role="radiogroup" aria-label="Provider">
                        {(Object.keys(DIRECT) as Direct[]).map((value) => (
                          <button
                            key={value}
                            type="button"
                            role="radio"
                            aria-checked={direct === value}
                            className="wizard-segment"
                            onClick={() => chooseProvider("external", value)}
                          >
                            {DIRECT[value].label}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="wizard-actions">
                      <Button type="button" variant="ghost" onClick={() => setStep("name")}>
                        Back
                      </Button>
                      <Button type="button" onClick={() => setStep("model")}>
                        Continue
                      </Button>
                    </div>
                  </div>
                )}

                {state === "current" && entry.id === "model" && (
                  <div className="wizard-panel">
                    <label className="wizard-search">
                      <Icon icon={IconMagnifyingGlass} size={14} />
                      <input
                        type="search"
                        value={query}
                        autoFocus
                        placeholder="Search models"
                        aria-label="Search models"
                        aria-controls="wizard-models"
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={(event) => {
                          // The list below handles the same keys; handle them once.
                          event.stopPropagation();
                          moveInList(event);
                        }}
                      />
                      <span className="wizard-count tabular-nums">{choices.all.length}</span>
                    </label>

                    <div className="wizard-models" id="wizard-models" role="listbox" aria-label="Models" ref={listRef} tabIndex={-1} onKeyDown={moveInList}>
                      {choices.all.length === 0 && <p className="wizard-empty">No models match.</p>}
                      {[
                        { label: "Recommended", items: choices.featured },
                        { label: provider === "chatgpt" ? "Available with ChatGPT" : "All models", items: choices.rest },
                      ].map((group) =>
                        group.items.length === 0 ? null : (
                          <div key={group.label} role="group" aria-label={group.label}>
                            <p className="wizard-group-label">{group.label}</p>
                            {group.items.map((entry) => (
                              <button
                                key={entry.id}
                                type="button"
                                role="option"
                                aria-selected={entry.id === model}
                                data-model={entry.id}
                                className="wizard-model"
                                onClick={() => {
                                  setModel(entry.id);
                                  setReasoning("provider-default");
                                }}
                                onDoubleClick={() => setStep("review")}
                              >
                                <span className="wizard-radio" aria-hidden="true" />
                                <span className="wizard-model-text">
                                  <span className="wizard-model-name">{entry.label}</span>
                                  <span className="wizard-model-id mono">{provider === "ai-gateway-project" || provider === "ai-gateway-key" ? entry.id : bare(entry.id)}</span>
                                </span>
                                <span className="wizard-model-meta">
                                  {contextLabel(entry.contextWindow)}
                                  {entry.price && (
                                    <span className="tabular-nums">
                                      ${entry.price.input} / ${entry.price.output}
                                    </span>
                                  )}
                                </span>
                              </button>
                            ))}
                          </div>
                        ),
                      )}
                    </div>

                    {efforts.length > 0 && (
                      <div className="wizard-reasoning">
                        <p className="wizard-group-label">Reasoning effort</p>
                        <div className="wizard-subchoice" role="radiogroup" aria-label="Reasoning effort">
                          {["provider-default", ...efforts].map((value) => (
                            <button
                              key={value}
                              type="button"
                              role="radio"
                              aria-checked={reasoning === value}
                              className="wizard-segment"
                              onClick={() => setReasoning(value)}
                            >
                              {value === "provider-default" ? "Default" : value}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="wizard-actions">
                      <p className="wizard-hint">Prices are per million input and output tokens.</p>
                      <Button type="button" variant="ghost" onClick={() => setStep("provider")}>
                        Back
                      </Button>
                      <Button type="button" onClick={() => setStep("review")} disabled={!model}>
                        Continue
                      </Button>
                    </div>
                  </div>
                )}

                {state === "current" && entry.id === "review" && (
                  <div className="wizard-panel">
                    <div className="wizard-preview">
                      <p className="wizard-preview-path mono">agent/agent.ts</p>
                      <pre className="mono">{agentSource(provider, direct, model, reasoning)}</pre>
                    </div>

                    <div className="wizard-next">
                      <p className="wizard-group-label">After it is created</p>
                      <p>
                        {provider === "ai-gateway-project" &&
                          "Nothing to configure. The Vercel project you deploy to authenticates AI Gateway, and a linked project covers eve dev too."}
                        {provider === "ai-gateway-key" && (
                          <>
                            Add <code className="mono">AI_GATEWAY_API_KEY</code> to <code className="mono">.env.local</code> and to
                            the deployment&apos;s environment. EveLab never stores the key.
                          </>
                        )}
                        {provider === "chatgpt" &&
                          "The first eve dev asks you to sign in with ChatGPT, and requests go through your subscription."}
                        {provider === "external" && (
                          <>
                            Set <code className="mono">{DIRECT[direct].env}</code> in <code className="mono">.env.local</code> and on
                            the deployment. EveLab adds <code className="mono">{DIRECT[direct].pkg}</code> to package.json.
                          </>
                        )}
                      </p>
                    </div>

                    <div className="wizard-actions">
                      <Button type="button" variant="ghost" onClick={() => setStep("model")}>
                        Back
                      </Button>
                      <Button type="submit" disabled={pending || !name.trim()}>
                        {pending ? "Creating" : "Create project"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </form>
  );
}
