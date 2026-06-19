import type { PluginAPI, ToolCallEvent, ToolResultEvent } from '@ampcode/plugin'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, delimiter, isAbsolute, join, resolve } from 'node:path'

const VERSION = '0.1.0'
const PLUGIN_NAME = `amp-wakatime/${VERSION}`
const CONFIG_KEY = 'wakatime'
const CATEGORY = 'WakaTime'
const MIN_HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000

interface WakaTimeSettings {
	enabled?: boolean
	cliPath?: string
	apiKey?: string
	verbose?: boolean
}

interface LastHeartbeat {
	file: string
	time: number
}

const DEFAULT_SETTINGS: Required<WakaTimeSettings> = {
	enabled: true,
	cliPath: '',
	apiKey: '',
	verbose: false,
}

export default function wakatimePlugin(amp: PluginAPI) {
	let settings = { ...DEFAULT_SETTINGS }
	let lastHeartbeat: LastHeartbeat | null = null
	let missingCliLogged = false
	let configured = false

	async function loadSettings() {
		try {
			const config = await amp.configuration.get()
			settings = normalizeSettings(config[CONFIG_KEY])
			configured = true
		} catch (error) {
			settings = { ...DEFAULT_SETTINGS }
			amp.logger.log(`[wakatime] could not read settings; using defaults: ${String(error)}`)
		}
	}

	async function saveSettings(partial: WakaTimeSettings) {
		settings = { ...settings, ...partial }
		await amp.configuration.update({ [CONFIG_KEY]: settings }, 'global')
	}

	async function sendHeartbeat(file: string, isWrite: boolean) {
		if (!settings.enabled) return

		const entity = normalizeFile(file)
		if (!entity || !isExistingFile(entity)) return

		const now = Date.now()
		if (!isWrite && lastHeartbeat?.file === entity && now - lastHeartbeat.time < MIN_HEARTBEAT_INTERVAL_MS) {
			return
		}

		const cli = findWakaTimeCli(settings.cliPath)
		if (!cli) {
			if (!missingCliLogged) {
				amp.logger.log('[wakatime] wakatime-cli not found. Install WakaTime or set WakaTime: configure CLI path.')
				missingCliLogged = true
			}
			return
		}

		const args = ['--entity', entity, '--plugin', PLUGIN_NAME, '--category', 'ai coding']
		if (isWrite) args.push('--write')
		if (settings.apiKey) args.push('--key', settings.apiKey)
		if (settings.verbose) args.push('--verbose')

		try {
			const subprocess = Bun.spawn([cli, ...args], {
				stdout: 'ignore',
				stderr: 'ignore',
			})
			lastHeartbeat = { file: entity, time: now }
			void subprocess.exited.then((exitCode) => {
				if (exitCode !== 0 && settings.verbose) {
					amp.logger.log(`[wakatime] wakatime-cli exited with code ${exitCode} for ${basename(entity)}`)
				}
			})
		} catch (error) {
			amp.logger.log(`[wakatime] failed to start wakatime-cli: ${String(error)}`)
		}
	}

	void loadSettings()

	try {
		amp.configuration.subscribe(() => {
			void loadSettings()
		})
	} catch (error) {
		amp.logger.log(`[wakatime] could not subscribe to settings: ${String(error)}`)
	}

	amp.on('tool.call', async (event: ToolCallEvent) => {
		if (!configured) await loadSettings()
		for (const file of filesReadByToolCall(event)) {
			void sendHeartbeat(file, false)
		}
		return { action: 'allow' }
	})

	amp.on('tool.result', async (event: ToolResultEvent) => {
		if (event.status !== 'done') return
		if (!configured) await loadSettings()

		const modified = amp.helpers.filesModifiedByToolCall(event) ?? []
		for (const uri of modified) {
			void sendHeartbeat(amp.helpers.filePathFromURI(uri), true)
		}
	})

	registerCommands(amp, () => settings, saveSettings)
	amp.logger.log(`[wakatime] loaded ${PLUGIN_NAME}`)
}

