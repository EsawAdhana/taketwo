import { SurveyFormData } from '@/constants/survey-constants';

/**
 * Extended survey data type that includes additional fields used in testing API routes
 */
export interface ExtendedSurveyData extends SurveyFormData {
  // Additional fields used in testing
  name: string;
  email: string;
} 