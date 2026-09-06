import { useNavigate } from 'react-router-dom'
import {
  HiUserGroup, HiShieldCheck, HiSparkles, HiLocationMarker,
  HiGlobeAlt, HiChartBar, HiThumbUp, HiMap
} from 'react-icons/hi'

const features = [
  { icon: HiSparkles, title: 'AI-POWERED VALIDATION', desc: 'Machine learning verifies civic issues with Roboflow image analysis before submission.' },
  { icon: HiLocationMarker, title: 'LOCATION PRIORITY', desc: 'Google Places API ranks complaints by proximity to critical civic infrastructure.' },
  { icon: HiGlobeAlt, title: 'MULTILINGUAL SUPPORT', desc: 'Submit voice complaints in Hindi, Tamil, Telugu and 7+ Indian languages via Sarvam AI.' },
  { icon: HiChartBar, title: 'TRANSPARENCY METRICS', desc: 'Live dashboards show resolution rates, category trends, and government responsiveness.' },
  { icon: HiThumbUp, title: 'COMMUNITY VOTING', desc: 'Citizens upvote complaints to push critical issues to the admin priority queue.' },
  { icon: HiMap, title: 'HEAT MAP INTELLIGENCE', desc: 'Geographic complaint clusters help authorities identify systemic problem zones.' },
]

const stats = [
  { value: '10+', label: 'LANGUAGES' },
  { value: '5', label: 'AI SERVICES' },
  { value: '3-STAGE', label: 'WORKFLOW' },
  { value: '100%', label: 'OPEN SOURCE' },
]

export default function Welcome() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-surface-bright grid-bg">
      {/* ─── Navbar ─── */}
      <nav className="border-b border-black/10 bg-white">
        <div className="max-w-container mx-auto px-margin-lg py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="CityZen" className="w-7 h-7 object-contain" />
            <span className="font-epilogue text-xl font-bold tracking-tight text-on-surface">CITYZEN</span>
            <span className="text-label-sm text-primary-400 border border-black/10 px-2 py-1">v1.0</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/login')}
              className="text-sm text-on-surface-variant hover:text-on-surface transition-colors px-4 py-2 border border-transparent hover:border-black/10"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate('/citizen/signup')}
              className="btn-primary text-xs py-2"
            >
              GET STARTED →
            </button>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="py-stack-lg px-margin-lg">
        <div className="max-w-4xl mx-auto text-center">
          {/* Logo mark */}
          <div className="w-40 h-40 border border-black/10 bg-white mx-auto mb-12 flex items-center justify-center p-3">
            <img src="/logo.png" alt="CityZen" className="w-full h-full object-contain" />
          </div>

          <h1 className="text-display-xl font-epilogue text-on-surface mb-6">
            CITYZEN
          </h1>

          <div className="w-16 h-px bg-black/30 mx-auto mb-6" />

          <p className="text-body-lg text-on-surface-variant mb-16">
            Institutional Portal
          </p>

          {/* Portal Entry Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-gutter max-w-2xl mx-auto mb-16">
            <button
              onClick={() => navigate('/citizen/signup')}
              className="card text-left hover:bg-surface-container-low transition-colors group p-8"
            >
              <HiUserGroup className="w-8 h-8 text-on-surface mb-6" />
              <h3 className="font-epilogue text-lg font-semibold text-on-surface mb-2">CITIZEN PORTAL</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                Submit and track civic complaints. Access community feed and transparency data.
              </p>
              <span className="text-label-sm text-primary-400 mt-4 block group-hover:text-on-surface transition-colors">
                ENTER →
              </span>
            </button>

            <button
              onClick={() => navigate('/login')}
              className="card text-left hover:bg-surface-container-low transition-colors group p-8"
            >
              <HiShieldCheck className="w-8 h-8 text-on-surface mb-6" />
              <h3 className="font-epilogue text-lg font-semibold text-on-surface mb-2">ADMIN ACCESS</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                Manage complaints, triage priority queue, and oversee citizen network.
              </p>
              <span className="text-label-sm text-primary-400 mt-4 block group-hover:text-on-surface transition-colors">
                AUTHENTICATE →
              </span>
            </button>
          </div>

          <p className="text-label-sm text-primary-300 tracking-widest">
            SYSTEM ARCHITECTURE VALIDATED
          </p>
        </div>
      </section>

      {/* ─── Stats ─── */}
      <section className="border-t border-black/10 py-stack-md px-margin-lg bg-white">
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-gutter">
          {stats.map(s => (
            <div key={s.label} className="text-center">
              <p className="font-epilogue text-3xl font-bold text-on-surface">{s.value}</p>
              <p className="text-label-sm text-primary-400 mt-2">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Features ─── */}
      <section className="py-stack-lg px-margin-lg">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-stack-md">
            <h2 className="text-headline-lg font-epilogue text-on-surface mb-4">
              Built for real civic impact
            </h2>
            <p className="text-body-md text-on-surface-variant max-w-xl mx-auto">
              Every feature is purpose-built to make citizen reporting faster, smarter, and more transparent.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(f => (
              <div key={f.title} className="card p-6 hover:bg-surface-container-low transition-colors">
                <f.icon className="w-6 h-6 text-on-surface mb-4" />
                <h3 className="text-label-sm text-on-surface mb-3">{f.title}</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section className="py-stack-lg px-margin-lg border-y border-black/10 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-stack-md">
            <h2 className="text-headline-lg font-epilogue text-on-surface mb-3">How it works</h2>
            <p className="text-on-surface-variant">Three steps from problem to resolution</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-gutter">
            {[
              { step: '01', title: 'REPORT', desc: 'Snap a photo, add a description, and let AI validate your complaint. Location-based priority is calculated automatically.' },
              { step: '02', title: 'TRACK', desc: 'Watch your complaint move through a 3-stage workflow. Upvote other complaints to push critical issues higher.' },
              { step: '03', title: 'RESOLVE', desc: 'Officials respond, officers are assigned, and you get real-time updates. Rating and feedback close the loop.' },
            ].map(s => (
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
      <section className="py-stack-lg px-margin-lg text-center">
        <h2 className="text-headline-lg font-epilogue text-on-surface mb-4">Ready to make a difference?</h2>
        <p className="text-on-surface-variant text-body-md mb-10 max-w-xl mx-auto">
          Join thousands of citizens already using CityZen to improve their city.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => navigate('/citizen/signup')}
            className="btn-primary px-8 py-4 text-sm"
          >
            GET STARTED — IT'S FREE →
          </button>
          <button
            onClick={() => navigate('/login')}
            className="btn-secondary px-8 py-4 text-sm"
          >
            SIGN IN
          </button>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-black/10 py-8 px-margin-lg text-center bg-white">
        <p className="text-label-sm text-primary-300 tracking-wider">
          © 2026 CITYZEN · BUILT FOR BETTER CITIES · POWERED BY SUPABASE, ROBOFLOW, SARVAM AI & HUGGINGFACE
        </p>
      </footer>
    </div>
  )
}
