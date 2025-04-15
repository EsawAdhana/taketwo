import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import clientPromise from '@/lib/mongodb';
import { calculateCompatibilityScore, calculateEnhancedCompatibilityScore } from '@/utils/recommendationEngine';
import { WithId, Document } from 'mongodb';
import { SurveyFormData } from '@/constants/survey-constants';
import { ExtendedSurveyData } from '@/types/survey';

// This endpoint is for testing purposes only
// Should be disabled in production
const ENABLE_TEST_ENDPOINT = process.env.NODE_ENV !== 'production';

// Convert MongoDB document to SurveyFormData
function documentToSurveyData(doc: any): ExtendedSurveyData {
  return {
    firstName: doc.firstName || '',
    gender: doc.gender || '',
    roomWithDifferentGender: !!doc.roomWithDifferentGender,
    housingRegion: doc.housingRegion || '',
    housingCities: Array.isArray(doc.housingCities) ? doc.housingCities : [],
    internshipCompany: doc.internshipCompany || '',
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
    userEmail: doc.userEmail || doc.email || '',
    name: doc.name || '',
    email: doc.email || doc.userEmail || '',
  };
}

export async function GET(req: NextRequest) {
  // Check if test endpoint is enabled
  if (!ENABLE_TEST_ENDPOINT) {
    return NextResponse.json(
      { error: 'Test endpoints are disabled in production' },
      { status: 403 }
    );
  }
  
  try {
    const session = await getServerSession();
    
    // Only allow authenticated users to access this endpoint
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Get parameters
    const { searchParams } = new URL(req.url);
    const centralUserEmail = searchParams.get('user');
    const minScore = searchParams.get('minScore');
    const useEnhancedScoring = searchParams.get('enhanced') !== 'false'; // Default to true
    
    if (!centralUserEmail) {
      return NextResponse.json(
        { error: 'Missing central user email parameter' },
        { status: 400 }
      );
    }
    
    // Parse minimum score, defaulting to 50
    const minScoreValue = minScore ? parseInt(minScore, 10) : 50;
    if (isNaN(minScoreValue)) {
      return NextResponse.json(
        { error: 'Invalid minScore parameter, must be a number' },
        { status: 400 }
      );
    }
    
    const client = await clientPromise;
    const db = client.db('monkeyhouse');
    
    // Check if test_surveys collection exists
    const collections = await db.listCollections({ name: 'test_surveys' }).toArray();
    if (collections.length === 0) {
      return NextResponse.json(
        { error: 'The test_surveys collection does not exist yet. Please add test users first.' },
        { status: 404 }
      );
    }
    
    // Find the central user
    const userDoc = await db.collection('test_surveys').findOne({ 
      $or: [
        { userEmail: centralUserEmail },
        { email: centralUserEmail }
      ] 
    });
    
    if (!userDoc) {
      return NextResponse.json(
        { error: 'Central user not found' },
        { status: 404 }
      );
    }
    
    // Convert to SurveyFormData
    const userData = documentToSurveyData(userDoc);
    
    // Get all other users
    const otherUserDocs = await db.collection('test_surveys').find({
      $and: [
        { 
          $or: [
            { userEmail: { $ne: centralUserEmail } },
            { email: { $ne: centralUserEmail } }
          ]
        },
        { isSubmitted: true }
      ]
    }).toArray();
    
    // Calculate compatibility with each other user
    const compatibilityResults = [];
    
    // Process each potential match
    for (const otherUserDoc of otherUserDocs) {
      const otherUser = documentToSurveyData(otherUserDoc);
      
      let score;
      if (useEnhancedScoring) {
        // Pass the minimum score threshold to the enhanced scoring function
        score = await calculateEnhancedCompatibilityScore(userData, otherUser, minScoreValue);
      } else {
        score = calculateCompatibilityScore(userData, otherUser);
        // Filter by threshold for basic scoring
        if (score && score.score < minScoreValue) {
          score = null;
        }
      }
      
      // Only include matches that meet the threshold (after potential adjustment)
      if (score !== null) {
        compatibilityResults.push({
          user: {
            email: otherUser.userEmail!,
            name: otherUserDoc.name || otherUser.userEmail!,
            surveyData: otherUser
          },
          score: score.score,
          details: score.compatibilityDetails,
          explanation: score.explanations?.additionalNotesExplanation || 'No explanation available'
        });
      }
    }
    
    // Sort by score (highest first)
    compatibilityResults.sort((a, b) => b.score - a.score);
    
    // Map to include the full user data for the client
    const userDataMap = new Map();
    for (const result of compatibilityResults) {
      userDataMap.set(result.user.email, result.user);
    }

    return NextResponse.json({
      centralUser: {
        email: userData.userEmail,
        name: userData.name || userData.userEmail,
        surveyData: userData
      },
      compatibleUsers: compatibilityResults,
      totalUsersChecked: otherUserDocs.length,
      compatibleUsersCount: compatibilityResults.length,
      enhancedScoring: useEnhancedScoring,
      explanation: 'This is the explanation for the user compatibility calculation'
    });
    
  } catch (error) {
    console.error('Error calculating user compatibility:', error);
    return NextResponse.json(
      { 
        error: 'Failed to calculate user compatibility',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 