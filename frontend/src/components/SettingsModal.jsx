import { useState, useEffect, useCallback, useRef, Component } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useSettings } from '../contexts/SettingsContext'
import { useI18n } from '../contexts/I18nContext'

/* ── Error boundary ── */
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null } }
  static getDerivedStateFromError(error) { return { hasError: true, error } }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-center">
          <div className="text-[var(--ae-danger)] text-lg mb-2">Something went wrong</div>
          <p className="text-sm text-[var(--ae-text-muted)] mb-4">{this.state.error?.message}</p>
          <button className="ae-btn" onClick={() => this.setState({ hasError: false, error: null })}>
            Try Again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

/* ── Constants ── */
const TABS = [
  { id: 'profile', icon: 'fa-user-circle', label: '個人資料' },
  { id: 'children', icon: 'fa-child', label: '小朋友' },
  { id: 'personalization', icon: 'fa-palette', label: '個人化' },
  { id: 'advanced', icon: 'fa-key', label: 'API管理' },
]

const THEMES = [
  { id: 'light', icon: 'fa-sun', label: '淺色' },
  { id: 'dark', icon: 'fa-moon', label: '深色' },
  { id: 'auto', icon: 'fa-circle-half-stroke', label: '自動' },
]

const LANGS = [
  { id: 'zh-TW', label: '繁體中文', icon: 'fa-font' },
  { id: 'zh-CN', label: '简体中文', icon: 'fa-font' },
  { id: 'en', label: 'English', icon: 'fa-language' },
  { id: 'ja', label: '日本語', icon: 'fa-comment-dots' },
]

const MODELS_BY_PROVIDER = {
  ai_studio: ['gemini-3-flash', 'gemini-3-pro', 'gemini-3-flash-preview'],
  vertex_ai: ['gemini-3-flash', 'gemini-3-pro'],
}

