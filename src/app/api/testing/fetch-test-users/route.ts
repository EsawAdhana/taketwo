import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import clientPromise from '@/lib/mongodb';

// Only for development
const ENABLE_TEST_ENDPOINT = process.env.NODE_ENV !== 'production';

export async function GET() {
  if (!ENABLE_TEST_ENDPOINT) {
    return NextResponse.json({ error: 'Test endpoints disabled in production' }, { status: 403 });
  }
  
  try {
    console.log("Starting fetch-test-users process");
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      console.log("Unauthorized attempt to fetch test users");
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const client = await clientPromise;
    const db = client.db('monkeyhouse');
    console.log("Connected to database:", db.databaseName);
    
    // Get test users from test_surveys collection
    const testUsers = await db.collection('test_surveys')
      .find({})
      .project({ _id: 0, name: 1, email: 1, userEmail: 1 })
      .toArray();
    
    // Map the data to ensure compatibility with the UI
    const formattedUsers = testUsers.map(user => ({
      name: user.name,
      email: user.userEmail || user.email
    }));
    
    console.log(`Found ${formattedUsers.length} test users in test_surveys collection`);
    
    return NextResponse.json({
      success: true,
      testUsers: formattedUsers
    });
  } catch (error) {
    console.error('Error fetching test users:', error);
    return NextResponse.json({
      error: 'Failed to fetch test users',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 