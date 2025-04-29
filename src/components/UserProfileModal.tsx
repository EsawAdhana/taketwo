import { useState } from 'react';
import { FiFlag, FiX, FiUsers, FiMapPin, FiCalendar, FiList, FiStar } from 'react-icons/fi';
import Image from 'next/image';

// Function to format date for display
const formatDate = (dateString: string) => {
  try {
    const date = new Date(dateString);
    
    // Create a new date using UTC components to prevent timezone offset issues
    const utcDate = new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate()
      )
    );
    
    return utcDate.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      timeZone: 'UTC' // Force UTC timezone for display
    });
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
  // Use name from basic user profile if available
  if (userProfile?.name) {
    return userProfile.name;
  }
  // Fallback to 'User'
  return 'Other';
};

interface UserProfileProps {
  userData: any | null;
  userProfile?: {name?: string, email?: string, image?: string} | null;
  onClose: () => void;
  loading: boolean;
  onReport?: () => void;
  displayName?: string;
}

export default function UserProfileModal({ 
  userData,
  userProfile,
  onClose,
  loading,
  onReport,
  displayName = "Other's Profile"
}: UserProfileProps) {
  const [isReporting, setIsReporting] = useState(false);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full mx-auto shadow-xl">
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-300">Loading user details...</p>
          </div>
        </div>
      </div>
    );
  }
  
  const fullProfile = userData?.surveyData || userData?.fullProfile;
  const userName = getName(userProfile || undefined, fullProfile);
  const userDisplayName = `${userName}'s Profile`;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full mx-auto shadow-xl">
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            {userProfile?.image && (
              <div className="relative w-8 h-8">
                <Image
                  src={userProfile.image || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23cccccc"%3E%3Cpath d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/%3E%3C/svg%3E'}
                  alt={userDisplayName}
                  fill
                  sizes="(max-width: 768px) 32px, 32px"
                  className="rounded-full object-cover"
                />
                {fullProfile?.notifications > 0 && (
                  <div className="absolute -bottom-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-5 h-5 flex items-center justify-center px-1">
                    {fullProfile.notifications > 99 ? '99+' : fullProfile.notifications}
                  </div>
                )}
              </div>
            )}
            <span>{userDisplayName}</span>
          </h2>
          <div className="flex items-center gap-4">
            {onReport && (
              <button
                onClick={() => onReport()}
                className="text-red-500 hover:text-red-600 dark:hover:text-red-400 flex items-center"
                aria-label="Report user"
              >
                <FiFlag className="mr-1" />
                <span className="text-sm">Report</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-100"
              aria-label="Close modal"
            >
              <FiX size={24} />
            </button>
          </div>
        </div>
        
        <div className="p-6">
          {fullProfile ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left column: Basic Information, Location, Housing Details */}
              <div className="space-y-6">
                {/* Basic Information */}
                <div>
                  <div className="flex items-center mb-3">
                    <span className="text-indigo-600 dark:text-indigo-400 mr-2">
                      <FiUsers className="inline" />
                    </span>
                    <h3 className="text-gray-900 dark:text-gray-100 font-medium">Basic Information</h3>
                  </div>
                  <div className="bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
                    <div className="grid grid-cols-[1fr_auto] gap-y-2 p-4">
                      <div className="text-gray-600 dark:text-gray-300">First Name:</div>
                      <div className="text-right dark:text-gray-200">{fullProfile.firstName || 'Not specified'}</div>
                      
                      <div className="text-gray-600 dark:text-gray-300">Gender:</div>
                      <div className="text-right dark:text-gray-200">{fullProfile.gender || 'Not specified'}</div>
                      
                      <div className="text-gray-600 dark:text-gray-300">Room with Different Gender:</div>
                      <div className="text-right dark:text-gray-200">{fullProfile.roomWithDifferentGender ? 'Yes' : 'No'}</div>
                      
                      <div className="text-gray-600 dark:text-gray-300">Internship Company:</div>
                      <div className="text-right dark:text-gray-200">{fullProfile.internshipCompany || 'Not specified'}</div>
                      
                      <div className="text-gray-600 dark:text-gray-300">Desired Roommates:</div>
                      <div className="text-right dark:text-gray-200">{fullProfile.desiredRoommates || 'Not specified'}</div>
                    </div>
                  </div>
                </div>
                
                {/* Location */}
                <div>
                  <div className="flex items-center mb-3">
                    <span className="text-indigo-600 dark:text-indigo-400 mr-2">
                      <FiMapPin className="inline" />
                    </span>
                    <h3 className="text-gray-900 dark:text-gray-100 font-medium">Location</h3>
                  </div>
                  <div className="bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
                    <div className="grid grid-cols-[1fr_auto] gap-y-2 p-4">
                      <div className="text-gray-600 dark:text-gray-300">Region:</div>
                      <div className="text-right dark:text-gray-200">{fullProfile.housingRegion || 'Not specified'}</div>
                      
                      <div className="text-gray-600 dark:text-gray-300">Preferred Cities:</div>
                      <div className="text-right dark:text-gray-200">{fullProfile.housingCities?.join(', ') || 'Not specified'}</div>
                    </div>
                  </div>
                </div>
                
                {/* Housing Details */}
                <div>
                  <div className="flex items-center mb-3">
                    <span className="text-indigo-600 dark:text-indigo-400 mr-2">
                      <FiCalendar className="inline" />
                    </span>
                    <h3 className="text-gray-900 dark:text-gray-100 font-medium">Housing Details</h3>
                  </div>
                  <div className="bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
                    <div className="grid grid-cols-[1fr_auto] gap-y-2 p-4">
                      <div className="text-gray-600 dark:text-gray-300">Housing Start:</div>
                      <div className="text-right dark:text-gray-200">{fullProfile.internshipStartDate ? formatDate(fullProfile.internshipStartDate) : 'Not specified'}</div>
                      
                      <div className="text-gray-600 dark:text-gray-300">Housing End:</div>
                      <div className="text-right dark:text-gray-200">{fullProfile.internshipEndDate ? formatDate(fullProfile.internshipEndDate) : 'Not specified'}</div>
                      
                      <div className="text-gray-600 dark:text-gray-300">Monthly Budget:</div>
                      <div className="text-right dark:text-gray-200">${fullProfile.minBudget?.toLocaleString() || '0'} - ${fullProfile.maxBudget?.toLocaleString() || '0'}</div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Right column: Preferences and Additional Notes */}
              <div className="space-y-6">
                {/* Preferences - Always display this section */}
                <div>
                  <div className="flex items-center mb-3">
                    <span className="text-indigo-600 dark:text-indigo-400 mr-2">
                      <FiList className="inline" />
                    </span>
                    <h3 className="text-gray-900 dark:text-gray-100 font-medium">Preferences</h3>
                  </div>
                  <div className="bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-4">
                    {fullProfile.preferences && fullProfile.preferences.length > 0 ? (
                      <div className="space-y-2">
                        {fullProfile.preferences.map((pref: {item: string, strength: string}, index: number) => (
                          <div key={index} className="flex justify-between items-center py-1">
                            <span className="dark:text-gray-200">{pref.item}</span>
                            <span className="text-xs bg-gray-100 dark:bg-gray-600 dark:text-gray-200 px-2 py-0.5 rounded">{pref.strength}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400">No preferences specified</p>
                    )}
                  </div>
                </div>
                
                {/* Additional Notes - Always display this section */}
                <div>
                  <div className="flex items-center mb-3">
                    <span className="text-indigo-600 dark:text-indigo-400 mr-2">
                      <FiStar className="inline" />
                    </span>
                    <h3 className="text-gray-900 dark:text-gray-100 font-medium">Additional Notes</h3>
                  </div>
                  <div className="bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-4">
                    <div className="max-h-[200px] overflow-y-auto">
                      {fullProfile.additionalNotes ? (
                        <p className="text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words">{fullProfile.additionalNotes}</p>
                      ) : (
                        <p className="text-gray-500 dark:text-gray-400">Not specified</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center p-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <p className="text-yellow-800 dark:text-yellow-200">User information is unavailable</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 