/* ── Main Component ── */
export default function SettingsModal() {
  const { token, user } = useAuth()
  const settings = useSettings()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('profile')
  const [profile, setProfile] = useState({ username: '', email: '', avatar: null })
  const [children, setChildren] = useState([])
  const [keys, setKeys] = useState([])
  const [vertexAccounts, setVertexAccounts] = useState([])
  const [selectedApiKeyId, setSelectedApiKeyId] = useState(null)
  const [selectedVertexApiKeyId, setSelectedVertexApiKeyId] = useState(null)
  const [selectedVertexAccountId, setSelectedVertexAccountId] = useState(null)
  const [voices, setVoices] = useState([])
  const [subModal, setSubModal] = useState(null)
  const [editingChild, setEditingChild] = useState(null)
  const fileInputRef = useRef(null)

  const apiHeaders = useCallback(() => ({
    Authorization: `Bearer ${token}`, 'Content-Type': 'application/json',
  }), [token])

  /* Open via custom event */
  useEffect(() => {
    const handler = () => { setOpen(true); loadProfile() }
    window.addEventListener('open-settings', handler)
    return () => window.removeEventListener('open-settings', handler)
  }, [])

  /* Close on Esc */
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  const loadProfile = async () => {
    if (!token) return
    try {
      const r = await fetch('/auth/me', { headers: apiHeaders() })
      if (r.ok) {
        const d = await r.json()
        setProfile(u => ({ ...u, username: d.user?.username || '', email: d.user?.email || '', avatar: d.user?.avatar || null }))
      }
    } catch {}
  }

  const loadChildren = useCallback(() => {
    if (!token) return
    fetch('/api/children', { headers: apiHeaders() })
      .then(r => r.ok ? r.json() : {})
      .then(d => setChildren(d.children || d))
      .catch(() => {})
  }, [token])

  const loadConfigs = useCallback(() => {
    if (!token) return
    fetch('/api/keys', { headers: apiHeaders() })
      .then(r => r.ok ? r.json() : {})
      .then(d => {
        setKeys(d.api_keys || [])
        setSelectedApiKeyId(d.selected_api_key_id || null)
        setSelectedVertexApiKeyId(d.selected_vertex_api_key_id || null)
      })
      .catch(() => {})
    fetch('/api/vertex/accounts', { headers: apiHeaders() })
      .then(r => r.ok ? r.json() : {})
      .then(d => setVertexAccounts(d.accounts || []))
      .catch(() => {})
    fetch('/api/user/model', { headers: apiHeaders() })
      .then(r => r.ok ? r.json() : {})
      .then(d => setSelectedVertexAccountId(d.selected_vertex_account_id || null))
      .catch(() => {})
  }, [token])

  /* Load children when tab selected */
  useEffect(() => {
    if (!open || tab !== 'children' || !token) return
    loadChildren()
  }, [open, tab, token])

  /* Load keys + accounts when tab selected */
  useEffect(() => {
    if (!open || tab !== 'advanced' || !token) return
    loadConfigs()
  }, [open, tab, token])

  /* Load voices on personalization tab */
  useEffect(() => {
    if (!open || tab !== 'personalization' || !token) return
    fetch('/api/tts/voices', { headers: apiHeaders() })
      .then(r => r.ok ? r.json() : {})
      .then(d => setVoices(Array.isArray(d.voices) ? d.voices : []))
      .catch(() => {})
  }, [open, tab, token])

  if (!open) return null

  return (
    <div className="modal-backdrop flex items-center justify-center p-5" onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}>
      <div className="w-[min(1100px,100%)] max-h-[88vh] overflow-hidden bg-[var(--ae-surface)] border border-[var(--ae-border)] rounded-[22px] shadow-[var(--ae-shadow)] animate-fade-in">
        <div className="grid" style={{ gridTemplateColumns: '260px minmax(0,1fr)', minHeight: '70vh' }}>
          {/* ── Sidebar ── */}
          <div className="bg-[var(--ae-surface-soft)] border-r border-[var(--ae-border)] pt-14 px-4 pb-6 flex flex-col gap-2 relative">
            <button
              className="absolute top-4 left-4 z-10 w-9 h-9 rounded-full border border-[var(--ae-border)] bg-[var(--ae-surface)] text-[var(--ae-text-muted)] text-lg flex items-center justify-center cursor-pointer hover:bg-[var(--ae-primary-faint)] hover:text-[var(--ae-text)] transition-all"
              onClick={() => setOpen(false)}
            >×</button>
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`settings-sidebar-group ${tab === t.id ? 'active' : ''}`}
              ><i className={`fas ${t.icon} w-5 text-center`} /> <span>{t.label}</span></button>
            ))}
          </div>

          {/* ── Panel area ── */}
          <div className="p-7 overflow-auto">
            {tab === 'profile' && (
              <ErrorBoundary>
                <div>
                  <Header icon="fa-user-circle" title="個人資料" desc="管理您的個人資料和帳戶設定" />
                  <ProfileTab token={token} profile={profile} setProfile={setProfile} fileInputRef={fileInputRef} setSubModal={setSubModal} />
                </div>
              </ErrorBoundary>
            )}

            {tab === 'children' && (
              <ErrorBoundary>
                <div>
                  <Header icon="fa-child" title="小朋友資料" desc="管理小朋友的基本資料，用於評估和追蹤發展進度" />
                  <ChildrenTab token={token} children={children} setChildren={setChildren} setSubModal={setSubModal} setEditingChild={setEditingChild} />
                </div>
              </ErrorBoundary>
            )}

            {tab === 'personalization' && (
              <ErrorBoundary>
                <div>
                  <Header icon="fa-palette" title="個人化設定" desc="自訂您的個人化偏好設定" />
                  <PersonalizationTab token={token} voices={voices} />
                </div>
              </ErrorBoundary>
            )}

            {tab === 'advanced' && (
              <ErrorBoundary>
                <div>
                  <Header icon="fa-key" title="API 金鑰管理" desc="管理您的 Google AI API 金鑰" />
                  <AdvancedTab token={token} keys={keys} vertexAccounts={vertexAccounts} selectedApiKeyId={selectedApiKeyId} selectedVertexApiKeyId={selectedVertexApiKeyId} selectedVertexAccountId={selectedVertexAccountId} setKeys={setKeys} setVertexAccounts={setVertexAccounts} setSelectedApiKeyId={setSelectedApiKeyId} setSelectedVertexApiKeyId={setSelectedVertexApiKeyId} setSelectedVertexAccountId={setSelectedVertexAccountId} setSubModal={setSubModal} />
                </div>
              </ErrorBoundary>
            )}
          </div>
        </div>
      </div>

      {/* Sub-modals */}
      {subModal === 'editUsername' && <EditUsernameModal token={token} current={profile.username} onSaved={(v) => setProfile(p => ({ ...p, username: v }))} onClose={() => setSubModal(null)} />}
      {subModal === 'editEmail' && <EditEmailModal token={token} onClose={() => setSubModal(null)} />}
      {subModal === 'changePassword' && <ChangePasswordModal token={token} onClose={() => setSubModal(null)} />}
      {subModal === 'deleteAccount' && <DeleteAccountModal token={token} onClose={() => setSubModal(null)} />}
      {subModal === 'childForm' && <ChildFormModal token={token} child={editingChild} onSaved={() => { setSubModal(null); setEditingChild(null); loadChildren() }} onClose={() => { setSubModal(null); setEditingChild(null) }} />}
      {subModal === 'addConfig' && <AddConfigModal token={token} onSaved={() => { setSubModal(null); loadConfigs() }} onClose={() => setSubModal(null)} />}
    </div>
  )
}

function Header({ icon, title, desc }) {
  return (
    <div className="mb-[18px]">
      <h3 className="flex items-center gap-2.5 text-[1.7rem] -tracking-[0.03em] font-semibold m-0 mb-2">
        <i className={`fas ${icon}`} />{title}
      </h3>
      <p className="text-[var(--ae-text-muted)] text-[0.92rem] m-0">{desc}</p>
    </div>
  )
}

