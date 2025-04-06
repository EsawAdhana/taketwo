import { SurveyFormData, Preference, PreferenceStrength } from '@/constants/survey-constants';
import { WithId, Document } from 'mongodb';
import openai from '@/lib/openai';

interface CompatibilityScore {
  userEmail: string;
  score: number;
  compatibilityDetails: {
    [key: string]: number;
  };
  explanations?: {
    additionalNotesExplanation?: string;
  };
}

// Constants for scoring weights
const WEIGHTS = {
  LOCATION: 30,
  BUDGET: 25,
  GENDER: 15,
  TIMING: 15,
  PREFERENCES: 15
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
    minBudget: typeof doc.minBudget === 'number' ? doc.minBudget : 1000,
    maxBudget: typeof doc.maxBudget === 'number' ? doc.maxBudget : 1500,
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

// Budget compatibility score
const calculateBudgetScore = (user: SurveyFormData, potentialMatch: SurveyFormData): number => {
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
};

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
  
  // Gender compatibility score
  const genderScore = user.gender === potentialMatch.gender ? 1 : 
    (user.roomWithDifferentGender && potentialMatch.roomWithDifferentGender ? 0.7 : 0);
  
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
  // Combine gender score and roommate preference into a single weighted component
  const combinedGenderScore = genderScore * 0.7 + roommateScore * 0.3;

  // Calculate weighted total score
  let weightedScore = 
    (WEIGHTS.LOCATION * totalLocationScore) +
    (WEIGHTS.BUDGET * budgetScore) +
    (WEIGHTS.GENDER * combinedGenderScore) +
    (WEIGHTS.TIMING * timingScore) +
    (WEIGHTS.PREFERENCES * preferencesScore);
  
  // Normalize to 0-100 scale and ensure it doesn't exceed 100%
  const totalWeight = WEIGHTS.LOCATION + WEIGHTS.BUDGET + WEIGHTS.GENDER + WEIGHTS.TIMING + WEIGHTS.PREFERENCES;
  const normalizedScore = Math.min(100, (weightedScore / totalWeight) * 100);
  
  return {
    userEmail: potentialMatch.userEmail || '',
    score: normalizedScore,
    compatibilityDetails: {
      locationScore: totalLocationScore * 100,
      budgetScore: budgetScore * 100,
      genderScore: combinedGenderScore * 100,
      timingScore: timingScore * 100,
      roommateScore: roommateScore * 100,
      preferencesScore: preferencesScore * 100
    }
  };
}

/**
 * Analyze additional notes from two users to determine compatibility
 * Returns a score between -10 and +10 and an explanation
 *  -10: Completely incompatible lifestyles
 *   0: Neutral
 *  +10: Highly compatible lifestyles
 */
async function analyzeAdditionalNotes(notes1: string, notes2: string): Promise<{score: number; explanation: string}> {
  // Skip if either user doesn't have additional notes
  if (!notes1 || !notes2 || notes1.trim() === '' || notes2.trim() === '') {
    return { 
      score: 0, 
      explanation: "One or both users didn't provide additional notes." 
    }; // Neutral if no notes to compare
  }
  
  try {
    // Always use the OpenAI API for compatibility analysis
    const prompt = `
You are an AI roommate compatibility analyzer.
You'll be given the "Additional Notes" sections of two potential roommates.
They have already passed the hard constraints, so these individuals are already vaguely compatable.
In the Additional Notes section, users provided whatever additional information they felt would be necessary to mention.
See the notes for both roommates below:

Roommate 1: "${notes1}"

Roommate 2: "${notes2}"

Analyze how compatible these potential roommates would be based on their descriptions. 
Consider factors like: sleep schedules, cleanliness, noise levels, social preferences, lifestyle habits, and any potential conflicts or complementary traits.
As an example
Roommate 1: "I love listening to music on my record player, so it may get a little loud sometimes."
Roommate 2; "I have sensitive ears and find it hard to sleep/focus when there is loud music."
Because these two statements are contradictory, they are pretty incompatible, so you should return a score of around -10.

First, provide a compatibility score between -10 and +10, where:
-10: Extremely incompatible lifestyles with serious conflicts
-5: Significant lifestyle conflicts
0: Neutral or balanced compatibility
+5: Good compatibility with complementary traits
+10: Exceptionally compatible lifestyles

Then, provide a brief explanation (1-3 sentences maximum) of the key factors that influenced your score.

Format your response exactly like this:
SCORE: [your numerical score]
EXPLANATION: [your brief explanation]
`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      max_tokens: 150,
    });

    // Extract the score and explanation from the response
    const content = response.choices[0].message.content?.trim() || "";
    
    // Parse the response to extract score and explanation
    let score = 0;
    let explanation = "";
    
    const scoreMatch = content.match(/SCORE:\s*(-?\d+(\.\d+)?)/i);
    if (scoreMatch) {
      score = parseFloat(scoreMatch[1]);
    }
    
    const explanationMatch = content.match(/EXPLANATION:\s*(.*?)(\n|$)/i);
    if (explanationMatch) {
      explanation = explanationMatch[1].trim();
    }
    
    // Ensure returned value is within expected range
    if (isNaN(score)) {
      console.warn("LLM returned non-numeric value for compatibility score:", content);
      score = 0;
      explanation = "Could not parse a valid numerical score from LLM response.";
    }
    
    // Ensure the score is between -10 and 10
    return {
      score: Math.max(-10, Math.min(10, score)),
      explanation: explanation || "No explanation provided by LLM."
    };
  } catch (error) {
    console.error('Error analyzing additional notes with LLM:', error);
    return { 
      score: 0, 
      explanation: "Error occurred during LLM compatibility analysis. Please try again later." 
    };
  }
}

