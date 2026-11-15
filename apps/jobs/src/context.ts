// Shared run state: injected I/O, the call caps and the error counters.

export type Service = "exa" | "anthropic";

/** Counts calls per service and refuses calls past the cap. */
export class Budget {
  readonly limits: Record<Service, number>;
  readonly used: Record<Service, number> = { exa: 0, anthropic: 0 };

  constructor(limits: Record<Service, number>) {
    this.limits = limits;
  }

  /** Reserves one call. False when the cap is reached. */
  take(service: Service): boolean {
    if (this.used[service] >= this.limits[service]) return false;
    this.used[service] += 1;
    return true;
  }

  has(service: Service): boolean {
    return this.used[service] < this.limits[service];
  }
}

/** An error with a short code that is safe to log. */
export class JobError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "JobError";
    this.code = code;
  }
}

export function errorCode(error: unknown): string {
  if (error instanceof JobError) return error.code;
  if (error instanceof Error && error.name === "AbortError") return "timeout";
  if (error instanceof Error && error.name === "TimeoutError") return "timeout";
  return "unexpected_error";
}

export type RunContext = {
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  budget: Budget;
  now: Date;
  /** Adds one to an error counter. Only codes, never content. */
  count: (code: string) => void;
};
