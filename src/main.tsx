import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Copy, GithubLogo } from '@phosphor-icons/react'
import { Analytics } from '@vercel/analytics/react'
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { findPlugin, plugins, repositoryUrl, type Plugin } from './plugins'
import './styles.css'

type SourceState = {
  status: 'loading' | 'ready' | 'error'
  source: string | null
  lines: number | null
}

function usePluginSource(rawUrl: string): SourceState {
  const [state, setState] = useState<SourceState>({ status: 'loading', source: null, lines: null })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading', source: null, lines: null })

    fetch(rawUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`http ${response.status}`)
        return response.text()
      })
      .then((text) => {
        if (cancelled) return
        setState({ status: 'ready', source: text, lines: text.replace(/\n$/, '').split('\n').length })
      })
      .catch(() => {
        if (cancelled) return
        setState({ status: 'error', source: null, lines: null })
      })

    return () => { cancelled = true }
  }, [rawUrl])

  return state
}

function useSha256(source: string | null) {
  const [hash, setHash] = useState<string | null>(null)
  useEffect(() => {
    if (source == null) { setHash(null); return }
    let cancelled = false
    crypto.subtle.digest('SHA-256', new TextEncoder().encode(source)).then((buffer) => {
      if (cancelled) return
      setHash(Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, '0')).join(''))
    })
    return () => { cancelled = true }
  }, [source])
  return hash
}

function lineCountLabel(lines: number | null) {
  return lines == null ? '···' : `${lines}`
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <button className="copy-button" type="button" onClick={copy} aria-label={copied ? `${label} copied` : `copy ${label}`}>
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      <span>{copied ? 'copied' : 'copy'}</span>
    </button>
  )
}

function AmpMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 21 21" fill="none" aria-hidden="true">
      <path d="M3.76879 18.3015L8.49839 13.505L10.2196 20.0399L12.72 19.3561L10.2288 9.86749L0.890876 7.33844L0.22594 9.89331L6.65134 11.6388L1.94138 16.4282L3.76879 18.3015Z" fill="#F34E3F" />
      <path d="M17.4074 12.7414L19.9078 12.0575L17.4167 2.56897L8.07873 0.0399246L7.4138 2.5948L15.2992 4.73685L17.4074 12.7414Z" fill="#F34E3F" />
      <path d="M13.8184 16.3883L16.3188 15.7044L13.8276 6.21588L4.48971 3.68683L3.82477 6.24171L11.7101 8.38376L13.8184 16.3883Z" fill="#F34E3F" />
    </svg>
  )
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="section-label" aria-hidden="true">
      <span><em>##</em> {children}</span>
      <i />
    </div>
  )
}

function Header() {
  return (
    <header className="site-header">
      <nav className="nav-shell" aria-label="primary navigation">
        <a className="brand" href="/" aria-label="amp plugin catalog home">
          <AmpMark />
          <span><em>~/</em>pcstyle/amp</span>
        </a>
        <div className="nav-links">
          <a href="/#plugins">plugins</a>
          <a href={repositoryUrl}><GithubLogo aria-hidden="true" /> <span>github</span></a>
        </div>
      </nav>
    </header>
  )
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-shell">
        <p>source-first extensions for amp.</p>
        <div className="footer-links">
          <a href={repositoryUrl}>github <ArrowUpRight aria-hidden="true" /></a>
          <a href="https://pcstyle.dev">pcstyle.dev <ArrowUpRight aria-hidden="true" /></a>
          <a href="https://ampcode.com">ampcode.com <ArrowUpRight aria-hidden="true" /></a>
        </div>
      </div>
    </footer>
  )
}

function CodeBlock({ source, excerpt = false }: { source: string; excerpt?: boolean }) {
  const lines = source.replace(/\n$/, '').split('\n')
  const shownLines = excerpt ? lines.slice(0, 18) : lines
  return (
    <div className={excerpt ? 'code-frame code-frame-excerpt' : 'code-frame'}>
      <pre aria-label={excerpt ? 'plugin source excerpt' : 'complete plugin source'} tabIndex={0}>
        <code>
          {shownLines.map((line, index) => (
            <span className="code-line" key={`${index}-${line}`}>
              <span className="line-number" aria-hidden="true">{index + 1}</span>
              <span>{line || ' '}</span>
            </span>
          ))}
        </code>
      </pre>
    </div>
  )
}

const SKELETON_WIDTHS = [58, 82, 41, 74, 63, 88, 35, 69, 79, 46, 85, 52, 71, 38, 66, 81, 44, 76]

