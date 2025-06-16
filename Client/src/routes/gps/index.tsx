import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete (L.Icon.Default.prototype as any)._getIconUrl
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
  const [address, setAddress] = useState<string | null>(null)
  const [manualAddress, setManualAddress] = useState<string>('') // Manual input
  const [isManualMode, setIsManualMode] = useState(false) // Toggle manual mode

  // Fetch user's current GPS location
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        const newLocation = { lat: latitude, lng: longitude }
        setLocation(newLocation)

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

  // Convert typed address to lat/lng and update map
  const geocodeAddress = async () => {
    if (!manualAddress) return

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(manualAddress)}`
      )
      const data = await response.json()

      if (data && data[0]) {
        const lat = parseFloat(data[0].lat)
        const lon = parseFloat(data[0].lon)
        setLocation({ lat, lng: lon })
        setAddress(data[0].display_name)
        setIsManualMode(false) // optional: switch back to detected mode
      } else {
        alert('Address not found')
      }
    } catch (err) {
      console.error('Geocoding failed:', err)
    }
  }

  if (error) return <div className="text-red-600 text-center mt-10">{error}</div>
  if (!location) return <div className="text-center mt-10">Loading Location...</div>

  return (
    <div className="w-full h-screen flex flex-col items-center">
      {/* Address display */}
      <div className="mt-2 text-gray-700 text-sm text-center">
        <strong>Your location:</strong>{' '}
        {isManualMode ? manualAddress || '(empty)' : address}
      </div>

      {/* Toggle manual input */}
      <button
        className="mt-2 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
        onClick={() => setIsManualMode((prev) => !prev)}
      >
        {isManualMode ? 'Use Detected Address' : 'Edit Address Manually'}
      </button>

      {/* Manual address input */}
      {isManualMode && (
        <>
          <input
            type="text"
            value={manualAddress}
            onChange={(e) => setManualAddress(e.target.value)}
            placeholder="Enter address"
            className="mt-2 p-2 border border-gray-300 rounded w-[80%] max-w-md"
          />
          <button
            onClick={geocodeAddress}
            className="mt-2 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
          >
            Set Address on Map
          </button>
        </>
      )}

      {/* Map */}
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
          <Popup>📍 {isManualMode ? manualAddress || 'Manual location' : 'Detected location'}</Popup>
        </Marker>
      </MapContainer>
    </div>
  )
}
