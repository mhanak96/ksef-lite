import type { ValidationIssue } from "../types/validation.types";

export class Fa3ValidationError extends Error {
  constructor(public readonly issues: ValidationIssue[]) {
    super(`FA(3) validation failed (${issues.filter(i => i.severity === "error").length} errors)`);
    this.name = "Fa3ValidationError";
  }
}
