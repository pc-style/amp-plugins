# Amp Plugins

Personal Amp plugin collection for [Amp](https://ampcode.com). These plugins are meant to be installed into Amp's plugin directory one at a time, or copied as a whole collection.

## Plugin locations

Amp loads TypeScript plugins from:

- global/user-wide plugins: `~/.config/amp/plugins/*.ts`
- project-specific plugins: `.amp/plugins/*.ts` inside a workspace

After installing or updating a plugin, run `plugins: reload` from Amp's command palette, or restart Amp.

## Clone this repository

```bash
git clone https://github.com/pc-style/amp-plugins.git ~/projects/03-CLI-Tools/amp-plugins
cd ~/projects/03-CLI-Tools/amp-plugins
bun run check
```

## Install a single plugin globally

Copy a single plugin into your global Amp plugin directory:

```bash
mkdir -p ~/.config/amp/plugins
cp plugins/danger-sense.ts ~/.config/amp/plugins/danger-sense.ts
```

Or symlink it so updates in this repo are reflected immediately after `plugins: reload`:

```bash
mkdir -p ~/.config/amp/plugins
ln -sf "$PWD/plugins/danger-sense.ts" ~/.config/amp/plugins/danger-sense.ts
```

## Install a single plugin into one project

From a project workspace:

```bash
mkdir -p .amp/plugins
cp ~/projects/03-CLI-Tools/amp-plugins/plugins/danger-sense.ts .amp/plugins/danger-sense.ts
```

Or symlink it:

```bash
mkdir -p .amp/plugins
ln -sf ~/projects/03-CLI-Tools/amp-plugins/plugins/danger-sense.ts .amp/plugins/danger-sense.ts
```

## One-command global installs

Run these from the cloned repository root.

```bash
# Danger Sense: blocks/approves risky tool calls
mkdir -p ~/.config/amp/plugins && cp plugins/danger-sense.ts ~/.config/amp/plugins/danger-sense.ts

# Auto QA Loop: verifies changed work and auto-continues on failure
mkdir -p ~/.config/amp/plugins && cp plugins/auto-qa-loop.ts ~/.config/amp/plugins/auto-qa-loop.ts

# Cursor Composer Subagents: routes Amp Task calls through Cursor SDK agents
mkdir -p ~/.config/amp/plugins && cp plugins/cursor-composer-subagents.ts ~/.config/amp/plugins/cursor-composer-subagents.ts

# Design Upgrade Modes: adds visual-design-focused agent modes and commands
mkdir -p ~/.config/amp/plugins && cp plugins/design-upgrade-modes.ts ~/.config/amp/plugins/design-upgrade-modes.ts

# Grok Build: adds xAI Grok Build as an Amp agent mode
mkdir -p ~/.config/amp/plugins && cp plugins/grok-build.ts ~/.config/amp/plugins/grok-build.ts

# Headroom: compresses large tool outputs through a local Headroom proxy
mkdir -p ~/.config/amp/plugins ~/.config/amp/plugins/headroom && cp plugins/headroom.ts ~/.config/amp/plugins/headroom.ts && cp plugins/headroom/lib.ts ~/.config/amp/plugins/headroom/lib.ts

# No Mistakes: injects a hidden reminder when NO_MISTAKES=1
mkdir -p ~/.config/amp/plugins && cp plugins/no-mistakes.ts ~/.config/amp/plugins/no-mistakes.ts

# Details Default: asks Amp clients to expand details by default
mkdir -p ~/.config/amp/plugins && cp plugins/show-details-default.ts ~/.config/amp/plugins/show-details-default.ts
```

## Install every active plugin globally

This overwrites files with the same names in `~/.config/amp/plugins`.

```bash
mkdir -p ~/.config/amp/plugins
rsync -a --exclude='.disabled/' plugins/ ~/.config/amp/plugins/
```

## Plugins

### `danger-sense.ts`

Safety guardrails for Amp tool calls.

- Hooks `tool.call`.
- Blocks clearly destructive shell commands, including broad recursive force deletes, hard git resets, git cleans, force pushes, infra destroys, Kubernetes deletes, disk formatting, and world-writable chmods.
- Requires UI approval for risky-but-legitimate operations, including production deploys, database migrations, infra applies, Kubernetes mutations, and recursive permission/ownership changes.
- Requires UI approval before modifying sensitive files such as `.env*`, private keys, credentials/secrets files, and Terraform state/vars.

Commands:

- `Danger Sense: Toggle guardrails`
- `Danger Sense: Show status`

### `auto-qa-loop.ts`

Post-turn verification loop for completed agent work.

- Hooks `agent.end`.
- Detects files changed during the agent turn.
- Runs configured verification commands, or auto-detects a project check:
  - JavaScript/TypeScript package scripts: `tb__tsc-lint-build`, `check`, `verify`, `ci`, `typecheck`, `lint`, `test`, or `build`
  - Rust: `cargo check`
  - Go: `go test ./...`
  - Python: `python -m pytest`
- If verification fails, automatically continues the thread with the failing command and truncated output.
- Limits automatic fix loops to a small max attempt count to avoid runaway retries.

Commands:

- `Auto QA Loop: Toggle automatic verification`
- `Auto QA Loop: Show status`
- `Auto QA Loop: Run verification now`

Configuration key: `autoQaLoop`

```json
{
  "autoQaLoop": {
    "enabled": true,
    "maxAttempts": 2,
    "timeoutMs": 120000,
    "commands": [],
    "includeBuildFallback": true
  }
}
```

### `cursor-composer-subagents.ts`

Optional replacement for Amp's `Task` tool that routes subagent prompts through Cursor's local SDK using Composer models.

- Hooks `tool.call` for `Task` calls.
- When enabled, synthesizes the Task result by calling the Cursor SDK.
- Configurable API key environment variable, model, thinking effort, and working directory.
- Disabled by default.

Commands:

- `Cursor Subagents: Toggle composer-2.5 Task replacement`
- `Cursor Subagents: Enable composer-2.5 Task replacement`
- `Cursor Subagents: Disable composer-2.5 Task replacement`
- `Cursor Subagents: Open settings`

Default API key environment variable: `CURSOR_API_KEY`

### `design-upgrade-modes.ts`

Experimental design-focused agent modes and command shortcuts for UI refinement work.

- Uses Amp's experimental agent APIs.
- Registers multiple Fable/Sonnet design-oriented modes with different reasoning efforts.
- Adds command-palette actions that start visible design-upgrade threads.
- Embeds a high-taste frontend design prompt that pushes agents away from generic template aesthetics.

Commands:

- `Design Upgrade: MODER-nize with Fable`
- `Design Upgrade: FANCIER-nize with Fable`
- `Design Upgrade: SEO-nize with Sonnet`

Agent modes include:

- `claude-fable-5`
- `claude-fable-low`
- `claude-fable-med`
- `claude-fable-xhi`
- `claude-fable-max`
- `sonnet-4-6`

### `grok-build.ts`

Experimental agent-mode plugin for xAI Grok Build.

- Uses Amp's experimental agent APIs.
- Registers `xai/grok-build-0.1` with the Amp toolset.
- Adds a compact command that points users to the mode switcher.

Commands:

- `Mode: Switch to Build`

Agent mode:

- `Grok Build`

### `headroom.ts` and `headroom/lib.ts`

Tool-result compression plugin for large outputs.

- Hooks `tool.result`.
- Sends large tool outputs to a local Headroom-compatible compression proxy.
- Replaces oversized outputs with compressed text when compression succeeds.
- Tracks estimated token savings in a status item.
- Registers a retrieval tool so agents can fetch original uncompressed content by hash.

Commands:

- `Headroom: Toggle Headroom compression`

Tools:

- `headroom_retrieve`

Important: this plugin imports `./headroom/lib.js`, so install `plugins/headroom.ts` and the `plugins/headroom/` directory together.

Default proxy URL: `http://127.0.0.1:8787`

Configuration keys:

```json
{
  "headroom.enabled": true,
  "headroom.proxyUrl": "http://127.0.0.1:8787",
  "headroom.proxyPort": 8787,
  "headroom.minCompressChars": 500
}
```

### `no-mistakes.ts`

Tiny prompt-injection helper for stricter sessions.

- Hooks `agent.start`.
- If `NO_MISTAKES=1` is present in the Amp environment, injects a hidden `Make no mistakes!` reminder.
- Does nothing when the environment variable is absent.

Usage:

```bash
NO_MISTAKES=1 amp
```

### `show-details-default.ts`

Preference helper that persists settings asking Amp clients to show details expanded by default.

- Reads/writes global Amp configuration.
- Sets several known details-expanded setting keys for compatibility across clients/builds.

Commands:

- `Details Default: Enable details by default`
- `Details Default: Disable details by default`
- `Details Default: Toggle details by default`

### `.disabled/eco.ts`

Disabled experimental token-economy plugin.

- Kept in `plugins/.disabled/` so Amp does not load it automatically.
- Intended to reduce token-heavy behavior by blocking token-bomb shell commands, truncating large tool results, optionally disabling expensive/fancy tools, and injecting economy-mode guidance.
- Treat as experimental before enabling.

To try it, copy it out of `.disabled`:

```bash
cp plugins/.disabled/eco.ts ~/.config/amp/plugins/eco.ts
```

## Development

Validate plugin syntax with Bun:

```bash
bun run check
```

List plugins seen by your local Amp install:

```bash
amp plugins list
```

Show the current plugin API supported by your Amp build:

```bash
amp plugins show-docs
```
