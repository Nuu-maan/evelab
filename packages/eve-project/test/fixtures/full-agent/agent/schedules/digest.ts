import { defineSchedule } from "eve/schedules";

export default defineSchedule({
  cron: "0 9 * * 1-5",
  markdown: "Summarize new sources added yesterday.",
});
