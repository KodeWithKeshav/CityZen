import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { makeApiCall, apiClient } from '../../services/api'
import toast from 'react-hot-toast'
import { HiSearch, HiUsers, HiRefresh, HiChevronRight } from 'react-icons/hi'

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
      const rawArray = res.data?.citizens || res.data || []
      const dataArray = (Array.isArray(rawArray) ? rawArray : []).map(c => ({
        ...c,
        fullName: c.fullName || c.full_name,
        phoneNumber: c.phoneNumber || c.phone_number,
        createdAt: c.createdAt || c.created_at,
      }))
      if (res.success || Array.isArray(dataArray)) {
        setCitizens(dataArray)
        setFiltered(dataArray)
      }
    } catch (err) {
      toast.error('Failed to load registered citizens directory')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCitizens()
  }, [])

  useEffect(() => {
    if (!search.trim()) {
      setFiltered(citizens)
      return
    }
    const q = search.toLowerCase()
    setFiltered(
      citizens.filter(
        c =>
          (c.fullName || '').toLowerCase().includes(q) ||
          (c.email || '').toLowerCase().includes(q) ||
          (c.phoneNumber || '').includes(q) ||
          (c._id || c.id || '').toLowerCase().includes(q)
      )
    )
  }, [search, citizens])

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="border-b border-black pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs text-neutral-500 uppercase tracking-widest mb-1">
            <span>ADMINISTRATIVE DIRECTORY</span>
            <span>/</span>
            <span>VERIFIED CITIZENS</span>
            <span>/</span>
            <span className="text-black font-semibold">ROSTER</span>
          </div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-neutral-900 uppercase">
            Citizen Registry
          </h1>
          <p className="text-sm text-neutral-600 mt-1 font-sans">
            Authenticated municipal residents, identity records, and historical participation metrics.
          </p>
        </div>

        <button
          onClick={fetchCitizens}
          className="p-2 border border-neutral-300 hover:border-black transition-colors"
          title="Refresh Registry"
        >
          <HiRefresh className="w-4 h-4 text-neutral-800" />
        </button>
      </div>

      {/* Search Bar */}
      <div className="border border-neutral-200 bg-white p-4">
        <div className="relative">
          <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by full name, email, phone number, or ID..."
            className="w-full pl-9 pr-3 py-2 border border-neutral-300 rounded-none text-xs font-mono placeholder-neutral-400 focus:outline-none focus:border-black"
          />
        </div>

        <div className="flex justify-between items-center text-xs font-mono text-neutral-500 pt-2 mt-2 border-t border-neutral-100">
          <span>ENROLLED: <strong className="text-black">{filtered.length}</strong> OF {citizens.length} CITIZENS</span>
          <span>IDENTITY PROTOCOL: CIVIC ID SHA-256</span>
        </div>
      </div>

      {/* Table / List */}
      {loading ? (
        <div className="border border-neutral-200 p-8 text-center font-mono text-xs text-neutral-500 bg-white">
          LOADING CITIZEN CADASTRE...
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-neutral-300 bg-white p-12 text-center">
          <HiUsers className="w-10 h-10 text-neutral-400 mx-auto mb-3" />
          <h3 className="font-serif text-lg font-bold text-neutral-900 uppercase">
            No Citizen Records Found
          </h3>
          <p className="text-xs text-neutral-500 font-sans mt-1">
            No enrolled citizens match your search parameters.
          </p>
        </div>
      ) : (
        <div className="border border-neutral-200 bg-white overflow-x-auto">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-3 border-r border-neutral-200">CITIZEN IDENTITY</th>
                <th className="p-3 border-r border-neutral-200">EMAIL CONTACT</th>
                <th className="p-3 border-r border-neutral-200">PHONE</th>
                <th className="p-3 border-r border-neutral-200">PRIMARY RESIDENCE / WARD</th>
                <th className="p-3 border-r border-neutral-200">ENROLLED DATE</th>
                <th className="p-3 text-right">PROFILE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 text-neutral-800">
              {filtered.map(c => {
                const initial = (c.fullName || 'C').charAt(0).toUpperCase()
                const dateStr = c.createdAt
                  ? new Date(c.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : '—'

                return (
                  <tr
                    key={c._id || c.id}
                    onClick={() => navigate(`/admin/citizens/${c._id || c.id}`)}
                    className="hover:bg-neutral-50 cursor-pointer transition-colors"
                  >
                    <td className="p-3 border-r border-neutral-200">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 bg-neutral-900 text-white flex items-center justify-center font-mono font-bold text-xs flex-shrink-0">
                          {initial}
                        </div>
                        <span className="font-bold text-neutral-900 font-sans text-sm">
                          {c.fullName || 'Anonymous Resident'}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 border-r border-neutral-200 text-neutral-600">
                      {c.email || '—'}
                    </td>
                    <td className="p-3 border-r border-neutral-200 text-neutral-600">
                      {c.phoneNumber || '—'}
                    </td>
                    <td className="p-3 border-r border-neutral-200 text-neutral-500 max-w-xs truncate">
                      {c.address || 'Ward Unassigned'}
                    </td>
                    <td className="p-3 border-r border-neutral-200 text-neutral-500 whitespace-nowrap">
                      {dateStr}
                    </td>
                    <td className="p-3 text-right whitespace-nowrap font-bold">
                      <span className="text-black hover:underline inline-flex items-center gap-1 text-[11px]">
                        DOSSIER <HiChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
