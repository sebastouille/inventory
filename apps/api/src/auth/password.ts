import { createHash } from "node:crypto";

export function hashPassword(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function buildPasswordChallengeVersion(passwordHash: string) {
  const secret = process.env.JWT_SECRET ?? "dev-change-me";
  return createHash("sha256").update(`${passwordHash}:${secret}`).digest("hex");
}
