'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { SurveyFormData } from '@/constants/survey-constants';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [surveyData, setSurveyData] = useState<SurveyFormData | null>(null);
  const [loading, setLoading] = useState(true);
  
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
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Welcome to Your Dashboard
        </h1>
        
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Your Housing Preferences</h2>
          
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="font-medium text-gray-700 mb-2">Location</h3>
              <p className="text-gray-600">
                Region: {surveyData.housingRegion}<br />
                Cities: {surveyData.housingCities.join(', ')}
              </p>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-700 mb-2">Timing</h3>
              <p className="text-gray-600">
                Start: {new Date(surveyData.internshipStartDate).toLocaleDateString()}<br />
                End: {new Date(surveyData.internshipEndDate).toLocaleDateString()}
              </p>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-700 mb-2">Roommate Preferences</h3>
              <p className="text-gray-600">
                Looking for: {surveyData.desiredRoommates} roommate(s)<br />
                Budget: ${surveyData.monthlyBudget} per month
              </p>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-700 mb-2">Non-negotiables</h3>
              <ul className="list-disc list-inside text-gray-600">
                {surveyData.nonNegotiables.map(item => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
          
          {surveyData.additionalNotes && (
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
      </div>
    </main>
  );
} 