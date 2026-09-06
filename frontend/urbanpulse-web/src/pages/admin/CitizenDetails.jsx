import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { makeApiCall, apiClient } from '../../services/api'
import toast from 'react-hot-toast'
import { HiArrowLeft, HiExclamationCircle, HiDocumentText, HiChevronRight } from 'react-icons/hi'
import { format } from 'date-fns'

const STATUS_CONFIG = {
  pending: { label: 'PENDING', bg: 'bg-amber-50 text-amber-900 border-amber-300' },
  in_progress: { label: 'IN PROGRESS', bg: 'bg-blue-50 text-blue-900 border-blue-300' },
  resolved: { label: 'RESOLVED', bg: 'bg-emerald-50 text-emerald-900 border-emerald-300' },
  rejected: { label: 'REJECTED', bg: 'bg-rose-50 text-rose-900 border-rose-300' },
}

export default function CitizenDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [citizen, setCitizen] = useState(null)
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await makeApiCall(apiClient.admin.citizenById(id))
        if (res.success && res.data) {
          const rawCitizen = res.data.citizen || res.data
          setCitizen({
            ...rawCitizen,
            fullName: rawCitizen.fullName || rawCitizen.full_name,
            phoneNumber: rawCitizen.phoneNumber || rawCitizen.phone_number,
            createdAt: rawCitizen.createdAt || rawCitizen.created_at,
          })
          setComplaints(
            (res.data.complaints || []).map(c => ({
              ...c,
              createdAt: c.createdAt || c.created_at,
            }))
          )
        }
      } catch (err) {
        toast.error('Failed to load citizen profile dossier')
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [id])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 font-mono text-xs text-neutral-500 py-12">
        <div className="h-6 w-32 bg-neutral-200 animate-pulse" />
        <div className="border border-neutral-200 p-8 h-48 bg-white animate-pulse" />
      </div>
    )
  }

  if (!citizen) {
    return (
      <div className="max-w-xl mx-auto border border-neutral-300 bg-white p-12 text-center my-12">
        <HiExclamationCircle className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
        <h2 className="font-serif text-xl font-bold text-neutral-900 uppercase">
          Citizen Record Not Found
        </h2>
        <p className="text-xs text-neutral-500 font-sans mt-1">
          Identity record #{id} could not be retrieved from the municipal directory.
        </p>
        <button
          onClick={() => navigate(-1)}
          className="mt-6 px-4 py-2 bg-black text-white font-mono text-xs uppercase"
        >
          Return to Citizen Roster
        </button>
      </div>
    )
  }

  const initial = (citizen.fullName || 'C').charAt(0).toUpperCase()
  const dateStr = citizen.createdAt
    ? format(new Date(citizen.createdAt), 'yyyy-MM-dd HH:mm')
    : 'UNDATED'

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-neutral-700 hover:text-black border-b border-transparent hover:border-black transition-all pb-0.5"
      >
        <HiArrowLeft className="w-4 h-4" />
        <span>BACK TO CITIZEN ROSTER</span>
      </button>

      {/* Profile Card */}
      <div className="border border-neutral-200 bg-white">
        <div className="p-6 border-b border-neutral-200 flex flex-col sm:flex-row sm:items-center gap-4 bg-neutral-50">
          <div className="w-14 h-14 bg-black text-white flex items-center justify-center font-mono text-2xl font-bold flex-shrink-0">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-mono text-[10px] text-neutral-500 uppercase tracking-widest block mb-0.5">
              CITIZEN PROFILE RECORD · #{id}
            </span>
            <h1 className="font-serif text-2xl font-bold text-neutral-900 uppercase">
              {citizen.fullName || 'Anonymous Citizen'}
            </h1>
            <p className="text-xs font-mono text-neutral-600 mt-0.5">
              {citizen.email}
            </p>
          </div>
        </div>

        {/* Identity Details */}
        <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-neutral-200 divide-x divide-neutral-200 font-mono text-xs">
          <div className="p-4">
            <span className="text-neutral-500 uppercase text-[10px] block mb-1">PHONE NUMBER</span>
            <span className="font-bold text-neutral-900">{citizen.phoneNumber || 'Unregistered'}</span>
          </div>
          <div className="p-4">
            <span className="text-neutral-500 uppercase text-[10px] block mb-1">RESIDENCE / WARD</span>
            <span className="font-bold text-neutral-900 truncate block">
              {citizen.address || 'Ward Unassigned'}
            </span>
          </div>
          <div className="p-4">
            <span className="text-neutral-500 uppercase text-[10px] block mb-1">ENROLLED DATE</span>
            <span className="font-bold text-neutral-900">{dateStr}</span>
          </div>
          <div className="p-4">
            <span className="text-neutral-500 uppercase text-[10px] block mb-1">DISPATCHES FILED</span>
            <span className="font-bold text-neutral-900">{complaints.length} SUBMISSIONS</span>
          </div>
        </div>
      </div>

      {/* Citizen Complaint Submissions History */}
      <div className="border border-neutral-200 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-200 pb-3 font-mono text-xs">
          <div className="flex items-center gap-2">
            <HiDocumentText className="w-4 h-4 text-neutral-700" />
            <span className="font-bold uppercase tracking-wider text-neutral-900">
              DISPATCH FILING HISTORY ({complaints.length})
            </span>
          </div>
          <span className="text-neutral-400 text-[10px]">HISTORICAL RECORD</span>
        </div>

        {complaints.length === 0 ? (
          <div className="text-center py-10 font-mono text-xs text-neutral-400">
            NO DISPATCH RECORDS ON FILE FOR THIS CITIZEN.
          </div>
        ) : (
          <div className="divide-y divide-neutral-200 font-mono text-xs">
            {complaints.map(c => {
              const statusKey = (c.status || 'pending').toLowerCase()
              const statusInfo = STATUS_CONFIG[statusKey] || {
                label: (c.status || 'PENDING').toUpperCase(),
                bg: 'bg-neutral-100 text-neutral-800 border-neutral-300',
              }
              const timeStr = c.createdAt ? format(new Date(c.createdAt), 'yyyy-MM-dd') : '—'

              return (
                <div
                  key={c._id || c.id}
                  onClick={() => navigate(`/admin/complaints/${c._id || c.id}`)}
                  className="py-3 flex items-center justify-between gap-4 hover:bg-neutral-50 px-2 cursor-pointer transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-neutral-400 text-[10px]">
                        #{(c._id || c.id || '').slice(-6).toUpperCase()}
                      </span>
                      <span className={`px-2 py-0.5 border text-[9px] uppercase tracking-wider ${statusInfo.bg}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                    <h4 className="font-serif font-bold text-sm text-neutral-900 truncate">
                      {c.title || c.complaintTitle || 'Unclassified Hazard'}
                    </h4>
                    <p className="font-sans text-xs text-neutral-500 truncate mt-0.5">
                      {c.description}
                    </p>
                  </div>

                  <div className="text-right flex-shrink-0 text-neutral-500">
                    <div>{timeStr}</div>
                    <span className="text-neutral-900 font-bold hover:underline inline-flex items-center gap-1 text-[11px] mt-1">
                      AUDIT <HiChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