/**
 * Enhanced version of calculateCompatibilityScore that includes LLM analysis of additional notes
 * This version:
 * 1. First calculates a base compatibility score without additional notes
 * 2. Only proceeds with additional notes analysis if the base score meets a minimum threshold
 * 3. Adjusts the final score by +/-10% maximum based on additional notes analysis
 * 4. Returns null if the adjusted score falls below the minimum threshold
 * 5. Ensures the final score never exceeds 110% (100% base + 10% max adjustment)
 * 
 * When USE_LLM is true, uses OpenAI's GPT model to analyze additional notes.
 * When USE_LLM is false or API call fails, falls back to a heuristic approach.
 */
export async function calculateEnhancedCompatibilityScore(
  user: SurveyFormData, 
  potentialMatch: SurveyFormData,
  minCompatibilityThreshold?: number
): Promise<CompatibilityScore | null> {
  // First get the base compatibility score using structured data only
  const baseScore = calculateCompatibilityScore(user, potentialMatch);
  
  // For test users, use the provided threshold if any, otherwise default to 50
  // For production users, always use 50
  const isTestUser = (user.userEmail?.includes('test') || potentialMatch.userEmail?.includes('test')) ?? false;
  
  // If minCompatibilityThreshold is explicitly provided (especially from testing endpoints),
  // use it regardless of whether the user is detected as a test user
  const effectiveThreshold = minCompatibilityThreshold !== undefined 
    ? minCompatibilityThreshold 
    : 50;
  
  // If no base match or below minimum threshold, return null immediately
  if (!baseScore || baseScore.score < effectiveThreshold) return null;
  
  // Analyze additional notes to get a compatibility adjustment
  const additionalInfoAdjustment = await analyzeAdditionalNotes(
    user.additionalNotes,
    potentialMatch.additionalNotes
  );
  
  // Calculate score adjustment as a percentage (up to +/-10%)
  // Convert -10 to +10 scale to a factor between -0.1 and +0.1
  const adjustmentFactor = additionalInfoAdjustment.score / 100;
  
  // Apply the adjustment to the base score
  // Use the percentage adjustment directly, not as a multiplier
  let adjustedScore = baseScore.score + adjustmentFactor * 100;
  
  // Ensure the score is between 0 and 110% maximum
  adjustedScore = Math.max(0, Math.min(110, adjustedScore));
  
  // Check against threshold after adjustment
  if (adjustedScore < effectiveThreshold) return null;
  
  // Convert the -10 to +10 score to a 0-100 scale for details display
  const additionalInfoScore = (additionalInfoAdjustment.score + 10) * 5;
  
  // Create a new score object with adjusted values
  const enhancedScore: CompatibilityScore = {
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
  
  return enhancedScore;
}

/**
 * Get recommended matches for a user with scores
 */
export async function getRecommendedMatches(
  userEmail: string,
  testMinCompatibilityScore?: number,
  useEnhancedScoring: boolean = true
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
    const isTestUser = !userDoc;
    if (isTestUser) {
      userDoc = await db.collection('test_surveys').findOne({ userEmail });
    }
    
    if (!userDoc) throw new Error('User survey not found');
    
    // Convert to SurveyFormData
    const user = documentToSurveyData(userDoc);
    
    // Determine collection to search based on where user was found
    const collectionName = isTestUser ? 'test_surveys' : 'surveys';
    
    // Get all submitted surveys except the current user
    const potentialMatchDocs = await db.collection(collectionName)
      .find({ 
        userEmail: { $ne: userEmail },
        isSubmitted: true
      })
      .toArray();
    
    // Calculate compatibility scores
    let compatibilityScores: CompatibilityScore[] = [];
    
    // Process each potential match
    for (const matchDoc of potentialMatchDocs) {
      const match = documentToSurveyData(matchDoc);
      
      let score;
      if (useEnhancedScoring) {
        // For test users, pass the adjustable threshold if provided
        score = await calculateEnhancedCompatibilityScore(
          user, 
          match, 
          testMinCompatibilityScore
        );
      } else {
        score = calculateCompatibilityScore(user, match);
        
        // Use provided threshold if any, otherwise default to 50
        const effectiveThreshold = testMinCompatibilityScore !== undefined
          ? testMinCompatibilityScore
          : 50;
          
        if (score && score.score < effectiveThreshold) {
          score = null;
        }
      }
      
      if (score !== null) {
        compatibilityScores.push(score);
      }
    }
    
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
  limit: number = 10,
  useEnhancedScoring: boolean = true,
  testMinCompatibilityScore?: number
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
    const isTestUser = !userDoc;
    if (isTestUser) {
      userDoc = await db.collection('test_surveys').findOne({ userEmail });
    }
    
    if (!userDoc) throw new Error('User survey not found');
    
    // Convert to SurveyFormData
    const user = documentToSurveyData(userDoc);
    
    // Determine collection to search based on where user was found
    const collectionName = isTestUser ? 'test_surveys' : 'surveys';
    
    // Get all submitted surveys in the specified region except the current user
    const potentialMatchDocs = await db.collection(collectionName)
      .find({ 
        userEmail: { $ne: userEmail },
        isSubmitted: true,
        housingRegion: region
      })
      .toArray();
    
    // Calculate compatibility scores
    let compatibilityScores: CompatibilityScore[] = [];
    
    // Process each potential match
    for (const matchDoc of potentialMatchDocs) {
      const match = documentToSurveyData(matchDoc);
      
      let score;
      if (useEnhancedScoring) {
        // For test users, pass the adjustable threshold if provided
        score = await calculateEnhancedCompatibilityScore(
          user, 
          match, 
          testMinCompatibilityScore
        );
      } else {
        score = calculateCompatibilityScore(user, match);
        
        // Use provided threshold if any, otherwise default to 50
        const effectiveThreshold = testMinCompatibilityScore !== undefined
          ? testMinCompatibilityScore
          : 50;
          
        if (score && score.score < effectiveThreshold) {
          score = null;
        }
      }
      
      if (score !== null) {
        compatibilityScores.push(score);
      }
    }
    
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
  userEmail2: string,
  useEnhancedScoring: boolean = true,
  testMinCompatibilityScore?: number
): Promise<{
  user1: SurveyFormData,
  user2: SurveyFormData,
  compatibilityScore: CompatibilityScore | null,
  passesHardConstraints: boolean,
  constraintDetails: {
    genderCompatible: boolean,
    regionMatch: boolean,
    timingOverlap: boolean,
    timingOverlapPercentage: number,
    budgetCompatible: boolean,
    roommatesCompatible: boolean,
    preferencesCompatible: boolean
  }
}> {
  try {
    const client = (await import('@/lib/mongodb')).default;
    const mongodb = await client;
    const db = mongodb.db('taketwo');
    
    // Determine if this is a test user
    const isTestUser1 = !await db.collection('surveys').findOne({ userEmail: userEmail1 });
    const isTestUser2 = !await db.collection('surveys').findOne({ userEmail: userEmail2 });
    const isTestUser = isTestUser1 || isTestUser2;
    
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
    
    // Calculate constraint details separately
    const genderCompatible = user1.gender === user2.gender || 
      (user1.roomWithDifferentGender && user2.roomWithDifferentGender);
    
    const regionMatch = user1.housingRegion === user2.housingRegion;
    
    // Calculate timing overlap
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
    
    // Check for preference deal breakers
    let preferencesCompatible = true;
    for (const pref1 of user1.preferences) {
      const pref2 = user2.preferences.find(p => p.item === pref1.item);
      if (pref2 && ((pref1.strength === 'must have' && pref2.strength === 'deal breaker') ||
                   (pref1.strength === 'deal breaker' && pref2.strength === 'must have'))) {
        preferencesCompatible = false;
        break;
      }
    }
    
    // Calculate overall constraints check
    const passesHardConstraints = genderCompatible && regionMatch && timingOverlap && 
                                 budgetCompatible && roommatesCompatible && preferencesCompatible;
    
    // Calculate compatibility score
    let score;
    if (useEnhancedScoring) {
      // Pass the adjustable threshold if provided
      score = await calculateEnhancedCompatibilityScore(
        user1, 
        user2, 
        testMinCompatibilityScore
      );
    } else {
      score = calculateCompatibilityScore(user1, user2);
      
      // Use provided threshold if any, otherwise default to 50
      const effectiveThreshold = testMinCompatibilityScore !== undefined
        ? testMinCompatibilityScore
        : 50;
        
      if (score && score.score < effectiveThreshold) {
        score = null;
      }
    }
    
    return {
      user1,
      user2,
      compatibilityScore: score,
      passesHardConstraints,
      constraintDetails: {
        genderCompatible,
        regionMatch,
        timingOverlap,
        timingOverlapPercentage: Math.round(timingOverlapPercentage * 100),
        budgetCompatible,
        roommatesCompatible,
        preferencesCompatible
      }
    };
  } catch (error) {
    console.error('Error comparing users:', error);
    throw new Error(`Failed to compare users: ${(error as Error).message}`);
  }
} 