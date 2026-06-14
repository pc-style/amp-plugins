# Amp Plugins

Personal Amp plugin collection for [Amp](https://ampcode.com). These plugins are meant to be installed into Amp's plugin directory one at a time, or copied as a whole collection.

## Plugin locations

Amp loads TypeScript plugins from:

- global/user-wide plugins: `~/.config/amp/plugins/*.ts`
- project-specific plugins: `.amp/plugins/*.ts` inside a workspace

After installing or updating a plugin, run `plugins: reload` from Amp's command palette, or restart Amp.

## Install a single plugin globally from GitHub

These commands install directly from the public GitHub repository. Run one command for the plugin you want, then run `plugins: reload` in Amp.

```bash
# Danger Sense: blocks/approves risky tool calls
mkdir -p ~/.config/amp/plugins && curl -fsSL https://raw.githubusercontent.com/pc-style/amp-plugins/main/plugins/danger-sense.ts -o ~/.config/amp/plugins/danger-sense.ts

# Auto QA Loop: verifies changed work and auto-continues on failure
mkdir -p ~/.config/amp/plugins && curl -fsSL https://raw.githubusercontent.com/pc-style/amp-plugins/main/plugins/auto-qa-loop.ts -o ~/.config/amp/plugins/auto-qa-loop.ts

# Cursor Composer Subagents: routes Amp Task calls through Cursor SDK agents
mkdir -p ~/.config/amp/plugins && curl -fsSL https://raw.githubusercontent.com/pc-style/amp-plugins/main/plugins/cursor-composer-subagents.ts -o ~/.config/amp/plugins/cursor-composer-subagents.ts

# Design Upgrade Modes: adds visual-design-focused agent modes and commands
mkdir -p ~/.config/amp/plugins && curl -fsSL https://raw.githubusercontent.com/pc-style/amp-plugins/main/plugins/design-upgrade-modes.ts -o ~/.config/amp/plugins/design-upgrade-modes.ts

# Grok Build: adds xAI Grok Build as an Amp agent mode
mkdir -p ~/.config/amp/plugins && curl -fsSL https://raw.githubusercontent.com/pc-style/amp-plugins/main/plugins/grok-build.ts -o ~/.config/amp/plugins/grok-build.ts

# Headroom: compresses large tool outputs through a local Headroom proxy
mkdir -p ~/.config/amp/plugins/headroom && curl -fsSL https://raw.githubusercontent.com/pc-style/amp-plugins/main/plugins/headroom.ts -o ~/.config/amp/plugins/headroom.ts && curl -fsSL https://raw.githubusercontent.com/pc-style/amp-plugins/main/plugins/headroom/lib.ts -o ~/.config/amp/plugins/headroom/lib.ts

# No Mistakes: injects a hidden reminder when NO_MISTAKES=1
mkdir -p ~/.config/amp/plugins && curl -fsSL https://raw.githubusercontent.com/pc-style/amp-plugins/main/plugins/no-mistakes.ts -o ~/.config/amp/plugins/no-mistakes.ts

# Details Default: asks Amp clients to expand details by default
mkdir -p ~/.config/amp/plugins && curl -fsSL https://raw.githubusercontent.com/pc-style/amp-plugins/main/plugins/show-details-default.ts -o ~/.config/amp/plugins/show-details-default.ts
```

## Install a single plugin into one project from GitHub

From a project workspace, install into `.amp/plugins` instead of the global plugin directory:

```bash
# Example: project-local Danger Sense
mkdir -p .amp/plugins && curl -fsSL https://raw.githubusercontent.com/pc-style/amp-plugins/main/plugins/danger-sense.ts -o .amp/plugins/danger-sense.ts

# Example: project-local Auto QA Loop
mkdir -p .amp/plugins && curl -fsSL https://raw.githubusercontent.com/pc-style/amp-plugins/main/plugins/auto-qa-loop.ts -o .amp/plugins/auto-qa-loop.ts
```

## Install every active plugin globally from GitHub

This clones the public repository to a temporary directory, copies every active plugin into `~/.config/amp/plugins`, and leaves disabled plugins out.

```bash
tmpdir="$(mktemp -d)" && git clone --depth 1 https://github.com/pc-style/amp-plugins.git "$tmpdir" && mkdir -p ~/.config/amp/plugins && rsync -a --exclude='.disabled/' "$tmpdir/plugins/" ~/.config/amp/plugins/
```

## Clone this repository for development

```bash
git clone https://github.com/pc-style/amp-plugins.git
cd amp-plugins
bun run check
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
mkdir -p ~/.config/amp/plugins && curl -fsSL https://raw.githubusercontent.com/pc-style/amp-plugins/main/plugins/.disabled/eco.ts -o ~/.config/amp/plugins/eco.ts
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
