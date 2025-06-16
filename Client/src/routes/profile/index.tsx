import { Logo } from '@/components/logo/logo'
import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { createFileRoute, useRouter, Link, useNavigate } from '@tanstack/react-router'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Header } from '@/components/header/header'

export const Route = createFileRoute('/profile/')({
  component: ProfileComponent,
})

type User = {
  username: string;
  joinDate?: string;
  totalRecordings?: number;
  lastActive?: string;
}

function ProfileComponent() {
  const auth = useAuth()
  const router = useRouter()
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [userData, setUserData] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  
  // Get username from localStorage
  const username = localStorage.getItem('username') || 'User'

  useEffect(() => {
    async function fetchUserData() {
      try {
        setIsLoading(true)
        const response = await fetch('/api/user/profile', {
          credentials: 'include',
        })

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Profile fetch error:", response.status, errorText);
          throw new Error(`Error ${response.status}: ${errorText || response.statusText}`);
        }

        const data = await response.json()
        console.log("Profile data:", data);  // Add logging to debug
        
        if (data && data.user) {
          setUserData(data.user)
        } else {
          // Fallback if API returns success but empty data
          setUserData({ username })
        }
      } catch (err) {
        console.error("Profile error:", err);
        setError(err instanceof Error ? err.message : 'Failed to load profile')
        // Ensure we have some basic data to display
        setUserData({ username })
      } finally {
        setIsLoading(false)
      }
    }

    fetchUserData()
  }, [username])

  const handleDeleteAccount = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch('/api/user/delete', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })
  
      if (!response.ok) {
        throw new Error(`Failed to delete account: ${response.status}`)
      }
  
      // Clear localStorage
      localStorage.removeItem('username')
      
      // Log out the user
      await logout()
      
      // Redirect to signup page
      navigate({ to: '/signup' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account')
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex justify-center items-center"
        style={{ backgroundImage: "url('/images/background.jpg')" }}>
        <div className="text-primary">Loading profile...</div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      style={{ backgroundImage: "url('/images/background.jpg')" }}
    >
      <Header 
        title="My Profile"
        icon={
          <svg className="w-3 h-3 sm:w-4 sm:h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        }
      />

      <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <Logo className="mb-12" />

        <div className="bg-card rounded-xl shadow-2xl p-8 space-y-6 border border-border">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-primary">User Profile</h2>
          </div>

          {error && (
            <div className="bg-destructive/20 p-4 rounded-lg text-destructive">
              {error}
            </div>
          )}

          {userData ? (
            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">
                    {userData.username?.charAt(0).toUpperCase() || '?'}
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-semibold">{userData.username || username}</h3>
                  <p className="text-muted-foreground">
                    Welcome back!
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div className="text-center">
                  <p className="text-lg font-medium">{userData.totalRecordings ?? 0}</p>
                  <p className="text-muted-foreground">Total Recordings</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-medium">Active</p>
                  <p className="text-muted-foreground">Status</p>
                </div>
              </div>

              <div className="pt-4 border-t border-border space-y-4">
                <Button
                  onClick={() => setShowDeleteDialog(true)}
                  variant="destructive"
                  className="w-full"
                >
                  Delete Account
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              <p>No user data found.</p>
              <p className="mt-2">Username from localStorage: {username}</p>
            </div>
          )}
        </div>

        {/* Delete Account Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent className="bg-card border border-border">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-destructive">Delete Account</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently removed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? 'Deleting...' : 'Yes, delete my account'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}

export default ProfileComponent