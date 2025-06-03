import { createFileRoute, Link, useRouter, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth.ts'
import { Logo } from '@/components/logo/logo'
import type { Record, RecordResponse } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Eye, ArrowRight } from 'lucide-react' // Add these imports
import EnhancedOSINTDisplay from '@/components/OSINT' // Add OSINT component import

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-IL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jerusalem'
  });
}

// Extract all rows of data, splitting by newline
function getAllRows(data: string): Array<{ value: string, type: string }> {
  // Split by newline and filter out empty lines
  const lines = data.split('\n').filter(line => line.trim() !== '');
  if (lines.length === 0) {
    return [{
      value: 'No data',
      type: 'Unknown'
    }];
  }

  return lines.map(line => {
    const parts = line.split(':');
    if (parts.length >= 2 && parts[1].trim() !== '') {
      return {
        value: parts[0].trim(),
        type: parts[1].trim()
      };
    }
    return {
      value: line.trim(),
      type: 'Unknown'
    };
  });
}

export const Route = createFileRoute('/history/$item')({
  component: RouteComponent,
  loader: async ({ params }) => {
    const response = await fetch(`/history/record/${params.item}`, {credentials: 'include'})
    if (!response.ok) {
      throw new Error(`Error: ${response.status} - ${response.statusText}`)
    }
    return response.json()
  },  
})

