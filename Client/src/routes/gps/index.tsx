import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/gps/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/gps/"!</div>
}
