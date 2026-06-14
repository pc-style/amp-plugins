import type { PluginAPI, PluginCommandContext } from '@ampcode/plugin'

const CATEGORY = 'Details Default'
const CONFIG_KEY = 'showDetailsDefault'
const CONFIG_KEYS_TO_SET = [
	'amp.showDetailsDefault',
	'amp.terminal.showDetailsDefault',
	'amp.terminal.details.defaultExpanded',
	'amp.thread.details.defaultExpanded',
]

interface Settings {
	enabled?: boolean
}

export default function (amp: PluginAPI) {
	let enabled = true

	const load = async () => {
		try {
			const config = await amp.configuration.get()
			const saved = config[CONFIG_KEY]
			enabled = isRecord(saved) && typeof saved.enabled === 'boolean' ? saved.enabled : true
		} catch (error) {
			amp.logger.log('Could not read show-details-default settings; using enabled=true', error)
			enabled = true
		}
	}

	const save = async (settings: Settings) => {
		enabled = settings.enabled ?? enabled
		const patch: Record<string, unknown> = { [CONFIG_KEY]: { enabled } }
		for (const key of CONFIG_KEYS_TO_SET) patch[key] = enabled
		await amp.configuration.update(patch, 'global')
	}

	const notify = async (ctx: PluginCommandContext) => {
		await ctx.ui.notify(
			enabled
				? 'Details Default enabled. Reload plugins or restart Amp if the current client does not react immediately.'
				: 'Details Default disabled.',
		)
	}

	void load().then(async () => {
		if (enabled) {
			try {
				await save({ enabled: true })
			} catch (error) {
				amp.logger.log('Could not apply show-details-default settings', error)
			}
		}
	})

	try {
		amp.configuration.subscribe(async () => {
			await load()
		})
	} catch (error) {
		amp.logger.log('Could not subscribe to show-details-default settings', error)
	}

	amp.registerCommand(
		'show-details-default-enable',
		{
			title: 'Enable details by default',
			category: CATEGORY,
			description: 'Persist Amp settings that ask the client to expand details by default.',
		},
		async (ctx) => {
			await save({ enabled: true })
			await notify(ctx)
		},
	)

	amp.registerCommand(
		'show-details-default-disable',
		{
			title: 'Disable details by default',
			category: CATEGORY,
			description: 'Stop forcing details-open defaults.',
		},
		async (ctx) => {
			await save({ enabled: false })
			await notify(ctx)
		},
	)

	amp.registerCommand(
		'show-details-default-toggle',
		{
			title: 'Toggle details by default',
			category: CATEGORY,
			description: 'Toggle whether Amp should open details by default.',
		},
		async (ctx) => {
			await load()
			await save({ enabled: !enabled })
			await notify(ctx)
		},
	)
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}
