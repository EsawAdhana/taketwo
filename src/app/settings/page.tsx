'use client';

import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { SurveyFormData } from '@/constants/survey-constants';
import { FiHome, FiUser, FiCalendar, FiUsers, FiList, FiStar } from 'react-icons/fi';
import Image from 'next/image';

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [surveyData, setSurveyData] = useState<SurveyFormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchSurveyData = async () => {
      try {
        const response = await fetch('/api/survey');
        const result = await response.json();
        
        if (result.data) {
          setSurveyData(result.data);
        }
      } catch (error) {
        console.error('Error fetching survey data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    if (session?.user) {
      fetchSurveyData();
    }
  }, [session]);

  const handleDeleteAccount = async () => {
    if (window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      setIsDeleting(true);
      try {
        const response = await fetch('/api/user', {
          method: 'DELETE',
        });
        
        const data = await response.json();
        
        if (response.ok) {
          await signOut({ callbackUrl: '/' });
        } else if (response.status === 404) {
          alert('Account data not found. You will be signed out.');
          await signOut({ callbackUrl: '/' });
        } else {
          throw new Error(data.error || 'Failed to delete account');
        }
      } catch (error) {
        console.error('Error deleting account:', error);
        alert(error instanceof Error ? error.message : 'Failed to delete account. Please try again.');
      } finally {
        setIsDeleting(false);
      }
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
    <main className="min-h-screen bg-gray-50 py-4 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="bg-indigo-50 px-5 py-3 rounded-t-lg">
            <h2 className="text-lg font-semibold text-indigo-900">Your Housing Preferences</h2>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Column - Basic Info, Location, Housing Details */}
              <div className="space-y-6">
                {/* Basic Information */}
                <div>
                  <div className="flex items-center mb-3">
                    <span className="text-indigo-600 mr-2">
                      <FiUsers className="inline" />
                    </span>
                    <h3 className="text-gray-900 font-medium">Basic Information</h3>
                  </div>
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="grid grid-cols-[1fr_auto] gap-y-2 p-4">
                      <div className="text-gray-600">First Name:</div>
                      <div className="text-right">{surveyData?.firstName || 'Not specified'}</div>
                      
                      <div className="text-gray-600">Gender:</div>
                      <div className="text-right">{surveyData?.gender || 'Male'}</div>
                      
                      <div className="text-gray-600">Room with Different Gender:</div>
                      <div className="text-right">{surveyData?.roomWithDifferentGender ? 'Yes' : 'No'}</div>
                      
                      <div className="text-gray-600">Internship Company:</div>
                      <div className="text-right">{surveyData?.internshipCompany || 'Not specified'}</div>
                      
                      <div className="text-gray-600">Desired Roommates:</div>
                      <div className="text-right">{surveyData?.desiredRoommates || 2}</div>
                    </div>
                  </div>
                </div>
                
                {/* Location */}
                <div>
                  <div className="flex items-center mb-3">
                    <span className="text-indigo-600 mr-2">
                      <FiHome className="inline" />
                    </span>
                    <h3 className="text-gray-900 font-medium">Location</h3>
                  </div>
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="grid grid-cols-[1fr_auto] gap-y-2 p-4">
                      <div className="text-gray-600">Region:</div>
                      <div className="text-right">{surveyData?.housingRegion || 'Bay Area'}</div>
                      
                      <div className="text-gray-600">Preferred Cities:</div>
                      <div className="text-right">{surveyData?.housingCities?.join(', ') || 'San Francisco'}</div>
                    </div>
                  </div>
                </div>
                
                {/* Housing Details */}
                <div>
                  <div className="flex items-center mb-3">
                    <span className="text-indigo-600 mr-2">
                      <FiCalendar className="inline" />
                    </span>
                    <h3 className="text-gray-900 font-medium">Housing Details</h3>
                  </div>
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="grid grid-cols-[1fr_auto] gap-y-2 p-4">
                      <div className="text-gray-600">Housing Start:</div>
                      <div className="text-right">{surveyData && new Date(surveyData.internshipStartDate).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'}) || 'Jun 14, 2025'}</div>
                      
                      <div className="text-gray-600">Housing End:</div>
                      <div className="text-right">{surveyData && new Date(surveyData.internshipEndDate).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'}) || 'Sep 14, 2025'}</div>
                      
                      <div className="text-gray-600">Monthly Budget:</div>
                      <div className="text-right">${surveyData?.minBudget || '1,500'} - ${surveyData?.maxBudget || '2,500'}</div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Right Column - Preferences and Additional Notes */}
              <div className="space-y-6">
                {/* Preferences */}
                <div>
                  <div className="flex items-center mb-3">
                    <span className="text-indigo-600 mr-2">
                      <FiList className="inline" />
                    </span>
                    <h3 className="text-gray-900 font-medium">Preferences</h3>
                  </div>
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="space-y-2">
                      {surveyData?.preferences.map(pref => {
                        let badge = "";
                        
                        switch(pref.strength) {
                          case "neutral":
                            badge = "neutral";
                            break;
                          case "prefer not":
                            badge = "prefer not";
                            break;
                          case "must have":
                            badge = "must have";
                            break;
                          default:
                            badge = pref.strength;
                        }
                        
                        return (
                          <div key={pref.item} className="flex justify-between items-center py-1">
                            <span>{pref.item}</span>
                            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{badge}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                
                {/* Additional Notes */}
                <div>
                  <div className="flex items-center mb-3">
                    <span className="text-indigo-600 mr-2">
                      <FiStar className="inline" />
                    </span>
                    <h3 className="text-gray-900 font-medium">Additional Notes</h3>
                  </div>
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="max-h-[200px] overflow-y-auto">
                      <p className="text-gray-700 whitespace-pre-wrap break-words">
                        {surveyData?.additionalNotes ? 
                          surveyData.additionalNotes : 
                          'No additional notes provided'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Account Settings</h2>
          
          <div className="mb-6">
            <div className="flex items-center space-x-4 mb-4">
              {session.user?.image ? (
                <div className="relative w-14 h-14 rounded-full overflow-hidden">
                  <Image 
                    src={session.user.image}
                    alt={session.user?.name || 'Profile'} 
                    fill
                    className="object-cover"
                    onError={(e) => {
                      // If image fails to load, replace with fallback
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                </div>
              ) : (
                <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center">
                  <FiUser className="text-blue-600 text-xl" />
                </div>
              )}
              <div>
                <h3 className="font-medium text-gray-800">{session.user?.name || 'User'}</h3>
                <p className="text-gray-600 text-sm">{session.user?.email}</p>
              </div>
            </div>
            
            <div className="border-t border-gray-100 pt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Account Management</h4>
              <p className="text-sm text-gray-600 mb-4">
                Deleting your account will permanently remove all your data, including your profile, preferences, and messages.
              </p>
              
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="w-full px-4 py-2 bg-white border border-red-500 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <span className="animate-spin h-4 w-4 border-2 border-red-500 border-t-transparent rounded-full"></span>
                    Deleting Account...
                  </>
                ) : (
                  'Delete Account'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
} 