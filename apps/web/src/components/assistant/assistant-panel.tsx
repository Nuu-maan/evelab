"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { AnimatePresence, motion } from "motion/react";
import { IconArrowUp, IconCheck, IconCross, IconCrossCircle } from "@/components/icons";
import { Icon } from "@/components/icon";
import { DRAWER, EXIT } from "@/components/interaction";
import { Button } from "@/components/ui/button";
import "@/app/assistant.css";

const SUGGESTIONS = [
  "Write instructions for a customer support agent that never promises refunds",
  "Add a tool that looks up an order by id",
  "Connect the Linear MCP server through Vercel Connect",
  "Add a weekday 9:00 schedule that summarizes new tickets",
];

const TOOL_LABELS: Record<string, [running: string, done: string]> = {
  read_project: ["Reading the project", "Read the project"],
  read_file: ["Reading a file", "Read a file"],
  write_instructions: ["Writing instructions", "Wrote instructions"],
  create_tool: ["Creating a tool", "Created a tool"],
  create_subagent: ["Creating a subagent", "Created a subagent"],
  add_connection: ["Adding a connection", "Added a connection"],
  add_schedule: ["Adding a schedule", "Added a schedule"],
};

interface ToolPart {
  type: string;
  state: string;
  input?: Record<string, unknown>;
  output?: unknown;
  errorText?: string;
}

function toolOutcome(part: ToolPart): { path?: string; error?: string } {
  const output = part.output && typeof part.output === "object" ? (part.output as Record<string, unknown>) : {};
  return {
    path: typeof output.path === "string" ? output.path : undefined,
    error: part.errorText ?? (typeof output.error === "string" ? output.error : undefined),
  };
}

function ToolCard({ part, projectId }: { part: ToolPart; projectId: string }) {
  const name = part.type.slice("tool-".length);
  const [running, done] = TOOL_LABELS[name] ?? [name, name];
  const finished = part.state === "output-available" || part.state === "output-error";
  const { path, error } = finished ? toolOutcome(part) : {};
  const subject = typeof part.input?.name === "string" ? part.input.name : typeof part.input?.path === "string" ? part.input.path : undefined;

  return (
    <div className="assistant-tool" data-state={error ? "error" : finished ? "done" : "running"}>
      <span className="assistant-tool-icon" aria-hidden="true">
        {!finished ? <span className="runtime-spinner" /> : <Icon icon={error ? IconCrossCircle : IconCheck} size={14} />}
      </span>
      <span className="assistant-tool-label">
        {finished ? (error ? `Could not ${running.toLowerCase()}` : done) : running}
        {subject && <span className="mono"> {subject}</span>}
      </span>
      {path && !error && (
        <Link className="assistant-tool-link mono" href={`/projects/${projectId}/files?path=${encodeURIComponent(path)}`}>
          {path}
        </Link>
      )}
      {error && <span className="assistant-tool-error">{error}</span>}
    </div>
  );
}

/**
 * A side panel that builds the agent with you. Every change it makes goes
 * through the same file operations as the rest of EveLab, and each one shows up
 * as a card that links to the file it wrote. The launcher decides when it is
 * open, and loads this module the first time it is.
 */
export function AssistantPanel({
  projectId,
  available,
  model,
  open,
  prompt,
  onClose,
}: {
  projectId: string;
  available: boolean;
  model: string;
  open: boolean;
  /** Text to start from when something opened the assistant with a request. */
  prompt?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [input, setInput] = useState(prompt ?? "");
  const scroller = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);

  const { messages, sendMessage, status, stop, error, setMessages } = useChat({
    transport: new DefaultChatTransport({ api: `/api/projects/${projectId}/assistant` }),
    onFinish: () => router.refresh(),
  });
  const busy = status === "submitted" || status === "streaming";

  // A later request replaces what was typed, as opening with a prompt always did.
  const [lastPrompt, setLastPrompt] = useState(prompt);
  if (prompt !== lastPrompt) {
    setLastPrompt(prompt);
    if (prompt) setInput(prompt);
  }

  useEffect(() => {
    if (open) composer.current?.focus();
  }, [open]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages]);

  const submit = (text = input) => {
    const value = text.trim();
    if (!value || busy || !available) return;
    void sendMessage({ text: value });
    setInput("");
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          className="assistant"
          aria-label="Assistant"
          initial={{ opacity: 0, transform: "translateX(24px)" }}
          animate={{ opacity: 1, transform: "translateX(0px)", transition: DRAWER }}
          exit={{ opacity: 0, transform: "translateX(16px)", transition: EXIT }}
        >
          <header className="assistant-head">
            <div>
              <h2 className="section-title">Assistant</h2>
              <p className="hint mono">{model} through AI Gateway</p>
            </div>
            <div className="row">
              {messages.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setMessages([])} disabled={busy}>
                  Clear
                </Button>
              )}
              <Button variant="ghost" size="icon" aria-label="Close assistant" onClick={onClose}>
                <Icon icon={IconCross} />
              </Button>
            </div>
          </header>

          <div className="assistant-scroll" ref={scroller}>
            {!available ? (
              <div className="assistant-empty">
                <p className="assistant-empty-title">Connect AI Gateway to build with AI</p>
                <p className="hint">
                  The assistant calls models through Vercel AI Gateway. Set AI_GATEWAY_API_KEY on the EveLab server, or link
                  the project to Vercel so its OIDC token is available.
                </p>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/projects/${projectId}/settings`}>Open Vercel settings</Link>
                </Button>
              </div>
            ) : messages.length === 0 ? (
              <div className="assistant-empty">
                <p className="assistant-empty-title">Describe what your agent should do</p>
                <p className="hint">It reads the project, then writes instructions, tools, subagents, connections and schedules.</p>
                <ul className="assistant-suggestions">
                  {SUGGESTIONS.map((suggestion) => (
                    <li key={suggestion}>
                      <button type="button" className="assistant-suggestion" onClick={() => submit(suggestion)}>
                        {suggestion}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <ol className="assistant-messages">
                {messages.map((message) => (
                  <li key={message.id} className="assistant-message" data-role={message.role}>
                    {message.parts.map((part, index) => {
                      if (part.type === "text") {
                        return (
                          <p key={index} className="assistant-text">
                            {part.text}
                          </p>
                        );
                      }
                      if (part.type.startsWith("tool-")) {
                        return <ToolCard key={index} part={part as unknown as ToolPart} projectId={projectId} />;
                      }
                      return null;
                    })}
                  </li>
                ))}
                {status === "submitted" && (
                  <li className="assistant-message" data-role="assistant">
                    <span className="assistant-thinking">Thinking</span>
                  </li>
                )}
              </ol>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error.message || "The assistant stopped with an error."}
              </p>
            )}
          </div>

          <form
            className="assistant-composer"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <textarea
              ref={composer}
              className="assistant-input"
              aria-label="Message the assistant"
              placeholder={available ? "Ask for a change" : "Connect AI Gateway first"}
              rows={2}
              value={input}
              disabled={!available}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submit();
                }
              }}
            />
            {busy ? (
              <Button type="button" size="sm" variant="outline" onClick={() => void stop()}>
                Stop
              </Button>
            ) : (
              <Button type="submit" size="icon" aria-label="Send" disabled={!available || !input.trim()}>
                <Icon icon={IconArrowUp} />
              </Button>
            )}
          </form>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
