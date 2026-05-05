import { API_BASE } from './apiBase.js'

export function initPoseDetectionRuntime() {
  let poseDetector3D = null
  let multiPersonSelector = null
  let movementDetector = null
  let movementDescriptor = null
  let poseRenderer = null
  let videoStream = null
  let animationFrameId = null
  let isDetecting = false
  let lastFrameTimestamp = 0
  let smoothedFps = 0
  let recentActionsBuffer = []
  let currentActionIntervalId = null
  let canvasResizeObserver = null

  const useMultiPersonMode = true

  const videoElement = document.getElementById('poseVideo')
  const canvasElement = document.getElementById('poseCanvas')
  const startBtn = document.getElementById('startBtn')
  const stopBtn = document.getElementById('stopBtn')
  const resetBtn = document.getElementById('resetBtn')
  const selectionStatus = document.getElementById('selectionStatus')
  const selectionStatusText = document.getElementById('selectionStatusText')
  const videoWrapper = document.getElementById('videoWrapper')
  const currentActionValue = document.getElementById('currentActionValue')
  const detectionModeValue = document.getElementById('detectionModeValue')
  const detectedPersonCountValue = document.getElementById('detectedPersonCountValue')
  const trackedPersonValue = document.getElementById('trackedPersonValue')
  const trackingDistanceValue = document.getElementById('trackingDistanceValue')
  const fpsValue = document.getElementById('fpsValue')
  const frameTimeValue = document.getElementById('frameTimeValue')
  const errorContainer = document.getElementById('errorContainer')
  const testProgressValue = document.getElementById('testProgressValue')
  const testScoreValue = document.getElementById('testScoreValue')
  const testHint = document.getElementById('testHint')
  const startTestBtn = document.getElementById('startTestBtn')
  const skipTestBtn = document.getElementById('skipTestBtn')
  const resetTestBtn = document.getElementById('resetTestBtn')
  const testActionIcon = document.getElementById('testActionIcon')
  const testActionName = document.getElementById('testActionName')
  const testActionInstruction = document.getElementById('testActionInstruction')
  const closeModalBtn = document.getElementById('closeModalBtn')
  const modalOverlay = document.getElementById('modalOverlay')

  if (!videoElement || !canvasElement || !startBtn || !stopBtn || !resetBtn || !videoWrapper) {
    throw new Error('Pose detection DOM is not ready')
  }

  const ASSESSMENT_STEPS = [
    { key: 'right_hand_up', nameZh: '右手舉起', instruction: '只舉起右手，保持 1.5 秒。', type: 'hold_any', actionIds: ['left_hand_raised'], holdMs: 1500 },
    { key: 'left_hand_up', nameZh: '左手舉起', instruction: '只舉起左手，保持 1.5 秒。', type: 'hold_any', actionIds: ['right_hand_raised'], holdMs: 1500 },
    { key: 'both_hands_up', nameZh: '雙手舉起', instruction: '雙手同時舉起，保持 1.5 秒。', type: 'hold_any', actionIds: ['both_hands_raised'], holdMs: 1500 },
    { key: 'left_leg_stand', nameZh: '左腳單腳站立', instruction: '抬起左腳（單腳站立），保持 2 秒。', type: 'hold_any', actionIds: ['right_leg_raised'], holdMs: 2000 },
    { key: 'right_leg_stand', nameZh: '右腳單腳站立', instruction: '抬起右腳（單腳站立），保持 2 秒。', type: 'hold_any', actionIds: ['left_leg_raised'], holdMs: 2000 },
    { key: 'jumping_jack', nameZh: '開合跳', instruction: '做開合跳 3 下（張開 → 合上算 1 下）。', type: 'rep_single', actionId: 'jumping_jack', repsTarget: 3 },
    { key: 'high_knees', nameZh: '高抬腿', instruction: '左右腳輪流高抬腿，共 6 下（左右交替計數）。', type: 'rep_alternating', leftActionId: 'left_leg_raised', rightActionId: 'right_leg_raised', repsTarget: 6 },
    { key: 'bend_left', nameZh: '向左彎腰', instruction: '身體向左側彎，保持 1.5 秒。', type: 'hold_any', actionIds: ['leaning_left'], holdMs: 1500 },
    { key: 'bend_right', nameZh: '向右彎腰', instruction: '身體向右側彎，保持 1.5 秒。', type: 'hold_any', actionIds: ['leaning_right'], holdMs: 1500 },
    { key: 'squat', nameZh: '深蹲', instruction: '做深蹲 3 下（蹲下 → 起身算 1 下）。', type: 'rep_single', actionId: 'squatting', repsTarget: 3 },
  ]

  const assessmentState = {
    running: false,
    completed: new Array(ASSESSMENT_STEPS.length).fill(false),
    score: 0,
    stepIndex: 0,
    stepHoldMs: 0,
    stepReps: 0,
    prevActive: false,
    lastCountedSide: null,
    finished: false,
    lastFrameTs: null,
    hasTrackedPerson: false,
    lastMode: '—',
    backendRunId: null,
    submitting: false,
    justCompletedStep: null,
  }

  const poseAssessmentRunState = {
    runStartedAtMs: null,
    stepStartedAtMs: null,
    steps: [],
  }

  function getAuthHeaders(contentType = null) {
    const headers = {}
    const accessToken = localStorage.getItem('access_token')
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`
    if (contentType) headers['Content-Type'] = contentType
    return headers
  }

  async function fetchChildInfo() {
    try {
      const response = await fetch(`${API_BASE}/api/children`, { method: 'GET', headers: getAuthHeaders() })
      if (!response.ok) return null
      const data = await response.json().catch(() => ({}))
      if (data.children && data.children.length > 0) {
        const child = data.children[0]
        return { child_name: child.name, child_age_months: child.age_months }
      }
    } catch (error) {
      console.warn('Failed to fetch child info:', error)
    }
    return null
  }

  function openEvaluationModal() {
    if (modalOverlay) {
      modalOverlay.style.display = 'flex'
      document.body.style.overflow = 'hidden'
    }
  }

  function closeEvaluationModal() {
    if (modalOverlay) {
      modalOverlay.style.display = 'none'
      document.body.style.overflow = ''
    }
  }

  async function renderEvaluation(evaluation) {
    if (!evaluation) return

    const panel = document.getElementById('evaluationPanel')
    const showReportBtn = document.getElementById('showReportBtn')
    const clearBtn = document.getElementById('clearEvalBtn')
    const modalBody = document.getElementById('modalBody')
    if (!panel || !showReportBtn || !modalBody) return

    panel.style.display = 'block'

    const childInfo = await fetchChildInfo()
    const childName = childInfo ? childInfo.child_name : '—'
    const childAge = childInfo ? `${childInfo.child_age_months} 個月` : '—'

    let assessmentType = '大運動評估 (動態)'
    if (childInfo && childInfo.child_age_months) {
      const age = childInfo.child_age_months
      if (age <= 12) assessmentType = '大運動評估 (6-12個月)'
      else if (age <= 24) assessmentType = '大運動評估 (12-24個月)'
      else assessmentType = '大運動評估 (2歲以上)'
    }

    const score = evaluation.score || { completed: 0, total: ASSESSMENT_STEPS.length, percent: 0 }
    const dqScore = score.percent || 0

    let badgeText = '優異'
    if (dqScore >= 90) badgeText = '優異'
    else if (dqScore >= 80) badgeText = '良好'
    else if (dqScore >= 70) badgeText = '中等'
    else if (dqScore >= 60) badgeText = '及格'
    else badgeText = '需注意'

    let reportHtml = `
      <div class="report-score-card">
        <div class="report-dq-value">${dqScore}</div>
        <div class="report-dq-label">發育商 (DQ)</div>
        <div class="report-badge">${badgeText}</div>
      </div>
      <div class="report-grid">
        <div class="report-grid-card"><div class="report-card-label">兒童姓名</div><div class="report-card-value">${childName}</div></div>
        <div class="report-grid-card"><div class="report-card-label">年齡</div><div class="report-card-value">${childAge}</div></div>
        <div class="report-grid-card"><div class="report-card-label">評估類型</div><div class="report-card-value">${assessmentType}</div></div>
        <div class="report-grid-card"><div class="report-card-label">完成率</div><div class="report-card-value">${dqScore}% (${score.completed}/${score.total})</div></div>
      </div>
      <div class="report-advice-section">
        <div class="report-advice-title">💡 專業建議與說明</div>
        <div class="report-advice-text">${evaluation.summaryZh || `根據本次大運動評估，您的孩子在整體領域的表現為${badgeText}。建議平時多進行相關動作練習，增強肢體協調能力。`}</div>
        <div class="report-legend">
          <span class="legend-item" style="background:#4caf50;">90-100 優異</span>
          <span class="legend-item" style="background:#8bc34a;">80-89 良好</span>
          <span class="legend-item" style="background:#ffc107;">70-79 中等</span>
          <span class="legend-item" style="background:#ff9800;">60-69 及格</span>
          <span class="legend-item" style="background:#f44336;">&lt;60 需注意</span>
        </div>
      </div>
    `

    if (evaluation.steps && evaluation.steps.length > 0) {
      reportHtml += `<div style="margin-top: 24px; padding: 0 10px;"><div style="font-size: 18px; font-weight: 800; color: #3d2e52; margin-bottom: 16px;">動作執行詳情</div><div style="display: flex; flex-direction: column; gap: 12px;">`
      for (const step of evaluation.steps) {
        reportHtml += `
          <div style="background: white; padding: 16px; border-radius: 16px; display: flex; align-items: center; justify-content: space-between; border: 1px solid rgba(0,0,0,0.03);">
            <div>
              <div style="font-weight: 700; color: #3d2e52;">${step.nameZh || step.key}</div>
              <div style="font-size: 13px; color: #9b8ab8;">${step.notes && step.notes.length ? step.notes[0] : '正常執行'}</div>
            </div>
            <div style="color: ${step.passed ? '#4caf50' : '#f44336'}; font-weight: 800; font-size: 15px;">${step.passed ? '● 通過' : '○ 未通過'}</div>
          </div>
        `
      }
      reportHtml += `</div></div>`
    }

    modalBody.innerHTML = reportHtml

    showReportBtn.onclick = () => openEvaluationModal()
    if (clearBtn) {
      clearBtn.onclick = async () => {
        if (!window.confirm('確定要刪除上一筆評估紀錄嗎？此動作無法復原。')) return
        try {
          const response = await fetch(`${API_BASE}/api/pose-assessment/runs/latest`, { method: 'DELETE', headers: getAuthHeaders() })
          const data = await response.json().catch(() => ({}))
          if (response.ok && data.deleted) {
            panel.style.display = 'none'
            closeEvaluationModal()
            if (testHint) testHint.textContent = '已清除先前紀錄'
          } else {
            window.alert(`清除失敗：${data.message || data.error || '請稍後再試'}`)
          }
        } catch (error) {
          console.error('Error deleting latest run:', error)
          window.alert('清除失敗，請重試')
        }
      }
    }
  }

  async function submitPoseAssessmentRun(payload) {
    try {
      assessmentState.submitting = true
      let response = await fetch(`${API_BASE}/api/pose-assessment/runs`, {
        method: 'POST',
        headers: getAuthHeaders('application/json'),
        body: JSON.stringify(payload),
      })

      if (response.status === 401 || response.status === 422) {
        const refreshToken = localStorage.getItem('refresh_token')
        if (refreshToken) {
          try {
            const refreshResponse = await fetch(`${API_BASE}/auth/refresh`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${refreshToken}`,
                'Content-Type': 'application/json',
              },
            })
            if (refreshResponse.ok) {
              const refreshData = await refreshResponse.json()
              if (refreshData.access_token) {
                localStorage.setItem('access_token', refreshData.access_token)
                response = await fetch(`${API_BASE}/api/pose-assessment/runs`, {
                  method: 'POST',
                  headers: getAuthHeaders('application/json'),
                  body: JSON.stringify(payload),
                })
              }
            }
          } catch {
            // Ignore refresh errors and fall through.
          }
        }

        if (response.status === 401 || response.status === 422) {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          window.location.href = '/login'
          return null
        }
      }

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        console.error('Failed to submit pose assessment run:', data)
        return null
      }

      if (data.run && data.run.evaluation) {
        await renderEvaluation(data.run.evaluation)
      }

      return data.run || null
    } catch (error) {
      console.error('Error submitting pose assessment run:', error)
      return null
    } finally {
      assessmentState.submitting = false
    }
  }

  async function fetchLatestPoseAssessmentRun() {
    try {
      const response = await fetch(`${API_BASE}/api/pose-assessment/runs/latest`, { method: 'GET', headers: getAuthHeaders() })
      if (!response.ok) return
      const data = await response.json().catch(() => ({}))
      if (data.run && data.run.evaluation) {
        await renderEvaluation(data.run.evaluation)
      }
    } catch (error) {
      console.warn('Failed to fetch latest pose assessment run:', error)
    }
  }

  function resetAssessmentState({ keepDetection = true } = {}) {
    assessmentState.running = false
    assessmentState.completed = new Array(ASSESSMENT_STEPS.length).fill(false)
    assessmentState.score = 0
    assessmentState.stepIndex = 0
    assessmentState.stepHoldMs = 0
    assessmentState.stepReps = 0
    assessmentState.prevActive = false
    assessmentState.lastCountedSide = null
    assessmentState.finished = false
    assessmentState.lastFrameTs = null
    assessmentState.backendRunId = null
    assessmentState.submitting = false
    assessmentState.justCompletedStep = null
    poseAssessmentRunState.runStartedAtMs = null
    poseAssessmentRunState.stepStartedAtMs = null
    poseAssessmentRunState.steps = []

    if (!keepDetection) {
      assessmentState.hasTrackedPerson = false
      assessmentState.lastMode = '—'
    }

    updateAssessmentUI()
  }

  function canStartAssessment() {
    return Boolean(isDetecting && assessmentState.hasTrackedPerson)
  }

  function getCurrentStep() {
    return ASSESSMENT_STEPS[assessmentState.stepIndex] || null
  }

  function formatScoreText() {
    return `${assessmentState.score} / ${ASSESSMENT_STEPS.length}`
  }

  function updateCurrentTestActionCard() {
    const step = getCurrentStep()

    if (assessmentState.finished) {
      if (testActionIcon) testActionIcon.textContent = '✅'
      if (testActionName) testActionName.textContent = '測驗完成'
      if (testActionInstruction) testActionInstruction.textContent = '恭喜！所有動作都完成了'
      return
    }

    if (assessmentState.justCompletedStep) {
      if (testActionIcon) testActionIcon.textContent = '✅'
      if (testActionName) testActionName.textContent = `${assessmentState.justCompletedStep.nameZh} 完成`
      if (testActionInstruction) testActionInstruction.textContent = '做得好！準備下一個動作...'
      return
    }

    if (!step) {
      if (testActionIcon) testActionIcon.textContent = '🎯'
      if (testActionName) testActionName.textContent = '—'
      if (testActionInstruction) testActionInstruction.textContent = '請先開始測驗'
      return
    }

    let icon = '🎯'
    if (step.key === 'both_hands_up') icon = '🙌'
    else if (step.key === 'left_hand_up') icon = '🤚'
    else if (step.key === 'right_hand_up') icon = '✋'
    else if (step.key === 'left_leg_stand' || step.key === 'right_leg_stand') icon = '🦵'
    else if (step.key === 'jumping_jack') icon = '⭐'
    else if (step.key === 'high_knees') icon = '🏃'
    else if (step.key === 'bend_left') icon = '↙️'
    else if (step.key === 'bend_right') icon = '↘️'
    else if (step.key === 'squat') icon = '🏋️'

    if (testActionIcon) testActionIcon.textContent = icon
    if (testActionName) testActionName.textContent = step.nameZh

    let instruction = step.instruction
    if (assessmentState.running) {
      if (step.type.startsWith('hold')) {
        const remaining = Math.max(0, (step.holdMs - assessmentState.stepHoldMs) / 1000)
        instruction = `保持 ${remaining.toFixed(1)} 秒`
      } else if (step.type.startsWith('rep')) {
        instruction = `完成 ${assessmentState.stepReps} / ${step.repsTarget} 次`
      }
    }

    if (testActionInstruction) testActionInstruction.textContent = instruction
  }

  function updateAssessmentUI() {
    const step = getCurrentStep()
    const total = ASSESSMENT_STEPS.length
    const progressText = assessmentState.finished ? `完成 ${total} / ${total}` : `第 ${Math.min(assessmentState.stepIndex + 1, total)} 項 / ${total}`

    if (testProgressValue) testProgressValue.textContent = progressText
    if (testScoreValue) testScoreValue.textContent = formatScoreText()

    if (assessmentState.finished) {
      if (testHint) testHint.textContent = '測驗完成。可以按「重設」再做一次。'
    } else if (!step) {
      if (testHint) testHint.textContent = '—'
    } else {
      let detail = step.instruction
      if (assessmentState.running) {
        if (step.type.startsWith('hold')) detail += `（已保持 ${(assessmentState.stepHoldMs / 1000).toFixed(1)}s）`
        else if (step.type.startsWith('rep')) detail += `（${assessmentState.stepReps} / ${step.repsTarget}）`
      }

      if (testHint) {
        if (!isDetecting) testHint.textContent = '先點「開始檢測」開攝影機。'
        else if (!assessmentState.hasTrackedPerson) testHint.textContent = '點擊畫面選擇要追蹤的人，先鎖定追蹤對象。'
        else if (!assessmentState.running) testHint.textContent = `準備好就按「開始測驗」。${step.instruction}`
        else testHint.textContent = detail
      }
    }

    if (startTestBtn) startTestBtn.disabled = !canStartAssessment() || assessmentState.running || assessmentState.finished
    if (skipTestBtn) skipTestBtn.disabled = !assessmentState.running || assessmentState.finished
    if (resetTestBtn) resetTestBtn.disabled = !isDetecting

    updateCurrentTestActionCard()
  }

  function recordCurrentStepResult(status) {
    const step = getCurrentStep()
    if (!step) return

    const now = Date.now()
    const startedAt = poseAssessmentRunState.stepStartedAtMs || now
    const durationMs = Math.max(0, now - startedAt)
    const target = {}
    const achieved = {}

    if (step.type.startsWith('hold')) {
      target.holdMs = step.holdMs
      achieved.holdMs = Math.round(assessmentState.stepHoldMs)
    } else if (step.type.startsWith('rep')) {
      target.repsTarget = step.repsTarget
      achieved.reps = assessmentState.stepReps
    }

    poseAssessmentRunState.steps.push({ key: step.key, nameZh: step.nameZh, type: step.type, status, target, achieved, durationMs })
    poseAssessmentRunState.stepStartedAtMs = Date.now()
  }

  function finishRunIfNeeded() {
    if (assessmentState.stepIndex < ASSESSMENT_STEPS.length || assessmentState.submitting) return
    assessmentState.finished = true
    assessmentState.running = false

    const payload = {
      source: 'pose_detection',
      runStartedAt: new Date(poseAssessmentRunState.runStartedAtMs || Date.now()).toISOString(),
      runEndedAt: new Date().toISOString(),
      steps: poseAssessmentRunState.steps,
      clientScore: {
        completed: assessmentState.score,
        total: ASSESSMENT_STEPS.length,
      },
    }

    submitPoseAssessmentRun(payload).then((run) => {
      if (!run) return
      assessmentState.backendRunId = run.run_id
      if (testHint && run.evaluation && run.evaluation.summaryZh) {
        testHint.textContent = `測驗完成。後端評語：${run.evaluation.summaryZh}`
      }
    })
  }

  function completeCurrentStep() {
    const step = getCurrentStep()
    if (!step) return
    recordCurrentStepResult('completed')
    assessmentState.completed[assessmentState.stepIndex] = true
    assessmentState.score = assessmentState.completed.filter(Boolean).length
    assessmentState.justCompletedStep = step
    window.setTimeout(() => {
      assessmentState.justCompletedStep = null
      updateCurrentTestActionCard()
    }, 2000)
    assessmentState.stepIndex += 1
    assessmentState.stepHoldMs = 0
    assessmentState.stepReps = 0
    assessmentState.prevActive = false
    assessmentState.lastCountedSide = null
    if (assessmentState.stepIndex >= ASSESSMENT_STEPS.length) {
      finishRunIfNeeded()
    }
    updateAssessmentUI()
  }

  function skipCurrentStep() {
    const step = getCurrentStep()
    if (!step) return
    recordCurrentStepResult('skipped')
    assessmentState.completed[assessmentState.stepIndex] = false
    assessmentState.stepIndex += 1
    assessmentState.stepHoldMs = 0
    assessmentState.stepReps = 0
    assessmentState.prevActive = false
    assessmentState.lastCountedSide = null
    if (assessmentState.stepIndex >= ASSESSMENT_STEPS.length) {
      finishRunIfNeeded()
    }
    updateAssessmentUI()
  }

  function startAssessment() {
    if (!canStartAssessment()) {
      updateAssessmentUI()
      return
    }
    if (assessmentState.finished) resetAssessmentState()
    assessmentState.running = true
    assessmentState.lastFrameTs = performance.now()
    assessmentState.stepHoldMs = 0
    assessmentState.stepReps = 0
    assessmentState.prevActive = false
    assessmentState.lastCountedSide = null
    assessmentState.backendRunId = null
    assessmentState.submitting = false
    poseAssessmentRunState.runStartedAtMs = Date.now()
    poseAssessmentRunState.stepStartedAtMs = Date.now()
    poseAssessmentRunState.steps = []
    updateAssessmentUI()
  }

  function updateAssessmentFromActions(actions, nowTs) {
    if (!assessmentState.running || assessmentState.finished) return
    const step = getCurrentStep()
    if (!step) return
    if (assessmentState.lastFrameTs == null) {
      assessmentState.lastFrameTs = nowTs
      return
    }

    const dt = Math.max(0, nowTs - assessmentState.lastFrameTs)
    assessmentState.lastFrameTs = nowTs
    const activeIds = new Set((actions || []).map((action) => action.id))

    if (step.type === 'hold_any') {
      const isActive = step.actionIds.some((id) => activeIds.has(id))
      if (isActive) {
        assessmentState.stepHoldMs += dt
        if (assessmentState.stepHoldMs >= step.holdMs) {
          completeCurrentStep()
          return
        }
      } else {
        assessmentState.stepHoldMs = 0
      }
    } else if (step.type === 'rep_single') {
      const isActive = activeIds.has(step.actionId)
      if (isActive && !assessmentState.prevActive) {
        assessmentState.stepReps += 1
        if (assessmentState.stepReps >= step.repsTarget) {
          completeCurrentStep()
          return
        }
      }
      assessmentState.prevActive = isActive
    } else if (step.type === 'rep_alternating') {
      const leftActive = activeIds.has(step.leftActionId)
      const rightActive = activeIds.has(step.rightActionId)
      const side = leftActive ? 'left' : rightActive ? 'right' : null
      const isActive = Boolean(side)
      if (isActive && !assessmentState.prevActive) {
        if (!assessmentState.lastCountedSide || assessmentState.lastCountedSide !== side) {
          assessmentState.stepReps += 1
          assessmentState.lastCountedSide = side
          if (assessmentState.stepReps >= step.repsTarget) {
            completeCurrentStep()
            return
          }
        }
      }
      assessmentState.prevActive = isActive
    }

    updateAssessmentUI()
  }

  function setDetectionInfo({
    modeText = '—',
    personCountText = '—',
    trackedPersonText = '—',
    trackingDistanceText = '—',
    fpsText = '—',
    frameTimeText = '—',
  } = {}) {
    if (detectionModeValue) detectionModeValue.textContent = modeText
    if (detectedPersonCountValue) detectedPersonCountValue.textContent = personCountText
    if (trackedPersonValue) trackedPersonValue.textContent = trackedPersonText
    if (trackingDistanceValue) trackingDistanceValue.textContent = trackingDistanceText
    if (fpsValue) fpsValue.textContent = fpsText
    if (frameTimeValue) frameTimeValue.textContent = frameTimeText
  }

  function setCurrentActionText(text) {
    if (!currentActionValue) return
    currentActionValue.textContent = text || '—'
    currentActionValue.className = `status-value${text && text !== '—' ? ' active' : ' inactive'}`
  }

  function addToRecentActions(actionText) {
    if (!actionText || actionText === '—') return
    recentActionsBuffer.push({ text: actionText, timestamp: Date.now() })
  }

  function getRecentActionsDisplay() {
    const now = Date.now()
    recentActionsBuffer = recentActionsBuffer.filter((item) => now - item.timestamp < 1000)
    if (recentActionsBuffer.length === 0) return '—'
    return [...new Set(recentActionsBuffer.map((item) => item.text))].join(' ')
  }

  function startCurrentActionTimer() {
    if (currentActionIntervalId) return
    currentActionIntervalId = window.setInterval(() => {
      setCurrentActionText(getRecentActionsDisplay())
    }, 1000)
  }

  function stopCurrentActionTimer() {
    if (!currentActionIntervalId) return
    window.clearInterval(currentActionIntervalId)
    currentActionIntervalId = null
  }

  function clearRecentActionsBuffer() {
    recentActionsBuffer = []
  }

  function showError(title, message) {
    const errorTitle = document.getElementById('errorTitle')
    const errorMessage = document.getElementById('errorMessage')
    if (errorTitle) errorTitle.textContent = title
    if (errorMessage) errorMessage.textContent = message
    if (errorContainer) errorContainer.classList.add('show')
  }

  async function initializePoseSystem() {
    try {
      if (!window.PoseDetector3D || !window.MultiPersonSelector || !window.MovementDetector || !window.MovementDescriptorGenerator || !window.PoseRenderer) {
        throw new Error('Pose detection dependencies did not attach to window')
      }

      poseDetector3D = new window.PoseDetector3D({
        modelComplexity: 1,
        smoothLandmarks: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.3,
        refineFaceLandmarks: false,
      })
      await poseDetector3D.initialize()

      multiPersonSelector = new window.MultiPersonSelector({
        maxPersons: 2,
        selectionColor: '#0088ff',
        lockedColor: '#00ff00',
        boundingBoxPadding: 25,
        trackingThreshold: 0.25,
      })

      movementDetector = new window.MovementDetector({
        confidenceThreshold: 0.5,
        enableSmoothing: true,
        smoothingFrames: 2,
        language: 'zh',
      })

      movementDescriptor = new window.MovementDescriptorGenerator({
        language: 'zh',
        showIcon: true,
      })

      poseRenderer = new window.PoseRenderer()
      return true
    } catch (error) {
      console.error('Failed to initialize pose system:', error)
      showError('初始化失敗', error.message || '無法載入姿態檢測模型')
      return false
    }
  }

  async function startDetection() {
    try {
      videoWrapper.classList.add('loading')

      if (!poseDetector3D) {
        const success = await initializePoseSystem()
        if (!success) throw new Error('Failed to initialize pose detection system')
      }

      videoStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
          frameRate: { ideal: 30 },
        },
      })

      videoElement.srcObject = videoStream
      await videoElement.play()

      function syncCanvasWithVideo() {
        const videoRect = videoElement.getBoundingClientRect()
        const wrapperRect = videoWrapper.getBoundingClientRect()
        const intrinsicVideoWidth = videoElement.videoWidth || videoRect.width
        const intrinsicVideoHeight = videoElement.videoHeight || videoRect.height
        canvasElement.width = intrinsicVideoWidth
        canvasElement.height = intrinsicVideoHeight

        let displayWidth = videoRect.width
        let displayHeight = videoRect.height
        let offsetX = 0
        let offsetY = 0

        if (intrinsicVideoWidth && intrinsicVideoHeight && videoRect.width && videoRect.height) {
          const videoAspect = intrinsicVideoWidth / intrinsicVideoHeight
          const elementAspect = videoRect.width / videoRect.height
          if (videoAspect > elementAspect) {
            displayHeight = videoRect.width / videoAspect
            offsetY = (videoRect.height - displayHeight) / 2
          } else {
            displayWidth = videoRect.height * videoAspect
            offsetX = (videoRect.width - displayWidth) / 2
          }
        }

        canvasElement.style.width = `${displayWidth}px`
        canvasElement.style.height = `${displayHeight}px`
        canvasElement.style.left = `${Math.round(videoRect.left - wrapperRect.left + offsetX)}px`
        canvasElement.style.top = `${Math.round(videoRect.top - wrapperRect.top + offsetY)}px`
      }

      syncCanvasWithVideo()

      canvasResizeObserver = new ResizeObserver(() => {
        syncCanvasWithVideo()
      })
      canvasResizeObserver.observe(videoWrapper)
      canvasResizeObserver.observe(videoElement)

      if (multiPersonSelector && useMultiPersonMode) {
        multiPersonSelector.attachToCanvas(canvasElement, (personIndex) => {
          updateSelectionStatus(true, personIndex + 1)
          assessmentState.hasTrackedPerson = true
          updateAssessmentUI()
        })
        selectionStatus.style.display = 'flex'
        updateSelectionStatus(false)
      }

      isDetecting = true
      resetAssessmentState({ keepDetection: true })
      detectLoop()
      clearRecentActionsBuffer()
      startCurrentActionTimer()
      startBtn.style.display = 'none'
      stopBtn.style.display = 'flex'
      if (useMultiPersonMode) resetBtn.style.display = 'flex'
      videoWrapper.classList.remove('loading')
      videoWrapper.classList.add('active')
      setCurrentActionText('—')
      setDetectionInfo({
        modeText: useMultiPersonMode ? '選擇中' : '偵測中',
      })
      if (errorContainer) errorContainer.classList.remove('show')
    } catch (error) {
      console.error('Failed to start detection:', error)
      videoWrapper.classList.remove('loading')
      setCurrentActionText('—')
      setDetectionInfo({ modeText: '未開始' })
      if (error.name === 'NotAllowedError') showError('攝影機權限被拒絕', '請允許訪問攝影機以使用姿態檢測功能')
      else showError('啟動失敗', error.message || '無法啟動攝影機')
    }
  }

  function updateSelectionStatus(isTracking, personNumber = null) {
    if (!selectionStatus || !selectionStatusText) return
    if (isTracking && personNumber) {
      selectionStatus.classList.add('tracking')
      selectionStatusText.textContent = `正在追蹤第 ${personNumber} 人`
      resetBtn.style.display = 'flex'
    } else {
      selectionStatus.classList.remove('tracking')
      selectionStatusText.textContent = '點擊畫面選擇要追蹤的人'
    }
  }

  function resetSelection() {
    if (!multiPersonSelector) return
    multiPersonSelector.reset()
    updateSelectionStatus(false)
    clearRecentActionsBuffer()
    setCurrentActionText('—')
    assessmentState.hasTrackedPerson = false
    resetAssessmentState({ keepDetection: true })
    setDetectionInfo({ modeText: '選擇中', trackedPersonText: '—', trackingDistanceText: '—' })
    if (movementDetector) movementDetector.clearHistory()
  }

  function stopDetection() {
    isDetecting = false
    stopCurrentActionTimer()
    clearRecentActionsBuffer()
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
    if (canvasResizeObserver) {
      canvasResizeObserver.disconnect()
      canvasResizeObserver = null
    }
    if (videoStream) {
      videoStream.getTracks().forEach((track) => track.stop())
      videoStream = null
    }
    if (videoElement.srcObject) videoElement.srcObject = null
    if (multiPersonSelector) {
      multiPersonSelector.detachFromCanvas()
      multiPersonSelector.reset()
    }
    const ctx = canvasElement.getContext('2d')
    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height)
    startBtn.style.display = 'flex'
    stopBtn.style.display = 'none'
    resetBtn.style.display = 'none'
    if (selectionStatus) selectionStatus.style.display = 'none'
    videoWrapper.classList.remove('active')
    setCurrentActionText('—')
    setDetectionInfo({ modeText: '未開始' })
    lastFrameTimestamp = 0
    smoothedFps = 0
    resetAssessmentState({ keepDetection: false })
  }

  async function detectLoop() {
    if (!isDetecting) return
    try {
      if (!poseDetector3D || !multiPersonSelector || !movementDetector || !poseRenderer) {
        throw new Error('Pose detection runtime is not fully initialized')
      }

      const nowTs = performance.now()
      const startTime = performance.now()
      const poseResults = await poseDetector3D.detectPose(videoElement)
      const ctx = canvasElement.getContext('2d')
      ctx.clearRect(0, 0, canvasElement.width, canvasElement.height)

      if (poseResults.detected && poseResults.keypoints.length > 0) {
        const allPersonsKeypoints = [poseResults.keypoints]
        const selectionResult = multiPersonSelector.processDetectedPersons(allPersonsKeypoints)

        const personCount = selectionResult.persons ? selectionResult.persons.length : 0
        let modeText = '—'
        if (selectionResult.mode === 'tracking') modeText = '追蹤中'
        else if (selectionResult.mode === 'selection') modeText = '選擇中'
        else if (selectionResult.mode === 'no-detection') modeText = '未偵測到人'

        const trackedText = selectionResult.selectedIndex >= 0 ? `第 ${selectionResult.selectedIndex + 1} 人` : '—'
        const distanceText = selectionResult.mode === 'tracking' && typeof selectionResult.trackingDistance === 'number'
          ? selectionResult.trackingDistance.toFixed(3)
          : '—'

        const now = performance.now()
        if (lastFrameTimestamp > 0) {
          const dt = now - lastFrameTimestamp
          if (dt > 0) {
            const instFps = 1000 / dt
            smoothedFps = smoothedFps ? smoothedFps * 0.9 + instFps * 0.1 : instFps
          }
        }
        lastFrameTimestamp = now

        multiPersonSelector.drawSelectionUI(ctx, canvasElement.width, canvasElement.height, selectionResult)

        let keypointsForAnalysis = null
        let shouldAnalyze = false
        if (selectionResult.mode === 'tracking' && selectionResult.selectedPerson) {
          keypointsForAnalysis = selectionResult.selectedPerson.keypoints
          shouldAnalyze = true
          assessmentState.hasTrackedPerson = true
          assessmentState.lastMode = 'tracking'
          poseRenderer.render({ ...poseResults, keypoints: keypointsForAnalysis }, canvasElement, { highlightColor: '#00ff00' })
        } else if (selectionResult.mode === 'selection') {
          poseRenderer.render(poseResults, canvasElement, { opacity: 0.6 })
          assessmentState.hasTrackedPerson = false
          assessmentState.lastMode = 'selection'
        }

        if (shouldAnalyze && keypointsForAnalysis) {
          const detectionResult = movementDetector.detectMovements(keypointsForAnalysis)
          const actions = detectionResult.actions || []
          if (actions.length > 0) {
            const primaryAction = actions[0]
            addToRecentActions(`${primaryAction.icon} ${primaryAction.nameZh || primaryAction.name}`)
          }
          updateAssessmentFromActions(actions, nowTs)
        } else {
          updateAssessmentUI()
        }

        const processingTime = performance.now() - startTime
        setDetectionInfo({
          modeText,
          personCountText: String(personCount),
          trackedPersonText: trackedText,
          trackingDistanceText: distanceText,
          fpsText: smoothedFps ? smoothedFps.toFixed(1) : '—',
          frameTimeText: `${processingTime.toFixed(1)}ms`,
        })
      }
    } catch (error) {
      console.error('Error in detection loop:', error)
    }
    animationFrameId = requestAnimationFrame(detectLoop)
  }

  function handleEscapeKey(event) {
    if (event.key === 'Escape') closeEvaluationModal()
  }

  function handleModalOverlayClick(event) {
    if (event.target === modalOverlay) closeEvaluationModal()
  }

  function handleResetAssessmentClick() {
    resetAssessmentState({ keepDetection: true })
  }

  function handleBeforeUnload() {
    stopDetection()
    if (poseDetector3D) poseDetector3D.close()
    if (multiPersonSelector) multiPersonSelector.destroy()
    if (movementDetector) movementDetector.destroy()
  }

  startBtn.addEventListener('click', startDetection)
  stopBtn.addEventListener('click', stopDetection)
  resetBtn.addEventListener('click', resetSelection)
  if (startTestBtn) startTestBtn.addEventListener('click', startAssessment)
  if (skipTestBtn) skipTestBtn.addEventListener('click', skipCurrentStep)
  if (resetTestBtn) resetTestBtn.addEventListener('click', handleResetAssessmentClick)
  if (closeModalBtn) closeModalBtn.addEventListener('click', closeEvaluationModal)
  if (modalOverlay) modalOverlay.addEventListener('click', handleModalOverlayClick)
  document.addEventListener('keydown', handleEscapeKey)
  window.addEventListener('beforeunload', handleBeforeUnload)

  updateAssessmentUI()
  window.setTimeout(fetchLatestPoseAssessmentRun, 600)

  return () => {
    startBtn.removeEventListener('click', startDetection)
    stopBtn.removeEventListener('click', stopDetection)
    resetBtn.removeEventListener('click', resetSelection)
    if (startTestBtn) startTestBtn.removeEventListener('click', startAssessment)
    if (skipTestBtn) skipTestBtn.removeEventListener('click', skipCurrentStep)
    if (resetTestBtn) resetTestBtn.removeEventListener('click', handleResetAssessmentClick)
    if (closeModalBtn) closeModalBtn.removeEventListener('click', closeEvaluationModal)
    if (modalOverlay) modalOverlay.removeEventListener('click', handleModalOverlayClick)
    document.removeEventListener('keydown', handleEscapeKey)
    window.removeEventListener('beforeunload', handleBeforeUnload)
    handleBeforeUnload()
  }
}
