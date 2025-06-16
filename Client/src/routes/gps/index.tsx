/*
  here we add a gps location for every data that is collected 
  we showcase a map and a text with the location detected during the time of the recording
*/
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
  const [address, setAddress] = useState<string | null>(null) // ✅ PLACE THIS INSIDE THE FUNCTION

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        const newLocation = { lat: latitude, lng: longitude }
        setLocation(newLocation)

        // Fetch address from Nominatim
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`)
          .then((res) => res.json())
          .then((data) => {
            setAddress(data.display_name)
          })
          .catch((err) => {
            console.error('Reverse geocoding failed:', err)
          })
      },
      (err) => {
        console.error('Geolocation error:', err)
        setError('Unable to retrieve location. Check permissions or try another browser')
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    )
  }, [])

  if (error) return <div className="text-red-600 text-center mt-10">{error}</div>
  if (!location) return <div className="text-center mt-10">Loading Location...</div>

  return (
    <div className="w-full h-screen">
      {address && (
        <div className="text-center mt-2 text-gray-700 text-sm">
          Your location: {address}
        </div>
      )}
      <MapContainer
        center={location}
        zoom={15}
        scrollWheelZoom={true}
        style={{ height: '90%', width: '100%' }}
      >
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
