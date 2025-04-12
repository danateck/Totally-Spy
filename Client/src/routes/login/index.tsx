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
    <div className="min-h-screen bg-background flex justify-center items-center text-foreground"
    style={{ backgroundImage: "url('/images/background.jpg')" }}>
      <div className="max-w-lg w-full space-y-6 p-8 bg-card rounded-xl shadow-2xl border border-border">
        <Logo className="mb-8" />
        <p className="text-center text-foreground">Please login to continue</p>
        {error && <p className="text-center text-destructive">{error}</p>}
        <div className="space-y-4">
          <Input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="bg-muted border-border text-foreground placeholder-muted-foreground"
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-muted border-border text-foreground placeholder-muted-foreground"
          />
        </div>
        <div className="flex justify-center">
          <Button
            onClick={handleLogin}
            className="bg-primary text-primary-foreground py-2 px-8 rounded-lg font-semibold hover:bg-accent hover:text-accent-foreground transition-all duration-200"
          >
            Login
          </Button>
        </div>
        <p className="text-center text-muted-foreground">
          Don't have an account?{' '}
          <Link className="text-accent hover:text-primary transition-colors" to="/signup">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}