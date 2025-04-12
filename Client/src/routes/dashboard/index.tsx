



import { Logo } from '@/components/logo/logo'
import { createFileRoute } from '@tanstack/react-router'
import { Link } from '@tanstack/react-router'
import { useAuth } from '@/hooks/useAuth'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useState } from 'react'

export const Route = createFileRoute('/dashboard/')({
  component: DashboardComponent,
})

function DashboardComponent() {
  useAuth() // This will handle the authentication check and redirect
  const [showDialog, setShowDialog] = useState(false)

  const handleUploadVideo = () => {
    setShowDialog(true)
    // Hide the dialog after 3 seconds
    setTimeout(() => setShowDialog(false), 1000)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Logo className="mb-12" />

        {/* Alert Dialog */}
        <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
          <AlertDialogContent className="bg-card border border-border">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-primary">Coming Soon!</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                Video upload feature will be available in a future update.
              </AlertDialogDescription>
            </AlertDialogHeader>
          </AlertDialogContent>
        </AlertDialog>

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

        {/* Navigation */}
        <div className="flex justify-between">
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-foreground bg-card border border-border rounded-lg hover:bg-accent transition-colors duration-200"
          >
            ← Back
          </button>
          <button
            onClick={() => window.history.forward()}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-foreground bg-card border border-border rounded-lg hover:bg-accent transition-colors duration-200"
          >
            Forward →
          </button>
        </div>
      </div>
    </div>
  )
}






