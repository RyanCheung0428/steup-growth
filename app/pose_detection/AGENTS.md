# app/pose_detection/ — Pose Detection

MediaPipe-based real-time human pose detection and action recognition. 9 vanilla JS modules served as raw `<script>` tags + 1 Python backend scoring module.

## Files

| File | Lines | Purpose |
|------|-------|---------|
| `action_detector.js` | 1234 | Action/pose recognition engine (25+ actions: hand raise, leg lift, squat, lean, head turn, jumping jack, victory pose, etc.) |
| `pose_renderer.js` | 846 | Canvas rendering & skeleton overlay |
| `pose_detector_3d.js` | 554 | MediaPipe client-side 3D pose detection (`window.PoseDetector3D`) |
| `multi_person_selector.js` | 525 | Person selection UI & tracking lock (`window.MultiPersonSelector`) |
| `pose_error_handler.js` | 377 | Detection error handling & user notifications |
| `multi_person_detector.js` | 301 | Multi-person detection (`window.MultiPersonDetector`) |
| `movement_descriptor.js` | 256 | Natural language description generator (`window.MovementDescriptorGenerator`) |
| `movement_detector.js` | 204 | Movement event detection (`window.MovementDetector`) |
| `movement_analyzers.js` | 125 | Per-limb movement analysis (`window.MovementAnalyzers`) |
| `pose_assessment.py` | 164 | Backend scoring: `evaluate_pose_assessment()` |

**Total:** 4,585 lines across the directory.

## Architecture

### These are NOT npm/webpack modules

The JS files are plain `<script>` tags — they attach classes to `window.*`:

| `window` global | Source file |
|----------------|-------------|
| `window.PoseDetector3D` | `pose_detector_3d.js` |
| `window.ActionDetector` | `action_detector.js` |
| `window.MultiPersonSelector` | `multi_person_selector.js` |
| `window.MultiPersonDetector` | `multi_person_detector.js` |
| `window.MovementDetector` | `movement_detector.js` |
| `window.MovementDescriptorGenerator` | `movement_descriptor.js` |
| `window.MovementAnalyzers` | `movement_analyzers.js` |
| `window.PoseRenderer` | `pose_renderer.js` |

### How files are served

Flask serves them at `/pose_detection/js/<filename>` via `routes.py`:

```python
@bp.route('/pose_detection/js/<path:filename>')
def serve_pose_detection_js(filename):
    pose_detection_dir = os.path.join(os.path.dirname(__file__), 'pose_detection')
    return send_from_directory(pose_detection_dir, filename)
```

During development, Vite proxies `/pose_detection/js` → `http://localhost:5000`.

### How React loads them

**`frontend/src/pages/PoseDetection.jsx`** (236 lines):
1. Passes a full-screen loading overlay while scripts download
2. Loads CDN scripts first (socket.io, MediaPipe holistic + camera/drawing utils from jsdelivr)
3. Loads all 9 pose detection modules (in dependency order) via `loadScript()`
4. Calls `initPoseDetectionRuntime()` from `frontend/src/lib/poseDetectionRuntime.js`

**`frontend/src/lib/poseDetectionRuntime.js`** (968 lines) — the main orchestrator:
- Initializes `PoseDetector3D`, `MultiPersonSelector`, `MovementDetector`, `PoseRenderer` from `window`
- Manages webcam video stream via `getUserMedia`
- Runs `requestAnimationFrame` detection loop (optionally with multi-person selection)
- Implements a **10-step assessment system** (hold-based & rep-based actions)
- Handles assessment state machine (start → detect per-step → skip → complete → submit to backend)
- Submits assessment results to `POST /api/pose-assessment/runs` with JWT + refresh-token retry
- Renders the evaluation report modal with DQ score, per-step results, and advice
- Supports fetching/deleting the latest run via `GET/DELETE /api/pose-assessment/runs/latest`
- Cleans up on unmount: stops detection, removes event listeners, destroys pose objects

### DOM contract

The React component renders DOM elements with specific IDs. `poseDetectionRuntime.js` binds to these IDs directly:

