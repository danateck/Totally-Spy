import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Logo } from '@/components/logo/logo'
import { ScanDetails } from '@/components/scan-details'
import { useEffect, useState } from 'react'

interface Scan {
  id: number
  name: string
  date: string
}

interface Member {
  username: string
  role: string
}

export const Route = createFileRoute('/portfolio/$id')({
  component: PortfolioComponent,
  validateSearch: (search: Record<string, unknown>) => {
    return search
  },
})

function PortfolioComponent() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const [portfolio, setPortfolio] = useState<{ name: string; role: string } | null>(null)
  const [scans, setScans] = useState<Scan[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showErrorDialog, setShowErrorDialog] = useState(false)
  const [showAddMemberModal, setShowAddMemberModal] = useState(false)
  const [newMemberUsername, setNewMemberUsername] = useState('')
  const [newMemberRole, setNewMemberRole] = useState('editor')
  const [showAddScanModal, setShowAddScanModal] = useState(false)
  const [availableScans, setAvailableScans] = useState<Scan[]>([])
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [newPortfolioName, setNewPortfolioName] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showChangeRoleModal, setShowChangeRoleModal] = useState(false)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [newRole, setNewRole] = useState('')
  const [showDeleteMemberModal, setShowDeleteMemberModal] = useState(false)

  const handleError = (err: Error | string) => {
    const errorMessage = err instanceof Error ? err.message : err
    setError(errorMessage)
    setShowErrorDialog(true)
    // Close any open modals
    setShowAddMemberModal(false)
    setShowAddScanModal(false)
  }

  const fetchPortfolioData = async () => {
    setLoading(true)
    try {
      // Fetch portfolio data using POST
      const portfolioResponse = await fetch(`/portfolio/data/${id}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      })
      
      if (!portfolioResponse.ok) {
        const errorData = await portfolioResponse.json().catch(() => ({ detail: 'Failed to fetch portfolio data' }))
        throw new Error(errorData.detail || 'Failed to fetch portfolio data')
      }
      const portfolioData = await portfolioResponse.json()
      console.log('Portfolio data:', portfolioData)

      // Fetch portfolio scans
      const scansResponse = await fetch(`/portfolio/${id}/scans`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      })
      
      if (!scansResponse.ok) {
        const errorData = await scansResponse.json().catch(() => ({ detail: 'Failed to fetch portfolio scans' }))
        throw new Error(errorData.detail || 'Failed to fetch portfolio scans')
      }
      const scansData = await scansResponse.json()

      // Transform scans data from array format to object format
      const transformedScans = scansData.scans.map(([id, date, name]: [number, string, string]) => ({
        id,
        name,
        date
      }))

      // Fetch portfolio members
      const membersResponse = await fetch(`/portfolio/${id}/members`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      })
      
      if (!membersResponse.ok) {
        const errorData = await membersResponse.json().catch(() => ({ detail: 'Failed to fetch portfolio members' }))
        throw new Error(errorData.detail || 'Failed to fetch portfolio members')
      }
      const membersData = await membersResponse.json()

      // Transform members data from array format to object format
      const transformedMembers = membersData.members.map(([username, role]: [string, string]) => ({
        username,
        role
      }))
      
      console.log('Setting portfolio data:', { name: portfolioData.name, role: portfolioData.role })
      setPortfolio({ name: portfolioData.name, role: portfolioData.role })
      setScans(transformedScans)
      setMembers(transformedMembers)
    } catch (err) {
      console.error('Error fetching portfolio data:', err)
      handleError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const fetchAvailableScans = async () => {
    try {
      const response = await fetch('/portfolio/overview', {
        credentials: 'include'
      })
      if (!response.ok) throw new Error('Failed to fetch available scans')
      const data = await response.json()
      setAvailableScans(data.unassigned_recordings || [])
    } catch (err) {
      handleError(err instanceof Error ? err.message : 'Failed to fetch available scans')
    }
  }

  useEffect(() => {
    fetchPortfolioData()
  }, [id])

  const handleAddMember = async () => {
    if (!newMemberUsername.trim()) return

    try {
      const response = await fetch('/portfolio/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          portfolioId: parseInt(id),
          targetUsername: newMemberUsername,
          role: newMemberRole
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to add member')
      }

      setNewMemberUsername('')
      setNewMemberRole('editor')
      setShowAddMemberModal(false)
      fetchPortfolioData()
    } catch (err) {
      handleError(err instanceof Error ? err.message : 'Failed to add member')
    }
  }

  const handleAddScan = async (scanId: number) => {
    try {
      const response = await fetch('/portfolio/add_scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          portfolioId: parseInt(id),
          scanId: scanId
        })
      })

      if (!response.ok) {
        throw new Error('Failed to add scan')
      }

      setShowAddScanModal(false)
      fetchPortfolioData()
    } catch (err) {
      handleError(err instanceof Error ? err.message : 'Failed to add scan')
    }
  }

  const handleRenamePortfolio = async () => {
    if (!newPortfolioName.trim()) return

    try {
      const response = await fetch('/portfolio/rename', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          portfolioId: parseInt(id),
          newName: newPortfolioName
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to rename portfolio')
      }

      // Update the portfolio name in the state
      setPortfolio(prev => prev ? { ...prev, name: newPortfolioName } : null)
      setNewPortfolioName('')
      setShowRenameModal(false)
    } catch (err) {
      handleError(err instanceof Error ? err.message : 'Failed to rename portfolio')
    }
  }

  const handleRenameScan = async (scanId: number, newName: string) => {
    try {
      const response = await fetch('/history/rename', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          scanId,
          newName
        })
      })

      if (!response.ok) {
        throw new Error('Failed to rename scan')
      }

      // Update the local state instead of refetching
      setScans(prevScans => 
        prevScans.map(scan => 
          scan.id === scanId ? { ...scan, name: newName } : scan
        )
      )
    } catch (err) {
      handleError(err instanceof Error ? err.message : 'Failed to rename scan')
    }
  }

  const handleDeletePortfolio = async () => {
    try {
      const response = await fetch('/portfolio/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          portfolioId: parseInt(id)
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to delete portfolio')
      }

      // Navigate back to history page after successful deletion
      navigate({ to: '/history' })
    } catch (err) {
      handleError(err instanceof Error ? err.message : 'Failed to delete portfolio')
    }
  }

  const handleChangeRole = async () => {
    if (!selectedMember || !newRole) return

    try {
      const response = await fetch('/portfolio/change_role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          portfolioId: parseInt(id),
          targetUsername: selectedMember.username,
          newRole: newRole
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to change role')
      }

      // Update the local state
      setMembers(prevMembers =>
        prevMembers.map(member =>
          member.username === selectedMember.username
            ? { ...member, role: newRole }
            : member
        )
      )

      setShowChangeRoleModal(false)
      setSelectedMember(null)
      setNewRole('')
    } catch (err) {
      handleError(err instanceof Error ? err.message : 'Failed to change role')
    }
  }

  const handleDeleteMember = async () => {
    if (!selectedMember) return

    try {
      const response = await fetch('/portfolio/remove_member', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          portfolioId: parseInt(id),
          targetUsername: selectedMember.username
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to remove member')
      }

      // Update the local state
      setMembers(prevMembers =>
        prevMembers.filter(member => member.username !== selectedMember.username)
      )

      setShowDeleteMemberModal(false)
      setSelectedMember(null)
    } catch (err) {
      handleError(err instanceof Error ? err.message : 'Failed to remove member')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground"
        style={{ backgroundImage: "url('/images/background.jpg')" }}>
        <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <Logo className="mb-12" />
          <div className="space-y-4">
            <div className="h-8 bg-card/70 rounded-lg w-1/3 animate-pulse"></div>
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-card/70 rounded-lg animate-pulse"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground"
      style={{ backgroundImage: "url('/images/background.jpg')" }}>
      <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <Logo className="mb-12" />

        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-2 group">
            <h1 className="text-2xl font-bold text-foreground">{portfolio?.name}</h1>
            {portfolio?.role === 'owner' && (
              <button
                onClick={() => {
                  setNewPortfolioName(portfolio.name)
                  setShowRenameModal(true)
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-accent rounded-lg"
                title="Rename Portfolio"
              >
                <svg
                  className="w-5 h-5 text-muted-foreground hover:text-foreground"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
                </svg>
              </button>
            )}
          </div>
          {portfolio?.role === 'owner' && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-4 py-2 text-red-800 border border-red-800 rounded-lg hover:bg-red-800 hover:text-white transition-colors flex items-center"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              Delete Portfolio
            </button>
          )}
        </div>

        {/* Members Section */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Members</h2>
            {portfolio?.role !== 'viewer' && (
              <button
                onClick={() => {
                  setNewMemberUsername('')
                  setShowAddMemberModal(true)
                }}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Add Member
              </button>
            )}
          </div>
          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.username}
                className="p-4 bg-card rounded-xl shadow-lg border border-border group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium">{member.username}</h3>
                    <p className="text-sm text-muted-foreground">Role: {member.role}</p>
                  </div>
                  {portfolio?.role === 'owner' && member.role !== 'owner' && (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          setSelectedMember(member)
                          setNewRole(member.role)
                          setShowChangeRoleModal(true)
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center space-x-2"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                          />
                        </svg>
                        <span>Change Role</span>
                      </button>
                      <button
                        onClick={() => {
                          setSelectedMember(member)
                          setShowDeleteMemberModal(true)
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity px-4 py-2 bg-red-800 text-white rounded-lg hover:bg-red-900 transition-colors flex items-center space-x-2"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                        <span>Remove</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Records Section */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Records</h2>
          {scans.length === 0 ? (
            <div className="text-center py-8 bg-card rounded-xl border border-border">
              <p className="text-muted-foreground text-lg">No records found in this portfolio</p>
            </div>
          ) : (
            <div className="space-y-2">
              {scans.map((scan) => (
                <ScanDetails
                  key={scan.id}
                  id={scan.id}
                  name={scan.name}
                  date={scan.date}
                  onRename={(newName) => handleRenameScan(scan.id, newName)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Add Member Modal */}
        {showAddMemberModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
            <div className="bg-card p-6 rounded-xl shadow-lg w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">Add Member</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-muted-foreground mb-1">
                    Username
                  </label>
                  <input
                    id="username"
                    type="text"
                    value={newMemberUsername}
                    onChange={(e) => setNewMemberUsername(e.target.value)}
                    placeholder="Enter username"
                    className="w-full px-4 py-2 rounded-lg bg-background border border-border"
                  />
                </div>
                <div>
                  <label htmlFor="role" className="block text-sm font-medium text-muted-foreground mb-1">
                    Role
                  </label>
                  <select
                    id="role"
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-background border border-border"
                  >
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end space-x-4 mt-6">
                <button
                  onClick={() => {
                    setShowAddMemberModal(false)
                    setNewMemberUsername('')
                    setNewMemberRole('editor')
                  }}
                  className="px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddMember}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Scan Modal */}
        {showAddScanModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
            <div className="bg-card p-6 rounded-xl shadow-lg w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">Add Record</h2>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {availableScans.map((scan) => (
                  <button
                    key={scan.id}
                    onClick={() => handleAddScan(scan.id)}
                    className="w-full p-4 bg-background rounded-lg hover:bg-accent transition-colors text-left"
                  >
                    <h3 className="text-lg font-medium">{scan.name}</h3>
                    <p className="text-sm text-muted-foreground">{scan.date}</p>
                  </button>
                ))}
              </div>
              <div className="flex justify-end mt-4">
                <button
                  onClick={() => setShowAddScanModal(false)}
                  className="px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rename Portfolio Modal */}
        {showRenameModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-card p-6 rounded-xl shadow-lg w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">Rename Portfolio</h2>
              <input
                type="text"
                value={newPortfolioName}
                onChange={(e) => setNewPortfolioName(e.target.value)}
                placeholder="Enter new portfolio name"
                className="w-full px-4 py-2 rounded-lg bg-background border border-border mb-4"
              />
              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => {
                    setShowRenameModal(false)
                    setNewPortfolioName('')
                  }}
                  className="px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRenamePortfolio}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                >
                  Rename
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Portfolio Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-card p-6 rounded-xl shadow-lg w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">Delete Portfolio</h2>
              <p className="text-destructive mb-6">
                Are you sure you want to delete this portfolio? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeletePortfolio}
                  className="px-4 py-2 bg-red-800 text-white rounded-lg hover:bg-red-950 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Change Role Modal */}
        {showChangeRoleModal && selectedMember && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-card p-6 rounded-xl shadow-lg w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">Change Member Role</h2>
              <p className="mb-4">Change role for {selectedMember.username}</p>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-background border border-border mb-4"
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => {
                    setShowChangeRoleModal(false)
                    setSelectedMember(null)
                    setNewRole('')
                  }}
                  className="px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80"
                >
                  Cancel
                </button>
                <button
                  onClick={handleChangeRole}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                >
                  Change Role
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Member Modal */}
        {showDeleteMemberModal && selectedMember && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-card p-6 rounded-xl shadow-lg w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">Remove Member</h2>
              <p className="text-destructive mb-6">
                Are you sure you want to remove {selectedMember.username} from this portfolio? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => {
                    setShowDeleteMemberModal(false)
                    setSelectedMember(null)
                  }}
                  className="px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteMember}
                  className="px-4 py-2 bg-red-800 text-white rounded-lg hover:bg-red-900 transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error Dialog */}
        {showErrorDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-card p-6 rounded-xl shadow-lg w-full max-w-md">
              <div className="text-destructive text-lg font-semibold mb-4">
                Error
              </div>
              <p className="text-destructive mb-6">{error}</p>
              <div className="flex justify-end">
                <button
                  onClick={() => setShowErrorDialog(false)}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="fixed bottom-8 left-0 right-0 flex justify-center space-x-4">
          <Link
            to="/history"
            className="px-6 py-3 bg-card hover:bg-accent rounded-lg font-semibold transition-all duration-200 flex items-center text-foreground hover:text-accent-foreground border border-border"
          >
            <span className="mr-2">←</span> Back to History
          </Link>
        </div>
      </div>
    </div>
  )
} 