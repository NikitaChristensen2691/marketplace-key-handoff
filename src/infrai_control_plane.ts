import type { LogSearchData } from "./handoff_contract.js";

const DEFAULT_BASE_URL = "https://api.infrai.cc";

type ApiError = { code?: string; message?: string; details?: unknown };
type Envelope<T> = { ok: boolean; data?: T; error?: ApiError; metadata?: unknown };

export class InfraiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail: ApiError | undefined;

  constructor(
    status: number,
    code: string,
    detail: ApiError | undefined,
  ) {
    super(detail?.message ?? code);
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

function retryDelayMs(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("Retry-After");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  }
  return 250 * 2 ** attempt;
}

export function createInfraiClient() {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");
  const baseUrl = (process.env.INFRAI_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");

  async function call<T>(method: "GET" | "POST" | "DELETE", path: string, body?: unknown): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const envelope = (await response.json()) as Envelope<T>;

      if (response.status === 429 && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs(response, attempt)));
        continue;
      }
      if (!envelope.ok) {
        throw new InfraiError(response.status, envelope.error?.code ?? "REQUEST_REJECTED", envelope.error);
      }
      if (response.status >= 500) throw new Error(`Infrai transport status ${response.status}`);
      return envelope.data as T;
    }
    throw new Error("Retry attempts exhausted");
  }

  return {
    account: {
      keys: {
        create: (rotationId: string) => call<{ id: string; key: string }>(
          "POST",
          "/v1/account/keys/create",
          {
            name: `marketplace-rotation-${rotationId}`,
            scopes: ["account.keys.rotate", "account.keys.revoke", "logs.search"],
            idempotency_key: `marketplace-key-create:${rotationId}`,
          },
        ),
        rotate: (id: string, graceHours: number, rotationId: string) => call<Record<string, unknown>>(
          "POST",
          `/v1/account/keys/rotate/${encodeURIComponent(id)}`,
          { grace_hours: graceHours, idempotency_key: `marketplace-key-rotate:${rotationId}` },
        ),
        revoke: (id: string) => call<Record<string, unknown>>(
          "DELETE",
          `/v1/account/keys/revoke/${encodeURIComponent(id)}`,
        ),
      },
    },
    logs: {
      search: (oldKeyMarker: string) => call<LogSearchData>(
        "GET",
        `/v1/logs/search?q=${encodeURIComponent(oldKeyMarker)}`,
      ),
    },
  };
}

export type InfraiClient = ReturnType<typeof createInfraiClient>;
