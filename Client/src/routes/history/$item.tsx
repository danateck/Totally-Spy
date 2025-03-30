import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth.ts'
import { Logo } from '@/components/logo/logo'

export const Route = createFileRoute('/history/$item')({
  component: RouteComponent,
  loader: async ({ params }) => {
    const response = await fetch(`http://localhost:4000/history/record/${params.item}`,{credentials: 'include',})
    if (!response.ok) {
      throw new Error(`Error: ${response.status} - ${response.statusText}`)
    }
    return response.json()
  },  
})

function RouteComponent() {
  useAuth() // Add authentication check
  const data = Route.useLoaderData()
  const [error, setError] = useState<string | null>(null)
  
  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800">
        <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <Logo className="mb-12" />
          <div className="bg-gray-800 rounded-xl shadow-2xl p-8">
            <p className="text-red-400 text-center">{error || 'Record not found'}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800">
      <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <Logo className="mb-12" />
        
        <div className="bg-gray-800 rounded-xl shadow-2xl p-8 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-gray-200">Recording Details</h2>
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                data.processingStatus 
                  ? 'bg-green-500/20 text-green-400' 
                  : 'bg-red-500/20 text-red-400'
              }`}>
                {data.processingStatus ? 'Processing Successful' : 'Processing Failed'}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <p className="text-gray-400">Date</p>
                <p className="text-gray-200">{data.date}</p>
              </div>
              <div className="space-y-1">
                <p className="text-gray-400">Data Type</p>
                <p className="text-gray-200">{data.dataType}</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-gray-400">Content</p>
              <div className="bg-gray-700 rounded-lg p-4">
                <p className="text-gray-200">{data.content}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="fixed bottom-8 left-0 right-0 flex justify-center space-x-4">
          <Link
            to="/history"
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
