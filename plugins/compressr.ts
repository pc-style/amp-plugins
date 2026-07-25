// @amp-agent-mode {"key":"cmp-fable-low","label":"Fable Cmp low"}
// @amp-agent-mode {"key":"cmp-gpt56-sol-low","label":"GPT5.6 Sol Cmp low"}
// @amp-agent-mode {"key":"cmp-opus5-med","label":"Opus5 Cmp med"}

import type { PluginAPI } from '@ampcode/plugin'

const COMPRESR_API_URL = 'https://api.compresr.ai/api/compress/question-specific/'
const MIN_OUTPUT_CHARS = 3_000
const MAX_OUTPUT_CHARS = 180_000

const TOOL_NAMES = [
	'apply_patch',
	'Bash',
	'chart',
	'create_file',
	'edit_file',
	'find_thread',
	'finder',
	'librarian',
	'oracle',
	'painter',
	'Read',
	'read_mcp_resource',
	'read_thread',
	'read_web_page',
	'shell_command',
	'shell_command_status',
	'skill',
	'Task',
	'view_media',
	'web_search',
] as const

const AGENT_PROMPT = `
You are Amp with a Compresr guard on tool results.

When you call tools, make each tool input describe the intent clearly. The plugin uses the tool name, input, and recent user messages as Compresr's query so long tool outputs can be compressed before they re-enter your prompt. Treat compressed tool results as relevance-filtered excerpts, not as proof that omitted content is irrelevant to every possible follow-up. If a later decision depends on omitted details, call a narrower tool query instead of guessing.
`

type CompressrResponse = {
	success?: boolean
	data?: {
		compressed_context?: string
		original_tokens?: number
		compressed_tokens?: number
		tokens_saved?: number
		actual_compression_ratio?: number
	}
}

export default function (amp: PluginAPI) {
	const createAgent = amp.createAgent ? amp.createAgent.bind(amp) : amp.experimental?.createAgent.bind(amp.experimental)
	const registerAgentMode = amp.registerAgentMode
		? amp.registerAgentMode.bind(amp)
		: amp.experimental?.registerAgentMode.bind(amp.experimental)

	if (!createAgent || !registerAgentMode) {
		amp.logger.log('Agent mode plugin API is not available.')
		return
	}

	const fableAgent = createAgent({
		name: 'compressr-fable-low',
		model: 'anthropic/claude-fable-5',
		instructions: AGENT_PROMPT,
		tools: TOOL_NAMES,
		reasoningEffort: 'low',
		display: { label: 'Fable Cmp low', color: '#a78bfa' },
	})

	registerAgentMode({
		key: 'cmp-fable-low',
		label: 'Fable Cmp low',
		description: 'Claude Fable 5 low with Compresr-compressed tool results',
		color: '#a78bfa',
		agent: fableAgent.definition,
	})

	const gptAgent = createAgent({
		name: 'compressr-gpt-5-6-sol-low',
		model: 'openai/gpt-5.6-sol',
		instructions: AGENT_PROMPT,
		tools: TOOL_NAMES,
		reasoningEffort: 'low',
		display: { label: 'GPT5.6 Sol Cmp low', color: '#60a5fa' },
	})

	registerAgentMode({
		key: 'cmp-gpt56-sol-low',
		label: 'GPT5.6 Sol Cmp low',
		description: 'GPT-5.6 Sol low with Compresr-compressed tool results',
		color: '#60a5fa',
		agent: gptAgent.definition,
	})

	const opusAgent = createAgent({
		name: 'compressr-opus-5-medium',
		model: 'anthropic/claude-opus-5',
		instructions: AGENT_PROMPT,
		tools: TOOL_NAMES,
		reasoningEffort: 'medium',
		display: { label: 'Opus5 Cmp med', color: '#f472b6' },
	})

	registerAgentMode({
		key: 'cmp-opus5-med',
		label: 'Opus5 Cmp med',
		description: 'Claude Opus 5 medium with Compresr-compressed tool results',
		color: '#f472b6',
		agent: opusAgent.definition,
	})

	amp.on('tool.result', async (event, ctx) => {
		if (event.status !== 'done' || event.output == null) return
		if (!(await isCompressrAgent(ctx.thread))) return

		const apiKey = getEnv('COMPRESR_API_KEY')
		if (!apiKey) return

		const outputText = toolOutputToText(event.output)
		if (outputText.length < MIN_OUTPUT_CHARS) return

		const boundedOutput = outputText.slice(0, MAX_OUTPUT_CHARS)
		const query = await buildCompressionQuery(event.tool, event.input, ctx.thread)

		try {
			const response = await fetch(COMPRESR_API_URL, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-API-Key': apiKey,
				},
				body: JSON.stringify({
					context: boundedOutput,
					query,
					compression_model_name: 'latte_v2',
					dynamic: true,
					dynamic_min_ratio: 1.5,
					dynamic_max_ratio: 10,
					coarse: true,
					heuristic_chunking: true,
					disable_placeholders: false,
				}),
			})

			if (!response.ok) {
				amp.logger.log(`Compresr skipped ${event.tool}: HTTP ${response.status}`)
				return
			}

			const result = (await response.json()) as CompressrResponse
			const compressed = result.data?.compressed_context?.trim()
			if (!compressed || compressed.length >= outputText.length) return

			const header = [
				`[Compresr compressed ${event.tool} tool result]`,
				`Original chars: ${outputText.length.toLocaleString()}`,
				`Compressed chars: ${compressed.length.toLocaleString()}`,
			]

			if (typeof result.data?.tokens_saved === 'number') {
				header.push(`Tokens saved: ${result.data.tokens_saved.toLocaleString()}`)
			}

			return {
				status: 'done' as const,
				output: `${header.join('\n')}\n\n${compressed}`,
			}
		} catch (error) {
			amp.logger.log(`Compresr skipped ${event.tool}:`, error)
		}
	})
}

