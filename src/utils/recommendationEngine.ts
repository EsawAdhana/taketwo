import { SurveyFormData, Preference, PreferenceStrength } from '@/constants/survey-constants';
import { WithId, Document } from 'mongodb';

interface CompatibilityScore {
  userEmail: string;
  score: number;
  compatibilityDetails: {
    [key: string]: number;
  };
}

// Constants for scoring weights
const WEIGHTS = {
  LOCATION: 30,
  BUDGET: 20,
  GENDER: 15,
  TIMING: 15,
  PREFERENCES: 20
};

// Budget tolerance (as a percentage)
const BUDGET_TOLERANCE = 0.2; // 20%

// Preference strength value mapping with updated values per request
const PREFERENCE_VALUES: Record<PreferenceStrength, number> = {
  'deal breaker': -4,
  'prefer not': -1,
  'neutral': 0,
  'prefer': 1,
  'must have': 4
};

// Convert MongoDB document to SurveyFormData
function documentToSurveyData(doc: WithId<Document>): SurveyFormData {
  return {
    gender: doc.gender || '',
    roomWithDifferentGender: !!doc.roomWithDifferentGender,
    housingRegion: doc.housingRegion || '',
    housingCities: Array.isArray(doc.housingCities) ? doc.housingCities : [],
    internshipStartDate: doc.internshipStartDate || '',
    internshipEndDate: doc.internshipEndDate || '',
    desiredRoommates: doc.desiredRoommates || '1',
    monthlyBudget: typeof doc.monthlyBudget === 'number' ? doc.monthlyBudget : 1500,
    preferences: Array.isArray(doc.preferences) ? doc.preferences : [],
    additionalNotes: doc.additionalNotes || '',
    currentPage: typeof doc.currentPage === 'number' ? doc.currentPage : 1,
    isDraft: !!doc.isDraft,
    isSubmitted: !!doc.isSubmitted,
    userEmail: doc.userEmail || '',
  } as SurveyFormData;
}

/**
 * Check hard constraints that would immediately disqualify a match
 */
function passesHardConstraints(user: SurveyFormData, potentialMatch: SurveyFormData): boolean {
  // Check gender constraints - updated per request
  // If either user is a different gender and doesn't accept different gender roommates, rule out
  if (user.gender !== potentialMatch.gender) {
    if (!user.roomWithDifferentGender || !potentialMatch.roomWithDifferentGender) {
      return false;
    }
  }
  
  // Check region compatibility - must be same region
  const regionMatch = user.housingRegion === potentialMatch.housingRegion;
  if (!regionMatch) return false;
  
  // Check timing compatibility - at least some overlap in internship period
  const userStart = new Date(user.internshipStartDate);
  const userEnd = new Date(user.internshipEndDate);
  const matchStart = new Date(potentialMatch.internshipStartDate);
  const matchEnd = new Date(potentialMatch.internshipEndDate);
  
  // If one ends before the other starts, there's no overlap
  if (userEnd < matchStart || matchEnd < userStart) return false;
  
  // Check budget compatibility
  const maxBudget = Math.max(user.monthlyBudget, potentialMatch.monthlyBudget);
  const minBudget = Math.min(user.monthlyBudget, potentialMatch.monthlyBudget);
  const budgetDifference = (maxBudget - minBudget) / maxBudget;
  if (budgetDifference > BUDGET_TOLERANCE) return false;
  
  return true;
}

/**
 * Calculate preference compatibility score between two users
 */