/* ── Profile Tab ── */
function ProfileTab({ token, profile, setProfile, fileInputRef, setSubModal }) {
  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    const form = new FormData(); form.append('avatar', file)
    const r = await fetch('/auth/update-avatar', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form })
    if (r.ok) { const d = await r.json(); setProfile(p => ({ ...p, avatar: d.avatar_path || null })) }
  }
  const handleClearAvatar = async () => {
    const r = await fetch('/auth/update-avatar', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
    if (r.ok) setProfile(p => ({ ...p, avatar: null }))
  }

  const { username, email, avatar } = profile
  return (
    <div>
      <ProfileRow label="頭像">
        <div className="avatar-preview overflow-hidden">
          {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : <i className="fas fa-user" />}
        </div>
        <div style={{ flex: 1 }} />
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
        <button className="ae-btn ae-btn--sm" onClick={() => fileInputRef.current?.click()}><i className="fas fa-edit" /> 編輯</button>
        <button className="ae-btn ae-btn--sm" onClick={handleClearAvatar}><i className="fas fa-times" /> 清除</button>
      </ProfileRow>
      <ProfileRow label="用戶名稱">
        <input type="text" value={username} readOnly className="ae-input flex-1 min-w-[200px]" />
        <button className="ae-btn ae-btn--sm" onClick={() => setSubModal('editUsername')}><i className="fas fa-edit" /> 編輯</button>
      </ProfileRow>
      <ProfileRow label="電子郵件">
        <input type="email" value={email} readOnly className="ae-input flex-1 min-w-[200px]" />
        <button className="ae-btn ae-btn--sm" onClick={() => setSubModal('editEmail')}><i className="fas fa-edit" /> 編輯</button>
      </ProfileRow>
      <ProfileRow label="密碼">
        <p className="text-sm text-[#666] m-0 flex-1">密碼由 Firebase 管理</p>
        <button className="ae-btn ae-btn--sm" onClick={() => setSubModal('changePassword')}><i className="fas fa-envelope" /> 發送重設郵件</button>
      </ProfileRow>
      <ProfileRow label="刪除帳號">
        <p className="text-sm text-[#b00020] m-0 flex-1">刪除帳號會永久移除您的所有資料，無法復原。</p>
        <button className="ae-btn ae-btn--sm ae-btn--danger" onClick={() => setSubModal('deleteAccount')}><i className="fas fa-trash" /> 刪除帳號</button>
      </ProfileRow>
    </div>
  )
}

function ProfileRow({ label, children }) {
  return (
    <div className="profile-item">
      <label className="field-label">{label}</label>
      <div className="field-content">{children}</div>
    </div>
  )
}

