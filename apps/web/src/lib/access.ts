/**
 * Who may open a project. Pure, so the rule is tested without a database.
 *
 * With sign-in off, evelab is a local single-user tool and everything on disk is
 * the user's. With it on, only a project's members see it; to everyone else it
 * does not exist.
 */

export type AccessDecision = "allow" | "sign-in" | "deny";

export type AccessInput =
  | { authEnabled: false }
  | { authEnabled: true; signedIn: boolean; member: boolean };

export function decideAccess(input: AccessInput): AccessDecision {
  if (!input.authEnabled) return "allow";
  if (!input.signedIn) return "sign-in";
  return input.member ? "allow" : "deny";
}

export class AccessError extends Error {
  constructor(readonly decision: Exclude<AccessDecision, "allow">) {
    // Deliberately the same words for "not yours" and "does not exist".
    super(decision === "sign-in" ? "Sign in to continue." : "Project not found.");
  }
}
