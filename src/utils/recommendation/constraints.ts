import { SurveyFormData } from '@/constants/survey-constants';
import { ConstraintDetails } from './types';

/**
 * Check hard constraints that would immediately disqualify a match
 */
export function passesHardConstraints(user: SurveyFormData, potentialMatch: SurveyFormData): boolean {
  // 1. Check gender constraints
  // If either user is a different gender and doesn't accept different gender roommates, rule out
  if (user.gender !== potentialMatch.gender) {
    if (!user.roomWithDifferentGender || !potentialMatch.roomWithDifferentGender) {
      return false;
    }
  }
  
  // 2. Check region compatibility - must be same region
  const regionMatch = user.housingRegion === potentialMatch.housingRegion;
  if (!regionMatch) return false;
  
  // 3. Check timing compatibility - require 75% overlap based on the longer internship
  const userStart = new Date(user.internshipStartDate);
  const userEnd = new Date(user.internshipEndDate);
  const matchStart = new Date(potentialMatch.internshipStartDate);
  const matchEnd = new Date(potentialMatch.internshipEndDate);
  
  // If one ends before the other starts, there's no overlap
  if (userEnd < matchStart || matchEnd < userStart) return false;
  
  // Calculate overlap percentage based on the longer internship
  const overlapStart = new Date(Math.max(userStart.getTime(), matchStart.getTime()));
  const overlapEnd = new Date(Math.min(userEnd.getTime(), matchEnd.getTime()));
  const overlapDuration = Math.max(0, overlapEnd.getTime() - overlapStart.getTime());
  
  // Calculate the longer duration for percentage calculation
  const userDuration = userEnd.getTime() - userStart.getTime();
  const matchDuration = matchEnd.getTime() - matchStart.getTime();
  const longerDuration = Math.max(userDuration, matchDuration);
  
  // Require at least 75% overlap based on the longer internship
  const overlapPercentage = overlapDuration / longerDuration;
  if (overlapPercentage < 0.75) return false;
  
  // 4. Check budget compatibility - check for overlap in budget ranges
  const userMin = user.minBudget;
  const userMax = user.maxBudget;
  const matchMin = potentialMatch.minBudget;
  const matchMax = potentialMatch.maxBudget;
  
  // No overlap in budget ranges
  if (userMax < matchMin || matchMax < userMin) return false;
  
  // 5. Check desired roommate compatibility
  const userDesired = user.desiredRoommates;
  const matchDesired = potentialMatch.desiredRoommates;
  
  // If one wants only 1 roommate and the other wants 4+, they're incompatible
  if ((userDesired === "1" && matchDesired === "4+") || 
      (userDesired === "4+" && matchDesired === "1")) {
    return false;
  }
  
  // 6. Check for incompatible preferences (must have vs deal breaker)
  for (const userPref of user.preferences) {
    const matchPref = potentialMatch.preferences.find(p => p.item === userPref.item);
    if (matchPref) {
      if ((userPref.strength === 'must have' && matchPref.strength === 'deal breaker') ||
          (userPref.strength === 'deal breaker' && matchPref.strength === 'must have')) {
        return false;
      }
    }
  }
  
  return true;
}

/**
 * Get detailed constraint information between two users
 */
export function getConstraintDetails(
  user1: SurveyFormData, 
  user2: SurveyFormData
): ConstraintDetails {
  // Gender compatibility
  const genderCompatible = user1.gender === user2.gender || 
    (user1.roomWithDifferentGender && user2.roomWithDifferentGender);
  
  // Region match
  const regionMatch = user1.housingRegion === user2.housingRegion;
  
  // Timing overlap
  const userStart1 = new Date(user1.internshipStartDate);
  const userEnd1 = new Date(user1.internshipEndDate);
  const userStart2 = new Date(user2.internshipStartDate);
  const userEnd2 = new Date(user2.internshipEndDate);
  
  const overlapStart = new Date(Math.max(userStart1.getTime(), userStart2.getTime()));
  const overlapEnd = new Date(Math.min(userEnd1.getTime(), userEnd2.getTime()));
  const overlapDuration = Math.max(0, overlapEnd.getTime() - overlapStart.getTime());
  
  // Calculate the longer duration for percentage calculation
  const userDuration1 = userEnd1.getTime() - userStart1.getTime();
  const userDuration2 = userEnd2.getTime() - userStart2.getTime();
  const longerDuration = Math.max(userDuration1, userDuration2);
  
  const hasAnyOverlap = overlapDuration > 0;
  const timingOverlapPercentage = hasAnyOverlap ? overlapDuration / longerDuration : 0;
  const timingOverlap = timingOverlapPercentage >= 0.75;
  
  // Budget compatibility
  const budgetCompatible = !(user1.maxBudget < user2.minBudget || user2.maxBudget < user1.minBudget);
  
  // Roommate compatibility
  const roommatesCompatible = !((user1.desiredRoommates === "1" && user2.desiredRoommates === "4+") || 
                              (user1.desiredRoommates === "4+" && user2.desiredRoommates === "1"));
  
  // Preference compatibility
  let preferencesCompatible = true;
  for (const pref1 of user1.preferences) {
    const pref2 = user2.preferences.find(p => p.item === pref1.item);
    if (pref2 && ((pref1.strength === 'must have' && pref2.strength === 'deal breaker') ||
                 (pref1.strength === 'deal breaker' && pref2.strength === 'must have'))) {
      preferencesCompatible = false;
      break;
    }
  }
  
  return {
    genderCompatible,
    regionMatch,
    timingOverlap,
    timingOverlapPercentage: Math.round(timingOverlapPercentage * 100),
    budgetCompatible,
    roommatesCompatible,
    preferencesCompatible
  };
} 