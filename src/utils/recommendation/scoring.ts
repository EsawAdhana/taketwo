import { SurveyFormData, Preference } from '@/constants/survey-constants';
import { CompatibilityScore } from './types';
import { WEIGHTS, PREFERENCE_VALUES } from './constants';
import { passesHardConstraints } from './constraints';

/**
 * Calculate preference compatibility score between two users
 */
export function calculatePreferenceScore(userPrefs: Preference[], matchPrefs: Preference[]): number {
  let totalScore = 0;
  let maxPossibleScore = 0;
  
  // Create a map of the match's preferences for easy lookup
  const matchPrefMap = new Map<string, Preference>();
  matchPrefs.forEach(pref => {
    matchPrefMap.set(pref.item, pref);
  });
  
  // Compare each preference
  userPrefs.forEach(userPref => {
    const matchPref = matchPrefMap.get(userPref.item);
    
    if (matchPref) {
      const userValue = PREFERENCE_VALUES[userPref.strength];
      const matchValue = PREFERENCE_VALUES[matchPref.strength];
      
      // Special case: If one user has "must have" and the other has "deal breaker" for the same item
      // This is a significant incompatibility that should heavily reduce the score
      if ((userPref.strength === 'must have' && matchPref.strength === 'deal breaker') ||
          (userPref.strength === 'deal breaker' && matchPref.strength === 'must have')) {
        totalScore -= 12; // Apply a much stronger penalty
      }
      // Calculate compatibility for this preference
      // If both users are on the same side of the spectrum (both positive or both negative)
      else if ((userValue >= 0 && matchValue >= 0) || (userValue <= 0 && matchValue <= 0)) {
        // Reward agreement, especially for strong preferences
        totalScore += Math.min(Math.abs(userValue), Math.abs(matchValue));
      } else {
        // Penalize disagreement, especially for strong opposing preferences
        totalScore += userValue * matchValue; // This will be negative for opposing preferences
      }
      
      // Maximum possible positive score for this preference
      maxPossibleScore += 4; // Maximum is 'must have' value
    }
  });
  
  // Normalize to a 0-1 scale
  return maxPossibleScore > 0 ? (totalScore + maxPossibleScore) / (2 * maxPossibleScore) : 0.5;
}

/**
 * Budget compatibility score
 */
export function calculateBudgetScore(user: SurveyFormData, potentialMatch: SurveyFormData): number {
  const userMin = user.minBudget;
  const userMax = user.maxBudget;
  const matchMin = potentialMatch.minBudget;
  const matchMax = potentialMatch.maxBudget;
  
  // Calculate overlap percentage
  const overlapMin = Math.max(userMin, matchMin);
  const overlapMax = Math.min(userMax, matchMax);
  const overlapAmount = Math.max(0, overlapMax - overlapMin);
  
  // Calculate total range
  const userRange = userMax - userMin;
  const matchRange = matchMax - matchMin;
  const totalRange = Math.max(userMax, matchMax) - Math.min(userMin, matchMin);
  
  if (totalRange === 0) return 1; // Exact same budget
  
  // Overlap percentage relative to the combined range
  return overlapAmount / totalRange;
}

/**
 * Calculate a detailed compatibility score between two users
 */
