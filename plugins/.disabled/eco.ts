// @i-know-the-amp-plugin-api-is-wip-and-very-experimental-right-now
import type { PluginAPI, ToolCallEvent, ToolResultEvent } from '@ampcode/plugin'

type EcoProfile = 'off' | 'min' | 'normal' | 'max' | 'crazy'

type EcoConfig = Record<string, unknown> & {
	'eco.enabled'?: boolean
	'eco.profile'?: EcoProfile
	'eco.maxToolResultChars'?: number
	'eco.disableFancyTools'?: boolean
	'eco.blockTokenBombs'?: boolean
}

const ECO_MARKER = '[eco]'
const DEFAULT_PROFILE: EcoProfile = 'normal'
const DEFAULT_MAX_TOOL_RESULT_CHARS = 6_000
const MIN_TOOL_RESULT_CHARS = 1_000
const MAX_TOOL_RESULT_CHARS = 20_000

const ECO_PROFILES: Record<EcoProfile, { maxToolResultChars: number; disableFancyTools: boolean; blockTokenBombs: boolean; sandboxShell: boolean; reasoningEffort: 'low' | 'medium' }> = {
	off: { maxToolResultChars: 20_000, disableFancyTools: false, blockTokenBombs: false, sandboxShell: false, reasoningEffort: 'medium' },
	min: { maxToolResultChars: 12_000, disableFancyTools: false, blockTokenBombs: true, sandboxShell: false, reasoningEffort: 'medium' },
	normal: { maxToolResultChars: 6_000, disableFancyTools: true, blockTokenBombs: true, sandboxShell: false, reasoningEffort: 'low' },
	max: { maxToolResultChars: 2_500, disableFancyTools: true, blockTokenBombs: true, sandboxShell: false, reasoningEffort: 'low' },
	crazy: { maxToolResultChars: 1_000, disableFancyTools: true, blockTokenBombs: true, sandboxShell: true, reasoningEffort: 'low' },
}

const FANCY_TOOL_PATTERNS = [
	/^Oracle$/i,
	/^Browser$/i,
	/^WebFetch$/i,
	/^WebSearch$/i,
	/^ReadWebPage$/i,
	/^TodoWrite$/i,
	/^mcp__/i,
]

const FANCY_TOOLS_DISABLE_SETTING = [
	'builtin:Oracle',
	'builtin:Browser',
	'builtin:WebFetch',
	'builtin:WebSearch',
	'builtin:ReadWebPage',
	'builtin:TodoWrite',
	'mcp__*',
]

const TOKEN_BOMB_PATTERNS: Array<{ pattern: RegExp; reason: string; hint: string }> = [
	{
		pattern: /(^|[;&|]\s*)cat\s+([^|><;]*\s)?(package-lock\.json|bun\.lockb|yarn\.lock|pnpm-lock\.yaml|.*\.min\.(js|css)|.*\.map)(\s|$)/i,
		reason: 'large generated/minified file dump',
		hint: 'Use rg for specific symbols, or read a small line range instead.',
	},
	{
		pattern: /(^|[;&|]\s*)(ls\s+(-[^;|&]*R[^;|&]*|-R)|find\s+(\/|\.)(\s|$))(?![^;|&]*(maxdepth|head|grep|rg|fd))/i,
		reason: 'unbounded recursive listing',
		hint: 'Use find . -maxdepth 3, rg --files, or pipe to head -200.',
	},
	{
		pattern: /(^|[;&|]\s*)(grep|rg)\s+(-[^;|&]*\s)*(-R|--recursive)\b(?![^;|&]*(--max-count|-m\s*\d|head|--glob|--exclude))/i,
		reason: 'unbounded recursive search',
		hint: 'Use rg -n --max-count 80 --glob "!{node_modules,dist,build,.git}/**" <pattern>.',
	},
]

let enabled = true
let profile: EcoProfile = DEFAULT_PROFILE
let maxToolResultChars = DEFAULT_MAX_TOOL_RESULT_CHARS
let disableFancyTools = true
let blockTokenBombs = true
let sandboxShell = false
const threadsThatReceivedEcoHint = new Set<string>()

