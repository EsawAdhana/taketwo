'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { SurveyFormData } from '@/constants/survey-constants';
import Image from 'next/image';
import { FiUsers, FiHome, FiDollarSign, FiCalendar, FiList, FiStar, FiSend } from 'react-icons/fi';
import DMButton from '@/components/DMButton';

interface CompatibilityMatch {
  userEmail: string;
  score: number;
  compatibilityDetails: {
    locationScore: number;
    budgetScore: number;
    genderScore: number;
    timingScore: number;
    roommateScore: number;
    preferencesScore: number;
  };
  userProfile: {
    _id: string;
    email: string;
    name?: string;
    image?: string;
  };
}

interface UserDetailProfile extends CompatibilityMatch {
  fullProfile?: {
    gender?: string;
    roomWithDifferentGender?: boolean;
    housingRegion?: string;
    housingCities?: string[];
    internshipStartDate?: string;
    internshipEndDate?: string;
    desiredRoommates?: string;
    minBudget?: number;
    maxBudget?: number;
    preferences?: Array<{item: string; strength: string}>;
    additionalNotes?: string;
    firstName?: string;
  }
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [surveyData, setSurveyData] = useState<SurveyFormData | null>(null);
  const [recommendations, setRecommendations] = useState<CompatibilityMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [selectedUserDetails, setSelectedUserDetails] = useState<UserDetailProfile | null>(null);
  const [loadingUserDetails, setLoadingUserDetails] = useState(false);
  const [showTestUsers, setShowTestUsers] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<CompatibilityMatch[]>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  
  useEffect(() => {
    const fetchSurveyData = async () => {
      try {
        const response = await fetch('/api/survey');
        const result = await response.json();
        
        if (result.data) {
          setSurveyData(result.data);
          
          // If the survey is submitted, fetch recommendations
          if (result.data.isSubmitted) {
            fetchRecommendations();
          }
        }
      } catch (error) {
        console.error('Error fetching survey data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    const fetchRecommendations = async () => {
      setRecommendationsLoading(true);
      try {
        const response = await fetch(`/api/recommendations?showTestUsers=${showTestUsers}`);
        const result = await response.json();
        
        if (response.ok && result.matches) {
          setRecommendations(result.matches);
        }
      } catch (error) {
        console.error('Error fetching recommendations:', error);
      } finally {
        setRecommendationsLoading(false);
      }
    };
    
    if (session?.user) {
      fetchSurveyData();
    }
  }, [session, showTestUsers]);
  
  const viewUserDetails = async (match: CompatibilityMatch) => {
    try {
      setLoadingUserDetails(true);
      
      // Call API to get detailed user profile
      const response = await fetch(`/api/user?email=${encodeURIComponent(match.userEmail)}`);
      
      if (!response.ok) {
        console.error('Failed to fetch user details');
        // Still show the modal with limited information
        setSelectedUserDetails(match);
        return;
      }
      
      const userData = await response.json();
      
      setSelectedUserDetails({
        ...match,
        fullProfile: userData.surveyData
      });
    } catch (error) {
      console.error('Error fetching user details:', error);
      // Still show the modal with limited information
      setSelectedUserDetails(match);
    } finally {
      setLoadingUserDetails(false);
    }
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
  
  // Helper function to get first name
  const getFirstName = (user: {name?: string; email: string}, fullProfile?: any): string => {
    // First check if firstName exists in the fullProfile
    if (fullProfile?.firstName) {
      return fullProfile.firstName;
    }
    // Then check if name exists in the user profile
    if (user.name) {
      return user.name.split(' ')[0];
    }
    // Finally, extract from email as a last resort
    const emailName = user.email.split('@')[0];
    // Capitalize first letter and handle usernames with numbers or special chars
    const namePart = emailName.split(/[^a-zA-Z]/, 1)[0];
    return namePart.charAt(0).toUpperCase() + namePart.slice(1);
  };
  
  const toggleUserSelection = (match: CompatibilityMatch) => {
    if (selectedUsers.some(u => u.userEmail === match.userEmail)) {
      setSelectedUsers(selectedUsers.filter(u => u.userEmail !== match.userEmail));
    } else {
      setSelectedUsers([...selectedUsers, match]);
    }
  };

  const handleCreateGroupChat = async () => {
    if (selectedUsers.length < 2) {
      alert('Please select at least 2 users for a group chat');
      return;
    }

    if (!groupName.trim()) {
      alert('Please enter a group name');
      return;
    }

    setIsCreatingGroup(true);
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          participants: [session?.user?.email, ...selectedUsers.map(u => u.userEmail)],
          isGroup: true,
          name: groupName.trim()
        }),
      });

