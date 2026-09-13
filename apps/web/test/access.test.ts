import { describe, expect, it } from "vitest";
import { AccessError, decideAccess } from "@/lib/access";

describe("decideAccess", () => {
  it("allows everything in local mode", () => {
    expect(decideAccess({ authEnabled: false })).toBe("allow");
  });

  it("allows a member", () => {
    expect(decideAccess({ authEnabled: true, signedIn: true, member: true })).toBe("allow");
  });

  it("denies a signed-in user who is not a member", () => {
    expect(decideAccess({ authEnabled: true, signedIn: true, member: false })).toBe("deny");
  });

  it("asks a signed-out visitor to sign in", () => {
    expect(decideAccess({ authEnabled: true, signedIn: false, member: false })).toBe("sign-in");
  });

  it("says the same thing for a project that is not yours as for one that does not exist", () => {
    expect(new AccessError("deny").message).toBe("Project not found.");
  });
});
