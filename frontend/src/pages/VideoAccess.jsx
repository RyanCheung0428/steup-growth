import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'

/* ── Helpers ── */
function escapeHtml(s) { return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;') }
function formatMB(b) { return `${(b/1024/1024).toFixed(2)} MB` }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

const TIPS = [
  { icon: 'fa-check-circle', text: '確保兒童全身入鏡，捕捉完整動作。' },
  { icon: 'fa-check-circle', text: '減少背景雜音以提高語音轉錄準確度。' },
  { icon: 'fa-check-circle', text: '盡量保持畫面只有一位主要對象，避免 AI 混淆。' },
]

/* ── Main Component ── */
export default function VideoAccess() {
  const { token } = useAuth()
  const [children, setChildren] = useState([])
  const [selectedChildId, setSelectedChildId] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStatus, setUploadStatus] = useState('')
  const [uploads, setUploads] = useState([])
  const [uploadsLoading, setUploadsLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalHtml, setModalHtml] = useState('')
  const [batchMode, setBatchMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [toast, setToast] = useState(null)
  const [showAddChild, setShowAddChild] = useState(false)
  const [childWarning, setChildWarning] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState(new Set())
  const [analysisRunning, setAnalysisRunning] = useState(false)
  const [analysisReportId, setAnalysisReportId] = useState(null)
  const inputRef = useRef(null)
  const zoneRef = useRef(null)
  const activePollRef = useRef(false)

  const authHeaders = useCallback(() => ({ Authorization: `Bearer ${token}` }), [token])

  /* Load children */
  const loadChildren = useCallback(async () => {
    try {
      const r = await fetch('/api/children', { headers: authHeaders() })
      if (r.ok) {
        const d = await r.json()
        const list = d.children || []
        setChildren(list)
        if (list.length > 0 && !selectedChildId) { setSelectedChildId(String(list[0].id)); setShowAddChild(false) }
        else if (list.length === 0) { setSelectedChildId(''); setShowAddChild(true) }
        else setShowAddChild(false)
      }
    } catch {}
  }, [token])

  /* Load upload history */
  const loadUploads = useCallback(async (silent = false) => {
    if (!silent) setUploadsLoading(true)
    try {
      const r = await fetch('/api/uploads?category=video_assess', { headers: authHeaders() })
      if (r.ok) setUploads((await r.json()).uploads || [])
    } catch {} finally {
      if (!silent) setUploadsLoading(false)
    }
  }, [token])

  useEffect(() => { loadChildren(); loadUploads() }, [])

  /* Sync children with settings page changes */
  useEffect(() => {
    const handler = () => { loadChildren() }
    window.addEventListener('childrenUpdated', handler)
    return () => window.removeEventListener('childrenUpdated', handler)
  }, [])

  /* Modal close - continue background if analysis running */
  const handleModalClose = useCallback(() => {
    if (analysisRunning) {
      // Just close the modal, analysis continues in background (poll still running)
      setModalOpen(false)
    } else {
      setModalOpen(false)
      loadUploads()
    }
  }, [analysisRunning])

  /* Close modal backdrop - same behavior */
  const handleBackdropClick = useCallback(() => {
    if (analysisRunning) {
      setModalOpen(false)
    } else {
      setModalOpen(false)
      loadUploads()
    }
  }, [analysisRunning])

  /* Cancel analysis + delete this video record and any partial report */
  const handleCancelAndDelete = useCallback(async () => {
    if (!confirm('確定要取消分析並刪除此記錄嗎？')) return
    activePollRef.current = false
    setAnalysisRunning(false)
    setAnalysisReportId(null)
    setModalOpen(false)
    // Delete the last uploaded video (the one being analyzed)
    const videoId = uploads[0]?.id
    if (videoId) {
      await fetch(`/api/videos/${videoId}`, { method: 'DELETE', headers: authHeaders() }).catch(() => {})
    }
    loadUploads()
  }, [uploads, authHeaders])

  /* Close modal, continue analysis in background */
  const handleContinueBackground = useCallback(() => {
    setModalOpen(false)
    // Poll is already running, just close the modal
  }, [])

  /* Child select */
  const selectedChild = children.find(c => String(c.id) === selectedChildId)

  /* Group toggle */
  const toggleGroup = useCallback((childName) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(childName)) next.delete(childName)
      else next.add(childName)
      return next
    })
  }, [])

  /* File handling */
  const handleFile = useCallback((file) => {
    if (!file || !file.type.startsWith('video/')) return
    setSelectedFile(file)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(file))
  }, [previewUrl])

  const cancelPreview = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setSelectedFile(null)
    setUploadProgress(0)
    setUploadStatus('')
    if (inputRef.current) inputRef.current.value = ''
  }, [previewUrl])

  /* Upload via XHR with progress */
  const handleUpload = useCallback(async () => {
    if (!selectedFile) return
    if (!selectedChildId) {
      if (children.length === 0) {
        setModalOpen(true)
        setModalHtml('<p style="color:#b00020;">⚠️ 沒有小朋友資料，請先新增小朋友後再上傳影片。</p>')
      } else {
        setChildWarning('⚠️ 請先選擇分析對象（小朋友）再提交影片')
      }
      return
    }
    setChildWarning('')
    setUploading(true)
    setUploadStatus('上載中...')
    setUploadProgress(0)

    const formData = new FormData()
    formData.append('video', selectedFile)

    try {
      const xhr = new XMLHttpRequest()
      xhr.upload.onprogress = e => { if (e.lengthComputable) setUploadProgress(Math.round(e.loaded / e.total * 100)) }
      const result = await new Promise((resolve, reject) => {
        xhr.onload = () => {
          try {
            const p = xhr.responseText ? JSON.parse(xhr.responseText) : null
            if (xhr.status >= 200 && xhr.status < 300) resolve(p)
            else reject(new Error(p?.error || p?.message || `Upload failed (${xhr.status})`))
          } catch (err) { reject(err) }
        }
        xhr.onerror = () => reject(new Error('Network error'))
        xhr.open('POST', '/api/upload-video')
        xhr.setRequestHeader('Authorization', `Bearer ${token}`)
        xhr.send(formData)
      })

      const videoId = result?.video_id
      if (!videoId) { setUploadStatus('Missing video ID'); return }
      setUploadStatus('Starting analysis...')

      // Reset upload UI
      cancelPreview()
      setUploadProgress(100)
      loadUploads(true)
      setUploading(false)

      // Start analysis
      setAnalysisRunning(true)
      setAnalysisReportId(null)
      setModalOpen(true)
      setModalHtml(`
        <div class="analysis-animation">
          <div class="analysis-animation__circle"></div>
          <p class="analysis-animation__message">分析已開始，請稍候...</p>
          <p class="analysis-animation__hint">正在處理影片和生成報告中</p>
        </div>
      `)

      const ar = await fetch(`/api/video/${videoId}/child-analyze`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ child_id: parseInt(selectedChildId) }),
      })
      const ap = await ar.json()
      if (!ar.ok || !ap?.success) {
        setModalHtml(`<p style="color:#b00020;">❌ ${escapeHtml(ap?.error || 'Analysis start failed')}</p>`)
        setAnalysisRunning(false)
        return
      }
      setAnalysisReportId(ap.report_id)
      // Refresh upload list now that report exists with child_name
      loadUploads(true)
      pollForReport(ap.report_id, videoId)
    } catch (e) {
      setUploadStatus(e?.message || 'Upload failed')
      setUploading(false)
    }
  }, [selectedFile, selectedChildId, token, cancelPreview, loadUploads, authHeaders])

  /* Poll for report */
  const pollForReport = useCallback(async (reportId, videoId, timeout = 600000, interval = 3000) => {
    activePollRef.current = true
    const start = Date.now()
    while (Date.now() - start < timeout) {
      if (!activePollRef.current) return
      const r = await fetch(`/api/video-analysis-report/${reportId}`, { headers: authHeaders() })
      const p = await r.json().catch(() => ({}))
      if (!r.ok) {
        setAnalysisRunning(false)
        setAnalysisReportId(null)
        setModalHtml(`<p style="color:#b00020;">❌ ${escapeHtml(p?.error || 'Report query failed')}</p>`)
        activePollRef.current = false
        return
      }
      const report = p?.report
      const status = (report?.status || '').toLowerCase()
      if (status === 'completed') {
        setAnalysisRunning(false)
        setAnalysisReportId(null)
        loadUploads(true)
        setModalHtml(renderReportHtml(report, videoId))
        activePollRef.current = false
        return
      }
      if (status === 'failed') {
        setAnalysisRunning(false)
        setAnalysisReportId(null)
        loadUploads(true)
        setModalHtml(`<p style="color:#b00020;">❌ ${escapeHtml(report?.error_message || 'Analysis failed')}</p>`)
        activePollRef.current = false
        return
      }
      // Update animation text during polling
      const msg = status === 'pending' ? 'Waiting...' : 'Processing...'
      const hint = '請稍候，正在生成分析報告'
      setModalHtml(`
        <div class="analysis-animation">
          <div class="analysis-animation__circle"></div>
          <p class="analysis-animation__message">${escapeHtml(msg)}</p>
          <p class="analysis-animation__hint">${escapeHtml(hint)}</p>
        </div>
      `)
      await sleep(interval)
    }
    setAnalysisRunning(false)
    setAnalysisReportId(null)
    loadUploads(true)
    setModalHtml(`<p style="color:#b00020;">❌ Report timeout</p>`)
    activePollRef.current = false
  }, [authHeaders])

  /* Delete upload */
  const handleDeleteUpload = async (id) => {
    if (!confirm('確定要刪除？')) return
    await fetch(`/api/videos/${id}`, { method: 'DELETE', headers: authHeaders() })
    setUploads(prev => prev.filter(u => u.id !== id))
  }

  /* Batch delete */
  const handleBatchDelete = async () => {
    if (!confirm(`確定要刪除 ${selectedIds.size} 個項目？`)) return
    for (const id of selectedIds) {
      await fetch(`/api/videos/${id}`, { method: 'DELETE', headers: authHeaders() }).catch(() => {})
    }
    setSelectedIds(new Set())
    setBatchMode(false)
    loadUploads()
  }

  /* View report */
  const handleViewReport = async (upload) => {
    const rid = upload.analysis_report_info?.report_id
    if (!rid) return
    setModalOpen(true)
    setModalHtml('<p>Loading report...</p>')
    const r = await fetch(`/api/video-analysis-report/${rid}`, { headers: authHeaders() })
    if (r.ok) {
      const p = await r.json()
      setModalHtml(renderReportHtml(p?.report, upload.id))
    } else {
      setModalHtml('<p>Failed to load report</p>')
    }
  }

  /* Discard report */

  /* Group uploads by child name */
  const grouped = (() => {
    const map = new Map()
    for (const u of uploads) {
      const name = u.analysis_report_info?.child_name
      if (!name) continue
      if (!map.has(name)) map.set(name, [])
      map.get(name).push(u)
    }
    const arr = [...map.entries()]
    arr.sort((a, b) => a[0].localeCompare(b[0]))
    return arr
  })()

  /* Drag-drop */
  const [dragover, setDragover] = useState(false)
  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragover(false)
    const file = e.dataTransfer?.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  return (
    <main className="w-[min(calc(100%-40px),1440px)] mx-auto pt-6 pb-12 flex-1 max-sm:w-[min(calc(100%-24px),1440px)]">
      {/* Banner */}
      <section className="mb-3 col-span-full">
        <span className="ae-kicker mb-2 inline-block">Video Review Studio</span>
        <h1 className="text-[2.2rem] -tracking-[0.02em] leading-tight font-bold mb-3">影片分析儀表板</h1>
        <p className="text-[1.05rem] leading-relaxed text-[var(--ae-text-muted)]">管理上傳內容、分析影片並查看 AI 深入洞察。</p>
      </section>

      {/* Two-column workspace */}
      <div className="grid gap-x-8 lg:grid-cols-[420px_1fr] max-lg:grid-cols-1 items-start">
        {/* Left Sidebar */}
        <aside className="sticky top-[100px] flex flex-col gap-5 max-lg:static">
          {/* Upload Module */}
          <div className="ae-card !p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold m-0">上載影片與設定對象</h2>
            </div>

            {/* Child Select */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-[var(--ae-text-muted)] uppercase tracking-wider mb-3">選擇分析對象</h4>
              <select className="vm-select" value={selectedChildId} onChange={e => { setSelectedChildId(e.target.value); setChildWarning('') }}>
                <option value="">— 請選擇兒童 —</option>
                {children.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.age_months ? ` (${Math.floor(c.age_months)} months)` : ''}
                  </option>
                ))}
              </select>
              {selectedChild && (
                <span className="block mt-2 text-sm text-[var(--ae-text-muted)]">
                  Age: {Math.floor(selectedChild.age_months || 0)} months ({((selectedChild.age_months || 0) / 12).toFixed(1)} years)
                </span>
              )}
              {showAddChild && (
                <button className="ae-btn ae-btn--ghost mt-2" onClick={() => {
                  window.dispatchEvent(new CustomEvent('open-settings', {
                    detail: { tab: 'children', action: 'add-child', autoClose: true }
                  }))
                }}>Add child profile</button>
              )}
              {childWarning && (
                <p className="mt-2 text-sm text-[#b00020] font-medium">{childWarning}</p>
              )}
            </div>

            {/* Upload Zone */}
            {!previewUrl && (
              <div
                ref={zoneRef}
                className={`video-upload-zone ${dragover ? 'vm-dragover' : ''}`}
                onClick={() => inputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragover(true) }}
                onDragLeave={e => { e.preventDefault(); setDragover(false) }}
                onDrop={handleDrop}
                tabIndex={0}
              >
                <i className="fas fa-cloud-arrow-up" />
                <h3 className="text-base font-semibold mt-3">拖曳影片或選擇檔案</h3>
                <p className="text-sm text-[var(--ae-text-muted)] mt-2">支援 MP4、MOV 等常見格式，並保留目前的分析流程。</p>
              </div>
            )}
            {!previewUrl && <p className="text-center text-[var(--ae-text-muted)] text-sm mt-2">點擊或拖曳影片到上方區域</p>}

            <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />

            {/* Preview */}
            {previewUrl && (
              <div className="mt-4 bg-[var(--ae-surface-soft)] rounded-2xl p-4 border border-[var(--ae-border)]">
                <video src={previewUrl} className="w-full rounded-xl bg-black max-h-[200px]" controls />
                <div className="flex justify-between items-center mt-3">
                  <span className="text-sm text-[var(--ae-text-muted)] truncate">
                    {selectedFile?.name} — {selectedFile ? formatMB(selectedFile.size) : ''}
                  </span>
                  <button className="ae-btn ae-btn--ghost ae-btn--sm" onClick={cancelPreview}>
                    <i className="fas fa-times" /> 取消
                  </button>
                </div>
              </div>
            )}

            {/* Submit */}
            <div className="mt-6">
              <button className="ae-btn ae-btn--primary w-full justify-center" disabled={!selectedFile || uploading} onClick={handleUpload}>
                <i className="fas fa-upload" />
                {uploading ? '上載中...' : '提交影片'}
              </button>
            </div>

            {/* Progress */}
            {uploading && uploadProgress > 0 && (
              <div className="mt-4 border border-[var(--ae-border)] rounded-2xl bg-[var(--ae-surface-soft)] p-4">
                <div className="w-full h-2 bg-[var(--ae-surface-muted)] rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--ae-primary)] transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
                <p className="mt-2 text-sm text-center text-[var(--ae-text-muted)]">{uploadStatus}</p>
              </div>
            )}
          </div>

          {/* Shooting Guide */}
          <ShootingGuide />
        </aside>

        {/* Right: History */}
        <section>
          <div className="ae-card video-history-section !p-6 min-h-[600px]">
            <div className="flex items-center justify-between mb-5 pb-4 border-b border-[var(--ae-border)]">
              <div>
                <h2 className="text-xl font-semibold m-0">影片歷史記錄</h2>
                <span className="text-sm text-[var(--ae-text-muted)]">查看和管理您已上傳的影片與分析報告</span>
              </div>
            </div>

            {/* Batch toolbar */}
            {uploads.length > 0 && (
              <div className="flex items-center gap-4 mb-6">
                <button className="ae-btn ae-btn--sm" onClick={() => { setBatchMode(!batchMode); setSelectedIds(new Set()) }}>
                  <i className="fas fa-check-double" /> {batchMode ? '取消' : '批次管理'}
                </button>
                {batchMode && (
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1 text-sm cursor-pointer">
                      <input type="checkbox" onChange={e => {
                        if (e.target.checked) setSelectedIds(new Set(uploads.map(u => u.id)))
                        else setSelectedIds(new Set())
                      }} /> 全選
                    </label>
                    <button className="ae-btn ae-btn--danger ae-btn--sm" disabled={selectedIds.size === 0} onClick={handleBatchDelete}>
                      <i className="fas fa-trash" /> 刪除
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Loading */}
            {uploadsLoading && (
              <div className="flex items-center justify-center py-12 text-[var(--ae-text-muted)]">
                <i className="fas fa-spinner fa-spin mr-2" /> 載入中...
              </div>
            )}

            {/* Empty */}
            {!uploadsLoading && uploads.length === 0 && (
              <div className="flex items-center justify-center gap-3 py-16 text-[var(--ae-text-muted)]">
                <i className="fas fa-video text-3xl" />
                <p className="m-0">沒有影片上傳記錄</p>
              </div>
            )}

            {/* Grouped list */}
            {!uploadsLoading && grouped.map(([childName, items]) => {
              const isCollapsed = collapsedGroups.has(childName)
              return (
              <div key={childName} className="mb-6">
                <div className="upload-group-header flex items-center gap-3 px-5 py-3.5 bg-[var(--ae-surface-soft)] rounded-xl mb-3 cursor-pointer text-[var(--ae-primary-soft)] hover:bg-[var(--ae-surface-muted)] transition-colors"
                  onClick={() => toggleGroup(childName)}>
                  <i className={`fas fa-chevron-${isCollapsed ? 'right' : 'down'} group-toggle-icon`} />
                  <span className="font-semibold text-base flex-1">{childName}</span>
                  <span>({items.length})</span>
                </div>
                {!isCollapsed && items.map(u => {
                  const rpt = u.analysis_report_info
                  const uploadDate = new Date(u.uploaded_at || u.created_at).toLocaleDateString()
                  const viewUrl = u.signed_url || `/api/videos/${u.id}/view`
                  const canView = !!viewUrl
                  return (
                  <div key={u.id} className="upload-card">
                    {batchMode && (
                      <label className="flex items-center justify-center w-11 h-11 min-w-[44px] cursor-pointer">
                        <input type="checkbox" className="w-5 h-5" checked={selectedIds.has(u.id)}
                          onChange={() => {
                            const next = new Set(selectedIds)
                            next.has(u.id) ? next.delete(u.id) : next.add(u.id)
                            setSelectedIds(next)
                          }} />
                      </label>
                    )}
                    <div className="upload-info">
                      <span className="upload-filename">{u.original_filename || u.filename || 'Unknown'}</span>
                      <div className="upload-meta">
                        <span><i className="fas fa-clock" /> {uploadDate}</span>
                      </div>
                      {rpt && rpt.status === 'completed' && (
                        <div className="report-actions">
                          <button className="ae-btn ae-btn--sm ae-btn--primary" onClick={() => handleViewReport(u)}>
                            <i className="fas fa-file-alt" /> 查看報告
                          </button>
                          {rpt.report_id && (
                            <a href={`/api/video-analysis-report/${rpt.report_id}/download`} target="_blank" rel="noreferrer" className="ae-btn ae-btn--sm" style={{ textDecoration: 'none' }}>
                              <i className="fas fa-download" /> 下載報告
                            </a>
                          )}
                        </div>
                      )}
                      {rpt && (rpt.status === 'processing' || rpt.status === 'pending') && (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="analysis-pulse-dot"></span>
                          <span className="text-sm font-medium" style={{ color: 'var(--ae-primary)' }}>
                            <i className="fas fa-spinner fa-spin" /> 報告生成中...
                          </span>
                        </div>
                      )}
                      {rpt && rpt.status === 'failed' && (
                        <div className="text-sm text-[#b00020]">
                          <i className="fas fa-exclamation-circle" /> 分析失敗
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 ml-auto flex-shrink-0">
                      {canView && (
                        <button className="ae-btn ae-btn--sm ae-btn--ghost" onClick={() => window.open(viewUrl, '_blank')}>
                          <i className="fas fa-play" /> 查看影片
                        </button>
                      )}
                      <button className="ae-btn ae-btn--sm ae-btn--danger" onClick={() => handleDeleteUpload(u.id)}>
                        <i className="fas fa-trash" /> 刪除
                      </button>
                    </div>
                  </div>
                )})}
              </div>
            )})}
          </div>
        </section>
      </div>

      {/* Analysis Result Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-[120]">
          <div className="absolute inset-0 bg-[rgba(28,28,26,0.38)]" onClick={handleBackdropClick} />
          <div className="relative w-[min(850px,calc(100%-32px))] mt-[5vh] mx-auto border border-[var(--ae-border)] rounded-[20px] bg-[var(--ae-surface)] shadow-[var(--ae-shadow)] overflow-hidden max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center gap-3 px-6 py-5 border-b border-[var(--ae-border)]">
              <h3 className="m-0 text-lg font-semibold">分析結果</h3>
              <button className="bg-transparent border-0 text-2xl leading-none cursor-pointer text-[#6b7280] hover:text-[var(--ae-text)] p-1" onClick={handleModalClose}>×</button>
            </div>
            <div className="px-7 py-6 overflow-auto flex-1" dangerouslySetInnerHTML={{ __html: modalHtml }} />
            <div className="flex justify-center items-center gap-3 px-6 py-5 border-t border-[var(--ae-border)]">
              {analysisRunning ? (
                <>
                  <button className="ae-btn ae-btn--danger" onClick={handleCancelAndDelete}>
                    <i className="fas fa-trash"></i> 取消分析並刪除記錄
                  </button>
                  <button className="ae-btn ae-btn--primary" onClick={handleContinueBackground}>
                    <i className="fas fa-external-link-alt"></i> 後台繼續分析
                  </button>
                </>
              ) : (
                <button className="ae-btn" onClick={() => { setModalOpen(false); loadUploads() }}>關閉</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[200] bg-[var(--ae-surface)] border border-[var(--ae-border)] rounded-xl px-5 py-3 shadow-lg animate-slide-up flex items-center gap-3">
          <span>{toast.icon}</span>
          <div>
            <div className="font-semibold text-sm">{toast.title}</div>
            <div className="text-xs text-[var(--ae-text-muted)]">{toast.message}</div>
          </div>
          <button className="ml-2 bg-transparent border-0 cursor-pointer text-[var(--ae-text-muted)]" onClick={() => setToast(null)}>×</button>
        </div>
      )}
    </main>
  )
}

/* ── Shooting Guide ── */
function ShootingGuide() {
  return (
    <div className="ae-card" style={{ background: 'linear-gradient(180deg, rgba(236,225,205,0.4), var(--ae-surface))', border: '1px solid rgba(168,159,141,0.35)' }}>
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center justify-center w-9 h-9 bg-[var(--ae-primary)] text-white rounded-full text-lg">
          <i className="fas fa-lightbulb" />
        </div>
        <h3 className="m-0 text-lg">拍攝指南</h3>
      </div>
      <ul className="m-0 p-0 list-none flex flex-col gap-3.5">
        {TIPS.map((tip, i) => (
          <li key={i} className="flex items-start gap-2.5 text-[0.95rem] leading-[1.4] text-[var(--ae-text-muted)]">
            <i className={`fas ${tip.icon} mt-[3px] text-[var(--ae-primary-soft)]`} />
            <span>{tip.text}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ── Report HTML Renderer ── */
function renderReportHtml(report, videoId) {
  if (!report) return '<p>No report data</p>'

  const statusBadge = (s) => {
    const colors = { TYPICAL: '#c6f6d5', CONCERN: '#fefcbf', NEEDS_ATTENTION: '#fed7d7' }
    const labels = { TYPICAL: 'Typical', CONCERN: 'Concern', NEEDS_ATTENTION: 'Needs Attention' }
    const bg = colors[s] || '#e2e8f0'
    const label = labels[s] || s || '-'
    return `<span style="background:${bg};padding:2px 10px;border-radius:12px;font-weight:bold;">${escapeHtml(label)}</span>`
  }

  const complianceLabel = (s) => {
    const map = { PASS: {l:'Pass',bg:'#c6f6d5',c:'#22543d'}, CONCERN: {l:'Concern',bg:'#fefcbf',c:'#744210'}, UNABLE_TO_ASSESS: {l:'N/A',bg:'#e2e8f0',c:'#4a5568'} }
    const m = map[s] || {l:s||'-',bg:'#e2e8f0',c:'#4a5568'}
    return `<span style="background:${m.bg};color:${m.c};padding:1px 6px;border-radius:8px;font-size:0.85em;font-weight:bold;">${escapeHtml(m.l)}</span>`
  }

  const standardsTable = (standards, rag) => {
    if (rag === false) return '<p style="background:#fffbeb;border-left:4px solid #f6ad55;padding:8px 12px;border-radius:4px;font-size:0.9em;color:#744210;">Standards data not available (RAG service unavailable)</p>'
    if (!standards?.length) return ''
    const rows = standards.map(s => `
      <tr><td>${escapeHtml(s.standard||'-')}</td><td>${escapeHtml(s.category_label||s.category||'-')}</td><td style="text-align:center;">${complianceLabel(s.status)}</td><td style="font-size:0.85em;">${escapeHtml(s.rationale||'-')}</td></tr>
    `).join('')
    return `<p><strong>Standards Table</strong></p><div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:0.9em;margin:8px 0;"><thead><tr style="background:#edf2f7;"><th style="padding:6px 8px;text-align:left;border-bottom:2px solid #cbd5e0;">Standard</th><th style="padding:6px 8px;text-align:left;border-bottom:2px solid #cbd5e0;">Category</th><th style="padding:6px 8px;text-align:center;border-bottom:2px solid #cbd5e0;">Result</th><th style="padding:6px 8px;text-align:left;border-bottom:2px solid #cbd5e0;">Rationale</th></tr></thead><tbody>${rows}</tbody></table></div>`
  }

  const dimension = (title, section, fallback) => {
    const s = (section && Object.keys(section).length) ? section : fallback
    if (!s || !Object.keys(s).length) return ''
    const st = s?.standards_table || fallback?.standards_compliance
    const rag = s?.rag_available ?? fallback?.rag_available
    return `<h4>${escapeHtml(title)} ${statusBadge(s.status)}</h4>
      <p>${escapeHtml(s.findings||'')}</p>
      ${standardsTable(Array.isArray(st) ? st : [], rag)}
      ${s.concerns?.length ? '<p><strong>Concerns</strong></p><ul>'+s.concerns.map(c=>'<li>'+escapeHtml(c)+'</li>').join('')+'</ul>' : ''}
      ${s.recommendations?.length ? '<p><strong>Recommendations</strong></p><ul>'+s.recommendations.map(r=>'<li>'+escapeHtml(r)+'</li>').join('')+'</ul>' : ''}`
  }

  const overall = report.overall_assessment || {}
  const motor = (overall.motor_development && Object.keys(overall.motor_development).length) ? overall.motor_development : report.motor_analysis
  const lang = (overall.language_development && Object.keys(overall.language_development).length) ? overall.language_development : report.language_analysis
  const social = (overall.social_emotional && Object.keys(overall.social_emotional).length) ? overall.social_emotional : report.social_emotional_analysis
  const cognitive = (overall.cognitive && Object.keys(overall.cognitive).length) ? overall.cognitive : report.cognitive_analysis
  const adaptive = (overall.adaptive_behavior && Object.keys(overall.adaptive_behavior).length) ? overall.adaptive_behavior : report.adaptive_behavior_analysis
  const selfcare = (overall.selfcare && Object.keys(overall.selfcare).length) ? overall.selfcare : report.selfcare_analysis
  const recs = overall.overall_recommendations || []
  const summary = overall.executive_summary || 'Analysis completed'

  const ageMonths = report.child_age_months ? Math.floor(report.child_age_months) : '?'
  const pdfBtn = report.pdf_gcs_url
    ? `<a href="/api/video-analysis-report/${report.report_id}/download" target="_blank" class="ae-btn ae-btn--primary" style="margin-top:12px;display:inline-flex;text-decoration:none;"><i class="fas fa-download"></i> Download PDF Report</a>`
    : ''

  return `<h3>Analysis Report</h3>
    <p><strong>Child:</strong> ${escapeHtml(report.child_name||'')} <strong style="margin-left:16px;">Age:</strong> ${escapeHtml(String(ageMonths))} months</p>
    <h4>Executive Summary</h4>
    <p>${escapeHtml(summary)}</p>
    ${dimension('Motor', motor, report.motor_analysis)}
    ${dimension('Language', lang, report.language_analysis)}
    ${dimension('Social & Emotional', social, report.social_emotional_analysis)}
    ${dimension('Cognitive', cognitive, report.cognitive_analysis)}
    ${dimension('Adaptive Behavior', adaptive, report.adaptive_behavior_analysis)}
    ${dimension('Self-Care', selfcare, report.selfcare_analysis)}
    ${recs.length ? '<h4>Overall Recommendations</h4><ul>'+recs.map(r=>'<li>'+escapeHtml(r)+'</li>').join('')+'</ul>' : ''}
    ${pdfBtn}`
}
