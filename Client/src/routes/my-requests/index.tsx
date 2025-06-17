import { useEffect, useState } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/logo/logo"
import { useAuth } from '@/hooks/useAuth'

export const Route = createFileRoute("/my-requests/")({
  component: MyRequestsComponent,
})

type Request = {
  requestId: number
  portfolioTitle: string
  requesterName: string
}

function MyRequestsComponent() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [requests, setRequests] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)

  const handleSignOut = async () => {
    await logout()
    navigate({ to: '/login' })
  }

  // Handle click outside to close profile dropdown
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

  useEffect(() => {
    async function fetchRequests() {
      try {
        const res = await fetch("/portfolio/request/pending", {
          credentials: "include",
        })

        if (!res.ok) {
          throw new Error(`Failed to fetch: ${res.status}`)
        }

        const data = await res.json()
        setRequests(
          (data.requests || []).map((row: any[]) => ({
            requestId: row[0],          // request_id
            portfolioTitle: row[4],     // portfolio_name
            requesterName: row[3],      // requester_name
          }))
        )
      } catch (err) {
        console.error("Error fetching requests:", err)
        setError("Failed to load requests")
      } finally {
        setLoading(false)
      }
    }

    fetchRequests()
  }, [])

  const respond = async (requestId: number, action: "approve" | "reject") => {
    try {
      const payload = { requestId, action }
      console.log("Sending payload:", payload)

      const res = await fetch("/portfolio/request/respond", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(errorText)
      }

      setRequests((prev) => prev.filter((r) => r.requestId !== requestId))
    } catch (err) {
      console.error("Failed to respond:", err)
      setError("Failed to send response")
    }
  }

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      style={{ backgroundImage: "url('/images/background.jpg')" }}
    >
      {/* Header with Profile */}
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Left side - Page title */}
            <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h1 className="text-base sm:text-lg font-semibold text-foreground truncate">My Requests</h1>
              
              {/* Home button - hidden on very small screens, visible on sm+ */}
              <Link
                to="/dashboard"
                className="hidden sm:flex items-center px-2 py-1 sm:px-3 sm:py-1.5 bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors ml-2 sm:ml-4"
                title="Go to Dashboard"
              >
                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span className="ml-1 text-xs sm:text-sm font-medium text-primary">Home</span>
              </Link>
            </div>

            {/* Right side - Profile dropdown and mobile home button */}
            <div className="flex items-center space-x-2">
              {/* Mobile-only home button */}
              <Link
                to="/dashboard"
                className="sm:hidden flex items-center justify-center p-2 bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
                title="Go to Dashboard"
              >
                <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
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
      
      <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <Logo className="mb-12" />

        <div className="bg-card rounded-xl shadow-2xl p-8 space-y-6 border border-border">
          <h2 className="text-2xl font-semibold text-primary">Pending Requests</h2>

          {loading && <p className="text-muted-foreground">Loading...</p>}

          {error && (
            <div className="bg-destructive/20 p-4 rounded-lg text-destructive">
              {error}
            </div>
          )}

          {requests.length === 0 && !loading && (
            <p className="text-muted-foreground">No pending requests.</p>
          )}

          <ul className="space-y-4">
            {requests.map((r) => (
              <li
                key={r.requestId}
                className="p-4 bg-muted rounded-lg border border-border"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">
                      Request from{" "}
                      <span className="text-primary">{r.requesterName}</span> for
                      portfolio{" "}
                      <span className="font-semibold">{r.portfolioTitle}</span>
                    </p>
                  </div>
                  <div className="space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => respond(r.requestId, "approve")}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => respond(r.requestId, "reject")}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

export default MyRequestsComponent