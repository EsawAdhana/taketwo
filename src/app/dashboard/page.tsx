'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { SurveyFormData } from '@/constants/survey-constants';
import Image from 'next/image';

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

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [surveyData, setSurveyData] = useState<SurveyFormData | null>(null);
  const [recommendations, setRecommendations] = useState<CompatibilityMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  
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
        
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Your Matches</h2>
            <button 
              onClick={() => router.push('/survey?edit=true')}
              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 transition-colors"
            >
              Edit Preferences
            </button>
          </div>
          
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
            <div className="space-y-6">
              {recommendations.map((match) => (
                <div key={match.userEmail} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center">
                    <div className="mr-4">
                      {match.userProfile.image ? (
                        <Image 
                          src={match.userProfile.image} 
                          alt={match.userProfile.name || 'User'} 
                          width={60} 
                          height={60} 
                          className="rounded-full"
                        />
                      ) : (
                        <div className="w-[60px] h-[60px] bg-gray-200 rounded-full flex items-center justify-center">
                          <span className="text-gray-500 text-xl">{match.userProfile.name?.[0] || match.userProfile.email[0]}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-semibold">{match.userProfile.name || 'Anonymous User'}</h3>
                        <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-medium">
                          {Math.round(match.score)}% Match
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-3">
                        <div className="text-sm">
                          <div className="text-gray-500">Location</div>
                          <div className="font-medium">{Math.round(match.compatibilityDetails.locationScore)}%</div>
                        </div>
                        <div className="text-sm">
                          <div className="text-gray-500">Budget</div>
                          <div className="font-medium">{Math.round(match.compatibilityDetails.budgetScore)}%</div>
                        </div>
                        <div className="text-sm">
                          <div className="text-gray-500">Timing</div>
                          <div className="font-medium">{Math.round(match.compatibilityDetails.timingScore)}%</div>
                        </div>
                        <div className="text-sm">
                          <div className="text-gray-500">Roommates</div>
                          <div className="font-medium">{Math.round(match.compatibilityDetails.roommateScore)}%</div>
                        </div>
                        <div className="text-sm">
                          <div className="text-gray-500">Preferences</div>
                          <div className="font-medium">{Math.round(match.compatibilityDetails.preferencesScore)}%</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Housing Search Tips</h2>
          <ul className="list-disc pl-5 space-y-2 text-gray-600">
            <li>Start your search early, especially in competitive housing markets.</li>
            <li>Consider looking for housing with compatible roommates to reduce costs.</li>
            <li>Be prepared with all necessary documents when applying for housing.</li>
            <li>Research the neighborhoods thoroughly, including transportation options.</li>
          </ul>
        </div>
      </div>
    </main>
  );
} 