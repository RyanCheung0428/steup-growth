import { useState, useEffect, useRef } from 'react'
import { useI18n } from '../contexts/I18nContext'
import { initPoseDetectionRuntime } from '../lib/poseDetectionRuntime'

/* ── CDN Scripts to load before pose modules ── */
const POSE_CDN_SCRIPTS = [
  'https://cdn.socket.io/4.7.5/socket.io.min.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/control_utils/control_utils.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/holistic/holistic.js',
]

/* ── Custom pose detection modules (served by Flask) ── */
const POSE_MODULES = [
  '/pose_detection/js/pose_error_handler.js',
  '/pose_detection/js/pose_detector_3d.js',
  '/pose_detection/js/multi_person_detector.js',
  '/pose_detection/js/multi_person_selector.js',
  '/pose_detection/js/action_detector.js',
  '/pose_detection/js/movement_analyzers.js',
  '/pose_detection/js/movement_detector.js',
  '/pose_detection/js/movement_descriptor.js',
  '/pose_detection/js/pose_renderer.js',
]

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing) { resolve(); return }
    const s = document.createElement('script')
    s.src = src
    s.onload = resolve
    s.onerror = reject
    document.head.appendChild(s)
  })
}

async function loadAllScripts() {
  for (const src of POSE_CDN_SCRIPTS) await loadScript(src)
  for (const src of POSE_MODULES) await loadScript(src)
}

