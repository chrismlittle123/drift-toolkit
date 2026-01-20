import { describe, it, expect } from "vitest";

describe("intentionally failing test", () => {
  it("should fail to verify branch protection", () => {
    expect(1).toBe(2); // This will fail
  });
});