export default function (amp: PluginAPI) {
	amp.configuration.subscribe((config: EcoConfig) => {
		enabled = config['eco.enabled'] !== false
		profile = normalizeProfile(config['eco.profile'])
		const profileDefaults = ECO_PROFILES[profile]
		maxToolResultChars = clampNumber(config['eco.maxToolResultChars'], MIN_TOOL_RESULT_CHARS, MAX_TOOL_RESULT_CHARS, profileDefaults.maxToolResultChars)
		disableFancyTools = typeof config['eco.disableFancyTools'] === 'boolean' ? config['eco.disableFancyTools'] : profileDefaults.disableFancyTools
		blockTokenBombs = typeof config['eco.blockTokenBombs'] === 'boolean' ? config['eco.blockTokenBombs'] : profileDefaults.blockTokenBombs
		sandboxShell = profileDefaults.sandboxShell
	})

	amp.on('session.start', async (_event, ctx) => {
		await ctx.ui.notify(`Eco mode: ${enabled ? profile : 'off'}`)
	})

	amp.on('tool.call', async (event) => {
		if (!enabled) return { action: 'allow' }

		if (disableFancyTools && isFancyTool(event.tool)) {
			return {
				action: 'reject-and-continue',
				message: `${ECO_MARKER} ${event.tool} is disabled in token economy mode. Use core tools only, or run /eco to change mode.`,
			}
		}

		const shell = amp.helpers.shellCommandFromToolCall(event)
		if (shell && blockTokenBombs) {
			const guard = tokenBombGuard(shell.command)
			if (guard) {
				return {
					action: 'reject-and-continue',
					message: `${ECO_MARKER} blocked ${guard.reason}. ${guard.hint}`,
				}
			}
		}

		if (shell && sandboxShell && !isAlreadyEcoWrapped(shell.command)) {
			const modified = shellSandboxInput(event, shell.command)
			if (modified) return { action: 'modify', input: modified }
		}

		return { action: 'allow' }
	})

	amp.on('tool.result', async (event) => {
		if (!enabled) return

		if (event.output === undefined && !event.error) return

		const budget = isShellTool(event) ? maxToolResultChars : Math.floor(maxToolResultChars * 0.75)
		const next = truncateToolResult(event, budget)
		if (!next.changed) return

		return {
			status: event.status,
			error: event.error ? truncateText(event.error, Math.floor(budget / 2), 'error').text : undefined,
			output: next.output,
		}
	})

	amp.on('agent.start', async (event) => {
		if (!enabled) return
		if (profile === 'off') return
		if (threadsThatReceivedEcoHint.has(event.thread.id)) return
		threadsThatReceivedEcoHint.add(event.thread.id)
		return {
			message: {
				display: true,
				content: `${ECO_MARKER} Token economy mode (${profile}) is active. Keep context lean: prefer rg/read ranges over broad dumps, use Task when it helps isolate context, summarize findings instead of pasting full outputs, and inspect only files that are crucial to the task.`,
			},
		}
	})

	amp.registerCommand(
		'eco',
		{
			title: 'Token economy mode',
			category: 'eco',
			description: 'Choose off, min, normal, max, or crazy token economy mode.',
		},
		async (ctx) => {
			const choice = await ctx.ui.select({
				title: 'Eco token economy mode',
				message: `Current: ${enabled ? profile : 'off'} | cap: ${maxToolResultChars} chars | Task: allowed`,
				options: ['off', 'min', 'normal', 'max', 'crazy'],
			})

			if (!choice) return
			const nextProfile = normalizeProfile(choice)
			const next = ECO_PROFILES[nextProfile]
			const current = (await amp.configuration.get()) as EcoConfig

			const update: Partial<EcoConfig> = {
				'eco.enabled': nextProfile !== 'off',
				'eco.profile': nextProfile,
				'eco.maxToolResultChars': next.maxToolResultChars,
				'eco.disableFancyTools': next.disableFancyTools,
				'eco.blockTokenBombs': next.blockTokenBombs,
				'amp.anthropic.thinking.enabled': nextProfile === 'min' || nextProfile === 'off',
				'amp.agent.deepReasoningEffort': next.reasoningEffort,
				'amp.skills.disableClaudeCodeSkills': nextProfile !== 'min' && nextProfile !== 'off',
				'amp.tools.disable': next.disableFancyTools
					? mergeToolDisable(removeDisabledTools(current['amp.tools.disable'], ['builtin:Task']), FANCY_TOOLS_DISABLE_SETTING)
					: removeDisabledTools(current['amp.tools.disable'], ['builtin:Task', ...FANCY_TOOLS_DISABLE_SETTING]),
			}

			await amp.configuration.update(update, 'global')
			await ctx.ui.notify(nextProfile === 'off' ? 'Eco mode off.' : `Eco mode set to ${nextProfile}. Task remains allowed.`)
		},
	)
}

