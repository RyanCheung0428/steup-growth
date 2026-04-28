import { useNavigate } from 'react-router-dom'

const TASKS = [
  {
    path: '/video',
    icon: 'fa-video',
    title: 'Video Analysis',
    desc: 'Upload a session video, review transcription progress, inspect timestamps, and export the analysis output.',
  },
  {
    path: '/pose-detection',
    icon: 'fa-person-running',
    title: 'Pose Detection',
    desc: 'Run a live capture workflow, choose the tracked child, and review action recognition with test results.',
  },
  {
    path: '/chat',
    icon: 'fa-robot',
    title: 'AI Guidance',
    desc: 'Discuss uploaded files, summarize reports, and ask targeted follow-up questions in the consultation workspace.',
  },
]

export default function Home() {
  const navigate = useNavigate()

  return (
    <main className="w-[min(calc(100%-40px),1440px)] mx-auto py-8 md:py-12 pb-12 flex-1 grid gap-7 max-sm:w-[min(calc(100%-24px),1440px)]">
      {/* Hero Section */}
      <section
        className="ae-card grid gap-6 items-stretch"
        style={{ gridTemplateColumns: '1.3fr 0.9fr' }}
      >
        <div>
          <span className="ae-kicker">Child Development Intelligence</span>
          <h1
            className="my-[14px] mx-0 leading-[0.98] -tracking-[0.05em] text-[clamp(2.4rem,5vw,4.4rem)] font-bold"
          >
            Clinical support for motion review and guided follow-up.
          </h1>
          <p className="max-w-[640px] text-base leading-relaxed text-ae-textMuted">
            Run camera-based pose checks, review uploaded videos, and continue the case
            discussion with the AI assistant in one calmer workspace.
          </p>
          <div className="flex gap-3.5 flex-wrap mt-[22px]">
            <button onClick={() => navigate('/video')} className="ae-btn">
              <i className="fas fa-video" />
              <span>Video Analysis</span>
            </button>
            <button onClick={() => navigate('/chat')} className="ae-btn">
              <i className="fas fa-comments" />
              <span>Open AI Chat</span>
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
          <Stat label="Video Workflow" value="Upload + AI Review" />
          <Stat label="Pose Session" value="Live Capture" />
          <Stat label="AI Guidance" value="Chat Support" />
        </div>
      </section>

      {/* Workbench Cards */}
      <section
        className="grid gap-6"
        style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}
      >
        {TASKS.map((task) => (
          <article
            key={task.path}
            onClick={() => navigate(task.path)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') navigate(task.path) }}
            className="ae-card cursor-pointer min-h-[220px] grid content-start gap-3 hover:-translate-y-0.5 hover:border-ae-borderStrong transition-all duration-200"
          >
            <div className="w-[52px] h-[52px] rounded-xl inline-flex items-center justify-center bg-[#ece1cd] text-[#655e4e] text-xl">
              <i className={`fas ${task.icon}`} />
            </div>
            <h2 className="!m-0 text-lg font-semibold">{task.title}</h2>
            <p className="!m-0 text-[0.97rem] leading-[1.65] text-ae-textMuted">
              {task.desc}
            </p>
          </article>
        ))}
      </section>
    </main>
  )
}

function Stat({ label, value }) {
  return (
    <div className="p-4 rounded-2xl border border-ae-border bg-ae-surfaceSoft">
      <span className="block text-ae-textMuted text-[0.82rem] mb-2 uppercase tracking-[0.08em]">
        {label}
      </span>
      <span className="text-[1.8rem] font-bold -tracking-[0.04em]">{value}</span>
    </div>
  )
}
