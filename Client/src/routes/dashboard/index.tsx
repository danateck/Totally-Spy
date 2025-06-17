import { Logo } from '@/components/logo/logo'
import { createFileRoute, useRouter, Link } from '@tanstack/react-router'
import { useAuth } from '@/hooks/useAuth'
import VideoUpload from '@/components/video-upload/VideoUpload'
import { useState, useEffect } from 'react'
import { Header } from '@/components/header/header'

export const Route = createFileRoute('/dashboard/')({
  component: DashboardComponent,
})

function DashboardComponent() {
  const { logout } = useAuth()
  const router = useRouter()
  const [showVideoUpload, setShowVideoUpload] = useState(false)
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)

  const handleUploadVideo = () => {
    setShowVideoUpload(true)
  }

  const handleSignOut = async () => {
    await logout()
    router.navigate({ to: '/login' })
  }

  const handleCloseVideoUpload = () => {
    setShowVideoUpload(false)
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

  return (
    <div
      className="min-h-screen bg-background text-foreground relative"
      style={{ backgroundColor: "black" }}
    >
      <Header 
        title="Dashboard"
        icon={
          <svg className="w-3 h-3 sm:w-4 sm:h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5v4" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 5v4" />
          </svg>
        }
      />

      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <Logo className="mb-12" />

        {/* Video Upload Modal */}
        {showVideoUpload && (
          <VideoUpload onClose={handleCloseVideoUpload} />
        )}

        {/* Main Actions */}
        <div className="grid gap-6 md:grid-cols-3 mb-12">
          <button
            onClick={handleUploadVideo}
            className="flex items-center justify-center p-6 bg-card rounded-xl shadow-2xl hover:shadow-xl transition-all duration-200 border border-border hover:border-accent"
          >
            <div className="text-center">
              <svg
                className="w-8 h-8 mx-auto mb-3 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <span className="text-foreground font-medium">Upload A Video</span>
            </div>
          </button>

          <Link
            to="/record"
            className="flex items-center justify-center p-6 bg-card rounded-xl shadow-2xl hover:shadow-xl transition-all duration-200 border border-border hover:border-accent"
          >
            <div className="text-center">
              <svg
                className="w-8 h-8 mx-auto mb-3 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              <span className="text-foreground font-medium">Take A Video</span>
            </div>
          </Link>

          <Link
            to="/history"
            className="flex items-center justify-center p-6 bg-card rounded-xl shadow-2xl hover:shadow-xl transition-all duration-200 border border-border hover:border-accent"
          >
            <div className="text-center">
              <svg
                className="w-8 h-8 mx-auto mb-3 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-foreground font-medium">View History</span>
            </div>
          </Link>
        </div>

        {/* Quick Tips Section */}
        <div className="mt-8 bg-card/50 rounded-xl p-6 border border-border">
          <div className="flex items-center mb-4">
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center mr-3">
              <svg className="w-3 h-3 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-foreground">Quick Tips</h3>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2 text-sm text-muted-foreground">
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0"></div>
              <p><span className="font-medium text-foreground">Upload videos</span> to analyze existing recordings</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0"></div>
              <p><span className="font-medium text-foreground">Record live</span> to capture new content</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0"></div>
              <p><span className="font-medium text-foreground">View history</span> to manage all your recordings</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0"></div>
              <p><span className="font-medium text-foreground">Organize</span> recordings into portfolios</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
