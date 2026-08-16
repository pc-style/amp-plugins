# Amp Plugins

An experimental suite of inspectable Amp plugins for agent modes, tools, and context filtering. The files in `plugins/` are the installable source.

> [!IMPORTANT]
> **Status: experiment suite.** These plugins depend on current or experimental Amp plugin APIs and model availability; individual files can stop working as those interfaces change. They are TypeScript plugins for [Amp](https://ampcode.com), loaded from `~/.config/amp/plugins`. They are not OpenAI Codex plugins, Codex skills, or Codex configuration.

Install commands below use immutable commit `cda601dfab62e7306b80a62f1cff7922d2695256`. There are no tagged releases or signed bundles. Review each file before installing it, and change the commit deliberately when upgrading.

## GPT-5.6 Sol Mode

`gpt-56-sol-mode.ts` adds GPT-5.6 Sol at high reasoning with Amp's full tool set. The model may work even when it has not yet appeared in `amp plugins show-agent-options` because the plugin API accepts provider-qualified model IDs.

```bash
mkdir -p ~/.config/amp/plugins && curl -fsSL https://raw.githubusercontent.com/pc-style/amp-plugins/cda601dfab62e7306b80a62f1cff7922d2695256/plugins/gpt-56-sol-mode.ts -o ~/.config/amp/plugins/gpt-56-sol-mode.ts
```

## GPT-5.6 Terra Mode

`gpt-56-terra-mode.ts` adds the balanced GPT-5.6 Terra model at high reasoning with Amp's full tool set.

```bash
mkdir -p ~/.config/amp/plugins && curl -fsSL https://raw.githubusercontent.com/pc-style/amp-plugins/cda601dfab62e7306b80a62f1cff7922d2695256/plugins/gpt-56-terra-mode.ts -o ~/.config/amp/plugins/gpt-56-terra-mode.ts
```

## GPT-5.6 Luna Mode

`gpt-56-luna-mode.ts` adds the fast, low-cost GPT-5.6 Luna model at high reasoning with Amp's full tool set.

```bash
mkdir -p ~/.config/amp/plugins && curl -fsSL https://raw.githubusercontent.com/pc-style/amp-plugins/cda601dfab62e7306b80a62f1cff7922d2695256/plugins/gpt-56-luna-mode.ts -o ~/.config/amp/plugins/gpt-56-luna-mode.ts
```

## Compressr

`compressr.ts` adds Fable Cmp low, GPT5.6 Sol Cmp low, and Opus5 Cmp med modes. With `COMPRESR_API_KEY` set, it sends up to 180,000 characters of each eligible tool result plus the tool name/input and up to 4,000 characters from the four most recent user messages to `api.compresr.ai`. Compresr returns a lossy compressed result before it re-enters model context. Do not use these modes when that content may contain secrets or private code you cannot send to Compresr.

```bash
mkdir -p ~/.config/amp/plugins && curl -fsSL https://raw.githubusercontent.com/pc-style/amp-plugins/cda601dfab62e7306b80a62f1cff7922d2695256/plugins/compressr.ts -o ~/.config/amp/plugins/compressr.ts
```

## Read X Post

`read-x-post.ts` adds a `read_x_post` tool that turns public X and Twitter status URLs into Markdown through [x.pcstyle.dev](https://x.pcstyle.dev). It expands reply chains by default, needs no X API key, and can read a single post with `thread: "off"`.

```bash
mkdir -p ~/.config/amp/plugins && curl -fsSL https://raw.githubusercontent.com/pc-style/amp-plugins/cda601dfab62e7306b80a62f1cff7922d2695256/plugins/read-x-post.ts -o ~/.config/amp/plugins/read-x-post.ts
```

## Signal Filter Experimental

`signal-filter.ts` adds Fable Signal exp, Sol Signal exp, and Opus5 Signal exp modes. It uses Amp-routed `amp/glm-5.2` inference at no reasoning to retain task-relevant excerpts from long text tool results, with no separate API key. Filtering is lossy and experimental; unsupported, insufficiently reduced, timed-out, and failed results remain unchanged.

```bash
mkdir -p ~/.config/amp/plugins && curl -fsSL https://raw.githubusercontent.com/pc-style/amp-plugins/cda601dfab62e7306b80a62f1cff7922d2695256/plugins/signal-filter.ts -o ~/.config/amp/plugins/signal-filter.ts
```

## Fable Mode

`fable-mode.ts` adds Claude Fable 5 at high reasoning plus low, medium, xhigh, and max variants through Amp's experimental agent APIs.

```bash
mkdir -p ~/.config/amp/plugins && curl -fsSL https://raw.githubusercontent.com/pc-style/amp-plugins/cda601dfab62e7306b80a62f1cff7922d2695256/plugins/fable-mode.ts -o ~/.config/amp/plugins/fable-mode.ts
```

After installing a plugin, run `plugins: reload` from Amp's command palette or restart Amp.

## Trust, privacy, and provenance

- Installed plugins execute inside Amp with the tools and agent APIs declared in their source. A commit pin prevents silent source drift; it does not sandbox the plugin or establish publisher identity.
- Model-mode plugins send prompts and tool use through Amp to the selected model provider under your Amp configuration.
- `signal-filter.ts` sends eligible long tool output, tool input, and recent user messages through Amp's AI API to `amp/glm-5.2`. Filtering is lossy.
- `read-x-post.ts` sends the public X/Twitter status URL to `x.pcstyle.dev`; that service has its own provider and cache boundary.
- `compressr.ts` has the additional direct Compresr transmission described above. Without `COMPRESR_API_KEY`, its tool-result compression is disabled.
- The catalog website fetches plugin source from the pinned GitHub commit and uses Vercel Analytics. Its browser-computed SHA-256 lets you compare downloaded bytes with the displayed source; it is not a signature.

`fable-mode.ts` carries an upstream marker for Amp's published Fable plugin and is adapted in this suite; the remaining plugins are maintained here. This repository is the canonical catalog and has no successor. All files are available under the [MIT license](LICENSE).

## Site development

The catalog is a Vite and React static site. Detail pages fetch plugin source from the same immutable raw URLs used by their install commands.

```bash
bun install
bun run dev
```

Run the full local verification or create a production build:

```bash
bun run check
bun run build
```

Site development uses Bun 1.3.14 and locked dependencies. Plugin compatibility is capability-based because the repository does not yet publish a minimum Amp version; each detail page lists the APIs and model access it requires.
