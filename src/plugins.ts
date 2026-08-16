export type Plugin = {
  slug: string
  name: string
  filename: string
  summary: string
  description: string
  requirements: readonly string[]
  modes: readonly string[]
  features: readonly string[]
  rawUrl: string
  githubUrl: string
  installCommand: string
}

export const repositoryUrl = 'https://github.com/pc-style/amp-plugins'

const sourceRevision = 'cda601dfab62e7306b80a62f1cff7922d2695256'
const rawBase = `https://raw.githubusercontent.com/pc-style/amp-plugins/${sourceRevision}/plugins`

function plugin(definition: Omit<Plugin, 'rawUrl' | 'githubUrl' | 'installCommand'>): Plugin {
  const rawUrl = `${rawBase}/${definition.filename}`
  return {
    ...definition,
    rawUrl,
    githubUrl: `${repositoryUrl}/blob/${sourceRevision}/plugins/${definition.filename}`,
    installCommand: `mkdir -p ~/.config/amp/plugins && curl -fsSL ${rawUrl} -o ~/.config/amp/plugins/${definition.filename}`,
  }
}

export const plugins = [
  plugin({
    slug: 'gpt-56-luna-mode',
    name: 'gpt-5.6 luna mode',
    filename: 'gpt-56-luna-mode.ts',
    summary: 'run the fastest, lowest-cost gpt-5.6 model as an amp coding agent.',
    description:
      'registers gpt-5.6 luna at high reasoning with amp’s full tool set and concise coding-agent instructions.',
    requirements: ['amp with agent mode plugin apis available', 'access to the openai/gpt-5.6-luna model'],
    modes: ['GPT-5.6 Luna'],
    features: [
      'gpt-5.6 luna at high reasoning',
      'full access to tools available in the amp runtime',
      'coding-focused instructions for small changes and end-to-end verification',
      'fallback support for amp’s former experimental agent api',
    ],
  }),
  plugin({
    slug: 'gpt-56-terra-mode',
    name: 'gpt-5.6 terra mode',
    filename: 'gpt-56-terra-mode.ts',
    summary: 'run the balanced gpt-5.6 model as an amp coding agent.',
    description:
      'registers gpt-5.6 terra at high reasoning with amp’s full tool set and concise coding-agent instructions.',
    requirements: ['amp with agent mode plugin apis available', 'access to the openai/gpt-5.6-terra model'],
    modes: ['GPT-5.6 Terra'],
    features: [
      'gpt-5.6 terra at high reasoning',
      'full access to tools available in the amp runtime',
      'coding-focused instructions for small changes and end-to-end verification',
      'fallback support for amp’s former experimental agent api',
    ],
  }),
  plugin({
    slug: 'gpt-56-sol-mode',
    name: 'gpt-5.6 sol mode',
    filename: 'gpt-56-sol-mode.ts',
    summary: 'run gpt-5.6 sol as a focused amp coding agent.',
    description:
      'registers gpt-5.6 sol at high reasoning with amp’s full tool set and concise coding-agent instructions.',
    requirements: ['amp with agent mode plugin apis available', 'access to the openai/gpt-5.6-sol model'],
    modes: ['GPT-5.6 Sol'],
    features: [
      'gpt-5.6 sol at high reasoning',
      'full access to tools available in the amp runtime',
      'coding-focused instructions for small changes and end-to-end verification',
      'fallback support for amp’s former experimental agent api',
    ],
  }),
  plugin({
    slug: 'compressr',
    name: 'compressr',
    filename: 'compressr.ts',
    summary: 'keep long tool results useful without carrying their full context cost.',
    description:
      'adds three agent modes that compress long, successful tool results through compresr before those results re-enter the model context.',
    requirements: [
      'amp with agent mode plugin apis available',
      'COMPRESR_API_KEY for tool-result compression',
      'network access to api.compresr.ai',
    ],
    modes: ['Fable Cmp low', 'GPT5.6 Sol Cmp low', 'Opus5 Cmp med'],
    features: [
      'keeps the task-relevant parts of long tool results while dropping context the agent does not need',
      'sends bounded tool output, serialized tool input, and recent user messages directly to api.compresr.ai',
      'leaves short results and failed tool calls unchanged',
      'falls back cleanly when the api key or compresr service is unavailable',
    ],
  }),
  plugin({
    slug: 'read-x-post',
    name: 'read x post',
    filename: 'read-x-post.ts',
    summary: 'give amp a direct tool for reading public x posts and reply chains.',
    description:
      'registers a read_x_post tool that converts public x.com and twitter.com status urls to markdown through x.pcstyle.dev.',
    requirements: ['amp with plugin tool apis available', 'network access to x.pcstyle.dev'],
    modes: ['read_x_post'],
    features: [
      'reads public x and twitter status urls without an x api key',
      'returns compact markdown instead of page html',
      'expands reply chains by default with an option to read one post only',
      'validates status urls before sending requests to x.pcstyle.dev',
    ],
  }),
  plugin({
    slug: 'signal-filter',
    name: 'signal filter experimental',
    filename: 'signal-filter.ts',
    summary: 'filter long tool results through amp inference before they consume the agent’s context.',
    description:
      'adds three experimental modes that use amp/glm-5.2 to retain task-relevant excerpts from long text tool results.',
    requirements: [
      'amp with agent mode and plugin ai apis available',
      'access to amp/glm-5.2 for tool-result filtering',
      'access to the model used by the selected agent mode',
    ],
    modes: ['Fable Signal exp', 'Sol Signal exp', 'Opus5 Signal exp'],
    features: [
      'uses amp/glm-5.2 at no reasoning instead of a separate third-party api key',
      'filters long text results using tool input and recent user messages as relevance signals',
      'leaves short, oversized, mixed-media, failed, and insufficiently reduced results unchanged',
      'falls back to the original result when filtering fails or exceeds 30 seconds',
    ],
  }),
  plugin({
    slug: 'fable-mode',
    name: 'fable mode',
    filename: 'fable-mode.ts',
    summary: 'run claude fable 5 across five deliberate reasoning levels.',
    description:
      'registers claude fable 5 at high reasoning and adds low, medium, xhigh, and max variants with a focused coding-agent prompt and tool set.',
    requirements: ['amp with experimental agent apis enabled', 'access to the anthropic/claude-fable-5 model'],
    modes: ['Claude Fable 5 high', 'Claude Fable low', 'Claude Fable med', 'Claude Fable xhi', 'Claude Fable max'],
    features: [
      'five reasoning variants from low through max',
      'coding-focused system instructions for investigation, implementation, and verification',
      'curated smart-tool access for each registered mode',
      'runtime-safe labels that stay within amp plugin limits',
    ],
  }),
] as const satisfies readonly Plugin[]

export function findPlugin(slug: string): Plugin | undefined {
  return plugins.find((item) => item.slug === slug)
}
