







import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/logo/logo'

export const Route = createFileRoute('/')({
  component: App,
})

function App() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-background flex justify-center items-center">
      <div className="text-center flex flex-col space-y-4">
        <Logo className="mb-0" />
        <p className="text-foreground">
          The project demonstrates how vulnerable our personal data is when it's stored and accessible through mobile devices.
        </p>
        <Button
          className="bg-primary hover:bg-accent text-white px-8 py-2 rounded-lg font-semibold transition-all duration-200"
          onClick={() => router.navigate({ to: '/login' })}
        >
          Login
        </Button>
      </div>
    </div>
  )
}















