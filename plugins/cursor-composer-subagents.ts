import type { PluginAPI } from '@ampcode/plugin'

type ThinkingEffort = 'low' | 'high'

interface CursorSubagentSettings {
	enabled?: boolean
	apiKeyEnv?: string
	model?: string
	thinking?: ThinkingEffort
	cwd?: string
}

interface CursorSDK {
	Agent: {
		prompt(message: string, options?: CursorAgentOptions): Promise<CursorRunResult>
	}
}

interface CursorAgentOptions {
	apiKey: string
	model: {
		id: string
		params?: Array<{ id: string; value: string }>
	}
	local: {
		cwd: string
		settingSources?: string[]
	}
	agents: Record<string, CursorAgentDefinition>
}

interface CursorAgentDefinition {
	description: string
	prompt: string
	model?: 'inherit'
}

interface CursorRunResult {
	status: 'finished' | 'error' | 'cancelled'
	result?: string
	id?: string
	durationMs?: number
}

interface TaskInput {
	description?: string
	prompt?: string
}

const CONFIG_KEY = 'cursorComposerSubagents'
const CATEGORY = 'Cursor Subagents'

const DEFAULT_SETTINGS: Required<CursorSubagentSettings> = {
	enabled: false,
	apiKeyEnv: 'CURSOR_API_KEY',
	model: 'composer-2.5',
	thinking: 'high',
	cwd: process.cwd(),
}

