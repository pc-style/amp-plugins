import type { PluginAPI } from '@ampcode/plugin'

const GROK_BUILD_PROMPT = `
You are a coding agent. Your job is to modify the user's codebase to satisfy the
latest request, then verify the result.

Follow Amp's normal coding-agent behavior: inspect the relevant files before
changing them, prefer the smallest correct change, use available tools to carry
the task through implementation and verification, and report outcomes honestly.
`

const TOOL_NAMES = [
	'Read',
	'finder',
	'Bash',
	'apply_patch',
	'create_file',
	'edit_file',
	'shell_command',
	'web_search',
	'read_web_page',
	'read_thread',
	'find_thread',
	'skill',
	'oracle',
	'librarian',
	'Task',
	'view_media',
	'painter',
	'read_mcp_resource',
] as const

export default function (amp: PluginAPI) {
	if (!amp.experimental) {
		amp.logger.log('Experimental plugin API is not available.')
		return
	}

	const agent = amp.experimental.createAgent({
		name: 'grok-build-0.1',
		model: 'xai/grok-build-0.1',
		instructions: GROK_BUILD_PROMPT,
		tools: TOOL_NAMES,
		reasoningEffort: 'high',
	})

	amp.experimental.registerAgentMode({
		key: 'grok-build',
		label: 'Grok Build',
		description: 'xAI Grok Build 0.1 with the Amp toolset',
		color: '#22c55e',
		agent: agent.definition,
	})

	amp.registerCommand(
		'mode-switch-to-build',
		{
			title: 'Switch to Build',
			category: 'Mode',
			description: 'Grok Build is available in the mode switcher as “Grok Build”.',
		},
		async (ctx) => {
			await ctx.ui.notify('Use the mode switcher and select “Grok Build”.')
		},
	)
}
