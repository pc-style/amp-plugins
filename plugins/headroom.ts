import type { PluginAPI } from "./ampcode-plugin.js";

import {
  compressTextViaProxy,
  isCompressionEnabled,
  minCompressChars,
  resolveProxyUrl,
  retrieveFromProxy,
  serializeToolOutput,
  type HeadroomWorkspaceConfig,
} from "./headroom/lib.js";

const RETRIEVE_TOOL = "headroom_retrieve";
const TOGGLE_COMMAND = "headroom.toggle";
const COMMAND_CATEGORY = "Headroom";

export default function headroomAmpPlugin(amp: PluginAPI) {
  let totalTokensSaved = 0;
  const statusItem = amp.createStatusItem({ text: "headroom: ready" });

  async function readConfig(): Promise<HeadroomWorkspaceConfig> {
    const config = (await amp.configuration.get()) as HeadroomWorkspaceConfig;
    return config ?? {};
  }

  async function proxyUrl(): Promise<string> {
    return resolveProxyUrl(await readConfig());
  }

  async function setEnabled(enabled: boolean): Promise<void> {
    const current = await readConfig();
    const next = { ...current, "headroom.enabled": enabled };
    if (typeof amp.configuration.update === "function") {
      await amp.configuration.update(next);
    }
    statusItem.update({ text: enabled ? "headroom: enabled" : "headroom: disabled" });
  }

  statusItem.update({ text: "headroom: ready" });

  amp.registerCommand?.(
    TOGGLE_COMMAND,
    {
      title: "Toggle Headroom compression",
      category: COMMAND_CATEGORY,
      description: "Toggle Headroom compression for this workspace.",
    },
    async (_ctx: unknown, input?: Record<string, unknown>) => {
      const config = await readConfig();
      const requested = input?.enabled;
      const enabled = typeof requested === "boolean" ? requested : !isCompressionEnabled(config);
      await setEnabled(enabled);
      return enabled
        ? "Headroom enabled. Run `headroom wrap amp` in this workspace to keep the proxy running."
        : "Headroom disabled. Compression will stop after plugins reload; stop any headroom proxy process when you are done.";
    },
  );

  amp.on("tool.result", async (event, ctx) => {
    if (event.status !== "done" || event.tool === RETRIEVE_TOOL) {
      return;
    }

    const config = await readConfig();
    if (!isCompressionEnabled(config)) {
      statusItem.update({ text: "headroom: disabled" });
      return;
    }

    const raw = serializeToolOutput(event.output);
    if (!raw || raw.length < minCompressChars(config)) {
      return;
    }

    try {
      const baseUrl = await proxyUrl();
      const { text, tokensSaved } = await compressTextViaProxy(baseUrl, raw);
      if (tokensSaved > 0) {
        totalTokensSaved += tokensSaved;
        statusItem.update({
          text: `headroom: ${totalTokensSaved.toLocaleString()} tokens saved`,
        });
      }

      if (text !== raw) {
        return { status: "done", output: text };
      }
    } catch (error) {
      ctx.logger.log(`[headroom] tool.result compression failed: ${error}`);
    }
  });

  amp.registerTool({
    name: RETRIEVE_TOOL,
    description:
      "Retrieve original uncompressed content from Headroom's compression store. " +
      "Use when compressed tool output mentions a hash and you need full details. " +
      "Pass the 24-character hex hash from the compression marker.",
    inputSchema: {
      type: "object",
      properties: {
        hash: {
          type: "string",
          description: "The 24-character hex hash from the compression marker",
        },
        query: {
          type: "string",
          description: "Optional search query to filter within the original content",
        },
      },
      required: ["hash"],
    },
    async execute(input: Record<string, unknown>) {
      const hash = typeof input.hash === "string" ? input.hash : "";
      const query = typeof input.query === "string" ? input.query : undefined;
      const baseUrl = await proxyUrl();
      return retrieveFromProxy(baseUrl, hash, query);
    },
  });

  amp.logger.log("[headroom] Amp plugin loaded");
}