export default function (amp: PluginAPI) {
	let currentSettings = DEFAULT_SETTINGS

	const refreshStatus = (settings: Required<CursorSubagentSettings>) => {
		currentSettings = settings
	}

	const loadSettings = async (): Promise<Required<CursorSubagentSettings>> => {
		let config: Record<string, unknown>
		try {
			config = await amp.configuration.get()
		} catch (error) {
			amp.logger.log('Could not read Cursor subagent settings; using defaults', error)
			return currentSettings
		}
		const saved = isRecord(config[CONFIG_KEY]) ? (config[CONFIG_KEY] as CursorSubagentSettings) : {}
		return {
			...DEFAULT_SETTINGS,
			...saved,
			thinking: saved.thinking === 'low' ? 'low' : 'high',
		}
	}

	const saveSettings = async (partial: CursorSubagentSettings) => {
		const next = { ...currentSettings, ...partial }
		try {
			await amp.configuration.update({ [CONFIG_KEY]: next }, 'global')
		} catch (error) {
			amp.logger.log('Could not persist Cursor subagent settings', error)
		}
		currentSettings = next
		refreshStatus(next)
	}

	try {
		amp.configuration.subscribe(async () => {
			currentSettings = await loadSettings()
			refreshStatus(currentSettings)
		})
	} catch (error) {
		amp.logger.log('Could not subscribe to Cursor subagent settings', error)
	}

	void loadSettings().then((settings) => {
		currentSettings = settings
		refreshStatus(settings)
	})

	amp.registerCommand(
		'cursor-subagents-toggle',
		{
			title: 'Toggle composer-2.5 Task replacement',
			category: CATEGORY,
			description: 'Turn local Cursor SDK subagents on or off for Amp Task tool calls.',
		},
		async (ctx) => {
			const settings = await loadSettings()
			await saveSettings({ enabled: !settings.enabled })
			await ctx.ui.notify(`Cursor composer subagents ${!settings.enabled ? 'enabled' : 'disabled'}.`)
		},
	)

	amp.registerCommand(
		'cursor-subagents-enable',
		{
			title: 'Enable composer-2.5 Task replacement',
			category: CATEGORY,
			description: 'Route Amp Task tool calls through local Cursor SDK composer-2.5 agents.',
		},
		async (ctx) => {
			await saveSettings({ enabled: true })
			await ctx.ui.notify('Cursor composer subagents enabled.')
		},
	)

	amp.registerCommand(
		'cursor-subagents-disable',
		{
			title: 'Disable composer-2.5 Task replacement',
			category: CATEGORY,
			description: 'Let Amp use its built-in Task tool again.',
		},
		async (ctx) => {
			await saveSettings({ enabled: false })
			await ctx.ui.notify('Cursor composer subagents disabled.')
		},
	)

	amp.registerCommand(
		'cursor-subagents-settings',
		{
			title: 'Open settings',
			category: CATEGORY,
			description: 'Configure Cursor SDK model, API key environment variable, cwd, and thinking effort.',
		},
		async (ctx) => {
			const settings = await loadSettings()
			const action = await ctx.ui.select({
				title: 'Cursor Subagents Settings',
				message: settingSummary(settings),
				options: [
					settings.enabled ? 'Disable' : 'Enable',
					'API key env var',
					'Model',
					'Thinking effort',
					'Working directory',
				],
			})

			if (!action) return
			if (action === 'Enable') return saveSettings({ enabled: true })
			if (action === 'Disable') return saveSettings({ enabled: false })
			if (action === 'API key env var') {
				const apiKeyEnv = await ctx.ui.input({
					title: 'Cursor API key environment variable',
					helpText: 'The plugin reads the API key from this environment variable. The default is CURSOR_API_KEY.',
					initialValue: settings.apiKeyEnv,
				})
				if (apiKeyEnv) await saveSettings({ apiKeyEnv: apiKeyEnv.trim() })
				return
			}
			if (action === 'Model') {
				const model = await ctx.ui.input({
					title: 'Cursor SDK model',
					helpText: 'Use composer-2.5 for the current discounted Composer model.',
					initialValue: settings.model,
				})
				if (model) await saveSettings({ model: model.trim() })
				return
			}
			if (action === 'Thinking effort') {
				const thinking = await ctx.ui.select({
					title: 'Thinking effort',
					initialValue: settings.thinking,
					options: ['low', 'high'],
				})
				if (thinking === 'low' || thinking === 'high') await saveSettings({ thinking })
				return
			}
			if (action === 'Working directory') {
				const cwd = await ctx.ui.input({
					title: 'Local Cursor agent working directory',
					helpText: 'Defaults to the Amp plugin process cwd. Set this to the workspace root you want Cursor SDK agents to operate in.',
					initialValue: settings.cwd,
				})
				if (cwd) await saveSettings({ cwd: cwd.trim() })
				return
			}
		},
	)

	amp.on('tool.call', async (event) => {
		const settings = await loadSettings()
		currentSettings = settings
		if (!settings.enabled) return { action: 'allow' }
		if (event.tool !== 'Task') return { action: 'allow' }

		const input = normalizeTaskInput(event.input)
		if (!input.prompt) {
			return { action: 'reject-and-continue', message: 'Cursor subagents could not find a Task prompt to run.' }
		}

		const apiKey = process.env[settings.apiKeyEnv]
		if (!apiKey) {
			return {
				action: 'reject-and-continue',
				message: `Cursor subagents are enabled, but ${settings.apiKeyEnv} is not set in Amp's environment. Set it or change the env var in Cursor Subagents: Open settings.`,
			}
		}

		try {
			amp.logger.log('Routing Task tool call through Cursor SDK composer subagent', {
				description: input.description,
				model: settings.model,
				cwd: settings.cwd,
			})

			const sdk = await loadCursorSDK()
			const result = await sdk.Agent.prompt(buildCursorPrompt(input), {
				apiKey,
				model: {
					id: settings.model,
					params: [{ id: 'thinking', value: settings.thinking }],
				},
				local: {
					cwd: settings.cwd,
					settingSources: ['all'],
				},
				agents: {
					'amp-task-replacement': {
						description: input.description || 'Local Cursor SDK subagent for Amp Task tool calls.',
						prompt: 'You are a focused subagent running locally through Cursor SDK. Complete the delegated task and return a concise, evidence-based result for the parent Amp agent. Inspect and modify the working tree only when the task explicitly requires it. Report files changed, validation run, blockers, and the recommended next action.',
						model: 'inherit',
					},
				},
			})

			if (result.status !== 'finished') {
				return {
					action: 'synthesize',
					result: {
						exitCode: 1,
						output: `Cursor composer subagent ended with status ${result.status}.\n${result.result || ''}`,
					},
				}
			}

			return {
				action: 'synthesize',
				result: {
					exitCode: 0,
					output: result.result || 'Cursor composer subagent finished without a textual result.',
				},
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			amp.logger.log('Cursor composer subagent failed', message)
			return {
				action: 'reject-and-continue',
				message: `Cursor composer subagent failed: ${message}`,
			}
		}
	})
}

function normalizeTaskInput(input: Record<string, unknown>): TaskInput {
	return {
		description: typeof input.description === 'string' ? input.description : undefined,
		prompt: typeof input.prompt === 'string' ? input.prompt : undefined,
	}
}

function buildCursorPrompt(input: TaskInput): string {
	return [
		input.description ? `Delegated task: ${input.description}` : 'Delegated task from Amp.',
		'',
		'Instructions:',
		input.prompt || '',
		'',
		'Return a compact summary suitable for the parent Amp agent. Do not include hidden chain-of-thought.',
	].join('\n')
}

function settingSummary(settings: Required<CursorSubagentSettings>): string {
	return [
		`Enabled: ${settings.enabled ? 'yes' : 'no'}`,
		`Model: ${settings.model}`,
		`Thinking: ${settings.thinking}`,
		`API key env: ${settings.apiKeyEnv}`,
		`Cwd: ${settings.cwd}`,
	].join('\n')
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function loadCursorSDK(): Promise<CursorSDK> {
	const imported = (await import('/Users/pcstyle/node_modules/@cursor/sdk/dist/esm/index.js')) as unknown
	if (!isRecord(imported) || !isRecord(imported.Agent)) {
		throw new Error('Could not load @cursor/sdk from /Users/pcstyle/node_modules. Run `bun add @cursor/sdk` from /Users/pcstyle.')
	}
	return imported as CursorSDK
}