export function calculateCompatibilityScore(user: SurveyFormData, potentialMatch: SurveyFormData): CompatibilityScore | null {
  // Skip inactive or incomplete profiles
  if (!user.isSubmitted || !potentialMatch.isSubmitted) {
    return null;
  }
  
  // Prevent matching a user with themselves
  if (user.userEmail && potentialMatch.userEmail && user.userEmail === potentialMatch.userEmail) {
    return null;
  }
  
  // Check hard constraints first
  if (!passesHardConstraints(user, potentialMatch)) {
    return null;
  }
  
  // Calculate individual category scores - each score is between 0 and 1
  
  // Location score - considers region match and city overlap
  const locationScore = 0.7; // Base score for being in same region (already verified in hard constraints)
  
  // City overlap - additional points for shared cities
  const sharedCities = user.housingCities.filter(city => 
    potentialMatch.housingCities.includes(city)
  ).length;
  
  // Calculate city overlap as a ratio of shared cities to the larger set of cities
  const maxCities = Math.max(user.housingCities.length, potentialMatch.housingCities.length);
  const cityOverlapScore = maxCities > 0 ? 0.3 * (sharedCities / maxCities) : 0;
  const totalLocationScore = locationScore + cityOverlapScore;
  
  // Budget compatibility score using the new function
  const budgetScore = calculateBudgetScore(user, potentialMatch);
  
  // Gender compatibility score - always 1.0 since we've passed hard constraints
  const genderScore = 1.0;
  
  // Timing compatibility score - calculate the overlap percentage
  const userStart = new Date(user.internshipStartDate);
  const userEnd = new Date(user.internshipEndDate);
  const matchStart = new Date(potentialMatch.internshipStartDate);
  const matchEnd = new Date(potentialMatch.internshipEndDate);
  
  const overlapStart = new Date(Math.max(userStart.getTime(), matchStart.getTime()));
  const overlapEnd = new Date(Math.min(userEnd.getTime(), matchEnd.getTime()));
  const overlapDuration = Math.max(0, overlapEnd.getTime() - overlapStart.getTime());
  
  // Calculate the longer duration for percentage calculation
  const userDuration = userEnd.getTime() - userStart.getTime();
  const matchDuration = matchEnd.getTime() - matchStart.getTime();
  const longerDuration = Math.max(userDuration, matchDuration);
  
  // Linear score based on overlap percentage (we know it's at least 75% due to hard constraints)
  const overlapPercentage = overlapDuration / longerDuration;
  const timingScore = Math.min(1, (overlapPercentage - 0.75) * 4 + 0.75);
  
  // Roommate preference score - based on desired roommates
  let roommateScore = 1;
  const userDesired = user.desiredRoommates;
  const matchDesired = potentialMatch.desiredRoommates;
  
  // Perfect match gets 1.0, adjacent preferences get 0.8, larger gaps get less
  if (userDesired === matchDesired) {
    roommateScore = 1.0;
  } else if (
    (userDesired === "1" && matchDesired === "2") ||
    (userDesired === "2" && matchDesired === "1") ||
    (userDesired === "2" && matchDesired === "3") ||
    (userDesired === "3" && matchDesired === "2") ||
    (userDesired === "3" && matchDesired === "4+") ||
    (userDesired === "4+" && matchDesired === "3")
  ) {
    roommateScore = 0.8;
  } else if (
    (userDesired === "1" && matchDesired === "3") ||
    (userDesired === "3" && matchDesired === "1") ||
    (userDesired === "2" && matchDesired === "4+") ||
    (userDesired === "4+" && matchDesired === "2")
  ) {
    roommateScore = 0.6;
  }
  
  // Preferences score
  const preferencesScore = calculatePreferenceScore(user.preferences, potentialMatch.preferences);
  
  // Calculate weighted total score
  // Include roommate preference in the preferences score
  const combinedPreferencesScore = preferencesScore * 0.8 + roommateScore * 0.2;

  // Calculate weighted total score
  let weightedScore = 
    (WEIGHTS.LOCATION * totalLocationScore) +
    (WEIGHTS.BUDGET * budgetScore) +
    (WEIGHTS.TIMING * timingScore) +
    (WEIGHTS.PREFERENCES * combinedPreferencesScore);
  
  // Normalize to 0-100 scale and ensure it doesn't exceed 100%
  const totalWeight = WEIGHTS.LOCATION + WEIGHTS.BUDGET + WEIGHTS.TIMING + WEIGHTS.PREFERENCES;
  let normalizedScore = Math.min(100, (weightedScore / totalWeight) * 100);
  
  // Apply company match bonus if both users have specified the same company
  if (user.internshipCompany && 
      potentialMatch.internshipCompany && 
      user.internshipCompany.trim().toLowerCase() === potentialMatch.internshipCompany.trim().toLowerCase()) {
    // Use diminishing returns formula instead of flat multiplier
    // This gives a bigger boost to lower scores but makes it harder to reach 100%
    // Formula: newScore = baseScore + (100 - baseScore) * 0.4
    normalizedScore = normalizedScore + (100 - normalizedScore) * 0.4;
  }
  
  // Ensure userEmail is valid and not empty
  const userEmail = potentialMatch.userEmail && potentialMatch.userEmail.trim() !== '' 
    ? potentialMatch.userEmail 
    : null;
  
  // If the email is null or empty, return null instead of a compatibility score
  if (!userEmail) {
    return null;
  }
  
  return {
    userEmail: userEmail,
    score: normalizedScore,
    compatibilityDetails: {
      locationScore: totalLocationScore * 100,
      budgetScore: budgetScore * 100,
      genderScore: 100, // Always 100% for users who pass hard constraints
      timingScore: timingScore * 100,
      roommateScore: roommateScore * 100,
      preferencesScore: preferencesScore * 100
    }
  };
} 