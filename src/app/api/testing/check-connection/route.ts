import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

// Only for development
const ENABLE_TEST_ENDPOINT = process.env.NODE_ENV !== 'production';

export async function GET() {
  if (!ENABLE_TEST_ENDPOINT) {
    return NextResponse.json({ error: 'Test endpoints disabled in production' }, { status: 403 });
  }
  
  try {
    // Simple connection test - avoid complex queries
    const client = await clientPromise;
    // MongoDB client topology property is internal and may not be typed correctly
    // Use type assertion and optional chaining to safely access it
    const isConnected = !!client && !!(client as any).topology?.isConnected?.();
    const dbName = client.db().databaseName;
    
    // Get basic stats - just the list of collections
    const collections = await client.db().listCollections().toArray();
    const collectionNames = collections.map(col => col.name);
    
    // Get count of documents in each collection, but check if collections exist first
    let surveysCount = 0;
    let testSurveysCount = 0;
    
    if (collectionNames.includes('surveys')) {
      surveysCount = await client.db().collection('surveys').countDocuments();
    }
    
    if (collectionNames.includes('test_surveys')) {
      testSurveysCount = await client.db().collection('test_surveys').countDocuments();
    }
    
    return NextResponse.json({
      success: true,
      connection: {
        connected: isConnected,
        dbName,
        // serverInfo is also an internal property, use type assertion
        serverInfo: (client as any).serverInfo || { version: 'unknown' },
        collectionCount: collectionNames.length
      },
      collectionNames,
      counts: {
        surveys: surveysCount,
        test_surveys: testSurveysCount
      }
    });
  } catch (error) {
    console.error('Error checking connection:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to check database connection',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 