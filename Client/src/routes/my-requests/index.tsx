import { useEffect, useState } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/logo/logo"
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/header/header'

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
      <Header 
        title="My Requests"
        icon={
          <svg className="w-3 h-3 sm:w-4 sm:h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        }
      />

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