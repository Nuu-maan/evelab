import { defineAgent } from "eve";

// Keep compaction late: research threads are long.
export default defineAgent({
  model: "anthropic/claude-sonnet-5",
  reasoning: "high",
  compaction: {
    thresholdPercent: 0.95,
  },
});
