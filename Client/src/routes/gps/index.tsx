/*
here we create a map for the user to see, 
the location id being detected and displayed both in text and on the map
the user can manualy change the location and the the pin on the map will change too

*/ 
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Header } from '@/components/header/header'

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

  if (error) return <div className="text-red-500 text-center mt-10 font-mono bg-black p-4">{error}</div>
  if (!location) return <div className="text-center mt-10 text-green-400 font-mono bg-black p-4">Loading Location...</div>

  return (
    <div className="w-full h-screen bg-black text-green-400 flex flex-col items-center font-mono p-4">
      {/* Address text display */}
      <div className="mt-4 text-lg text-center">
        <strong>Your location:</strong>{' '}
        {isManualMode ? manualAddress || '(empty)' : address}
      </div>

      {/* Toggle manual input */}
      <button
        className="mt-4 px-4 py-2 bg-green-700 text-black text-lg font-bold rounded hover:bg-green-600"
        onClick={() => setIsManualMode((prev) => !prev)}
      >
        {isManualMode ? 'Use Detected Address' : 'Edit Address Manually'}
      </button>

      {/* Manual address input */}
      {isManualMode && (
        <div className="flex flex-col items-center w-full mt-4">
          <input
            type="text"
            value={manualAddress}
            onChange={(e) => setManualAddress(e.target.value)}
            placeholder="Enter address"
            className="p-3 text-white w-[90%] max-w-md border border-green-600 rounded"
          />
          <button
            onClick={geocodeAddress}
            className="mt-2 px-4 py-2 bg-green-700 text-black text-lg font-bold rounded hover:bg-green-600"
          >
            Set Address on Map
          </button>
        </div>
      )}

      {/* Display Map */}
      <div className="mt-6 border border-green-700 rounded overflow-hidden" style={{ width: '500px', height: '500px' }}>
        <MapContainer
          center={location}
          zoom={15}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution=""
          />
          <Marker position={location}>
            <Popup className="font-mono text-sm">
              📍 {isManualMode ? manualAddress || 'Manual location' : 'Detected location'}
            </Popup>
          </Marker>
        </MapContainer>
      </div>
    </div>
  )
}