function calculatePreferenceScore(userPrefs: Preference[], matchPrefs: Preference[]): number {
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
        // Updated per request: deal breaker + must have = -8 points
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
 * Calculate a detailed compatibility score between two users
 */
export function calculateCompatibilityScore(user: SurveyFormData, potentialMatch: SurveyFormData): CompatibilityScore | null {
  // Skip inactive or incomplete profiles
  if (!user.isSubmitted || !potentialMatch.isSubmitted) {
    return null;
  }
  
  // Check hard constraints first
  if (!passesHardConstraints(user, potentialMatch)) {
    return null;
  }
  
  // Calculate individual category scores
  
  // Location score - considers region match and city overlap
  // Updated per request: smaller bonus if same region without shared city
  const locationScore = 0.7; // Base score for being in same region (already verified in hard constraints)
  
  // City overlap - additional points for shared cities
  const sharedCities = user.housingCities.filter(city => 
    potentialMatch.housingCities.includes(city)
  ).length;
  
  const cityOverlapScore = sharedCities > 0 ? 0.3 * Math.min(1, sharedCities / 2) : 0;
  const totalLocationScore = locationScore + cityOverlapScore;
  
  // Budget compatibility score
  const budgetScore = 1 - Math.abs(user.monthlyBudget - potentialMatch.monthlyBudget) / 
    Math.max(user.monthlyBudget, potentialMatch.monthlyBudget);
  
  // Gender compatibility score
  const genderScore = user.gender === potentialMatch.gender ? 1 : 
    (user.roomWithDifferentGender && potentialMatch.roomWithDifferentGender ? 0.7 : 0);
  
  // Timing compatibility score - calculate the overlap percentage
  // Updated per request: linear score based on overlap percentage
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
  
  // Linear score based on overlap percentage
  const timingScore = overlapDuration / longerDuration;
  
  // Roommate preference score - simple comparison based on desired roommates
  let roommateScore = 1;
  const userDesired = parseInt(user.desiredRoommates, 10);
  const matchDesired = parseInt(potentialMatch.desiredRoommates, 10);
  
  if (!isNaN(userDesired) && !isNaN(matchDesired)) {
    // The closer the desired roommate counts, the better
    roommateScore = 1 - Math.abs(userDesired - matchDesired) / Math.max(4, Math.max(userDesired, matchDesired));
  }
  
  // Preferences score
  const preferencesScore = calculatePreferenceScore(user.preferences, potentialMatch.preferences);
  
  // Calculate weighted total score
  const totalScore = 
    (WEIGHTS.LOCATION * totalLocationScore) +
    (WEIGHTS.BUDGET * budgetScore) +
    (WEIGHTS.GENDER * genderScore * 0.8 + WEIGHTS.GENDER * 0.2 * roommateScore) + // Include roommate preference in gender score
    (WEIGHTS.TIMING * timingScore) +
    (WEIGHTS.PREFERENCES * preferencesScore);
  
  // Normalize to 0-100 scale
  const normalizedScore = totalScore / 
    (WEIGHTS.LOCATION + WEIGHTS.BUDGET + WEIGHTS.GENDER + WEIGHTS.TIMING + WEIGHTS.PREFERENCES) * 100;
  
  return {
    userEmail: potentialMatch.userEmail || '',
    score: normalizedScore,
    compatibilityDetails: {
      locationScore: totalLocationScore * 100,
      budgetScore: budgetScore * 100,
      genderScore: genderScore * 100,
      timingScore: timingScore * 100,
      roommateScore: roommateScore * 100,
      preferencesScore: preferencesScore * 100
    }
  };
}

/**
 * Get recommended matches for a user with scores
 */
export async function getRecommendedMatches(
  userEmail: string,
  minCompatibilityScore: number = 50
): Promise<CompatibilityScore[]> {
  try {
    const client = (await import('@/lib/mongodb')).default;
    const mongodb = await client;
    const db = mongodb.db('taketwo');
    
    // Get the user's survey data
    let userDoc;
    
    // Check if the user is in the regular surveys collection
    userDoc = await db.collection('surveys').findOne({ userEmail });
    
    // If not found, check if it's a test user
    if (!userDoc) {
      userDoc = await db.collection('test_surveys').findOne({ userEmail });
    }
    
    if (!userDoc) throw new Error('User survey not found');
    
    // Convert to SurveyFormData
    const user = documentToSurveyData(userDoc);
    
    // Determine collection to search based on where user was found
    const collectionName = await db.collection('test_surveys').findOne({ userEmail }) 
      ? 'test_surveys' 
      : 'surveys';
    
    // Get all submitted surveys except the current user
    const potentialMatchDocs = await db.collection(collectionName)
      .find({ 
        userEmail: { $ne: userEmail },
        isSubmitted: true
      })
      .toArray();
    
    // Calculate compatibility scores
    const compatibilityScores = potentialMatchDocs
      .map(matchDoc => {
        const match = documentToSurveyData(matchDoc);
        return calculateCompatibilityScore(user, match);
      })
      .filter(score => score !== null && score.score >= minCompatibilityScore) as CompatibilityScore[];
    
    // Sort by score (highest first)
    return compatibilityScores.sort((a, b) => b.score - a.score);
  } catch (error) {
    console.error('Error getting recommended matches:', error);
    return [];
  }
}

/**
 * Get top matches for a specific housing region
 */
export async function getTopMatchesByRegion(
  userEmail: string,
  region: string,
  limit: number = 10
): Promise<CompatibilityScore[]> {
  try {
    const client = (await import('@/lib/mongodb')).default;
    const mongodb = await client;
    const db = mongodb.db('taketwo');
    
    // Get the user's survey data
    let userDoc;
    
    // Check if the user is in the regular surveys collection
    userDoc = await db.collection('surveys').findOne({ userEmail });
    
    // If not found, check if it's a test user
    if (!userDoc) {
      userDoc = await db.collection('test_surveys').findOne({ userEmail });
    }
    
    if (!userDoc) throw new Error('User survey not found');
    
    // Convert to SurveyFormData
    const user = documentToSurveyData(userDoc);
    
    // Determine collection to search based on where user was found
    const collectionName = await db.collection('test_surveys').findOne({ userEmail }) 
      ? 'test_surveys' 
      : 'surveys';
    
    // Get all submitted surveys in the specified region except the current user
    const potentialMatchDocs = await db.collection(collectionName)
      .find({ 
        userEmail: { $ne: userEmail },
        isSubmitted: true,
        housingRegion: region
      })
      .toArray();
    
    // Calculate compatibility scores
    const compatibilityScores = potentialMatchDocs
      .map(matchDoc => {
        const match = documentToSurveyData(matchDoc);
        return calculateCompatibilityScore(user, match);
      })
      .filter(score => score !== null) as CompatibilityScore[];
    
    // Sort by score (highest first) and limit
    return compatibilityScores
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  } catch (error) {
    console.error('Error getting top matches by region:', error);
    return [];
  }
}

/**
 * Compare two specific users and return detailed compatibility information
 */
export async function compareUsers(
  userEmail1: string,
  userEmail2: string
): Promise<{
  user1: SurveyFormData,
  user2: SurveyFormData,
  compatibilityScore: CompatibilityScore | null,
  passesHardConstraints: boolean,
  constraintDetails: {
    genderCompatible: boolean,
    regionMatch: boolean,
    timingOverlap: boolean,
    budgetCompatible: boolean
  }
}> {
  try {
    const client = (await import('@/lib/mongodb')).default;
    const mongodb = await client;
    const db = mongodb.db('taketwo');
    
    // Get both users' survey data
    const getUserDoc = async (email: string) => {
      let userDoc = await db.collection('surveys').findOne({ userEmail: email });
      if (!userDoc) {
        userDoc = await db.collection('test_surveys').findOne({ userEmail: email });
      }
      if (!userDoc) throw new Error(`User survey not found for email: ${email}`);
      return documentToSurveyData(userDoc);
    };
    
    const user1 = await getUserDoc(userEmail1);
    const user2 = await getUserDoc(userEmail2);
    
    // Calculate detailed constraint information
    const genderCompatible = user1.gender === user2.gender || 
      (user1.roomWithDifferentGender && user2.roomWithDifferentGender);
    
    const regionMatch = user1.housingRegion === user2.housingRegion;
    
    const user1Start = new Date(user1.internshipStartDate);
    const user1End = new Date(user1.internshipEndDate);
    const user2Start = new Date(user2.internshipStartDate);
    const user2End = new Date(user2.internshipEndDate);
    const timingOverlap = !(user1End < user2Start || user2End < user1Start);
    
    const maxBudget = Math.max(user1.monthlyBudget, user2.monthlyBudget);
    const minBudget = Math.min(user1.monthlyBudget, user2.monthlyBudget);
    const budgetDifference = (maxBudget - minBudget) / maxBudget;
    const budgetCompatible = budgetDifference <= BUDGET_TOLERANCE;
    
    const hardConstraintsPassed = genderCompatible && regionMatch && timingOverlap && budgetCompatible;
    
    // Calculate compatibility score
    const score = calculateCompatibilityScore(user1, user2);
    
    return {
      user1,
      user2,
      compatibilityScore: score,
      passesHardConstraints: hardConstraintsPassed,
      constraintDetails: {
        genderCompatible,
        regionMatch,
        timingOverlap,
        budgetCompatible
      }
    };
  } catch (error) {
    console.error('Error comparing users:', error);
    throw new Error(`Failed to compare users: ${(error as Error).message}`);
  }
} 