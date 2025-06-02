import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  Phone, 
  Mail, 
  User, 
  Clock, 
  AlertCircle, 
  CheckCircle, 
  Loader2,
  Eye,
  Database,
  Globe,
  Shield,
  ExternalLink,
  AlertTriangle,
  Info,
  CreditCard,
  Lock,
  Calendar,
  MapPin,
  Key,
  Hash,
  Play,
  Pause,
  RefreshCw,
  Trash2
} from 'lucide-react';

interface OSINTProgress {
  status: 'not_started' | 'processing' | 'completed' | 'error';
  progress: number;
  message: string;
  current_step?: string;
  started_at?: number;
  completed_at?: number;
  error?: string;
  detected_data_summary?: string[];
  total_queries?: number;
  queries_completed?: number;
  current_query?: string;
  total_results?: number;
}

interface DetectedData {
  [key: string]: string[];
}

interface EnhancedOSINTDisplayProps {
  scanId: number;
  onClose?: () => void;
}

const EnhancedOSINTDisplay: React.FC<EnhancedOSINTDisplayProps> = ({ scanId, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [scanData, setScanData] = useState<any>(null);
  const [enhancedData, setEnhancedData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [progress, setProgress] = useState<OSINTProgress | null>(null);
  const [isEnhancing, setIsEnhancing] = useState(false);

  const fetchScanDetails = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/scan-details/${scanId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch scan details');
      }
      
      const data = await response.json();
      setScanData(data.scan_data);
      setEnhancedData(data.enhanced_data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [scanId]);

  const fetchProgress = useCallback(async () => {
    try {
      const response = await fetch(`/api/osint-progress/${scanId}`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const progressData = await response.json();
        setProgress(progressData);
        
        if (progressData.status === 'completed') {
          setIsEnhancing(false);
          // Fetch the completed data
          await fetchEnhancedData();
        } else if (progressData.status === 'error') {
          setIsEnhancing(false);
          setError(progressData.error || 'Enhancement failed');
        }
      }
    } catch (err) {
      console.error('Error fetching progress:', err);
    }
  }, [scanId]);

  const fetchEnhancedData = useCallback(async () => {
  try {
    console.log(`🔍 Fetching enhanced data for scan ${scanId}`);
    
    const response = await fetch(`/api/osint-data/${scanId}`, {
      credentials: 'include',
    });
    
    if (!response.ok) {
      console.error("❌ Response not OK:", response.status, response.statusText);
      return;
    }
    
    const data = await response.json();
    console.log("📊 Raw enhanced data response:", data);
    
    if (data.success && data.data) {
      console.log("✅ Successfully got enhancement data");
      console.log("- Summary:", data.data.summary);
      console.log("- Detected data:", data.data.detected_data);
      console.log("- Email analysis count:", data.data.email_analysis?.length || 0);
      console.log("- Phone analysis count:", data.data.phone_analysis?.length || 0);
      console.log("- Web search summary:", data.data.web_search_summary);
      console.log("- Google searches:", data.data.google_searches?.length || 0);
      
      setEnhancedData(data.data);
      setProgress(null);
    } else {
      console.log("⚠️ Response success=false or no data:", data);
      setEnhancedData(null);
    }
  } catch (err) {
    console.error('❌ Error fetching enhanced data:', err);
  }
}, [scanId]);

  useEffect(() => {
    fetchScanDetails();
  }, [fetchScanDetails]);

  useEffect(() => {
    let intervalId: number | null = null;
    
    if (isEnhancing && progress?.status === 'processing') {
      intervalId = window.setInterval(fetchProgress, 2000); // Poll every 2 seconds
    }
    
    return () => {
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [isEnhancing, progress?.status, fetchProgress]);

  const startComprehensiveEnhancement = async () => {
  try {
    console.log(`🚀 Starting OSINT enhancement for scan ${scanId}`);
    
    // First check if enhancement already exists
    const checkResponse = await fetch(`/api/osint-data/${scanId}`, {
      credentials: 'include',
    });
    
    if (checkResponse.ok) {
      const checkData = await checkResponse.json();
      console.log("🔍 Checking for existing data:", checkData);
      
      if (checkData.success && checkData.data) {
        console.log("✅ Found existing enhancement data");
        setEnhancedData(checkData.data);
        setIsEnhancing(false);
        return;
      }
    }
    
    console.log("🔄 No existing data, starting new enhancement...");
    setIsEnhancing(true);
    setError(null);
    
    const response = await fetch(`/api/enhance-scan-comprehensive/${scanId}`, {
      method: 'POST',
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error(`Enhancement failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log("✅ Enhancement started:", data);
    
    if (data.success) {
      setProgress({
        status: 'processing',
        progress: 0,
        message: 'Starting comprehensive OSINT enhancement...'
      });
      
      // Start polling for progress
      const pollInterval = setInterval(async () => {
        try {
          const progressResponse = await fetch(`/api/osint-progress/${scanId}`, {
            credentials: 'include',
          });
          
          if (progressResponse.ok) {
            const progressData = await progressResponse.json();
            console.log("📈 Progress update:", progressData);
            setProgress(progressData);
            
            if (progressData.status === 'completed') {
              console.log("🎉 Enhancement completed!");
              clearInterval(pollInterval);
              setIsEnhancing(false);
              
              // Fetch the completed data
              await fetchEnhancedData();
              setProgress(null);
            } else if (progressData.status === 'error') {
              console.error("❌ Enhancement failed:", progressData.error);
              clearInterval(pollInterval);
              setIsEnhancing(false);
              setError(progressData.error || 'Enhancement failed');
            }
          }
        } catch (error) {
          console.error("❌ Progress polling error:", error);
        }
      }, 2000);
      
      // Cleanup interval after 5 minutes max
      setTimeout(() => {
        clearInterval(pollInterval);
        setIsEnhancing(false);
      }, 300000);
      
    } else {
      throw new Error(data.message || 'Failed to start enhancement');
    }
  } catch (err) {
    console.error("❌ Enhancement error:", err);
    setError(err instanceof Error ? err.message : 'Enhancement failed');
    setIsEnhancing(false);
  }
};


  const deleteEnhancementData = async () => {
    try {
      const response = await fetch(`/api/osint-data/${scanId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (response.ok) {
        setEnhancedData(null);
        setProgress(null);
        setError(null);
      } else {
        throw new Error('Failed to delete enhancement data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete data');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const ProgressBar: React.FC<{ progress: OSINTProgress }> = ({ progress }) => (
    <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
      <div 
        className="bg-blue-600 h-4 rounded-full transition-all duration-300 ease-out relative overflow-hidden"
        style={{ width: `${progress.progress}%` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-20 animate-pulse"></div>
      </div>
      <div className="flex justify-between text-sm mt-2">
        <span className="text-gray-600">{progress.message}</span>
        <span className="font-medium">{progress.progress}%</span>
      </div>
    </div>
  );

  const ProgressDetails: React.FC<{ progress: OSINTProgress }> = ({ progress }) => (
    <div className="mt-4 p-4 bg-blue-50 rounded-lg">
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="font-medium">Current Step:</span>
          <span className="ml-2 capitalize">{progress.current_step?.replace('_', ' ') || 'Unknown'}</span>
        </div>
        {progress.total_queries && (
          <div>
            <span className="font-medium">Queries:</span>
            <span className="ml-2">{progress.queries_completed || 0}/{progress.total_queries}</span>
          </div>
        )}
        {progress.detected_data_summary && (
          <div className="col-span-2">
            <span className="font-medium">Detected Data:</span>
            <span className="ml-2">{progress.detected_data_summary.join(', ')}</span>
          </div>
        )}
        {progress.current_query && (
          <div className="col-span-2">
            <span className="font-medium">Current Query:</span>
            <span className="ml-2 font-mono text-xs bg-white px-2 py-1 rounded">"{progress.current_query}"</span>
          </div>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading scan details...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center gap-2 text-red-800">
          <AlertCircle className="w-5 h-5" />
          <span className="font-medium">Error: {error}</span>
        </div>
        <button
          onClick={() => {
            setError(null);
            fetchScanDetails();
          }}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Enhanced OSINT Intelligence</h1>
          <p className="text-gray-600">
            Scan ID: {scanId} | Scanned: {scanData && formatDate(scanData.scan_time)}
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            Close
          </button>
        )}
      </div>

      {/* Enhancement Status & Controls */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {enhancedData ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : progress?.status === 'processing' ? (
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-amber-600" />
            )}
            <div>
              <span className="font-medium">
                {enhancedData 
                  ? 'Enhancement Complete' 
                  : progress?.status === 'processing'
                    ? 'Enhancement in Progress...' 
                    : 'No Enhancement Data'
                }
              </span>
            </div>
          </div>
          
          <div className="flex gap-2">
            {!enhancedData && !isEnhancing && (
              <button
                onClick={startComprehensiveEnhancement}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 flex items-center gap-2 font-semibold shadow-lg"
              >
                <Search className="w-5 h-5" />
                🔍 Start Intelligence Gathering
                <span className="text-xs bg-white/20 px-2 py-1 rounded">
                  Find Social Media, Phone, Names
                </span>
              </button>
            )}
            
            {enhancedData && (
              <div className="flex gap-2">
                <button
                  onClick={fetchEnhancedData}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh Results
                </button>
                <button
                  onClick={deleteEnhancementData}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear Data
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Progress Display */}
        {progress && progress.status === 'processing' && (
          <div>
            <ProgressBar progress={progress} />
            <ProgressDetails progress={progress} />
          </div>
        )}
      </div>

      {/* Original Scan Data */}
      {scanData && (
        <div className="mb-6 p-4 border border-gray-200 rounded-lg">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Database className="w-5 h-5" />
            Original Scan Data
          </h3>
          
          <div className="space-y-3">
            {scanData.name && (
              <div>
                <label className="text-sm font-medium text-gray-700">Name:</label>
                <div className="mt-1 p-2 bg-blue-50 rounded border">
                  {scanData.name}
                </div>
              </div>
            )}
            
            <div>
              <label className="text-sm font-medium text-gray-700">Detected Text:</label>
              <div className="mt-1 max-h-32 overflow-y-auto p-3 bg-gray-50 rounded border">
                <pre className="text-sm text-gray-800 whitespace-pre-wrap">
                  {scanData.detected_text || 'No text detected'}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Data Tabs */}
      {enhancedData && (
        <>
          <div className="flex gap-2 mb-6 overflow-x-auto">
            <TabButton id="overview" label="Overview" icon={<Eye className="w-4 h-4" />} />
            <TabButton id="personal" label="Personal Intel" icon={<User className="w-4 h-4" />} />
            <TabButton id="data-types" label="Data Analysis" icon={<Database className="w-4 h-4" />} />
            <TabButton id="emails" label="Email Analysis" icon={<Mail className="w-4 h-4" />} />
            <TabButton id="phones" label="Phone Analysis" icon={<Phone className="w-4 h-4" />} />
            <TabButton id="web-search" label="Web Intelligence" icon={<Globe className="w-4 h-4" />} />
            <TabButton id="breaches" label="Data Breaches" icon={<AlertTriangle className="w-4 h-4" />} />
          </div>

          {/* Tab Content */}
          <div className="border border-gray-200 rounded-lg p-6">
            {activeTab === 'overview' && <OverviewTab enhancedData={enhancedData} />}
            {activeTab === 'personal' && <PersonalIntelTab enhancedData={enhancedData} />}
            {activeTab === 'data-types' && <DataTypesTab enhancedData={enhancedData} />}
            {activeTab === 'emails' && <EmailAnalysisTab enhancedData={enhancedData} />}
            {activeTab === 'phones' && <PhoneAnalysisTab enhancedData={enhancedData} />}
            {activeTab === 'web-search' && <WebSearchTab enhancedData={enhancedData} />}
            {activeTab === 'breaches' && <BreachesTab enhancedData={enhancedData} />}
          </div>
        </>
      )}
    </div>
  );

  function TabButton({ id, label, icon }: { id: string; label: string; icon: React.ReactNode }) {
    return (
      <button
        onClick={() => setActiveTab(id)}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
          activeTab === id
            ? 'bg-blue-600 text-white'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
        }`}
      >
        {icon}
        {label}
      </button>
    );
  }
};

const OverviewTab: React.FC<{ enhancedData: any }> = ({ enhancedData }) => {
  console.log("🎯 OverviewTab received data:", enhancedData);
  
  // Safely extract values with multiple fallbacks
  const phonesFound = enhancedData?.summary?.phones_found || 
                     enhancedData?.detected_data?.PHONE_NUMBER?.length || 
                     enhancedData?.phone_analysis?.length || 0;
  
  const emailsFound = enhancedData?.summary?.emails_found || 
                     enhancedData?.detected_data?.EMAIL?.length || 
                     enhancedData?.email_analysis?.length || 0;
  
  const totalSearches = enhancedData?.web_search_summary?.total_searches || 
                       enhancedData?.google_searches?.length || 
                       enhancedData?.osint_results?.executed_queries || 0;
  
  const breachChecks = enhancedData?.web_search_summary?.breach_checks_performed || 
                      enhancedData?.email_analysis?.length || 0;

  console.log("📊 Overview stats:", { phonesFound, emailsFound, totalSearches, breachChecks });

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Intelligence Summary</h3>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="text-center p-4 bg-blue-50 rounded-lg">
          <Phone className="w-8 h-8 text-blue-600 mx-auto mb-2" />
          <div className="text-2xl font-bold text-blue-600">{phonesFound}</div>
          <div className="text-sm text-gray-600">Phones Analyzed</div>
        </div>
        <div className="text-center p-4 bg-green-50 rounded-lg">
          <Mail className="w-8 h-8 text-green-600 mx-auto mb-2" />
          <div className="text-2xl font-bold text-green-600">{emailsFound}</div>
          <div className="text-sm text-gray-600">Emails Analyzed</div>
        </div>
        <div className="text-center p-4 bg-purple-50 rounded-lg">
          <Search className="w-8 h-8 text-purple-600 mx-auto mb-2" />
          <div className="text-2xl font-bold text-purple-600">{totalSearches}</div>
          <div className="text-sm text-gray-600">Web Searches</div>
        </div>
        <div className="text-center p-4 bg-red-50 rounded-lg">
          <AlertTriangle className="w-8 h-8 text-red-600 mx-auto mb-2" />
          <div className="text-2xl font-bold text-red-600">{breachChecks}</div>
          <div className="text-sm text-gray-600">Breach Checks</div>
        </div>
      </div>
      
      {/* Debug info - remove this later */}
      <div className="mb-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
        <h4 className="font-medium text-yellow-800 mb-2">Debug Info:</h4>
        <div className="text-xs text-yellow-700 space-y-1">
          <div>Detected Data Keys: {Object.keys(enhancedData?.detected_data || {}).join(', ')}</div>
          <div>Email Analysis: {enhancedData?.email_analysis?.length || 0} entries</div>
          <div>Phone Analysis: {enhancedData?.phone_analysis?.length || 0} entries</div>
          <div>Google Searches: {enhancedData?.google_searches?.length || 0} entries</div>
          <div>Enhancement Status: {enhancedData?.summary?.enhancement_status}</div>
        </div>
      </div>
      
      {enhancedData?.enhancement_timestamp && (
        <div className="text-sm text-gray-600">
          <Clock className="w-4 h-4 inline mr-2" />
          Enhanced: {new Date(enhancedData.enhancement_timestamp * 1000).toLocaleString()}
        </div>
      )}
    </div>
  );
};

const PersonalIntelTab: React.FC<{ enhancedData: any }> = ({ enhancedData }) => (
  <div>
    <h3 className="text-lg font-semibold mb-4">Personal Intelligence</h3>
    {enhancedData.personal_info ? (
      <div className="space-y-6">
        {/* Potential Names */}
        {enhancedData.personal_info.potential_names && enhancedData.personal_info.potential_names.length > 0 && (
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <User className="w-5 h-5 text-purple-600" />
              Potential Names Found
            </h4>
            <div className="flex flex-wrap gap-2">
              {enhancedData.personal_info.potential_names.map((name: string, index: number) => (
                <span key={index} className="bg-purple-100 text-purple-800 text-sm px-3 py-1 rounded">
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Web Mentions */}
        {enhancedData.personal_info.web_mentions && enhancedData.personal_info.web_mentions.length > 0 && (
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium mb-3">High-Relevance Web Mentions</h4>
            <WebSearchResults results={enhancedData.personal_info.web_mentions} />
          </div>
        )}

        {/* Combined Search Results */}
        {enhancedData.personal_info.combined_search_results && enhancedData.personal_info.combined_search_results.length > 0 && (
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium mb-3">All Intelligence Results</h4>
            <WebSearchResults results={enhancedData.personal_info.combined_search_results} />
          </div>
        )}
      </div>
    ) : (
      <div className="text-center py-8 text-gray-500">
        <User className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <p>No personal intelligence data available</p>
      </div>
    )}
  </div>
);

const DataTypesTab: React.FC<{ enhancedData: any }> = ({ enhancedData }) => {
  const getDataTypeIcon = (type: string) => {
    const icons: Record<string, React.ReactNode> = {
      OTP: <Key className="w-4 h-4" />,
      EMAIL: <Mail className="w-4 h-4" />,
      CREDIT_CARD: <CreditCard className="w-4 h-4" />,
      CVC: <Shield className="w-4 h-4" />,
      PHONE_NUMBER: <Phone className="w-4 h-4" />,
      PASSWORD: <Lock className="w-4 h-4" />,
      ID: <Hash className="w-4 h-4" />,
      DATE: <Calendar className="w-4 h-4" />,
      DOMAIN: <Globe className="w-4 h-4" />,
      ADDRESS_HEBREW: <MapPin className="w-4 h-4" />,
      ADDRESS_ENGLISH: <MapPin className="w-4 h-4" />
    };
    return icons[type] || <Info className="w-4 h-4" />;
  };

  const getDataTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      OTP: 'bg-yellow-100 text-yellow-800',
      EMAIL: 'bg-green-100 text-green-800',
      CREDIT_CARD: 'bg-red-100 text-red-800',
      CVC: 'bg-red-100 text-red-800',
      PHONE_NUMBER: 'bg-blue-100 text-blue-800',
      PASSWORD: 'bg-purple-100 text-purple-800',
      ID: 'bg-indigo-100 text-indigo-800',
      DATE: 'bg-gray-100 text-gray-800',
      DOMAIN: 'bg-cyan-100 text-cyan-800',
      ADDRESS_HEBREW: 'bg-orange-100 text-orange-800',
      ADDRESS_ENGLISH: 'bg-orange-100 text-orange-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Detailed Data Analysis</h3>
      {enhancedData.detected_data ? (
        <div className="space-y-6">
          {Object.entries(enhancedData.detected_data as DetectedData).map(([type, items]) => 
            items.length > 0 && (
              <div key={type} className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  {getDataTypeIcon(type)}
                  {type.replace('_', ' ')} ({items.length} found)
                </h4>
                <div className="grid gap-2">
                  {items.map((item: string, index: number) => (
                    <div key={index} className={`p-3 rounded-lg ${getDataTypeColor(type)}`}>
                      <div className="font-mono text-sm">
                        {type === 'PASSWORD' || type === 'CVC' 
                          ? `${'*'.repeat(item.length)} (${item.length} chars)` 
                          : item
                        }
                      </div>
                      {/* Additional context for certain data types */}
                      {type === 'PHONE_NUMBER' && (
                        <div className="text-xs mt-1 opacity-75">
                          {item.replace(/\D/g, '').length} digits
                          {item.startsWith('+') && ' (International format)'}
                        </div>
                      )}
                      {type === 'EMAIL' && (
                        <div className="text-xs mt-1 opacity-75">
                          Domain: {item.split('@')[1]}
                        </div>
                      )}
                      {type === 'CREDIT_CARD' && (
                        <div className="text-xs mt-1 opacity-75">
                          {item.replace(/\D/g, '').length} digits
                          {item.startsWith('4') && ' (Visa)'}
                          {item.startsWith('5') && ' (MasterCard)'}
                          {item.startsWith('3') && ' (Amex)'}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <Database className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>No detailed data analysis available</p>
        </div>
      )}
    </div>
  );
};

const EmailAnalysisTab: React.FC<{ enhancedData: any }> = ({ enhancedData }) => {
  console.log("📧 EmailAnalysisTab received:", enhancedData?.email_analysis);
  
  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Email Analysis</h3>
      
      {enhancedData.email_analysis && enhancedData.email_analysis.length > 0 ? (
        <div className="space-y-6">
          {enhancedData.email_analysis.map((analysis: any, index: number) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-4">
                <Mail className="w-6 h-6 text-green-600" />
                <div>
                  <h4 className="font-medium text-lg">{analysis.email}</h4>
                  <div className="text-sm text-gray-600">
                    Domain: {analysis.email?.split('@')[1] || analysis.osint_result?.domain || 'Unknown'}
                  </div>
                </div>
              </div>

              {/* OSINT Results */}
              {analysis.osint_result && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                  <h5 className="font-medium mb-2 text-blue-900">OSINT Analysis</h5>
                  <div className="text-sm text-blue-800 space-y-1">
                    <div>Username: <span className="font-mono">{analysis.osint_result.username}</span></div>
                    <div>Domain: <span className="font-mono">{analysis.osint_result.domain}</span></div>
                  </div>
                </div>
              )}

              {/* Web Search Results */}
              {analysis.web_search_results && analysis.web_search_results.length > 0 && (
                <div className="mb-4">
                  <h5 className="font-medium mb-3">Web Search Results ({analysis.web_search_results.length})</h5>
                  <WebSearchResults results={analysis.web_search_results} />
                </div>
              )}

              {/* Breach Check Results */}
              {analysis.breach_check_results && analysis.breach_check_results.length > 0 && (
                <div>
                  <h5 className="font-medium mb-3 text-red-700">Data Breach Results ({analysis.breach_check_results.length})</h5>
                  <BreachResults breaches={analysis.breach_check_results} />
                </div>
              )}

              {/* Show message if no results found */}
              {(!analysis.web_search_results || analysis.web_search_results.length === 0) &&
               (!analysis.breach_check_results || analysis.breach_check_results.length === 0) && (
                <div className="text-center py-4 text-gray-500">
                  <div className="text-sm">No web search results or breach data found for this email.</div>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-blue-600">Show raw analysis data</summary>
                    <pre className="text-xs bg-gray-100 p-2 rounded mt-1 text-left">
                      {JSON.stringify(analysis, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <Mail className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>No email analysis data available</p>
          
          {/* Debug info */}
          {enhancedData && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-blue-600">Show debug info</summary>
              <div className="mt-2 text-xs bg-gray-100 p-3 rounded text-left">
                <div className="mb-2"><strong>Has email_analysis:</strong> {enhancedData.email_analysis ? 'Yes' : 'No'}</div>
                <div className="mb-2"><strong>email_analysis type:</strong> {typeof enhancedData.email_analysis}</div>
                <div className="mb-2"><strong>email_analysis length:</strong> {enhancedData.email_analysis?.length || 0}</div>
                <div className="mb-2"><strong>Detected emails:</strong> {enhancedData.detected_data?.EMAIL?.length || 0}</div>
                <div><strong>Available data keys:</strong> {Object.keys(enhancedData).join(', ')}</div>
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
};

const PhoneAnalysisTab: React.FC<{ enhancedData: any }> = ({ enhancedData }) => (
  <div>
    <h3 className="text-lg font-semibold mb-4">Phone Number Analysis</h3>
    {enhancedData.phone_analysis && enhancedData.phone_analysis.length > 0 ? (
      <div className="space-y-6">
        {enhancedData.phone_analysis.map((analysis: any, index: number) => (
          <div key={index} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-4">
              <Phone className="w-6 h-6 text-blue-600" />
              <div>
                <h4 className="font-medium text-lg">{analysis.phone}</h4>
                <div className="text-sm text-gray-600">
                  {analysis.phoneinfoga_result?.cleaned?.length || 0} digits
                </div>
              </div>
            </div>

            {/* Phone Intelligence */}
            {analysis.phoneinfoga_result && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                <h5 className="font-medium mb-2 text-blue-900">Phone Intelligence</h5>
                <div className="text-sm text-blue-800 space-y-1">
                  <div>Cleaned: {analysis.phoneinfoga_result.cleaned}</div>
                  <div>Country Code: {analysis.phoneinfoga_result.analysis?.has_country_code ? 'Yes' : 'No'}</div>
                  <div>Possible Country: {analysis.phoneinfoga_result.analysis?.possible_country || 'Unknown'}</div>
                </div>
              </div>
            )}

            {/* Web Search Results */}
            {analysis.web_search_results && analysis.web_search_results.length > 0 && (
              <div>
                <h5 className="font-medium mb-3">Web Search Results</h5>
                <WebSearchResults results={analysis.web_search_results} />
              </div>
            )}
          </div>
        ))}
      </div>
    ) : (
      <div className="text-center py-8 text-gray-500">
        <Phone className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <p>No phone analysis data available</p>
      </div>
    )}
  </div>
);

const WebSearchTab: React.FC<{ enhancedData: any }> = ({ enhancedData }) => (
  <div>
    <h3 className="text-lg font-semibold mb-4">Web Intelligence Summary</h3>
    {enhancedData.google_searches && enhancedData.google_searches.length > 0 ? (
      <div className="space-y-6">
        {/* Search Statistics */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <Search className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-blue-600">
              {enhancedData.google_searches.length}
            </div>
            <div className="text-sm text-gray-600">Total Searches</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-green-600">
              {enhancedData.web_search_summary?.potential_matches_found || 0}
            </div>
            <div className="text-sm text-gray-600">Potential Matches</div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <Globe className="w-8 h-8 text-purple-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-purple-600">
              {enhancedData.web_search_summary?.breach_checks_performed || 0}
            </div>
            <div className="text-sm text-gray-600">Breach Checks</div>
          </div>
        </div>

        {/* Search History */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium mb-3">Search History</h4>
          <div className="space-y-3">
            {enhancedData.google_searches.map((search: any, index: number) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="font-mono text-sm text-gray-800">
                    "{search.query}"
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    Type: {search.type?.replace('_', ' ')} | Priority: {search.priority}
                  </div>
                </div>
                <div className="text-xs text-gray-500 ml-4">
                  {new Date(search.timestamp * 1000).toLocaleTimeString()}
                  <span className="ml-2 bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    {search.results_count} results
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ) : (
      <div className="text-center py-8 text-gray-500">
        <Globe className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <p>No web search data available</p>
      </div>
    )}
  </div>
);

const BreachesTab: React.FC<{ enhancedData: any }> = ({ enhancedData }) => {
  // Collect all breach results from email analysis
  const allBreaches = enhancedData.email_analysis?.reduce((acc: any[], analysis: any) => {
    if (analysis.breach_check_results && analysis.breach_check_results.length > 0) {
      acc.push(...analysis.breach_check_results.map((breach: any) => ({
        ...breach,
        associated_email: analysis.email
      })));
    }
    return acc;
  }, []) || [];

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Data Breach Analysis</h3>
      
      {allBreaches.length > 0 ? (
        <div className="space-y-6">
          {/* Breach Summary */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <AlertTriangle className="w-8 h-8 text-red-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-red-600">
                {allBreaches.filter((b: any) => b.verified).length}
              </div>
              <div className="text-sm text-gray-600">Verified Breaches</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <AlertCircle className="w-8 h-8 text-orange-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-orange-600">
                {allBreaches.filter((b: any) => !b.verified).length}
              </div>
              <div className="text-sm text-gray-600">Unverified Reports</div>
            </div>
          </div>

          {/* Breach Details */}
          <BreachResults breaches={allBreaches} />
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <Shield className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>No data breach information found</p>
          <p className="text-sm mt-2">This is good news - no breaches detected for the analyzed data</p>
        </div>
      )}
    </div>
  );
};

const WebSearchResults: React.FC<{ results: any[] }> = ({ results }) => (
  <div className="space-y-3 max-h-96 overflow-y-auto">
    {results.map((result: any, index: number) => (
      <div key={index} className="border border-gray-200 rounded-lg p-4 bg-white">
        <div className="flex items-start gap-3">
          <Globe className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="font-medium text-blue-900 hover:text-blue-700">
                <a href={result.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                  {result.title}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </h4>
              {result.relevance_score && (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                  {Math.round(result.relevance_score * 100)}% match
                </span>
              )}
            </div>
            <p className="text-sm text-gray-700 mb-2">{result.snippet}</p>
            <div className="text-xs text-gray-500">
              Source: {result.source} • {result.url}
            </div>
          </div>
        </div>
      </div>
    ))}
  </div>
);

const BreachResults: React.FC<{ breaches: any[] }> = ({ breaches }) => (
  <div className="space-y-3">
    {breaches.map((breach: any, index: number) => (
      <div key={index} className={`border rounded-lg p-4 ${
        breach.verified ? 'border-red-300 bg-red-50' : 'border-orange-300 bg-orange-50'
      }`}>
        <div className="flex items-start gap-3">
          <AlertTriangle className={`w-5 h-5 mt-1 flex-shrink-0 ${
            breach.verified ? 'text-red-600' : 'text-orange-600'
          }`} />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h4 className={`font-medium ${
                breach.verified ? 'text-red-900' : 'text-orange-900'
              }`}>
                {breach.breach_name}
              </h4>
              <span className={`text-xs px-2 py-1 rounded ${
                breach.verified 
                  ? 'bg-red-100 text-red-800' 
                  : 'bg-orange-100 text-orange-800'
              }`}>
                {breach.verified ? 'Verified' : 'Unverified'}
              </span>
            </div>
            
            {breach.associated_email && (
              <div className="text-sm text-gray-700 mb-2">
                <strong>Associated Email:</strong> {breach.associated_email}
              </div>
            )}
            
            <p className="text-sm text-gray-700 mb-2">{breach.description}</p>
            
            {breach.date && breach.date !== 'Unknown' && (
              <div className="text-xs text-gray-600 mb-2">
                <strong>Date:</strong> {breach.date}
              </div>
            )}
            
            {breach.compromised_data && Array.isArray(breach.compromised_data) && (
              <div className="text-xs text-gray-600">
                <strong>Compromised Data:</strong> {breach.compromised_data.join(', ')}
              </div>
            )}
            
            {breach.source_url && (
              <div className="text-xs text-gray-600 mt-2">
                <a 
                  href={breach.source_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  View Source <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    ))}
  </div>
);

export default EnhancedOSINTDisplay;