async function isCompressrAgent(thread: { agent(): Promise<{ definition: { kind: string; name?: string } }> }): Promise<boolean> {
	try {
		const agent = await thread.agent()
		return agent.definition.kind === 'agent-definition' && agent.definition.name?.startsWith('compressr-') === true
	} catch {
		return false
	}
}

function getEnv(name: string): string | undefined {
	const globals = globalThis as unknown as {
		Bun?: { env?: Record<string, string | undefined> }
		process?: { env?: Record<string, string | undefined> }
	}

	return globals.Bun?.env?.[name] ?? globals.process?.env?.[name]
}

function toolOutputToText(output: unknown): string {
	if (typeof output === 'string') return output

	if (Array.isArray(output)) {
		return output
			.map((block) => {
				if (block && typeof block === 'object' && 'type' in block && block.type === 'text' && 'text' in block) {
					return typeof block.text === 'string' ? block.text : ''
				}

				return JSON.stringify(block)
			})
			.filter(Boolean)
			.join('\n\n')
	}

	return JSON.stringify(output, null, 2)
}

async function buildCompressionQuery(
	tool: string,
	input: Record<string, unknown>,
	thread: { messages(options?: { from?: 'start' | 'end'; limit?: number; roles?: Array<'user' | 'assistant'> }): Promise<Array<{ role: string; content: Array<{ type: string; text?: string }> }>> },
): Promise<string> {
	const recentMessages = await thread.messages({ from: 'end', limit: 4, roles: ['user'] })
	const recentUserText = recentMessages
		.flatMap((message) => message.content)
		.filter((block) => block.type === 'text' && typeof block.text === 'string')
		.map((block) => block.text)
		.join('\n\n')
		.slice(-4_000)

	return [
		`Preserve the parts of this ${tool} tool result needed for the agent to satisfy the user's current coding task.`,
		`Tool input: ${JSON.stringify(input)}`,
		recentUserText ? `Recent user messages:\n${recentUserText}` : '',
	]
		.filter(Boolean)
		.join('\n\n')
}
