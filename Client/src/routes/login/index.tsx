import { Logo } from '@/components/logo/logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'

export const Route = createFileRoute('/login/')({
  component: LoginPage,
})

function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function handleLogin() {
    //TODO login
    try {
      await login(username, password) // Add await here
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
        <Logo />
        <p className="text-center text-gray-300">Please login to continue</p>
        {error && <p className="text-center text-red-500">{error}</p>}
        <div className="space-y-4">
          <Input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
          />
        </div>
        <div className="flex justify-center">
          <Button
            onClick={handleLogin}
            className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-2 rounded-lg font-semibold transition-all duration-200"
          >
            Login
          </Button>
        </div>
        <p className="text-center text-gray-300">
          Don't have an account?{' '}
          <Link className="text-blue-400 hover:text-blue-300 transition-colors" to="/signup">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