| React-rendered ID | Runtime usage |
|-------------------|---------------|
| `poseVideo` | Webcam stream target |
| `poseCanvas` | Skeleton overlay canvas |
| `startBtn` / `stopBtn` / `resetBtn` | Detection controls |
| `selectionStatus` / `selectionStatusText` | Person selection feedback |
| `currentActionValue` | Live action name display |
| `detectionModeValue` / `detectedPersonCountValue` / `trackedPersonValue` / `trackingDistanceValue` / `fpsValue` / `frameTimeValue` | Detection info panel |
| `testProgressValue` / `testScoreValue` / `testHint` | Assessment progress |
| `startTestBtn` / `skipTestBtn` / `resetTestBtn` | Assessment controls |
| `testActionIcon` / `testActionName` / `testActionInstruction` | Current test action card |
| `modalOverlay` / `modalContent` / `modalBody` / `closeModalBtn` | Evaluation report modal |
| `evaluationPanel` / `evaluationSummary` / `evaluationDetails` | Evaluation display |
| `errorContainer` / `errorTitle` / `errorMessage` | Error display |

**Do not convert these JS modules to React / npm packages.** The vanilla JS references DOM elements by ID, which the React component renders as-is. The integration point is `window.*` globals, not module imports.

## Backend

### `pose_assessment.py` — `evaluate_pose_assessment(payload)`

- **Input**: Assessment run payload from frontend containing `steps[]` with `key`, `nameZh`, `status` (`completed`/`skipped`/`unknown`), `target` (`holdMs`/`repsTarget`), `achieved` (`holdMs`/`reps`), `durationMs`
- **Logic**: Determines pass/fail per step by comparing achieved vs target thresholds
- **Output**: Structured evaluation with:
  - `score`: `{completed, total, percent}`
  - `level`: `'優秀'` (≥90%), `'好'` (≥70%), `'普通'` (≥50%), `'需要改進'` (<50%)
  - `summaryZh`: Chinese-language summary
  - `steps[]`: per-step notes, advice, passed
  - `recommendations[]`: actionable tips (deduplicated)
  - `evaluatedAt`: Hong Kong time (UTC+8)

### API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/pose-assessment/runs` | Submit a completed assessment run |
| `GET` | `/api/pose-assessment/runs/latest` | Retrieve the most recent run |
| `DELETE` | `/api/pose-assessment/runs/latest` | Delete the most recent run |
| `GET` | `/api/pose-assessment/runs` | List recent runs (`?limit=N` param) |
| `GET` | `/api/pose-assessment/runs/<run_id>` | Fetch a specific run by ID |

### `PoseAssessmentRun` model (`app/models.py`)

Stores assessment metadata: user ID, run timestamps (HK time), step-by-step results, client score, and computed evaluation JSON.

### Known issue — `socket_events.py` stale import

`app/socket_events.py` (lines 514–523) attempts `from .pose_detection import PoseDetector, ActionRecognizer` at runtime. These classes do not exist in the Python package (`pose_detection/` has no `__init__.py`). The import is wrapped in `try/except` and emits a `pose_error` event on failure. This code path is unused in the current architecture.

## Assessment Steps

The 10-step assessment is defined in `poseDetectionRuntime.js`:

| # | Key | Name | Type | Target |
|---|-----|------|------|--------|
| 1 | `right_hand_up` | 右手舉起 | hold_any | 1.5s |
| 2 | `left_hand_up` | 左手舉起 | hold_any | 1.5s |
| 3 | `both_hands_up` | 雙手舉起 | hold_any | 1.5s |
| 4 | `left_leg_stand` | 左腳單腳站立 | hold_any | 2.0s |
| 5 | `right_leg_stand` | 右腳單腳站立 | hold_any | 2.0s |
| 6 | `jumping_jack` | 開合跳 | rep_single | 3 reps |
| 7 | `high_knees` | 高抬腿 | rep_alternating | 6 reps |
| 8 | `bend_left` | 向左彎腰 | hold_any | 1.5s |
| 9 | `bend_right` | 向右彎腰 | hold_any | 1.5s |
| 10 | `squat` | 深蹲 | rep_single | 3 reps |

## Anti-patterns

- **Do NOT convert JS files to npm/webpack modules.** They rely on `window.*` globals and are loaded as raw `<script>` tags.
- **Do NOT rename DOM element IDs.** The React component (`PoseDetection.jsx`) and the runtime (`poseDetectionRuntime.js`) depend on the exact IDs listed above.
- **Do NOT change script load order.** Dependencies require `pose_error_handler.js` → `pose_detector_3d.js` → multi-person modules → detection modules → renderer.
- **Do NOT add `__init__.py` to `pose_detection/`** without also creating `PoseDetector` and `ActionRecognizer` classes — the stale import in `socket_events.py` will pick it up.
