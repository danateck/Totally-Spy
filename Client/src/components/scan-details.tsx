import { Link } from '@tanstack/react-router'
import { useState } from 'react'

interface ScanDetailsProps {
  id: number
  name: string
  date: string
  showAddToPortfolio?: boolean
  onAddToPortfolio?: () => void
  onRename?: (newName: string) => void
  isFavorite?: boolean
  onToggleFavorite?: () => void
}

function formatDate(dateString: string): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

export function ScanDetails({ id, name, date, showAddToPortfolio, onAddToPortfolio, onRename, isFavorite, onToggleFavorite }: ScanDetailsProps) {
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [newName, setNewName] = useState(name)

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault()
    if (onRename) {
      await onRename(newName)
      setShowRenameModal(false)
    }
  }

  return (
    <>
      <Link
        to="/history/$item"
        params={{ item: String(id) }}
        preload={false}
        className="block w-full p-4 bg-card rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 border border-border hover:border-accent text-left group sm:group"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {showAddToPortfolio && onAddToPortfolio && (
              <button
                onClick={(e) => {
                  e.preventDefault() // Prevent navigation when clicking the button
                  onAddToPortfolio()
                }}
                className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-accent transition-colors"
                title="Add to Portfolio"
              >
                {/* Default icon (visible when not hovering) */}
                <svg
                  className="w-5 h-5 text-primary opacity-100 sm:group-hover:opacity-0 absolute transition-opacity"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                {/* Plus icon (visible when hovering) */}
                <svg
                  className="w-5 h-5 text-primary opacity-0 sm:group-hover:opacity-100 absolute transition-opacity"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </button>
            )}
            
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-medium text-primary sm:group-hover:text-foreground transition-colors">
                {name}
              </h3>
              <div className="flex items-center space-x-1">
                {/* Favorite Button */}
                {onToggleFavorite && (
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      onToggleFavorite()
                    }}
                    className={`transition-all p-1 hover:bg-accent rounded-lg ${
                      isFavorite ? 'opacity-100' : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100'
                    }`}
                    title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                  >
                    <svg
                      className={`w-4 h-4 transition-colors ${
                        isFavorite 
                          ? 'text-yellow-500 fill-current' 
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      fill={isFavorite ? "currentColor" : "none"}
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                      />
                    </svg>
                  </button>
                )}
                
                {/* Rename Button */}
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    setNewName(name)  // Set the newName state to the current name
                    setShowRenameModal(true)
                  }}
                  className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity p-1 hover:bg-accent rounded-lg"
                  title="Rename Recording"
                >
                  <svg
                    className="w-4 h-4 text-muted-foreground hover:text-foreground"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <svg
            className="w-5 h-5 text-muted-foreground sm:group-hover:text-foreground transition-colors"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>
      </Link>

      {/* Rename Modal */}
      {showRenameModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card p-6 rounded-xl shadow-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Rename Recording</h2>
            <form onSubmit={handleRename}>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Enter new name"
                className="w-full px-4 py-2 rounded-lg bg-background border border-border mb-4"
              />
              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowRenameModal(false)
                    setNewName(name)
                  }}
                  className="px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-accent hover:text-accent-foreground"
                >
                  Rename
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
} 