function CodeSkeleton({ excerpt = false }: { excerpt?: boolean }) {
  const rows = excerpt ? 18 : 26
  return (
    <div className={excerpt ? 'code-frame code-frame-excerpt' : 'code-frame'}>
      <div className="code-skeleton" role="status" aria-label="loading plugin source">
        {Array.from({ length: rows }, (_, index) => (
          <span
            className="skeleton-line"
            key={index}
            style={{ width: `${SKELETON_WIDTHS[index % SKELETON_WIDTHS.length]}%` }}
          />
        ))}
      </div>
    </div>
  )
}

function CodeError({ rawUrl, excerpt = false }: { rawUrl: string; excerpt?: boolean }) {
  return (
    <div className={excerpt ? 'code-frame code-frame-excerpt' : 'code-frame'}>
      <div className="code-error" role="alert">
        <p>could not reach github to load this file.</p>
        <a href={rawUrl}>open the raw source <ArrowUpRight aria-hidden="true" /></a>
      </div>
    </div>
  )
}

function SourcePanel({ state, rawUrl, excerpt = false }: { state: SourceState; rawUrl: string; excerpt?: boolean }) {
  if (state.status === 'loading') return <CodeSkeleton excerpt={excerpt} />
  if (state.status === 'error' || state.source == null) return <CodeError rawUrl={rawUrl} excerpt={excerpt} />
  return <CodeBlock source={state.source} excerpt={excerpt} />
}

function PluginRow({ plugin }: { plugin: Plugin }) {
  return (
    <article className="plugin-row">
      <div className="plugin-main">
        <p className="file-label">{plugin.filename}</p>
        <h3><a href={`/plugins/${plugin.slug}`}>{plugin.name}</a></h3>
        <p>{plugin.summary}</p>
      </div>
      <div className="plugin-side">
        <div className="mode-pills" aria-label="modes">
          {plugin.modes.map((mode) => <span key={mode}>{mode}</span>)}
        </div>
        <a className="source-link" href={plugin.githubUrl}>source on github <ArrowUpRight aria-hidden="true" /></a>
      </div>
      <a className="row-link" href={`/plugins/${plugin.slug}`} aria-label={`view ${plugin.name}`}><ArrowRight aria-hidden="true" /></a>
    </article>
  )
}

