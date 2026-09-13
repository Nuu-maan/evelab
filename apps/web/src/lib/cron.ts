/**
 * A plain reading of the cron expressions people usually write. Vercel Cron
 * runs schedules in UTC, so every time is labelled UTC. Anything unusual is
 * returned as written rather than guessed at.
 */

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function isNumber(value: string): boolean {
  return /^\d+$/.test(value);
}

function time(hour: string, minute: string): string {
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")} UTC`;
}

export function describeCron(expression: string): string {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return expression;
  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields as [string, string, string, string, string];

  const everyMinutes = /^\*\/(\d+)$/.exec(minute);
  if (everyMinutes && hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return everyMinutes[1] === "1" ? "Every minute" : `Every ${everyMinutes[1]} minutes`;
  }
  if (month !== "*" || dayOfMonth !== "*") return expression;
  if (isNumber(minute) && hour === "*" && dayOfWeek === "*") {
    return minute === "0" ? "Every hour" : `Every hour at minute ${minute}`;
  }
  if (!isNumber(minute) || !isNumber(hour)) return expression;

  const at = time(hour, minute);
  if (dayOfWeek === "*") return `Every day at ${at}`;
  if (dayOfWeek === "1-5") return `Weekdays at ${at}`;
  if (isNumber(dayOfWeek) && DAYS[Number(dayOfWeek) % 7]) return `Every ${DAYS[Number(dayOfWeek) % 7]} at ${at}`;
  return expression;
}

export const CRON_PRESETS = [
  { label: "Every hour", cron: "0 * * * *" },
  { label: "Every day at 09:00 UTC", cron: "0 9 * * *" },
  { label: "Weekdays at 09:00 UTC", cron: "0 9 * * 1-5" },
  { label: "Every Monday at 09:00 UTC", cron: "0 9 * * 1" },
];
