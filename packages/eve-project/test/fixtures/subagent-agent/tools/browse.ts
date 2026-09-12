import { tool } from "eve";
import { z } from "zod";

export const browse = tool({
  name: "browse",
  description: "Fetches a URL and returns readable text.",
  inputSchema: z.object({ url: z.string().url() }),
  async execute({ url }) {
    const response = await fetch(url);
    return await response.text();
  },
});