function isFancyTool(tool: string) {
	return FANCY_TOOL_PATTERNS.some((pattern) => pattern.test(tool))
}

function isShellTool(event: ToolCallEvent | ToolResultEvent) {
	return /^(Bash|shell_command)$/i.test(event.tool)
}

function tokenBombGuard(command: string) {
	const compact = command.replace(/\s+/g, ' ').trim()
	return TOKEN_BOMB_PATTERNS.find(({ pattern }) => pattern.test(compact))
}

function isAlreadyEcoWrapped(command: string) {
	return command.includes('__eco_stdout') || command.includes('ECO_SANDBOX')
}

function shellSandboxInput(event: ToolCallEvent, command: string) {
	const commandKey = typeof event.input.cmd === 'string' ? 'cmd' : typeof event.input.command === 'string' ? 'command' : undefined
	if (!commandKey) return undefined
	return { ...event.input, [commandKey]: buildSandboxedShellCommand(command) }
}

function buildSandboxedShellCommand(command: string) {
	const quoted = JSON.stringify(command)
	return `__eco_dir=$(mktemp -d 2>/dev/null || mktemp -d -t eco); __eco_stdout="$__eco_dir/stdout"; __eco_stderr="$__eco_dir/stderr"; sh -lc ${quoted} >"$__eco_stdout" 2>"$__eco_stderr"; __eco_code=$?; echo "[eco] ECO_SANDBOX exit=$__eco_code"; wc -c -l "$__eco_stdout" "$__eco_stderr" | sed 's#'"$__eco_dir"'/##g'; echo "[eco] stdout head"; head -80 "$__eco_stdout"; echo "[eco] stdout tail"; tail -80 "$__eco_stdout"; if [ -s "$__eco_stderr" ]; then echo "[eco] stderr head"; head -60 "$__eco_stderr"; echo "[eco] stderr tail"; tail -60 "$__eco_stderr"; fi; rm -rf "$__eco_dir"; exit $__eco_code`
}

function truncateToolResult(event: ToolResultEvent, budget: number): { output: unknown; changed: boolean } {
	let changed = false
	const output = mapOutput(event.output, budget, 'output')
	changed = output.changed
	return { output: output.value, changed }
}

function mapOutput(value: unknown, budget: number, label: string): { value: unknown; changed: boolean } {
	if (typeof value === 'string') {
		const truncated = truncateText(value, budget, label)
		return { value: truncated.text, changed: truncated.changed }
	}

	if (Array.isArray(value)) {
		let changed = false
		const perItemBudget = Math.max(400, Math.floor(budget / Math.max(value.length, 1)))
		const next = value.map((item, index) => {
			const mapped = mapOutput(item, perItemBudget, `${label}[${index}]`)
			changed ||= mapped.changed
			return mapped.value
		})
		return { value: next, changed }
	}

	if (value && typeof value === 'object') {
		if (isImageLikeObject(value)) return { value, changed: false }

		let changed = false
		const entries = Object.entries(value as Record<string, unknown>)
		const perFieldBudget = Math.max(700, Math.floor(budget / Math.max(entries.length, 1)))
		const next: Record<string, unknown> = {}
		for (const [key, field] of entries) {
			const fieldBudget = /stdout|stderr|output|text|content|result/i.test(key) ? budget : perFieldBudget
			const mapped = mapOutput(field, fieldBudget, key)
			changed ||= mapped.changed
			next[key] = mapped.value
		}
		return { value: next, changed }
	}

	return { value, changed: false }
}

