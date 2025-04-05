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
    const user1Email = url.searchParams.get('user1');
    const user2Email = url.searchParams.get('user2');
    
    if (!user1Email || !user2Email) {
      return NextResponse.json(
        { error: 'Missing required parameters: user1 and user2' },
        { status: 400 }
      );
    }
    
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
    
    // Get user survey data from test_surveys collection
    const user1Doc = await db.collection('test_surveys').findOne({ userEmail: user1Email });
    const user2Doc = await db.collection('test_surveys').findOne({ userEmail: user2Email });
    
    if (!user1Doc || !user2Doc) {
      return NextResponse.json(
        { error: 'One or both users not found' },
        { status: 404 }
      );
    }
    
    // Convert to SurveyFormData
    const user1 = documentToSurveyData(user1Doc);
    const user2 = documentToSurveyData(user2Doc);
    
    // Calculate compatibility score in both directions
    const score1to2 = calculateCompatibilityScore(user1, user2);
    const score2to1 = calculateCompatibilityScore(user2, user1);
    
    // If both scores are null, these users are incompatible
    if (!score1to2 && !score2to1) {
      return NextResponse.json({
        score: null,
        message: 'These users are incompatible due to hard constraints',
      });
    }
    
    // Use the score that's available, or average them if both are
    const finalScore = score1to2 && score2to1 
      ? (score1to2.score + score2to1.score) / 2
      : (score1to2 ? score1to2.score : score2to1!.score);
    
    // Merge details if both scores exist
    const details = score1to2 && score2to1
      ? {
          locationScore: (score1to2.compatibilityDetails.locationScore + score2to1.compatibilityDetails.locationScore) / 2,
          budgetScore: (score1to2.compatibilityDetails.budgetScore + score2to1.compatibilityDetails.budgetScore) / 2,
          genderScore: (score1to2.compatibilityDetails.genderScore + score2to1.compatibilityDetails.genderScore) / 2,
          timingScore: (score1to2.compatibilityDetails.timingScore + score2to1.compatibilityDetails.timingScore) / 2,
          roommateScore: (score1to2.compatibilityDetails.roommateScore + score2to1.compatibilityDetails.roommateScore) / 2,
          preferencesScore: (score1to2.compatibilityDetails.preferencesScore + score2to1.compatibilityDetails.preferencesScore) / 2,
        }
      : (score1to2 ? score1to2.compatibilityDetails : score2to1!.compatibilityDetails);
    
    return NextResponse.json({
      score: finalScore,
      details: details,
      direction: score1to2 && score2to1 ? 'both' : (score1to2 ? '1to2' : '2to1'),
    });
  } catch (error) {
    console.error('Error calculating compatibility score:', error);
    return NextResponse.json(
      { error: 'Failed to calculate compatibility score' },
      { status: 500 }
    );
  }
} 