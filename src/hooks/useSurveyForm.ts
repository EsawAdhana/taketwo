'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { SurveyFormData, INITIAL_FORM_DATA, Preference } from '@/constants/survey-constants';
import { useSurveyNavigation } from '@/contexts/SurveyNavigationContext';
import { fetchSurvey, saveSurvey as apiSaveSurvey } from '@/utils/surveyApi';

interface UseSurveyFormProps {
  isEditing?: boolean;
  isTestMode?: boolean;
}

export function useSurveyForm({ isEditing = false, isTestMode = false }: UseSurveyFormProps) {
  const { data: session } = useSession();
  const { setHasUnsavedChanges } = useSurveyNavigation();
  
  const [formData, setFormData] = useState<SurveyFormData>(INITIAL_FORM_DATA);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [originalData, setOriginalData] = useState<SurveyFormData | null>(null);
  const [hasDateError, setHasDateError] = useState(false);
  
  // Track form changes against original data to detect unsaved changes
  useEffect(() => {
    if (!originalData || loading) return;
    
    // Helper function to compare objects and detect significant changes
    const hasMeaningfulChanges = () => {
      // Skip comparing currentPage and other UI-related fields
      const compareFields = (obj1: any, obj2: any, ignoredFields = ['currentPage']) => {
        for (const key in obj1) {
          if (ignoredFields.includes(key)) continue;
          
          // Handle arrays specially (like preferences, housingCities)
          if (Array.isArray(obj1[key]) && Array.isArray(obj2[key])) {
            // For simple arrays, JSON.stringify is sufficient
            if (JSON.stringify(obj1[key]) !== JSON.stringify(obj2[key])) {
              return true;
            }
          } 
          // Handle nested objects
          else if (typeof obj1[key] === 'object' && obj1[key] !== null && 
                  typeof obj2[key] === 'object' && obj2[key] !== null) {
            if (compareFields(obj1[key], obj2[key])) {
              return true;
            }
          }
          // Handle primitive values
          else if (obj1[key] !== obj2[key]) {
            return true;
          }
        }
        return false;
      };
      
      return compareFields(formData, originalData) || compareFields(originalData, formData);
    };
    
    // Detect if there are unsaved changes
    const hasChanges = hasMeaningfulChanges();
    setHasUnsavedChanges(hasChanges);
    
  }, [formData, originalData, loading, setHasUnsavedChanges]);
  
  // Fetch existing survey data
  useEffect(() => {
    const loadSurvey = async () => {
      if (!session) return;
      
      // Skip fetching previous data if we're in test mode
      if (isTestMode) {
        setLoading(false);
        return;
      }
      
      try {
        const { data, error } = await fetchSurvey();
        
        if (data) {
          // Create a map of existing preferences for easy lookup
          const existingPreferences = new Map(
            data.preferences?.map((p: Preference) => [p.item, p]) || []
          );
          
          // Merge with initial preferences, keeping existing ones and using neutral for missing ones
          const mergedPreferences = INITIAL_FORM_DATA.preferences.map(initialPref => 
            existingPreferences.get(initialPref.item) || initialPref
          );
          
          const surveyData = {
            ...INITIAL_FORM_DATA,
            ...data,
            preferences: mergedPreferences,
            // Keep the saved page unless the survey was submitted
            currentPage: data.isSubmitted ? 1 : (data.currentPage || 1),
            // Preserve isSubmitted status even during editing
            isSubmitted: isEditing ? data.isSubmitted : (data.isSubmitted || false)
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
    
    loadSurvey();
  }, [session, isEditing, isTestMode]);
  
  // Save form data
  const saveSurvey = async (finalSubmit = false) => {
    setSaving(true);
    
    try {
      // Update local state first for immediate feedback
      if (finalSubmit && !formData.isSubmitted) {
        setFormData(prev => ({ ...prev, isSubmitted: true }));
      }
      
      const { success, error } = await apiSaveSurvey(formData, finalSubmit);
      
      if (success) {
        // Reset unsaved changes flag after successful save
        if (finalSubmit) {
          setHasUnsavedChanges(false);
        }
        
        // Update originalData to match current data after successful save
        setOriginalData({...formData});
        
        return true;
      } else {
        console.error('Error saving survey:', error);
        return false;
      }
    } catch (error) {
      console.error('Error saving survey:', error);
      return false;
    } finally {
      setSaving(false);
    }
  };
  
  return {
    formData,
    setFormData,
    loading,
    saving,
    setSaving,
    hasDateError,
    setHasDateError,
    showCompletionModal,
    setShowCompletionModal,
    originalData,
    saveSurvey
  };
} 