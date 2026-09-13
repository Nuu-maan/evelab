import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description: "Search the product docs index.",
  inputSchema: z.object({ query: z.string().min(1) }),
  async execute({ query }) {
    return { query, results: [] };
  },
});
