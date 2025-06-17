import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useState, useEffect, useRef } from 'react'
import WebcamCapture from '@/components/webcam/webcam'
import type { ApiResponseFoundCode } from '@/lib/api'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/header/header'
import { Logo } from '@/components/logo/logo'

export const Route = createFileRoute('/record/')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [isRecording, setIsRecording] = useState(false)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [showAlert, setShowAlert] = useState(false)
  const [alertMessage, setAlertMessage] = useState<[string, string][]>([])
  const [alertTitle, setAlertTitle] = useState('')
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  const webcamRef = useRef<any>(null)
  const [showOtpToast, setShowOtpToast] = useState(false)
  const [otpValue, setOtpValue] = useState<string | null>(null)
  const lastAlertMessageRef = useRef<string>("")

  const handleStartRecording = () => {
    setIsRecording(true)
    setCapturedImage(null)
    setShowAlert(false)
  }

  const handleStopRecording = async () => {
    console.log("Stopping recording...");
    try {
      // Call endSession on the webcam component first
      if (webcamRef.current && webcamRef.current.endSession) {
        await webcamRef.current.endSession();
      }
      // Now set isRecording to false to trigger cleanup
      setIsRecording(false);
      // Wait a bit to ensure the session end request is sent
      await new Promise(resolve => setTimeout(resolve, 1000));
      setCapturedImage(null);
      setShowAlert(false);
    } catch (error) {
      console.error("Error stopping recording:", error);
    }
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

    if (data.otp_found) {
      setOtpValue(data.otp_found);
      setShowOtpToast(true);
      setTimeout(() => setShowOtpToast(false), 3000);
      // Copy to clipboard
      try {
        await navigator.clipboard.writeText(data.otp_found);
      } catch (err) {
        console.warn('Failed to copy OTP to clipboard:', err);
      }
    }
    if (data && data.message && Array.isArray(data.message) && data.message.length > 0) {
      // Check if the first item is not a "No results" message
      if (!data.message[0][0].includes('No')) {
        const newMessageString = JSON.stringify(data.message);
        if (newMessageString !== lastAlertMessageRef.current) {
          setAlertTitle('Found Items');
          setAlertMessage(data.message as [string, string][]);
          setShowAlert(true);
          lastAlertMessageRef.current = newMessageString;
        }
      }
    }
  } catch (error) {
    console.error('Error sending image:', error);
  }
};

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      style={{ backgroundImage: "url('/images/background.jpg')" }}
    >
      <Header 
        title="Record"
        icon={
          <svg className="w-3 h-3 sm:w-4 sm:h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        }
      />

      <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <Logo className="mb-12" />

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
                        <Alert className={`border border-green-500/20 bg-zinc-900/90 shadow-none p-2 rounded-md min-w-[220px] max-w-xs text-xs relative`}>
                          <button
                            onClick={() => setShowAlert(false)}
                            className={`absolute top-1 right-1 text-green-400 hover:text-green-600 text-xs p-1`}
                            aria-label="Close"
                          >
                            ×
                          </button>
                          <AlertTitle className={`text-green-400 font-semibold text-xs mb-1`}>
                            {alertTitle}
                          </AlertTitle>
                          <AlertDescription className={`text-green-400`}>
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
                      ref={webcamRef}
                      onCapture={handleCapture}
                      isRecording={isRecording}
                      onToggleRecording={handleToggleRecording}
                      onStopRecording={handleStopRecording}
                    />
                  </div>
                  <div className="flex-shrink-0 flex justify-center mt-4">
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

      {/* OTP Toast Notification */}
      {showOtpToast && otpValue && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-[200]">
          <div className="bg-yellow-500 text-black font-semibold px-6 py-2 rounded-full shadow-lg border border-yellow-700 text-lg animate-fade-in-out">
            OTP Copied: <span className="font-mono">{otpValue}</span>
          </div>
        </div>
      )}
    </div>
  )
}