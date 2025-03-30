import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Logo } from '@/components/logo/logo'

export const Route = createFileRoute('/signup/')({
  component: SignupPage,
})

function SignupPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function handleSignup() {
    //TODO: sighup
    try {
      const response = await fetch('http://localhost:4000/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password })
      })

      if (!response.ok) {
        throw new Error('Signup failed')
      }

      router.navigate({ to: '/dashboard' })
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('An unknown error occurred')
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 flex justify-center items-center">
      <div className="max-w-lg w-full space-y-6 p-8 bg-gray-800 rounded-xl shadow-2xl">
        <Logo className="mb-8" />
        <h2 className="text-2xl font-semibold text-center text-gray-300">Create an account</h2>
        {error && <p className="text-center text-red-500">{error}</p>}
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="username" className="block text-sm font-medium text-gray-300">
              Username
            </label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
              placeholder="Enter your username"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-gray-300">
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
              placeholder="Enter your password"
            />
          </div>
          <Button
            onClick={handleSignup}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg font-semibold transition-all duration-200"
          >
            Sign Up
          </Button>
        </div>
        <p className="text-center text-gray-300">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-400 hover:text-blue-300 transition-colors">
            Login
          </Link>
        </p>
      </div>
    </div>
  )
}
