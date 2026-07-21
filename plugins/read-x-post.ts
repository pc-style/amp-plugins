import type { PluginAPI } from '@ampcode/plugin'

export default function (amp: PluginAPI) {
	amp.registerTool({
		name: 'read_x_post',
		description: 'Convert a public X/Twitter post URL to Markdown via x.pcstyle.dev. Use for x.com or twitter.com status links.',
		inputSchema: {
			type: 'object',
			properties: {
				url: {
					type: 'string',
					description: 'Public x.com or twitter.com status URL to read.',
				},
				thread: {
					type: 'string',
					description: 'Use full to expand the reply chain, or off for the single post only. Defaults to full.',
					enum: ['full', 'off'],
				},
			},
			required: ['url'],
		},
		async execute(input) {
			const url = input.url
			if (typeof url !== 'string' || !/^https?:\/\/(x|twitter)\.com\/[^/]+\/status\/\d+/.test(url)) {
				return 'Expected a public x.com or twitter.com status URL.'
			}

			const thread = input.thread === 'off' ? 'off' : 'full'
			const apiURL = new URL('https://x.pcstyle.dev/api/convert')
			apiURL.searchParams.set('url', url)
			apiURL.searchParams.set('thread', thread)

			const response = await fetch(apiURL, { headers: { Accept: 'text/markdown' } })
			if (!response.ok) {
				return `Failed to read X post: HTTP ${response.status} ${response.statusText}`
			}

			return await response.text()
		},
	})
}
