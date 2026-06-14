# Amp Plugins

Personal Amp plugin collection synced from `~/.config/amp/plugins`.

## Layout

- `plugins/*.ts` contains active global Amp plugins.
- `plugins/headroom/` contains shared Headroom plugin helpers.
- `plugins/.disabled/` contains plugins intentionally kept out of the active runtime.

## Use

Amp loads plugins from `~/.config/amp/plugins/*.ts` globally, or `.amp/plugins/*.ts` per workspace.

To use one of these plugins, copy or symlink the desired plugin file into one of those locations, then run `plugins: reload` in Amp.

## Validation

```bash
bun run check
```

This performs Bun syntax checks over the TypeScript plugin files.
