import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Logo } from '@/components/logo/logo'
import WebcamCapture from '@/components/webcam/webcam'
import type { ApiResponseFoundCode } from '@/lib/api'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useAuth } from '@/hooks/useAuth'


export const Route = createFileRoute('/record/')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [isRecording, setIsRecording] = useState(false)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [showAlert, setShowAlert] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const [alertTitle, setAlertTitle] = useState('')
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)

  const handleStartRecording = () => {
    setIsRecording(true)
    setCapturedImage(null)
    setShowAlert(false)
  }

  const handleStopRecording = () => {
    setIsRecording(false)
  }

  const handleToggleRecording = () => {
    setIsRecording(prev => !prev)
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

 const handleCapture = async (imageSrc: string) => {
  try {
    // Create the base request body without location
    const requestBody: any = {
      image: imageSrc.split(',')[1], // Base64 without prefix
    };

    // Try to get location, but don't block the request if it fails
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 5000, // 5 second timeout
          maximumAge: 0,
          enableHighAccuracy: true
        });
      });

      // If we got location, add it to the request
      requestBody.location = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
    } catch (locationError) {
      console.log('Location not available, proceeding without location data');
    }

    // Send the request to the server
    const response = await fetch('/record/img', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.error('Failed to send image to server');
      return;
    }

    const data = await response.json();

    if (data && data.message && Array.isArray(data.message) && data.message.length > 0) {
      // Check if the first item is not a "No results" message
      if (!data.message[0][0].includes('No')) {
        setAlertTitle('Found Items');
        setAlertMessage(data.message);
        setShowAlert(true);
      }
    }
  } catch (error) {
    console.error('Error sending image:', error);
  }
};

  return (
    <div className="h-screen bg-background text-foreground overflow-hidden flex flex-col"
    style={{ backgroundImage: "url('/images/background.jpg')" }}>
      
      {/* Header with Profile */}
      <div className="flex-shrink-0 sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Left side - Page title */}
            <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <h1 className="text-base sm:text-lg font-semibold text-foreground truncate">Live Recording</h1>
              
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

      {/* Logo */}
      <div className="flex-shrink-0 px-4 py-4">
        <Logo />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 px-4 pb-4 flex flex-col min-h-0">
        <div className="bg-card border border-border rounded-xl shadow-2xl p-4 flex-1 flex flex-col min-h-0">
          
          {/* Camera/Content Area */}
          <div className="flex-1 flex flex-col items-center justify-center min-h-0">
            {isRecording ? (
              <div className="w-full h-full flex flex-col">
                <div className="flex-1 bg-black rounded-lg overflow-hidden relative" style={{ minHeight: 'calc(100vh - 400px)' }}>
                  {/* Alert inside camera window */}
                  {showAlert && (
                    <div className="absolute top-2 left-2 z-[100]">
                      <Alert className="border border-green-500/20 bg-zinc-900/90 shadow-none p-2 rounded-md min-w-[220px] max-w-xs text-xs relative">
                        <button
                          onClick={() => setShowAlert(false)}
                          className="absolute top-1 right-1 text-green-400 hover:text-green-600 text-xs p-1"
                          aria-label="Close"
                        >
                          ×
                        </button>
                        <AlertTitle className="text-green-400 font-semibold text-xs mb-1">{alertTitle}</AlertTitle>
                        <AlertDescription className="text-green-400">
                          {(() => {
                            if (!Array.isArray(alertMessage)) return null;
                            const groupedItems = alertMessage.reduce((acc, [value, type]: [string, string]) => {
                              if (!acc[type]) {
                                acc[type] = [];
                              }
                              acc[type].push(value);
                              return acc;
                            }, {} as Record<string, string[]>);
                            return (Object.entries(groupedItems) as [string, string[]][]).map(([type, values]) => (
                              <div key={type} className="mb-0.5">
                                <span className="font-semibold mr-1">{type}:</span>
                                {values.map((value: string, idx: number) => (
                                  <span key={idx} className="ml-1 inline-block">{value}</span>
                                ))}
                              </div>
                            ));
                          })()}
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}
                  <WebcamCapture
                    onCapture={handleCapture}
                    isRecording={isRecording}
                    onToggleRecording={handleToggleRecording}
                  />
                </div>
                <div className="flex-shrink-0 flex justify-center mt-4">
                  <button
                    onClick={handleStopRecording}
                    className="px-8 py-3 bg-destructive hover:bg-red-600 text-white rounded-lg font-semibold transition-all duration-200"
                  >
                    Stop Recording
                  </button>
                </div>
              </div>
            ) : capturedImage ? (
              <div className="flex flex-col items-center space-y-4 h-full justify-center">
                <img
                  src={capturedImage}
                  alt="Captured"
                  className="max-w-full max-h-[60%] object-contain rounded-lg shadow-lg"
                />
                <button
                  onClick={handleStartRecording}
                  className="px-6 py-3 rounded-lg font-semibold transition-all duration-200 bg-primary hover:bg-accent hover:text-accent-foreground"
                >
                  Start Recording
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-6">
                <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-muted-foreground" />
                </div>
                <button
                  onClick={handleStartRecording}
                  className="px-6 py-3 rounded-lg font-semibold transition-all duration-200 bg-primary hover:bg-accent hover:text-accent-foreground"
                >
                  Start Recording
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}