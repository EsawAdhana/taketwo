'use client';

import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { SurveyFormData } from '@/constants/survey-constants';
import { FiHome } from 'react-icons/fi';

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
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Your Housing Preferences</h2>
          
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="font-medium text-gray-700 mb-2">Location</h3>
              <p className="text-gray-600">
                Region: {surveyData?.housingRegion}<br />
                Cities: {surveyData?.housingCities.join(', ')}
              </p>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-700 mb-2">Timing</h3>
              <p className="text-gray-600">
                Start: {surveyData && new Date(surveyData.internshipStartDate).toLocaleDateString()}<br />
                End: {surveyData && new Date(surveyData.internshipEndDate).toLocaleDateString()}
              </p>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-700 mb-2">Roommate Preferences</h3>
              <p className="text-gray-600">
                Looking for: {surveyData?.desiredRoommates} roommate(s)<br />
                Budget: ${surveyData?.minBudget} - ${surveyData?.maxBudget} per month
              </p>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-700 mb-2">Preferences & Non-negotiables</h3>
              <ul className="list-disc list-inside text-gray-600">
                {surveyData?.preferences.map(pref => {
                  let strengthIndicator = "";
                  
                  switch(pref.strength) {
                    case "must have": 
                      strengthIndicator = "(+++)";
                      break;
                    case "prefer":
                      strengthIndicator = "(++)";
                      break;
                    case "neutral":
                      strengthIndicator = "(+/-)";
                      break;
                    case "prefer not":
                      strengthIndicator = "(--)";
                      break;
                    case "deal breaker":
                      strengthIndicator = "(---)";
                      break;
                  }
                  
                  return (
                    <li key={pref.item} className={pref.strength === "deal breaker" || pref.strength === "must have" ? "font-medium" : ""}>
                      {pref.item} <span className={
                        pref.strength === "neutral" 
                          ? "text-gray-500"
                          : pref.strength.includes("not") || pref.strength === "deal breaker" 
                            ? "text-red-500" 
                            : "text-green-500"
                      }>
                        {strengthIndicator}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
          
          {surveyData?.additionalNotes && (
            <div className="mt-6">
              <h3 className="font-medium text-gray-700 mb-2">Additional Notes</h3>
              <p className="text-gray-600">{surveyData.additionalNotes}</p>
            </div>
          )}
          
          <div className="mt-8 flex justify-end">
            <button
              onClick={() => router.push('/survey?edit=true')}
              className="px-4 py-2 text-blue-600 hover:text-blue-700 font-medium"
            >
              Edit Preferences
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Account Settings</h2>
          
          <div className="space-y-4">
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg transition-colors"
            >
              Sign Out
            </button>
            
            <button
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              className="w-full px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {isDeleting ? 'Deleting Account...' : 'Delete Account'}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
} 