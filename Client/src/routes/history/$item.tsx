import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth.ts'
import { Logo } from '@/components/logo/logo'
import type { Record, RecordResponse } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Eye, ArrowRight } from 'lucide-react' // Add these imports
import EnhancedOSINTDisplay from '@/components/OSINT' // Add OSINT component import

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-IL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jerusalem'
  });
}

// Extract all rows of data, splitting by newline
function getAllRows(data: string): Array<{ value: string, type: string }> {
  // Split by newline and filter out empty lines
  const lines = data.split('\n').filter(line => line.trim() !== '');
  if (lines.length === 0) {
    return [{
      value: 'No data',
      type: 'Unknown'
    }];
  }

  return lines.map(line => {
    const parts = line.split(':');
    if (parts.length >= 2 && parts[1].trim() !== '') {
      return {
        value: parts[0].trim(),
        type: parts[1].trim()
      };
    }
    return {
      value: line.trim(),
      type: 'Unknown'
    };
  });
}

export const Route = createFileRoute('/history/$item')({
  component: RouteComponent,
  loader: async ({ params }) => {
    const response = await fetch(`/history/record/${params.item}`, {credentials: 'include'})
    if (!response.ok) {
      throw new Error(`Error: ${response.status} - ${response.statusText}`)
    }
    return response.json()
  },  
})

