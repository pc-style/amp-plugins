import compressrSource from '../plugins/compressr.ts?raw'
import fableModeSource from '../plugins/fable-mode.ts?raw'

export type Plugin = {
  slug: string
  name: string
  filename: string
  summary: string
  description: string
  requirements: readonly string[]
  modes: readonly string[]
  features: readonly string[]
  source: string
  sourceLines: number
  rawUrl: string
  installCommand: string
}

const rawBase = 'https://raw.githubusercontent.com/pc-style/amp-plugins/main/plugins'

function plugin(definition: Omit<Plugin, 'rawUrl' | 'installCommand'>): Plugin {
  const rawUrl = `${rawBase}/${definition.filename}`
  return {
    ...definition,
    rawUrl,
    installCommand: `mkdir -p ~/.config/amp/plugins && curl -fsSL ${rawUrl} -o ~/.config/amp/plugins/${definition.filename}`,
  }
}

export const plugins = [
  plugin({
    slug: 'compressr',
    name: 'Compressr',
    filename: 'compressr.ts',
    summary: 'Keep long tool results useful without carrying their full context cost.',
    description:
      'Adds two low-reasoning agent modes that compress long, successful tool results through Compresr before those results re-enter the model context.',
    requirements: [
      'Amp with agent mode plugin APIs available',
      'COMPRESR_API_KEY for tool-result compression',
      'Network access to api.compresr.ai',
    ],
    modes: ['Fable Cmp low', 'GPT5.5 Cmp low'],
    features: [
      'Compresses successful tool output from 3,000 to 180,000 characters',
      'Builds compression queries from tool input and recent user messages',
      'Leaves short results and failed tool calls unchanged',
      'Falls back cleanly when the API key or Compresr service is unavailable',
    ],
    source: compressrSource,
    sourceLines: 214,
  }),
  plugin({
    slug: 'fable-mode',
    name: 'Fable Mode',
    filename: 'fable-mode.ts',
    summary: 'Run Claude Fable 5 across five deliberate reasoning levels.',
    description:
      'Registers Claude Fable 5 at high reasoning and adds low, medium, xhigh, and max variants with a focused coding-agent prompt and tool set.',
    requirements: ['Amp with experimental agent APIs enabled', 'Access to the anthropic/claude-fable-5 model'],
    modes: ['Claude Fable 5 high', 'Claude Fable low', 'Claude Fable med', 'Claude Fable xhi', 'Claude Fable max'],
    features: [
      'Five reasoning variants from low through max',
      'Coding-focused system instructions for investigation, implementation, and verification',
      'Curated smart-tool access for each registered mode',
      'Runtime-safe labels that stay within Amp plugin limits',
    ],
    source: fableModeSource,
    sourceLines: 210,
  }),
] as const satisfies readonly Plugin[]

export function findPlugin(slug: string): Plugin | undefined {
  return plugins.find((item) => item.slug === slug)
}
