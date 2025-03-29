import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Logo } from '@/components/logo/logo'

export const Route = createFileRoute('/record/')({
  component: RouteComponent,
})

function RouteComponent() {
  const [isRecording, setIsRecording] = useState(false)

  const handleStartRecording = () => {
    setIsRecording(true)
    // TODO: Implement actual recording logic
  }

  const handleStopRecording = () => {
    setIsRecording(false)
    // TODO: Implement stop recording logic
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      <div className="container mx-auto px-4 py-8">
        <Logo />
        
        <div className="max-w-md mx-auto bg-gray-800 rounded-xl shadow-2xl p-8">
          <div className="flex flex-col items-center space-y-6">
            <div className="w-24 h-24 rounded-full bg-gray-700 flex items-center justify-center">
              <div className={`w-16 h-16 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-600'}`} />
            </div>
            
            <div className="flex space-x-4">
              <button
                onClick={handleStartRecording}
                disabled={isRecording}
                className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
                  isRecording
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-blue-500 hover:bg-blue-600 active:transform active:scale-95'
                }`}
              >
                Start
              </button>
              
              <button
                onClick={handleStopRecording}
                disabled={!isRecording}
                className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
                  !isRecording
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-red-500 hover:bg-red-600 active:transform active:scale-95'
                }`}
              >
                Stop
              </button>
            </div>
          </div>
        </div>

        <div className="fixed bottom-8 left-0 right-0 flex justify-center space-x-4">
          <Link
            to="/"
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-all duration-200 flex items-center"
          >
            <span className="mr-2">←</span> Back
          </Link>
          <Link
            to="/"
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-all duration-200 flex items-center"
          >
            Forward <span className="ml-2">→</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
