import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useI18n } from '../contexts/I18nContext'
import { API_BASE } from '../lib/apiBase'

const TABS = [
  { id: 'overview', icon: 'fa-chart-pie', label: '總覽' },
  { id: 'users', icon: 'fa-users', label: '用戶管理' },
  { id: 'reports', icon: 'fa-file-waveform', label: '分析報告' },
  { id: 'pose-runs', icon: 'fa-person-running', label: '姿態檢測' },
  { id: 'knowledge-base', icon: 'fa-brain', label: '知識庫' },
]

export default function AdminDashboard() {
  const { token } = useAuth()
  const { t } = useI18n()
  const [tab, setTab] = useState('overview')
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [usersPage, setUsersPage] = useState(1)
  const [usersTotal, setUsersTotal] = useState(1)
  const [usersSearch, setUsersSearch] = useState('')
  const [usersRole, setUsersRole] = useState('')
  const [userModal, setUserModal] = useState(null)
  const [editingUser, setEditingUser] = useState(null)
  const [reports, setReports] = useState([])
  const [reportsPage, setReportsPage] = useState(1)
  const [reportsTotal, setReportsTotal] = useState(1)
  const [reportsFilter, setReportsFilter] = useState({ status: 'all', attention: 'all', search: '' })
  const [poseRuns, setPoseRuns] = useState([])
  const [posePage, setPosePage] = useState(1)
  const [poseTotal, setPoseTotal] = useState(1)
  const [poseFilter, setPoseFilter] = useState({ attention: 'all', search: '' })
  const [docs, setDocs] = useState([])
  const [kbSearch, setKbSearch] = useState('')
  const [kbResults, setKbResults] = useState(null)
  const [detailModal, setDetailModal] = useState(null)
  const [kbUploading, setKbUploading] = useState(false)
  const kbInputRef = useRef(null)
  const kbZoneRef = useRef(null)

  const api = useCallback((url, opts = {}) => fetch(`${API_BASE}${url}`, { ...opts, headers: { Authorization: `Bearer ${token}`, ...opts.headers } }), [token])
  const apiJson = useCallback(async (...a) => { const r = await api(...a); return r.ok ? r.json() : Promise.reject(r) }, [api])

  // Load stats on mount
  useEffect(() => { apiJson('/admin/stats').then(d => setStats(d)).catch(() => {}) }, [])

  // Load users
  const loadUsers = useCallback(async (page = usersPage) => {
    try {
      const p = { page, per_page: 20 }
      if (usersSearch) p.search = usersSearch
      if (usersRole) p.role = usersRole
      const d = await apiJson('/admin/users?' + new URLSearchParams(p).toString())
      setUsers(d.users || [])
      setUsersTotal(d.total_pages || 1)
      setUsersPage(page)
    } catch {}
  }, [usersSearch, usersRole, apiJson, usersPage])

  useEffect(() => { if (tab === 'users') loadUsers() }, [tab, usersPage, usersSearch, usersRole])

  // Load reports
  const loadReports = useCallback(async (page = 1) => {
    try {
      const p = { page, per_page: 10, ...reportsFilter }
      const d = await apiJson('/admin/video-reports?' + new URLSearchParams({ page: p.page, per_page: p.per_page, status: p.status, attention: p.attention, search: p.search }).toString())
      setReports(d.reports || [])
      setReportsTotal(d.total_pages || 1)
      setReportsPage(page)
    } catch {}
  }, [reportsFilter, apiJson])

  useEffect(() => { if (tab === 'reports') loadReports() }, [tab, reportsPage, reportsFilter])

  // Load pose runs
  const loadPoseRuns = useCallback(async (page = 1) => {
    try {
      const p = { page, per_page: 10, ...poseFilter }
      const d = await apiJson('/admin/pose-runs?' + new URLSearchParams({ page: p.page, per_page: p.per_page, attention: p.attention, search: p.search }).toString())
      setPoseRuns(d.runs || [])
      setPoseTotal(d.total_pages || 1)
      setPosePage(page)
    } catch {}
  }, [poseFilter, apiJson])

  useEffect(() => { if (tab === 'pose-runs') loadPoseRuns() }, [tab, posePage, poseFilter])

  // Load KB docs
  const loadDocs = useCallback(async () => {
    try { const d = await apiJson('/admin/rag/documents'); setDocs(d.documents || []) } catch {}
  }, [apiJson])
  useEffect(() => { if (tab === 'knowledge-base') loadDocs() }, [tab])

  // User CRUD
  const handleAddUser = async (data) => {
    try {
      const r = await api('/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (r.ok) { alert('用戶創建成功！'); setUserModal(null); loadUsers() }
      else { alert((await r.json()).error || '創建失敗') }
    } catch { alert('創建失敗') }
  }
  const handleEditUser = async (data) => {
    try {
      const r = await api(`/admin/users/${data.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (r.ok) { alert('用戶更新成功！'); setUserModal(null); setEditingUser(null); loadUsers() }
      else { alert((await r.json()).error || '更新失敗') }
    } catch { alert('更新失敗') }
  }
  const handleDeleteUser = async (uid) => {
    if (!confirm('確定要刪除這個用戶？')) return
    await api(`/admin/users/${uid}`, { method: 'DELETE' })
    loadUsers()
  }
  const handleToggleStatus = async (uid, isActive) => {
    await api(`/admin/users/${uid}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !isActive }) })
    loadUsers()
  }

  // KB actions
  const handleKbUpload = async (e) => {
    const files = e.target.files
    if (!files || !files.length) return
    setKbUploading(true)
    const fd = new FormData()
    for (const f of files) fd.append('files', f)
    try { await api('/admin/rag/documents', { method: 'POST', body: fd }); loadDocs() } catch {}
    setKbUploading(false)
  }
  const handleKbDelete = async (id) => {
    if (!confirm('確定要刪除？')) return
    await api(`/admin/rag/documents/${id}`, { method: 'DELETE' })
    loadDocs()
  }
  const handleKbSearch = async () => {
    if (!kbSearch.trim()) return
    try { const d = await apiJson('/admin/rag/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: kbSearch }) }); setKbResults(d.results || []) } catch {}
  }

  // View detail
  const viewDetail = async (type, id) => {
    try {
      let d
      if (type === 'report') d = await apiJson(`/admin/video-reports/${id}`)
      else d = await apiJson(`/admin/pose-runs/${id}`)
      setDetailModal({ type, data: d })
    } catch {}
  }

  return (
    <main className="w-[min(calc(100%-40px),1440px)] mx-auto py-8 pb-12 flex-1 max-sm:w-[min(calc(100%-24px),1440px)]">
      {/* Tab Navigation */}
      <nav className="admin-tabs flex gap-1 border-b border-[var(--ae-border)] mb-7 overflow-x-auto">
        {TABS.map(tItem => (
          <button key={tItem.id} className={`admin-tab ${tab === tItem.id ? 'active' : ''}`} onClick={() => setTab(tItem.id)}>
            <i className={`fas ${tItem.icon}`} /> {getTabLabel(tItem.id, t)}
          </button>
        ))}
      </nav>

      <div className="admin-content">
        {tab === 'overview' && <OverviewTab stats={stats} setTab={setTab} setUserModal={setUserModal} />}
        {tab === 'knowledge-base' && <KnowledgeBaseTab docs={docs} kbSearch={kbSearch} setKbSearch={setKbSearch} kbResults={kbResults} handleKbUpload={handleKbUpload} handleKbDelete={handleKbDelete} handleKbSearch={handleKbSearch} kbUploading={kbUploading} kbInputRef={kbInputRef} kbZoneRef={kbZoneRef} />}
        {tab === 'users' && <UsersTab users={users} usersPage={usersPage} usersTotal={usersTotal} usersSearch={usersSearch} setUsersSearch={setUsersSearch} usersRole={usersRole} setUsersRole={setUsersRole} setUsersPage={setUsersPage} setUserModal={setUserModal} setEditingUser={setEditingUser} handleDeleteUser={handleDeleteUser} handleToggleStatus={handleToggleStatus} />}
        {tab === 'reports' && <ReportsTab reports={reports} reportsPage={reportsPage} reportsTotal={reportsTotal} reportsFilter={reportsFilter} setReportsFilter={setReportsFilter} setReportsPage={setReportsPage} viewDetail={viewDetail} />}
        {tab === 'pose-runs' && <PoseRunsTab poseRuns={poseRuns} posePage={posePage} poseTotal={poseTotal} poseFilter={poseFilter} setPoseFilter={setPoseFilter} setPosePage={setPosePage} viewDetail={viewDetail} />}
      </div>

      {/* Add User Modal */}
      {userModal === 'add' && <AddUserModal onClose={() => setUserModal(null)} onSave={handleAddUser} />}
      {/* Edit User Modal */}
      {userModal === 'edit' && editingUser && <EditUserModal user={editingUser} onClose={() => { setUserModal(null); setEditingUser(null) }} onSave={handleEditUser} />}
      {/* Detail Modal */}
      {detailModal && <DetailModal {...detailModal} onClose={() => setDetailModal(null)} />}
    </main>
  )
}

function getTabLabel(tabId, t) {
  const map = {
    overview: 'admin.nav.overview',
    users: 'admin.nav.users',
    reports: 'admin.nav.reports',
    'pose-runs': 'admin.nav.poseRuns',
    'knowledge-base': 'admin.nav.knowledgeBase',
  }
  return t(map[tabId] || tabId)
}

/* ── Overview Tab ── */
function OverviewTab({ stats, setTab, setUserModal }) {
  const { t } = useI18n()
  const totalUsers = stats?.total_users ?? stats?.users?.total ?? 0
  const newUsersToday = stats?.new_users_today ?? stats?.users?.new_today ?? 0
  const activeUsers = stats?.active_users ?? stats?.users?.active ?? 0
  const adminCount = stats?.admin_count ?? stats?.users?.admins ?? 0
  const totalVideos = stats?.total_videos ?? stats?.videos?.total ?? 0
  const failedVideos = stats?.failed_videos ?? stats?.videos?.failed ?? 0
  const flaggedReports = stats?.flagged_reports ?? stats?.reports?.flagged ?? 0
  const flaggedPoseRuns = stats?.flagged_pose_runs ?? stats?.pose_runs?.flagged ?? 0
  return (
    <section className="content-section animate-fade-in">
      <div className="welcome-banner">
        <div className="mascot">🦉</div>
        <div className="welcome-text">
          <h2>{t('admin.overview.welcome')}</h2>
          <p>{t('admin.overview.subtitle')}</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card purple" onClick={() => setTab('users')}>
          <div className="stat-icon"><i className="fas fa-users" /></div>
          <div className="stat-info"><span className="stat-number">{totalUsers}</span><span className="stat-label">{t('admin.stat.totalUsers')}</span></div>
          <div className="stat-badge new">+{newUsersToday} {t('admin.stat.newTodayBadge')}</div>
        </div>
        <div className="stat-card blue" onClick={() => setTab('users')}>
          <div className="stat-icon"><i className="fas fa-user-check" /></div>
          <div className="stat-info"><span className="stat-number">{activeUsers}</span><span className="stat-label">{t('admin.stat.activeUsers')}</span></div>
          <div className="stat-badge">{adminCount} {t('admin.stat.admins')}</div>
        </div>
        <div className="stat-card green" onClick={() => setTab('reports')}>
          <div className="stat-icon"><i className="fas fa-video" /></div>
          <div className="stat-info"><span className="stat-number">{totalVideos}</span><span className="stat-label">{t('admin.stat.videos')}</span></div>
          <div className="stat-badge success">{failedVideos} {t('admin.stat.failed')}</div>
        </div>
      </div>

      <div className="admin-focus-panel">
        <h3><i className="fas fa-triangle-exclamation" /> {t('admin.focus.title')}</h3>
        <div className="focus-grid">
          <button className="focus-card critical" onClick={() => setTab('reports')}>
            <span className="focus-card__label">{t('admin.focus.flaggedReports')}</span>
            <span className="focus-card__count">{flaggedReports}</span>
            <span className="focus-card__hint">{t('admin.focus.flaggedReportsHint')}</span>
          </button>
          <button className="focus-card warning" onClick={() => setTab('pose-runs')}>
            <span className="focus-card__label">{t('admin.focus.flaggedPose')}</span>
            <span className="focus-card__count">{flaggedPoseRuns}</span>
            <span className="focus-card__hint">{t('admin.focus.flaggedPoseHint')}</span>
          </button>
        </div>
      </div>

      <div className="quick-actions">
        <h3><i className="fas fa-bolt" /> {t('admin.quickActions')}</h3>
        <div className="action-grid">
          <button className="action-card" onClick={() => setUserModal('add')}><i className="fas fa-user-plus" /><span>{t('admin.quick.addUser')}</span></button>
          <button className="action-card" onClick={() => { setTab('knowledge-base'); setTimeout(() => document.getElementById('kbFileInput')?.click(), 100) }}><i className="fas fa-file-upload" /><span>{t('admin.quick.uploadRag')}</span></button>
          <button className="action-card" onClick={() => setTab('knowledge-base')}><i className="fas fa-search" /><span>{t('admin.quick.testSearch')}</span></button>
        </div>
      </div>
    </section>
  )
}

/* ── Knowledge Base Tab ── */
function KnowledgeBaseTab({ docs, kbSearch, setKbSearch, kbResults, handleKbUpload, handleKbDelete, handleKbSearch, kbUploading, kbInputRef, kbZoneRef }) {
  const { t } = useI18n()
  const [dragover, setDragover] = useState(false)
  const [selected, setSelected] = useState(new Set())

  const handleBatchDelete = async () => {
    if (!confirm(t('admin.kb.confirmBatchDelete', '確定要刪除 {count} 個文件？').replace('{count}', selected.size))) return
    await fetch('/admin/rag/documents/batch', { method: 'DELETE', headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [...selected] }) })
    setSelected(new Set())
    handleKbUpload({ target: { files: null } }) // trigger parent to reload
    setTimeout(() => window.location.reload(), 500)
  }

  return (
    <section className="content-section animate-fade-in">
      <div className="section-header"><h2><i className="fas fa-brain" /> {t('admin.kb.title')}</h2><p>{t('admin.kb.subtitle')}</p></div>

      <div className={`kb-upload-area ${dragover ? 'dragover' : ''}`}
        onClick={() => kbInputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragover(true) }}
        onDragLeave={e => { e.preventDefault(); setDragover(false) }}
        onDrop={e => { e.preventDefault(); setDragover(false); const files = e.dataTransfer.files; if (files.length) { const dt = new DataTransfer(); for (const f of files) dt.items.add(f); kbInputRef.current.files = dt.files; handleKbUpload({ target: { files: dt.files } }) } }}>
        <div className={`upload-icon ${kbUploading ? 'spin' : ''}`}><i className="fas fa-cloud-upload-alt" /></div>
        <div className="upload-text"><h3>{t('admin.kb.uploadTitle')}</h3><p>{t('admin.kb.uploadHint')}</p></div>
        <input ref={kbInputRef} type="file" id="kbFileInput" accept=".pdf,.txt,.md" multiple className="hidden" onChange={handleKbUpload} />
      </div>

      <div className="kb-section">
        <div className="flex items-center justify-between mb-4">
          <h3 className="!mb-0"><i className="fas fa-folder-open" /> {t('admin.kb.uploadedFiles')}</h3>
          {selected.size > 0 && <button className="kb-btn kb-btn-delete" onClick={handleBatchDelete}><i className="fas fa-trash" /> {t('admin.kb.deleteSelected')} ({selected.size})</button>}
        </div>
        <table className="kb-table">
          <thead><tr><th style={{ width: 36 }}><input type="checkbox" onChange={e => setSelected(e.target.checked ? new Set(docs.map(d => d.id)) : new Set())} /></th><th>{t('admin.kb.colFileName')}</th><th>{t('admin.kb.colFormat')}</th><th>{t('admin.kb.colStatus')}</th><th>{t('admin.kb.colDate')}</th><th>{t('admin.kb.colAction')}</th></tr></thead>
          <tbody>
            {docs.length === 0 ? <tr><td colSpan={6} className="kb-empty">{t('admin.kb.empty')}</td></tr>
              : docs.map(d => (
                <tr key={d.id}>
                  <td><input type="checkbox" checked={selected.has(d.id)} onChange={e => { const ns = new Set(selected); e.target.checked ? ns.add(d.id) : ns.delete(d.id); setSelected(ns) }} /></td>
                  <td>{d.original_filename || d.filename}</td>
                  <td>{d.content_type || '-'}</td>
                  <td><span className={`status-badge ${d.status === 'ready' ? 'active' : d.status === 'error' ? 'inactive' : ''}`}>{d.status || 'pending'}</span></td>
                  <td>{d.uploaded_at ? new Date(d.uploaded_at).toLocaleDateString() : '-'}</td>
                  <td><button className="table-btn delete" onClick={() => handleKbDelete(d.id)}><i className="fas fa-trash" /></button></td>
                </tr>))}
          </tbody>
        </table>
      </div>

      <div className="kb-section">
        <h3><i className="fas fa-search" /> {t('admin.kb.searchTitle')}</h3>
        <div className="kb-search-bar">
          <input type="text" value={kbSearch} onChange={e => setKbSearch(e.target.value)} placeholder={t('admin.kb.searchPlaceholder')} onKeyDown={e => e.key === 'Enter' && handleKbSearch()} />
          <button onClick={handleKbSearch}><i className="fas fa-search" /> {t('admin.search')}</button>
        </div>
        <div className="kb-results">
          {!kbResults && <div className="kb-empty">{t('admin.kb.searchEmpty')}</div>}
          {kbResults && kbResults.length === 0 && <div className="kb-empty">{t('admin.kb.noResults')}</div>}
          {kbResults && kbResults.map((r, i) => <div key={i} className="kb-result-item" style={{ padding: '12px', borderBottom: '1px solid var(--ae-border)' }}><strong>{r.chunk_index != null ? `Chunk ${r.chunk_index}` : r.filename || r.document_name}</strong><p className="text-sm text-[var(--ae-text-muted)] mt-1">{r.content?.substring(0, 300) || r.text?.substring(0, 300)}{(r.content || r.text)?.length > 300 ? '...' : ''}</p></div>)}
        </div>
      </div>
    </section>
  )
}

