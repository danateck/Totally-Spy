






import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
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

  //  Force dark mode globally
  useEffect(() => {
    document.documentElement.classList.add('dark')
  }, [])

  async function handleSignup() {
    try {
      const response = await fetch('/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password })
      })

      if (!response.ok) {
        throw new Error('Username already exists')
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
    <div className="min-h-screen bg-background flex justify-center items-center text-foreground"
    style={{ backgroundImage: "url('/images/background.jpg')" }}>
      <div className="max-w-lg w-full space-y-6 p-8 bg-card rounded-xl shadow-2xl border border-border">
        <Logo className="mb-8" />
        <h2 className="text-2xl font-semibold text-center text-primary">Create an account</h2>
        {error && <p className="text-center text-destructive">{error}</p>}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSignup()
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <label htmlFor="username" className="block text-sm font-medium text-foreground">
              Username
            </label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-muted border-border text-foreground placeholder-muted-foreground"
              placeholder="Enter your username"
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-foreground">
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-muted border-border text-foreground placeholder-muted-foreground"
              placeholder="Enter your password"
              required
            />
          </div>
          <Button
            type="submit"
            className="w-full bg-primary text-primary-foreground py-2 rounded-lg font-semibold hover:bg-accent hover:text-accent-foreground transition-all duration-200"
          >
            Sign Up
          </Button>
        </form>
        <p className="text-center text-muted-foreground">
          Already have an account?{' '}
          <Link to="/login" className="text-accent hover:text-primary transition-colors">
            Login
          </Link>
        </p>
      </div>
    </div>
  )
}

















