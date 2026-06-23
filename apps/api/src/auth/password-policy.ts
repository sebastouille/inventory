import { BadRequestException } from "@nestjs/common";
import { listPasswordPolicyViolations } from "@inventory/shared";

export function assertPasswordPolicy(password: string, label = "Mot de passe") {
  const violations = listPasswordPolicyViolations(password);
  if (violations.length === 0) {
    return;
  }

  throw new BadRequestException(`${label} invalide : ${violations.join(", ")}`);
}
