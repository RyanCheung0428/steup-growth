import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'

const TABS = [
  { id: 'overview', icon: 'fa-chart-pie', label: '總覽' },
  { id: 'users', icon: 'fa-users', label: '用戶管理' },
  { id: 'reports', icon: 'fa-file-waveform', label: '分析報告' },
  { id: 'pose-runs', icon: 'fa-person-running', label: '姿態檢測' },
  { id: 'knowledge-base', icon: 'fa-brain', label: '知識庫' },
]

export default function AdminDashboard() {
  const { token } = useAuth()
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

  const api = useCallback((url, opts = {}) => fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, ...opts.headers } }), [token])
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
        {TABS.map(t => (
          <button key={t.id} className={`admin-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            <i className={`fas ${t.icon}`} /> {t.label}
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

/* ── Overview Tab ── */
function OverviewTab({ stats, setTab, setUserModal }) {
  return (
    <section className="content-section animate-fade-in">
      <div className="welcome-banner">
        <div className="mascot">🦉</div>
        <div className="welcome-text">
          <h2>歡迎回來，管理員！</h2>
          <p>這裡是系統總覽，你可以查看所有運行狀態</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card purple" onClick={() => setTab('users')}>
          <div className="stat-icon"><i className="fas fa-users" /></div>
          <div className="stat-info"><span className="stat-number">{stats?.total_users || 0}</span><span className="stat-label">總用戶數</span></div>
          <div className="stat-badge new">+{stats?.new_users_today || 0} 今日</div>
        </div>
        <div className="stat-card blue" onClick={() => setTab('users')}>
          <div className="stat-icon"><i className="fas fa-user-check" /></div>
          <div className="stat-info"><span className="stat-number">{stats?.active_users || 0}</span><span className="stat-label">啟用用戶</span></div>
          <div className="stat-badge">{stats?.admin_count || 0} 位管理員</div>
        </div>
        <div className="stat-card green" onClick={() => setTab('reports')}>
          <div className="stat-icon"><i className="fas fa-video" /></div>
          <div className="stat-info"><span className="stat-number">{stats?.total_videos || 0}</span><span className="stat-label">影片紀錄</span></div>
          <div className="stat-badge success">{stats?.failed_videos || 0} 筆失敗</div>
        </div>
      </div>

      <div className="admin-focus-panel">
        <h3><i className="fas fa-triangle-exclamation" /> 後台關注中心</h3>
        <div className="focus-grid">
          <button className="focus-card critical" onClick={() => setTab('reports')}>
            <span className="focus-card__label">需關注報告</span>
            <span className="focus-card__count">{stats?.flagged_reports || 0}</span>
            <span className="focus-card__hint">查看影片分析中需關注或需轉介的報告</span>
          </button>
          <button className="focus-card warning" onClick={() => setTab('pose-runs')}>
            <span className="focus-card__label">需關注姿態結果</span>
            <span className="focus-card__count">{stats?.flagged_pose_runs || 0}</span>
            <span className="focus-card__hint">查看完成率偏低或未完成動作較多的姿態測驗</span>
          </button>
        </div>
      </div>

      <div className="quick-actions">
        <h3><i className="fas fa-bolt" /> 快速操作</h3>
        <div className="action-grid">
          <button className="action-card" onClick={() => setUserModal('add')}><i className="fas fa-user-plus" /><span>新增用戶</span></button>
          <button className="action-card" onClick={() => { setTab('knowledge-base'); setTimeout(() => document.getElementById('kbFileInput')?.click(), 100) }}><i className="fas fa-file-upload" /><span>上載文件到知識庫</span></button>
          <button className="action-card" onClick={() => setTab('knowledge-base')}><i className="fas fa-search" /><span>測試檢索</span></button>
        </div>
      </div>
    </section>
  )
}

/* ── Knowledge Base Tab ── */
function KnowledgeBaseTab({ docs, kbSearch, setKbSearch, kbResults, handleKbUpload, handleKbDelete, handleKbSearch, kbUploading, kbInputRef, kbZoneRef }) {
  const [dragover, setDragover] = useState(false)
  const [selected, setSelected] = useState(new Set())

  const handleBatchDelete = async () => {
    if (!confirm(`確定要刪除 ${selected.size} 個文件？`)) return
    await fetch('/admin/rag/documents/batch', { method: 'DELETE', headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [...selected] }) })
    setSelected(new Set())
    handleKbUpload({ target: { files: null } }) // trigger parent to reload
    setTimeout(() => window.location.reload(), 500)
  }

  return (
    <section className="content-section animate-fade-in">
      <div className="section-header"><h2><i className="fas fa-brain" /> 知識庫管理</h2><p>管理 AI 對話系統的知識庫文件</p></div>

      <div className={`kb-upload-area ${dragover ? 'dragover' : ''}`}
        onClick={() => kbInputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragover(true) }}
        onDragLeave={e => { e.preventDefault(); setDragover(false) }}
        onDrop={e => { e.preventDefault(); setDragover(false); const files = e.dataTransfer.files; if (files.length) { const dt = new DataTransfer(); for (const f of files) dt.items.add(f); kbInputRef.current.files = dt.files; handleKbUpload({ target: { files: dt.files } }) } }}>
        <div className={`upload-icon ${kbUploading ? 'spin' : ''}`}><i className="fas fa-cloud-upload-alt" /></div>
        <div className="upload-text"><h3>點擊或拖放文件上傳</h3><p>支援格式：PDF、TXT、Markdown（可批量上傳）</p></div>
        <input ref={kbInputRef} type="file" id="kbFileInput" accept=".pdf,.txt,.md" multiple className="hidden" onChange={handleKbUpload} />
      </div>

      <div className="kb-section">
        <div className="flex items-center justify-between mb-4">
          <h3 className="!mb-0"><i className="fas fa-folder-open" /> 已上傳文件</h3>
          {selected.size > 0 && <button className="kb-btn kb-btn-delete" onClick={handleBatchDelete}><i className="fas fa-trash" /> 刪除已選 ({selected.size})</button>}
        </div>
        <table className="kb-table">
          <thead><tr><th style={{ width: 36 }}><input type="checkbox" onChange={e => setSelected(e.target.checked ? new Set(docs.map(d => d.id)) : new Set())} /></th><th>文件名稱</th><th>格式</th><th>狀態</th><th>上傳日期</th><th>操作</th></tr></thead>
          <tbody>
            {docs.length === 0 ? <tr><td colSpan={6} className="kb-empty">暫無文件</td></tr>
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
        <h3><i className="fas fa-search" /> 檢索測試</h3>
        <div className="kb-search-bar">
          <input type="text" value={kbSearch} onChange={e => setKbSearch(e.target.value)} placeholder="輸入查詢以測試知識庫檢索效果..." onKeyDown={e => e.key === 'Enter' && handleKbSearch()} />
          <button onClick={handleKbSearch}><i className="fas fa-search" /> 搜尋</button>
        </div>
        <div className="kb-results">
          {!kbResults && <div className="kb-empty">輸入查詢後點擊搜尋</div>}
          {kbResults && kbResults.length === 0 && <div className="kb-empty">無結果</div>}
          {kbResults && kbResults.map((r, i) => <div key={i} className="kb-result-item" style={{ padding: '12px', borderBottom: '1px solid var(--ae-border)' }}><strong>{r.chunk_index != null ? `Chunk ${r.chunk_index}` : r.filename || r.document_name}</strong><p className="text-sm text-[var(--ae-text-muted)] mt-1">{r.content?.substring(0, 300) || r.text?.substring(0, 300)}{(r.content || r.text)?.length > 300 ? '...' : ''}</p></div>)}
        </div>
      </div>
    </section>
  )
}

/* ── Users Tab ── */
function UsersTab({ users, usersPage, usersTotal, usersSearch, setUsersSearch, usersRole, setUsersRole, setUsersPage, setUserModal, setEditingUser, handleDeleteUser, handleToggleStatus }) {
  return (
    <section className="content-section animate-fade-in">
      <div className="section-header"><h2><i className="fas fa-users" /> 用戶管理</h2><p>管理系統用戶帳戶和權限</p></div>
      <div className="users-toolbar">
        <div className="search-box"><i className="fas fa-search" /><input type="text" value={usersSearch} onChange={e => setUsersSearch(e.target.value)} placeholder="搜尋用戶..." /></div>
        <div className="filter-tabs">
          {[{ role: '', label: '全部' }, { role: 'admin', label: '管理員' }, { role: 'teacher', label: '教師' }, { role: 'user', label: '學生' }].map(f => (
            <button key={f.role} className={`filter-tab ${usersRole === f.role ? 'active' : ''}`} onClick={() => { setUsersRole(f.role); setUsersPage(1) }}>{f.label}</button>
          ))}
        </div>
      </div>
      <div className="kb-section !p-0">
        <table className="users-table">
          <thead><tr><th><input type="checkbox" /></th><th>用戶名</th><th>Email</th><th>角色</th><th>註冊日期</th><th>狀態</th><th>操作</th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td><input type="checkbox" /></td>
                <td><div className="user-cell"><div className="user-avatar">{u.username?.charAt(0)?.toUpperCase() || 'U'}</div><span>{u.username || 'Unknown'}</span></div></td>
                <td>{u.email}</td>
                <td><span className={`role-badge ${u.role}`}>{u.role === 'admin' ? '管理員' : u.role === 'teacher' ? '教師' : '學生'}</span></td>
                <td>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}</td>
                <td><span className={`status-badge ${u.is_active ? 'active' : 'inactive'}`} style={{ cursor: 'pointer' }} onClick={() => handleToggleStatus(u.id, u.is_active)}>{u.is_active ? '活躍' : '停用'}</span></td>
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
        <span className="page-info">第 {usersPage} 頁，共 {usersTotal} 頁</span>
        <button className="page-btn" disabled={usersPage >= usersTotal} onClick={() => setUsersPage(p => p + 1)}><i className="fas fa-chevron-right" /></button>
      </div>
    </section>
  )
}

/* ── Reports Tab ── */
function ReportsTab({ reports, reportsPage, reportsTotal, reportsFilter, setReportsFilter, setReportsPage, viewDetail }) {
  return (
    <section className="content-section animate-fade-in">
      <div className="section-header"><h2><i className="fas fa-file-waveform" /> 影片分析報告</h2><p>查看所有結構化影片分析報告，並標明需關注、需轉介或不合格項目。</p></div>
      <div className="kb-section">
        <div className="admin-record-toolbar">
          <div className="search-box admin-search-box"><i className="fas fa-search" /><input type="text" value={reportsFilter.search} onChange={e => setReportsFilter(f => ({ ...f, search: e.target.value }))} placeholder="搜尋用戶、兒童、影片或報告 ID..." /></div>
          <select className="form-input admin-filter-select" value={reportsFilter.status} onChange={e => setReportsFilter(f => ({ ...f, status: e.target.value }))}>
            <option value="all">全部狀態</option><option value="completed">已完成</option><option value="processing">處理中</option><option value="pending">等待中</option><option value="failed">失敗</option>
          </select>
          <select className="form-input admin-filter-select" value={reportsFilter.attention} onChange={e => setReportsFilter(f => ({ ...f, attention: e.target.value }))}>
            <option value="all">全部關注</option><option value="flagged">全部需關注</option><option value="critical">高優先</option><option value="warning">一般關注</option>
          </select>
          <button className="admin-inline-btn" onClick={() => setReportsFilter({ status: 'all', attention: 'all', search: '' })}><i className="fas fa-rotate" /> 重新整理</button>
        </div>
        <div className="admin-table-note">{reports.length} 筆報告</div>
        <div className="users-table-container">
          <table className="users-table"><thead><tr><th>報告 ID</th><th>用戶</th><th>兒童</th><th>影片</th><th>狀態</th><th>關注</th><th>建立時間</th></tr></thead>
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
        <div className="pagination"><button className="page-btn" disabled={reportsPage <= 1} onClick={() => setReportsPage(p => p - 1)}><i className="fas fa-chevron-left" /></button><span className="page-info">第 {reportsPage} 頁，共 {reportsTotal} 頁</span><button className="page-btn" disabled={reportsPage >= reportsTotal} onClick={() => setReportsPage(p => p + 1)}><i className="fas fa-chevron-right" /></button></div>
      </div>
    </section>
  )
}

/* ── Pose Runs Tab ── */
function PoseRunsTab({ poseRuns, posePage, poseTotal, poseFilter, setPoseFilter, setPosePage, viewDetail }) {
  return (
    <section className="content-section animate-fade-in">
      <div className="section-header"><h2><i className="fas fa-person-running" /> 姿態檢測結果</h2><p>查看所有姿態測驗結果，並突顯完成率偏低或未完成動作較多的紀錄。</p></div>
      <div className="kb-section">
        <div className="admin-record-toolbar">
          <div className="search-box admin-search-box"><i className="fas fa-search" /><input type="text" value={poseFilter.search} onChange={e => setPoseFilter(f => ({ ...f, search: e.target.value }))} placeholder="搜尋用戶或姿態 run ID..." /></div>
          <select className="form-input admin-filter-select" value={poseFilter.attention} onChange={e => setPoseFilter(f => ({ ...f, attention: e.target.value }))}>
            <option value="all">全部關注</option><option value="flagged">全部需關注</option><option value="critical">高優先</option><option value="warning">一般關注</option>
          </select>
          <button className="admin-inline-btn" onClick={() => setPoseFilter({ attention: 'all', search: '' })}><i className="fas fa-rotate" /> 重新整理</button>
        </div>
        <div className="admin-table-note">{poseRuns.length} 筆紀錄</div>
        <div className="users-table-container">
          <table className="users-table"><thead><tr><th>Run ID</th><th>用戶</th><th>完成步數</th><th>完成率</th><th>評級</th><th>關注</th><th>建立時間</th></tr></thead>
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
        <div className="pagination"><button className="page-btn" disabled={posePage <= 1} onClick={() => setPosePage(p => p - 1)}><i className="fas fa-chevron-left" /></button><span className="page-info">第 {posePage} 頁，共 {poseTotal} 頁</span><button className="page-btn" disabled={posePage >= poseTotal} onClick={() => setPosePage(p => p + 1)}><i className="fas fa-chevron-right" /></button></div>
      </div>
    </section>
  )
}

/* ── Modals ── */
function AddUserModal({ onClose, onSave }) {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('user')
  return (
    <div className="modal-overlay active" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header"><h2><i className="fas fa-user-plus" /> 新增用戶</h2><button className="modal-close" onClick={onClose}><i className="fas fa-times" /></button></div>
        <div className="role-selector">
          {[{ role: 'user', icon: 'fa-user-graduate', label: '學生' }, { role: 'teacher', icon: 'fa-chalkboard-teacher', label: '教師' }, { role: 'admin', icon: 'fa-user-shield', label: '管理員' }].map(r => (
            <button key={r.role} className={`role-btn ${role === r.role ? 'active' : ''}`} onClick={() => setRole(r.role)}><i className={`fas ${r.icon}`} /> {r.label}</button>
          ))}
        </div>
        <form onSubmit={e => { e.preventDefault(); onSave({ username, email, password, role }) }}>
          <div className="form-group"><label>用戶名</label><input className="form-input" value={username} onChange={e => setUsername(e.target.value)} placeholder="輸入用戶名" required /></div>
          <div className="form-group"><label>Email</label><input type="email" className="form-input" value={email} onChange={e => setEmail(e.target.value)} placeholder="example@email.com" required /></div>
          <div className="form-group"><label>初始密碼</label><input type="password" className="form-input" value={password} onChange={e => setPassword(e.target.value)} placeholder="輸入密碼" required /></div>
          <div className="modal-buttons"><button type="button" className="btn-cancel" onClick={onClose}>取消</button><button type="submit" className="btn-create"><i className="fas fa-plus" /> 創建用戶</button></div>
        </form>
      </div>
    </div>
  )
}

function EditUserModal({ user, onClose, onSave }) {
  const [username, setUsername] = useState(user.username || '')
  const [email, setEmail] = useState(user.email || '')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState(user.role || 'user')
  const [isActive, setIsActive] = useState(user.is_active)
  return (
    <div className="modal-overlay active" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header"><h2><i className="fas fa-user-edit" /> 編輯用戶</h2><button className="modal-close" onClick={onClose}><i className="fas fa-times" /></button></div>
        <form onSubmit={e => { e.preventDefault(); onSave({ id: user.id, username, email, password: password || undefined, role, is_active: isActive }) }}>
          <input type="hidden" value={user.id} />
          <div className="form-group"><label>用戶名</label><input className="form-input" value={username} onChange={e => setUsername(e.target.value)} required /></div>
          <div className="form-group"><label>Email</label><input type="email" className="form-input" value={email} onChange={e => setEmail(e.target.value)} required /></div>
          <div className="form-group"><label>新密碼（留空保持原密碼）</label><input type="password" className="form-input" value={password} onChange={e => setPassword(e.target.value)} placeholder="輸入新密碼" /></div>
          <div className="form-group"><label>角色</label><select className="form-input" value={role} onChange={e => setRole(e.target.value)}><option value="user">學生</option><option value="teacher">教師</option><option value="admin">管理員</option></select></div>
          <div className="form-group"><label>狀態</label><select className="form-input" value={isActive ? 'active' : 'inactive'} onChange={e => setIsActive(e.target.value === 'active')}><option value="active">啟用</option><option value="inactive">停用</option></select></div>
          <div className="modal-buttons"><button type="button" className="btn-cancel" onClick={onClose}>取消</button><button type="submit" className="btn-create"><i className="fas fa-save" /> 保存更改</button></div>
        </form>
      </div>
    </div>
  )
}

function DetailModal({ type, data, onClose }) {
  const d = data?.report || data?.run || data || {}
  const isReport = type === 'report'
  return (
    <div className="modal-overlay active" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-box--wide">
        <div className="modal-header"><h2><i className="fas fa-circle-info" /> 詳細資料</h2><button className="modal-close" onClick={onClose}><i className="fas fa-times" /></button></div>
        <div className="record-detail-body" style={{ padding: '20px', maxHeight: '70vh', overflow: 'auto' }}>
          <pre className="text-sm whitespace-pre-wrap font-sans">{JSON.stringify(d, null, 2)}</pre>
        </div>
      </div>
    </div>
  )
}
