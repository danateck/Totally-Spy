import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Logo } from '@/components/logo/logo'
import WebcamCapture from '@/components/webcam/webcam'
import type { ApiResponseFoundCode } from '@/lib/api'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export const Route = createFileRoute('/record/')({
  component: RouteComponent,
})

function RouteComponent() {
  const [isRecording, setIsRecording] = useState(false)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [showAlert, setShowAlert] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const [alertTitle, setAlertTitle] = useState('')

  const handleStartRecording = () => {
    setIsRecording(true)
    setCapturedImage(null)
    setShowAlert(false)
  }

  const handleStopRecording = () => {
    setIsRecording(false)
  }

  const handleCapture = async (imageSrc: string) => {
    try {
      const response = await fetch('/record/img', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ image: imageSrc.split(',')[1] })
      });
      const data: ApiResponseFoundCode = await response.json();

      if (!response.ok) {
        console.error('Failed to send image to server');
      } else if (data.message.length > 0 && !data.message[0].includes('No')) {
        setAlertTitle(data.message[0] || 'Success');
        setAlertMessage(data.message[1] || 'Code found!');
        setShowAlert(true);
      }
    } catch (error) {
      console.error('Error sending image:', error);
    }
  }

  return (
    <div className="h-screen bg-background text-foreground overflow-hidden flex flex-col"
    style={{ backgroundImage: "url('/images/background.jpg')" }}>
      
      {/* Header with Logo */}
      <div className="flex-shrink-0 px-4 py-4">
        <Logo />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 px-4 pb-20 flex flex-col min-h-0">
        <div className="bg-card border border-border rounded-xl shadow-2xl p-4 flex-1 flex flex-col min-h-0">
          
          {/* Alert */}
          {showAlert && (
            <div className="flex-shrink-0 mb-4">
              <Alert className="border border-green-500/20 bg-green-500/10">
                <AlertTitle className="text-green-400">{alertTitle}</AlertTitle>
                <AlertDescription className="text-green-400">{alertMessage}</AlertDescription>
              </Alert>
            </div>
          )}

          {/* Camera/Content Area */}
          <div className="flex-1 flex flex-col items-center justify-center min-h-0">
            {isRecording ? (
              <div className="w-full h-full flex flex-col">
                <div className="flex-1 min-h-0">
                  <WebcamCapture
                    onCapture={handleCapture}
                    isRecording={isRecording}
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

      {/* Fixed Bottom Navigation - Hidden when recording */}
      {!isRecording && (
        <div className="flex-shrink-0 absolute bottom-4 left-0 right-0 flex justify-center space-x-4 px-4">
          <Link
            to="/dashboard"
            className="px-6 py-3 bg-muted hover:bg-muted-foreground rounded-lg font-semibold transition-all duration-200 flex items-center text-foreground"
          >
            <span className="mr-2">←</span> Back
          </Link>
          <Link
            to="/history"
            className="px-6 py-3 bg-muted hover:bg-muted-foreground rounded-lg font-semibold transition-all duration-200 flex items-center text-foreground"
          >
            Forward <span className="ml-2">→</span>
          </Link>
        </div>
      )}
    </div>
  )
}