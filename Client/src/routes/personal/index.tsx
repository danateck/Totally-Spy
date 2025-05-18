import React, { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router'

// Define TypeScript interfaces to match your actual backend response
interface PersonSearchResult {
  success: boolean;
  message: string;
  data: PersonData | null;
}

interface PersonData {
  id: string;
  name: string | null;
  possible_names: string[];
  social_profiles: SocialProfile[];
  education: string[];
  employment: string[];
  locations: string[];
  interests: string[];
  contact_info: ContactInfo[];
  summary: string;
  sources: Source[];
}

interface SocialProfile {
  platform: string;
  url: string;
}

interface ContactInfo {
  type: string;
  value: string;
}

interface Source {
  url: string;
  title: string;
}

// Define the component first
const PersonSearch: React.FC = () => {
  const [personId, setPersonId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PersonSearchResult | null>(null);
  const [forceRefresh, setForceRefresh] = useState<boolean>(false);
  const [debug, setDebug] = useState<string>('');

  const handleSearch = async (): Promise<void> => {
    if (!personId.trim()) {
      setError('Please enter a person ID');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setDebug('');

    try {
      // Choose the appropriate endpoint based on whether we want to force refresh
      const endpoint = forceRefresh 
        ? `/api/person-info/${personId}/refresh` 
        : `/api/person-info/${personId}`;
      
      const method = forceRefresh ? 'POST' : 'GET';
      
      console.log(`Making ${method} request to ${endpoint}`);
      
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Important to include cookies for authentication
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("API Response:", data); // Add this to debug the response format
      
      // Store the raw JSON response string for debugging
      setDebug(JSON.stringify(data, null, 2));
      
      if (data.success) {
        setResult(data);
      } else {
        setError(data.message || 'Failed to retrieve person information');
      }
    } catch (err) {
      console.error("Error details:", err);
      setError('An error occurred while searching for the person');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="person-search-container">
      <h2>Person Information Search</h2>
      
      <div className="search-input-group">
        <input
          type="text"
          value={personId}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPersonId(e.target.value)}
          placeholder="Enter Person ID"
          className="person-id-input"
        />
        
        <label className="refresh-checkbox">
          <input
            type="checkbox"
            checked={forceRefresh}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForceRefresh(e.target.checked)}
          />
          Force refresh data
        </label>
        
        <button 
          onClick={handleSearch}
          disabled={loading}
          className="search-button"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      {loading && (
        <div className="loading-indicator">
          <p>Searching for information... This may take a moment.</p>
        </div>
      )}
      
      {debug && !result?.success && (
        <div className="debug-section">
          <h4>Debug Information</h4>
          <pre>{debug}</pre>
        </div>
      )}
      
      {result && result.success && result.data && (
        <div className="search-result">
          <h3>Search Results for ID: {result.data.id}</h3>
          
          {/* Summary Section */}
          <div className="result-section">
            <h4>Summary</h4>
            <p>{result.data.summary}</p>
          </div>
          
          {/* Basic Information */}
          <div className="result-section">
            <h4>Basic Information</h4>
            <p><strong>Name:</strong> {result.data.name || 'Unknown'}</p>
            
            {result.data.possible_names && result.data.possible_names.length > 0 && (
              <div>
                <strong>Possible Names:</strong>
                <ul className="data-list">
                  {result.data.possible_names.map((name, index) => (
                    <li key={index}>{name}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {result.data.locations && result.data.locations.length > 0 && (
              <div>
                <strong>Locations:</strong>
                <ul className="data-list">
                  {result.data.locations.map((location, index) => (
                    <li key={index}>{location}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          
          {/* Social Profiles */}
          {result.data.social_profiles && result.data.social_profiles.length > 0 && (
            <div className="result-section">
              <h4>Social Profiles</h4>
              <ul className="data-list">
                {result.data.social_profiles.map((profile, index) => (
                  <li key={index}>
                    <strong>{profile.platform}:</strong>{' '}
                    <a href={profile.url} target="_blank" rel="noopener noreferrer">
                      {profile.url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Education */}
          {result.data.education && result.data.education.length > 0 && (
            <div className="result-section">
              <h4>Education</h4>
              <ul className="data-list">
                {result.data.education.map((edu, index) => (
                  <li key={index}>{edu}</li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Employment */}
          {result.data.employment && result.data.employment.length > 0 && (
            <div className="result-section">
              <h4>Employment</h4>
              <ul className="data-list">
                {result.data.employment.map((emp, index) => (
                  <li key={index}>{emp}</li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Interests */}
          {result.data.interests && result.data.interests.length > 0 && (
            <div className="result-section">
              <h4>Interests</h4>
              <ul className="data-list">
                {result.data.interests.map((interest, index) => (
                  <li key={index}>{interest}</li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Contact Information */}
          {result.data.contact_info && result.data.contact_info.length > 0 && (
            <div className="result-section">
              <h4>Contact Information</h4>
              <ul className="data-list">
                {result.data.contact_info.map((contact, index) => (
                  <li key={index}>
                    <strong>{contact.type}:</strong> {contact.value}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Sources */}
          {result.data.sources && result.data.sources.length > 0 && (
            <div className="result-section">
              <h4>Sources</h4>
              <ul className="data-list">
                {result.data.sources.map((source, index) => (
                  <li key={index}>
                    <a href={source.url} target="_blank" rel="noopener noreferrer">
                      {source.title || source.url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <style>{`
        .person-search-container {
          max-width: 800px;
          margin: 2rem auto;
          padding: 1.5rem;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          background-color: #fff;
        }

        .person-search-container h2 {
          color:rgb(29, 35, 41);
          margin-bottom: 1.5rem;
          padding-bottom: 0.5rem;
          border-bottom: 2px solid #3498db;
        }

        .search-input-group {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .person-id-input {
          padding: 0.8rem;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 1rem;
        }

        .refresh-checkbox {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.9rem;
          color: #333;
        }

        .search-button {
          padding: 0.8rem 1.5rem;
          background-color: #3498db;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
          transition: background-color 0.2s;
        }

        .search-button:hover {
          background-color: #2980b9;
        }

        .search-button:disabled {
          background-color: #95a5a6;
          cursor: not-allowed;
        }

        .error-message {
          padding: 0.8rem;
          background-color: #f8d7da;
          color: #721c24;
          border-radius: 4px;
          margin-bottom: 1rem;
        }
        
        .loading-indicator {
          padding: 0.8rem;
          background-color: #e7f3fe;
          color: #0c5460;
          border-radius: 4px;
          margin-bottom: 1rem;
          text-align: center;
        }

        .search-result {
          padding: 1.5rem;
          background-color: #f8f9fa;
          border-radius: 4px;
          margin-top: 1.5rem;
        }

        .search-result h3 {
          color: #2c3e50;
          margin-top: 0;
          margin-bottom: 1.5rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid #e9ecef;
        }
        
        .result-section {
          margin-bottom: 1.5rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid #eee;
          color:rgb(57, 74, 86);
        }
        
        .result-section h4 {
          color: #0056b3;
          margin-bottom: 0.8rem;
        }
        
        .data-list {
          list-style-type: none;
          padding-left: 0;
        }
        
        .data-list li {
          padding: 0.5rem 0;
          border-bottom: 1px dashed #eee;
        }
        
        .data-list li:last-child {
          border-bottom: none;
        }
        
        .debug-section {
          margin-top: 1rem;
          padding: 1rem;
          background-color: #f8f9fa;
          border-radius: 4px;
          border: 1px solid #dee2e6;
        }
        
        .debug-section pre {
          white-space: pre-wrap;
          word-wrap: break-word;
          max-height: 300px;
          overflow-y: auto;
          font-size: 0.8rem;
          background-color: #f1f1f1;
          padding: 0.5rem;
          border-radius: 4px;
        }

        @media (min-width: 768px) {
          .search-input-group {
            flex-direction: row;
            align-items: center;
          }
          
          .person-id-input {
            flex: 1;
          }
        }
      `}</style>
    </div>
  );
};

// Now use the component in the route definition after it's been defined
export const Route = createFileRoute('/personal/')({
  component: PersonSearch,
})

export default PersonSearch;