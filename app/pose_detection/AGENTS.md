# app/pose_detection/ — Pose Detection

MediaPipe-based pose detection. 10 vanilla JS modules + 1 Python scoring module.

## Files

| File | Lines | Purpose |
|------|-------|---------|
| `pose_error_handler.js` | — | Error handling |
| `pose_detector_3d.js` | — | 3D pose detection |
| `multi_person_detector.js` | — | Multi-person detection |
| `multi_person_selector.js` | — | Person selection |
| `action_detector.js` | — | Action recognition |
| `movement_analyzers.js` | — | Movement analysis |
| `movement_detector.js` | — | Movement detection |
| `movement_descriptor.js` | — | Movement description |
| `pose_renderer.js` | — | Canvas rendering |
| `pose_assessment.py` | 164 | Backend scoring: `evaluate_pose_assessment()` |

## Architecture quirk

**These are NOT npm/webpack modules.** They're served as raw `<script>` tags from Flask at `/pose_detection/js/*`. The React component (`PoseDetection.jsx`) renders matching DOM IDs and loads:

1. MediaPipe CDN: holistic, camera_utils, control_utils, drawing_utils
2. Flask modules above (in order)
3. Main orchestrator: `/static/js/pose_detection.js` (1320 lines)

**Do not convert to React.** The vanilla JS references DOM elements by ID, which the React component renders as-is.

## Backend

- `pose_assessment.py`: evaluates assessment runs (submitted via `POST /api/pose-assessment/runs`)
- Returns structured report: per-step notes, advice, recommendations, overall score
- Model: `PoseAssessmentRun` in `app/models.py`
