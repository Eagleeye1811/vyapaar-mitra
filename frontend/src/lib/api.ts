import type {
  OperationalMetricsPayload,
  OperationalAnalysisResponse,
} from "@/types/assessment";

/**
 * Base URL of the FastAPI backend. Override via `NEXT_PUBLIC_API_BASE_URL`
 * (see `.env.local`); defaults to the local dev server.
 */
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Extract a readable message from FastAPI's error shapes (422 detail / 500). */
async function readError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (Array.isArray(body?.detail)) {
      // Pydantic validation errors.
      return body.detail
        .map((d: { msg?: string; loc?: (string | number)[] }) =>
          d.loc ? `${d.loc.join(".")}: ${d.msg}` : d.msg,
        )
        .join("; ");
    }
    if (typeof body?.detail === "string") return body.detail;
    return JSON.stringify(body);
  } catch {
    return res.statusText || `Request failed (${res.status})`;
  }
}

/** Call POST /api/analyze-operations and return the parsed analysis. */
export async function analyzeOperations(
  payload: OperationalMetricsPayload,
): Promise<OperationalAnalysisResponse> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/analyze-operations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new ApiError(
      `Could not reach the API at ${API_BASE_URL}. Is the backend running (python3 -m uvicorn main:app --port 8000)?`,
      0,
    );
  }

  if (!res.ok) {
    throw new ApiError(await readError(res), res.status);
  }
  return (await res.json()) as OperationalAnalysisResponse;
}