      const result = await response.json();
      if (result.success && result.data) {
        router.push(`/messages/${result.data._id}`);
      } else {
        throw new Error(result.error || 'Failed to create group chat');
      }
    } catch (error) {
      console.error('Error creating group chat:', error);
      alert('Failed to create group chat. Please try again.');
    } finally {
      setIsCreatingGroup(false);
      setSelectedUsers([]);
      setGroupName('');
    }
  };
  
  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-gray-600">Loading...</div>
      </div>
    );
  }
  
  if (!session) {
    router.push('/');
    return null;
  }
  
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome to Your Dashboard
            </h1>
            <p className="text-gray-600 mt-2">Find your perfect roommate match below.</p>
          </div>
          {selectedUsers.length > 0 && (
            <div className="flex items-center gap-4">
              <input
                type="text"
                placeholder="Enter group name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleCreateGroupChat}
                disabled={isCreatingGroup || selectedUsers.length < 2 || !groupName.trim()}
                className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 flex items-center"
              >
                <FiUsers className="mr-2" />
                {isCreatingGroup ? 'Creating...' : 'Create Group Chat'}
              </button>
              <button
                onClick={() => {
                  setSelectedUsers([]);
                  setGroupName('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
        
        {!surveyData?.isSubmitted && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8">
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <p className="text-amber-700">
                <span className="font-medium">Note:</span> You haven't completed your housing preferences survey yet. 
                To see personalized roommate recommendations, please 
                <button 
                  onClick={() => router.push('/survey')} 
                  className="text-blue-600 underline font-medium ml-1"
                >
                  complete your survey
                </button>.
              </p>
            </div>
          </div>
        )}
        
        <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-white flex items-center">
                <FiUsers className="mr-2" /> Compatible Roommates
              </h2>
              {surveyData?.isSubmitted && (
                <div className="flex items-center">
                  <label className="flex items-center cursor-pointer">
                    <div className="relative">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={showTestUsers}
                        onChange={() => setShowTestUsers(!showTestUsers)}
                      />
                      <div className={`w-10 h-5 bg-gray-300 rounded-full shadow-inner ${showTestUsers ? 'bg-indigo-300' : ''}`}></div>
                      <div className={`absolute left-0 top-0 w-5 h-5 bg-white rounded-full shadow transform ${showTestUsers ? 'translate-x-5' : ''} transition-transform`}></div>
                    </div>
                    <span className="ml-2 text-white text-sm">Show Test Users</span>
                  </label>
                </div>
              )}
            </div>
          </div>
          
          <div className="p-6">
            {!surveyData?.isSubmitted ? (
              <div className="text-center py-10">
                <p className="text-gray-600 mb-4">
                  Complete your housing preferences survey to see your personalized roommate matches.
                </p>
                <button
                  onClick={() => router.push('/survey')}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Take Survey
                </button>
              </div>
            ) : recommendationsLoading ? (
              <div className="text-center py-10">
                <div className="animate-pulse text-gray-600">Loading recommendations...</div>
              </div>
            ) : recommendations.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-gray-600 mb-4">
                  We haven't found any matches for you yet. Check back later or try adjusting your preferences.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {recommendations.map((match) => {
                  const matchQuality = match.score >= 85 ? 'high' : match.score >= 70 ? 'medium' : 'standard';
                  const qualityColors = {
                    high: 'from-green-50 to-green-100 border-green-200 hover:from-green-100 hover:to-green-50',
                    medium: 'from-blue-50 to-blue-100 border-blue-200 hover:from-blue-100 hover:to-blue-50',
                    standard: 'from-gray-50 to-gray-100 border-gray-200 hover:from-gray-100 hover:to-gray-50'
                  };
                  
                  const displayName = getFirstName(match.userProfile, match.fullProfile);
                  const isSelected = selectedUsers.some(u => u.userEmail === match.userEmail);
                  
                  return (
                    <div 
                      key={match.userEmail} 
                      className={`border rounded-xl p-5 bg-gradient-to-br ${qualityColors[matchQuality]} transition-all duration-200 flex flex-col h-full relative ${
                        isSelected ? 'ring-2 ring-indigo-500' : ''
                      }`}
                    >
                      {/* Selection indicator */}
                      <div 
                        className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                          isSelected ? 'bg-indigo-500 text-white' : 'bg-white border-2 border-gray-300'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleUserSelection(match);
                        }}
                      >
                        {isSelected && (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>

                      <div 
                        className="flex-1 cursor-pointer"
                        onClick={() => viewUserDetails(match)}
                      >
                        <div className="flex items-center mb-4">
                          <div className="mr-3">
                            {match.userProfile.image ? (
                              <Image 
                                src={match.userProfile.image} 
                                alt={displayName} 
                                width={60} 
                                height={60} 
                                className="rounded-full border-2 border-white shadow"
                              />
                            ) : (
                              <div className="w-[60px] h-[60px] bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow">
                                <span className="text-white text-xl font-semibold">{displayName[0]}</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold truncate">{displayName}</h3>
                            <div className={`px-3 py-1 rounded-full font-medium text-sm inline-flex items-center
                              ${match.score >= 85 ? 'bg-green-100 text-green-800' : 
                              match.score >= 70 ? 'bg-blue-100 text-blue-800' : 
                              'bg-gray-100 text-gray-800'}`}
                            >
                              <FiStar className="mr-1" /> {Math.round(match.score)}% Match
                            </div>
                          </div>
                          {!isSelected && (
                            <DMButton
                              userId={match.userEmail}
                              userName={displayName}
                              userImage={match.userProfile.image}
                            />
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <div className="text-sm">
                            <div className="text-gray-500 flex items-center">
                              <FiHome className="mr-1" /> Location
                            </div>
                            <div className="font-medium">{Math.round(match.compatibilityDetails.locationScore)}%</div>
                          </div>
                          <div className="text-sm">
                            <div className="text-gray-500 flex items-center">
                              <FiDollarSign className="mr-1" /> Budget
                            </div>
                            <div className="font-medium">{Math.round(match.compatibilityDetails.budgetScore)}%</div>
                          </div>
                          <div className="text-sm">
                            <div className="text-gray-500 flex items-center">
                              <FiCalendar className="mr-1" /> Timing
                            </div>
                            <div className="font-medium">{Math.round(match.compatibilityDetails.timingScore)}%</div>
                          </div>
                          <div className="text-sm">
                            <div className="text-gray-500 flex items-center">
                              <FiList className="mr-1" /> Preferences
                            </div>
                            <div className="font-medium">{Math.round(match.compatibilityDetails.preferencesScore)}%</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {selectedUserDetails && (
        <UserDetailsModal 
          match={selectedUserDetails} 
          onClose={() => setSelectedUserDetails(null)} 
          formatDate={formatDate}
          loadingDetails={loadingUserDetails}
          getFirstName={getFirstName}
        />
      )}
    </main>
  );
}

// Modal for user details
function UserDetailsModal({ 
  match, 
  onClose, 
  formatDate,
  loadingDetails,
  getFirstName
}: { 
  match: UserDetailProfile, 
  onClose: () => void,
  formatDate: (date: string) => string,
  loadingDetails: boolean,
  getFirstName: (user: {name?: string; email: string}, fullProfile?: any) => string
}) {
  // Get display name
  const displayName = getFirstName(match.userProfile, match.fullProfile);
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-10">
      <div className="bg-white p-0 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 p-5 text-white">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold flex items-center">
              {match.userProfile.image ? (
                <Image 
                  src={match.userProfile.image} 
                  alt={displayName} 
                  width={40} 
                  height={40} 
                  className="rounded-full mr-3 border-2 border-white"
                />
              ) : (
                <div className="w-[40px] h-[40px] bg-white rounded-full flex items-center justify-center mr-3">
                  <span className="text-blue-600 text-xl font-semibold">{displayName[0]}</span>
                </div>
              )}
              {displayName}
            </h2>
            <div className="flex items-center gap-2">
              <DMButton
                userId={match.userEmail}
                userName={displayName}
                userImage={match.userProfile.image}
              />
              <button 
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white bg-opacity-25 text-white hover:bg-opacity-40 transition-colors"
                onClick={onClose}
              >
                ×
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto p-6" style={{ maxHeight: 'calc(90vh - 80px)' }}>
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-5 mb-6 rounded-xl border border-blue-100">
            <h3 className="font-semibold text-lg mb-3 text-blue-800">Compatibility Score: {match.score.toFixed(1)}%</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="bg-white p-3 rounded-lg shadow-sm border border-blue-50">
                <div className="font-medium text-gray-500 flex items-center text-sm">
                  <FiHome className="mr-1" /> Location
                </div>
                <div className="text-lg font-semibold text-blue-700">{match.compatibilityDetails.locationScore.toFixed(1)}%</div>
              </div>
              <div className="bg-white p-3 rounded-lg shadow-sm border border-blue-50">
                <div className="font-medium text-gray-500 flex items-center text-sm">
                  <FiDollarSign className="mr-1" /> Budget
                </div>
                <div className="text-lg font-semibold text-blue-700">{match.compatibilityDetails.budgetScore.toFixed(1)}%</div>
              </div>
              <div className="bg-white p-3 rounded-lg shadow-sm border border-blue-50">
                <div className="font-medium text-gray-500 flex items-center text-sm">
                  <FiUsers className="mr-1" /> Gender
                </div>
                <div className="text-lg font-semibold text-blue-700">{match.compatibilityDetails.genderScore.toFixed(1)}%</div>
              </div>
              <div className="bg-white p-3 rounded-lg shadow-sm border border-blue-50">
                <div className="font-medium text-gray-500 flex items-center text-sm">
                  <FiCalendar className="mr-1" /> Timing
                </div>
                <div className="text-lg font-semibold text-blue-700">{match.compatibilityDetails.timingScore.toFixed(1)}%</div>
              </div>
              <div className="bg-white p-3 rounded-lg shadow-sm border border-blue-50">
                <div className="font-medium text-gray-500 flex items-center text-sm">
                  <FiList className="mr-1" /> Preferences
                </div>
                <div className="text-lg font-semibold text-blue-700">{match.compatibilityDetails.preferencesScore.toFixed(1)}%</div>
              </div>
            </div>
          </div>
          
          {loadingDetails ? (
            <div className="py-10 text-center">
              <div className="animate-pulse text-gray-600">Loading user details...</div>
            </div>
          ) : match.fullProfile ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-lg mb-3 flex items-center text-gray-800">
                    <FiUsers className="mr-2" /> Basic Information
                  </h3>
                  <div className="bg-gray-50 p-5 rounded-xl shadow-sm border border-gray-100">
                    <p className="mb-2"><strong>First Name:</strong> {match.fullProfile.firstName || 'Not specified'}</p>
                    <p className="mb-2"><strong>Gender:</strong> {match.fullProfile.gender || 'Not specified'}</p>
                    <p className="mb-2"><strong>Room with Different Gender:</strong> {match.fullProfile.roomWithDifferentGender ? 'Yes' : 'No'}</p>
                    <p><strong>Desired Roommates:</strong> {match.fullProfile.desiredRoommates || 'Not specified'}</p>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-semibold text-lg mb-3 flex items-center text-gray-800">
                    <FiHome className="mr-2" /> Location
                  </h3>
                  <div className="bg-gray-50 p-5 rounded-xl shadow-sm border border-gray-100">
                    <p className="mb-2"><strong>Region:</strong> {match.fullProfile.housingRegion || 'Not specified'}</p>
                    <p><strong>Preferred Cities:</strong> {match.fullProfile.housingCities?.join(', ') || 'Not specified'}</p>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold text-lg mb-3 flex items-center text-gray-800">
                  <FiCalendar className="mr-2" /> Timing & Budget
                </h3>
                <div className="bg-gray-50 p-5 rounded-xl shadow-sm border border-gray-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="mb-2"><strong>Internship Start:</strong> {match.fullProfile.internshipStartDate ? formatDate(match.fullProfile.internshipStartDate) : 'Not specified'}</p>
                      <p><strong>Internship End:</strong> {match.fullProfile.internshipEndDate ? formatDate(match.fullProfile.internshipEndDate) : 'Not specified'}</p>
                    </div>
                    <div>
                      <p><strong>Monthly Budget:</strong> ${match.fullProfile.minBudget?.toLocaleString() || '0'} - ${match.fullProfile.maxBudget?.toLocaleString() || '0'}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {match.fullProfile.preferences && match.fullProfile.preferences.length > 0 && (
                <div>
                  <h3 className="font-semibold text-lg mb-3 flex items-center text-gray-800">
                    <FiList className="mr-2" /> Preferences
                  </h3>
                  <div className="bg-gray-50 p-5 rounded-xl shadow-sm border border-gray-100">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {match.fullProfile.preferences.map((pref, index) => (
                        <div key={index} className="flex justify-between items-center p-2 rounded bg-white border border-gray-100">
                          <span>{pref.item}</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            pref.strength === 'must have' ? 'bg-green-100 text-green-800' :
                            pref.strength === 'prefer' ? 'bg-blue-100 text-blue-800' :
                            pref.strength === 'neutral' ? 'bg-gray-100 text-gray-800' :
                            pref.strength === 'prefer not' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>{pref.strength}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              {match.fullProfile.additionalNotes && (
                <div>
                  <h3 className="font-semibold text-lg mb-3 flex items-center text-gray-800">
                    <FiStar className="mr-2" /> Additional Notes
                  </h3>
                  <div className="bg-gray-50 p-5 rounded-xl shadow-sm border border-gray-100">
                    <div className="max-h-[200px] overflow-y-auto pr-2">
                      <p className="italic whitespace-pre-wrap break-words">{match.fullProfile.additionalNotes}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-yellow-50 p-5 rounded-xl text-center border border-yellow-200">
              <p>Limited information available. Contact this user for more details.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 