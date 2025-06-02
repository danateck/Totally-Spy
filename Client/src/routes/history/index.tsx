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

interface RecordingWithFavorite {
  id: number
  timestamp: string
  name: string
  is_favorite: boolean
}

export const Route = createFileRoute('/history/')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()
  const [recordings, setRecordings] = useState<RecordingWithFavorite[]>([])
  const [loading, setLoading] = useState(true)
  const [recordsLoading, setRecordsLoading] = useState(false) // Separate loading state for records only
  const [error, setError] = useState<string | null>(null)
  const [filterText, setFilterText] = useState('')
  const [searchInput, setSearchInput] = useState('') // Separate state for input to enable debouncing
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name'>('newest')
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all')
  const [showAddToPortfolioModal, setShowAddToPortfolioModal] = useState(false)
  const [selectedScanForPortfolio, setSelectedScanForPortfolio] = useState<number | null>(null)
  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const routerState = useRouterState()
  const location = routerState.location
  const [showCreatePortfolioModal, setShowCreatePortfolioModal] = useState(false)
  const [newPortfolioName, setNewPortfolioName] = useState('')
  const [creatingPortfolio, setCreatingPortfolio] = useState(false)
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [recordsPerPage, setRecordsPerPage] = useState(20) // Make this a state variable
  const [totalRecords, setTotalRecords] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Escape key to clear search
      if (event.key === 'Escape' && searchInput) {
        setSearchInput('')
        event.preventDefault()
      }
      
      // Ctrl/Cmd + K to focus search
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault()
        const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement
        if (searchInput) {
          searchInput.focus()
          searchInput.select()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [searchInput])

  const handleError = (error: unknown) => {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred'
    console.error('Error details:', error)
    setError(message)
    if (message.includes('log in') && window.location.pathname !== '/login') {
      navigate({ to: '/login' })
    }
  }

  // Function to fetch recordings that can be called multiple times
  const fetchRecordings = useCallback(async (page: number = currentPage, search: string = filterText, limit: number = recordsPerPage, isInitialLoad: boolean = false) => {
    if (isInitialLoad) {
      setLoading(true) // Only set main loading for initial page load
    } else {
      setRecordsLoading(true) // Use records loading for subsequent fetches
    }
    
    try {
      const searchParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        search: search.trim(),
        sort: sortBy,
        date_filter: dateFilter,
        favorites_only: showFavoritesOnly.toString()
      })

      const response = await fetch(`/history/recordings/paginated?${searchParams}`, { 
        credentials: 'include' 
      })

      if (!response.ok) {
        throw new Error(`Error: ${response.status} - ${response.statusText}`)
      }

      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json()
        
        if (data.success) {
          // Server returns data in the format: [(id, timestamp, name, is_favorite)]
          const recordingData = data.data || []
          const formattedRecordings = recordingData.map((record: any) => ({
            id: record[0],
            timestamp: record[1],
            name: record[2],
            is_favorite: record[3]
          }))
          setRecordings(formattedRecordings)
          setTotalRecords(data.pagination.total_records)
          setTotalPages(data.pagination.total_pages)
          setCurrentPage(data.pagination.current_page)
        } else {
          throw new Error('Server returned unsuccessful response')
        }
      } else {
        throw new Error('The server did not return valid JSON.')
      }
    } catch (err) {
      handleError(err)
    } finally {
      if (isInitialLoad) {
        setLoading(false)
      } else {
        setRecordsLoading(false)
      }
    }
  }, [currentPage, filterText, recordsPerPage, sortBy, dateFilter, showFavoritesOnly])

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
        if (Array.isArray(data.portfolios)) {
          portfolioData = data.portfolios.map((p: any) => {
            // Handle both old array format and new object format
            if (Array.isArray(p)) {
              return { id: p[0], name: p[1], role: p[2] || 'owner' }
            } else if (p && typeof p === 'object') {
              return { id: p.id, name: p.name, role: p.role || 'owner' }
            }
            return p
          })
        } else {
          portfolioData = data.data || []
        }
      }
      
      setPortfolios(portfolioData)
    } catch (error) {
      handleError(error)
    }
  }, [])

  // Initial data fetch
  useEffect(() => {
    const fetchData = async () => {
      await Promise.all([fetchRecordings(1, "", recordsPerPage, true), fetchPortfolios()])
    }
    fetchData()
  }, [fetchPortfolios, recordsPerPage]) // Add recordsPerPage to deps

  // Handle optimistic updates when navigating back from record deletion
  useEffect(() => {
    const deletedId = localStorage.getItem('deletedRecordId')
    if (deletedId) {
      // Just refetch the current page instead of trying to filter locally
      fetchRecordings(currentPage, filterText, recordsPerPage, false)
      localStorage.removeItem('deletedRecordId')
    }
  }, [location.pathname, currentPage, filterText, recordsPerPage, fetchRecordings])

  // Update fetchRecordings call signature
  const handlePageChange = useCallback((page: number) => {
    // Only set records loading, don't clear records or trigger full page loading
    setRecordsLoading(true)
    setCurrentPage(page)
    fetchRecordings(page, filterText, recordsPerPage)
    
    // Scroll to the "Your Records" section instead of the top
    const recordsSection = document.getElementById('start-of-records')
    if (recordsSection) {
      recordsSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else {
      // Fallback to top if element not found
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [fetchRecordings, filterText, recordsPerPage])

  // Update search handling - now uses debounced input
  const handleSearchChange = useCallback((search: string) => {
    setSearchInput(search) // Update input immediately for UI responsiveness
    // Actual search happens in debounced useEffect
  }, [])

  // Handle records per page change
  const handleRecordsPerPageChange = useCallback((newLimit: number) => {
    // Only set records loading when changing page size
    setRecordsLoading(true)
    setRecordsPerPage(newLimit)
    setCurrentPage(1) // Reset to page 1 when changing page size
    fetchRecordings(1, filterText, newLimit)
  }, [fetchRecordings, filterText])

  // Remove client-side filtering - now handled by server
  const paginatedRecordings = recordings // Server already returns paginated data

  // Reset to page 1 when filter changes (handled in handleSearchChange now)
  // useEffect removed as it's now handled differently

  // Pagination handlers - updated to use server-side pagination
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      handlePageChange(page)
    }
  }

  const goToPrevPage = () => goToPage(currentPage - 1)
  const goToNextPage = () => goToPage(currentPage + 1)

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
          recording.id === scanId ? { ...recording, name: newName } : recording
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

      setRecordings(prevRecordings => prevRecordings.filter(recording => recording.id !== scanId))
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

  // Debounced search effect
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (searchInput !== filterText) {
        setRecordsLoading(true)
        setFilterText(searchInput)
        setCurrentPage(1)
        fetchRecordings(1, searchInput, recordsPerPage, false)
      }
    }, 300) // 300ms debounce

    return () => clearTimeout(debounceTimer)
  }, [searchInput, filterText, recordsPerPage, fetchRecordings])

  // Handle filter changes (sort, date) 
  useEffect(() => {
    setRecordsLoading(true)
    fetchRecordings(currentPage, filterText, recordsPerPage, false)
  }, [sortBy, dateFilter, showFavoritesOnly, currentPage, filterText, recordsPerPage, fetchRecordings])

  // Function to toggle favorite status
  const handleToggleFavorite = async (scanId: number) => {
    try {
      const response = await fetch('/history/toggle_favorite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scanId })
      })

      if (!response.ok) {
        throw new Error('Failed to toggle favorite')
      }

      const result = await response.json()
      
      // Update the local state to reflect the change
      setRecordings(prevRecordings => 
        prevRecordings.map(recording => 
          recording.id === scanId 
            ? { ...recording, is_favorite: result.is_favorite }
            : recording
        )
      )
    } catch (error) {
      handleError(error)
    }
  }

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
      <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6 lg:px-8 pb-24">
        <Logo className="mb-12" />

        {/* Portfolios Section */}
        <PortfolioList
          portfolios={portfolios}
          onCreate={() => setShowCreatePortfolioModal(true)}
        />

        {/* Visual Separator */}
        <div className="my-12" id="start-of-records">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-background px-4 text-muted-foreground font-medium">
                Your Recordings
              </span>
            </div>
          </div>
        </div>

        {/* Filter Input - moved below portfolios since it only filters records */}
        <div className="mb-6 space-y-4">
          {/* Search Row - Full Width */}
          <div className="w-full">
            <div className="flex-1 relative max-w-2xl">
              <div className="relative">
                {/* Search Icon */}
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                
                <input
                  type="text"
                  placeholder="Search recordings by name... (Ctrl+K to focus, Esc to clear)"
                  value={searchInput}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 text-base rounded-lg bg-card border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all"
                />
                
                {/* Clear Button */}
                {searchInput && (
                  <button
                    onClick={() => {
                      setSearchInput('')
                      // This will trigger the debounced effect to clear the search
                    }}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center hover:bg-accent/20 rounded-r-lg transition-colors"
                    title="Clear search"
                  >
                    <svg className="h-4 w-4 text-muted-foreground hover:text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
                
                {/* Loading indicator for search */}
                {recordsLoading && searchInput && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <div className="animate-spin h-4 w-4 border-2 border-accent border-t-transparent rounded-full"></div>
                  </div>
                )}
              </div>
              
              {/* Search Results Counter */}
              {searchInput && !recordsLoading && (
                <div className="absolute top-full left-0 mt-1 text-xs text-muted-foreground z-10">
                  {totalRecords > 0 ? (
                    <span className="px-2 py-1 bg-accent/10 rounded-full">
                      {totalRecords} result{totalRecords !== 1 ? 's' : ''} found
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-destructive/10 text-destructive rounded-full">
                      No results found
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Sort Filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground whitespace-nowrap">Sort:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest' | 'name')}
                className="px-3 py-2 text-sm rounded-lg bg-card border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent min-w-[100px]"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="name">Name A-Z</option>
              </select>
            </div>
            
            {/* Date Filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground whitespace-nowrap">Date:</label>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as 'all' | 'today' | 'week' | 'month')}
                className="px-3 py-2 text-sm rounded-lg bg-card border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent min-w-[100px]"
              >
                <option value="all">All time</option>
                <option value="today">Today</option>
                <option value="week">This week</option>
                <option value="month">This month</option>
              </select>
            </div>

            {/* Records per page */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground whitespace-nowrap">Show:</label>
              <select
                value={recordsPerPage}
                onChange={(e) => handleRecordsPerPageChange(Number(e.target.value))}
                className="px-3 py-2 text-sm rounded-lg bg-card border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent min-w-[60px]"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={75}>75</option>
                <option value={100}>100</option>
              </select>
              <span className="text-sm text-muted-foreground whitespace-nowrap">per page</span>
            </div>
            
            {/* Favorites Filter */}
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={showFavoritesOnly}
                  onChange={(e) => setShowFavoritesOnly(e.target.checked)}
                  className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-accent focus:ring-2"
                />
                <svg className="w-4 h-4" fill={showFavoritesOnly ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                <span className="whitespace-nowrap">Favorites only</span>
              </label>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 ml-auto">
              {/* Clear All Filters */}
              {(filterText || dateFilter !== 'all' || sortBy !== 'newest' || showFavoritesOnly) && (
                <button
                  onClick={() => {
                    setSearchInput('')
                    setFilterText('')
                    setDateFilter('all')
                    setSortBy('newest')
                    setShowFavoritesOnly(false)
                    setCurrentPage(1)
                  }}
                  className="px-3 py-2 text-sm bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors"
                  title="Clear all filters"
                >
                  Clear all
                </button>
              )}
              
              {/* Refresh Button */}
              <button
                onClick={() => {
                  fetchRecordings(currentPage, filterText, recordsPerPage, false)
                }}
                disabled={recordsLoading}
                className="px-3 py-2 text-sm bg-green-600 text-black rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1"
                title="Refresh records"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>
          </div>

          {/* Filter Results Info */}
          {totalRecords > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>
                {filterText ? (
                  <>Showing {totalRecords} matches for "{filterText}"</>
                ) : showFavoritesOnly ? (
                  <>{totalRecords} favorite records</>
                ) : (
                  <>{totalRecords} total records</>
                )}
              </span>
              {sortBy !== 'newest' && (
                <span className="px-2 py-1 bg-accent/20 rounded-full text-xs">
                  Sorted by {sortBy}
                </span>
              )}
              {dateFilter !== 'all' && (
                <span className="px-2 py-1 bg-accent/20 rounded-full text-xs">
                  {dateFilter === 'today' ? 'Today' : dateFilter === 'week' ? 'This week' : 'This month'}
                </span>
              )}
              {showFavoritesOnly && (
                <span className="px-2 py-1 bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 rounded-full text-xs flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                  Favorites
                </span>
              )}
              {totalPages > 1 && (
                <span>• Page {currentPage} of {totalPages}</span>
              )}
            </div>
          )}
        </div>

        {/* Recordings Section */}
        <div className="bg-card/30 rounded-xl p-6 border border-border/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-foreground">All Recordings</h2>
            </div>
          </div>

          {error && !recordings.length && (
            <p className="text-destructive text-center text-lg font-semibold">
              {error.includes('valid JSON') ? "You have no records" : error}
            </p>
          )}
          {paginatedRecordings.length === 0 && !error && !loading && (
            <p className="text-muted-foreground text-center text-lg font-semibold">
              No matching records found
            </p>
          )}

          <div className="space-y-4 relative">
            {recordsLoading && (
              // Overlay loading state - covers the records area
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-lg">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                <p className="text-muted-foreground mt-4">Loading records...</p>
                <p className="text-sm text-muted-foreground">
                  {filterText ? `Searching for "${filterText}"` : `Loading page ${currentPage} of ${totalPages || '...'}`}
                </p>
              </div>
            )}
            
            {loading && recordings.length === 0 ? (
              // Initial loading skeleton (only for first page load)
              <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                <p className="text-muted-foreground">Loading page...</p>
              </div>
            ) : recordings.length === 0 ? (
              // Empty states - different messages based on filters
              <div className="flex flex-col items-center justify-center py-16 space-y-6">
                <div className="w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center">
                  {filterText || dateFilter !== 'all' ? (
                    // Search/Filter empty state
                    <svg className="w-12 h-12 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  ) : (
                    // No records at all
                    <svg className="w-12 h-12 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                </div>
                
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-semibold text-foreground">
                    {filterText ? (
                      <>No records found for "{filterText}"</>
                    ) : dateFilter !== 'all' ? (
                      <>No records found for {dateFilter === 'today' ? 'today' : dateFilter === 'week' ? 'this week' : 'this month'}</>
                    ) : (
                      <>No recordings yet</>
                    )}
                  </h3>
                  
                  <p className="text-muted-foreground max-w-md">
                    {filterText ? (
                      <>Try adjusting your search terms or clearing filters to see more results.</>
                    ) : dateFilter !== 'all' ? (
                      <>Try selecting a different date range or clearing the date filter.</>
                    ) : (
                      <>Start by capturing your first scan. Your recorded data will appear here.</>
                    )}
                  </p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3">
                  {(filterText || dateFilter !== 'all' || sortBy !== 'newest' || showFavoritesOnly) && (
                    <button
                      onClick={() => {
                        setSearchInput('')
                        setFilterText('')
                        setDateFilter('all')
                        setSortBy('newest')
                        setShowFavoritesOnly(false)
                        setCurrentPage(1)
                      }}
                      className="px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:bg-accent/80 transition-colors"
                    >
                      Clear filters
                    </button>
                  )}
                  
                  {!filterText && dateFilter === 'all' && (
                    <button
                      onClick={() => navigate({ to: '/dashboard' })}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                    >
                      Start recording
                    </button>
                  )}
                </div>
              </div>
            ) : (
              // Show actual records
              paginatedRecordings.map((recording) => (
                <ScanDetails
                  key={recording.id}
                  id={recording.id}
                  name={recording.name}
                  date={recording.timestamp}
                  showAddToPortfolio={true}
                  isFavorite={recording.is_favorite}
                  onToggleFavorite={() => handleToggleFavorite(recording.id)}
                  onAddToPortfolio={() => {
                    setSelectedScanForPortfolio(recording.id)
                    setShowAddToPortfolioModal(true)
                  }}
                  onRename={(newName) => handleRename(recording.id, newName)}
                />
              ))
            )}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="mt-8 flex flex-col items-center space-y-4">
              {/* Pagination Stats */}
              <div className="text-sm text-muted-foreground text-center">
                Showing page {currentPage} of {totalPages} • {totalRecords} total records
                {filterText && ` (filtered by "${filterText}")`}
              </div>

              {/* Pagination Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  onClick={goToPrevPage}
                  disabled={currentPage === 1}
                  className="px-3 py-2 rounded-lg bg-card border border-border hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center min-w-[80px] justify-center"
                  title="Previous page"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span className="ml-1 hidden sm:inline">Prev</span>
                </button>

                {/* Page Numbers */}
                <div className="flex flex-wrap items-center justify-center gap-1">
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    let pageNum: number
                    if (totalPages <= 7) {
                      pageNum = i + 1
                    } else if (currentPage <= 4) {
                      pageNum = i + 1
                    } else if (currentPage >= totalPages - 3) {
                      pageNum = totalPages - 6 + i
                    } else {
                      pageNum = currentPage - 3 + i
                    }

                    if (pageNum < 1 || pageNum > totalPages) return null

                    return (
                      <button
                        key={pageNum}
                        onClick={() => goToPage(pageNum)}
                        className={`px-3 py-2 rounded-lg transition-colors min-w-[40px] flex items-center justify-center ${
                          currentPage === pageNum
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-card border border-border hover:bg-accent'
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  })}

                  {/* Show ellipsis and last page if needed */}
                  {totalPages > 7 && currentPage < totalPages - 3 && (
                    <>
                      <span className="px-2 py-2 text-muted-foreground">...</span>
                      <button
                        onClick={() => goToPage(totalPages)}
                        className="px-3 py-2 rounded-lg bg-card border border-border hover:bg-accent transition-colors min-w-[40px] flex items-center justify-center"
                      >
                        {totalPages}
                      </button>
                    </>
                  )}
                </div>

                <button
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 rounded-lg bg-card border border-border hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center min-w-[80px] justify-center"
                  title="Next page"
                >
                  <span className="mr-1 hidden sm:inline">Next</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}
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