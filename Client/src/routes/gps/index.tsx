import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Header } from '@/components/header/header'

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

export const Route = createFileRoute('/gps/')({
  component: RouteComponent,
})

function RouteComponent() {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
      },
      (err) => {
        console.error('Geolocation error:', err)
        setError('Unable to retrieve location. Check permissions or try another browser')
      },
      {
        enableHighAccuracy: true, 
        timeout: 10000,           
        maximumAge: 0              
      }
    )
  }, [])

  if (error) return (
    <div className="min-h-screen bg-background text-foreground"
      style={{ backgroundImage: "url('/images/background.jpg')" }}>
      <Header 
        title="GPS Location"
        icon={
          <svg className="w-3 h-3 sm:w-4 sm:h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        }
        showBackButton={true}
        backTo="/history"
        backTitle="Back to History"
      />
      <div className="text-red-600 text-center mt-10">{error}</div>
    </div>
  )

  if (!location) return (
    <div className="min-h-screen bg-background text-foreground"
      style={{ backgroundImage: "url('/images/background.jpg')" }}>
      <Header 
        title="GPS Location"
        icon={
          <svg className="w-3 h-3 sm:w-4 sm:h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        }
        showBackButton={true}
        backTo="/history"
        backTitle="Back to History"
      />
      <div className="text-center mt-10">Loading Location...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background text-foreground"
      style={{ backgroundImage: "url('/images/background.jpg')" }}>
      <Header 
        title="GPS Location"
        icon={
          <svg className="w-3 h-3 sm:w-4 sm:h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        }
        showBackButton={true}
        backTo="/history"
        backTitle="Back to History"
      />
      <div className="w-full h-[calc(100vh-4rem)]">
        <MapContainer center={location} zoom={15} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
          />
          <Marker position={location}>
            <Popup>📍Right Here</Popup>
          </Marker>
        </MapContainer>
      </div>
    </div>
  )
}
