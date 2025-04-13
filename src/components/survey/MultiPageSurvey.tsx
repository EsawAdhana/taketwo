'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { HOUSING_REGIONS, NON_NEGOTIABLES, SurveyFormData, INITIAL_FORM_DATA, Preference } from '@/constants/survey-constants';
import { useRouter } from 'next/navigation';

// Page components
import BasicInfoPage from './pages/BasicInfoPage';
import LocationPage from './pages/LocationPage';
import TimingBudgetPage from './pages/TimingBudgetPage';
import PreferencesPage from './pages/PreferencesPage';

interface MultiPageSurveyProps {
  onSubmitSuccess?: () => void;
  isEditing?: boolean;
}

export default function MultiPageSurvey({ onSubmitSuccess, isEditing = false }: MultiPageSurveyProps) {
  const { data: session } = useSession();
  const router = useRouter();
  
  const [formData, setFormData] = useState<SurveyFormData>(INITIAL_FORM_DATA);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [originalData, setOriginalData] = useState<SurveyFormData | null>(null);
  
  // Fetch existing survey data
  useEffect(() => {
    const fetchSurvey = async () => {
      if (!session) return;
      
      try {
        const response = await fetch('/api/survey');
        const result = await response.json();
        
        if (response.ok && result.data) {
          // Create a map of existing preferences for easy lookup
          const existingPreferences = new Map(
            result.data.preferences?.map((p: Preference) => [p.item, p]) || []
          );
          
          // Merge with initial preferences, keeping existing ones and using neutral for missing ones
          const mergedPreferences = INITIAL_FORM_DATA.preferences.map(initialPref => 
            existingPreferences.get(initialPref.item) || initialPref
          );
          
          const surveyData = {
            ...INITIAL_FORM_DATA,
            ...result.data,
            preferences: mergedPreferences,
            // Keep the saved page unless the survey was submitted
            currentPage: result.data.isSubmitted ? 1 : (result.data.currentPage || 1),
            // Preserve isSubmitted status even during editing
            isSubmitted: isEditing ? result.data.isSubmitted : (result.data.isSubmitted || false)
          };
          
          setFormData(surveyData);
          setOriginalData(surveyData);
        }
      } catch (error) {
        console.error('Error fetching survey data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSurvey();
  }, [session, isEditing]);
  
  // Save form data
  const saveSurvey = async (finalSubmit = false) => {
    setSaving(true);
    
    try {
      // Always preserve the isSubmitted status if it was previously true
      const isAlreadySubmitted = formData.isSubmitted || (originalData?.isSubmitted ?? false);
      const willBeSubmitted = finalSubmit || isAlreadySubmitted;
      
      // Update local state first for immediate feedback
      if (finalSubmit && !formData.isSubmitted) {
        setFormData(prev => ({ ...prev, isSubmitted: true }));
      }
      
      // Send the full formData including currentPage
      const response = await fetch('/api/survey', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          isDraft: !willBeSubmitted,
          isSubmitted: willBeSubmitted
        }),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        // Double-check that isSubmitted is set properly
        if (finalSubmit) {
          // Make another request to check the status
          try {
            const checkResponse = await fetch('/api/survey');
            const checkResult = await checkResponse.json();
            
            if (checkResult.data && !checkResult.data.isSubmitted) {
              // If somehow isSubmitted is still false, try to save again
              await fetch('/api/survey', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  ...formData,
                  isDraft: false,
                  isSubmitted: true
                }),
              });
            }
          } catch (error) {
            console.error('Error checking submission status:', error);
          }
        }
        return true;
      } else {
        console.error('Error:', result.error);
        return false;
      }
    } catch (error) {
      console.error('Error saving survey:', error);
      return false;
    } finally {
      setSaving(false);
    }
  };
  
  // Handle page navigation
  const canProceed = () => {
    switch (formData.currentPage) {
      case 1:
        return !!formData.gender;
      case 2:
        return !!formData.housingRegion && formData.housingCities.length > 0;
      case 3:
        return !!formData.internshipStartDate && 
               !!formData.internshipEndDate && 
               !!formData.desiredRoommates && 
               formData.minBudget >= 500 &&
               formData.maxBudget >= formData.minBudget;
      case 4:
        return true;
      default:
        return false;
    }
  };
  
  const handleNext = async () => {
    if (!canProceed()) return;
    
    setFormData(prev => ({ 
      ...prev, 
      currentPage: Math.min(prev.currentPage + 1, 4)
    }));
  };
  
  const handleBack = () => {
    setFormData(prev => ({ 
      ...prev, 
      currentPage: Math.max(prev.currentPage - 1, 1)
    }));
  };
  
  const handleSubmit = async () => {
    const success = await saveSurvey(true);
    if (success) {
      setShowCompletionModal(true);
    }
  };
  
  const handleGoToDashboard = () => {
    setShowCompletionModal(false);
    if (onSubmitSuccess) {
      onSubmitSuccess();
    } else {
      // Fallback if onSubmitSuccess is not provided
      router.push('/dashboard');
    }
    
    // Force navigation after a short delay as a backup
    setTimeout(() => {
      window.location.href = '/dashboard';
    }, 300);
  };
  
  if (loading) {
    return <div className="py-4 text-center text-gray-800">Loading survey...</div>;
  }
  
  return (
    <div className="max-w-3xl mx-auto">
      {/* Completion Modal */}
      {showCompletionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4 text-center">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Survey Completed!
            </h3>
            <p className="text-gray-600 mb-6">
              Thank you for completing the survey. You can always update your preferences later by accessing the "Survey" tab.
            </p>
            <button
              onClick={handleGoToDashboard}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      )}
      
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between mb-2">
          {['Basic Info', 'Location', 'Housing Details', 'Preferences'].map((step, index) => (
            <div
              key={step}
              className={`flex-1 text-center ${
                index + 1 === formData.currentPage
                  ? 'text-blue-600 font-semibold'
                  : index + 1 < formData.currentPage
                  ? 'text-green-600'
                  : 'text-gray-400'
              }`}
            >
              {step}
            </div>
          ))}
        </div>
        <div className="h-2 flex rounded-full bg-gray-200">
          {[1, 2, 3, 4].map((step) => (
            <div
              key={step}
              className={`flex-1 ${
                step <= formData.currentPage
                  ? 'bg-blue-600'
                  : ''
              } ${step === 1 ? 'rounded-l-full' : ''} ${
                step === 4 ? 'rounded-r-full' : ''
              }`}
            />
          ))}
        </div>
      </div>
      
      {/* Form Pages */}
      <div className="bg-white rounded-lg p-6 shadow-lg">
        <form onSubmit={(e) => e.preventDefault()}>
          {formData.currentPage === 1 && (
            <BasicInfoPage
              formData={formData}
              setFormData={setFormData}
            />
          )}
          
          {formData.currentPage === 2 && (
            <LocationPage
              formData={formData}
              setFormData={setFormData}
            />
          )}
          
          {formData.currentPage === 3 && (
            <TimingBudgetPage
              formData={formData}
              setFormData={setFormData}
            />
          )}
          
          {formData.currentPage === 4 && (
            <PreferencesPage
              formData={formData}
              setFormData={setFormData}
            />
          )}
          
          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8">
            <button
              type="button"
              onClick={handleBack}
              disabled={formData.currentPage === 1 || saving}
              className="px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
            >
              Back
            </button>
            
            <div className="flex gap-4">
              {isEditing && (
                <button
                  type="button"
                  onClick={() => router.push('/dashboard')}
                  className="px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
              )}
              
              {formData.currentPage < 4 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!canProceed() || saving}
                  className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Next'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={saving}
                  className="px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Submit Survey'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
} 