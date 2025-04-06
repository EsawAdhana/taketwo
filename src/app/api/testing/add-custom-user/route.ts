import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import clientPromise from '@/lib/mongodb';
import { NON_NEGOTIABLES, Preference, PreferenceStrength } from '@/constants/survey-constants';

// This endpoint is for testing purposes only
// Should be disabled in production
const ENABLE_TEST_ENDPOINT = process.env.NODE_ENV !== 'production';

export async function POST(req: NextRequest) {
  // Check if test endpoint is enabled
  if (!ENABLE_TEST_ENDPOINT) {
    return NextResponse.json(
      { error: 'Test endpoints are disabled in production' },
      { status: 403 }
    );
  }
  
  try {
    console.log("Starting add-custom-user process");
    const session = await getServerSession();
    
    // Only allow authenticated users to access this endpoint
    if (!session?.user?.email) {
      console.log("Unauthorized attempt to add custom test user");
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Parse request body
    const userData = await req.json();
    
    if (!userData || !userData.email || !userData.name) {
      return NextResponse.json(
        { error: 'Invalid user data - name and email are required' },
        { status: 400 }
      );
    }
    
    // Connect to MongoDB
    const client = await clientPromise;
    const db = client.db("taketwo");
    const collection = db.collection("test_surveys");
    
    // Check if a test user with this email already exists
    const existingUser = await collection.findOne({ userEmail: userData.email });
    if (existingUser) {
      return NextResponse.json(
        { error: `A test user with email ${userData.email} already exists` },
        { status: 400 }
      );
    }
    
    // Process preferences
    let preferences: Preference[];
    if (userData.preferences && Array.isArray(userData.preferences)) {
      preferences = userData.preferences;
    } else {
      // Default to all neutral preferences
      preferences = NON_NEGOTIABLES.map(item => ({
        item,
        strength: "neutral" as PreferenceStrength
      }));
    }
    
    // Prepare the user document
    const testUser = {
      name: userData.name,
      userEmail: userData.email,
      gender: userData.gender || 'Male',
      roomWithDifferentGender: userData.roomWithDifferentGender !== undefined 
        ? userData.roomWithDifferentGender 
        : false,
      housingRegion: userData.housingRegion || 'Bay Area',
      housingCities: Array.isArray(userData.housingCities) 
        ? userData.housingCities 
        : ['San Francisco'],
      internshipStartDate: userData.internshipStartDate || new Date().toISOString().split('T')[0],
      internshipEndDate: userData.internshipEndDate || (() => {
        const date = new Date();
        date.setMonth(date.getMonth() + 3);
        return date.toISOString().split('T')[0];
      })(),
      desiredRoommates: userData.desiredRoommates || '2',
      minBudget: userData.minBudget || 1500,
      maxBudget: userData.maxBudget || 2500,
      preferences,
      additionalNotes: userData.additionalNotes || '',
      isSubmitted: true,
      isDraft: false,
      createdAt: new Date(),
      isTestUser: true
    };
    
    // Insert the test user
    await collection.insertOne(testUser);
    
    // Get the count of test users after adding
    const surveyCount = await collection.countDocuments();
    
    return NextResponse.json({
      success: true,
      message: `Custom test user ${userData.name} (${userData.email}) added successfully`,
      verificationCounts: {
        surveys: surveyCount,
      }
    });
    
  } catch (error) {
    console.error("Error adding custom test user:", error);
    return NextResponse.json(
      { error: `Failed to add custom test user: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
} 