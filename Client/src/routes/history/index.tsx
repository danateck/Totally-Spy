import { createFileRoute, Link } from '@tanstack/react-router'
import { Logo } from '@/components/logo/logo'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/history/')({
  component: RouteComponent,
})

function RouteComponent() {
  const [recordings, setRecordings] = useState([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchRecordings() {
      try {
        const response = await fetch('/history/recordings',{credentials: 'include'})

        // Check if the response is not okay (i.e., status code not in 2xx range)
        if (!response.ok) {
          throw new Error(`Error: ${response.status} - ${response.statusText}`)
        }

        // Try to parse JSON response
        const contentType = response.headers.get('content-type')
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json()
          setRecordings(data.records)
        } else {
          throw new Error('The server did not return valid JSON.')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      }
    }

    fetchRecordings()
  }, [])
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800">
      <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <Logo className="mb-12" />

        {error && !recordings.length && (
          <p className="text-gray-400 text-center text-lg font-semibold">
            {error.includes('valid JSON') ? "You have no records" : error}
          </p>
        )}
        {recordings.length === 0 && !error && (
          <p className="text-gray-400 text-center text-lg font-semibold">
            You have no records
          </p>
        )}
        <div className="space-y-4">
          {recordings.map((recording: [number, string]) => (
            <Link
              key={recording[0]}
              to="/history/$item"
              params={{ item: String(recording[0]) }}
              className="block w-full p-4 bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 border border-gray-700 hover:border-gray-600 text-left group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-blue-400"
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
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-200 group-hover:text-white transition-colors">
                      {recording[1]} Recording
                    </h3>
                    <p className="text-sm text-gray-400">Click to view details</p>
                  </div>
                </div>
                <svg
                  className="w-5 h-5 text-gray-400 group-hover:text-gray-300 transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </Link>
          ))}
        </div>

        <div className="fixed bottom-8 left-0 right-0 flex justify-center space-x-4">
          <Link
            to="/dashboard"
            className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-semibold transition-all duration-200 flex items-center text-gray-300 hover:text-white border border-gray-700"
          >
            <span className="mr-2">←</span> Back
          </Link>
          <Link
            to="/"
            className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-semibold transition-all duration-200 flex items-center text-gray-300 hover:text-white border border-gray-700"
          >
            Forward <span className="ml-2">→</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
