import { useI18n } from '../../contexts/I18nContext'

export default function WelcomeScreen() {
  const { t } = useI18n()

  return (
    <div id="welcome-screen" style={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '28px',
    }}>
      <div className="welcome-content" style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: '16px',
        maxWidth: '620px',
      }}>
        <div className="welcome-avatar-circle" style={{
          width: '76px',
          height: '76px',
          borderRadius: '999px',
          background: 'var(--ae-primary-faint)',
          color: 'var(--ae-primary)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.8rem',
        }}>
          <i className="fas fa-stethoscope" />
        </div>
        <h2 className="welcome-title" style={{ margin: 0 }}>
          Steup Growth AI
        </h2>
        <p className="welcome-subtitle" style={{ margin: 0, color: 'var(--ae-text-muted)' }}>
          {t('welcomeMsg', '您好！我是專注於幼兒成長分析的兒童發育陪伴者。')}
        </p>
        <div className="welcome-capabilities" style={{
          display: 'flex',
          gap: '10px',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}>
          <div className="welcome-capability" style={{
            padding: '9px 12px',
            border: '1px solid var(--ae-border)',
            borderRadius: '999px',
            background: 'var(--ae-surface-soft)',
            color: 'var(--ae-text-muted)',
            fontSize: '0.9rem',
          }}>
            {t('welcome.capability.review', '回顧上傳的影片')}
          </div>
          <div className="welcome-capability" style={{
            padding: '9px 12px',
            border: '1px solid var(--ae-border)',
            borderRadius: '999px',
            background: 'var(--ae-surface-soft)',
            color: 'var(--ae-text-muted)',
            fontSize: '0.9rem',
          }}>
            {t('welcome.capability.summarize', '總結姿態分析結果')}
          </div>
          <div className="welcome-capability" style={{
            padding: '9px 12px',
            border: '1px solid var(--ae-border)',
            borderRadius: '999px',
            background: 'var(--ae-surface-soft)',
            color: 'var(--ae-text-muted)',
            fontSize: '0.9rem',
          }}>
            {t('welcome.capability.explain', '為家長解釋報告')}
          </div>
        </div>
      </div>
    </div>
  )
}