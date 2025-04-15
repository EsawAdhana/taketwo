'use client';

import { SurveyFormData } from '@/constants/survey-constants';

/**
 * Fetches the user's survey data
 */
export async function fetchSurvey() {
  try {
    const response = await fetch('/api/survey');
    const result = await response.json();
    
    if (response.ok && result.data) {
      return { data: result.data, error: null };
    } else {
      return { data: null, error: result.error || 'Failed to fetch survey' };
    }
  } catch (error) {
    console.error('Error fetching survey data:', error);
    return { data: null, error: 'Failed to fetch survey' };
  }
}

/**
 * Saves the user's survey data
 * 
 * @param formData - The survey form data to save
 * @param isFinalSubmit - Whether this is the final submission
 */
export async function saveSurvey(formData: SurveyFormData, isFinalSubmit: boolean = false) {
  try {
    const response = await fetch('/api/survey', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...formData,
        isDraft: !isFinalSubmit,
        isSubmitted: isFinalSubmit || formData.isSubmitted
      }),
    });
    
    const result = await response.json();
    
    if (response.ok) {
      return { success: true, error: null };
    } else {
      return { success: false, error: result.error || 'Failed to save survey' };
    }
  } catch (error) {
    console.error('Error saving survey:', error);
    return { success: false, error: 'Failed to save survey' };
  }
} 