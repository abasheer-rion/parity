import { describe, expect, it } from "vitest";
import { codeProblem, emailProblem, passwordProblem, passwordRules } from "../src/auth/rules";

describe("password rules", () => {
  it.each([
    ["", "Choose a password."],
    ["short1", "Use at least 10 characters."],
    ["onlyletterslong", "Use both letters and numbers."],
    ["1234567890123", "Use both letters and numbers."],
    ["a".repeat(72) + "1", "Use no more than 72 characters."],
    ["correct horse 42", null],
    ["Ab345678901", null],
  ])("%j -> %j", (pw, want) => {
    expect(passwordProblem(pw)).toBe(want);
  });

  it("counts bytes for the upper limit, as Supabase does", () => {
    // 36 two-byte characters are 72 bytes: fine. 37 are too many.
    expect(passwordProblem("é".repeat(35) + "a1")).toBeNull();
    expect(passwordProblem("é".repeat(36) + "a1")).toBe("Use no more than 72 characters.");
  });

  it("lists each rule with its state", () => {
    const rules = passwordRules("abc");
    expect(rules.map((r) => [r.id, r.ok])).toEqual([["length", false], ["letter", true], ["number", false], ["max", true]]);
  });
});

describe("email and code checks", () => {
  it.each([
    ["", "Enter your email."],
    ["name", "Enter a full email address, like name@example.com."],
    ["name@host", "Enter a full email address, like name@example.com."],
    ["a b@c.com", "Enter a full email address, like name@example.com."],
    [" name@example.com ", null],
  ])("email %j", (email, want) => {
    expect(emailProblem(email)).toBe(want);
  });

  it.each([
    ["", "Type the code."],
    ["12345", "The code is 6 digits."],
    ["12a456", "The code is 6 digits."],
    ["123456", null],
    ["12345678", null],
  ])("code %j", (code, want) => {
    expect(codeProblem(code)).toBe(want);
  });
});
