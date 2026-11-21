import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { ArrowDownToLine, Camera, Check, ChevronDown, Clipboard, ExternalLink, FileText, Globe2, Link2, LockKeyhole, ScanLine, Shield, ShieldAlert, X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { blankIncident, download, post } from './api'
import type { Assessment, Incident } from './api'
import { fields, languageNames, langIndex, translate } from './i18n'
import type { Language } from './i18n'
import { Resources } from './resources'
import './styles.css'

const Locale = createContext<Language>('en')
const Workflow = createContext<{ incident: Incident; setIncident: (incident: Incident) => void; checklist: string[]; setChecklist: (items: string[]) => void }>({
  incident: blankIncident, setIncident: () => {}, checklist: [], setChecklist: () => {},
})
const useT = () => {
  const language = useContext(Locale)
  return (key: string) => translate(language, key)
}
const errorCode = (error: unknown) => error instanceof Error ? error.message : 'failed'
const portal = 'https://cybercrime.gov.in/'
const chakshu = 'https://sancharsaathi.gov.in/'
const textSchema = z.string().trim().min(3).max(4000)
const scanSchema = z.object({ text: z.string().max(8000), url: z.string().max(2000) })
const imageTypes = ['image/png', 'image/jpeg', 'image/webp']
const errorKeys = new Set(['empty_input', 'invalid_input', 'invalid_url', 'invalid_image', 'unsupported_image', 'upload_too_large', 'rate_limit', 'review_required'])

function ErrorMessage({ code }: { code: string }) {
  const t = useT()
  return code && <p className="error" role="alert">{t(errorKeys.has(code) ? code : 'failed')}</p>
}

function OfficialLinks() {
  const t = useT()
  return <div className="official">
    <a href={portal} target="_blank" rel="noreferrer">{t('portal')} <ExternalLink size={15}/></a>
    <a href={chakshu} target="_blank" rel="noreferrer">{t('chakshu')} <ExternalLink size={15}/></a>
  </div>
}

function App() {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('scamshield-language')
    return saved === 'hi' || saved === 'as' ? saved : 'en'
  })
  const [incident, setIncident] = useState<Incident>(blankIncident)
  const [checklist, setChecklist] = useState<string[]>([])
  const { pathname } = useLocation()
  const t = (key: string) => translate(language, key)
  useEffect(() => {
    document.documentElement.lang = language
    localStorage.setItem('scamshield-language', language)
  }, [language])
  useEffect(() => {
    window.scrollTo(0, 0)
    document.getElementById('main')?.focus({ preventScroll: true })
  }, [pathname])
  return <Locale.Provider value={language}>
    <Workflow.Provider value={{ incident, setIncident, checklist, setChecklist }}>
      <header className="site-header"><div className="header-inner">
        <Link className="brand" to="/"><span><Shield size={19}/></span>ScamShield</Link>
        <nav aria-label="ScamShield">
          <NavLink to="/analyze">{t('analyze')}</NavLink>
          <NavLink to="/resources">{t('resources')}</NavLink>
          <NavLink className="emergency-nav" to="/emergency"><ShieldAlert size={17}/>{t('emergency')}</NavLink>
        </nav>
        <div className="language-control">
          <Globe2 className="language-icon" size={18} aria-hidden="true"/>
          <select className="language" aria-label="Language / भाषा / ভাষা" value={language} onChange={event => setLanguage(event.target.value as Language)}>
            <option value="en" lang="en">{languageNames.en}</option>
            <option value="hi" lang="hi">{languageNames.hi}</option>
            <option value="as" lang="as">{languageNames.as}</option>
          </select>
          <ChevronDown className="language-chevron" size={15} aria-hidden="true"/>
        </div>
      </div></header>
      <main id="main" tabIndex={-1}><Routes>
        <Route path="/" element={<ScanPage key="home" home/>}/>
        <Route path="/analyze" element={<ScanPage key="analyze"/>}/>
        <Route path="/emergency" element={<Emergency/>}/>
        <Route path="/report" element={<Report/>}/>
        <Route path="/resources" element={<div className="page"><Resources language={language}/><OfficialLinks/></div>}/>
        <Route path="*" element={<div className="page centered"><h1>{t('notFound')}</h1><Link className="button primary" to="/">{t('home')}</Link></div>}/>
      </Routes></main>
      <footer><div className="footer-inner"><Link className="brand" to="/"><Shield size={19}/> ScamShield</Link><span>{t('independent')}</span></div></footer>
    </Workflow.Provider>
  </Locale.Provider>
}

