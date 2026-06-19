import type {
	PluginAPI,
	PluginEventMap,
	PluginLogger,
	ShellFunction,
	ToolCallWithResult,
} from '@ampcode/plugin'

const CATEGORY = 'Auto QA Loop'
const CONFIG_KEY = 'autoQaLoop'
const DEFAULT_MAX_ATTEMPTS = 2
const DEFAULT_TIMEOUT_MS = 120_000
const MAX_OUTPUT_CHARS = 12_000

interface AutoQaSettings {
	enabled?: boolean
	maxAttempts?: number
	timeoutMs?: number
	commands?: string[]
	includeBuildFallback?: boolean
}

interface VerificationPlan {
	commands: string[]
	reason: string
}

interface VerificationResult {
	command: string
	exitCode: number
	stdout: string
	stderr: string
}

interface ShellContext {
	$: ShellFunction
	logger?: PluginLogger
}

const PYTHON_TIMEOUT_RUNNER = String.raw`
import subprocess
import sys

root = sys.argv[1]
command = sys.argv[2]
timeout = int(sys.argv[3])

try:
    completed = subprocess.run(
        command,
        cwd=root,
        shell=True,
        text=True,
        capture_output=True,
        timeout=timeout,
    )
    sys.stdout.write(completed.stdout)
    sys.stderr.write(completed.stderr)
    raise SystemExit(completed.returncode)
except subprocess.TimeoutExpired as error:
    if error.stdout:
        sys.stdout.write(error.stdout if isinstance(error.stdout, str) else error.stdout.decode(errors='replace'))
    if error.stderr:
        sys.stderr.write(error.stderr if isinstance(error.stderr, str) else error.stderr.decode(errors='replace'))
    sys.stderr.write(f'Command timed out after {timeout}s\n')
    raise SystemExit(124)
`

export default function autoQaLoopPlugin(amp: PluginAPI) {
	let settings = normalizeSettings(null)
	const attemptsByThread = new Map<string, number>()

	async function loadSettings() {
		try {
			const config = await amp.configuration.get()
			settings = normalizeSettings(config[CONFIG_KEY])
		} catch (error) {
			amp.logger.log(`[auto-qa-loop] could not read settings; using defaults: ${String(error)}`)
			settings = normalizeSettings(null)
		}
	}

	async function saveSettings(partial: AutoQaSettings) {
		settings = normalizeSettings({ ...settings, ...partial })
		await amp.configuration.update({ [CONFIG_KEY]: settings }, 'global')
	}

	void loadSettings()

	try {
		amp.configuration.subscribe(() => {
			void loadSettings()
		})
	} catch (error) {
		amp.logger.log(`[auto-qa-loop] could not subscribe to settings: ${String(error)}`)
	}

	registerCommands(amp, () => settings, saveSettings)

	amp.on('agent.end', async (event, ctx) => {
		if (!settings.enabled || event.status !== 'done') return

		const changedFiles = filesChangedInMessages(amp, event.messages)
		if (changedFiles.length === 0) {
			attemptsByThread.delete(event.thread.id)
			return
		}

		const attempts = attemptsByThread.get(event.thread.id) ?? 0
		if (attempts >= settings.maxAttempts) {
			ctx.logger.log(`[auto-qa-loop] max attempts reached for ${event.thread.id}`)
			return
		}

		const plan = await buildVerificationPlan(ctx, changedFiles, settings)
		if (plan.commands.length === 0) {
			ctx.logger.log(`[auto-qa-loop] no verification command found for changed files: ${changedFiles.join(', ')}`)
			attemptsByThread.delete(event.thread.id)
			return
		}

		const failure = await runVerificationPlan(ctx, plan, settings.timeoutMs)
		if (!failure) {
			attemptsByThread.delete(event.thread.id)
			ctx.logger.log(`[auto-qa-loop] verification passed: ${plan.commands.join(' && ')}`)
			return
		}

		attemptsByThread.set(event.thread.id, attempts + 1)
		return {
			action: 'continue' as const,
			userMessage: buildFixPrompt(failure, changedFiles, attempts + 1, settings.maxAttempts),
		}
	})
}