// Custom confirmation modal component
function ConfirmationModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  isDeleting 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onConfirm: () => void, 
  isDeleting: boolean 
}) {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card rounded-xl p-6 max-w-md w-11/12 shadow-xl">
        <h3 className="text-xl font-bold mb-4">Confirm Deletion</h3>
        <p className="mb-6">
          Are you sure you want to delete this record? This action cannot be undone.
        </p>
        <div className="flex justify-end space-x-3">
          <Button
            onClick={onClose}
            variant="outline"
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function RouteComponent() {
  useAuth() // Add authentication check
  const router = useRouter()
  const navigate = useNavigate()
  const { logout } = useAuth()
  const data: RecordResponse = Route.useLoaderData()
  const [error, setError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showOSINT, setShowOSINT] = useState(false)
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  const [picShow, setPicShow] = useState(false)
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [showPicError, setShowPicError] = useState<string | null>(null);
  const [picLoading, setPicLoading] = useState(false);
  const params = Route.useParams()
  
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
  
  // Handle OSINT enhancement
  const handleOSINTEnhance = async () => {
  try {
    console.log(`⚡ Starting QUICK OSINT enhancement for scan ${params.item}`);
    
    // Use the new quick OSINT endpoint for speed
    const quickResponse = await fetch(`/api/quick-osint/${params.item}`, {
      method: 'POST',
      credentials: 'include'
    });
    
    if (quickResponse.ok) {
      const quickData = await quickResponse.json();
      console.log('⚡ Quick OSINT results:', quickData);
      
      if (quickData.success) {
        console.log('✅ Quick enhancement completed in under 10 seconds!');
        console.log(`📊 Performance: ${quickData.performance?.estimated_time}`);
        console.log(`🔍 Generated ${quickData.performance?.results_generated} results`);
        setShowOSINT(true);
        return;
      } else {
        console.error('❌ Quick OSINT failed:', quickData.message);
        // Fall back to regular enhancement
        console.log('⚠️ Falling back to regular enhancement...');
      }
    } else {
      console.log('⚠️ Quick mode failed, trying regular enhancement...');
    }
    
    // Fallback: Use force refresh (slower but more comprehensive)
    console.log(`🔄 Using comprehensive enhancement as fallback...`);
    const refreshResponse = await fetch(`/api/force-refresh-osint/${params.item}`, {
      method: 'POST',
      credentials: 'include'
    });
    
    if (refreshResponse.ok) {
      const refreshData = await refreshResponse.json();
      console.log('✅ Comprehensive enhancement results:', refreshData);
      
      if (refreshData.success) {
        console.log('✅ Comprehensive enhancement completed');
        setShowOSINT(true);
        return;
      }
    }
    
    // Final fallback
    alert('Enhancement failed. Please try again.');
    
  } catch (error) {
    console.error('❌ Enhancement error:', error);
    alert(`Enhancement error: ${error}`);
  }
};

  const handleBackFromOSINT = () => {
    setShowOSINT(false);
  };
  
  // Handle modal open
  const handleDeleteClick = () => {
    setShowModal(true);
  };
  
  // Handle modal close
  const handleModalClose = () => {
    setShowModal(false);
  };

  const handleShowPicture = async () => {
    setShowPicError(null);
    setPicLoading(true);
    try {
      const response = await fetch(`/api/scan/${params.item}/image`, {
        credentials: 'include',
      });
  
      if (!response.ok) {
        if (response.status === 404) {
          setShowPicError('No screenshot found for this record.');
        } else {
          setShowPicError('Failed to load screenshot. Please try again.');
        }
        setPicShow(false);
        return;
      }
  
      const data = await response.json();
      if (!data.image_base64) {
        setShowPicError('No screenshot found for this record.');
        setPicShow(false);
        return;
      }
      setBase64Image(data.image_base64);
      setPicShow(true);
    } catch (error) {
      setShowPicError('Failed to load screenshot. Please try again.');
      setPicShow(false);
    } finally {
      setPicLoading(false);
    }
  };
  
  
  // Handle delete confirmation
  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      // Using POST instead of DELETE with a specific action parameter
      const response = await fetch(`/history/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ 
          recordId: params.item,
          action: 'delete'
        })
      })
      
      if (!response.ok) {
        throw new Error(`Failed to delete: ${response.status} - ${response.statusText}`)
      }
      
      // Redirect to history page after successful deletion
      router.navigate({ to: '/history' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete record')
      setIsDeleting(false)
      setShowModal(false)
    }
  };
  
  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showModal) {
        handleModalClose();
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showModal]);
  
  if (error || !data || !data.record || data.record.length === 0) {
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h1 className="text-base sm:text-lg font-semibold text-foreground truncate">Record Details</h1>
                
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

        <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <Logo className="mb-12" />
          <div className="bg-card rounded-xl shadow-2xl p-8">
            <p className="text-destructive text-center">{error || 'Record not found'}</p>
            {error && (
              <div className="mt-4 flex justify-center">
                <Link
                  to="/history"
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium"
                >
                  Go back to History
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Show OSINT component if requested
  if (showOSINT) {
    return (
      <EnhancedOSINTDisplay 
        scanId={parseInt(params.item)} 
        onClose={handleBackFromOSINT}
      />
    );
  }

  const record = data.record[0];
  const rows = getAllRows(record[2]);

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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h1 className="text-base sm:text-lg font-semibold text-foreground truncate">Record Details</h1>
              
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
        
        <div className="bg-card rounded-xl shadow-2xl p-6 sm:p-8 space-y-6">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h2 className="text-xl sm:text-2xl font-semibold text-primary">Recording Details</h2>
              <div className="flex items-center gap-2">
                <div className="px-3 py-1 rounded-full text-sm font-medium bg-green-500/20 text-green-400 w-fit">
                  Processing Successful
                </div>
                <Button
                  onClick={handleDeleteClick}
                  disabled={isDeleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 flex items-center gap-2 px-3 py-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-muted-foreground">Date</p>
              <p className="text-foreground">{formatDate(record[1])}</p>
            </div>

            <div className="space-y-2">
              <p className="text-muted-foreground">Content</p>
              <div className="space-y-2">
                {rows.map((row, index) => (
                  <div key={index} className="bg-muted rounded-lg p-3 sm:p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground font-medium break-words">{row.value}</p>
                      <p className="text-sm text-muted-foreground mt-1">Type: {row.type}</p>
                    </div>
                    <div className="px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary w-fit flex-shrink-0">
                      {`Entry ${index + 1}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="pt-4 border-t border-border space-y-3">
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={handleOSINTEnhance}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  <span className="text-sm sm:text-base">Enhance with OSINT</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                
                <div className="text-xs text-gray-500 text-center">
                  Click to start OSINT intelligence gathering
                </div>
              </div>

              <Button 
                disabled={picShow || picLoading}
                onClick={handleShowPicture}
                className={`w-full bg-blue-600 text-white rounded-lg transition-all duration-150
                  ${picLoading ? 'opacity-60 cursor-not-allowed' : 'hover:bg-blue-700 active:scale-95'}
                  ${picShow ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {picLoading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin h-4 w-4 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                    </svg>
                    Loading...
                  </span>
                ) : (
                  'Show screenshot'
                )}
              </Button>
              {showPicError && (
                <div className="mt-2 text-red-500 text-sm text-center animate-pulse">{showPicError}</div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile-friendly bottom navigation */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:justify-center">
          <Link
            to="/history"
            className="flex items-center justify-center px-6 py-3 bg-card hover:bg-accent rounded-lg font-semibold transition-all duration-200 text-foreground hover:text-accent-foreground border border-border"
          >
            <span className="mr-2">←</span> Back to History
          </Link>
          <Link
            to="/dashboard"
            className="flex items-center justify-center px-6 py-3 bg-card hover:bg-accent rounded-lg font-semibold transition-all duration-200 text-foreground hover:text-accent-foreground border border-border"
          >
            Dashboard <span className="ml-2">→</span>
          </Link>
        </div>
      </div>
      
      {/* Confirmation Modal */}
      <ConfirmationModal 
        isOpen={showModal}
        onClose={handleModalClose}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />

      {/* Floating modal for screenshot */}
      {picShow && base64Image && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="relative bg-card rounded-lg shadow-2xl p-4 max-w-full max-h-full flex flex-col items-center">
            <div className="absolute top-2 right-2 flex gap-2">
              <button
                onClick={() => setPicShow(false)}
                className="text-gray-400 hover:text-red-500 text-xl font-bold focus:outline-none px-2"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <p className="mb-2 font-medium text-sm text-muted-foreground mt-8">Best Frame</p>
            <div className="overflow-auto max-h-[80vh] max-w-[80vw] flex items-center justify-center">
              <img 
                src={base64Image} 
                alt="Best Frame" 
                className="max-w-full max-h-[70vh] h-auto rounded-md border"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}