function HomePage() {
  useEffect(() => { document.title = 'amp plugin catalog' }, [])
  const heroPlugin = findPlugin('compressr') ?? plugins[0]
  const heroSource = usePluginSource(heroPlugin.rawUrl)
  return (
    <>
      <Header />
      <main>
        <section className="hero shell rise">
          <div className="hero-copy">
            <p className="eyebrow"><em>→</em> amp plugins</p>
            <h1>small extensions.<br />full source.</h1>
            <p>install focused agent modes and inspect every line before it reaches your setup. every plugin is a single readable typescript file, served straight from the public repo.</p>
            <a className="primary-link" href="#plugins">browse plugins <ArrowRight aria-hidden="true" /></a>
          </div>
          <div className="hero-code" aria-label={`${heroPlugin.name} source excerpt`}>
            <div className="code-title">
              <span>plugins/{heroPlugin.filename}</span>
              <span>{lineCountLabel(heroSource.lines)} lines</span>
            </div>
            <SourcePanel state={heroSource} rawUrl={heroPlugin.rawUrl} excerpt />
          </div>
        </section>

        <section className="catalog shell rise" id="plugins" aria-labelledby="catalog-title">
          <SectionLabel>catalog</SectionLabel>
          <div className="section-heading">
            <h2 id="catalog-title">the complete catalog</h2>
            <p>{plugins.length} plugins, sourced directly from the installable typescript files.</p>
          </div>
          <div className="plugin-list">
            {plugins.map((item) => <PluginRow plugin={item} key={item.slug} />)}
          </div>
        </section>

        <section className="trust shell rise" aria-labelledby="trust-title">
          <SectionLabel>trust</SectionLabel>
          <h2 id="trust-title">read it. verify it. install it.</h2>
          <p>no bundles, no minified blobs, no external badges to take on faith. the install command fetches a raw file from <a href={repositoryUrl}>github.com/pc-style/amp-plugins</a> — the same file rendered on each detail page.</p>
          <div className="trust-steps">
            <div>
              <em>01</em>
              <h3>read the source</h3>
              <p>every detail page renders the complete plugin file, line by line. it is the exact content the install command downloads.</p>
            </div>
            <div>
              <em>02</em>
              <h3>verify the checksum</h3>
              <p>each page computes the pinned source's sha-256 digest. compare it with your download before installing.</p>
            </div>
            <div>
              <em>03</em>
              <h3>install with one command</h3>
              <p>a single curl writes the file into amp's plugin directory. no installer scripts, no postinstall hooks, nothing else runs.</p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}

function DetailPage({ plugin }: { plugin: Plugin }) {
  useEffect(() => { document.title = `${plugin.name} | amp plugin catalog` }, [plugin.name])
  const sourceState = usePluginSource(plugin.rawUrl)
  const sha256 = useSha256(sourceState.source)
  const verifyCommand = `curl -fsSL ${plugin.rawUrl} | shasum -a 256`
  return (
    <>
      <Header />
      <main>
        <article>
          <header className="detail-hero shell rise">
            <a className="back-link" href="/"><ArrowLeft aria-hidden="true" /> all plugins</a>
            <div className="detail-grid">
              <div>
                <p className="file-label">{plugin.filename}</p>
                <h1>{plugin.name}</h1>
                <p className="detail-lede">{plugin.description}</p>
              </div>
              <dl className="metadata">
                <div><dt>source</dt><dd>{lineCountLabel(sourceState.lines)} lines</dd></div>
                <div><dt>language</dt><dd>typescript</dd></div>
                <div><dt>distribution</dt><dd>raw source</dd></div>
                <div><dt>sha-256</dt><dd>{sha256 ? `${sha256.slice(0, 16)}…` : '···'}</dd></div>
                <div><dt>repo</dt><dd><a href={plugin.githubUrl}>view on github</a></dd></div>
              </dl>
            </div>
          </header>

          <section className="install-section shell rise" aria-labelledby="install-title">
            <SectionLabel>install</SectionLabel>
            <div className="section-heading compact"><h2 id="install-title">install</h2><p>run this exact command from your terminal.</p></div>
            <div className="command-bar">
              <code>{plugin.installCommand}</code>
              <CopyButton value={plugin.installCommand} label="install command" />
            </div>
            <p className="install-note">the command creates amp's plugin directory if needed. reload plugins from amp's command palette afterward.</p>
          </section>

          <section className="audit-section shell" aria-labelledby="audit-title">
            <SectionLabel>audit</SectionLabel>
            <div className="section-heading compact"><h2 id="audit-title">audit before you install</h2></div>
            <p>
              the install command fetches <a href={plugin.rawUrl}>{plugin.rawUrl}</a> — the same file published at{' '}
              <a href={plugin.githubUrl}>github.com/pc-style/amp-plugins</a> and rendered in full below. to verify the downloaded bytes match that pinned source, compare its hash with the browser-computed digest:
            </p>
            <div className="command-bar">
              <code>{verifyCommand}</code>
              <CopyButton value={verifyCommand} label="verify command" />
            </div>
            <p className="checksum-note">
              expected sha-256 · <b>{sha256 ?? (sourceState.status === 'error' ? 'unavailable, source fetch failed' : 'computing…')}</b>
            </p>
          </section>

          <section className="facts shell" aria-label="plugin details">
            <div><h2><em>##</em> requirements</h2><ul>{plugin.requirements.map((item) => <li key={item}>{item}</li>)}</ul></div>
            <div>
              <h2><em>##</em> modes</h2>
              <div className="mode-pills">{plugin.modes.map((item) => <span key={item}>{item}</span>)}</div>
            </div>
            <div className="features"><h2><em>##</em> features</h2><ul>{plugin.features.map((item) => <li key={item}>{item}</li>)}</ul></div>
          </section>

          <section className="source-section shell" aria-labelledby="source-title">
            <SectionLabel>source</SectionLabel>
            <div className="source-heading">
              <div>
                <h2 id="source-title">complete source</h2>
                <p>{plugin.filename}, {lineCountLabel(sourceState.lines)} lines. fetched live from the repo.</p>
              </div>
              {sourceState.source != null && <CopyButton value={sourceState.source} label="full source" />}
            </div>
            <SourcePanel state={sourceState} rawUrl={plugin.rawUrl} />
          </section>
        </article>
      </main>
      <Footer />
    </>
  )
}

function NotFoundPage() {
  useEffect(() => { document.title = 'page not found | amp plugin catalog' }, [])
  return (
    <>
      <Header />
      <main className="not-found shell rise">
        <p className="eyebrow"><em>→</em> 404</p>
        <h1>plugin not found.</h1>
        <p>the catalog only publishes plugins that exist in the repository.</p>
        <a className="primary-link" href="/">return to catalog <ArrowRight aria-hidden="true" /></a>
      </main>
      <Footer />
    </>
  )
}

function App() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  if (path === '/') return <HomePage />
  const match = path.match(/^\/plugins\/([^/]+)$/)
  const plugin = match ? findPlugin(decodeURIComponent(match[1])) : undefined
  return plugin ? <DetailPage plugin={plugin} /> : <NotFoundPage />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Analytics />
  </StrictMode>,
)
