import type {
  HalSessionBody,
  HalSessionSuccess,
  LibrarianAskBody,
  LibrarianAskSuccess,
} from "./librarianApiTypes";

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

/**
 * POST `/api/librarian/ask` — server delegates to `LibrarianChat.ask`.
 */
export async function postLibrarianAsk(
  body: LibrarianAskBody,
  options?: { baseUrl?: string; fetchImpl?: typeof fetch }
): Promise<LibrarianAskSuccess> {
  const f = options?.fetchImpl ?? fetch;
  const url = joinUrl(options?.baseUrl ?? "", "/api/librarian/ask");
  const res = await f(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    const err = (json?.error as string) || res.statusText || "Librarian request failed";
    throw new Error(err);
  }
  if (!json || json.ok !== true || typeof json.answer !== "string") {
    throw new Error("Unexpected librarian response shape");
  }
  return json as unknown as LibrarianAskSuccess;
}

/**
 * POST `/api/hal/session` — forwards `locale`, IME fields, and keystroke rhythm.
 */
export async function postHalSession(
  body: HalSessionBody,
  options?: { baseUrl?: string; fetchImpl?: typeof fetch }
): Promise<HalSessionSuccess> {
  const f = options?.fetchImpl ?? fetch;
  const url = joinUrl(options?.baseUrl ?? "", "/api/hal/session");
  const res = await f(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    const err = (json?.error as string) || res.statusText || "HAL session failed";
    throw new Error(err);
  }
  if (!json || json.ok !== true) {
    throw new Error("Unexpected HAL session response shape");
  }
  return json as unknown as HalSessionSuccess;
}