/* ── Users Tab ── */
function UsersTab({ users, usersPage, usersTotal, usersSearch, setUsersSearch, usersRole, setUsersRole, setUsersPage, setUserModal, setEditingUser, handleDeleteUser, handleToggleStatus }) {
  const { t } = useI18n()
  return (
    <section className="content-section animate-fade-in">
      <div className="section-header"><h2><i className="fas fa-users" /> {t('admin.nav.users')}</h2><p>{t('admin.users.subtitle')}</p></div>
      <div className="users-toolbar">
        <div className="search-box"><i className="fas fa-search" /><input type="text" value={usersSearch} onChange={e => setUsersSearch(e.target.value)} placeholder={t('admin.users.searchPlaceholder')} /></div>
        <div className="filter-tabs">
          {[{ role: '', key: 'admin.users.filterAll' }, { role: 'admin', key: 'admin.users.filterAdmin' }, { role: 'teacher', key: 'admin.users.filterTeacher' }, { role: 'user', key: 'admin.users.filterStudent' }].map(f => (
            <button key={f.role} className={`filter-tab ${usersRole === f.role ? 'active' : ''}`} onClick={() => { setUsersRole(f.role); setUsersPage(1) }}>{t(f.key)}</button>
          ))}
        </div>
      </div>
      <div className="kb-section !p-0">
        <table className="users-table">
          <thead><tr><th><input type="checkbox" /></th><th>{t('admin.users.colUsername')}</th><th>{t('admin.users.emailLabel')}</th><th>{t('admin.users.colRole')}</th><th>{t('admin.users.colDate')}</th><th>{t('admin.users.colStatus')}</th><th>{t('admin.kb.colAction')}</th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td><input type="checkbox" /></td>
                <td><div className="user-cell"><div className="user-avatar">{u.username?.charAt(0)?.toUpperCase() || 'U'}</div><span>{u.username || 'Unknown'}</span></div></td>
                <td>{u.email}</td>
                <td><span className={`role-badge ${u.role}`}>{u.role === 'admin' ? t('admin.users.roleAdmin') : u.role === 'teacher' ? t('admin.users.roleTeacher') : t('admin.users.roleStudent')}</span></td>
                <td>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}</td>
                <td><span className={`status-badge ${u.is_active ? 'active' : 'inactive'}`} style={{ cursor: 'pointer' }} onClick={() => handleToggleStatus(u.id, u.is_active)}>{u.is_active ? t('admin.users.statusActive') : t('admin.users.statusInactive')}</span></td>
                <td>
                  <button className="table-btn edit" onClick={() => { setEditingUser(u); setUserModal('edit') }}><i className="fas fa-edit" /></button>
                  <button className="table-btn delete" onClick={() => handleDeleteUser(u.id)}><i className="fas fa-trash" /></button>
                </td>
              </tr>))}
          </tbody>
        </table>
      </div>
      <div className="pagination">
        <button className="page-btn" disabled={usersPage <= 1} onClick={() => setUsersPage(p => p - 1)}><i className="fas fa-chevron-left" /></button>
        <span className="page-info">{t('admin.pagePrefix')}{usersPage}{t('admin.pageMiddle')}{usersTotal}{t('admin.pageSuffix')}</span>
        <button className="page-btn" disabled={usersPage >= usersTotal} onClick={() => setUsersPage(p => p + 1)}><i className="fas fa-chevron-right" /></button>
      </div>
    </section>
  )
}

