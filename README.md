# Amp Plugins

A small catalog of Amp plugins. The files in `plugins/` are the source of truth for both installation and the catalog website.

## GPT-5.6 Sol Mode

`gpt-56-sol-mode.ts` adds GPT-5.6 Sol at high reasoning with Amp's full tool set. The model may work even when it has not yet appeared in `amp plugins show-agent-options` because the plugin API accepts provider-qualified model IDs.

```bash
mkdir -p ~/.config/amp/plugins && curl -fsSL https://raw.githubusercontent.com/pc-style/amp-plugins/main/plugins/gpt-56-sol-mode.ts -o ~/.config/amp/plugins/gpt-56-sol-mode.ts
```

## GPT-5.6 Terra Mode

`gpt-56-terra-mode.ts` adds the balanced GPT-5.6 Terra model at high reasoning with Amp's full tool set.

```bash
mkdir -p ~/.config/amp/plugins && curl -fsSL https://raw.githubusercontent.com/pc-style/amp-plugins/main/plugins/gpt-56-terra-mode.ts -o ~/.config/amp/plugins/gpt-56-terra-mode.ts
```

## GPT-5.6 Luna Mode

`gpt-56-luna-mode.ts` adds the fast, low-cost GPT-5.6 Luna model at high reasoning with Amp's full tool set.

```bash
mkdir -p ~/.config/amp/plugins && curl -fsSL https://raw.githubusercontent.com/pc-style/amp-plugins/main/plugins/gpt-56-luna-mode.ts -o ~/.config/amp/plugins/gpt-56-luna-mode.ts
```

## Compressr

`compressr.ts` adds Fable Cmp low and GPT5.6 Sol Cmp low modes. Successful long tool results are compressed through Compresr before they re-enter model context. Set `COMPRESR_API_KEY` to enable compression.

```bash
mkdir -p ~/.config/amp/plugins && curl -fsSL https://raw.githubusercontent.com/pc-style/amp-plugins/main/plugins/compressr.ts -o ~/.config/amp/plugins/compressr.ts
```

## Fable Mode

`fable-mode.ts` adds Claude Fable 5 at high reasoning plus low, medium, xhigh, and max variants through Amp's experimental agent APIs.

```bash
mkdir -p ~/.config/amp/plugins && curl -fsSL https://raw.githubusercontent.com/pc-style/amp-plugins/main/plugins/fable-mode.ts -o ~/.config/amp/plugins/fable-mode.ts
```

After installing a plugin, run `plugins: reload` from Amp's command palette or restart Amp.

## Site development

The catalog is a Vite and React static site. Plugin source is imported directly with Vite raw imports, so website code samples cannot drift from the installable files.

```bash
bun install
bun run dev
```

Run the full local verification or create a production build:

```bash
bun run check
bun run build
```
