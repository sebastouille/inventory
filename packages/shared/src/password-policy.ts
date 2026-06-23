export interface PasswordPolicyRule {
  key:
    | "minLength"
    | "uppercase"
    | "lowercase"
    | "digit"
    | "special"
    | "noSpaces";
  label: string;
  valid: boolean;
}

const PASSWORD_SPECIAL_CHARACTER_PATTERN = /[^A-Za-z0-9\s]/;

export function evaluatePasswordPolicy(password: string): PasswordPolicyRule[] {
  return [
    {
      key: "minLength",
      label: "8 caracteres minimum",
      valid: password.length >= 8
    },
    {
      key: "uppercase",
      label: "Au moins une majuscule",
      valid: /[A-Z]/.test(password)
    },
    {
      key: "lowercase",
      label: "Au moins une minuscule",
      valid: /[a-z]/.test(password)
    },
    {
      key: "digit",
      label: "Au moins un chiffre",
      valid: /\d/.test(password)
    },
    {
      key: "special",
      label: "Au moins un caractere special",
      valid: PASSWORD_SPECIAL_CHARACTER_PATTERN.test(password)
    },
    {
      key: "noSpaces",
      label: "Aucun espace",
      valid: !/\s/.test(password)
    }
  ];
}

export function isPasswordPolicySatisfied(password: string) {
  return evaluatePasswordPolicy(password).every((rule) => rule.valid);
}

export function listPasswordPolicyViolations(password: string) {
  return evaluatePasswordPolicy(password)
    .filter((rule) => !rule.valid)
    .map((rule) => rule.label);
}