const modes = [{ id: 'message', Icon: FileText }, { id: 'screenshot', Icon: Camera }, { id: 'link', Icon: Link2 }] as const

function ScanPage({ home = false }: { home?: boolean }) {
  const t = useT()
  const language = useContext(Locale)
  const [mode, setMode] = useState<typeof modes[number]['id']>('message')
  const [file, setFile] = useState<File>()
  const [preview, setPreview] = useState('')
  const [scan, setScan] = useState<{ result: Assessment; language: Language }>()
  const [error, setError] = useState('')
  const { register, handleSubmit, reset, formState } = useForm({ defaultValues: { text: '', url: '' } })
  const fileInput = useRef<HTMLInputElement>(null)
  const resultHeading = useRef<HTMLHeadingElement>(null)
  const submitting = useRef(false)
  useEffect(() => {
    if (!file) { setPreview(''); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  useEffect(() => { if (scan) resultHeading.current?.focus() }, [scan])

  function select(candidate?: File) {
    if (!candidate) return
    if (candidate.size > 5 * 1024 * 1024) { setError('upload_too_large'); return }
    if (!imageTypes.includes(candidate.type)) { setError('invalid_image'); return }
    setFile(candidate)
    setError('')
  }

  const submit = handleSubmit(async data => {
    if (submitting.current) return
    const parsed = scanSchema.safeParse(data)
    if (!parsed.success) { setError('invalid_input'); return }
    if (!data.text.trim() && !data.url.trim() && !file) { setError('empty_input'); return }
    submitting.current = true
    setError('')
    const body = new FormData()
    body.set('text', data.text)
    body.set('url', data.url)
    body.set('language', language)
    if (file) body.set('image', file)
    try {
      const result: Assessment = await (await post('analyze', body)).json()
      setScan({ result, language })
    }
    catch (error) { setError(errorCode(error)) }
    finally { submitting.current = false }
  })

  return <>
    {!scan ? <section className="hero">
      <div className="hero-copy">
        <div className="hero-mark"><Shield size={25} strokeWidth={1.7}/></div>
        <h1>{t(home ? 'headline' : 'analyze')}</h1>
        <p className="hero-intro">{t('intro')}</p>
        <Link className="emergency-link" to="/emergency"><ShieldAlert size={18}/>{t('emergency')}</Link>
      </div>
      <div className="scan-workspace">
        <form id="scan" className="composer" onSubmit={submit} aria-label={t('analyze')} aria-busy={formState.isSubmitting}>
          <div className="mode-bar" aria-label={t('analyze')}>
            {modes.map(({ id, Icon }) => <button key={id} className={id === mode ? 'selected' : ''} type="button" aria-pressed={id === mode} onClick={() => setMode(id)}><Icon size={17}/>{t(id)}{id === 'screenshot' && file && <Check size={14}/>}</button>)}
          </div>
          <div className="composer-body">
            <div hidden={mode !== 'message'}><textarea aria-label={t('message')} placeholder={t('paste')} rows={5} maxLength={8000} {...register('text')}/></div>
            <div hidden={mode !== 'link'}><input aria-label={t('link')} type="text" inputMode="url" placeholder="https://example.com" maxLength={2000} {...register('url')}/></div>
            <div hidden={mode !== 'screenshot'}>
              <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={event => { select(event.target.files?.[0]); event.target.value = '' }}/>
              <button type="button" className="dropzone" onClick={() => fileInput.current?.click()} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); select(event.dataTransfer.files[0]) }}>
                <Camera size={23}/>{t('upload')}<small>PNG, JPEG, WebP · 5 MB</small>
              </button>
              {file && <div className="attachment">{preview && <img src={preview} alt={t('screenshot')}/>}<span>{file.name}</span><button type="button" className="icon-button" onClick={() => setFile(undefined)} aria-label={t('remove')}><X size={18}/></button></div>}
            </div>
            <ErrorMessage code={error}/>
          </div>
          <div className="composer-footer"><button className="button primary scan-button" disabled={formState.isSubmitting}><ScanLine size={18}/>{t(formState.isSubmitting ? 'busy' : 'scan')}</button></div>
        </form>
        <p className="privacy"><LockKeyhole size={16}/>{t('privacy')}</p>
      </div>
    </section> : <Results result={scan.result} generatedLanguage={scan.language} heading={resultHeading} again={() => { setScan(undefined); setMode('message'); setFile(undefined); reset() }}/>}
    {home && !scan && <section className="how"><div className="how-inner"><div><h2>{t('how')}</h2><p>{t('howText')}</p><p>{t('categories')}</p></div><OfficialLinks/></div></section>}
  </>
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="panel"><h2>{title}</h2>{children}</section>
}

