import type { ValidationIssue, IssueSeverity } from "../types/validation.types";

export type Fa3BuildContextOptions = {
  mode?: "collect" | "throw";   // collect = zwracamy issues, throw = rzucamy jak są error
};

export class Fa3BuildContext {
  public readonly issues: ValidationIssue[] = [];

  constructor(
    public readonly opts: Fa3BuildContextOptions,
    private readonly validateNipFn: (nip: string) => boolean
  ) {}

  private add(severity: IssueSeverity, builder: string, code: string, path: string, message: string) {
    this.issues.push({ severity, builder, code, path, message });
  }

  error(builder: string, code: string, path: string, message: string): void {
    this.add("error", builder, code, path, message);
  }

  warn(builder: string, code: string, path: string, message: string): void {
    this.add("warning", builder, code, path, message);
  }

  hasErrors(): boolean {
    return this.issues.some(i => i.severity === "error");
  }

  requireString(builder: string, path: string, value: unknown, message: string): value is string {
    if (typeof value === "string" && value.trim() !== "") return true;
    this.error(builder, "REQUIRED", path, message);
    return false;
  }

  requireOneOf<T extends string | number>(
    builder: string,
    path: string,
    value: unknown,
    allowed: readonly T[],
    message: string
  ): value is T {
    if ((allowed as readonly unknown[]).includes(value)) return true;
    this.error(builder, "ONE_OF", path, `${message}. Allowed: ${allowed.join(", ")}`);
    return false;
  }

  requireArray(builder: string, path: string, value: unknown, message: string): value is unknown[] {
    if (Array.isArray(value) && value.length > 0) return true;
    this.error(builder, "REQUIRED_ARRAY", path, message);
    return false;
  }

  requireNip(builder: string, path: string, value: unknown, message: string): value is string {
    if (typeof value !== "string" || value.trim() === "") {
      this.error(builder, "REQUIRED", path, message);
      return false;
    }
    if (!this.validateNipFn(value)) {
      this.error(builder, "INVALID_NIP", path, `Niepoprawny NIP: ${value}`);
      return false;
    }
    return true;
  }
}