/* ── Reports Tab ── */
function ReportsTab({ reports, reportsPage, reportsTotal, reportsFilter, setReportsFilter, setReportsPage, viewDetail }) {
  const { t } = useI18n()
  return (
    <section className="content-section animate-fade-in">
      <div className="section-header"><h2><i className="fas fa-file-waveform" /> {t('admin.reports.title')}</h2><p>{t('admin.reports.subtitle')}</p></div>
      <div className="kb-section">
        <div className="admin-record-toolbar">
          <div className="search-box admin-search-box"><i className="fas fa-search" /><input type="text" value={reportsFilter.search} onChange={e => setReportsFilter(f => ({ ...f, search: e.target.value }))} placeholder={t('admin.reports.searchPlaceholder')} /></div>
          <select className="form-input admin-filter-select" value={reportsFilter.status} onChange={e => setReportsFilter(f => ({ ...f, status: e.target.value }))}>
            <option value="all">{t('admin.filterAll')}</option><option value="completed">{t('admin.filterCompleted')}</option><option value="processing">{t('admin.filterProcessing')}</option><option value="pending">{t('admin.filterPending')}</option><option value="failed">{t('admin.filterFailed')}</option>
          </select>
          <select className="form-input admin-filter-select" value={reportsFilter.attention} onChange={e => setReportsFilter(f => ({ ...f, attention: e.target.value }))}>
            <option value="all">{t('admin.filterAllAttention')}</option><option value="flagged">{t('admin.filterAllFlagged')}</option><option value="critical">{t('admin.filterCritical')}</option><option value="warning">{t('admin.filterWarning')}</option>
          </select>
          <button className="admin-inline-btn" onClick={() => setReportsFilter({ status: 'all', attention: 'all', search: '' })}><i className="fas fa-rotate" /> {t('admin.refresh')}</button>
        </div>
        <div className="admin-table-note">{t('admin.reports.countBadge', '{count} 筆報告').replace('{count}', reports.length)}</div>
        <div className="users-table-container">
          <table className="users-table"><thead><tr><th>{t('admin.reports.colReportId')}</th><th>{t('admin.reports.colUser')}</th><th>{t('admin.reports.colChild')}</th><th>{t('admin.reports.colVideo')}</th><th>{t('admin.reports.colStatus')}</th><th>{t('admin.reports.colAttention')}</th><th>{t('admin.reports.colCreated')}</th></tr></thead>
            <tbody>{reports.map(r => (
              <tr key={r.report_id || r.id} className="cursor-pointer" onClick={() => viewDetail('report', r.report_id || r.id)}>
                <td>{(r.report_id || r.id || '').substring(0, 8)}...</td>
                <td>{r.user_email || r.username || '-'}</td>
                <td>{r.child_name || '-'}</td>
                <td>{r.video_filename || '-'}</td>
                <td><span className={`status-badge ${r.status === 'completed' ? 'active' : r.status === 'failed' ? 'inactive' : ''}`}>{r.status || 'pending'}</span></td>
                <td>{r.attention_level ? <span className="role-badge admin">{r.attention_level}</span> : '-'}</td>
                <td>{r.created_at ? new Date(r.created_at).toLocaleDateString() : '-'}</td>
              </tr>))}</tbody>
          </table>
        </div>
        <div className="pagination"><button className="page-btn" disabled={reportsPage <= 1} onClick={() => setReportsPage(p => p - 1)}><i className="fas fa-chevron-left" /></button><span className="page-info">{t('admin.pagePrefix')}{reportsPage}{t('admin.pageMiddle')}{reportsTotal}{t('admin.pageSuffix')}</span><button className="page-btn" disabled={reportsPage >= reportsTotal} onClick={() => setReportsPage(p => p + 1)}><i className="fas fa-chevron-right" /></button></div>
      </div>
    </section>
  )
}

