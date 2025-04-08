import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import clientPromise from '@/lib/mongodb';

// Only for development
const ENABLE_TEST_ENDPOINT = process.env.NODE_ENV !== 'production';

export async function GET() {
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
    
    const client = await clientPromise;
    const db = client.db('monkeyhouse');
    
    // Get all test users
    const users = await db.collection('test_surveys').find({}).toArray();
    
    // Format the users for the frontend
    const formattedUsers = users.map(user => ({
      name: user.name || 'Unknown',
      email: user.userEmail,
      region: user.housingRegion,
      gender: user.gender,
      city: Array.isArray(user.housingCities) && user.housingCities.length > 0 
        ? user.housingCities[0] 
        : 'Unknown'
    }));
    
    return NextResponse.json({
      success: true,
      users: formattedUsers
    });
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to fetch test users',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 