function registerCommands(
	amp: PluginAPI,
	getSettings: () => Required<WakaTimeSettings>,
	saveSettings: (settings: WakaTimeSettings) => Promise<void>,
) {
	amp.registerCommand(
		'wakatime-status',
		{
			title: 'Show status',
			category: CATEGORY,
			description: 'Show Amp WakaTime plugin status and detected wakatime-cli path.',
		},
		async (ctx) => {
			const settings = getSettings()
			const cli = findWakaTimeCli(settings.cliPath)
			await ctx.ui.notify(
				[
					`Amp WakaTime is ${settings.enabled ? 'enabled' : 'disabled'}.`,
					`Plugin: ${PLUGIN_NAME}`,
					`wakatime-cli: ${cli ?? 'not found'}`,
					`API key: ${settings.apiKey ? 'configured in Amp settings' : 'using ~/.wakatime.cfg'}`,
				].join('\n'),
			)
		},
	)

	amp.registerCommand(
		'wakatime-toggle',
		{
			title: 'Toggle tracking',
			category: CATEGORY,
			description: 'Enable or disable WakaTime heartbeats from Amp tool activity.',
		},
		async (ctx) => {
			const next = !getSettings().enabled
			await saveSettings({ enabled: next })
			await ctx.ui.notify(next ? 'Amp WakaTime tracking enabled.' : 'Amp WakaTime tracking disabled.')
		},
	)

	amp.registerCommand(
		'wakatime-configure-cli',
		{
			title: 'Configure CLI path',
			category: CATEGORY,
			description: 'Set a custom wakatime-cli path. Leave blank to auto-detect.',
		},
		async (ctx) => {
			const current = getSettings().cliPath
			const cliPath = await ctx.ui.input({
				title: 'wakatime-cli path',
				helpText: 'Leave blank to auto-detect wakatime-cli from PATH or ~/.wakatime.',
				initialValue: current,
				submitButtonText: 'Save',
			})
			if (cliPath === undefined) return
			await saveSettings({ cliPath: cliPath.trim() })
			await ctx.ui.notify(`WakaTime CLI path ${cliPath.trim() ? 'saved' : 'cleared for auto-detection'}.`)
		},
	)

	amp.registerCommand(
		'wakatime-configure-api-key',
		{
			title: 'Configure API key',
			category: CATEGORY,
			description: 'Set a WakaTime API key for wakatime-cli. Leave blank to use ~/.wakatime.cfg.',
		},
		async (ctx) => {
			const apiKey = await ctx.ui.input({
				title: 'WakaTime API key',
				helpText: 'Leave blank to use the api_key from ~/.wakatime.cfg.',
				initialValue: getSettings().apiKey,
				submitButtonText: 'Save',
			})
			if (apiKey === undefined) return
			await saveSettings({ apiKey: apiKey.trim() })
			await ctx.ui.notify(
				apiKey.trim()
					? 'WakaTime API key saved in Amp global settings.'
					: 'WakaTime API key cleared; using ~/.wakatime.cfg.',
			)
		},
	)
}

function normalizeSettings(value: unknown): Required<WakaTimeSettings> {
	if (!isRecord(value)) return { ...DEFAULT_SETTINGS }
	return {
		enabled: typeof value.enabled === 'boolean' ? value.enabled : DEFAULT_SETTINGS.enabled,
		cliPath: typeof value.cliPath === 'string' ? value.cliPath : DEFAULT_SETTINGS.cliPath,
		apiKey: typeof value.apiKey === 'string' ? value.apiKey : DEFAULT_SETTINGS.apiKey,
		verbose: typeof value.verbose === 'boolean' ? value.verbose : DEFAULT_SETTINGS.verbose,
	}
}

function filesReadByToolCall(event: ToolCallEvent): string[] {
	const paths = new Set<string>()
	const input = event.input

	for (const key of ['path', 'file', 'filePath', 'file_path', 'absolutePath', 'absolute_path', 'sourcePath']) {
		const value = input[key]
		if (typeof value === 'string') paths.add(value)
	}

	for (const key of ['paths', 'files', 'filePaths', 'file_paths', 'inputImagePaths']) {
		const value = input[key]
		if (Array.isArray(value)) {
			for (const item of value) {
				if (typeof item === 'string') paths.add(item)
			}
		}
	}

	return [...paths]
}

function normalizeFile(file: string): string | null {
	if (!file || file.startsWith('file://')) return null
	const expanded = file.startsWith('~/') ? join(homedir(), file.slice(2)) : file
	return isAbsolute(expanded) ? expanded : resolve(expanded)
}

function isExistingFile(path: string): boolean {
	try {
		return existsSync(path) && statSync(path).isFile()
	} catch {
		return false
	}
}

function findWakaTimeCli(configuredPath: string): string | null {
	if (configuredPath) {
		const expanded = configuredPath.startsWith('~/') ? join(homedir(), configuredPath.slice(2)) : configuredPath
		if (isExistingFile(expanded)) return expanded
	}

	const envPath = process.env.WAKATIME_CLI_PATH
	if (envPath && isExistingFile(envPath)) return envPath

	for (const candidate of [
		'/opt/homebrew/bin/wakatime-cli',
		'/usr/local/bin/wakatime-cli',
		'/usr/bin/wakatime-cli',
		join(homedir(), '.wakatime', 'wakatime-cli'),
	]) {
		if (isExistingFile(candidate)) return candidate
	}

	for (const pathEntry of process.env.PATH?.split(delimiter) ?? []) {
		const candidate = join(pathEntry, 'wakatime-cli')
		if (isExistingFile(candidate)) return candidate
	}

	const wakatimeDir = join(homedir(), '.wakatime')
	try {
		for (const name of readdirSync(wakatimeDir)) {
			if (name.startsWith('wakatime-cli') && !name.endsWith('.zip')) {
				const candidate = join(wakatimeDir, name)
				if (isExistingFile(candidate)) return candidate
			}
		}
	} catch {
		// No ~/.wakatime directory yet.
	}

	return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}
