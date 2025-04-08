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
    const session = await getServerSession();
    
    // Only allow authenticated users to access this endpoint
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Parse request body for custom user data
    const body = await req.json();
    
    if (!body || !body.email || !body.name) {
      return NextResponse.json(
        { error: 'Invalid user data - name and email are required' },
        { status: 400 }
      );
    }

    // Support for creating multiple identical users
    const numCopies = body.numCopies || 1;
    if (numCopies > 100) {
      return NextResponse.json(
        { error: 'Cannot create more than 100 copies at once' },
        { status: 400 }
      );
    }
    
    // Connect to MongoDB
    const client = await clientPromise;
    const db = client.db("monkeyhouse");
    const collection = db.collection("test_surveys");
    
    // Check if a test user with this email already exists
    const existingUser = await collection.findOne({ userEmail: body.email });
    if (existingUser) {
      return NextResponse.json(
        { error: `A test user with email ${body.email} already exists` },
        { status: 400 }
      );
    }
    
    // Process preferences
    let preferences: Preference[];
    if (body.preferences && Array.isArray(body.preferences)) {
      preferences = body.preferences;
    } else {
      // Default to all neutral preferences
      preferences = NON_NEGOTIABLES.map(item => ({
        item,
        strength: "neutral" as PreferenceStrength
      }));
    }

    const testUsers = [];
    for (let i = 0; i < numCopies; i++) {
      // Generate unique name and email for each copy
      const nameSuffix = numCopies > 1 ? ` ${i + 1}` : '';
      const emailPrefix = body.email.split('@')[0];
      const emailDomain = body.email.split('@')[1];
      const uniqueEmail = numCopies > 1 ? `${emailPrefix}${i + 1}@${emailDomain}` : body.email;

      // Prepare the user document
      const testUser = {
        name: body.name + nameSuffix,
        userEmail: uniqueEmail,
        gender: body.gender || 'Male',
        roomWithDifferentGender: body.roomWithDifferentGender !== undefined 
          ? body.roomWithDifferentGender 
          : false,
        housingRegion: body.housingRegion || 'Bay Area',
        housingCities: Array.isArray(body.housingCities) 
          ? body.housingCities 
          : ['San Francisco'],
        internshipStartDate: body.internshipStartDate || new Date().toISOString().split('T')[0],
        internshipEndDate: body.internshipEndDate || (() => {
          const date = new Date();
          date.setMonth(date.getMonth() + 3);
          return date.toISOString().split('T')[0];
        })(),
        desiredRoommates: body.desiredRoommates || '2',
        minBudget: body.minBudget || 1500,
        maxBudget: body.maxBudget || 2500,
        preferences,
        additionalNotes: body.additionalNotes || '',
        isSubmitted: true,
        isDraft: false,
        createdAt: new Date(),
        isTestUser: true
      };

      testUsers.push(testUser);
    }
    
    // Insert the test users
    if (numCopies > 1) {
      await collection.insertMany(testUsers);
    } else {
      await collection.insertOne(testUsers[0]);
    }
    
    // Get the count of test users after adding
    const surveyCount = await collection.countDocuments();
    
    return NextResponse.json({
      success: true,
      message: `Added ${numCopies} test user${numCopies > 1 ? 's' : ''} based on ${body.name}`,
      verificationCounts: {
        surveys: surveyCount,
      }
    });
    
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to add custom test user',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 