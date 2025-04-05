'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface User {
  email: string;
  name: string;
}

interface TestResult {
  user1: string;
  user2: string;
  score: number;
  details: {
    [key: string]: number;
  };
}

interface DebugInfo {
  surveyCount: number;
  dbStatus?: {
    connected: boolean;
    dbName: string | null;
  };
  collections?: string[];
}

export default function TestingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [testUsers, setTestUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingUsers, setAddingUsers] = useState(false);
  const [deletingUsers, setDeletingUsers] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [calculating, setCalculating] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [resultsFilter, setResultsFilter] = useState('all');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [loadingDebug, setLoadingDebug] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    connected?: boolean;
    dbName?: string;
    collectionCount?: number;
    message?: string;
  } | null>(null);
  const [checkingConnection, setCheckingConnection] = useState(false);
  
  // New states for enhanced testing functionality
  const [numUsersToAdd, setNumUsersToAdd] = useState<number>(10);
  const [centralUser, setCentralUser] = useState<string | null>(null);
  const [minCompatibilityScore, setMinCompatibilityScore] = useState<number>(50);
  const [compatibilityResults, setCompatibilityResults] = useState<any[]>([]);
  const [loadingCompatibility, setLoadingCompatibility] = useState(false);
  const [selectedUserDetails, setSelectedUserDetails] = useState<any>(null);
  const [loadingUserDetails, setLoadingUserDetails] = useState(false);
  
  useEffect(() => {
    // Only redirect if not authenticated (don't check for survey completion)
    if (status === 'unauthenticated') {
      router.push('/');
      return;
    }
    
    // Fetch test users if authenticated
    if (status === 'authenticated') {
      // Set a timeout to prevent infinite loading
      const timeoutId = setTimeout(() => {
        if (loading) {
          setError('Still loading... Click "Skip Loading" if you want to continue without waiting.');
          setLoading(false);
        }
      }, 10000); // 10 seconds timeout
      
      fetchDebugInfo()
        .then(() => {
          // After debug info is loaded, fetch test users
          return fetchTestUsers();
        })
        .catch(error => {
          console.error('Error in initial load:', error);
          setError(`Initial loading failed: ${error instanceof Error ? error.message : String(error)}`);
          setLoading(false);
        });
      
      // Clean up the timeout when the component unmounts or the fetch completes
      return () => clearTimeout(timeoutId);
    }
  }, [status, router]);
  
  const fetchTestUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      const response = await fetch('/api/testing/fetch-test-users');
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch test users: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      
      if (data.testUsers) {
        setTestUsers(data.testUsers);
        if (data.testUsers.length === 0) {
          setError('No test users found. They might exist in the database but couldn\'t be retrieved.');
        }
      } else {
        setError(`Error: ${data.error || 'Unknown error fetching test users'}`);
      }
    } catch (error) {
      console.error('Error fetching test users:', error);
      setError(`Error fetching test users: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchDebugInfo = async () => {
    try {
      setLoadingDebug(true);
      setError(null);
      setSuccess(null);
      
      // Set timeout for this particular request - reduced to 10 seconds
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds timeout
      
      const response = await fetch('/api/testing/debug', {
        signal: controller.signal
      }).catch(error => {
        if (error.name === 'AbortError') {
          throw new Error('Request timed out after 10 seconds. The database may be unavailable.');
        }
        throw error;
      });
      
      // Clear the timeout since the request completed
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        let errorText = 'Unknown error';
        try {
          // Try to get the response text, but don't break if it fails
          errorText = await response.text();
        } catch (e) {
          console.error('Failed to get error text:', e);
        }
        throw new Error(`Failed to fetch debug info: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      let data;
      try {
        data = await response.json();
      } catch (error) {
        console.error('Failed to parse response as JSON:', error);
        throw new Error(`Invalid response format: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      setDebugInfo(data);
      setSuccess('Database status check completed successfully');
      
      // After successfully fetching debug info, we can set loading to false
      setLoading(false);
      
      return data; // Return the data for any callers that need it
    } catch (error) {
      console.error('Error fetching debug info:', error);
      setError(`Error fetching debug info: ${error instanceof Error ? error.message : String(error)}`);
      // Make sure to set loading to false here too, so we don't get stuck
      setLoading(false);
      throw error; // Rethrow to allow caller to handle
    } finally {
      setLoadingDebug(false);
    }
  };
  
  const addTestUsers = async () => {
    try {
      setAddingUsers(true);
      setError(null);
      setSuccess(null);
      const response = await fetch('/api/testing/add-test-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ numUsers: numUsersToAdd }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to add test users: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Success! Show verification counts
        setError(null);
        // Show success message with counts
        setSuccess(`Successfully added ${numUsersToAdd} test users. Verification: ${data.verificationCounts.surveys} surveys.`);
        // Directly fetch debug info which now includes test users
        fetchDebugInfo();
        // Fetch test users for the UI
        fetchTestUsers();
        // Clear any previous results
        setTestResults([]);
        setSelectedUsers([]);
        setCompatibilityResults([]);
        setCentralUser(null);
      } else {
        setError(`Error adding test users: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error adding test users:', error);
      setError(`Error adding test users: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setAddingUsers(false);
    }
  };
  
  const deleteTestUsers = async () => {
    if (!confirm('Are you sure you want to delete all test users? This action cannot be undone.')) {
      return;
    }
    
    try {
      setDeletingUsers(true);
      setError(null);
      setSuccess(null);
      const response = await fetch('/api/testing/delete-test-users', {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete test users: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Clear test users from UI
        setTestUsers([]);
        setTestResults([]);
        setSelectedUsers([]);
        
        // Show success message with deletion counts
        setSuccess(`Successfully deleted ${data.deletedCounts.surveys} test surveys.`);
        
        // Update debug info to show current counts
        fetchDebugInfo();
      } else {
        setError(`Error deleting test users: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting test users:', error);
      setError(`Error deleting test users: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setDeletingUsers(false);
    }
  };
  
  const toggleUserSelection = (email: string) => {
    setSelectedUsers(prev => 
      prev.includes(email) 
        ? prev.filter(e => e !== email)
        : [...prev, email]
    );
  };
  
  const selectRandomUsers = (count: number) => {
    if (testUsers.length <= count) {
      setSelectedUsers(testUsers.map(u => u.email));
      return;
    }
    
    const shuffled = [...testUsers].sort(() => 0.5 - Math.random());
    setSelectedUsers(shuffled.slice(0, count).map(u => u.email));
  };
  
  const calculateTestScores = async () => {
    try {
      setCalculating(true);
      setError(null);
      const results: TestResult[] = [];
      
      const usersToTest = selectedUsers.length > 0 
        ? testUsers.filter(user => selectedUsers.includes(user.email)) 
        : testUsers;
      
      // Calculate scores for each pair
      const totalPairs = (usersToTest.length * (usersToTest.length - 1)) / 2;
      let processedPairs = 0;
      
      for (let i = 0; i < usersToTest.length; i++) {
        for (let j = i + 1; j < usersToTest.length; j++) {
          const user1 = usersToTest[i];
          const user2 = usersToTest[j];
          
          const response = await fetch(`/api/testing/calculate-score?user1=${user1.email}&user2=${user2.email}`);
          
          if (response.ok) {
            const data = await response.json();
            if (data.score !== null) {
              results.push({
                user1: user1.name,
                user2: user2.name,
                score: data.score,
                details: data.details
              });
            }
          }
          
          processedPairs++;
          // Update every 10 pairs or on last pair
          if (processedPairs % 10 === 0 || processedPairs === totalPairs) {
            setTestResults([...results]);
          }
        }
      }
      
      setTestResults(results);
    } catch (error) {
      console.error('Error calculating scores:', error);
      setError(`Error calculating scores: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setCalculating(false);
    }
  };
  
  // Filter users based on search term
  const filteredUsers = testUsers.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Filter results based on selection
  const filteredResults = testResults.filter(result => {
    if (resultsFilter === 'all') return true;
    const scoreVal = result.score;
    
    switch (resultsFilter) {
      case 'high': return scoreVal >= 80;
      case 'medium': return scoreVal >= 60 && scoreVal < 80;
      case 'low': return scoreVal < 60;
      default: return true;
    }
  });
  
  // Sort results by score (highest first)
  const sortedResults = [...filteredResults].sort((a, b) => b.score - a.score);
  
  const checkConnection = async () => {
    try {
      setCheckingConnection(true);
      setError(null);
      setSuccess(null);
      
      // Set timeout for quick connection check
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 seconds timeout
      
      // Simple, quick connection check
      const response = await fetch('/api/testing/check-connection', {
        signal: controller.signal
      }).catch(error => {
        if (error.name === 'AbortError') {
          throw new Error('Connection check timed out after 8 seconds. The database may be unavailable.');
        }
        throw error;
      });
      
      // Clear the timeout since the request completed
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        let errorText = 'Unknown error';
        try {
          errorText = await response.text();
        } catch (e) {
          console.error('Failed to get error text:', e);
        }
        throw new Error(`Connection check failed: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setConnectionStatus({
          connected: data.connection.connected,
          dbName: data.connection.dbName,
          collectionCount: data.connection.collectionCount,
          message: `Connected to ${data.connection.dbName} with ${data.connection.collectionCount} collections`
        });
        
        setSuccess('Database connection successful');
        
        // If connection is successful but we're still in loading state, 
        // we might have other issues, so let users see the main UI
        if (loading) {
          setLoading(false);
        }
      } else {
        throw new Error(data.error || 'Unknown connection error');
      }
    } catch (error) {
      console.error('Connection check failed:', error);
      setConnectionStatus({
        connected: false,
        message: `Connection failed: ${error instanceof Error ? error.message : String(error)}`
      });
      setError(`Connection check failed: ${error instanceof Error ? error.message : String(error)}`);
      // Make sure to set loading to false here too, so we don't get stuck
      if (loading) {
        setLoading(false);
      }
    } finally {
      setCheckingConnection(false);
    }
  };
  
  // Add function to calculate compatibility for a central user
  const calculateCentralUserCompatibility = async () => {
    if (!centralUser) {
      setError('Please select a central user first');
      return;
    }
    
    try {
      setLoadingCompatibility(true);
      setError(null);
      setSuccess(null);
      
      const response = await fetch(`/api/testing/user-compatibility?userEmail=${encodeURIComponent(centralUser)}&minScore=${minCompatibilityScore}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to calculate compatibility: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      
      setCompatibilityResults(data.compatibleUsers || []);
      setSuccess(`Found ${data.compatibleUsers.length} compatible users out of ${data.totalUsersChecked} total users`);
    } catch (error) {
      console.error('Error calculating compatibility:', error);
      setError(`Error calculating compatibility: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoadingCompatibility(false);
    }
  };
  
  // Modify the viewUserDetails function to also fetch central user data when needed
  const viewUserDetails = async (userEmail: string) => {
    try {
      setLoadingUserDetails(true);
      setError(null);
      
      // If we have a central user and it's not the same as the user being viewed,
      // we should load both users' details for comparison
      if (centralUser && centralUser !== userEmail) {
        // Get both users in parallel
        const [userResponse, centralUserResponse] = await Promise.all([
          fetch(`/api/testing/get-test-user?userEmail=${encodeURIComponent(userEmail)}`),
          fetch(`/api/testing/get-test-user?userEmail=${encodeURIComponent(centralUser)}`)
        ]);
        
        if (!userResponse.ok) {
          const errorText = await userResponse.text();
          throw new Error(`Failed to get user details: ${userResponse.status} ${userResponse.statusText} - ${errorText}`);
        }
        
        if (!centralUserResponse.ok) {
          const errorText = await centralUserResponse.text();
          throw new Error(`Failed to get central user details: ${centralUserResponse.status} ${centralUserResponse.statusText} - ${errorText}`);
        }
        
        const userData = await userResponse.json();
        const centralUserData = await centralUserResponse.json();
        
        setSelectedUserDetails({
          user: userData.user,
          centralUser: centralUserData.user,
          // Also find compatibility score if we have compatibility results
          compatibilityScore: compatibilityResults.find(r => r.user.email === userEmail)
        });
      } else {
        // Just get the single user (either there's no central user or we're viewing the central user)
        const response = await fetch(`/api/testing/get-test-user?userEmail=${encodeURIComponent(userEmail)}`);
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to get user details: ${response.status} ${response.statusText} - ${errorText}`);
        }
        
        const data = await response.json();
        
        setSelectedUserDetails({
          user: data.user
        });
      }
    } catch (error) {
      console.error('Error getting user details:', error);
      setError(`Error getting user details: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoadingUserDetails(false);
    }
  };
  
  // Function to set a user as the central user
  const setCentralUserHandler = (userEmail: string) => {
    setCentralUser(userEmail);
    setCompatibilityResults([]);
    setSuccess(`Set ${userEmail} as central user. Calculate compatibility to see matches.`);
  };
  
  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) {
      return dateString || 'N/A';
    }
  };
  
  // Format preferences for display
  const formatPreferences = (preferences: any[]) => {
    if (!Array.isArray(preferences) || preferences.length === 0) {
      return 'No preferences set';
    }
    
    return preferences.map(pref => 
      `${pref.item}: ${pref.strength}`
    ).join(', ');
  };
  
  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold mb-4">Recommendation Engine Testing</h1>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-500 mb-4">Loading... {connectionStatus?.message && `(${connectionStatus.message})`}</p>
            
            <div className="flex flex-wrap gap-3 mb-4">
              <button
                onClick={checkConnection}
                disabled={checkingConnection}
                className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 disabled:bg-yellow-300"
              >
                {checkingConnection ? 'Checking Connection...' : 'Quick Connection Check'}
              </button>
              
              <button
                onClick={() => {
                  setLoading(false);
                  setError(null);
                }}
                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
              >
                Skip Loading &amp; Show UI
              </button>
            </div>
            
            {error && (
              <>
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                  <p className="font-medium">Error:</p>
                  <p className="text-sm">{error}</p>
                </div>
                <div className="flex flex-wrap gap-3 mb-4">
                  <button 
                    onClick={() => {
                      setLoading(true);
                      setError(null);
                      fetchDebugInfo().catch(err => {
                        setError(`Retry failed: ${err instanceof Error ? err.message : String(err)}`);
                        setLoading(false);
                      });
                    }}
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                  >
                    Retry Loading
                  </button>
                  
                  <button
                    onClick={() => {
                      setLoading(false); // Stop loading mode to show the main UI
                      setError(null);
                    }}
                    className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                  >
                    Skip Loading
                  </button>
                  
                  <button
                    onClick={() => addTestUsers()}
                    disabled={addingUsers}
                    className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 disabled:bg-purple-300"
                  >
                    {addingUsers ? 'Adding Test Users...' : 'Add Test Users'}
                  </button>
                  
                  <button
                    onClick={() => {
                      setLoading(false); // Stop loading mode
                      fetchDebugInfo()
                        .then(() => fetchTestUsers())
                        .catch(err => console.error('Error fetching data:', err));
                    }}
                    disabled={loadingDebug}
                    className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:bg-green-300"
                  >
                    {loadingDebug ? 'Checking...' : 'Check Database Status'}
                  </button>
                </div>
              </>
            )}
            
            {connectionStatus && (
              <div className={`mt-4 p-3 rounded border ${connectionStatus.connected ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                <h3 className="font-medium mb-2">Database Connection Status:</h3>
                <div className="text-sm">
                  <p>Connected: <span className="font-mono">{connectionStatus.connected ? 'Yes' : 'No'}</span></p>
                  {connectionStatus.dbName && <p>Database: <span className="font-mono">{connectionStatus.dbName}</span></p>}
                  {connectionStatus.collectionCount !== undefined && <p>Collections: <span className="font-mono">{connectionStatus.collectionCount}</span></p>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Testing Dashboard</h1>
      
      {/* Display errors and success messages */}
      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}
      {success && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">{success}</div>}
      
      {/* Database Connection Status */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h2 className="text-xl font-semibold mb-2">Database Status</h2>
        
        {debugInfo ? (
          <div>
            <p><strong>Total Surveys:</strong> {debugInfo.surveyCount}</p>
            <p><strong>Connection Status:</strong> {debugInfo.dbStatus?.connected ? '✅ Connected' : '❌ Disconnected'}</p>
            <p><strong>Database:</strong> {debugInfo.dbStatus?.dbName}</p>
            <p><strong>Collections:</strong> {debugInfo.collections?.join(', ')}</p>
          </div>
        ) : (
          <p>{loadingDebug ? 'Loading database status...' : 'Database status not available'}</p>
        )}
        
        <button 
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 mr-2"
          onClick={fetchDebugInfo}
          disabled={loadingDebug}
        >
          {loadingDebug ? 'Loading...' : 'Refresh Status'}
        </button>
      </div>
      
      {/* Test User Management */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h2 className="text-xl font-semibold mb-2">Test User Management</h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Number of Test Users to Add:</label>
          <div className="flex items-center">
            <input 
              type="number" 
              value={numUsersToAdd} 
              onChange={(e) => setNumUsersToAdd(Math.max(1, Math.min(100, parseInt(e.target.value) || 10)))} 
              className="border p-2 rounded mr-2"
              min="1"
              max="100"
            />
            <button
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 mr-2"
              onClick={addTestUsers}
              disabled={addingUsers}
            >
              {addingUsers ? 'Adding...' : 'Add Random Test Users'}
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-1">Generates random users with varied characteristics</p>
        </div>
        
        <button
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          onClick={deleteTestUsers}
          disabled={deletingUsers}
        >
          {deletingUsers ? 'Deleting...' : 'Delete All Test Users'}
        </button>
      </div>
      
      {/* Test Users List */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Test Users</h2>
        
        {loading ? (
          <p>Loading test users...</p>
        ) : (
          <>
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search users..."
                className="border p-2 rounded w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            {testUsers.length === 0 ? (
              <p>No test users found. Add some test users to get started.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border">
                  <thead>
                    <tr>
                      <th className="px-4 py-2 border">Email</th>
                      <th className="px-4 py-2 border">Name</th>
                      <th className="px-4 py-2 border">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {testUsers
                      .filter(user => 
                        searchTerm === '' || 
                        user.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        user.name.toLowerCase().includes(searchTerm.toLowerCase())
                      )
                      .slice(0, showAllUsers ? undefined : 10)
                      .map(user => (
                        <tr key={user.email} className={centralUser === user.email ? "bg-blue-100" : ""}>
                          <td className="px-4 py-2 border">{user.email}</td>
                          <td className="px-4 py-2 border">{user.name}</td>
                          <td className="px-4 py-2 border">
                            <button
                              className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 mr-2"
                              onClick={() => setCentralUserHandler(user.email)}
                            >
                              Set as Central
                            </button>
                            <button
                              className="px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
                              onClick={() => viewUserDetails(user.email)}
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                
                {testUsers.length > 10 && !showAllUsers && (
                  <button
                    className="mt-2 px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
                    onClick={() => setShowAllUsers(true)}
                  >
                    Show All ({testUsers.length})
                  </button>
                )}
                
                {showAllUsers && (
                  <button
                    className="mt-2 px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
                    onClick={() => setShowAllUsers(false)}
                  >
                    Show Less
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Compatibility Testing Section */}
      {centralUser && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">Compatibility Testing</h2>
          
          <div className="mb-4">
            <p><strong>Central User:</strong> {centralUser}</p>
            <div className="flex items-center mt-2">
              <label className="mr-2">Minimum Compatibility Score:</label>
              <input 
                type="number" 
                value={minCompatibilityScore} 
                onChange={(e) => setMinCompatibilityScore(Math.max(0, Math.min(100, parseInt(e.target.value) || 50)))} 
                className="border p-2 rounded mr-2"
                min="0"
                max="100"
              />
              <span>%</span>
            </div>
            
            <button
              className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              onClick={calculateCentralUserCompatibility}
              disabled={loadingCompatibility}
            >
              {loadingCompatibility ? 'Calculating...' : 'Calculate Compatibility'}
            </button>
          </div>
          
          {/* Compatibility Results */}
          {compatibilityResults.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Compatible Users ({compatibilityResults.length})</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border">
                  <thead>
                    <tr>
                      <th className="px-4 py-2 border">User</th>
                      <th className="px-4 py-2 border">Compatibility Score</th>
                      <th className="px-4 py-2 border">Location Score</th>
                      <th className="px-4 py-2 border">Budget Score</th>
                      <th className="px-4 py-2 border">Gender Score</th>
                      <th className="px-4 py-2 border">Timing Score</th>
                      <th className="px-4 py-2 border">Preferences Score</th>
                      <th className="px-4 py-2 border">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compatibilityResults.map((result, index) => (
                      <tr key={index}>
                        <td className="px-4 py-2 border">{result.user.email}</td>
                        <td className="px-4 py-2 border">{result.score.toFixed(1)}%</td>
                        <td className="px-4 py-2 border">{result.details.locationScore.toFixed(1)}%</td>
                        <td className="px-4 py-2 border">{result.details.budgetScore.toFixed(1)}%</td>
                        <td className="px-4 py-2 border">{result.details.genderScore.toFixed(1)}%</td>
                        <td className="px-4 py-2 border">{result.details.timingScore.toFixed(1)}%</td>
                        <td className="px-4 py-2 border">{result.details.preferencesScore.toFixed(1)}%</td>
                        <td className="px-4 py-2 border">
                          <button
                            className="px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
                            onClick={() => viewUserDetails(result.user.email)}
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* User Details Modal - Modified to show side-by-side comparison */}
      {selectedUserDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10">
          <div className="bg-white p-6 rounded-lg max-w-5xl w-full max-h-screen overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">
                {selectedUserDetails.centralUser ? 'User Comparison' : `User Details: ${selectedUserDetails.user.name || selectedUserDetails.user.email}`}
              </h2>
              <button 
                className="text-2xl text-gray-600"
                onClick={() => setSelectedUserDetails(null)}
              >
                ×
              </button>
            </div>
            
            {selectedUserDetails.centralUser ? (
              // Side-by-side comparison view
              <>
                {selectedUserDetails.compatibilityScore && (
                  <div className="bg-blue-50 p-4 mb-4 rounded-lg">
                    <h3 className="font-semibold text-lg mb-2">Compatibility Score: {selectedUserDetails.compatibilityScore.score.toFixed(1)}%</h3>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                      <div className="bg-white p-2 rounded">
                        <div className="font-medium">Location</div>
                        <div className="text-lg">{selectedUserDetails.compatibilityScore.details.locationScore.toFixed(1)}%</div>
                      </div>
                      <div className="bg-white p-2 rounded">
                        <div className="font-medium">Budget</div>
                        <div className="text-lg">{selectedUserDetails.compatibilityScore.details.budgetScore.toFixed(1)}%</div>
                      </div>
                      <div className="bg-white p-2 rounded">
                        <div className="font-medium">Gender</div>
                        <div className="text-lg">{selectedUserDetails.compatibilityScore.details.genderScore.toFixed(1)}%</div>
                      </div>
                      <div className="bg-white p-2 rounded">
                        <div className="font-medium">Timing</div>
                        <div className="text-lg">{selectedUserDetails.compatibilityScore.details.timingScore.toFixed(1)}%</div>
                      </div>
                      <div className="bg-white p-2 rounded">
                        <div className="font-medium">Preferences</div>
                        <div className="text-lg">{selectedUserDetails.compatibilityScore.details.preferencesScore.toFixed(1)}%</div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Central User Column */}
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-lg mb-3 text-blue-800">Central User: {selectedUserDetails.centralUser.name || selectedUserDetails.centralUser.email}</h3>
                    
                    <div className="grid gap-4">
                      <div>
                        <h4 className="font-semibold">Basic Information</h4>
                        <p><strong>Email:</strong> {selectedUserDetails.centralUser.email}</p>
                        <p><strong>Name:</strong> {selectedUserDetails.centralUser.name}</p>
                        <p><strong>Gender:</strong> {selectedUserDetails.centralUser.surveyData.gender || 'N/A'}</p>
                        <p><strong>Room with Different Gender:</strong> {selectedUserDetails.centralUser.surveyData.roomWithDifferentGender ? 'Yes' : 'No'}</p>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold">Location</h4>
                        <p><strong>Region:</strong> {selectedUserDetails.centralUser.surveyData.housingRegion || 'N/A'}</p>
                        <p><strong>Cities:</strong> {selectedUserDetails.centralUser.surveyData.housingCities?.join(', ') || 'N/A'}</p>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold">Timing & Budget</h4>
                        <p><strong>Internship Start:</strong> {formatDate(selectedUserDetails.centralUser.surveyData.internshipStartDate)}</p>
                        <p><strong>Internship End:</strong> {formatDate(selectedUserDetails.centralUser.surveyData.internshipEndDate)}</p>
                        <p><strong>Desired Roommates:</strong> {selectedUserDetails.centralUser.surveyData.desiredRoommates || 'N/A'}</p>
                        <p><strong>Monthly Budget:</strong> ${selectedUserDetails.centralUser.surveyData.monthlyBudget?.toLocaleString() || 'N/A'}</p>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold">Preferences</h4>
                        <div className="mt-1">
                          {selectedUserDetails.centralUser.surveyData.preferences?.map((pref: any, index: number) => (
                            <div key={index} className="mb-1">
                              <strong>{pref.item}:</strong> {pref.strength}
                            </div>
                          )) || 'No preferences set'}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Compared User Column */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-lg mb-3">Compared User: {selectedUserDetails.user.name || selectedUserDetails.user.email}</h3>
                    
                    <div className="grid gap-4">
                      <div>
                        <h4 className="font-semibold">Basic Information</h4>
                        <p><strong>Email:</strong> {selectedUserDetails.user.email}</p>
                        <p><strong>Name:</strong> {selectedUserDetails.user.name}</p>
                        <p><strong>Gender:</strong> {selectedUserDetails.user.surveyData.gender || 'N/A'}</p>
                        <p><strong>Room with Different Gender:</strong> {selectedUserDetails.user.surveyData.roomWithDifferentGender ? 'Yes' : 'No'}</p>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold">Location</h4>
                        <p><strong>Region:</strong> {selectedUserDetails.user.surveyData.housingRegion || 'N/A'}</p>
                        <p><strong>Cities:</strong> {selectedUserDetails.user.surveyData.housingCities?.join(', ') || 'N/A'}</p>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold">Timing & Budget</h4>
                        <p><strong>Internship Start:</strong> {formatDate(selectedUserDetails.user.surveyData.internshipStartDate)}</p>
                        <p><strong>Internship End:</strong> {formatDate(selectedUserDetails.user.surveyData.internshipEndDate)}</p>
                        <p><strong>Desired Roommates:</strong> {selectedUserDetails.user.surveyData.desiredRoommates || 'N/A'}</p>
                        <p><strong>Monthly Budget:</strong> ${selectedUserDetails.user.surveyData.monthlyBudget?.toLocaleString() || 'N/A'}</p>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold">Preferences</h4>
                        <div className="mt-1">
                          {selectedUserDetails.user.surveyData.preferences?.map((pref: any, index: number) => (
                            <div key={index} className="mb-1">
                              <strong>{pref.item}:</strong> {pref.strength}
                            </div>
                          )) || 'No preferences set'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold">Central User Notes</h4>
                    <p>{selectedUserDetails.centralUser.surveyData.additionalNotes || 'No additional notes'}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold">Compared User Notes</h4>
                    <p>{selectedUserDetails.user.surveyData.additionalNotes || 'No additional notes'}</p>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t flex justify-between">
                  <button
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    onClick={() => {
                      setCentralUserHandler(selectedUserDetails.user.email);
                      setSelectedUserDetails(null);
                    }}
                  >
                    Set as Central User
                  </button>
                  <button
                    className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                    onClick={() => setSelectedUserDetails(null)}
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              // Original single user view
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-semibold text-lg">Basic Information</h3>
                    <p><strong>Email:</strong> {selectedUserDetails.user.email}</p>
                    <p><strong>Name:</strong> {selectedUserDetails.user.name}</p>
                    <p><strong>Gender:</strong> {selectedUserDetails.user.surveyData.gender || 'N/A'}</p>
                    <p><strong>Room with Different Gender:</strong> {selectedUserDetails.user.surveyData.roomWithDifferentGender ? 'Yes' : 'No'}</p>
                  </div>
                  
                  <div>
                    <h3 className="font-semibold text-lg">Location</h3>
                    <p><strong>Region:</strong> {selectedUserDetails.user.surveyData.housingRegion || 'N/A'}</p>
                    <p><strong>Cities:</strong> {selectedUserDetails.user.surveyData.housingCities?.join(', ') || 'N/A'}</p>
                  </div>
                  
                  <div>
                    <h3 className="font-semibold text-lg">Timing & Budget</h3>
                    <p><strong>Internship Start:</strong> {formatDate(selectedUserDetails.user.surveyData.internshipStartDate)}</p>
                    <p><strong>Internship End:</strong> {formatDate(selectedUserDetails.user.surveyData.internshipEndDate)}</p>
                    <p><strong>Desired Roommates:</strong> {selectedUserDetails.user.surveyData.desiredRoommates || 'N/A'}</p>
                    <p><strong>Monthly Budget:</strong> ${selectedUserDetails.user.surveyData.monthlyBudget?.toLocaleString() || 'N/A'}</p>
                  </div>
                  
                  <div>
                    <h3 className="font-semibold text-lg">Preferences</h3>
                    <div className="mt-2">
                      {selectedUserDetails.user.surveyData.preferences?.map((pref: any, index: number) => (
                        <div key={index} className="mb-1">
                          <strong>{pref.item}:</strong> {pref.strength}
                        </div>
                      )) || 'No preferences set'}
                    </div>
                  </div>
                  
                  <div className="md:col-span-2">
                    <h3 className="font-semibold text-lg">Additional Notes</h3>
                    <p>{selectedUserDetails.user.surveyData.additionalNotes || 'No additional notes'}</p>
                  </div>
                </div>
                
                {centralUser && centralUser !== selectedUserDetails.user.email && (
                  <div className="mt-4 pt-4 border-t">
                    <button
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                      onClick={() => {
                        setCentralUserHandler(selectedUserDetails.user.email);
                        setSelectedUserDetails(null);
                      }}
                    >
                      Set as Central User
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
      
      {/* ... existing testing tools ... */}
    </div>
  );
} 