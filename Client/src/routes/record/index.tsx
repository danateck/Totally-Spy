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
    <div className="min-h-screen bg-background text-foreground"
    style={{ backgroundImage: "url('/images/background.jpg')" }}>
      <div className="container mx-auto px-4 py-8">
        <Logo />

        <div className="max-w-4xl mx-auto bg-card border border-border rounded-xl shadow-2xl p-8">
          <div className="flex flex-col items-center space-y-6">
            {showAlert && (
              <Alert className="w-full max-w-2xl border border-green-500/20 bg-green-500/10">
                <AlertTitle className="text-green-400">{alertTitle}</AlertTitle>
                <AlertDescription className="text-green-400">{alertMessage}</AlertDescription>
              </Alert>
            )}

            {isRecording ? (
              <div className="w-full max-w-2xl">
                <WebcamCapture
                  onCapture={handleCapture}
                  isRecording={isRecording}
                />
              </div>
            ) : capturedImage ? (
              <img
                src={capturedImage}
                alt="Captured"
                className="w-full max-w-2xl rounded-lg shadow-lg"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-muted-foreground" />
              </div>
            )}

            <div className="flex space-x-4">
              <button
                onClick={handleStartRecording}
                disabled={isRecording}
                className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
                  isRecording
                    ? 'bg-muted cursor-not-allowed'
                    : 'bg-primary hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                Start
              </button>

              <button
                onClick={handleStopRecording}
                disabled={!isRecording}
                className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
                  !isRecording
                    ? 'bg-muted cursor-not-allowed'
                    : 'bg-destructive hover:bg-red-600 text-white'
                }`}
              >
                Stop
              </button>
            </div>
          </div>
        </div>

        <div className="fixed bottom-8 left-0 right-0 flex justify-center space-x-4">
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
      </div>
    </div>
  )
}