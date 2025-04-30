import { SurveyFormData, Preference, PreferenceStrength } from '@/constants/survey-constants';

/**
 * Represents a compatibility score between two users
 */
export interface CompatibilityScore {
  userEmail: string;
  score: number;
  compatibilityDetails: {
    [key: string]: number;
  };
  explanations?: {
    additionalNotesExplanation?: string;
  };
}

/**
 * Constraint details between two users
 */
export interface ConstraintDetails {
  genderCompatible: boolean;
  regionMatch: boolean;
  timingOverlap: boolean;
  timingOverlapPercentage: number;
  budgetCompatible: boolean;
  roommatesCompatible: boolean;
  preferencesCompatible: boolean;
}

/**
 * Result of user comparison
 */
export interface UserComparisonResult {
  user1: SurveyFormData;
  user2: SurveyFormData;
  compatibilityScore: CompatibilityScore | null;
  passesHardConstraints: boolean;
  constraintDetails: ConstraintDetails;
}

/**
 * Result of additional notes analysis
 */
export interface NotesAnalysisResult {
  score: number;
  explanation: string;
} 