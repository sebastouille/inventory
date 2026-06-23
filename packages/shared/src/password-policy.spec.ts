import { describe, expect, it } from "vitest";
import { evaluatePasswordPolicy, isPasswordPolicySatisfied, listPasswordPolicyViolations } from "./password-policy";

describe("password policy", () => {
  it("accepts a password that satisfies all rules", () => {
    expect(isPasswordPolicySatisfied("ChangeMe123!")).toBe(true);
    expect(evaluatePasswordPolicy("ChangeMe123!").every((rule) => rule.valid)).toBe(true);
  });

  it("lists unmet rules for an invalid password", () => {
    expect(isPasswordPolicySatisfied("abc")).toBe(false);
    expect(listPasswordPolicyViolations("abc")).toEqual([
      "8 caracteres minimum",
      "Au moins une majuscule",
      "Au moins un chiffre",
      "Au moins un caractere special"
    ]);
  });
});