function isImageLikeObject(value: object) {
	const record = value as Record<string, unknown>
	if (record.type === 'image') return true
	if (typeof record.mimeType === 'string' && record.mimeType.startsWith('image/')) return true
	if (record.source && typeof record.source === 'object') {
		const source = record.source as Record<string, unknown>
		if (source.type === 'base64' || typeof source.base64 === 'string' || typeof source.data === 'string') return true
	}
	if (typeof record.media_type === 'string' && record.media_type.startsWith('image/')) return true
	return false
}

function truncateText(input: string, budget: number, label: string) {
	const normalized = collapseNoisyLines(input)
	const changedByCollapse = normalized !== input

	if (normalized.length <= budget) {
		return { text: normalized, changed: changedByCollapse }
	}

	const headSize = Math.floor(budget * 0.62)
	const tailSize = Math.max(0, budget - headSize - 260)
	const omitted = normalized.length - headSize - tailSize
	const text = `${normalized.slice(0, headSize)}\n\n${ECO_MARKER} truncated ${label}: omitted ${omitted.toLocaleString()} chars. Kept head+tail; rerun a narrower command if needed.\n\n${normalized.slice(normalized.length - tailSize)}`
	return { text, changed: true }
}

function collapseNoisyLines(input: string) {
	const lines = input.split('\n')
	const seen = new Map<string, number>()
	const kept: string[] = []
	let omittedDuplicates = 0
	let omittedHugeJson = 0

	for (const line of lines) {
		const trimmed = line.trim()
		if (trimmed.length > 1_500 && looksLikeDenseJsonOrBase64(trimmed)) {
			omittedHugeJson++
			kept.push(`${ECO_MARKER} collapsed oversized dense line (${trimmed.length.toLocaleString()} chars): ${trimmed.slice(0, 220)} ...`)
			continue
		}

		const count = seen.get(trimmed) ?? 0
		seen.set(trimmed, count + 1)
		if (trimmed && count >= 2) {
			omittedDuplicates++
			continue
		}

		kept.push(line)
	}

	if (omittedDuplicates || omittedHugeJson) {
		kept.push(`${ECO_MARKER} collapsed ${omittedDuplicates} duplicate lines and ${omittedHugeJson} oversized dense lines.`)
	}

	return kept.join('\n')
}

function looksLikeDenseJsonOrBase64(value: string) {
	const noSpacesRatio = value.replace(/\s/g, '').length / Math.max(value.length, 1)
	return noSpacesRatio > 0.95 && (/^[A-Za-z0-9+/=]{1000,}$/.test(value) || /^[{\[]/.test(value))
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
	const numeric = typeof value === 'number' ? value : Number(value)
	if (!Number.isFinite(numeric)) return fallback
	return Math.min(max, Math.max(min, Math.floor(numeric)))
}

function normalizeProfile(value: unknown): EcoProfile {
	return value === 'off' || value === 'min' || value === 'normal' || value === 'max' || value === 'crazy' ? value : DEFAULT_PROFILE
}

function mergeToolDisable(current: unknown, additions: string[]) {
	const existing = Array.isArray(current) ? current.filter((item): item is string => typeof item === 'string') : []
	return Array.from(new Set([...existing, ...additions]))
}

function removeDisabledTools(current: unknown, removals: string[]) {
	const blocked = new Set(removals)
	return Array.isArray(current) ? current.filter((item) => typeof item === 'string' && !blocked.has(item)) : []
}
