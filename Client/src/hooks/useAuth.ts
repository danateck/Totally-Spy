import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'

export function useAuth() {
  const navigate = useNavigate()

  useEffect(() => {
    const isAuthenticated = localStorage.getItem('isAuthenticated')
    if (!isAuthenticated) {
      navigate({ to: '/login' })
    }
  }, [navigate])

  const login = async (username: string, password: string) => {
    try {
      const response = await fetch('http://localhost:4000/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || 'Invalid credentials')
      }
      localStorage.setItem('isAuthenticated', 'true')
    } catch (error) {
      throw error
    }
  }

  const logout = () => {
    localStorage.removeItem('isAuthenticated')
    navigate({ to: '/login' })
  }

  const isAuthenticated = () => {
    return localStorage.getItem('isAuthenticated') === 'true'
  }

  return { login, logout, isAuthenticated }
} 