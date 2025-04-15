'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import { useSurveyNavigation } from '@/contexts/SurveyNavigationContext';
import { useSurveyForm } from '@/hooks/useSurveyForm';
import { SurveyFormData } from '@/constants/survey-constants';

// Page components
import BasicInfoPage from './pages/BasicInfoPage';
import LocationPage from './pages/LocationPage';
import TimingBudgetPage from './pages/TimingBudgetPage';
import PreferencesPage from './pages/PreferencesPage';

interface MultiPageSurveyProps {
  onSubmitSuccess?: (formData: SurveyFormData) => void;
  isEditing?: boolean;
  isTestMode?: boolean;
}

export default function MultiPageSurvey({ onSubmitSuccess, isEditing = false, isTestMode = false }: MultiPageSurveyProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { setShowWarningOnNavigation, setHasUnsavedChanges } = useSurveyNavigation();
  
  const {
    formData,
    setFormData,
    loading,
    saving,
    setSaving,
    hasDateError,
    setHasDateError,
    showCompletionModal, 
    setShowCompletionModal,
    saveSurvey
  } = useSurveyForm({ isEditing, isTestMode });
  
  // Enable navigation warnings if editing or if there are unsaved changes
  useEffect(() => {
    if (isEditing) {
      setShowWarningOnNavigation(true);
    }
    
    return () => {
      setShowWarningOnNavigation(false);
      setHasUnsavedChanges(false);
    };
  }, [isEditing, setShowWarningOnNavigation, setHasUnsavedChanges]);
  
  const canProceed = () => {
    // Validation logic for each page
    switch (formData.currentPage) {
      case 1: // Basic info page
        return formData.firstName.trim() !== '' && formData.gender !== '';
      case 2: // Location page
        return formData.housingRegion !== '' && formData.housingCities.length > 0;
      case 3: // Timing & Budget page
        // Check both dates are filled
        const hasValidDates = formData.internshipStartDate && formData.internshipEndDate && !hasDateError;
        return hasValidDates && Number(formData.minBudget) > 0 && Number(formData.maxBudget) >= Number(formData.minBudget);
      default:
        return true;
    }
  };
  
  const handleNext = async () => {
    // Save progress before moving to next page
    await saveSurvey(false);
    // Move to next page
    setFormData((prev: SurveyFormData) => ({ ...prev, currentPage: prev.currentPage + 1 }));
  };
  
  const handleBack = () => {
    // Move to previous page
    setFormData((prev: SurveyFormData) => ({ ...prev, currentPage: prev.currentPage - 1 }));
  };
  
  const handleSubmit = async () => {
    try {
      await saveSurvey(true);
      
      // Show completion modal
      setShowCompletionModal(true);
      
      // Notify parent component if needed
      if (onSubmitSuccess) {
        onSubmitSuccess(formData);
      }
    } catch (error) {
      console.error('Error submitting survey:', error);
    }
  };
  
  const handleGoToDashboard = () => {
    router.push('/dashboard');
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  return (
    <div className="max-w-3xl mx-auto">
      {/* Progress indicator */}
      <div className="mb-8">
        <div className="flex justify-between items-center">
          {Array.from({ length: 4 }, (_, i) => (
            <div 
              key={i} 
              className={`flex items-center ${i < 3 ? 'flex-1' : ''}`}
            >
              <div className={`flex items-center justify-center h-8 w-8 rounded-full 
                ${i + 1 < formData.currentPage ? 'bg-blue-500 text-white' : 
                  i + 1 === formData.currentPage ? 'bg-blue-500 text-white' : 
                  'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-300'}`}
              >
                {i + 1 < formData.currentPage ? '✓' : i + 1}
              </div>
              
              {i < 3 && (
                <div className={`flex-1 h-1 mx-2 
                  ${i + 1 < formData.currentPage ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'}`}
                ></div>
              )}
            </div>
          ))}
        </div>
        
        <div className="flex justify-between mt-2 text-sm text-gray-500 dark:text-gray-400">
          <div className="flex-1 text-center">Basic Info</div>
          <div className="flex-1 text-center">Location</div>
          <div className="flex-1 text-center">Timing & Budget</div>
          <div className="flex-1 text-center">Preferences</div>
        </div>
      </div>
      
      {/* Conditional rendering of pages */}
      <div className="mb-6">
        {formData.currentPage === 1 && <BasicInfoPage formData={formData} setFormData={setFormData} />}
        {formData.currentPage === 2 && <LocationPage formData={formData} setFormData={setFormData} />}
        {formData.currentPage === 3 && (
          <TimingBudgetPage 
            formData={formData} 
            setFormData={setFormData} 
            setHasDateError={setHasDateError} 
          />
        )}
        {formData.currentPage === 4 && <PreferencesPage formData={formData} setFormData={setFormData} />}
      </div>
      
      {/* Navigation buttons */}
      <div className="flex justify-between mt-8 mb-12">
        {formData.currentPage > 1 ? (
          <button
            onClick={handleBack}
            className="px-6 py-2 rounded-md bg-white text-blue-600 border border-blue-500 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            type="button"
          >
            Back
          </button>
        ) : (
          <div></div> // Empty div for spacing
        )}
        
        {formData.currentPage < 4 ? (
          <button
            onClick={handleNext}
            disabled={!canProceed() || saving}
            className={`px-6 py-2 rounded-md text-white 
              ${!canProceed() ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} 
              focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors flex items-center`}
            type="button"
          >
            {saving ? (
              <>
                <span className="animate-spin inline-block h-4 w-4 border-t-2 border-b-2 border-white rounded-full mr-2"></span>
                Saving...
              </>
            ) : (
              "Next"
            )}
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={saving || !canProceed()}
            className={`px-6 py-2 rounded-md text-white 
              ${saving || !canProceed() ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} 
              focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors flex items-center`}
            type="button"
          >
            {saving ? (
              <>
                <span className="animate-spin inline-block h-4 w-4 border-t-2 border-b-2 border-white rounded-full mr-2"></span>
                Saving...
              </>
            ) : (
              "Submit Survey"
            )}
          </button>
        )}
      </div>
      
      {/* Completion Modal */}
      {showCompletionModal && (
        <div className="fixed inset-0 z-50 overflow-auto bg-gray-800 bg-opacity-50 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md mx-auto">
            <h2 className="text-2xl font-bold text-center mb-4 text-gray-900 dark:text-gray-100">Survey Completed!</h2>
            <p className="text-center text-gray-700 dark:text-gray-300 mb-6">
              Thank you for completing your roommate survey. You can now browse potential roommates and find your perfect match!
            </p>
            <div className="flex justify-center">
              <button
                onClick={handleGoToDashboard}
                className="px-6 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                type="button"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 