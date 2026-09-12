import { Agent } from "eve";
import { browse } from "./tools/browse.js";

const gateway = process.env.AI_GATEWAY_URL;

export default new Agent({
  name: "Research Agent",
  description: "Answers research questions with cited sources.",
  model: {
    id: "openai/gpt-5.6",
    temperature: 0.3,
    gateway,
  },
  instructions: "instructions.md",
  tools: [browse],
});