/* ── Pose Runs Tab ── */
function PoseRunsTab({ poseRuns, posePage, poseTotal, poseFilter, setPoseFilter, setPosePage, viewDetail }) {
  const { t } = useI18n()
  return (
    <section className="content-section animate-fade-in">
      <div className="section-header"><h2><i className="fas fa-person-running" /> {t('admin.pose.title')}</h2><p>{t('admin.pose.subtitle')}</p></div>
      <div className="kb-section">
        <div className="admin-record-toolbar">
          <div className="search-box admin-search-box"><i className="fas fa-search" /><input type="text" value={poseFilter.search} onChange={e => setPoseFilter(f => ({ ...f, search: e.target.value }))} placeholder={t('admin.pose.searchPlaceholder')} /></div>
          <select className="form-input admin-filter-select" value={poseFilter.attention} onChange={e => setPoseFilter(f => ({ ...f, attention: e.target.value }))}>
            <option value="all">{t('admin.filterAllAttention')}</option><option value="flagged">{t('admin.filterAllFlagged')}</option><option value="critical">{t('admin.filterCritical')}</option><option value="warning">{t('admin.filterWarning')}</option>
          </select>
          <button className="admin-inline-btn" onClick={() => setPoseFilter({ attention: 'all', search: '' })}><i className="fas fa-rotate" /> {t('admin.refresh')}</button>
        </div>
        <div className="admin-table-note">{t('admin.pose.countBadge', '{count} 筆紀錄').replace('{count}', poseRuns.length)}</div>
        <div className="users-table-container">
          <table className="users-table"><thead><tr><th>{t('admin.pose.colRunId')}</th><th>{t('admin.pose.colUser')}</th><th>{t('admin.pose.colSteps')}</th><th>{t('admin.pose.colRate')}</th><th>{t('admin.pose.colLevel')}</th><th>{t('admin.reports.colAttention')}</th><th>{t('admin.reports.colCreated')}</th></tr></thead>
            <tbody>{poseRuns.map(r => (
              <tr key={r.run_id || r.id} className="cursor-pointer" onClick={() => viewDetail('pose', r.run_id || r.id)}>
                <td>{(r.run_id || r.id || '').substring(0, 8)}...</td>
                <td>{r.user_email || r.username || '-'}</td>
                <td>{r.completed_steps != null ? `${r.completed_steps}/${r.total_steps || 10}` : '-'}</td>
                <td>{r.completion_rate != null ? `${Math.round(r.completion_rate * 100)}%` : '-'}</td>
                <td><span className={`status-badge ${(r.level || '').toLowerCase() === 'good' ? 'active' : ''}`}>{r.level || '-'}</span></td>
                <td>{r.attention_level ? <span className="role-badge admin">{r.attention_level}</span> : '-'}</td>
                <td>{r.created_at ? new Date(r.created_at).toLocaleDateString() : '-'}</td>
              </tr>))}</tbody>
          </table>
        </div>
        <div className="pagination"><button className="page-btn" disabled={posePage <= 1} onClick={() => setPosePage(p => p - 1)}><i className="fas fa-chevron-left" /></button><span className="page-info">{t('admin.pagePrefix')}{posePage}{t('admin.pageMiddle')}{poseTotal}{t('admin.pageSuffix')}</span><button className="page-btn" disabled={posePage >= poseTotal} onClick={() => setPosePage(p => p + 1)}><i className="fas fa-chevron-right" /></button></div>
      </div>
    </section>
  )
}

