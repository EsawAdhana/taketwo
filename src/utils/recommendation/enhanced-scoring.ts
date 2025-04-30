import { SurveyFormData } from '@/constants/survey-constants';
import { CompatibilityScore } from './types';
import { calculateCompatibilityScore } from './scoring';
import { analyzeAdditionalNotes } from './analysis';
import { DEFAULT_MIN_COMPATIBILITY_THRESHOLD } from './constants';

/**
 * Enhanced version of calculateCompatibilityScore that includes LLM analysis of additional notes
 * This version:
 * 1. First calculates a base compatibility score without additional notes
 * 2. Only proceeds with additional notes analysis if the base score meets a minimum threshold
 * 3. Adjusts the final score by +/-10% maximum based on additional notes analysis
 * 4. Returns null if the adjusted score falls below the minimum threshold
 * 5. Ensures the final score never exceeds 110% (100% base + 10% max adjustment)
 */
export async function calculateEnhancedCompatibilityScore(
  user: SurveyFormData, 
  potentialMatch: SurveyFormData,
  minCompatibilityThreshold?: number
): Promise<CompatibilityScore | null> {
  // First get the base compatibility score using structured data only
  const baseScore = calculateCompatibilityScore(user, potentialMatch);
  
  // If no base match, return null immediately
  if (!baseScore) {
    return null;
  }
  
  // Validate userEmail - return null if invalid
  if (!baseScore.userEmail || baseScore.userEmail.trim() === '') {
    return null;
  }
  
  // For test users, use the provided threshold if any, otherwise default to 50
  // For production users, always use 50
  const isTestUser = (user.userEmail?.includes('test') || potentialMatch.userEmail?.includes('test')) ?? false;
  
  // If minCompatibilityThreshold is explicitly provided (especially from testing endpoints),
  // use it regardless of whether the user is detected as a test user
  const effectiveThreshold = minCompatibilityThreshold !== undefined 
    ? minCompatibilityThreshold 
    : DEFAULT_MIN_COMPATIBILITY_THRESHOLD;
  
  // If below minimum threshold, return null
  if (baseScore.score < effectiveThreshold) {
    return null;
  }
  
  // Analyze additional notes to get a compatibility adjustment
  const additionalInfoAdjustment = await analyzeAdditionalNotes(
    user.additionalNotes,
    potentialMatch.additionalNotes
  );
  
  // Calculate score adjustment as a percentage (up to +/-10%)
  // Convert -10 to +10 scale to a factor between -0.1 and +0.1
  const adjustmentFactor = additionalInfoAdjustment.score / 100;
  
  // Apply adjustment to base score (max +/-10%)
  let adjustedScore = baseScore.score * (1 + adjustmentFactor);
  
  // Clamp to ensure we never go below 0 or above 100
  adjustedScore = Math.max(0, Math.min(100, adjustedScore));
  
  // If after adjustment, score falls below threshold, return null
  if (adjustedScore < effectiveThreshold) {
    return null;
  }
  
  // Convert the -10 to +10 score to a 0-100 scale for UI display
  // -10 maps to 0, 0 maps to 50, +10 maps to 100
  const additionalInfoScore = ((additionalInfoAdjustment.score + 10) / 20) * 100;
  
  // Create the enhanced score object with the adjusted score
  return {
    userEmail: baseScore.userEmail,
    score: adjustedScore,
    compatibilityDetails: {
      ...baseScore.compatibilityDetails,
      additionalInfoScore: additionalInfoScore
    },
    explanations: {
      additionalNotesExplanation: additionalInfoAdjustment.explanation
    }
  };
} 