import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/gps/$gps-portfolio')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/gps/$gps-portfolio"!</div>
}