function registerCommands(
	amp: PluginAPI,
	getSettings: () => Required<AutoQaSettings>,
	saveSettings: (settings: AutoQaSettings) => Promise<void>,
) {
	amp.registerCommand(
		'auto-qa-loop-toggle',
		{
			title: 'Toggle automatic verification',
			category: CATEGORY,
			description: 'Enable or disable post-turn verification and automatic fix prompts.',
		},
		async (ctx) => {
			const next = !getSettings().enabled
			await saveSettings({ enabled: next })
			await ctx.ui.notify(next ? 'Auto QA Loop enabled.' : 'Auto QA Loop disabled.')
		},
	)

	amp.registerCommand(
		'auto-qa-loop-status',
		{
			title: 'Show status',
			category: CATEGORY,
			description: 'Show current Auto QA Loop settings.',
		},
		async (ctx) => {
			const settings = getSettings()
			await ctx.ui.notify(
				`Auto QA Loop is ${settings.enabled ? 'enabled' : 'disabled'}; max attempts: ${settings.maxAttempts}; timeout: ${settings.timeoutMs}ms; custom commands: ${settings.commands.length > 0 ? settings.commands.join(', ') : 'none'}.`,
			)
		},
	)

	amp.registerCommand(
		'auto-qa-loop-run-now',
		{
			title: 'Run verification now',
			category: CATEGORY,
			description: 'Run the configured or auto-detected verification command in the current workspace.',
		},
		async (ctx) => {
			const plan = await buildVerificationPlan(ctx, [], getSettings())
			if (plan.commands.length === 0) {
				await ctx.ui.notify('Auto QA Loop could not find a verification command for this workspace.')
				return
			}

			const failure = await runVerificationPlan(ctx, plan, getSettings().timeoutMs)
			await ctx.ui.notify(
				failure
					? `Verification failed: ${failure.command}`
					: `Verification passed: ${plan.commands.join(' && ')}`,
			)
		},
	)
}

function normalizeSettings(value: unknown): Required<AutoQaSettings> {
	const record = isRecord(value) ? value : {}
	const commands = Array.isArray(record.commands)
		? record.commands.filter((command): command is string => typeof command === 'string' && command.trim().length > 0)
		: []

	return {
		enabled: typeof record.enabled === 'boolean' ? record.enabled : true,
		maxAttempts:
			typeof record.maxAttempts === 'number' && Number.isFinite(record.maxAttempts)
				? Math.max(0, Math.min(5, Math.floor(record.maxAttempts)))
				: DEFAULT_MAX_ATTEMPTS,
		timeoutMs:
			typeof record.timeoutMs === 'number' && Number.isFinite(record.timeoutMs)
				? Math.max(10_000, Math.floor(record.timeoutMs))
				: DEFAULT_TIMEOUT_MS,
		commands,
		includeBuildFallback:
			typeof record.includeBuildFallback === 'boolean' ? record.includeBuildFallback : true,
	}
}

function filesChangedInMessages(amp: PluginAPI, messages: PluginEventMap['agent.end']['messages']): string[] {
	const paths = new Set<string>()
	for (const pair of amp.helpers.toolCallsInMessages(messages)) {
		for (const path of pathsModifiedByToolCall(amp, pair)) paths.add(path)
	}
	return [...paths].sort()
}

function pathsModifiedByToolCall(amp: PluginAPI, pair: ToolCallWithResult): string[] {
	const uris = amp.helpers.filesModifiedByToolCall(pair.result) ?? amp.helpers.filesModifiedByToolCall(pair.call) ?? []
	return uris.map((uri) => amp.helpers.filePathFromURI(uri))
}

async function buildVerificationPlan(
	ctx: ShellContext,
	changedFiles: string[],
	settings: Required<AutoQaSettings>,
): Promise<VerificationPlan> {
	if (settings.commands.length > 0) {
		return { commands: settings.commands, reason: 'configured commands' }
	}

	const root = await workspaceRoot(ctx)
	const packageJson = await readPackageJson(ctx, root)
	if (packageJson) {
		const scripts = packageJson.scripts
		const commands = commandsForPackageScripts(scripts, changedFiles, settings.includeBuildFallback)
		if (commands.length > 0) return { commands, reason: 'package.json scripts' }
	}

	if (await fileExists(ctx, root, 'Cargo.toml')) return { commands: ['cargo check'], reason: 'Rust workspace' }
	if (await fileExists(ctx, root, 'go.mod')) return { commands: ['go test ./...'], reason: 'Go module' }
	if (await fileExists(ctx, root, 'pyproject.toml') || await fileExists(ctx, root, 'pytest.ini')) {
		return { commands: ['python -m pytest'], reason: 'Python test project' }
	}

	return { commands: [], reason: 'no verification command detected' }
}

