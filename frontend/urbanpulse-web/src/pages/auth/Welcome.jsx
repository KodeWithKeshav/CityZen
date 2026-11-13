import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  HiUserGroup, HiShieldCheck, HiSparkles, HiLocationMarker,
  HiGlobeAlt, HiChartBar, HiThumbUp, HiMap
} from 'react-icons/hi'
import LanguageSwitcher from '../../components/LanguageSwitcher'

export default function Welcome() {
  const navigate = useNavigate()
  const { t } = useTranslation('auth')

  const features = [
    { icon: HiSparkles, title: t('welcome.features.aiValidation.title'), desc: t('welcome.features.aiValidation.desc') },
    { icon: HiLocationMarker, title: t('welcome.features.locationPriority.title'), desc: t('welcome.features.locationPriority.desc') },
    { icon: HiGlobeAlt, title: t('welcome.features.multilingual.title'), desc: t('welcome.features.multilingual.desc') },
    { icon: HiChartBar, title: t('welcome.features.transparency.title'), desc: t('welcome.features.transparency.desc') },
    { icon: HiThumbUp, title: t('welcome.features.voting.title'), desc: t('welcome.features.voting.desc') },
    { icon: HiMap, title: t('welcome.features.heatMap.title'), desc: t('welcome.features.heatMap.desc') },
  ]

  const stats = [
    { value: '6', label: t('welcome.stats.languages') },
    { value: '5', label: t('welcome.stats.aiServices') },
    { value: '3-STAGE', label: t('welcome.stats.workflow') },
    { value: '100%', label: t('welcome.stats.openSource') },
  ]

  const steps = [
    { step: '01', title: t('welcome.howItWorks.report.title'), desc: t('welcome.howItWorks.report.desc') },
    { step: '02', title: t('welcome.howItWorks.track.title'), desc: t('welcome.howItWorks.track.desc') },
    { step: '03', title: t('welcome.howItWorks.resolve.title'), desc: t('welcome.howItWorks.resolve.desc') },
  ]

  return (
    <div className="min-h-screen bg-surface-bright grid-bg">
      {/* ─── Navbar ─── */}
      <nav className="border-b border-black/10 bg-white">
        <div className="max-w-container mx-auto px-4 sm:px-8 lg:px-margin-lg py-3 sm:py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="CityZen" className="w-7 h-7 object-contain" />
            <span className="font-epilogue text-lg sm:text-xl font-bold tracking-tight text-on-surface">{t('welcome.brand')}</span>
            <span className="text-label-sm text-primary-400 border border-black/10 px-2 py-1 whitespace-nowrap">{t('welcome.version')}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <LanguageSwitcher />
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-xs sm:text-sm text-on-surface-variant hover:text-on-surface transition-colors px-3 sm:px-4 py-2 border border-transparent hover:border-black/10 whitespace-nowrap"
            >
              {t('welcome.signIn')}
            </button>
            <button
              type="button"
              onClick={() => navigate('/citizen/signup')}
              className="btn-primary text-xs py-2 px-3 sm:px-6 whitespace-nowrap"
            >
              {t('welcome.getStarted')}
            </button>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="py-12 sm:py-stack-lg px-4 sm:px-8 lg:px-margin-lg">
        <div className="max-w-4xl mx-auto text-center">
          {/* Logo mark */}
          <div className="w-28 h-28 sm:w-40 sm:h-40 border border-black/10 bg-white mx-auto mb-8 sm:mb-12 flex items-center justify-center p-3">
            <img src="/logo.png" alt="CityZen" className="w-full h-full object-contain" />
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-display-xl font-epilogue font-bold text-on-surface mb-6">
            {t('welcome.brand')}
          </h1>

          <div className="w-16 h-px bg-black/30 mx-auto mb-6" />

          <p className="text-base sm:text-body-lg text-on-surface-variant mb-10 sm:mb-16">
            {t('welcome.portalLabel')}
          </p>

          {/* Portal Entry Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-gutter max-w-2xl mx-auto mb-10 sm:mb-16">
            <button
              type="button"
              onClick={() => navigate('/citizen/signup')}
              className="card text-left hover:bg-surface-container-low transition-colors group p-6 sm:p-8"
            >
              <HiUserGroup className="w-8 h-8 text-on-surface mb-5 sm:mb-6" />
              <h3 className="font-epilogue text-lg font-semibold text-on-surface mb-2">{t('welcome.citizenPortal.title')}</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                {t('welcome.citizenPortal.desc')}
              </p>
              <span className="text-label-sm text-primary-400 mt-4 block group-hover:text-on-surface transition-colors">
                {t('welcome.citizenPortal.cta')}
              </span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/login')}
              className="card text-left hover:bg-surface-container-low transition-colors group p-6 sm:p-8"
            >
              <HiShieldCheck className="w-8 h-8 text-on-surface mb-5 sm:mb-6" />
              <h3 className="font-epilogue text-lg font-semibold text-on-surface mb-2">{t('welcome.adminPortal.title')}</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                {t('welcome.adminPortal.desc')}
              </p>
              <span className="text-label-sm text-primary-400 mt-4 block group-hover:text-on-surface transition-colors">
                {t('welcome.adminPortal.cta')}
              </span>
            </button>
          </div>

          <p className="text-label-sm text-primary-300 tracking-widest">
            {t('welcome.systemValidated')}
          </p>
        </div>
      </section>

      {/* ─── Stats ─── */}
      <section className="border-t border-black/10 py-8 sm:py-stack-md px-4 sm:px-8 lg:px-margin-lg bg-white">
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-gutter">
          {stats.map(s => (
            <div key={s.label} className="text-center">
              <p className="font-epilogue text-2xl sm:text-3xl font-bold text-on-surface">{s.value}</p>
              <p className="text-label-sm text-primary-400 mt-2">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Features ─── */}
      <section className="py-12 sm:py-stack-lg px-4 sm:px-8 lg:px-margin-lg">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8 sm:mb-stack-md">
            <h2 className="text-headline-lg font-epilogue text-on-surface mb-4">
              {t('welcome.builtFor.title')}
            </h2>
            <p className="text-body-md text-on-surface-variant max-w-xl mx-auto">
              {t('welcome.builtFor.desc')}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {features.map(f => (
              <div key={f.title} className="card p-5 sm:p-6 hover:bg-surface-container-low transition-colors">
                <f.icon className="w-6 h-6 text-on-surface mb-4" />
                <h3 className="text-label-sm text-on-surface mb-3">{f.title}</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section className="py-12 sm:py-stack-lg px-4 sm:px-8 lg:px-margin-lg border-y border-black/10 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8 sm:mb-stack-md">
            <h2 className="text-headline-lg font-epilogue text-on-surface mb-3">{t('welcome.howItWorks.title')}</h2>
            <p className="text-on-surface-variant">{t('welcome.howItWorks.subtitle')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-gutter">
            {steps.map(s => (
              <div key={s.step} className="text-center">
                <div className="w-12 h-12 border border-black/15 flex items-center justify-center mx-auto mb-4 text-label-sm text-on-surface">
                  {s.step}
                </div>
                <h3 className="font-epilogue font-bold text-lg mb-3 text-on-surface">{s.title}</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="py-12 sm:py-stack-lg px-4 sm:px-8 lg:px-margin-lg text-center">
        <h2 className="text-headline-lg font-epilogue text-on-surface mb-4">{t('welcome.cta.title')}</h2>
        <p className="text-on-surface-variant text-body-md mb-8 sm:mb-10 max-w-xl mx-auto">
          {t('welcome.cta.desc')}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center max-w-md sm:max-w-none mx-auto">
          <button
            type="button"
            onClick={() => navigate('/citizen/signup')}
            className="btn-primary px-8 py-3.5 sm:py-4 text-sm w-full sm:w-auto"
          >
            {t('welcome.cta.getStarted')}
          </button>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="btn-secondary px-8 py-3.5 sm:py-4 text-sm w-full sm:w-auto"
          >
            {t('welcome.cta.signIn')}
          </button>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-black/10 py-8 px-4 sm:px-8 lg:px-margin-lg text-center bg-white">
        <p className="text-label-sm text-primary-300 tracking-wider">
          {t('welcome.footer')}
        </p>
      </footer>
    </div>
  )
}
