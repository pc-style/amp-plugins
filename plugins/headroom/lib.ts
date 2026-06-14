/** Shared helpers for the Headroom Amp plugin (testable, no PluginAPI imports). */

export const DEFAULT_PROXY_PORT = 8787;
export const DEFAULT_MIN_COMPRESS_CHARS = 500;
export const HASH_PATTERN = /^[a-f0-9]{24}$/i;

export type HeadroomWorkspaceConfig = {
  "headroom.proxyUrl"?: string;
  "headroom.proxyPort"?: number;
  "headroom.minCompressChars"?: number;
  "headroom.enabled"?: boolean;
};

export function resolveProxyUrl(
  config: HeadroomWorkspaceConfig,
  fallbackPort = DEFAULT_PROXY_PORT,
): string {
  const explicit = config["headroom.proxyUrl"];
  if (typeof explicit === "string" && explicit.trim()) {
    return explicit.trim().replace(/\/$/, "");
  }

  const port = config["headroom.proxyPort"];
  if (typeof port === "number" && Number.isFinite(port) && port > 0) {
    return `http://127.0.0.1:${port}`;
  }

  return `http://127.0.0.1:${fallbackPort}`;
}

export function isCompressionEnabled(config: HeadroomWorkspaceConfig): boolean {
  return config["headroom.enabled"] !== false;
}

export function minCompressChars(config: HeadroomWorkspaceConfig): number {
  const value = config["headroom.minCompressChars"];
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  return DEFAULT_MIN_COMPRESS_CHARS;
}

export function serializeToolOutput(output: unknown): string | null {
  if (typeof output === "string") {
    return output;
  }
  if (output == null) {
    return null;
  }
  try {
    return JSON.stringify(output);
  } catch {
    return String(output);
  }
}

export function extractCompressedContent(data: Record<string, unknown>): string | null {
  const messages = data.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return null;
  }

  const first = messages[0] as { content?: unknown };
  if (typeof first?.content === "string") {
    return first.content;
  }

  return null;
}

export function tokensSavedFromResponse(data: Record<string, unknown>): number {
  const snake = data.tokens_saved;
  if (typeof snake === "number" && Number.isFinite(snake)) {
    return Math.max(0, Math.floor(snake));
  }

  const camel = data.tokensSaved;
  if (typeof camel === "number" && Number.isFinite(camel)) {
    return Math.max(0, Math.floor(camel));
  }

  return 0;
}

export async function compressTextViaProxy(
  proxyUrl: string,
  text: string,
  model = "claude-sonnet-4-5",
  fetchImpl: typeof fetch = fetch,
): Promise<{ text: string; tokensSaved: number }> {
  const response = await fetchImpl(`${proxyUrl}/v1/compress`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: text }],
      model,
      fallback: true,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    return { text, tokensSaved: 0 };
  }

  const data = (await response.json()) as Record<string, unknown>;
  const tokensSaved = tokensSavedFromResponse(data);
  const compressed = extractCompressedContent(data);
  if (!compressed || compressed === text) {
    return { text, tokensSaved: 0 };
  }

  return { text: compressed, tokensSaved };
}

export async function retrieveFromProxy(
  proxyUrl: string,
  hash: string,
  query: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  if (!HASH_PATTERN.test(hash)) {
    return JSON.stringify({
      error: "Invalid hash format. Expected 24 hex characters.",
    });
  }

  const url = query
    ? `${proxyUrl}/v1/retrieve/${hash}?query=${encodeURIComponent(query)}`
    : `${proxyUrl}/v1/retrieve/${hash}`;

  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return JSON.stringify({
        error: `Retrieval failed: HTTP ${response.status}`,
        details: body,
      });
    }

    const data = await response.json();
    return typeof data === "string" ? data : JSON.stringify(data);
  } catch (error) {
    return JSON.stringify({
      error: `Retrieval failed: ${error}`,
      hint: "The compressed content may have expired (default TTL: 5 minutes)",
    });
  }
}
