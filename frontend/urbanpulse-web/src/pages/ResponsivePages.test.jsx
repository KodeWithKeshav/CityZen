import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import CitizenLayout from '../layouts/CitizenLayout'
import AdminLayout from '../layouts/AdminLayout'
import FloatingChat from '../components/FloatingChat'
import CitizenDashboard from './citizen/CitizenDashboard'
import ComplaintFeed from './citizen/ComplaintFeed'
import SubmitComplaint from './citizen/SubmitComplaint'
import PersonalReports from './citizen/PersonalReports'
import FeedbackScreen from './citizen/FeedbackScreen'
import Transparency from './citizen/Transparency'
import Chatbot from './citizen/Chatbot'
import ComplaintDetail from './citizen/ComplaintDetail'
import ComplaintMap from './citizen/ComplaintMap'
import AdminDashboard from './admin/AdminDashboard'
import AdminComplaints from './admin/AdminComplaints'
import AdminComplaintDetail from './admin/AdminComplaintDetail'
import AdminComplaintMap from './admin/AdminComplaintMap'
import PriorityQueue from './admin/PriorityQueue'
import CitizenManagement from './admin/CitizenManagement'
import CitizenDetails from './admin/CitizenDetails'
import CitizenSignup from './auth/CitizenSignup'
import AdminSignup from './auth/AdminSignup'
import * as AuthContext from '../context/AuthContext'
import * as ChatContext from '../context/ChatContext'
import * as api from '../services/api'

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}))

vi.mock('react-chartjs-2', () => ({
  Bar: () => <div data-testid="mock-bar-chart" />,
  Doughnut: () => <div data-testid="mock-doughnut-chart" />,
}))

vi.mock('leaflet', () => {
  const fn = () => ({})
  const L = {
    Icon: { Default: { prototype: { _getIconUrl: fn }, mergeOptions: vi.fn() } },
    latLngBounds: vi.fn(() => ({ isValid: () => true })),
    heatLayer: vi.fn(() => ({ addTo: vi.fn() })),
  }
  return { default: L }
})

vi.mock('leaflet.heat', () => ({}))

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="mock-leaflet-map">{children}</div>,
  TileLayer: () => null,
  Popup: ({ children }) => <div>{children}</div>,
  CircleMarker: ({ children }) => <div>{children}</div>,
  useMap: () => ({
    setView: vi.fn(),
    fitBounds: vi.fn(),
    removeLayer: vi.fn(),
  }),
  useMapEvents: () => null,
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}))

vi.mock('../context/ChatContext', () => ({
  useChatContext: vi.fn(),
}))

vi.mock('../services/api', async () => {
  const actual = await vi.importActual('../services/api')
  return {
    ...actual,
    makeApiCall: vi.fn(),
  }
})

const sampleComplaint = {
  id: 'cmp-123456',
  _id: 'cmp-123456',
  title: 'Large pothole on MG Road',
  description: 'Deep asphalt depression blocking traffic lane near intersection.',
  category: 'pothole',
  status: 'pending',
  priority: 'high',
  priorityScore: 84,
  votes: 12,
  createdAt: '2026-10-01T10:00:00Z',
  citizenName: 'Asha Verma',
  location: { address: 'MG Road, Sector 4', lat: 12.9716, lng: 77.5946 },
}

const sampleCitizen = {
  id: 'cit-001',
  _id: 'cit-001',
  fullName: 'Asha Verma',
  email: 'asha@example.com',
  phoneNumber: '+91 9876543210',
  address: 'Ward 12, Indiranagar',
  createdAt: '2026-09-15T08:30:00Z',
}

