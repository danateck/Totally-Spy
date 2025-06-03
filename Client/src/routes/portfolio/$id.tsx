import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Logo } from '@/components/logo/logo'
import { ScanDetails } from '@/components/scan-details'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'

interface Scan {
  id: number
  name: string
  date: string
}

interface Member {
  username: string
  role: string
}

interface User {
  username: string
  // Add other user properties if needed
}

export const Route = createFileRoute('/portfolio/$id')({
  component: PortfolioComponent,
  validateSearch: (search: Record<string, unknown>) => {
    return search
  },
  params: {
    parse: (params) => {
      const id = params.id
      if (!id || typeof id !== 'string') {
        throw new Error('Portfolio ID is required')
      }
      if (isNaN(Number(id))) {
        throw new Error('Portfolio ID must be a valid number')
      }
      return { id }
    },
    stringify: ({ id }) => ({ id: String(id) }),
  },
})

function PortfolioComponent() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  
  // Add error handling for useAuth hook
  let authData
  try {
    authData = useAuth()
  } catch (error) {
    console.error('Auth error:', error)
    // Redirect to login if auth fails
    useEffect(() => {
      navigate({ to: '/login' })
    }, [navigate])
    return null
  }
  
  const { logout } = authData
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)

  // Move handleSignOut to the top so it's available in early returns
  const handleSignOut = async () => {
    try {
      await logout()
      navigate({ to: '/login' })
    } catch (error) {
      console.error('Sign out error:', error)
      // Force navigation even if logout fails
      navigate({ to: '/login' })
    }
  }

  // Handle click outside to close profile dropdown - move this up too
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showProfileDropdown) {
        const target = event.target as Element
        if (!target.closest('[data-profile-dropdown]')) {
          setShowProfileDropdown(false)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showProfileDropdown])

  if (!id || isNaN(Number(id))) {
    return (
      <div className="min-h-screen bg-background text-foreground"
        style={{ backgroundImage: "url('/images/background.jpg')" }}>
        
        {/* Header with Profile */}
        <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14 sm:h-16">
              {/* Left side - Page title */}
              <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 sm:w-4 sm:h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h1 className="text-base sm:text-lg font-semibold text-foreground truncate">Portfolio</h1>
                
                {/* Back to History button - hidden on very small screens, visible on sm+ */}
                <Link
                  to="/history"
                  className="hidden sm:flex items-center px-2 py-1 sm:px-3 sm:py-1.5 bg-secondary/10 hover:bg-secondary/20 rounded-lg transition-colors ml-2 sm:ml-4"
                  title="Back to History"
                >
                  <svg className="w-3 h-3 sm:w-4 sm:h-4 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span className="ml-1 text-xs sm:text-sm font-medium text-secondary">History</span>
                </Link>
              </div>

              {/* Right side - Profile dropdown and mobile back button */}
              <div className="flex items-center space-x-2">
                {/* Mobile-only back button */}
                <Link
                  to="/history"
                  className="sm:hidden flex items-center justify-center p-2 bg-secondary/10 hover:bg-secondary/20 rounded-lg transition-colors"
                  title="Back to History"
                >
                  <svg className="w-4 h-4 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </Link>
                
                {/* Profile dropdown */}
                <div className="relative" data-profile-dropdown>
                  <button
                    onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                    className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-2 rounded-lg bg-card hover:bg-accent transition-colors border border-border"
                  >
                    <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <svg className="w-3 h-3 sm:w-4 sm:h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <span className="text-xs sm:text-sm font-medium hidden xs:inline">Profile</span>
                    <svg className={`w-3 h-3 sm:w-4 sm:h-4 transition-transform ${showProfileDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Dropdown menu */}
                  {showProfileDropdown && (
                    <div className="absolute right-0 mt-2 w-40 sm:w-48 bg-card rounded-lg shadow-lg border border-border z-50">
                      <div className="py-1">
                        <Link
                          to="/profile"
                          className="flex items-center px-3 sm:px-4 py-2 text-xs sm:text-sm text-foreground hover:bg-accent transition-colors"
                          onClick={() => setShowProfileDropdown(false)}
                        >
                          <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-2 sm:mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          My Profile
                        </Link>
                        <Link
                          to="/my-requests"
                          className="flex items-center px-3 sm:px-4 py-2 text-xs sm:text-sm text-foreground hover:bg-accent transition-colors"
                          onClick={() => setShowProfileDropdown(false)}
                        >
                          <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-2 sm:mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          My Requests
                        </Link>
                        <div className="border-t border-border my-1"></div>
                        <button
                          onClick={() => {
                            setShowProfileDropdown(false)
                            handleSignOut()
                          }}
                          className="flex items-center w-full px-3 sm:px-4 py-2 text-xs sm:text-sm text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-2 sm:mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto py-12 px-4">
          <Logo className="mb-12" />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-500 mb-4">Invalid Portfolio</h1>
            <p>The portfolio ID is invalid or missing.</p>
            <Link to="/history" className="text-primary hover:underline">
              ← Back to History
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const [portfolio, setPortfolio] = useState<{ name: string; role: string } | null>(null)
  const [scans, setScans] = useState<Scan[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showErrorDialog, setShowErrorDialog] = useState(false)
  const [showAddMemberModal, setShowAddMemberModal] = useState(false)
  const [newMemberUsername, setNewMemberUsername] = useState('')
  const [newMemberRole, setNewMemberRole] = useState('editor')
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [newPortfolioName, setNewPortfolioName] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showChangeRoleModal, setShowChangeRoleModal] = useState(false)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [newRole, setNewRole] = useState('')
  const [showDeleteMemberModal, setShowDeleteMemberModal] = useState(false)
  
  // New states for user autocomplete
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const [selectedUserIndex, setSelectedUserIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<number | null>(null)

  const handleError = useCallback((err: Error | string) => {
    const errorMessage = err instanceof Error ? err.message : err
    setError(errorMessage)
    setShowErrorDialog(true)
    // Close any open modals
    setShowAddMemberModal(false)
  }, [])

  // Fetch users for autocomplete based on search term
  const fetchUsers = async (searchTerm: string) => {
    try {
      console.log('Fetching users with search term:', searchTerm)
      
      const response = await fetch(`/users/search?q=${encodeURIComponent(searchTerm)}`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch users')
      }
      
      const userData = await response.json()
      console.log('Received user data:', userData)
      
      return userData.users || []
    } catch (err) {
      console.error('Error fetching users:', err)
      return []
    }
  }

  // Filter users based on input with debounced API calls
  const filterUsers = async (searchTerm: string) => {
    console.log('🔍 Searching for users with term:', searchTerm)
    
    if (!searchTerm) {
      console.log('❌ Empty search term, hiding dropdown')
      setFilteredUsers([])
      setShowUserDropdown(false)
      return
    }

    try {
      // Fetch users from API
      const users = await fetchUsers(searchTerm)
      console.log('📊 API returned users:', users)
      
      if (!users || users.length === 0) {
        console.log('❌ No users found from API')
        setFilteredUsers([])
        setShowUserDropdown(true) // Show dropdown with "no results" message
        return
      }
      
      // Get existing member usernames
      const existingUsernames = members.map(m => m.username)
      console.log('👥 Existing portfolio members:', existingUsernames)
      
      // Show ALL users from API (don't filter out existing members for debugging)
      const allUsersWithStatus = users.map((user: User) => ({
        ...user,
        isExistingMember: existingUsernames.includes(user.username)
      }))
      
      console.log('📋 All users with member status:', allUsersWithStatus)
      
      // For now, let's show all users (including existing members) to debug
      const filtered = users.slice(0, 10) // Show all results, limit to 10
      
      console.log('✅ Final filtered users (showing all):', filtered)
      console.log('👀 Will show dropdown:', true)
      
      setFilteredUsers(filtered)
      setShowUserDropdown(true) // Always show if we have any results
      setSelectedUserIndex(-1)
      
    } catch (err) {
      console.error('❌ Error filtering users:', err)
      setFilteredUsers([])
      setShowUserDropdown(false)
    }
  }

  // Handle username input change with debouncing
  const handleUsernameChange = (value: string) => {
    setNewMemberUsername(value)
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    
    // If empty, hide dropdown immediately
    if (!value.trim()) {
      setFilteredUsers([])
      setShowUserDropdown(false)
      return
    }
    
    // Debounce the API call for non-empty values
    searchTimeoutRef.current = setTimeout(() => {
      filterUsers(value.trim())
    }, 200) // Reduced to 200ms for faster response
  }

  // Handle user selection from dropdown
  const selectUser = (username: string) => {
    setNewMemberUsername(username)
    setShowUserDropdown(false)
    setFilteredUsers([])
    setSelectedUserIndex(-1)
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showUserDropdown) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedUserIndex(prev => 
          prev < filteredUsers.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedUserIndex(prev => prev > 0 ? prev - 1 : -1)
        break
      case 'Enter':
        e.preventDefault()
        if (selectedUserIndex >= 0 && selectedUserIndex < filteredUsers.length) {
          selectUser(filteredUsers[selectedUserIndex].username)
        }
        break
      case 'Escape':
        setShowUserDropdown(false)
        setSelectedUserIndex(-1)
        break
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false)
        setSelectedUserIndex(-1)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  
  const fetchPortfolioData = useCallback(async () => {
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
      console.log('Fetching scans for portfolio:', id)
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
      console.log('Raw scans data from portfolio endpoint:', scansData)

      // Transform scans data from array format to object format
      const transformedScans = scansData.scans.map(([id, date, name]: [number, string, string]) => {
  // If the name looks like encrypted text (long and contains only letters/numbers)
      const isEncrypted = name.length > 50 && /^[0-9a-fA-F]+$/.test(name);
      
        return {
          id,
          name: isEncrypted ? `Shared Scan #${id}` : name,
          date
        }
      })
      console.log('Transformed scans for ScanDetails:', transformedScans)

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
  }, [id, handleError])

  useEffect(() => {
    if (id && !isNaN(Number(id))) {
      fetchPortfolioData()
    } else {
      setError('Invalid portfolio ID')
      setLoading(false)
    }
  }, [id, fetchPortfolioData])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [])

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
      setShowUserDropdown(false)
      setFilteredUsers([])
      fetchPortfolioData()
    } catch (err) {
      handleError(err instanceof Error ? err.message : 'Failed to add member')
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
        <div className="max-w-2xl mx-auto py-12 px-4">
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
      
      {/* Header with Profile */}
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Left side - Page title */}
            <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h1 className="text-base sm:text-lg font-semibold text-foreground truncate">{portfolio?.name || 'Portfolio'}</h1>
              
              {/* Back to History button - hidden on very small screens, visible on sm+ */}
              <Link
                to="/history"
                className="hidden sm:flex items-center px-2 py-1 sm:px-3 sm:py-1.5 bg-secondary/10 hover:bg-secondary/20 rounded-lg transition-colors ml-2 sm:ml-4"
                title="Back to History"
              >
                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="ml-1 text-xs sm:text-sm font-medium text-secondary">History</span>
              </Link>
            </div>

            {/* Right side - Profile dropdown and mobile back button */}
            <div className="flex items-center space-x-2">
              {/* Mobile-only back button */}
              <Link
                to="/history"
                className="sm:hidden flex items-center justify-center p-2 bg-secondary/10 hover:bg-secondary/20 rounded-lg transition-colors"
                title="Back to History"
              >
                <svg className="w-4 h-4 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              
              {/* Profile dropdown */}
              <div className="relative" data-profile-dropdown>
                <button
                  onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                  className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-2 rounded-lg bg-card hover:bg-accent transition-colors border border-border"
                >
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <span className="text-xs sm:text-sm font-medium hidden xs:inline">Profile</span>
                  <svg className={`w-3 h-3 sm:w-4 sm:h-4 transition-transform ${showProfileDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown menu */}
                {showProfileDropdown && (
                  <div className="absolute right-0 mt-2 w-40 sm:w-48 bg-card rounded-lg shadow-lg border border-border z-50">
                    <div className="py-1">
                      <Link
                        to="/profile"
                        className="flex items-center px-3 sm:px-4 py-2 text-xs sm:text-sm text-foreground hover:bg-accent transition-colors"
                        onClick={() => setShowProfileDropdown(false)}
                      >
                        <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-2 sm:mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        My Profile
                      </Link>
                      <Link
                        to="/my-requests"
                        className="flex items-center px-3 sm:px-4 py-2 text-xs sm:text-sm text-foreground hover:bg-accent transition-colors"
                        onClick={() => setShowProfileDropdown(false)}
                      >
                        <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-2 sm:mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        My Requests
                      </Link>
                      <div className="border-t border-border my-1"></div>
                      <button
                        onClick={() => {
                          setShowProfileDropdown(false)
                          handleSignOut()
                        }}
                        className="flex items-center w-full px-3 sm:px-4 py-2 text-xs sm:text-sm text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-2 sm:mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8 pb-24 sm:pb-8">
        <Logo className="mb-12" />

        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div className="flex items-center space-x-2 group">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">{portfolio?.name}</h1>
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
                  className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground hover:text-foreground"
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
              className="px-3 py-2 sm:px-4 sm:py-2 text-sm sm:text-base text-red-800 border border-red-800 rounded-lg hover:bg-red-800 hover:text-white transition-colors flex items-center w-fit"
            >
              <svg
                className="w-4 h-4 mr-2"
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
              <span className="hidden sm:inline">Delete Portfolio</span>
              <span className="sm:hidden">Delete</span>
            </button>
          )}
        </div>

        {/* Members Section */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
            <h2 className="text-lg sm:text-xl font-semibold">Members</h2>
            {portfolio?.role !== 'viewer' && (
              <button
                onClick={() => {
                  setNewMemberUsername('')
                  setNewMemberRole('editor')
                  setShowUserDropdown(false)
                  setFilteredUsers([])
                  setShowAddMemberModal(true)
                }}
                className="px-3 py-2 sm:px-4 sm:py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm sm:text-base w-fit"
              >
                Add Member
              </button>
            )}
          </div>
          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.username}
                className="p-3 sm:p-4 bg-card rounded-xl shadow-lg border border-border group"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-base sm:text-lg font-medium">{member.username}</h3>
                    <p className="text-sm text-muted-foreground">Role: {member.role}</p>
                  </div>
                  {portfolio?.role === 'owner' && member.role !== 'owner' && (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedMember(member)
                          setNewRole(member.role)
                          setShowChangeRoleModal(true)
                        }}
                        className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center space-x-2 text-sm"
                      >
                        <svg
                          className="w-3 h-3 sm:w-4 sm:h-4"
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
                        className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity px-3 py-2 bg-red-800 text-white rounded-lg hover:bg-red-900 transition-colors flex items-center justify-center space-x-2 text-sm"
                      >
                        <svg
                          className="w-3 h-3 sm:w-4 sm:h-4"
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <h2 className="text-lg sm:text-xl font-semibold">Records</h2>
            <button
              onClick={() => fetchPortfolioData()}
              disabled={loading}
              className="px-3 py-2 sm:px-4 sm:py-2 bg-green-600 text-black rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center w-fit text-sm sm:text-base"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
          {scans.length === 0 ? (
            <div className="text-center py-8 bg-card rounded-xl border border-border">
              <p className="text-muted-foreground text-base sm:text-lg">No records found in this portfolio</p>
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
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card p-4 sm:p-6 rounded-xl shadow-lg w-full max-w-md">
              <h2 className="text-lg sm:text-xl font-bold mb-4">Add Member</h2>
              <div className="space-y-4">
                <div className="relative">
                  <label htmlFor="username" className="block text-sm font-medium text-muted-foreground mb-1">
                    Username
                  </label>
                  <input
                    ref={inputRef}
                    id="username"
                    type="text"
                    value={newMemberUsername}
                    onChange={(e) => handleUsernameChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                      // Show dropdown if there's text and we have results
                      if (newMemberUsername.trim() && filteredUsers.length > 0) {
                        setShowUserDropdown(true)
                      }
                    }}
                    onBlur={() => {
                      // Delay hiding to allow click on dropdown items
                      setTimeout(() => setShowUserDropdown(false), 150)
                    }}
                    placeholder="Start typing username..."
                    className="w-full px-3 py-2 sm:px-4 sm:py-2 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary focus:border-transparent text-sm sm:text-base"
                    autoComplete="off"
                  />
                  
                  {/* User Dropdown */}
                  {showUserDropdown && (
                    <div 
                      ref={dropdownRef}
                      className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-48 overflow-y-auto"
                      style={{ 
                        top: '100%',
                        backgroundColor: '#1f2937',
                        border: '1px solid #374151'
                      }}
                    >
                      {filteredUsers.length > 0 ? (
                        filteredUsers.map((user, index) => {
                          const isExistingMember = members.some(m => m.username === user.username)
                          return (
                            <button
                              key={user.username}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault()
                                if (!isExistingMember) {
                                  selectUser(user.username)
                                }
                              }}
                              disabled={isExistingMember}
                              className={`w-full px-3 py-2 sm:px-4 sm:py-3 text-left transition-colors border-b border-gray-700 last:border-b-0 text-sm ${
                                isExistingMember 
                                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                  : index === selectedUserIndex 
                                    ? 'bg-gray-600 hover:bg-gray-600 text-white' 
                                    : 'bg-gray-800 hover:bg-gray-600 text-white'
                              }`}
                            >
                              <div className="font-medium">
                                {user.username}
                                {isExistingMember && (
                                  <span className="text-xs text-gray-400 ml-2">(already member)</span>
                                )}
                              </div>
                            </button>
                          )
                        })
                      ) : (
                        <div className="px-3 py-2 sm:px-4 sm:py-3 text-gray-300 text-sm">
                          No users found matching "{newMemberUsername}"
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label htmlFor="role" className="block text-sm font-medium text-muted-foreground mb-1">
                    Role
                  </label>
                  <select
                    id="role"
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value)}
                    className="w-full px-3 py-2 sm:px-4 sm:py-2 rounded-lg bg-background border border-border text-sm sm:text-base"
                  >
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 mt-6">
                <button
                  onClick={() => {
                    setShowAddMemberModal(false)
                    setNewMemberUsername('')
                    setNewMemberRole('editor')
                    setShowUserDropdown(false)
                    setFilteredUsers([])
                  }}
                  className="px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 order-2 sm:order-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddMember}
                  disabled={!newMemberUsername.trim()}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed order-1 sm:order-2"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rename Portfolio Modal */}
        {showRenameModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card p-4 sm:p-6 rounded-xl shadow-lg w-full max-w-md">
              <h2 className="text-lg sm:text-xl font-bold mb-4">Rename Portfolio</h2>
              <input
                type="text"
                value={newPortfolioName}
                onChange={(e) => setNewPortfolioName(e.target.value)}
                placeholder="Enter new portfolio name"
                className="w-full px-3 py-2 sm:px-4 sm:py-2 rounded-lg bg-background border border-border mb-4 text-sm sm:text-base"
              />
              <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4">
                <button
                  onClick={() => {
                    setShowRenameModal(false)
                    setNewPortfolioName('')
                  }}
                  className="px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 order-2 sm:order-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRenamePortfolio}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 order-1 sm:order-2"
                >
                  Rename
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Portfolio Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card p-4 sm:p-6 rounded-xl shadow-lg w-full max-w-md">
              <h2 className="text-lg sm:text-xl font-bold mb-4">Delete Portfolio</h2>
              <p className="text-destructive mb-6 text-sm sm:text-base">
                Are you sure you want to delete this portfolio? This action cannot be undone.
              </p>
              <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 order-2 sm:order-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeletePortfolio}
                  className="px-4 py-2 bg-red-800 text-white rounded-lg hover:bg-red-950 transition-colors order-1 sm:order-2"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Change Role Modal */}
        {showChangeRoleModal && selectedMember && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card p-4 sm:p-6 rounded-xl shadow-lg w-full max-w-md">
              <h2 className="text-lg sm:text-xl font-bold mb-4">Change Member Role</h2>
              <p className="mb-4 text-sm sm:text-base">Change role for {selectedMember.username}</p>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="w-full px-3 py-2 sm:px-4 sm:py-2 rounded-lg bg-background border border-border mb-4 text-sm sm:text-base"
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4">
                <button
                  onClick={() => {
                    setShowChangeRoleModal(false)
                    setSelectedMember(null)
                    setNewRole('')
                  }}
                  className="px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 order-2 sm:order-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleChangeRole}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 order-1 sm:order-2"
                >
                  Change Role
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Member Modal */}
        {showDeleteMemberModal && selectedMember && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card p-4 sm:p-6 rounded-xl shadow-lg w-full max-w-md">
              <h2 className="text-lg sm:text-xl font-bold mb-4">Remove Member</h2>
              <p className="text-destructive mb-6 text-sm sm:text-base">
                Are you sure you want to remove {selectedMember.username} from this portfolio? This action cannot be undone.
              </p>
              <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4">
                <button
                  onClick={() => {
                    setShowDeleteMemberModal(false)
                    setSelectedMember(null)
                  }}
                  className="px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 order-2 sm:order-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteMember}
                  className="px-4 py-2 bg-red-800 text-white rounded-lg hover:bg-red-900 transition-colors order-1 sm:order-2"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error Dialog */}
        {showErrorDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card p-4 sm:p-6 rounded-xl shadow-lg w-full max-w-md">
              <div className="text-destructive text-base sm:text-lg font-semibold mb-4">
                Error
              </div>
              <p className="text-destructive mb-6 text-sm sm:text-base">{error}</p>
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

        {/* Mobile-friendly bottom navigation */}
        <div className="mt-6 flex justify-center">
          <Link
            to="/history"
            className="flex items-center justify-center px-6 py-3 bg-card hover:bg-accent rounded-lg font-semibold transition-all duration-200 text-foreground hover:text-accent-foreground border border-border"
          >
            <span className="mr-2">←</span> Back to History
          </Link>
        </div>
      </div>
    </div>
  )
}