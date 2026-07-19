import { ArrowLeft, ArrowRight, Check, Copy, GithubLogo, TerminalWindow } from '@phosphor-icons/react'
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { findPlugin, plugins, type Plugin } from './plugins'
import './styles.css'

const repositoryUrl = 'https://github.com/pc-style/amp-plugins'

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <button className="copy-button" type="button" onClick={copy} aria-label={copied ? `${label} copied` : `Copy ${label}`}>
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      <span>{copied ? 'Copied' : 'Copy'}</span>
    </button>
  )
}

function Header() {
  return (
    <header className="site-header">
      <nav className="nav-shell" aria-label="Primary navigation">
        <a className="brand" href="/" aria-label="Amp plugin catalog home">
          <span className="brand-mark">A</span>
          <span>plugin catalog</span>
        </a>
        <div className="nav-links">
          <a href="/#plugins">Plugins</a>
          <a href={repositoryUrl}><GithubLogo aria-hidden="true" /> <span>GitHub</span></a>
        </div>
      </nav>
    </header>
  )
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-shell">
        <p>Source-first extensions for Amp.</p>
        <a href={repositoryUrl}>View repository <ArrowRight aria-hidden="true" /></a>
      </div>
    </footer>
  )
}

function CodeBlock({ source, excerpt = false }: { source: string; excerpt?: boolean }) {
  const lines = source.replace(/\n$/, '').split('\n')
  const shownLines = excerpt ? lines.slice(0, 18) : lines
  return (
    <div className={excerpt ? 'code-frame code-frame-excerpt' : 'code-frame'}>
      <pre aria-label={excerpt ? 'Plugin source excerpt' : 'Complete plugin source'} tabIndex={0}>
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

function PluginRow({ plugin }: { plugin: Plugin }) {
  return (
    <article className="plugin-row">
      <div className="plugin-main">
        <p className="file-label">{plugin.filename}</p>
        <h3><a href={`/plugins/${plugin.slug}`}>{plugin.name}</a></h3>
        <p>{plugin.summary}</p>
      </div>
      <div className="plugin-modes" aria-label="Modes">
        {plugin.modes.map((mode) => <span key={mode}>{mode}</span>)}
      </div>
      <a className="row-link" href={`/plugins/${plugin.slug}`} aria-label={`View ${plugin.name}`}><ArrowRight aria-hidden="true" /></a>
    </article>
  )
}

function HomePage() {
  useEffect(() => { document.title = 'Amp Plugin Catalog' }, [])
  return (
    <>
      <Header />
      <main>
        <section className="hero shell">
          <div className="hero-copy">
            <p className="eyebrow">Plugins for Amp</p>
            <h1>Small extensions.<br />Full source.</h1>
            <p>Install focused agent modes and inspect every line before it reaches your setup.</p>
            <a className="primary-link" href="#plugins">Browse plugins <ArrowRight aria-hidden="true" /></a>
          </div>
          <div className="hero-code" aria-label="Compressr source excerpt">
            <div className="code-title"><span>plugins/compressr.ts</span><span>214 lines</span></div>
            <CodeBlock source={plugins[0].source} excerpt />
          </div>
        </section>

        <section className="catalog shell" id="plugins" aria-labelledby="catalog-title">
          <div className="section-heading">
            <h2 id="catalog-title">The complete catalog</h2>
            <p>{plugins.length} plugins, sourced directly from the installable TypeScript files.</p>
          </div>
          <div className="plugin-list">
            {plugins.map((item) => <PluginRow plugin={item} key={item.slug} />)}
          </div>
        </section>

        <section className="principle shell" aria-labelledby="principle-title">
          <TerminalWindow aria-hidden="true" />
          <div>
            <h2 id="principle-title">Read it. Install it. Reload Amp.</h2>
            <p>Each detail page exposes the exact source served by GitHub, along with a single-line curl command that writes it to Amp's plugin directory.</p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}

function DetailPage({ plugin }: { plugin: Plugin }) {
  useEffect(() => { document.title = `${plugin.name} | Amp Plugin Catalog` }, [plugin.name])
  return (
    <>
      <Header />
      <main>
        <article>
          <header className="detail-hero shell">
            <a className="back-link" href="/"><ArrowLeft aria-hidden="true" /> All plugins</a>
            <div className="detail-grid">
              <div>
                <p className="file-label">{plugin.filename}</p>
                <h1>{plugin.name}</h1>
                <p className="detail-lede">{plugin.description}</p>
              </div>
              <dl className="metadata">
                <div><dt>Source</dt><dd>{plugin.sourceLines} lines</dd></div>
                <div><dt>Language</dt><dd>TypeScript</dd></div>
                <div><dt>Distribution</dt><dd>Raw source</dd></div>
              </dl>
            </div>
          </header>

          <section className="install-section shell" aria-labelledby="install-title">
            <div className="section-heading compact"><h2 id="install-title">Install</h2><p>Run this exact command from your terminal.</p></div>
            <div className="command-bar">
              <code>{plugin.installCommand}</code>
              <CopyButton value={plugin.installCommand} label="install command" />
            </div>
            <p className="install-note">The command creates Amp's plugin directory if needed. Reload plugins from Amp's command palette afterward.</p>
          </section>

          <section className="facts shell" aria-label="Plugin details">
            <div><h2>Requirements</h2><ul>{plugin.requirements.map((item) => <li key={item}>{item}</li>)}</ul></div>
            <div><h2>Modes</h2><ul>{plugin.modes.map((item) => <li key={item}>{item}</li>)}</ul></div>
            <div className="features"><h2>Features</h2><ul>{plugin.features.map((item) => <li key={item}>{item}</li>)}</ul></div>
          </section>

          <section className="source-section shell" aria-labelledby="source-title">
            <div className="source-heading">
              <div><h2 id="source-title">Complete source</h2><p>{plugin.filename}, {plugin.sourceLines} lines. Scroll horizontally for long lines.</p></div>
              <CopyButton value={plugin.source} label="full source" />
            </div>
            <CodeBlock source={plugin.source} />
          </section>
        </article>
      </main>
      <Footer />
    </>
  )
}

function NotFoundPage() {
  useEffect(() => { document.title = 'Page not found | Amp Plugin Catalog' }, [])
  return <><Header /><main className="not-found shell"><p className="eyebrow">404</p><h1>Plugin not found.</h1><p>The catalog only publishes plugins that exist in the repository.</p><a className="primary-link" href="/">Return to catalog <ArrowRight aria-hidden="true" /></a></main><Footer /></>
}

function App() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  if (path === '/') return <HomePage />
  const match = path.match(/^\/plugins\/([^/]+)$/)
  const plugin = match ? findPlugin(decodeURIComponent(match[1])) : undefined
  return plugin ? <DetailPage plugin={plugin} /> : <NotFoundPage />
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
