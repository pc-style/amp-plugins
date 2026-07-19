# Amp Plugins

A small catalog of Amp plugins. The files in `plugins/` are the source of truth for both installation and the catalog website.

## Compressr

`compressr.ts` adds Fable Cmp low and GPT5.5 Cmp low modes. Successful long tool results are compressed through Compresr before they re-enter model context. Set `COMPRESR_API_KEY` to enable compression.

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