export default function PoseDetection() {
  const { t } = useI18n()
  const [scriptsLoaded, setScriptsLoaded] = useState(false)
  const [scriptsError, setScriptsError] = useState(null)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)

  // Load scripts on mount
  useEffect(() => {
    let canceled = false
    loadAllScripts()
      .then(() => { if (!canceled) setScriptsLoaded(true) })
      .catch(e => { if (!canceled) setScriptsError(e.message) })
    return () => { canceled = true }
  }, [])

  // Boot the pose page runtime after the external detector scripts are ready.
  useEffect(() => {
    if (!scriptsLoaded) return

    let cleanup
    try {
      cleanup = initPoseDetectionRuntime()
    } catch (error) {
      setScriptsError(error?.message || 'Failed to initialize pose detection')
    }

    return () => {
      cleanup?.()
    }
  }, [scriptsLoaded])

  return (
    <main className="w-[min(calc(100%-40px),1440px)] mx-auto py-8 pb-12 flex-1 max-sm:w-[min(calc(100%-24px),1440px)]">
      {/* Page Header */}
      <section className="flex justify-between items-end gap-6 mb-7">
        <div>
          <span className="ae-kicker">{t('poseDetection.pageKicker')}</span>
          <h1 className="text-[clamp(2rem,4vw,3.25rem)] leading-[1.05] -tracking-[0.04em] font-bold m-0 mt-2">
            {t('poseDetection.pageHeadline')}
          </h1>
          <p className="mt-2.5 text-[var(--ae-text-muted)] leading-relaxed max-w-[760px]">
            {t('poseDetection.pageSubtitle')}
          </p>
        </div>
      </section>

      {/* Two-column content */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)] max-lg:grid-cols-1">
        {/* Left: Video Section */}
        <section className="ae-card grid gap-[18px]">
          {/* Video Wrapper */}
          <div id="videoWrapper" className="relative bg-[#111] rounded-[22px] overflow-hidden min-h-[58vh] border border-[var(--ae-border)]">
            <video id="poseVideo" ref={videoRef} autoPlay playsInline className="w-full h-full object-contain" />
            <canvas id="poseCanvas" ref={canvasRef} className="absolute inset-0 pointer-events-none w-full h-full object-contain" />
            <div className="video-placeholder absolute inset-0 flex flex-col items-center justify-center gap-3.5 text-white/80 text-center pointer-events-none">
              <i className="fas fa-video text-[3rem]" />
              <p>{t('poseDetection.videoPlaceholder')}</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex gap-3 flex-wrap">
            <button className="control-btn" id="startBtn">
              <i className="fas fa-play" /> {t('poseDetection.startDetection')}
            </button>
            <button className="control-btn stop" id="stopBtn" style={{ display: 'none' }}>
              <i className="fas fa-stop" /> {t('poseDetection.stopDetection')}
            </button>
            <button className="control-btn reset" id="resetBtn" style={{ display: 'none' }}>
              <i className="fas fa-undo" /> {t('poseDetection.resetSelection')}
            </button>
          </div>

          {/* Selection Status */}
          <div id="selectionStatus" className="selection-status" style={{ display: 'none' }}>
            <span className="flex gap-2.5 items-center">
              <i className="fas fa-crosshairs" />
              <span id="selectionStatusText">{t('poseDetection.selectionHint')}</span>
            </span>
          </div>
        </section>

        {/* Right: Info Panel */}
        <aside className="grid gap-4 content-start">
          {/* Current Action */}
          <div className="info-card">
            <div className="card-label">{t('poseDetection.currentAction')}</div>
            <span className="status-value" id="currentActionValue" style={{ color: 'var(--ae-text-muted)' }}>—</span>
          </div>

          {/* Current Test Action */}
          <div className="info-card">
            <div className="card-label">{t('poseDetection.currentTestAction')}</div>
            <div id="currentTestActionContent" className="grid gap-2">
              <div className="test-action-icon" id="testActionIcon">🎯</div>
              <div className="test-action-name text-xl font-bold" id="testActionName">—</div>
              <div id="testActionInstruction" className="text-sm text-[var(--ae-text-muted)]">{t('poseDetection.testActionInstruction')}</div>
            </div>
          </div>

          {/* Assessment Card */}
          <div className="info-card grid gap-3">
            <div className="card-label">{t('poseDetection.testTitle')}</div>
            <div className="flex justify-between gap-3">
              <span>{t('poseDetection.testProgress')}</span>
              <span id="testProgressValue">—</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>{t('poseDetection.testScore')}</span>
              <span id="testScoreValue">0 / 5</span>
            </div>
            <div id="testHint" className="selection-status text-sm">
              {t('poseDetection.testHint')}
            </div>
            <div className="flex gap-3 flex-wrap">
              <button className="test-btn" id="startTestBtn" disabled>{t('poseDetection.startTest')}</button>
              <button className="test-btn secondary" id="skipTestBtn" disabled>{t('poseDetection.skipTest')}</button>
              <button className="test-btn secondary" id="resetTestBtn" disabled>{t('poseDetection.resetTest')}</button>
            </div>
            <div id="evaluationPanel" className="grid gap-3" style={{ display: 'none' }}>
              <button className="test-btn report" id="showReportBtn">
                <i className="fas fa-file-alt" /> {t('poseDetection.viewReport')}
              </button>
              <button className="test-btn secondary danger" id="clearEvalBtn">
                <i className="fas fa-trash-alt" /> {t('poseDetection.clearRecord')}
              </button>
              <div id="evaluationSummary" style={{ display: 'none' }} />
              <div id="evaluationDetails" style={{ display: 'none' }} />
            </div>
          </div>

          {/* Detection Info */}
          <div className="info-card">
            <div className="card-label">{t('poseDetection.detectionInfo')}</div>
            <div className="grid gap-3">
              <InfoRow label={t('poseDetection.mode')} id="detectionModeValue" />
              <InfoRow label={t('poseDetection.detectedCount')} id="detectedPersonCountValue" />
              <InfoRow label={t('poseDetection.trackedTarget')} id="trackedPersonValue" />
              <InfoRow label={t('poseDetection.trackingDistance')} id="trackingDistanceValue" />
              <InfoRow label={t('poseDetection.fps')} id="fpsValue" />
              <InfoRow label={t('poseDetection.frameTime')} id="frameTimeValue" />
            </div>
          </div>

          {/* Error Container */}
          <div id="errorContainer" className="selection-status hidden">
            <div id="errorTitle" className="text-[var(--ae-danger)] font-bold mb-2">{t('poseDetection.errorTitle')}</div>
            <div id="errorMessage" />
          </div>
        </aside>
      </div>

      {/* Modal Overlay */}
      <div className="modal-overlay" id="modalOverlay" style={{ display: 'none' }}>
        <div className="modal-content" id="modalContent">
          <div className="modal-header">
            <span className="modal-title">{t('poseDetection.modalTitle')}</span>
            <button className="close-modal" id="closeModalBtn">&times;</button>
          </div>
          <div className="modal-body" id="modalBody" />
        </div>
      </div>

      {/* Loading / Error state */}
      {!scriptsLoaded && !scriptsError && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[var(--ae-bg)]">
          <div className="text-center">
            <div className="analysis-animation__circle mx-auto mb-4" />
            <p className="text-[var(--ae-text-muted)]">{t('poseDetection.loading')}</p>
          </div>
        </div>
      )}
      {scriptsError && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[var(--ae-bg)]">
          <div className="text-center text-[var(--ae-danger)]">
            <i className="fas fa-exclamation-triangle text-3xl mb-3" />
            <p>{t('poseDetection.loadError', '無法載入姿態檢測：{error}').replace('{error}', scriptsError)}</p>
          </div>
        </div>
      )}
    </main>
  )
}

function InfoRow({ label, id }) {
  return (
    <div className="flex justify-between gap-3">
      <span>{label}</span>
      <span id={id}>—</span>
    </div>
  )
}
