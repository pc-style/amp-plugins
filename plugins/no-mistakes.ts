import type { PluginAPI } from '@ampcode/plugin'

const ENV_VAR = 'NO_MISTAKES'
const REMINDER = 'Make no mistakes!'

export default function (amp: PluginAPI) {
	amp.on('agent.start', () => {
		if (process.env[ENV_VAR] !== '1') {
			return {}
		}

		return {
			message: {
				content: REMINDER,
				display: false,
			},
		}
	})
}
