# Amp Plugins

Personal Amp plugins synced from `~/projects/07-Agents/Orbs/personal-plugins` for web and orb threads.

## Plugins

- `compressr.ts` adds low-reasoning Claude Fable 5 and GPT-5.5 modes that compress long tool results through Compresr. Set `COMPRESR_API_KEY` to enable compression.
- `fable-mode.ts` adds Claude Fable 5 agent modes at low, medium, high, extra-high, and maximum reasoning levels.

## Install

Install every plugin globally:

```bash
mkdir -p ~/.config/amp/plugins
curl -fsSL https://raw.githubusercontent.com/pc-style/amp-plugins/main/plugins/compressr.ts -o ~/.config/amp/plugins/compressr.ts
curl -fsSL https://raw.githubusercontent.com/pc-style/amp-plugins/main/plugins/fable-mode.ts -o ~/.config/amp/plugins/fable-mode.ts
```

Then run `plugins: reload` from Amp's command palette or restart Amp.

## Development

```bash
bun run check
```