describe('Responsive Layouts & Pages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Element.prototype.scrollIntoView = vi.fn()
    AuthContext.useAuth.mockReturnValue({
      user: { id: 'usr-1', fullName: 'Test User', email: 'test@example.com', userType: 'citizen' },
      logout: vi.fn(),
    })
    ChatContext.useChatContext.mockReturnValue({
      messages: [{ id: 'm1', role: 'assistant', text: 'Hello! How can I help?', source: 'knowledge_base' }],
      loading: false,
      followUps: ['How do I submit a complaint?'],
      isMinimised: false,
      hasUnread: false,
      sendMessage: vi.fn(),
      openChat: vi.fn(),
      closeChat: vi.fn(),
      clearChat: vi.fn(),
      executeNav: vi.fn(),
      registerNavigator: vi.fn(),
    })
    api.makeApiCall.mockImplementation(async (url) => {
      if (url.includes('/personal-reports')) {
        return { success: true, data: { complaints: [sampleComplaint], stats: { pending: 1, resolved: 0, totalComplaints: 1 } } }
      }
      if (url.includes('/complaints/all')) {
        return { success: true, complaints: [sampleComplaint] }
      }
      if (url.includes('/complaint-details/') && url.includes('/progress')) {
        return { success: true, data: { stages: [{ stage_name: 'LOGGED', stage_description: 'Logged', updated_at: '2026-10-01T10:00:00Z' }] } }
      }
      if (url.includes('/complaint-details/') || url.includes('/admin/complaints/')) {
        return { success: true, data: sampleComplaint, complaint: sampleComplaint }
      }
      if (url.includes('/admin/dashboard')) {
        return {
          success: true,
          data: {
            overview: { total: 10, resolved: 4, pending: 4, inProgress: 2, resolutionRate: 40 },
            users: { citizens: 25 },
            topComplaints: [sampleComplaint],
          },
        }
      }
      if (url.includes('/priority-queue')) {
        return { success: true, data: { complaints: [sampleComplaint] } }
      }
      if (url.includes('/citizens/') && url.includes('/details')) {
        return { success: true, data: { citizen: sampleCitizen, complaints: [sampleComplaint] } }
      }
      if (url.includes('/citizens')) {
        return { success: true, data: { citizens: [sampleCitizen] } }
      }
      if (url.includes('/heat-map') || url.includes('/heatmap')) {
        return {
          success: true,
          data: {
            points: [{ ...sampleComplaint, lat: 12.9716, lng: 77.5946 }],
            statistics: { total: 1, resolved: 0, resolutionRate: 0 },
          },
        }
      }
      if (url.includes('/transparency')) {
        return {
          success: true,
          data: {
            complaints: { total: 10, resolved: 4, pending: 4, inProgress: 2, resolutionRate: 40, avgResolutionDays: 2.5 },
            categoryStats: [{ name: 'pothole', total: 5 }],
          },
        }
      }
      return { success: true, data: {} }
    })
  })

  it('toggles mobile navigation drawer in CitizenLayout', () => {
    render(
      <MemoryRouter initialEntries={['/citizen/dashboard']}>
        <Routes>
          <Route path="/citizen" element={<CitizenLayout />}>
            <Route path="dashboard" element={<div>Citizen Home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getAllByRole('button', { name: /close navigation/i })).toHaveLength(1)
    const openBtn = screen.getByRole('button', { name: /open navigation/i })
    fireEvent.click(openBtn)
    const closeBtns = screen.getAllByRole('button', { name: /close navigation/i })
    expect(closeBtns).toHaveLength(2)
    fireEvent.click(closeBtns[0])
    expect(screen.getAllByRole('button', { name: /close navigation/i })).toHaveLength(1)
  })

  it('toggles mobile navigation drawer and popover in AdminLayout', () => {
    AuthContext.useAuth.mockReturnValue({
      user: { id: 'adm-1', fullName: 'Admin User', email: 'admin@example.com', userType: 'admin' },
      logout: vi.fn(),
    })

    render(
      <MemoryRouter initialEntries={['/admin/dashboard']}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="dashboard" element={<div>Admin Home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getAllByRole('button', { name: /close navigation/i })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: /open navigation/i }))
    const closeBtns = screen.getAllByRole('button', { name: /close navigation/i })
    expect(closeBtns).toHaveLength(2)
    fireEvent.click(closeBtns[0])
    expect(screen.getAllByRole('button', { name: /close navigation/i })).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
    expect(screen.getByText(/Notifications/i)).toBeInTheDocument()
  })

  it('renders FloatingChat with responsive mobile-safe positioning classes', () => {
    const { container } = render(
      <MemoryRouter>
        <FloatingChat />
      </MemoryRouter>
    )
    const panel = container.querySelector('.fixed.bottom-20.right-3.left-3')
    expect(panel).toBeInTheDocument()
  })

  it('renders Auth signup pages cleanly', () => {
    render(<MemoryRouter><CitizenSignup /></MemoryRouter>)
    expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument()
    cleanup()

    render(<MemoryRouter><AdminSignup /></MemoryRouter>)
    expect(screen.getByRole('button', { name: /verify|create|submit/i })).toBeInTheDocument()
  })

  it('renders Citizen pages cleanly with data', async () => {
    render(<MemoryRouter><CitizenDashboard /></MemoryRouter>)
    await waitFor(() => expect(screen.getAllByText('1').length).toBeGreaterThan(0))
    cleanup()

    render(<MemoryRouter><ComplaintFeed /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('Large pothole on MG Road')).toBeInTheDocument())
    cleanup()

    render(<MemoryRouter><SubmitComplaint /></MemoryRouter>)
    expect(screen.getByText(/File Incident Dispatch/i)).toBeInTheDocument()
    cleanup()

    render(<MemoryRouter><PersonalReports /></MemoryRouter>)
    await waitFor(() => expect(screen.getAllByText('Large pothole on MG Road').length).toBeGreaterThan(0))
    cleanup()

    render(<MemoryRouter><FeedbackScreen /></MemoryRouter>)
    expect(screen.getByText(/RELATED INCIDENT DOSSIER/i)).toBeInTheDocument()
    cleanup()

    render(<MemoryRouter><Transparency /></MemoryRouter>)
    await waitFor(() => expect(screen.getByTestId('mock-doughnut-chart')).toBeInTheDocument())
    cleanup()

    render(<MemoryRouter><ComplaintMap /></MemoryRouter>)
    await waitFor(() => expect(screen.getByTestId('mock-leaflet-map')).toBeInTheDocument())
    cleanup()

    render(<MemoryRouter><Chatbot /></MemoryRouter>)
    expect(screen.getByText(/CityZen AI Assistant/i)).toBeInTheDocument()
    cleanup()

    render(
      <MemoryRouter initialEntries={['/citizen/complaint/cmp-123456']}>
        <Routes>
          <Route path="/citizen/complaint/:id" element={<ComplaintDetail />} />
        </Routes>
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getAllByText(/Large pothole on MG Road/i).length).toBeGreaterThan(0))
  })

  it('renders Admin pages cleanly including mobile card lists and desktop tables', async () => {
    render(<MemoryRouter><AdminDashboard /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('40%')).toBeInTheDocument())
    cleanup()

    render(<MemoryRouter><AdminComplaints /></MemoryRouter>)
    await waitFor(() => expect(screen.getAllByText('Large pothole on MG Road').length).toBe(2))
    cleanup()

    render(<MemoryRouter><PriorityQueue /></MemoryRouter>)
    await waitFor(() => expect(screen.getAllByText('Large pothole on MG Road').length).toBeGreaterThan(0))
    cleanup()

    render(<MemoryRouter><AdminComplaintMap /></MemoryRouter>)
    await waitFor(() => expect(screen.getByTestId('mock-leaflet-map')).toBeInTheDocument())
    cleanup()

    render(<MemoryRouter><CitizenManagement /></MemoryRouter>)
    await waitFor(() => expect(screen.getAllByText('Asha Verma').length).toBe(2))
    cleanup()

    render(
      <MemoryRouter initialEntries={['/admin/complaints/cmp-123456']}>
        <Routes>
          <Route path="/admin/complaints/:id" element={<AdminComplaintDetail />} />
        </Routes>
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByText(/DISPATCH AUDIT DOSSIER/i)).toBeInTheDocument())
    cleanup()

    render(
      <MemoryRouter initialEntries={['/admin/citizens/cit-001']}>
        <Routes>
          <Route path="/admin/citizens/:id" element={<CitizenDetails />} />
        </Routes>
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByText('asha@example.com')).toBeInTheDocument())
  })
})