function Results({ result, generatedLanguage, heading, again }: { result: Assessment; generatedLanguage: Language; heading: React.RefObject<HTMLHeadingElement | null>; again: () => void }) {
  const t = useT()
  const language = useContext(Locale)
  const originalLanguage = result.ai && generatedLanguage !== language
    ? t('generated_language') + ' · ' + languageNames[generatedLanguage]
    : ''
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)
  const contextItems = Object.entries(result.ai ?? {}).filter(([key, value]) => key !== 'transcript' && value.length > 0)
    .map(([key, value]) => [key, key === 'concern' ? t('concern_' + value) : value] as const)
  const findings = result.findings.map(item => t(item.id) + ' — ' + item.evidence)
  const links = result.links.map(link => [link.domain, t(link.reputation), ...link.threats.map(t)].join(' · '))
  const summary = [
    t(result.risk), t(result.basis), '', t('rules'), ...findings, '', t('ai'), t(result.ai_status),
    ...(originalLanguage ? [originalLanguage] : []),
    ...contextItems.map(([key, value]) => t(key) + ' — ' + (Array.isArray(value) ? value.join(' / ') : value)),
    '', t('verification'), ...links, '', t('limitations'), ...result.limitations.map(t), '', t('actions'), ...result.actions.map(t),
  ].join('\n')
  return <div className="page results">
    <div className="result-overview">
      <p className={'risk ' + result.risk}><ShieldAlert size={17}/>{t(result.risk)}</p>
      <h1 tabIndex={-1} ref={heading}>{t(result.basis)}</h1>
      {result.ai?.category && <p className="result-category"><strong>{t('category')}</strong><span lang={generatedLanguage}>{result.ai.category}</span></p>}
      {result.ai_status !== 'completed' && <p className="muted">{t('ai')} · {t(result.ai_status)}</p>}
    </div>
    <div className="button-row result-toolbar">
      <button className="button primary" onClick={again}>{t('again')}</button>
      <button className="button" onClick={async () => { try { await navigator.clipboard.writeText(summary); setCopied(true); setFailed(false) } catch { setFailed(true) } }}><Clipboard size={16}/>{t(copied ? 'copied' : 'copy')}</button>
      <button className="button" onClick={() => download(new Blob([summary], { type: 'text/plain;charset=utf-8' }), 'scamshield-analysis.txt')}><ArrowDownToLine size={16}/>{t('download')}</button>
    </div>
    <ErrorMessage code={failed ? 'failed' : ''}/>
    <section className="panel next-steps"><h2>{t('actions')}</h2><ul>{result.actions.map(action => <li key={action}>{t(action)}</li>)}</ul><Link to="/emergency">{t('emergency')}</Link></section>
    <div className="result-detail-grid">
      <Panel title={t('rules')}>{findings.length ? <ul>{findings.map((item, index) => <li key={index}>{item}</li>)}</ul> : <p>{t(result.rules_ran ? 'none' : 'skipped')}</p>}</Panel>
      <Panel title={t('ai')}><p className="muted">{t(result.ai_status)}</p>
        {originalLanguage && <p className="muted">{originalLanguage}</p>}
        <dl>{contextItems.map(([key, value]) => <div key={key}><dt>{t(key)}</dt><dd lang={key === 'concern' ? language : generatedLanguage}>{Array.isArray(value) ? <ul>{value.map((entry, index) => <li key={index}>{entry}</li>)}</ul> : value}</dd></div>)}</dl>
      </Panel>
      <Panel title={t('verification')}>{links.length ? <ul>{links.map((link, index) => <li key={index}>{link}</li>)}</ul> : <p>{t('skipped')}</p>}</Panel>
      <Panel title={t('limitations')}><ul>{result.limitations.map(item => <li key={item}>{t(item)}</li>)}</ul><OfficialLinks/></Panel>
    </div>
  </div>
}

