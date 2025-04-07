'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { SurveyFormData } from '@/constants/survey-constants';
import Image from 'next/image';
import { FiUsers, FiHome, FiDollarSign, FiCalendar, FiList, FiStar } from 'react-icons/fi';

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
        const response = await fetch('/api/recommendations');
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
  }, [session]);
  
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
  const getFirstName = (user: {name?: string; email: string}): string => {
    if (user.name) {
      return user.name.split(' ')[0];
    }
    // Extract name from email if no display name
    const emailName = user.email.split('@')[0];
    // Capitalize first letter and handle usernames with numbers or special chars
    const namePart = emailName.split(/[^a-zA-Z]/, 1)[0];
    return namePart.charAt(0).toUpperCase() + namePart.slice(1);
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
  
  if (!surveyData?.isSubmitted) {
    router.push('/survey');
    return null;
  }
  
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">
          Welcome to Your Dashboard
        </h1>
        <p className="text-gray-600 mb-8">Find your perfect roommate match below.</p>
        
        <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-white flex items-center">
                <FiUsers className="mr-2" /> Compatible Roommates
              </h2>
              <button 
                onClick={() => router.push('/survey?edit=true')}
                className="bg-white text-blue-600 px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-50 transition-colors"
              >
                Edit Preferences
              </button>
            </div>
          </div>
          
          <div className="p-6">
            <p className="text-gray-600 mb-6">
              Below are potential roommates that match your preferences. Click on a card to view more details.
            </p>
            
            {recommendationsLoading ? (
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
                  // Calculate match quality for color coding
                  const matchQuality = match.score >= 85 ? 'high' : match.score >= 70 ? 'medium' : 'standard';
                  const qualityColors = {
                    high: 'from-green-50 to-green-100 border-green-200 hover:from-green-100 hover:to-green-50',
                    medium: 'from-blue-50 to-blue-100 border-blue-200 hover:from-blue-100 hover:to-blue-50',
                    standard: 'from-gray-50 to-gray-100 border-gray-200 hover:from-gray-100 hover:to-gray-50'
                  };
                  
                  // Get display name (first name only)
                  const displayName = getFirstName(match.userProfile);
                  
                  return (
                    <div 
                      key={match.userEmail} 
                      className={`border rounded-xl p-5 bg-gradient-to-br ${qualityColors[matchQuality]} transition-all duration-200 flex flex-col h-full cursor-pointer shadow hover:shadow-md`}
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
  getFirstName: (user: {name?: string; email: string}) => string
}) {
  // Get display name
  const displayName = getFirstName(match.userProfile);
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-10">
      <div className="bg-white p-0 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
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
            <button 
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white bg-opacity-25 text-white hover:bg-opacity-40 transition-colors"
              onClick={onClose}
            >
              ×
            </button>
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
                    <p className="italic">{match.fullProfile.additionalNotes}</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-yellow-50 p-5 rounded-xl text-center border border-yellow-200">
              <p>Limited information available. Contact this user for more details.</p>
            </div>
          )}
          
          <div className="mt-6 pt-4 border-t text-right">
            <button
              className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full hover:from-blue-700 hover:to-indigo-700 font-medium shadow-sm"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 