/* ── Children Tab ── */
function ChildrenTab({ token, children, setChildren, setSubModal, setEditingChild }) {
  const openAdd = () => { setEditingChild(null); setSubModal('childForm') }
  const openEdit = (c) => { setEditingChild(c); setSubModal('childForm') }
  const handleDelete = async (cid) => {
    if (!confirm('確定要刪除嗎？')) return
    await fetch(`/api/children/${cid}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    setChildren(prev => prev.filter(c => c.id !== cid))
  }

  const formatAge = (months) => {
    if (months == null) return ''
    const m = Math.round(months)
    if (m < 1) return '新生兒'
    const years = Math.floor(m / 12)
    const remain = m % 12
    return years > 0 ? (remain > 0 ? `${years}歲${remain}個月` : `${years}歲`) : `${remain}個月`
  }

  return (
    <div className="setting-item">
      <label>小朋友列表</label>
      {children.length === 0 ? (
        <div className="children-empty text-center py-6 border border-dashed border-[var(--ae-border)] rounded-2xl text-[var(--ae-text-muted)]">
          <i className="fas fa-child text-5xl opacity-30 mb-3 block" />
          <p>尚未添加小朋友資料</p>
          <p className="text-sm opacity-70 mt-2">點擊下方按鈕添加第一筆資料</p>
        </div>
      ) : (
        <div className="children-list">
          {children.map(c => (
            <div key={c.id} className="child-card">
              <div className="child-avatar"><i className="fas fa-child" /></div>
              <div className="child-info">
                <span className="child-name">{c.name}</span>
                <span className="text-sm text-[var(--ae-text-muted)]">{c.birthdate || '-'} · {c.gender || '-'}{formatAge(c.age_months) ? ` · ${formatAge(c.age_months)}` : ''}</span>
              </div>
              <div className="flex gap-2">
                <button className="edit-btn" onClick={() => openEdit(c)}><i className="fas fa-edit" /> 編輯</button>
                <button className="clear-btn" onClick={() => handleDelete(c.id)}><i className="fas fa-trash" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      <button className="add-api-key-btn !mt-4" onClick={openAdd}><i className="fas fa-plus" /> 添加小朋友</button>
    </div>
  )
}

/* ── Personalization Tab (FIXED) ── */
function PersonalizationTab({ token, voices }) {
  const { theme, language, voice, updateSetting } = useSettings()
  const { setLocale } = useI18n()

  const handleTheme = useCallback((t) => {
    try { updateSetting('theme', t) } catch {}
  }, [updateSetting])

  const handleLang = useCallback(async (l) => {
    setLocale(l)
    try { updateSetting('language', l) } catch {}
    try {
      await fetch('/api/user/profile', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: l }),
      })
    } catch {}
  }, [token, updateSetting, setLocale])

  const handleVoice = useCallback(async (e) => {
    const v = e.target.value
    try { updateSetting('voice', v) } catch {}
    try {
      await fetch('/api/user/profile', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice: v }),
      })
    } catch {}
  }, [token, updateSetting])

  return (
    <>
      {/* Theme */}
      <div className="setting-item">
        <label>主題模式</label>
        <div className="theme-selector" style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))' }}>
          {THEMES.map(t => (
            <button key={t.id}
              className={`theme-btn ${theme === t.id ? '!bg-[var(--ae-primary)] !text-white !border-[var(--ae-primary)]' : ''}`}
              onClick={() => handleTheme(t.id)}
            ><i className={`fas ${t.icon}`} /> {t.label}</button>
          ))}
        </div>
      </div>

      {/* Language */}
      <div className="setting-item">
        <label>界面語言</label>
        <div className="language-grid" style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))' }}>
          {LANGS.map(l => (
            <button key={l.id}
              className={`lang-option ${language === l.id ? '!bg-[var(--ae-primary)] !text-white !border-[var(--ae-primary)]' : ''}`}
              onClick={() => handleLang(l.id)}
            ><i className={`fas ${l.icon}`} /> {l.label}</button>
          ))}
        </div>
      </div>

      {/* Voice */}
      <div className="setting-item">
        <label>朗讀語音 (TTS)</label>
        <select className="setting-select" value={voice || ''} onChange={handleVoice}>
          <option value="">-- 自動選擇 --</option>
          {Array.isArray(voices) && voices.map(v => (
            <option key={v.name} value={v.name}>{v.label || v.name} ({v.language || ''})</option>
          ))}
        </select>
      </div>
    </>
  )
}

/* ── Advanced Tab ── */
function AdvancedTab({ token, keys, vertexAccounts, selectedApiKeyId, selectedVertexApiKeyId, selectedVertexAccountId, setKeys, setVertexAccounts, setSelectedApiKeyId, setSelectedVertexApiKeyId, setSelectedVertexAccountId, setSubModal }) {
  const { aiProvider, aiModel, updateSetting } = useSettings()
  const [showDetails, setShowDetails] = useState(false)

  const reload = async () => {
    try {
      const [keysRes, vxRes, modelRes] = await Promise.all([
        fetch('/api/keys', { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }),
        fetch('/api/vertex/accounts', { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }),
        fetch('/api/user/model', { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } })
      ])
      if (keysRes.ok) {
        const d = await keysRes.json()
        setKeys(d.api_keys || [])
        setSelectedApiKeyId(d.selected_api_key_id || null)
        setSelectedVertexApiKeyId(d.selected_vertex_api_key_id || null)
      }
      if (vxRes.ok) {
        const d = await vxRes.json()
        setVertexAccounts(d.accounts || [])
      }
      if (modelRes.ok) {
        const d = await modelRes.json()
        setSelectedVertexAccountId(d.selected_vertex_account_id || null)
      }
    } catch {}
  }

  const handleProvider = useCallback(async (p) => {
    try { updateSetting('aiProvider', p) } catch {}
    try { await fetch('/api/user/model', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: p }) }) } catch {}
  }, [token, updateSetting])

  const handleModel = useCallback(async (m) => {
    try { updateSetting('aiModel', m) } catch {}
    try { await fetch('/api/user/model', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: m }) }) } catch {}
  }, [token, updateSetting])

  const handleSelectConfig = async (e) => {
    const val = e.target.value
    if (!val) return
    const [type, id] = val.split(':')
    try {
      if (type === 'ai_studio') {
        await fetch(`/api/keys/${id}/toggle`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
        handleProvider('ai_studio')
      } else if (type === 'vertex_account') {
        await fetch(`/api/vertex/accounts/${id}/activate`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
        // Automatically switch provider to vertex_ai
        handleProvider('vertex_ai')
      } else if (type === 'vertex_api_key') {
        await fetch(`/api/vertex/api-keys/${id}/activate`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
        handleProvider('vertex_ai')
      }
      await reload()
    } catch {}
  }

  const handleDeleteKey = async (kid) => {
    if (!confirm('確定要刪除？')) return
    await fetch(`/api/keys/${kid}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    await reload()
  }
  const handleDeleteVx = async (vid) => {
    if (!confirm('確定要刪除？')) return
    await fetch(`/api/vertex/accounts/${vid}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    await reload()
  }

  // Build config options for the dropdown
  const getConfigOptions = () => {
    const options = []
    if (aiProvider === 'ai_studio') {
      keys.filter(k => k.provider === 'ai_studio').forEach(k => {
        options.push({ type: 'ai_studio', id: k.id, name: k.name, active: k.id === selectedApiKeyId })
      })
    } else {
      vertexAccounts.forEach(v => {
        options.push({ type: 'vertex_account', id: v.id, name: v.name, active: v.id === selectedVertexAccountId })
      })
      keys.filter(k => k.provider === 'vertex_ai').forEach(k => {
        options.push({ type: 'vertex_api_key', id: k.id, name: k.name, active: k.id === selectedVertexApiKeyId })
      })
    }
    return options
  }

  const configOptions = getConfigOptions()
  const activeConfigLabel = (() => {
    const activeOpt = configOptions.find(o => o.active)
    if (!activeOpt) return '— 未選擇配置 —'
    const typeLabels = { ai_studio: 'AI Studio', vertex_account: 'Vertex · SA', vertex_api_key: 'Vertex · API Key' }
    return `${activeOpt.name} (${typeLabels[activeOpt.type] || activeOpt.type})`
  })()

  const models = MODELS_BY_PROVIDER[aiProvider] || MODELS_BY_PROVIDER.ai_studio

  return (
    <>
      {/* Summary block */}
      <div className="setting-item advanced-summary">
        <label>目前設定</label>
        <div className="advanced-summary-grid" style={{ display: 'grid', gap: 12 }}>
          <div className="summary-block" style={{ display: 'grid', gap: 12, padding: 16, borderRadius: 14, border: '1px solid var(--ae-border)', background: 'var(--ae-surface-soft)' }}>
            <div className="summary-title text-[var(--ae-text-muted)] text-xs uppercase tracking-wider font-semibold">已選擇模型</div>
            <div className="summary-value text-xl font-bold">{aiModel || '-'}</div>
            <div className="summary-sub text-sm text-[var(--ae-text-muted)]">{activeConfigLabel}</div>
            <div className="summary-controls" style={{ display: 'grid', gap: 12 }}>
              <div className="summary-control" style={{ display: 'grid', gap: 6 }}>
                <span className="summary-control-label text-xs uppercase tracking-wider font-semibold text-[var(--ae-text-muted)]">AI 提供商</span>
                <div className="summary-provider-toggle" style={{ display: 'flex', gap: 8 }}>
                  <button className={`summary-provider-btn ${aiProvider === 'ai_studio' ? '!bg-[var(--ae-primary)] !text-white !border-[var(--ae-primary)]' : ''}`}
                    onClick={() => handleProvider('ai_studio')}>AI Studio (Gemini API)</button>
                  <button className={`summary-provider-btn ${aiProvider === 'vertex_ai' ? '!bg-[var(--ae-primary)] !text-white !border-[var(--ae-primary)]' : ''}`}
                    onClick={() => handleProvider('vertex_ai')}>Vertex AI</button>
                </div>
              </div>
              <div className="summary-control" style={{ display: 'grid', gap: 6 }}>
                <span className="summary-control-label text-xs uppercase tracking-wider font-semibold text-[var(--ae-text-muted)]">使用配置</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select className="setting-select summary-select" value="" onChange={handleSelectConfig}>
                    <option value="">{configOptions.length === 0 ? '— 暫無配置 —' : activeConfigLabel}</option>
                    {configOptions.map(o => (
                      <option key={`${o.type}:${o.id}`} value={`${o.type}:${o.id}`}>
                        {o.name} · {o.type === 'ai_studio' ? 'AI Studio' : o.type === 'vertex_account' ? 'Vertex SA' : 'Vertex API Key'}
                        {o.active ? ' ✓' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="summary-control" style={{ display: 'grid', gap: 6 }}>
                <span className="summary-control-label text-xs uppercase tracking-wider font-semibold text-[var(--ae-text-muted)]">AI 模型選擇</span>
                <select className="setting-select summary-select" value={aiModel || 'gemini-3-flash'} onChange={e => handleModel(e.target.value)}>
                  {models.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>
        <button className="add-api-key-btn !mt-4" onClick={() => setShowDetails(p => !p)}>
          <i className="fas fa-cog" /> {showDetails ? '隱藏配置' : '管理配置'}
        </button>
      </div>

      {showDetails && (
        <ConfigList keys={keys} vertexAccounts={vertexAccounts} selectedApiKeyId={selectedApiKeyId} selectedVertexApiKeyId={selectedVertexApiKeyId} selectedVertexAccountId={selectedVertexAccountId} onDeleteKey={handleDeleteKey} onDeleteVx={handleDeleteVx} setSubModal={setSubModal} />
      )}
    </>
  )
}

/* ── Config List Component ── */
function ConfigList({ keys, vertexAccounts, selectedApiKeyId, selectedVertexApiKeyId, selectedVertexAccountId, onDeleteKey, onDeleteVx, setSubModal }) {
  const { aiProvider } = useSettings()
  const allConfigs = []

  keys.forEach(k => {
    if (k.provider === 'ai_studio') {
      allConfigs.push({ type: 'ai_studio', id: k.id, name: k.name, sub: k.masked_key, raw: k, isActive: aiProvider === 'ai_studio' && k.id === selectedApiKeyId })
    }
    if (k.provider === 'vertex_ai') {
      allConfigs.push({ type: 'vertex_api_key', id: k.id, name: k.name, sub: k.masked_key, raw: k, isActive: aiProvider === 'vertex_ai' && k.id === selectedVertexApiKeyId })
    }
  })
  vertexAccounts.forEach(v => {
    allConfigs.push({ type: 'vertex_service_account', id: v.id, name: v.name, sub: `Project: ${v.project_id || '-'}`, raw: v, isActive: aiProvider === 'vertex_ai' && v.id === selectedVertexAccountId })
  })

  const getBadge = (type) => {
    switch (type) {
      case 'ai_studio':            return { label: 'AI Studio',                color: '#ea4335', icon: 'fa-robot' }
      case 'vertex_api_key':       return { label: 'Vertex AI · API Key',      color: '#1a73e8', icon: 'fa-key' }
      case 'vertex_service_account': return { label: 'Vertex AI · 服務帳號',   color: '#4285f4', icon: 'fa-cloud' }
      default:                     return { label: type,                       color: '#888',    icon: 'fa-question' }
    }
  }

  return (
    <div className="advanced-config-details">
      <div className="setting-item">
        <label>已添加的配置</label>
        <p className="setting-description text-sm text-[var(--ae-text-muted)] mb-3">管理您已添加的 AI Studio 和 Vertex AI 配置</p>
        <div className="config-list-container" style={{ display: 'grid', gap: 8 }}>
          {allConfigs.length === 0 ? (
            <p className="text-sm text-[var(--ae-text-muted)]">暫無配置</p>
          ) : allConfigs.map(c => {
            const badge = getBadge(c.type)
            return (
              <div key={`${c.type}-${c.id}`} className="child-card">
                <div className="child-avatar" style={{ background: badge.color + '18', color: badge.color }}>
                  <i className={`fas ${badge.icon}`} />
                </div>
                <div className="child-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span className="child-name">{c.name}</span>
                    <span style={{ display: 'inline-block', padding: '3px 10px', background: badge.color, color: '#fff', borderRadius: 4, fontSize: 10, fontWeight: 600, lineHeight: 1.2 }}>
                      {badge.label}
                    </span>
                    {c.isActive && (
                      <span style={{ display: 'inline-block', padding: '3px 10px', background: '#16a34a', color: '#fff', borderRadius: 4, fontSize: 10, fontWeight: 600, lineHeight: 1.2 }}>
                        使用中
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-[var(--ae-text-muted)]">{c.sub}</span>
                </div>
                <button className="clear-btn"
                  onClick={() => c.type === 'vertex_service_account' ? onDeleteVx(c.id) : onDeleteKey(c.id)}>
                  <i className="fas fa-trash" />
                </button>
              </div>
            )
          })}
        </div>
      </div>
      <button className="add-api-key-btn" onClick={() => setSubModal('addConfig')}>
        <i className="fas fa-plus" /> 添加配置
      </button>
    </div>
  )
}

/* ── Sub-modal Components ── */

function EditUsernameModal({ token, current, onSaved, onClose }) {
  const [val, setVal] = useState(current)
  const handleSave = async () => {
    const r = await fetch('/auth/update-profile', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ username: val }) })
    if (r.ok) { onSaved(val); onClose() } else { alert((await r.json()).error || 'Failed') }
  }
  return <SubModalShell title="Edit Username" onClose={onClose}>
    <input className="ae-input mb-4" value={val} onChange={e => setVal(e.target.value)} required />
    <SubModalActions onSave={handleSave} onCancel={onClose} label="保存" />
  </SubModalShell>
}

function EditEmailModal({ token, onClose }) {
  const [val, setVal] = useState('')
  const handleSave = async () => {
    const r = await fetch('/auth/update-profile', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: val }) })
    if (r.ok) { onClose() } else { alert((await r.json()).error || 'Failed') }
  }
  return <SubModalShell title="Edit Email" onClose={onClose}>
    <p className="text-center mb-3 text-sm text-[#666]"><i className="fas fa-info-circle" /> 驗證電郵將發送至新地址，驗證後自動更新。</p>
    <input type="email" className="ae-input mb-4" value={val} onChange={e => setVal(e.target.value)} required />
    <SubModalActions onSave={handleSave} onCancel={onClose} label="發送驗證" icon="fa-paper-plane" />
  </SubModalShell>
}

function ChangePasswordModal({ token, onClose }) {
  const handleSend = async () => {
    const r = await fetch('/auth/change-password', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
    if (r.ok) { alert('密碼重設郵件已發送'); onClose() } else { alert((await r.json()).error || 'Failed') }
  }
  return <SubModalShell title="Reset Password" onClose={onClose}>
    <p className="text-center mb-4 text-[#666]">A password reset link will be sent to your email address.</p>
    <SubModalActions onSave={handleSend} onCancel={onClose} label="發送重設郵件" icon="fa-paper-plane" />
  </SubModalShell>
}

function DeleteAccountModal({ token, onClose }) {
  const [pw, setPw] = useState('')
  const handleDelete = async () => {
    if (!pw.trim()) { alert('請輸入密碼'); return }
    const r = await fetch('/auth/delete-account', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm_password: pw }) })
    if (r.ok) { localStorage.removeItem('access_token'); localStorage.removeItem('refresh_token'); window.location.href = '/login' }
    else { alert((await r.json()).error || 'Failed') }
  }
  return <SubModalShell title="Delete Account" onClose={onClose}>
    <p className="text-center mb-3 text-sm text-[#b00020]">Please enter your password to confirm account deletion.</p>
    <input type="password" className="ae-input mb-4" value={pw} onChange={e => setPw(e.target.value)} placeholder="Enter your password" required />
    <SubModalActions onSave={handleDelete} onCancel={onClose} label="確認刪除" danger />
  </SubModalShell>
}

function ChildFormModal({ token, child, onSaved, onClose }) {
  const [name, setName] = useState(child?.name || '')
  const [birthdate, setBirthdate] = useState(child?.birthdate || '')
  const [gender, setGender] = useState(child?.gender || '')
  const [notes, setNotes] = useState(child?.notes || '')
  const isEdit = !!child
  const handleSave = async () => {
    const body = { name, birthdate, gender, notes }
    const url = isEdit ? `/api/children/${child.id}` : '/api/children'
    const r = await fetch(url, { method: isEdit ? 'PUT' : 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (r.ok) { onSaved() } else { alert((await r.json()).error || 'Failed') }
  }
  return <SubModalShell title={isEdit ? 'Edit Child' : 'Add Child'} onClose={onClose}>
    <FormField label="Name *"><input className="ae-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Oliver" required /></FormField>
    <FormField label="Birth Date *"><input type="date" className="ae-input" value={birthdate} onChange={e => setBirthdate(e.target.value)} onClick={e => { try { e.currentTarget.showPicker() } catch {} }} required /></FormField>
    <FormField label="Gender">
      <select className="ae-select" value={gender} onChange={e => setGender(e.target.value)}>
        <option value="">不透露</option><option value="male">男</option><option value="female">女</option><option value="other">其他</option>
      </select>
    </FormField>
    <FormField label="Notes"><textarea className="ae-textarea" rows="3" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Premature birth, allergies, or other notes" /></FormField>
    <SubModalActions onSave={handleSave} onCancel={onClose} label="保存" />
  </SubModalShell>
}

function AddConfigModal({ token, onSaved, onClose }) {
  const [provider, setProvider] = useState('ai_studio')
  const [name, setName] = useState('')
  const [keyVal, setKeyVal] = useState('')
  const [vertexAuth, setVertexAuth] = useState('service_account')
  const [vertexCred, setVertexCred] = useState('')
  const [vertexApiKey, setVertexApiKey] = useState('')
  const [detectedProjectId, setDetectedProjectId] = useState('')
  const fileInputRef = useRef(null)

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const content = ev.target.result
      setVertexCred(content)
      try {
        const parsed = JSON.parse(content)
        setDetectedProjectId(parsed.project_id || '')
      } catch {
        setDetectedProjectId('')
      }
    }
    reader.readAsText(file)
  }

  const handleSave = async () => {
    if (provider === 'ai_studio') {
      const r = await fetch('/api/keys', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name, api_key: keyVal, provider: 'ai_studio' }) })
      if (!r.ok) { alert((await r.json()).error || 'Failed'); return }
    } else {
      if (vertexAuth === 'api_key') {
        const r = await fetch('/api/keys', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name, api_key: vertexApiKey, provider: 'vertex_ai' }) })
        if (!r.ok) { alert((await r.json()).error || 'Failed'); return }
      } else {
        if (!vertexCred.trim()) { alert('請先上載服務帳號 JSON 檔案'); return }
        try { JSON.parse(vertexCred) } catch { alert('無效的 JSON 檔案'); return }
        const r = await fetch('/api/vertex/accounts', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name, service_account_json: vertexCred }) })
        if (!r.ok) { alert((await r.json()).error || 'Failed'); return }
      }
    }
    onSaved()
  }

  return <SubModalShell title="添加配置" onClose={onClose}>
    <div className="flex gap-2 mb-5 border-b-2 border-[#e0e0e0]">
      {['ai_studio', 'vertex_ai'].map(p => (
        <button key={p} className={`flex-1 py-3 border-0 bg-transparent cursor-pointer font-semibold transition-all ${provider === p ? 'text-[#8B7AA8] border-b-[3px] border-[#8B7AA8]' : 'text-[#666] border-b-[3px] border-transparent'}`}
          onClick={() => setProvider(p)}><i className={`fas ${p === 'ai_studio' ? 'fa-robot' : 'fa-cloud'} mr-1`} />{p === 'ai_studio' ? 'AI Studio' : 'Vertex AI'}</button>
      ))}
    </div>
    <FormField label="配置名稱"><input className="ae-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. My Key" required /></FormField>
    {provider === 'ai_studio' ? (
      <FormField label="API 金鑰">
        <input type="password" className="ae-input" value={keyVal} onChange={e => setKeyVal(e.target.value)} placeholder="Enter your Google AI API key" required />
        <small className="block mt-2 text-xs text-[#8B7AA8]">您的 API 金鑰將被加密存儲</small>
      </FormField>
    ) : (
      <>
        <div className="flex gap-2 mb-5 border-b-2 border-[#e0e0e0]">
          {['service_account', 'api_key'].map(m => (
            <button key={m} className={`flex-1 py-2.5 border-0 bg-transparent cursor-pointer font-semibold transition-all ${vertexAuth === m ? 'text-[#8B7AA8] border-b-[3px] border-[#8B7AA8]' : 'text-[#666] border-b-[3px] border-transparent'}`}
              onClick={() => setVertexAuth(m)}>{m === 'service_account' ? 'Service Account' : 'API Key'}</button>
          ))}
        </div>
        {vertexAuth === 'service_account' ? (
          <FormField label="Service Account JSON">
            <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleFileUpload} />
            <div
              className="border-2 border-dashed border-[var(--ae-border)] rounded-xl p-8 text-center cursor-pointer hover:border-[var(--ae-primary)] transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault() }}
              onDrop={(e) => {
                e.preventDefault()
                const file = e.dataTransfer.files?.[0]
                if (!file) return
                const reader = new FileReader()
                reader.onload = (ev) => {
                  const content = ev.target.result
                  setVertexCred(content)
                  try {
                    const parsed = JSON.parse(content)
                    setDetectedProjectId(parsed.project_id || '')
                  } catch {
                    setDetectedProjectId('')
                  }
                }
                reader.readAsText(file)
              }}
            >
              <i className="fas fa-cloud-upload-alt text-3xl text-[var(--ae-text-muted)] mb-2 block" />
              <p className="text-sm text-[var(--ae-text-muted)] m-0">點擊或拖放上載 Service Account JSON 檔案</p>
              {vertexCred && <p className="text-xs text-[#16a34a] mt-2 m-0"><i className="fas fa-check-circle mr-1" />已選擇檔案</p>}
            </div>
            {detectedProjectId && <small className="block mt-2 text-xs text-[#16a34a]"><i className="fas fa-check-circle mr-1" />檢測到的專案 ID: {detectedProjectId}</small>}
          </FormField>
        ) : (
          <FormField label="Vertex API Key">
            <input type="password" className="ae-input" value={vertexApiKey} onChange={e => setVertexApiKey(e.target.value)} placeholder="Enter your Vertex API key" />
            <small className="block mt-2 text-xs text-[#666]">使用 Google Cloud Console 產生的 Vertex API Key</small>
          </FormField>
        )}
      </>
    )}
    <SubModalActions onSave={handleSave} onCancel={onClose} label="保存配置" icon="fa-save" />
  </SubModalShell>
}

function FormField({ label, children }) {
  return <div className="mb-5"><label className="block mb-2 text-sm font-medium">{label}</label>{children}</div>
}

function SubModalShell({ title, children, onClose }) {
  return (
    <div className="modal-backdrop flex items-center justify-center p-5" style={{ zIndex: 150 }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-[var(--ae-surface)] border border-[var(--ae-border)] rounded-[22px] w-full max-w-[500px] p-6 animate-fade-in shadow-[var(--ae-shadow)]" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">{title}</h2>
        {children}
      </div>
    </div>
  )
}

function SubModalActions({ onSave, onCancel, label, icon, danger }) {
  return (
    <div className="flex gap-3 mt-6 justify-end">
      <button className="custom-modal-btn flex items-center gap-2" onClick={onCancel}><i className="fas fa-times" />取消</button>
      <button className={`custom-modal-btn primary flex items-center gap-2 ${danger ? '!bg-[#b00020] !border-[#b00020]' : ''}`} onClick={onSave}>
        {icon && <i className={`fas ${icon}`} />}{label}
      </button>
    </div>
  )
}
