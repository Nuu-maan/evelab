/**
 * Shapes shared between the importer (server) and the review dialog (client).
 * Kept separate so the client never pulls in the server-only importer.
 */

export interface SkillCandidateFile {
  /** Path relative to the skill directory. */
  path: string;
  content: string;
  /** True when the file can run code, which the user is asked to look at. */
  executable: boolean;
}

export interface SkillCandidate {
  id: string;
  name: string;
  description: string;
  source: string;
  files: SkillCandidateFile[];
  warnings: string[];
}