const steps = ['bank', 'call', 'secure', 'preserve_evidence', 'avoid_interaction']

function Emergency() {
  const t = useT()
  const language = useContext(Locale)
  const { incident, setIncident, checklist, setChecklist } = useContext(Workflow)
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const { register, handleSubmit, formState } = useForm({ defaultValues: { description: incident.description } })
  const submit = handleSubmit(async ({ description }) => {
    const parsed = textSchema.safeParse(description)
    if (!parsed.success) { setError('invalid_input'); return }
    setError('')
    try {
      const result = await (await post('emergency/analyze', { description: parsed.data, language })).json()
      setIncident(result.incident)
      navigate('/report', { state: { status: result.status } })
    } catch (error) { setError(errorCode(error)) }
  })

  return <div className="page emergency-page">
    <div className="page-icon urgent"><ShieldAlert size={24}/></div><h1>{t('emergency')}</h1>
    <section className="urgent-box"><a className="phone" href="tel:1930">1930</a><p>{t('call')}</p><a href={portal} target="_blank" rel="noreferrer">{t('portal')} <ExternalLink size={15}/></a></section>
    <Panel title={t('checklist')}>
      <div className="checklist">{steps.map(step => <label key={step}><input type="checkbox" checked={checklist.includes(step)} onChange={event => setChecklist(event.target.checked ? [...checklist, step] : checklist.filter(item => item !== step))}/>{t(step)}</label>)}</div>
    </Panel>
    <Panel title={t('describe')}>
      <form onSubmit={submit}><textarea aria-label={t('describe')} rows={5} maxLength={4000} {...register('description')}/><p className="muted">{t('privacy')}</p><ErrorMessage code={error}/>
        <div className="button-row"><button className="button primary" disabled={formState.isSubmitting}>{t(formState.isSubmitting ? 'busy' : 'organize')}</button><Link className="button" to="/report">{t('review')}</Link></div>
      </form>
    </Panel>
  </div>
}

function Report() {
  const t = useT()
  const language = useContext(Locale)
  const { incident, setIncident } = useContext(Workflow)
  const { state } = useLocation()
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setError('')
    setBusy(true)
    try {
      const response = await post('reports/generate', { incident, confirmed, language })
      download(await response.blob(), 'scamshield-incident.pdf')
    } catch (error) { setError(errorCode(error)) }
    finally { setBusy(false) }
  }
  return <div className="page report-page"><div className="page-icon"><FileText size={24}/></div><h1>{t('report')}</h1>
    {state?.status && <p className="muted">{t('ai')} · {t(state.status)}</p>}
    <p className="lead">{t('disclaimer')}</p>
    <form className="panel report-grid" onSubmit={submit} onInvalid={event => {
      event.preventDefault()
      if (event.target instanceof HTMLElement) event.target.focus()
      setError('review_required')
    }}>
      {(Object.keys(fields) as (keyof Incident)[]).map(key => {
        const long = ['description', 'chronology', 'evidence', 'actions', 'missing'].includes(key)
        const props = { value: incident[key], maxLength: long ? 4000 : 500, required: key === 'description',
          onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            setIncident({ ...incident, [key]: event.target.value }); setConfirmed(false)
          } }
        return <label className={long ? 'wide' : ''} key={key}>{fields[key][langIndex[language]]}{long ? <textarea rows={3} {...props}/> : <input {...props}/>}</label>
      })}
      <details className="wide topic"><summary>{t('preview')}</summary><dl>
        {(Object.keys(fields) as (keyof Incident)[]).filter(key => incident[key].trim()).map(key =>
          <div key={key}><dt>{fields[key][langIndex[language]]}</dt><dd>{incident[key]}</dd></div>)}
      </dl></details>
      <label className="confirm wide"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)}/>{t('confirm')}</label>
      <div className="wide"><ErrorMessage code={error}/><button className="button primary" disabled={!confirmed || busy}><ArrowDownToLine size={17}/>{t(busy ? 'busy' : 'pdf')}</button></div>
    </form>
    <OfficialLinks/>
  </div>
}

createRoot(document.getElementById('root')!).render(<BrowserRouter><App/></BrowserRouter>)
