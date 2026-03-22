// CitizenManagement - Admin view for managing registered citizens
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { makeApiCall, apiClient } from '../../services/api'
import toast from 'react-hot-toast'
import { HiSearch, HiUsers, HiRefresh } from 'react-icons/hi'

export default function CitizenManagement() {
  const [citizens, setCitizens] = useState([])
  const [filtered, setFiltered] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  const fetchCitizens = async () => {
    setLoading(true)
    try {
      const res = await makeApiCall(apiClient.admin.citizens)
      const dataArray = res.data?.citizens || res.data || []
      if (res.success || Array.isArray(dataArray)) {
        setCitizens(dataArray)
        setFiltered(dataArray)
      }
    } catch (err) {
      toast.error('Failed to load citizens')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCitizens() }, [])

  useEffect(() => {
    if (!search) { setFiltered(citizens); return }
    const q = search.toLowerCase()
    setFiltered(citizens.filter(c =>
      (c.fullName || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.phoneNumber || '').includes(q)
    ))
  }, [search, citizens])

  return (
    <div className="p-4 max-w-5xl mx-auto pb-8 fade-in">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Citizens</h1>
          <p className="text-sm text-gray-500">{filtered.length} of {citizens.length} registered</p>
        </div>
        <button onClick={fetchCitizens} className="p-2.5 rounded-xl hover:bg-gray-100">
          <HiRefresh className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      <div className="relative mb-5">
        <HiSearch className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email..." className="input pl-10" />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="h-16 skeleton rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-gray-400">
          <HiUsers className="w-12 h-12 mb-3" />
          <p>No citizens found</p>
        </div>
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden md:block card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Citizen', 'Email', 'Phone', 'Address', 'Joined', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(c => (
                  <tr key={c._id || c.id} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => navigate(`/admin/citizens/${c._id || c.id}`)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center font-bold text-violet-700 text-sm flex-shrink-0">
                          {c.fullName?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <p className="font-medium text-gray-900">{c.fullName || 'â€”'}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.email || 'â€”'}</td>
                    <td className="px-4 py-3 text-gray-600">{c.phoneNumber || 'â€”'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-[160px] truncate">{c.address || 'â€”'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'â€”'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-admin-600 text-xs font-medium">View â†’</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden space-y-3">
            {filtered.map(c => (
              <div key={c._id || c.id} className="card hover:shadow-md transition cursor-pointer" onClick={() => navigate(`/admin/citizens/${c._id || c.id}`)}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center font-bold text-violet-700">
                    {c.fullName?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{c.fullName || 'â€”'}</p>
                    <p className="text-xs text-gray-500">{c.email}</p>
                    {c.phoneNumber && <p className="text-xs text-gray-400">{c.phoneNumber}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
