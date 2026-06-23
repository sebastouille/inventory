import { describe, expect, it } from "vitest";
import { parseScanPayload } from "./inventory-campaigns";

describe("parseScanPayload", () => {
  it("parses spatial node payloads", () => {
    expect(parseScanPayload(" NODE:abc ")).toEqual({
      kind: "NODE",
      rawPayload: "NODE:abc",
      value: "abc"
    });
  });

  it("parses equipment payloads", () => {
    expect(parseScanPayload("EQ:AST-001")).toEqual({
      kind: "EQUIPMENT",
      rawPayload: "EQ:AST-001",
      value: "AST-001"
    });
  });

  it("rejects invalid payloads", () => {
    expect(parseScanPayload("AST-001")).toEqual({
      kind: "INVALID",
      rawPayload: "AST-001",
      value: "AST-001"
    });
  });
});
