import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

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
    setError('לא ניתן לאחזר מיקום מדויק. בדקי הרשאות.')
  },
  {
    enableHighAccuracy: true, // 💡 זה מבקש דיוק גבוה
    timeout: 10000,            // זמן המתנה מרבי (10 שניות)
    maximumAge: 0              // לא להשתמש במיקום קודם
  }
)

  }, [])

  if (error) return <div className="text-red-600 text-center mt-10">{error}</div>
  if (!location) return <div className="text-center mt-10">Loading Location...</div>

  return (
    <div className="w-full h-screen">
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
  )
}
