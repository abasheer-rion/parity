// The password strength bar's scoring (src/auth/strength.ts).
import { describe, expect, it } from "vitest";
import { isGuessable, passwordStrength } from "../src/auth/strength";

describe("password strength", () => {
  it("is empty for no password", () => {
    expect(passwordStrength("")).toEqual({ score: 0, label: "" });
  });

  it("stays at the first step until the rules are met", () => {
    expect(passwordStrength("short1").score).toBe(1);
    expect(passwordStrength("onlyletterslong").score).toBe(1);
    expect(passwordStrength("12345678901234").score).toBe(1);
  });

  it("marks common and patterned passwords as easy to guess", () => {
    expect(passwordStrength("password123")).toEqual({ score: 1, label: "Easy to guess" });
    expect(passwordStrength("aaaaaaaaa1")).toEqual({ score: 1, label: "Easy to guess" });
    expect(passwordStrength("xabcdefgh1")).toEqual({ score: 1, label: "Easy to guess" });
    expect(isGuessable("amanda2026xyz", "amanda@example.com")).toBe(true);
    expect(isGuessable("rivet lamp 47")).toBe(false);
  });

  it("rises with length and variety", () => {
    expect(passwordStrength("rivetlamp47").label).toBe("Fair");
    expect(passwordStrength("Rivetlamp47").label).toBe("Good");
    expect(passwordStrength("rivetlampquiet47").label).toBe("Good");
    expect(passwordStrength("Rivet lamp quiet 47").label).toBe("Strong");
    expect(passwordStrength("rivet lamp quiet ocean 47").label).toBe("Strong");
  });
});
