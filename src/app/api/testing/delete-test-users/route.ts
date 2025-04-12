import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import clientPromise from '@/lib/mongodb';
import { NextRequest } from 'next/server';

// Only for development
const ENABLE_TEST_ENDPOINT = process.env.NODE_ENV !== 'production';

export async function DELETE(req: NextRequest) {
  // Check if test endpoint is enabled
  if (!ENABLE_TEST_ENDPOINT) {
    return NextResponse.json(
      { error: 'Test endpoints are disabled in production' },
      { status: 403 }
    );
  }
  
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const client = await clientPromise;
    const db = client.db('monkeyhouse');
    
    // Get all test users before deletion to properly clean up references
    const testUsers = await db.collection('test_surveys').find({}).toArray();
    const testUserEmails = testUsers.map(user => user.userEmail);
    
    // Delete all test surveys
    const surveysDeleteResult = await db.collection('test_surveys').deleteMany({});
    
    // Track deletion counts for each collection
    const deletionCounts = {
      surveys: surveysDeleteResult.deletedCount,
      users: 0,
      conversations: 0,
      messages: 0
    };
    
    // If there were test users, clean up related collections
    if (testUserEmails.length > 0) {
      // Clean up any test users from the main users collection if they exist
      const usersDeleteResult = await db.collection('users').deleteMany({
        email: { $in: testUserEmails }
      });
      deletionCounts.users = usersDeleteResult.deletedCount;
    }
    
    return NextResponse.json({
      success: true,
      message: `Deleted test users`,
      deletedCounts: deletionCounts
    });
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to delete test users',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 