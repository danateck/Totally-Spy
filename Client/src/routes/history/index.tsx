import { createFileRoute, Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { Logo } from '@/components/logo/logo'
import { ScanDetails } from '@/components/scan-details'
import { PortfolioList } from '@/components/PortfolioList'
import { useEffect, useState, useCallback } from 'react'

interface Portfolio {
  id: number
  name: string
  role: string
}

interface Record {
  id: number
  timestamp: string
  name: string
}

type Recording = [number, string, string]

export const Route = createFileRoute('/history/')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterText, setFilterText] = useState('')
  const [selectedScan, setSelectedScan] = useState<number | null>(null)
  const [showAddToPortfolioModal, setShowAddToPortfolioModal] = useState(false)
  const [selectedScanForPortfolio, setSelectedScanForPortfolio] = useState<number | null>(null)
  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [selectedPortfolio, setSelectedPortfolio] = useState<number | null>(null)
  const [portfolioScans, setPortfolioScans] = useState<number[]>([])
  const routerState = useRouterState()
  const location = routerState.location
  const [showCreatePortfolioModal, setShowCreatePortfolioModal] = useState(false)
  const [newPortfolioName, setNewPortfolioName] = useState('')
  const [creatingPortfolio, setCreatingPortfolio] = useState(false)

  const handleError = (error: unknown) => {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred'
    console.error('Error details:', error)
    setError(message)
    if (message.includes('log in') && window.location.pathname !== '/login') {
      navigate({ to: '/login' })
    }
  }

  // Function to fetch recordings that can be called multiple times
  const fetchRecordings = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/history/recordings?t=${Date.now()}`, { 
        credentials: 'include' 
      })

      if (!response.ok) {
        throw new Error(`Error: ${response.status} - ${response.statusText}`)
      }

      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json()
        let recordingData = []
        if (Array.isArray(data)) {
          recordingData = data
        } else if (data && typeof data === 'object') {
          const records = data.records || data.recordings || data.data || []
          recordingData = records.map((record: any) => {
            if (Array.isArray(record) && record.length === 3) {
              return record
            } else if (record && typeof record === 'object') {
              return [record.id, record.timestamp, record.name]
            }
            return null
          }).filter(Boolean)
        }
        setRecordings(recordingData)
      } else {
        throw new Error('The server did not return valid JSON.')
      }
    } catch (err) {
      handleError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchPortfolios = useCallback(async () => {
    try {
      const response = await fetch('/portfolio/list', {
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch portfolios: ${response.status}`)
      }

      const data = await response.json()
      let portfolioData = []
      if (Array.isArray(data)) {
        portfolioData = data
      } else if (data && typeof data === 'object') {
        // Map array-of-arrays to objects
        if (Array.isArray(data.portfolios)) {
          portfolioData = await Promise.all(data.portfolios.map(async (p: any) => {
            if (Array.isArray(p)) {
              // Fetch the real role for this portfolio
              let role = 'owner'
              try {
                const roleRes = await fetch(`/portfolio/${p[0]}/role`, { credentials: 'include' })
                if (roleRes.ok) {
                  const roleData = await roleRes.json()
                  if (roleData && roleData.role) {
                    role = roleData.role
                  }
                }
              } catch (e) {}
              return { id: p[0], name: p[1], role }
            }
            return p
          }))
        } else {
          portfolioData = data.data || []
        }
      }
      setPortfolios(portfolioData)
    } catch (error) {
      handleError(error)
    }
  }, [])

  const fetchPortfolioScans = useCallback(async (portfolioId: number) => {
    try {
      const response = await fetch(`/portfolio/${portfolioId}/scans`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch portfolio scans: ${response.status}`)
      }

      const data = await response.json()
      const scans = Array.isArray(data) ? data : (data.scans || data.data || [])
      setPortfolioScans(scans)
    } catch (error) {
      handleError(error)
    }
  }, [])

  // Initial data fetch
  useEffect(() => {
    const fetchData = async () => {
      await Promise.all([fetchRecordings(), fetchPortfolios()])
    }
    fetchData()
  }, [fetchRecordings, fetchPortfolios])

  // Fetch portfolio scans when portfolio is selected
  useEffect(() => {
    if (selectedPortfolio) {
      fetchPortfolioScans(selectedPortfolio)
    } else {
      setPortfolioScans([])
    }
  }, [selectedPortfolio, fetchPortfolioScans])

  // Handle optimistic updates when navigating back from record deletion
  useEffect(() => {
    const deletedId = localStorage.getItem('deletedRecordId')
    if (deletedId) {
      setRecordings(prev => 
        prev.filter(([id]) => id !== parseInt(deletedId))
      )
      fetchRecordings()
      localStorage.removeItem('deletedRecordId')
    }
  }, [location.pathname, fetchRecordings])

  const handleRename = async (scanId: number, newName: string) => {
    try {
      const ownershipResponse = await fetch('/history/check_ownership', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scanId }),
      })

      if (!ownershipResponse.ok) {
        throw new Error('Failed to verify scan ownership')
      }

      const { isOwner } = await ownershipResponse.json()
      if (!isOwner) {
        setError('Only the scan owner can rename scans.')
        return
      }

      const response = await fetch('/history/rename', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scanId, newName }),
      })

      if (!response.ok) {
        throw new Error('Failed to rename scan')
      }

      setRecordings(prevRecordings => 
        prevRecordings.map(recording => 
          recording[0] === scanId ? [recording[0], recording[1], newName] : recording
        )
      )

      setError(null)
    } catch (error) {
      handleError(error)
    }
  }

  const handleDelete = async (scanId: number) => {
    try {
      const ownershipResponse = await fetch('/history/check_ownership', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scanId }),
      })

      if (!ownershipResponse.ok) {
        throw new Error('Failed to verify scan ownership')
      }

      const { isOwner } = await ownershipResponse.json()
      if (!isOwner) {
        setError('Only the scan owner can delete scans.')
        return
      }

      const response = await fetch('/history/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scanId }),
      })

      if (!response.ok) {
        throw new Error('Failed to delete scan')
      }

      setRecordings(prevRecordings => prevRecordings.filter(recording => recording[0] !== scanId))
      setError(null)
    } catch (error) {
      handleError(error)
    }
  }

  const handleAddToPortfolio = async (portfolioId: number) => {
    if (!selectedScanForPortfolio) return

    try {
      const response = await fetch('/portfolio/add_scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          portfolioId: portfolioId,
          scanId: selectedScanForPortfolio
        })
      })

      if (!response.ok) {
        throw new Error('Failed to add scan to portfolio')
      }

      setShowAddToPortfolioModal(false)
      setSelectedScanForPortfolio(null)
      setError(null)
    } catch (error) {
      handleError(error)
    }
  }

  const filteredRecordings = recordings.filter(([id, _, name]) => {
    const matchesFilter = name.toLowerCase().includes(filterText.toLowerCase())
    const matchesPortfolio = !selectedPortfolio || portfolioScans.includes(id)
    return matchesFilter && matchesPortfolio
  })

  // Render loading skeleton
  if (loading && recordings.length === 0) {
    return (
      <div className="min-h-screen bg-background text-foreground"
        style={{ backgroundImage: "url('/images/background.jpg')" }}>
        <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <Logo className="mb-12" />
          
          {/* Skeleton loading state */}
          <div className="mb-6">
            <div className="h-10 bg-card/70 rounded-lg w-1/2 animate-pulse"></div>
          </div>
          
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="block w-full p-4 bg-card/70 rounded-xl shadow-lg border border-border animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 rounded-full bg-muted"></div>
                    <div>
                      <div className="h-6 bg-muted rounded w-32 mb-2"></div>
                      <div className="h-4 bg-muted rounded w-24"></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
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

        {/* Filter Input */}
        <div className="mb-8 flex items-center">
          <input
            type="text"
            placeholder="Filter by name..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="px-4 py-2 rounded-lg bg-card border border-border text-foreground w-full sm:w-1/2 focus:outline-none focus:ring-2 focus:ring-accent transition-all"
          />
        </div>

        {/* Portfolios Section */}
        <PortfolioList
          portfolios={portfolios}
          onCreate={() => setShowCreatePortfolioModal(true)}
          onSelectPortfolio={id => setSelectedPortfolio(id)}
        />

        {/* Recordings Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-primary">Recordings</h2>
            <button
              onClick={() => fetchRecordings()}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-black rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>

          {error && !recordings.length && (
            <p className="text-destructive text-center text-lg font-semibold">
              {error.includes('valid JSON') ? "You have no records" : error}
            </p>
          )}
          {filteredRecordings.length === 0 && !error && !loading && (
            <p className="text-muted-foreground text-center text-lg font-semibold">
              No matching records found
            </p>
          )}

          <div className="space-y-4">
            {filteredRecordings.map((recording) => (
              <ScanDetails
                key={recording[0]}
                id={recording[0]}
                name={recording[2]}
                date={recording[1]}
                showAddToPortfolio={true}
                onAddToPortfolio={() => {
                  setSelectedScanForPortfolio(recording[0])
                  setShowAddToPortfolioModal(true)
                }}
                onRename={(newName) => handleRename(recording[0], newName)}
              />
            ))}
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="fixed bottom-8 left-0 right-0 flex justify-center space-x-4">
          <Link
            to="/dashboard"
            className="px-6 py-3 bg-card hover:bg-accent rounded-lg font-semibold transition-all duration-200 flex items-center text-foreground hover:text-accent-foreground border border-border"
          >
            <span className="mr-2">←</span> Back
          </Link>
        </div>
      </div>

      {showAddToPortfolioModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-semibold mb-4">Add to Portfolio</h2>
            <div className="space-y-4">
              {portfolios.map((portfolio) => (
                <button
                  key={portfolio.id}
                  onClick={() => handleAddToPortfolio(portfolio.id)}
                  className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  {portfolio.name}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                setShowAddToPortfolioModal(false)
                setSelectedScanForPortfolio(null)
              }}
              className="mt-4 w-full px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Create Portfolio Modal */}
      {showCreatePortfolioModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-xl shadow-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Create Portfolio</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                if (!newPortfolioName.trim()) return
                setCreatingPortfolio(true)
                try {
                  const res = await fetch('/portfolio/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ name: newPortfolioName, portfolioId: 0 })
                  })
                  if (res.ok) {
                    setShowCreatePortfolioModal(false)
                    setNewPortfolioName('')
                    await fetchPortfolios()
                  } else {
                    // Optionally show error
                  }
                } finally {
                  setCreatingPortfolio(false)
                }
              }}
            >
              <input
                type="text"
                value={newPortfolioName}
                onChange={e => setNewPortfolioName(e.target.value)}
                placeholder="Portfolio name"
                className="w-full px-4 py-2 rounded-lg bg-background border border-border mb-4"
                disabled={creatingPortfolio}
              />
              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreatePortfolioModal(false)
                    setNewPortfolioName('')
                  }}
                  className="px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80"
                  disabled={creatingPortfolio}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-black rounded-lg font-semibold hover:bg-green-700 transition-colors"
                  disabled={creatingPortfolio || !newPortfolioName.trim()}
                >
                  {creatingPortfolio ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
