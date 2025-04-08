import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import clientPromise from '@/lib/mongodb';

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
    
    // Delete all test surveys
    const surveysDeleteResult = await db.collection('test_surveys').deleteMany({});
    
    return NextResponse.json({
      success: true,
      message: `Deleted test users`,
      counts: {
        surveys: surveysDeleteResult.deletedCount
      }
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