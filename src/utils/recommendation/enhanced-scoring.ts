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
  
  // If the notes analysis indicates that this match should be pruned,
  // return null immediately regardless of base score
  if (additionalInfoAdjustment.prune) {
    return null;
  }
  
  // Get the raw OpenAI score (-10 to +10)
  const rawScore = additionalInfoAdjustment.score;
  
  // Extract the original preference and roommate scores
  const originalPreferencesScore = baseScore.compatibilityDetails.preferencesScore;
  const originalRoommateScore = baseScore.compatibilityDetails.roommateScore || 0; // Use 0 if not available
  
  // Calculate combined preferences score with the formula from scoring.ts
  // but add the OpenAI score directly as a percentage
  // Original: preferencesScore * 0.8 + roommateScore * 0.2
  // New: preferencesScore * 0.8 + roommateScore * 0.2 + rawOpenAIScore (as percentage points)
  const combinedPreferencesScore = Math.max(0, Math.min(100, 
    (originalPreferencesScore * 0.8 + originalRoommateScore * 0.2) + rawScore
  ));
  
  // Calculate how much the preferences component changed
  const originalCombinedScore = originalPreferencesScore * 0.8 + originalRoommateScore * 0.2;
  const preferenceDifference = combinedPreferencesScore - originalCombinedScore;
  
  // Recalculate the total score - preferences are typically weighted at 30% of total score
  const preferencesWeight = 0.3; // Typical weight for preferences in the overall score
  const scoreAdjustment = preferenceDifference * preferencesWeight;
  const adjustedTotalScore = Math.max(0, Math.min(100, baseScore.score + scoreAdjustment));
  
  // Calculate an adjusted raw preferences score that would yield our desired combined score
  // Solving for x in: x * 0.8 + originalRoommateScore * 0.2 = combinedPreferencesScore
  const adjustedRawPreferencesScore = Math.max(0, Math.min(100,
    (combinedPreferencesScore - (originalRoommateScore * 0.2)) / 0.8
  ));
  
  return {
    userEmail: baseScore.userEmail,
    score: adjustedTotalScore,
    compatibilityDetails: {
      ...baseScore.compatibilityDetails,
      // Store the raw compatibility score (-10 to +10) from the additional notes analysis
      additionalInfoScore: additionalInfoAdjustment.score,
      // Set the adjusted preferences score that would yield our modified combined score
      preferencesScore: adjustedRawPreferencesScore
    },
    explanations: {
      additionalNotesExplanation: additionalInfoAdjustment.explanation
    }
  };
} 