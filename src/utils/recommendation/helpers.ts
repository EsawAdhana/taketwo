import { SurveyFormData } from '@/constants/survey-constants';
import {
  db,
  surveysCollection,
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc
} from '@/lib/firebase';

// Reference to test_surveys collection
export const testSurveysCollection = collection(db, 'test_surveys');
export const blocksCollection = collection(db, 'blocks');

/**
 * Convert Firestore document to SurveyFormData
 */
export function documentToSurveyData(doc: any): SurveyFormData {
  // Extract the data from Firestore document
  const data = doc.data ? doc.data() : doc;
  
  return {
    firstName: data.firstName || '',
    gender: data.gender || '',
    roomWithDifferentGender: !!data.roomWithDifferentGender,
    housingRegion: data.housingRegion || '',
    housingCities: Array.isArray(data.housingCities) ? data.housingCities : [],
    internshipStartDate: data.internshipStartDate || '',
    internshipEndDate: data.internshipEndDate || '',
    desiredRoommates: data.desiredRoommates || '1',
    minBudget: typeof data.minBudget === 'number' ? data.minBudget : 1000,
    maxBudget: typeof data.maxBudget === 'number' ? data.maxBudget : 1500,
    preferences: Array.isArray(data.preferences) ? data.preferences : [],
    additionalNotes: data.additionalNotes || '',
    currentPage: typeof data.currentPage === 'number' ? data.currentPage : 1,
    isDraft: !!data.isDraft,
    isSubmitted: !!data.isSubmitted,
    userEmail: data.userEmail || '',
    internshipCompany: data.internshipCompany || '',
  } as SurveyFormData;
}

/**
 * Check if a user is blocked
 */
export async function isUserBlocked(userEmail: string, currentUserEmail?: string): Promise<boolean> {
  // Check for system-wide blocks first
  const systemBlockQuery = query(
    blocksCollection,
    where('blockedUserEmail', '==', userEmail),
    where('blockedByEmail', '==', 'system'),
    where('active', '==', true),
    where('isSystemBlock', '==', true)
  );
  
  const systemBlockSnapshot = await getDocs(systemBlockQuery);
  
  if (!systemBlockSnapshot.empty) {
    return true;
  }
  
  // If checking for a specific user interaction, check individual blocks
  if (currentUserEmail) {
    const individualBlockQuery = query(
      blocksCollection,
      where('blockedUserEmail', '==', userEmail),
      where('blockedByEmail', '==', currentUserEmail),
      where('active', '==', true)
    );
    
    const individualBlockSnapshot = await getDocs(individualBlockQuery);
    
    if (!individualBlockSnapshot.empty) {
      return true;
    }
  }
  
  return false;
}

/**
 * Get a user's survey data from either regular or test collection
 */
export async function getUserSurveyData(userEmail: string): Promise<{
  userData: SurveyFormData;
  isTestUser: boolean;
}> {
  // Try regular surveys first
  const userSurveyDoc = await getDoc(doc(surveysCollection, userEmail));
  
  if (userSurveyDoc.exists()) {
    return {
      userData: documentToSurveyData(userSurveyDoc),
      isTestUser: false
    };
  }
  
  // Try test surveys next
  const testUserSurveyDoc = await getDoc(doc(testSurveysCollection, userEmail));
  
  if (testUserSurveyDoc.exists()) {
    return {
      userData: documentToSurveyData(testUserSurveyDoc),
      isTestUser: true
    };
  }
  
  throw new Error(`User survey not found for email: ${userEmail}`);
} 