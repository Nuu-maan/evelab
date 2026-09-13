import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description: "Fetch a URL and return readable text.",
  inputSchema: z.object({ url: z.string().url() }),
  async execute({ url }) {
    const response = await fetch(url);
    return { text: await response.text() };
  },
});
