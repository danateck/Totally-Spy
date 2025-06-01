
import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Eye, 
  Clock, 
  User, 
  FileText, 
  Loader2, 
  AlertCircle,
  ArrowRight,
  Database
} from 'lucide-react';
import { createFileRoute } from '@tanstack/react-router'
import EnhancedOSINTDisplay from '@/components/OSINT'

// Create the route export that TanStack Router expects
export const Route = createFileRoute('/osintApi/')({
  component: PersonFinderComponent,
})

interface ScanHistoryItem {
  id: number;
  scan_time: string;
  detected_text: string;
  name: string;
  preview: string;
}

function PersonFinderComponent() {
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedScanId, setSelectedScanId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchScanHistory();
  }, []);




  
  
const fetchScanHistory = async () => {
  try {
    setLoading(true);
    setError(null);
    
  
    const response = await fetch('/api/scan-history', {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Scan history fetch error:", response.status, errorText);
      throw new Error(`Error ${response.status}: ${errorText || response.statusText}`);
    }
    
    const data = await response.json();
    console.log("Scan history data:", data);
    
    if (data && data.success && data.scans) {
      setScanHistory(data.scans);
    } else if (data && data.scans) {
      setScanHistory(data.scans);
    } else {
      setScanHistory([]);
    }
    
  } catch (err) {
    console.error("Scan history error:", err);
    setError(err instanceof Error ? err.message : 'Failed to load scan history');
    setScanHistory([]);
  } finally {
    setLoading(false);
  }
};

  const filteredScans = scanHistory.filter(scan => 
    scan.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    scan.detected_text?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch (err) {
      return 'Invalid Date';
    }
  };

  const handleScanSelect = (scanId: number) => {
    setSelectedScanId(scanId);
  };

  const handleBackToList = () => {
    setSelectedScanId(null);
  };

  if (selectedScanId) {
    return (
      <EnhancedOSINTDisplay 
        scanId={selectedScanId} 
        onClose={handleBackToList}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Person Finder & OSINT Enhancement
          </h1>
          <p className="text-gray-600">
            Select a scan from your history to enhance with OSINT intelligence gathering
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search scans by name or content..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Loading scan history...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="w-5 h-5" />
              <span className="font-medium">Error: {error}</span>
            </div>
            <button
              onClick={fetchScanHistory}
              className="mt-2 text-red-600 hover:text-red-700 underline text-sm"
            >
              Try again
            </button>
          </div>
        )}

        {/* Scan History List */}
        {!loading && !error && (
          <>
            {filteredScans.length === 0 ? (
              <div className="text-center py-12">
                <Database className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {searchTerm ? 'No matching scans found' : 'No scan history available'}
                </h3>
                <p className="text-gray-600">
                  {searchTerm 
                    ? 'Try adjusting your search terms' 
                    : 'Perform some scans first to see them here'
                  }
                </p>
                {!searchTerm && scanHistory.length === 0 && (
                  <p className="text-gray-500 mt-2 text-sm">
                    Debug: scanHistory array length is {scanHistory.length}
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="mb-4 text-sm text-gray-600">
                  Showing {filteredScans.length} of {scanHistory.length} scans
                </div>
                
                <div className="grid gap-4">
                  {filteredScans.map((scan) => (
                    <div
                      key={scan.id}
                      className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => handleScanSelect(scan.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="flex items-center gap-2">
                              <User className="w-5 h-5 text-blue-600" />
                              <span className="font-semibold text-lg text-gray-900">
                                {scan.name || 'Unknown Person'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-sm text-gray-500">
                              <Clock className="w-4 h-4" />
                              {formatDate(scan.scan_time)}
                            </div>
                          </div>
                          
                          <div className="mb-3">
                            <div className="flex items-center gap-2 mb-2">
                              <FileText className="w-4 h-4 text-gray-500" />
                              <span className="text-sm font-medium text-gray-700">
                                Detected Text Preview:
                              </span>
                            </div>
                            <p className="text-gray-600 text-sm bg-gray-50 p-3 rounded border">
                              {scan.preview || scan.detected_text?.substring(0, 200) + '...' || 'No preview available'}
                            </p>
                          </div>

                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1 text-blue-600">
                              <Database className="w-4 h-4" />
                              <span>Scan ID: {scan.id}</span>
                            </div>
                            <div className="text-gray-500">
                              Characters: {scan.detected_text?.length || 0}
                            </div>
                          </div>
                        </div>
                        
                        <div className="ml-4 flex flex-col items-end gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleScanSelect(scan.id);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                            Enhance with OSINT
                            <ArrowRight className="w-4 h-4" />
                          </button>
                          
                          <div className="text-xs text-gray-500 text-right">
                            Click to start OSINT<br />
                            intelligence gathering
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* Info Panel */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-3">How OSINT Enhancement Works</h3>
          <div className="grid md:grid-cols-2 gap-4 text-blue-800 text-sm">
            <div>
              <h4 className="font-medium mb-2">🔍 Data Analysis</h4>
              <p>Automatically extracts phone numbers, emails, and names from your scan data</p>
            </div>
            <div>
              <h4 className="font-medium mb-2">📱 PhoneInfoga Integration</h4>
              <p>Deep analysis of phone numbers using PhoneInfoga toolkit</p>
            </div>
            <div>
              <h4 className="font-medium mb-2">🌐 OSINT API Queries</h4>
              <p>Cross-references data with external OSINT databases and APIs</p>
            </div>
            <div>
              <h4 className="font-medium mb-2">🎯 Google Dorking</h4>
              <p>Performs targeted Google searches using advanced dorking techniques</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PersonFinderComponent;