/* ── Modals ── */
function AddUserModal({ onClose, onSave }) {
  const { t } = useI18n()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('user')
  return (
    <div className="modal-overlay active" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header"><h2><i className="fas fa-user-plus" /> {t('admin.userModal.addTitle')}</h2><button className="modal-close" onClick={onClose}><i className="fas fa-times" /></button></div>
        <div className="role-selector">
          {[{ role: 'user', icon: 'fa-user-graduate', labelKey: 'admin.users.roleStudent' }, { role: 'teacher', icon: 'fa-chalkboard-teacher', labelKey: 'admin.users.roleTeacher' }, { role: 'admin', icon: 'fa-user-shield', labelKey: 'admin.users.roleAdmin' }].map(r => (
            <button key={r.role} className={`role-btn ${role === r.role ? 'active' : ''}`} onClick={() => setRole(r.role)}><i className={`fas ${r.icon}`} /> {t(r.labelKey)}</button>
          ))}
        </div>
        <form onSubmit={e => { e.preventDefault(); onSave({ username, email, password, role }) }}>
          <div className="form-group"><label>{t('admin.users.colUsername')}</label><input className="form-input" value={username} onChange={e => setUsername(e.target.value)} placeholder={t('admin.users.usernamePlaceholder')} required /></div>
          <div className="form-group"><label>{t('admin.users.emailLabel')}</label><input type="email" className="form-input" value={email} onChange={e => setEmail(e.target.value)} placeholder={t('admin.users.emailPlaceholder')} required /></div>
          <div className="form-group"><label>{t('admin.userModal.initialPassword')}</label><input type="password" className="form-input" value={password} onChange={e => setPassword(e.target.value)} placeholder={t('admin.userModal.passwordPlaceholder')} required /></div>
          <div className="modal-buttons"><button type="button" className="btn-cancel" onClick={onClose}>{t('admin.cancel')}</button><button type="submit" className="btn-create"><i className="fas fa-plus" /> {t('admin.userModal.createUser')}</button></div>
        </form>
      </div>
    </div>
  )
}

