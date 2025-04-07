import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import clientPromise from '@/lib/mongodb';

// Only for development
const ENABLE_TEST_ENDPOINT = process.env.NODE_ENV !== 'production';

export async function DELETE() {
  if (!ENABLE_TEST_ENDPOINT) {
    return NextResponse.json({ error: 'Test endpoints disabled in production' }, { status: 403 });
  }
  
  try {
    console.log("Starting delete-test-users process");
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      console.log("Unauthorized attempt to delete test users");
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const client = await clientPromise;
    const db = client.db('monkeyhouse');
    console.log("Connected to database:", db.databaseName);
    
    // Delete all test users from test_surveys collection
    const surveysDeleteResult = await db.collection('test_surveys').deleteMany({});
    console.log(`Deleted ${surveysDeleteResult.deletedCount} test surveys`);
    
    return NextResponse.json({
      success: true,
      message: 'Successfully deleted all test users',
      deletedCounts: {
        surveys: surveysDeleteResult.deletedCount
      }
    });
  } catch (error) {
    console.error('Error deleting test users:', error);
    return NextResponse.json({
      error: 'Failed to delete test users',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 