// Custom confirmation modal component
function ConfirmationModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  isDeleting 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onConfirm: () => void, 
  isDeleting: boolean 
}) {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card rounded-xl p-6 max-w-md w-11/12 shadow-xl">
        <h3 className="text-xl font-bold mb-4">Confirm Deletion</h3>
        <p className="mb-6">
          Are you sure you want to delete this record? This action cannot be undone.
        </p>
        <div className="flex justify-end space-x-3">
          <Button
            onClick={onClose}
            variant="outline"
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function RouteComponent() {
  useAuth() // Add authentication check
  const router = useRouter()
  const data: RecordResponse = Route.useLoaderData()
  const [error, setError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showOSINT, setShowOSINT] = useState(false)
  const [picShow, setPicShow] = useState(false)
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const params = Route.useParams()
  
  // Handle OSINT enhancement
  const handleOSINTEnhance = async () => {
  try {
    console.log(`⚡ Starting QUICK OSINT enhancement for scan ${params.item}`);
    
    // Use the new quick OSINT endpoint for speed
    const quickResponse = await fetch(`/api/quick-osint/${params.item}`, {
      method: 'POST',
      credentials: 'include'
    });
    
    if (quickResponse.ok) {
      const quickData = await quickResponse.json();
      console.log('⚡ Quick OSINT results:', quickData);
      
      if (quickData.success) {
        console.log('✅ Quick enhancement completed in under 10 seconds!');
        console.log(`📊 Performance: ${quickData.performance?.estimated_time}`);
        console.log(`🔍 Generated ${quickData.performance?.results_generated} results`);
        setShowOSINT(true);
        return;
      } else {
        console.error('❌ Quick OSINT failed:', quickData.message);
        // Fall back to regular enhancement
        console.log('⚠️ Falling back to regular enhancement...');
      }
    } else {
      console.log('⚠️ Quick mode failed, trying regular enhancement...');
    }
    
    // Fallback: Use force refresh (slower but more comprehensive)
    console.log(`🔄 Using comprehensive enhancement as fallback...`);
    const refreshResponse = await fetch(`/api/force-refresh-osint/${params.item}`, {
      method: 'POST',
      credentials: 'include'
    });
    
    if (refreshResponse.ok) {
      const refreshData = await refreshResponse.json();
      console.log('✅ Comprehensive enhancement results:', refreshData);
      
      if (refreshData.success) {
        console.log('✅ Comprehensive enhancement completed');
        setShowOSINT(true);
        return;
      }
    }
    
    // Final fallback
    alert('Enhancement failed. Please try again.');
    
  } catch (error) {
    console.error('❌ Enhancement error:', error);
    alert(`Enhancement error: ${error}`);
  }
};

  const handleBackFromOSINT = () => {
    setShowOSINT(false);
  };
  
  // Handle modal open
  const handleDeleteClick = () => {
    setShowModal(true);
  };
  
  // Handle modal close
  const handleModalClose = () => {
    setShowModal(false);
  };

  const handleShowPicture = async () => {
    try {
      const response = await fetch(`/api/scan/${params.item}/image`, {
        credentials: 'include',
      });
  
      if (!response.ok) {
        throw new Error('Failed to load image');
      }
  
      const data = await response.json();
      setBase64Image(data.image_base64);
      setPicShow(true);
    } catch (error) {
      console.error('Error fetching image:', error);
    }
  };
  
  
  // Handle delete confirmation
  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      // Using POST instead of DELETE with a specific action parameter
      const response = await fetch(`/history/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ 
          recordId: params.item,
          action: 'delete'
        })
      })
      
      if (!response.ok) {
        throw new Error(`Failed to delete: ${response.status} - ${response.statusText}`)
      }
      
      // Redirect to history page after successful deletion
      router.navigate({ to: '/history' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete record')
      setIsDeleting(false)
      setShowModal(false)
    }
  };
  
  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showModal) {
        handleModalClose();
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showModal]);
  
  if (error || !data || !data.record || data.record.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <Logo className="mb-12" />
          <div className="bg-card rounded-xl shadow-2xl p-8">
            <p className="text-destructive text-center">{error || 'Record not found'}</p>
            {error && (
              <div className="mt-4 flex justify-center">
                <Link
                  to="/history"
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium"
                >
                  Go back to History
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Show OSINT component if requested
  if (showOSINT) {
    return (
      <EnhancedOSINTDisplay 
        scanId={parseInt(params.item)} 
        onClose={handleBackFromOSINT}
      />
    );
  }

  const record = data.record[0];
  const rows = getAllRows(record[2]);

  return (
    <div className="min-h-screen bg-background text-foreground"
    style={{ backgroundImage: "url('/images/background.jpg')" }}>
      <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <Logo className="mb-12" />
        
        <div className="bg-card rounded-xl shadow-2xl p-8 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-primary">Recording Details</h2>
              <div className="px-3 py-1 rounded-full text-sm font-medium bg-green-500/20 text-green-400">
                Processing Successful
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-muted-foreground">Date</p>
              <p className="text-foreground">{formatDate(record[1])}</p>
            </div>

            <div className="space-y-2">
              <p className="text-muted-foreground">Content</p>
              <div className="space-y-2">
                {rows.map((row, index) => (
                  <div key={index} className="bg-muted rounded-lg p-4 flex justify-between items-center">
                    <div>
                      <p className="text-foreground font-medium">{row.value}</p>
                      <p className="text-sm text-muted-foreground mt-1">Type: {row.type}</p>
                    </div>
                    <div className="px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                      {`Entry ${index + 1}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="pt-4 border-t border-border space-y-3">
              <div className="flex flex-col items-end gap-2">
               <button
               onClick={handleOSINTEnhance}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
>

              <Eye className="w-4 h-4" />
               Enhance with OSINT
              <ArrowRight className="w-4 h-4" />
              </button>

                
                <div className="text-xs text-gray-500 text-center">
                  Click to start OSINT<br />
                  intelligence gathering
                </div>
              </div>
              
              <Button
                onClick={handleDeleteClick}
                disabled={isDeleting}
                className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? 'Deleting...' : 'Delete Record'}
              </Button>

              <Button 
                disabled={picShow}
                onClick={handleShowPicture}
                className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Show screenshot
              </Button>

              {picShow && base64Image && (
              <div className="mt-4 p-4 border border-border rounded-lg bg-muted text-center">
                <p className="mb-2 font-medium text-sm text-muted-foreground">Best Frame</p>
                <img 
                  src={`data:image/jpeg;base64,${base64Image}`} 
                  alt="Best Frame" 
                  className="max-w-full h-auto rounded-md border"
                />
              </div>
               )}

            </div>
          </div>
        </div>

        <div className="fixed bottom-8 left-0 right-0 flex justify-center space-x-4">
          <Link
            to="/history"
            className="px-6 py-3 bg-card hover:bg-accent rounded-lg font-semibold transition-all duration-200 flex items-center text-foreground hover:text-accent-foreground border border-border"
          >
            <span className="mr-2">←</span> Back
          </Link>
          <Link
            to="/"
            className="px-6 py-3 bg-card hover:bg-accent rounded-lg font-semibold transition-all duration-200 flex items-center text-foreground hover:text-accent-foreground border border-border"
          >
            Forward <span className="ml-2">→</span>
          </Link>
        </div>
      </div>
      
      {/* Confirmation Modal */}
      <ConfirmationModal 
        isOpen={showModal}
        onClose={handleModalClose}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />
    </div>
  )
}