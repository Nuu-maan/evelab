import { Agent } from "eve";

export default new Agent({
  name: "Support Triage",
  description: "Triages inbound support email and routes it to the right queue.",
  model: "openai/gpt-5.6",
  instructions: "instructions.md",
});
