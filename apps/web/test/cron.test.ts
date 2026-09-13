import { describe, expect, it } from "vitest";
import { describeCron } from "../src/lib/cron";

describe("describeCron", () => {
  it("reads the common shapes", () => {
    expect(describeCron("*/15 * * * *")).toBe("Every 15 minutes");
    expect(describeCron("0 * * * *")).toBe("Every hour");
    expect(describeCron("0 9 * * *")).toBe("Every day at 09:00 UTC");
    expect(describeCron("30 17 * * 1-5")).toBe("Weekdays at 17:30 UTC");
    expect(describeCron("0 0 * * 0")).toBe("Every Sunday at 00:00 UTC");
  });

  it("returns anything else as written", () => {
    expect(describeCron("0 0 1 * *")).toBe("0 0 1 * *");
    expect(describeCron("daily")).toBe("daily");
  });
});
