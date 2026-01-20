import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

const features = [
  {
    icon: '🤖',
    title: 'AI-Powered Validation',
    desc: 'Roboflow image analysis verifies civic issues with machine learning before submission.',
    color: 'from-violet-500 to-purple-600',
  },
  {
    icon: '📍',
    title: 'Location Priority Scoring',
    desc: 'Google Places API ranks complaints by proximity to hospitals, schools, and civic infrastructure.',
    color: 'from-blue-500 to-cyan-600',
  },
  {
    icon: '🌍',
    title: 'Multilingual Support',
    desc: 'Submit voice complaints in Hindi, Tamil, Telugu and 7 more Indian languages via Sarvam AI.',
    color: 'from-green-500 to-emerald-600',
  },
  {
    icon: '📊',
    title: 'Real-Time Transparency',
    desc: 'Live dashboards show resolution rates, category trends, and government responsiveness metrics.',
    color: 'from-orange-500 to-amber-600',
  },
  {
    icon: '🗳️',
    title: 'Community Voting',
    desc: 'Citizens upvote complaints to push critical issues to the top of the admin priority queue.',
    color: 'from-pink-500 to-rose-600',
  },
  {
    icon: '🗺️',
    title: 'Heat Map Intelligence',
    desc: 'Geographic complaint clusters help authorities identify systemic problem zones across the city.',
    color: 'from-teal-500 to-green-600',
  },
]

const stats = [
  { value: '10+', label: 'Languages supported' },
  { value: '5', label: 'AI services integrated' },
  { value: '3-Stage', label: 'Resolution workflow' },
  { value: '100%', label: 'Open source' },
]

export default function Welcome() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-950 text-white overflow-x-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-gray-950/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏙️</span>
            <span className="font-bold text-xl text-white">UrbanPulse</span>
            <span className="hidden sm:inline ml-2 text-xs font-medium bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full border border-green-500/30">v1.0 Beta</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/login')}
              className="text-sm text-gray-300 hover:text-white transition-colors px-4 py-2 rounded-lg hover:bg-white/5"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate('/citizen/signup')}
              className="text-sm font-semibold bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg transition-all duration-200 shadow-lg shadow-green-900/40"
            >
              Get Started →
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center pt-20">
        {/* Bg gradient orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-40 w-96 h-96 bg-green-700/20 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 -right-40 w-96 h-96 bg-blue-700/20 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-900/10 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2 text-sm text-gray-400 mb-8">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Civic complaint platform powered by AI
            </div>

            <h1 className="text-5xl sm:text-7xl font-extrabold mb-6 leading-tight">
              Your Voice.{' '}
              <span className="bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
                Your City.
              </span>
              <br />Your Change.
            </h1>

            <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              UrbanPulse lets citizens report civic issues with AI-powered image validation,
              location-based prioritization, and real-time government transparency tracking.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => navigate('/citizen/signup')}
                className="w-full sm:w-auto bg-green-600 hover:bg-green-500 text-white font-bold px-8 py-4 rounded-2xl text-lg transition-all duration-200 shadow-xl shadow-green-900/40 hover:shadow-green-900/60 hover:-translate-y-0.5"
              >
                Report an Issue 📢
              </button>
              <button
                onClick={() => navigate('/login')}
                className="w-full sm:w-auto border border-white/15 hover:border-white/30 text-gray-300 hover:text-white font-semibold px-8 py-4 rounded-2xl text-lg transition-all duration-200 hover:bg-white/5"
              >
                Admin Portal →
              </button>
            </div>
          </motion.div>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-20 border-t border-white/10 pt-12"
          >
            {stats.map(s => (
              <div key={s.label}>
                <p className="text-3xl font-extrabold text-white">{s.value}</p>
                <p className="text-sm text-gray-500 mt-1">{s.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Built for real civic impact
          </h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            Every feature is purpose-built to make citizen reporting faster, smarter, and more transparent.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="group bg-white/5 border border-white/10 hover:border-white/20 rounded-2xl p-6 transition-all duration-300 hover:bg-white/8"
            >
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${f.color} flex items-center justify-center text-2xl mb-4 shadow-lg`}>
                {f.icon}
              </div>
              <h3 className="font-bold text-white text-lg mb-2">{f.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold mb-3">How it works</h2>
            <p className="text-gray-400">Three steps from problem to resolution</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Report', desc: 'Snap a photo, add a description, and let AI validate your complaint. Location-based priority is calculated automatically.', icon: '📸' },
              { step: '02', title: 'Track', desc: 'Watch your complaint move through a 3-stage workflow. Upvote other complaints to push critical issues higher.', icon: '📈' },
              { step: '03', title: 'Resolve', desc: 'Officials respond, officers are assigned, and you get real-time updates. Rating and feedback close the loop.', icon: '✅' },
            ].map(s => (
              <div key={s.step} className="text-center">
                <div className="text-5xl mb-4">{s.icon}</div>
                <div className="text-xs font-mono text-green-500 mb-1">{s.step}</div>
                <h3 className="font-bold text-xl mb-2">{s.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-4xl font-bold mb-4">Ready to make a difference?</h2>
          <p className="text-gray-400 text-lg mb-10">
            Join thousands of citizens already using UrbanPulse to improve their city.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/citizen/signup')}
              className="bg-green-600 hover:bg-green-500 text-white font-bold px-8 py-4 rounded-2xl transition-all duration-200 shadow-xl shadow-green-900/40 hover:-translate-y-0.5"
            >
              Get Started – It's Free →
            </button>
            <button
              onClick={() => navigate('/login')}
              className="border border-white/15 hover:border-white/30 text-gray-300 hover:text-white font-semibold px-8 py-4 rounded-2xl transition-all duration-200"
            >
              Sign In
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-6 text-center text-gray-600 text-sm">
        <p>© 2026 UrbanPulse · Built with ❤️ for better cities · Powered by Supabase, Roboflow, Sarvam AI &amp; HuggingFace</p>
      </footer>
    </div>
  )
}
