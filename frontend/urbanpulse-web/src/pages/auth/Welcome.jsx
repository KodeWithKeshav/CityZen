import { useNavigate } from 'react-router-dom'

export default function Welcome() {
  const navigate = useNavigate()
  return (
    <div className='min-h-screen bg-gray-950 text-white flex items-center justify-center'>
      <div className='text-center'>
        <h1 className='text-5xl font-extrabold mb-4'>UrbanPulse</h1>
        <p className='text-gray-400 mb-8'>Your Voice. Your City. Your Change.</p>
        <button onClick={() => navigate('/login')} className='bg-green-600 text-white px-6 py-3 rounded-xl font-bold'>Get Started</button>
      </div>
    </div>
  )
}