import { useNavigate } from 'react-router-dom'
import { useI18n } from '../contexts/I18nContext'

const TASK_KEYS = [
  {
    path: '/video',
    icon: 'fa-video',
    titleKey: 'index.task.video.title',
    descKey: 'index.task.video.desc',
  },
  {
    path: '/pose-detection',
    icon: 'fa-person-running',
    titleKey: 'index.task.pose.title',
    descKey: 'index.task.pose.desc',
  },
  {
    path: '/chat',
    icon: 'fa-robot',
    titleKey: 'index.task.ai.title',
    descKey: 'index.task.ai.desc',
  },
]

export default function Home() {
  const navigate = useNavigate()
  const { t } = useI18n()

  return (
    <main className="w-[min(calc(100%-40px),1440px)] mx-auto py-8 md:py-12 pb-12 flex-1 grid gap-7 max-sm:w-[min(calc(100%-24px),1440px)]">
      {/* Hero Section */}
      <section
        className="ae-card grid gap-6 items-stretch"
        style={{ gridTemplateColumns: '1.3fr 0.9fr' }}
      >
        <div>
          <span className="ae-kicker">{t('index.hero.kicker')}</span>
          <h1
            className="my-[14px] mx-0 leading-[0.98] -tracking-[0.05em] text-[clamp(2.4rem,5vw,4.4rem)] font-bold"
          >
            {t('index.hero.title')}
          </h1>
          <p className="max-w-[640px] text-base leading-relaxed text-ae-textMuted">
            {t('index.hero.desc')}
          </p>
          <div className="flex gap-3.5 flex-wrap mt-[22px]">
            <button onClick={() => navigate('/video')} className="ae-btn">
              <i className="fas fa-video" />
              <span>{t('index.hero.btnVideo')}</span>
            </button>
            <button onClick={() => navigate('/chat')} className="ae-btn">
              <i className="fas fa-comments" />
              <span>{t('index.hero.btnChat')}</span>
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
          <Stat label={t('index.stat.video.label')} value={t('index.stat.video.value')} />
          <Stat label={t('index.stat.pose.label')} value={t('index.stat.pose.value')} />
          <Stat label={t('index.stat.ai.label')} value={t('index.stat.ai.value')} />
        </div>
      </section>

      {/* Workbench Cards */}
      <section
        className="grid gap-6"
        style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}
      >
        {TASK_KEYS.map((task) => (
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
            <h2 className="!m-0 text-lg font-semibold">{t(task.titleKey)}</h2>
            <p className="!m-0 text-[0.97rem] leading-[1.65] text-ae-textMuted">
              {t(task.descKey)}
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