function commandsForPackageScripts(
	scripts: Record<string, string>,
	changedFiles: string[],
	includeBuildFallback: boolean,
): string[] {
	const available = (name: string) => typeof scripts[name] === 'string'
	const changedCode = changedFiles.length === 0 || changedFiles.some((file) => /\.(tsx?|jsx?|mts|cts|svelte|vue)$/.test(file))

	if (available('tb__tsc-lint-build')) return ['bun run tb__tsc-lint-build']
	if (available('check')) return ['bun run check']
	if (available('verify')) return ['bun run verify']
	if (available('ci')) return ['bun run ci']

	const commands: string[] = []
	if (changedCode && available('typecheck')) commands.push('bun run typecheck')
	if (changedCode && available('lint')) commands.push('bun run lint')
	if (commands.length === 0 && available('test')) commands.push('bun run test')
	if (commands.length === 0 && includeBuildFallback && available('build')) commands.push('bun run build')
	return commands
}

async function runVerificationPlan(
	ctx: ShellContext,
	plan: VerificationPlan,
	timeoutMs: number,
): Promise<VerificationResult | null> {
	const root = await workspaceRoot(ctx)
	for (const command of plan.commands) {
		ctx.logger?.log(`[auto-qa-loop] running (${plan.reason}): ${command}`)
		const result = await runVerificationCommand(ctx, root, command, timeoutMs)
		if (result.exitCode !== 0) return { command, ...result }
	}
	return null
}

function buildFixPrompt(
	failure: VerificationResult,
	changedFiles: string[],
	attempt: number,
	maxAttempts: number,
): string {
	const output = truncate([failure.stdout, failure.stderr].filter(Boolean).join('\n\n'))
	return [
		`Auto QA Loop ran verification after your changes and it failed on attempt ${attempt}/${maxAttempts}.`,
		`Command: ${failure.command}`,
		`Changed files detected: ${changedFiles.length > 0 ? changedFiles.join(', ') : 'unknown'}`,
		'Fix the failures with the smallest correct change, then rerun the relevant verification.',
		'Output:',
		'```',
		output || '(no output)',
		'```',
	].join('\n\n')
}

async function workspaceRoot(ctx: ShellContext): Promise<string> {
	const result = await runShell(ctx, 'git rev-parse --show-toplevel 2>/dev/null || pwd')
	return result.stdout.trim() || process.cwd()
}

async function readPackageJson(
	ctx: ShellContext,
	root: string,
): Promise<{ scripts: Record<string, string> } | null> {
	const result = await runShell(ctx, `cd ${quote(root)} && test -f package.json && cat package.json || true`)
	const text = result.stdout.trim()
	if (!text) return null

	try {
		const parsed = JSON.parse(text) as unknown
		if (!isRecord(parsed) || !isRecord(parsed.scripts)) return { scripts: {} }
		return { scripts: recordOfStrings(parsed.scripts) }
	} catch {
		return null
	}
}

async function fileExists(
	ctx: ShellContext,
	root: string,
	file: string,
): Promise<boolean> {
	const result = await runShell(ctx, `cd ${quote(root)} && test -f ${quote(file)}`)
	return result.exitCode === 0
}

async function runShell(
	ctx: ShellContext,
	command: string,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
	return await ctx.$`bash -lc ${command}`
}

async function runVerificationCommand(
	ctx: ShellContext,
	root: string,
	command: string,
	timeoutMs: number,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
	return await ctx.$`python3 -c ${PYTHON_TIMEOUT_RUNNER} ${root} ${command} ${String(Math.ceil(timeoutMs / 1000))}`
}

function recordOfStrings(record: Record<string, unknown>): Record<string, string> {
	const out: Record<string, string> = {}
	for (const [key, value] of Object.entries(record)) {
		if (typeof value === 'string') out[key] = value
	}
	return out
}

function quote(value: string): string {
	return `'${value.replace(/'/g, `'\\''`)}'`
}

function truncate(value: string): string {
	if (value.length <= MAX_OUTPUT_CHARS) return value
	return `${value.slice(0, MAX_OUTPUT_CHARS)}\n\n[auto-qa-loop truncated ${value.length - MAX_OUTPUT_CHARS} chars]`
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}
