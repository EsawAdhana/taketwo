import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import clientPromise from '@/lib/mongodb';
import { calculateCompatibilityScore } from '@/utils/recommendationEngine';
import { WithId, Document } from 'mongodb';
import { SurveyFormData } from '@/constants/survey-constants';

// This endpoint is for testing purposes only
// Should be disabled in production
const ENABLE_TEST_ENDPOINT = process.env.NODE_ENV !== 'production';

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
    name: doc.name || '',
    email: doc.email || '',
  } as SurveyFormData;
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
    
    // Get query parameters
    const url = new URL(req.url);
    const userEmail = url.searchParams.get('userEmail');
    const minScore = url.searchParams.get('minScore');
    
    if (!userEmail) {
      return NextResponse.json(
        { error: 'Missing required parameter: userEmail' },
        { status: 400 }
      );
    }
    
    // Convert minScore to number if provided, default to 0
    const minScoreValue = minScore ? parseFloat(minScore) : 0;
    
    const client = await clientPromise;
    const db = client.db('taketwo');
    
    // Check if test_surveys collection exists
    const collections = await db.listCollections({ name: 'test_surveys' }).toArray();
    if (collections.length === 0) {
      return NextResponse.json(
        { error: 'The test_surveys collection does not exist yet. Please add test users first.' },
        { status: 404 }
      );
    }
    
    // Get central user survey data
    const userDoc = await db.collection('test_surveys').findOne({ userEmail });
    
    if (!userDoc) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Convert to SurveyFormData
    const userData = documentToSurveyData(userDoc);
    
    // Get all other test users
    const otherUserDocs = await db.collection('test_surveys').find({ 
      userEmail: { $ne: userEmail },
      isSubmitted: true 
    }).toArray();
    
    // Calculate compatibility with each other user
    const compatibilityResults = otherUserDocs.map(otherUserDoc => {
      const otherUserData = documentToSurveyData(otherUserDoc);
      const score = calculateCompatibilityScore(userData, otherUserData);
      
      if (!score) {
        return null; // Incompatible due to hard constraints
      }
      
      return {
        user: {
          email: otherUserData.userEmail,
          name: otherUserData.name || otherUserData.userEmail,
          surveyData: otherUserData
        },
        score: score.score,
        details: score.compatibilityDetails
      };
    })
    .filter(result => result !== null && result.score >= minScoreValue)
    .sort((a, b) => b!.score - a!.score);
    
    return NextResponse.json({
      centralUser: {
        email: userData.userEmail,
        name: userData.name || userData.userEmail,
        surveyData: userData
      },
      compatibleUsers: compatibilityResults,
      totalUsersChecked: otherUserDocs.length,
      compatibleUsersCount: compatibilityResults.length
    });
    
  } catch (error) {
    console.error('Error calculating user compatibility:', error);
    return NextResponse.json(
      { error: 'Failed to calculate user compatibility' },
      { status: 500 }
    );
  }
} 