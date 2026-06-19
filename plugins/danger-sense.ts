import type { PluginAPI, PluginEventContext, ToolCallEvent, ToolCallResult } from '@ampcode/plugin'

const CATEGORY = 'Danger Sense'
const CONFIG_KEY = 'dangerSense'

interface DangerSenseSettings {
	enabled?: boolean
	confirmSensitiveFiles?: boolean
	confirmRiskyCommands?: boolean
	blockDestructiveCommands?: boolean
}

interface RuleMatch {
	severity: 'block' | 'confirm'
	reason: string
}

const DEFAULT_SETTINGS: Required<DangerSenseSettings> = {
	enabled: true,
	confirmSensitiveFiles: true,
	confirmRiskyCommands: true,
	blockDestructiveCommands: true,
}

const DESTRUCTIVE_COMMAND_RULES: Array<{ pattern: RegExp; reason: string }> = [
	{ pattern: /\brm\s+[^\n;|&]*(-[^\n;|&]*r[^\n;|&]*f|-f[^\n;|&]*r)[^\n;|&]*(\s\/($|\s)|\s~($|\s)|\s\.($|\s)|\s\.\.($|\s))/i, reason: 'recursive force delete aimed at a broad path' },
	{ pattern: /\bsudo\s+rm\s+[^\n;|&]*(-[^\n;|&]*r[^\n;|&]*f|-f[^\n;|&]*r)/i, reason: 'sudo recursive force delete' },
	{ pattern: /\bgit\s+reset\s+--hard\b/i, reason: 'discarding local git changes with reset --hard' },
	{ pattern: /\bgit\s+clean\s+(-[^\n;|&]*f[^\n;|&]*d|-d[^\n;|&]*f)/i, reason: 'deleting untracked files with git clean' },
	{ pattern: /\bgit\s+push\b[^\n;|&]*(--force|-f\b)/i, reason: 'force pushing git history' },
	{ pattern: /\b(terraform|tofu)\s+destroy\b/i, reason: 'destroying infrastructure' },
	{ pattern: /\bkubectl\s+delete\b/i, reason: 'deleting Kubernetes resources' },
	{ pattern: /\bdd\s+[^\n;|&]*\bof=\/dev\//i, reason: 'writing directly to a device with dd' },
	{ pattern: /\bdiskutil\s+(erase|partition|apfs\s+delete)/i, reason: 'destructive disk operation' },
	{ pattern: /\bmkfs(\.|\s|$)/i, reason: 'formatting a filesystem' },
	{ pattern: /\bchmod\s+(-R\s+)?777\b/i, reason: 'making files world-writable' },
]

const CONFIRM_COMMAND_RULES: Array<{ pattern: RegExp; reason: string }> = [
	{ pattern: /\b(vercel|netlify)\b[^\n;|&]*(--prod|deploy)/i, reason: 'production deployment command' },
	{ pattern: /\b(wrangler|firebase)\s+deploy\b/i, reason: 'deployment command' },
	{ pattern: /\b(prisma|drizzle|sequelize|knex)\b[^\n;|&]*\b(migrate|db\s+push)\b/i, reason: 'database migration command' },
	{ pattern: /\b(supabase|neon|railway)\b[^\n;|&]*\b(db|deploy|migration|migrate)\b/i, reason: 'database or platform deployment command' },
	{ pattern: /\b(terraform|tofu)\s+apply\b/i, reason: 'infrastructure apply command' },
	{ pattern: /\bkubectl\s+(apply|patch|replace|scale|rollout)\b/i, reason: 'Kubernetes mutation command' },
	{ pattern: /\bgh\s+(repo\s+delete|release\s+delete|api\b[^\n;|&]*\bDELETE\b)/i, reason: 'GitHub destructive operation' },
	{ pattern: /\bchmod\s+-R\b/i, reason: 'recursive permission change' },
	{ pattern: /\bchown\s+-R\b/i, reason: 'recursive ownership change' },
]

const SENSITIVE_FILE_PATTERNS: RegExp[] = [
	/(^|\/)\.env(\.|$)/i,
	/(^|\/)(\.envrc|\.npmrc|\.pypirc|\.netrc)$/i,
	/(^|\/)(secrets?|credentials?|private)[^/]*\.(json|ya?ml|toml|ini|txt)$/i,
	/(^|\/)(id_rsa|id_ed25519|known_hosts|authorized_keys)$/i,
	/\.(pem|key|p12|pfx|crt)$/i,
	/(^|\/)(terraform\.tfstate|terraform\.tfvars)$/i,
]

export default function dangerSensePlugin(amp: PluginAPI) {
	let settings = { ...DEFAULT_SETTINGS }

	async function loadSettings() {
		try {
			const config = await amp.configuration.get()
			settings = normalizeSettings(config[CONFIG_KEY])
		} catch (error) {
			amp.logger.log(`[danger-sense] could not read settings; using defaults: ${String(error)}`)
			settings = { ...DEFAULT_SETTINGS }
		}
	}

	async function saveSettings(partial: DangerSenseSettings) {
		settings = { ...settings, ...partial }
		await amp.configuration.update({ [CONFIG_KEY]: settings }, 'global')
	}

	void loadSettings()

	try {
		amp.configuration.subscribe(() => {
			void loadSettings()
		})
	} catch (error) {
		amp.logger.log(`[danger-sense] could not subscribe to settings: ${String(error)}`)
	}

	registerCommands(amp, () => settings, saveSettings)

	amp.on('tool.call', async (event, ctx): Promise<ToolCallResult> => {
		if (!settings.enabled) return { action: 'allow' }

		const command = amp.helpers.shellCommandFromToolCall(event)
		const commandMatch = command ? classifyCommand(command.command, settings) : null
		if (commandMatch?.severity === 'block') {
			return {
				action: 'reject-and-continue',
				message: `Danger Sense blocked this tool call: ${commandMatch.reason}. Ask the user for explicit approval or choose a safer approach.`,
			}
		}

		const sensitiveFiles = settings.confirmSensitiveFiles ? sensitivePathsForEvent(amp, event) : []
		const confirmationReasons = [
			...(commandMatch?.severity === 'confirm' ? [commandMatch.reason] : []),
			...(sensitiveFiles.length > 0 ? [`modifies sensitive file(s): ${sensitiveFiles.join(', ')}`] : []),
		]

		if (confirmationReasons.length === 0) return { action: 'allow' }

		const confirmed = await confirmToolCall(amp, ctx, event, confirmationReasons)
		if (confirmed) return { action: 'allow' }

		return {
			action: 'reject-and-continue',
			message: `Danger Sense did not get approval for this tool call: ${confirmationReasons.join('; ')}. Ask the user before continuing.`,
		}
	})
}

function registerCommands(
	amp: PluginAPI,
	getSettings: () => Required<DangerSenseSettings>,
	saveSettings: (settings: DangerSenseSettings) => Promise<void>,
) {
	amp.registerCommand(
		'danger-sense-toggle',
		{
			title: 'Toggle guardrails',
			category: CATEGORY,
			description: 'Enable or disable tool-call safety guardrails.',
		},
		async (ctx) => {
			const next = !getSettings().enabled
			await saveSettings({ enabled: next })
			await ctx.ui.notify(next ? 'Danger Sense enabled.' : 'Danger Sense disabled.')
		},
	)

	amp.registerCommand(
		'danger-sense-status',
		{
			title: 'Show status',
			category: CATEGORY,
			description: 'Show current Danger Sense settings.',
		},
		async (ctx) => {
			const settings = getSettings()
			await ctx.ui.notify(
				`Danger Sense is ${settings.enabled ? 'enabled' : 'disabled'}; destructive blocks: ${settings.blockDestructiveCommands ? 'on' : 'off'}; risky confirms: ${settings.confirmRiskyCommands ? 'on' : 'off'}; sensitive file confirms: ${settings.confirmSensitiveFiles ? 'on' : 'off'}.`,
			)
		},
	)
}

function normalizeSettings(value: unknown): Required<DangerSenseSettings> {
	if (!isRecord(value)) return { ...DEFAULT_SETTINGS }
	return {
		enabled: typeof value.enabled === 'boolean' ? value.enabled : DEFAULT_SETTINGS.enabled,
		confirmSensitiveFiles:
			typeof value.confirmSensitiveFiles === 'boolean'
				? value.confirmSensitiveFiles
				: DEFAULT_SETTINGS.confirmSensitiveFiles,
		confirmRiskyCommands:
			typeof value.confirmRiskyCommands === 'boolean'
				? value.confirmRiskyCommands
				: DEFAULT_SETTINGS.confirmRiskyCommands,
		blockDestructiveCommands:
			typeof value.blockDestructiveCommands === 'boolean'
				? value.blockDestructiveCommands
				: DEFAULT_SETTINGS.blockDestructiveCommands,
	}
}

function classifyCommand(command: string, settings: Required<DangerSenseSettings>): RuleMatch | null {
	if (settings.blockDestructiveCommands) {
		for (const rule of DESTRUCTIVE_COMMAND_RULES) {
			if (rule.pattern.test(command)) return { severity: 'block', reason: rule.reason }
		}
	}

	if (settings.confirmRiskyCommands) {
		for (const rule of CONFIRM_COMMAND_RULES) {
			if (rule.pattern.test(command)) return { severity: 'confirm', reason: rule.reason }
		}
	}

	return null
}

function sensitivePathsForEvent(amp: PluginAPI, event: ToolCallEvent): string[] {
	const uris = amp.helpers.filesModifiedByToolCall(event) ?? []
	const paths = uris.map((uri) => amp.helpers.filePathFromURI(uri))
	return paths.filter((path) => SENSITIVE_FILE_PATTERNS.some((pattern) => pattern.test(path)))
}

async function confirmToolCall(
	amp: PluginAPI,
	ctx: PluginEventContext<'tool.call'>,
	event: ToolCallEvent,
	reasons: string[],
): Promise<boolean> {
	try {
		return await ctx.ui.confirm({
			title: 'Danger Sense approval required',
			message: `Tool: ${event.tool}\nReasons:\n- ${reasons.join('\n- ')}\n\nAllow this tool call?`,
			confirmButtonText: 'Allow once',
		})
	} catch (error) {
		if (error instanceof Error && amp.helpers.isPluginUINotAvailableError(error)) return false
		ctx.logger.log('[danger-sense] approval prompt failed', error)
		return false
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}
