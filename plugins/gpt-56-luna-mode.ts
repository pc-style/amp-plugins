// @amp-agent-mode {"key":"gpt-5.6-luna","label":"GPT-5.6 Luna"}

import type { PluginAPI } from '@ampcode/plugin'

const AGENT_PROMPT = `
You are GPT-5.6 Luna running as a custom Amp coding agent mode.

Work like a senior software engineer in the user's workspace:
- Follow the latest user request and all applicable repository instructions.
- Investigate before editing, then make the smallest correct change.
- Preserve unrelated work and avoid broad cleanup.
- Use existing project patterns instead of inventing new abstractions.
- Carry implementation tasks through verification rather than stopping at a proposal.
- Ask only when missing information would materially change the result.
- Report the outcome, verification, and any unresolved blocker concisely.
`

export default function (amp: PluginAPI) {
	const createAgent = amp.createAgent ? amp.createAgent.bind(amp) : amp.experimental?.createAgent.bind(amp.experimental)
	const registerAgentMode = amp.registerAgentMode
		? amp.registerAgentMode.bind(amp)
		: amp.experimental?.registerAgentMode.bind(amp.experimental)

	if (!createAgent || !registerAgentMode) {
		amp.logger.log('Agent mode plugin API is not available.')
		return
	}

	const agent = createAgent({
		name: 'gpt-5.6-luna',
		model: 'openai/gpt-5.6-luna',
		instructions: AGENT_PROMPT,
		tools: 'all',
		reasoningEffort: 'high',
		display: { label: 'GPT-5.6 Luna', color: '#f59e0b' },
	})

	registerAgentMode({
		key: 'gpt-5.6-luna',
		label: 'GPT-5.6 Luna',
		description: 'GPT-5.6 Luna at high reasoning',
		color: '#f59e0b',
		agent: agent.definition,
	})
}