function EditUserModal({ user, onClose, onSave }) {
  const { t } = useI18n()
  const [username, setUsername] = useState(user.username || '')
  const [email, setEmail] = useState(user.email || '')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState(user.role || 'user')
  const [isActive, setIsActive] = useState(user.is_active)
  return (
    <div className="modal-overlay active" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header"><h2><i className="fas fa-user-edit" /> {t('admin.userModal.editTitle')}</h2><button className="modal-close" onClick={onClose}><i className="fas fa-times" /></button></div>
        <form onSubmit={e => { e.preventDefault(); onSave({ id: user.id, username, email, password: password || undefined, role, is_active: isActive }) }}>
          <input type="hidden" value={user.id} />
          <div className="form-group"><label>{t('admin.users.colUsername')}</label><input className="form-input" value={username} onChange={e => setUsername(e.target.value)} required /></div>
          <div className="form-group"><label>{t('admin.users.emailLabel')}</label><input type="email" className="form-input" value={email} onChange={e => setEmail(e.target.value)} required /></div>
          <div className="form-group"><label>{t('admin.userModal.newPassword')}</label><input type="password" className="form-input" value={password} onChange={e => setPassword(e.target.value)} placeholder={t('admin.userModal.newPasswordPlaceholder')} /></div>
          <div className="form-group"><label>{t('admin.users.colRole')}</label><select className="form-input" value={role} onChange={e => setRole(e.target.value)}><option value="user">{t('admin.users.roleStudent')}</option><option value="teacher">{t('admin.users.roleTeacher')}</option><option value="admin">{t('admin.users.roleAdmin')}</option></select></div>
          <div className="form-group"><label>{t('admin.users.colStatus')}</label><select className="form-input" value={isActive ? 'active' : 'inactive'} onChange={e => setIsActive(e.target.value === 'active')}><option value="active">{t('admin.users.statusEnabled')}</option><option value="inactive">{t('admin.users.statusDisabled')}</option></select></div>
          <div className="modal-buttons"><button type="button" className="btn-cancel" onClick={onClose}>{t('admin.cancel')}</button><button type="submit" className="btn-create"><i className="fas fa-save" /> {t('admin.userModal.saveChanges')}</button></div>
        </form>
      </div>
    </div>
  )
}

function DetailModal({ type, data, onClose }) {
  const { t } = useI18n()
  const d = data?.report || data?.run || data || {}
  const isReport = type === 'report'
  return (
    <div className="modal-overlay active" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-box--wide">
        <div className="modal-header"><h2><i className="fas fa-circle-info" /> {t('admin.recordDetail.title')}</h2><button className="modal-close" onClick={onClose}><i className="fas fa-times" /></button></div>
        <div className="record-detail-body" style={{ padding: '20px', maxHeight: '70vh', overflow: 'auto' }}>
          <pre className="text-sm whitespace-pre-wrap font-sans">{JSON.stringify(d, null, 2)}</pre>
        </div>
      </div>
    </div>
  )
}
