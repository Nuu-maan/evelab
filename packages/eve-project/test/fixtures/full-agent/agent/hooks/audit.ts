import { defineHook } from "eve/hooks";

export default defineHook({
  events: {
    "turn.completed"(event) {
      console.info("turn completed", event.data.turnId);
    },
  },
});
