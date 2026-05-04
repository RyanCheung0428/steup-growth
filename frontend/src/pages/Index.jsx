import { Link } from 'react-router-dom'

const FEATURES = [
  {
    icon: 'fa-robot',
    title: 'AI Intelligence',
    desc: 'Multi-modal AI coordinator analyzes child development data to provide personalized assessment and recommendations.',
  },
  {
    icon: 'fa-video',
    title: 'Video Analysis',
    desc: 'Upload videos to receive AI-driven movement recognition and developmental milestone tracking reports.',
  },
  {
    icon: 'fa-person-running',
    title: 'Pose Detection',
    desc: "Real-time camera capture and motion recognition to accurately assess children's gross motor development.",
  },
  {
    icon: 'fa-file-pdf',
    title: 'Document Parsing',
    desc: 'Upload PDF reports for AI to automatically extract key indicators and generate structured summaries.',
  },
]

const STATS = [
  { icon: 'fa-video', value: 'Upload + AI Review', label: 'Video Workflow' },
  { icon: 'fa-person-running', value: 'Real-time Capture', label: 'Pose Assessment' },
  { icon: 'fa-robot', value: 'Chat Support', label: 'AI Guidance' },
]

export default function Index() {
  return (
    <div className="min-h-screen bg-[var(--ae-bg)]">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div
            className="absolute -top-32 -right-32 w-[560px] h-[560px] rounded-full opacity-[0.07]"
            style={{ background: 'radial-gradient(circle, var(--ae-primary) 0%, transparent 70%)' }}
          />
          <div
            className="absolute -bottom-48 -left-24 w-[420px] h-[420px] rounded-full opacity-[0.05]"
            style={{ background: 'radial-gradient(circle, var(--ae-primary-soft) 0%, transparent 70%)' }}
          />
          {/* Geometric accent lines */}
          <svg className="absolute top-0 left-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
            <line x1="0" y1="0" x2="100%" y2="100%" stroke="var(--ae-primary)" strokeWidth="1" />
            <line x1="100%" y1="0" x2="0" y2="60%" stroke="var(--ae-primary)" strokeWidth="1" />
          </svg>
        </div>

        <div className="relative w-[min(calc(100%-40px),960px)] mx-auto pt-24 pb-28 md:pt-32 md:pb-36 text-center">
          <div className="animate-fade-in">
            <span className="ae-kicker">
              <i className="fas fa-seedling mr-1.5 text-[0.7rem]" />
              Child Development Intelligence
            </span>
          </div>

          <h1
            className="my-6 mx-auto max-w-[740px] leading-[1.05] -tracking-[0.04em] text-[clamp(2.4rem,5.5vw,4.5rem)] font-bold text-[var(--ae-text)] animate-slide-up"
            style={{ animationDelay: '0.08s' }}
          >
            Clinical support for motion review and guided follow-up.
          </h1>

          <p
            className="max-w-[560px] mx-auto text-[1.1rem] leading-[1.75] text-[var(--ae-text-muted)] animate-slide-up"
            style={{ animationDelay: '0.16s' }}
          >
            Run camera-based pose checks, review uploaded videos, and continue the case discussion with the AI assistant in one calmer workspace.
          </p>

          <div
            className="flex justify-center gap-3.5 flex-wrap mt-9 animate-slide-up"
            style={{ animationDelay: '0.24s' }}
          >
            <Link
              to="/login"
              className="ae-btn ae-btn--primary !px-7 !min-h-[50px] !text-[1rem] !rounded-[var(--ae-radius-lg)] !shadow-[0_4px_20px_rgba(101,94,78,0.25)] hover:!shadow-[0_6px_28px_rgba(101,94,78,0.35)]"
            >
              <i className="fas fa-arrow-right" />
              <span>Get Started</span>
            </Link>
            <a
              href="#features"
              className="ae-btn ae-btn--ghost !px-7 !min-h-[50px] !text-[1rem] !rounded-[var(--ae-radius-lg)] hover:bg-[var(--ae-surface)]"
              onClick={(e) => {
                e.preventDefault()
                document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              <i className="fas fa-circle-info" />
              <span>Learn More</span>
            </a>
          </div>
        </div>
      </section>

      {/* ── Stats ribbon ── */}
      <section className="relative border-y border-[var(--ae-border)] bg-[var(--ae-surface)]">
        <div className="w-[min(calc(100%-40px),1120px)] mx-auto py-10 md:py-14">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            {STATS.map((stat, i) => (
              <div
                key={stat.icon}
                className="flex items-center gap-4 md:justify-center animate-slide-up"
                style={{ animationDelay: `${0.1 + i * 0.08}s` }}
              >
                <div className="w-[52px] h-[52px] rounded-[var(--ae-radius-lg)] bg-[var(--ae-primary-faint)] text-[var(--ae-primary)] flex items-center justify-center text-xl flex-shrink-0">
                  <i className={`fas ${stat.icon}`} />
                </div>
                <div>
                  <div className="text-[1.35rem] font-bold -tracking-[0.03em] text-[var(--ae-text)]">
                    {stat.value}
                  </div>
                  <div className="text-sm text-[var(--ae-text-muted)] mt-0.5">
                    {stat.label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-20 md:py-28 bg-[var(--ae-surface-soft)]">
        <div className="w-[min(calc(100%-40px),1120px)] mx-auto">
          <div className="text-center mb-14 animate-fade-in">
            <span className="ae-kicker">Core Features</span>
            <h2 className="mt-3 mb-4 text-[clamp(1.6rem,3.5vw,2.2rem)] font-bold -tracking-[0.02em] text-[var(--ae-text)]">
              Comprehensive Assessment Tools
            </h2>
            <p className="max-w-[500px] mx-auto text-[var(--ae-text-muted)] leading-relaxed">
              Integrating multiple AI technologies to provide accurate and real-time child development assessment services.
            </p>
          </div>

          <div
            className="grid gap-6"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}
          >
            {FEATURES.map((feat, i) => (
              <div
                key={feat.icon}
                className="group relative bg-[var(--ae-surface)] border border-[var(--ae-border)] rounded-[var(--ae-radius-xl)] p-7 transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-[0_20px_48px_rgba(28,28,26,0.08)] hover:border-[var(--ae-border-strong)] animate-slide-up"
                style={{ animationDelay: `${0.1 + i * 0.08}s` }}
              >
                {/* Subtle top accent on hover */}
                <div className="absolute top-0 left-6 right-6 h-[3px] rounded-b-[var(--ae-radius-sm)] bg-[var(--ae-primary)] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />

                <div className="w-[56px] h-[56px] rounded-[var(--ae-radius-lg)] bg-[var(--ae-primary-faint)] text-[var(--ae-primary)] flex items-center justify-center text-[1.4rem] mb-5 transition-colors duration-300 group-hover:bg-[var(--ae-primary)] group-hover:text-white">
                  <i className={`fas ${feat.icon}`} />
                </div>
                <h3 className="!m-0 text-[1.1rem] font-semibold text-[var(--ae-text)] mb-2.5">
                  {feat.title}
                </h3>
                <p className="!m-0 text-[0.92rem] leading-[1.7] text-[var(--ae-text-muted)]">
                  {feat.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative overflow-hidden py-20 md:py-28">
        {/* Decorative gradient */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full opacity-[0.06]"
            style={{ background: 'radial-gradient(circle, var(--ae-primary) 0%, transparent 65%)' }}
          />
        </div>

        <div className="relative w-[min(calc(100%-40px),720px)] mx-auto text-center">
          <h2 className="text-[clamp(1.5rem,3.5vw,2rem)] font-bold -tracking-[0.02em] text-[var(--ae-text)] mb-4">
            Child Development Intelligence
          </h2>
          <p className="text-[1.05rem] leading-relaxed text-[var(--ae-text-muted)] mb-9 max-w-[480px] mx-auto">
            Run camera-based pose checks, review uploaded videos, and continue the case discussion with the AI assistant in one calmer workspace.
          </p>
          <div className="flex justify-center gap-3.5 flex-wrap">
            <Link
              to="/login"
              className="ae-btn ae-btn--primary !px-8 !min-h-[50px] !text-[1rem] !rounded-[var(--ae-radius-lg)] !shadow-[0_4px_20px_rgba(101,94,78,0.25)] hover:!shadow-[0_6px_28px_rgba(101,94,78,0.35)]"
            >
              <i className="fas fa-arrow-right" />
              <span>Get Started</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-10 text-center text-sm text-[var(--ae-text-muted)] border-t border-[var(--ae-border)]">
        <div className="w-[min(calc(100%-40px),1120px)] mx-auto flex items-center justify-between flex-wrap gap-4">
          <span className="font-medium">&copy; {new Date().getFullYear()} Steup Growth</span>
          <nav className="flex gap-5">
            <Link to="/login" className="hover:text-[var(--ae-text)] transition-colors">
              Log In
            </Link>
            <Link to="/login" className="hover:text-[var(--ae-text)] transition-colors">
              Sign Up
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
