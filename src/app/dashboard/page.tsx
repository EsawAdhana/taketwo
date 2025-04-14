'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { SurveyFormData } from '@/constants/survey-constants';
import Image from 'next/image';
import { FiUsers, FiHome, FiDollarSign, FiCalendar, FiList, FiStar, FiFlag, FiX, FiMapPin } from 'react-icons/fi';
import ReportUserModal from '@/components/ReportUserModal';
import UserProfileModal from '@/components/UserProfileModal';

interface CompatibilityMatch {
  userEmail: string;
  userProfile: {
    name?: string;
    email: string;
    image?: string;
  };
  score: number;
  compatibilityDetails: {
    locationScore: number;
    budgetScore: number;
    genderScore: number;
    timingScore: number;
    preferencesScore: number;
  };
  fullProfile?: {
    firstName?: string;
    gender?: string;
    roomWithDifferentGender?: boolean;
    housingRegion?: string;
    housingCities?: string[];
    internshipCompany?: string;
    internshipStartDate?: string;
    internshipEndDate?: string;
    desiredRoommates?: string;
    minBudget?: number;
    maxBudget?: number;
    preferences?: Array<{item: string; strength: string}>;
    additionalNotes?: string;
  };
}

interface UserDetailProfile extends CompatibilityMatch {}

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
  const [showReportModal, setShowReportModal] = useState(false);
  
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
  
  // Helper function to get user display name
  const getName = (userProfile?: {name?: string}, fullProfile?: any): string => {
    // Use firstName from the fullProfile (survey data) if available
    if (fullProfile?.firstName) {
      return fullProfile.firstName;
    }
    // Use name from basic user profile if available (might still be 'User')
    if (userProfile?.name) {
      return userProfile.name;
    }
    // Fallback to 'User'
    return 'User';
  };
  
  const toggleUserSelection = (match: CompatibilityMatch) => {
    if (selectedUsers.some(u => u.userEmail === match.userEmail)) {
      setSelectedUsers(selectedUsers.filter(u => u.userEmail !== match.userEmail));
    } else {
      setSelectedUsers([...selectedUsers, match]);
    }
  };

  const handleCreateGroupChat = async () => {
    if (selectedUsers.length < 1) {
      alert('Please select at least 1 user for a group chat');
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
          name: groupName.trim(),
          participantNames: {
            [session?.user?.email || '']: session?.user?.email || '',
            ...selectedUsers.reduce((acc, user) => ({
              ...acc,
              [user.userEmail]: getName(user.userProfile, user.fullProfile)
            }), {})
          }
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
  
  const handleReportSuccess = () => {
    // Optionally refresh the matches or show a success message
    setShowReportModal(false);
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
    <main className="min-h-screen bg-white dark:bg-gray-900 py-4 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Welcome to Your Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-2">Find your perfect roommate match below.</p>
          </div>
          {selectedUsers.length > 0 && (
            <div className="flex items-center gap-4">
              <input
                type="text"
                placeholder="Enter group name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
              <button
                onClick={handleCreateGroupChat}
                disabled={isCreatingGroup || selectedUsers.length < 1 || !groupName.trim()}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg disabled:opacity-50 flex items-center"
              >
                <FiUsers className="mr-2" />
                {isCreatingGroup ? 'Creating...' : 'Create Group Chat'}
              </button>
              <button
                onClick={() => {
                  setSelectedUsers([]);
                  setGroupName('');
                }}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
        
        {!surveyData?.isSubmitted && (
          <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg p-4 mb-8">
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-500 dark:text-amber-400 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <p className="text-amber-700 dark:text-amber-300">
                <span className="font-medium">Note:</span> You haven't completed your housing preferences survey yet. 
                To see personalized roommate recommendations, please 
                <button 
                  onClick={() => router.push('/survey')} 
                  className="text-blue-600 dark:text-blue-400 underline font-medium ml-1"
                >
                  complete your survey
                </button>.
              </p>
            </div>
          </div>
        )}
        
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden mb-8">
          <div className="bg-blue-500 dark:bg-blue-600 px-6 py-4">
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
                      <div className={`w-10 h-5 ${showTestUsers ? 'bg-blue-400' : 'bg-gray-300 dark:bg-gray-600'} rounded-full shadow-inner`}></div>
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
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Complete your survey to see potential roommate matches.
                </p>
                <button
                  onClick={() => router.push('/survey')}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md"
                >
                  Take Survey
                </button>
              </div>
            ) : recommendationsLoading ? (
              <div className="text-center py-10">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-blue-500 dark:border-blue-400 border-t-transparent mb-4"></div>
                <p className="text-gray-600 dark:text-gray-300">
                  Finding your perfect roommates...
                </p>
              </div>
            ) : recommendations.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  We haven't found any matches for you yet. Check back later or try adjusting your preferences.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {recommendations.map((match) => {
                  const matchQuality = match.score >= 85 ? 'high' : match.score >= 70 ? 'medium' : 'standard';
                  const qualityColors = {
                    high: 'from-green-50 to-green-100 border-green-200 hover:from-green-100 hover:to-green-50 dark:from-green-900/20 dark:to-green-800/20 dark:border-green-700 dark:hover:from-green-800/30 dark:hover:to-green-900/30',
                    medium: 'from-blue-50 to-blue-100 border-blue-200 hover:from-blue-100 hover:to-blue-50 dark:from-blue-900/20 dark:to-blue-800/20 dark:border-blue-700 dark:hover:from-blue-800/30 dark:hover:to-blue-900/30',
                    standard: 'from-gray-50 to-gray-100 border-gray-200 hover:from-gray-100 hover:to-gray-50 dark:from-gray-800/50 dark:to-gray-700/50 dark:border-gray-600 dark:hover:from-gray-700/60 dark:hover:to-gray-800/60'
                  };
                  
                  const displayName = getName(match.userProfile, match.fullProfile);
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
                          isSelected ? 'bg-indigo-500 text-white' : 'bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-500'
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
                                className="rounded-full border-2 border-white dark:border-gray-700 shadow"
                              />
                            ) : (
                              <div className="w-[60px] h-[60px] bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow">
                                <span className="text-white text-xl font-semibold">{displayName[0]}</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold truncate dark:text-gray-100">{displayName}</h3>
                            <div className={`px-3 py-1 rounded-full font-medium text-sm inline-flex items-center
                              ${match.score >= 85 ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : 
                              match.score >= 70 ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' : 
                              'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}
                            >
                              <FiStar className="mr-1" /> {Math.round(match.score)}% Match
                            </div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <div className="text-sm">
                            <div className="text-gray-500 dark:text-gray-400 flex items-center">
                              <FiMapPin className="mr-1" /> Location
                            </div>
                            <div className="font-medium dark:text-gray-300">{Math.round(match.compatibilityDetails.locationScore)}%</div>
                          </div>
                          <div className="text-sm">
                            <div className="text-gray-500 dark:text-gray-400 flex items-center">
                              <FiDollarSign className="mr-1" /> Budget
                            </div>
                            <div className="font-medium dark:text-gray-300">{Math.round(match.compatibilityDetails.budgetScore)}%</div>
                          </div>
                          <div className="text-sm">
                            <div className="text-gray-500 dark:text-gray-400 flex items-center">
                              <FiCalendar className="mr-1" /> Timing
                            </div>
                            <div className="font-medium dark:text-gray-300">{Math.round(match.compatibilityDetails.timingScore)}%</div>
                          </div>
                          <div className="text-sm">
                            <div className="text-gray-500 dark:text-gray-400 flex items-center">
                              <FiList className="mr-1" /> Preferences
                            </div>
                            <div className="font-medium dark:text-gray-300">{Math.round(match.compatibilityDetails.preferencesScore)}%</div>
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
      
      {/* User Profile Modal */}
      {selectedUserDetails && (
        <UserProfileModal
          userData={{ fullProfile: selectedUserDetails.fullProfile }}
          userProfile={selectedUserDetails.userProfile}
          onClose={() => setSelectedUserDetails(null)}
          loading={loadingUserDetails}
          onReport={() => setShowReportModal(true)}
          displayName={`${getName(selectedUserDetails.userProfile, selectedUserDetails.fullProfile)}'s Profile`}
        />
      )}

      {/* Report Modal */}
      {showReportModal && selectedUserDetails && (
        <ReportUserModal
          userEmail={selectedUserDetails.userEmail}
          userName={getName(selectedUserDetails.userProfile, selectedUserDetails.fullProfile)}
          onClose={() => setShowReportModal(false)}
          onSuccess={handleReportSuccess}
        />
      )}
    </main>
  );
} 