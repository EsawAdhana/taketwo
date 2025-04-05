import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import clientPromise from '@/lib/mongodb';
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
    
    if (!userEmail) {
      return NextResponse.json(
        { error: 'Missing required parameter: userEmail' },
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
    
    // Get user survey data
    const userDoc = await db.collection('test_surveys').findOne({ userEmail });
    
    if (!userDoc) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Convert to SurveyFormData
    const userData = documentToSurveyData(userDoc);
    
    return NextResponse.json({
      user: {
        email: userData.userEmail,
        name: userData.name || userData.userEmail,
        surveyData: userData
      }
    });
    
  } catch (error) {
    console.error('Error getting test user:', error);
    return NextResponse.json(
      { error: 'Failed to get test user' },
      { status: 500 }
    );
  }
} 