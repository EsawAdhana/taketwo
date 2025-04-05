import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import clientPromise from '@/lib/mongodb';

// Only for development
const ENABLE_DEBUG = process.env.NODE_ENV !== 'production';

export async function GET() {
  if (!ENABLE_DEBUG) {
    return NextResponse.json({ error: 'Debug endpoints disabled in production' }, { status: 403 });
  }
  
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const client = await clientPromise;
    const db = client.db('taketwo');
    
    // Check if MongoDB connection is working
    const dbStatus = {
      connected: !!client && !!db,
      dbName: db ? db.databaseName : null
    };
    
    console.log('Database connection status:', dbStatus);
    
    // Get all collections for diagnostics
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    console.log('Available collections:', collectionNames);
    
    // Count test surveys in test_surveys collection, but first check if it exists
    let testSurveys = 0;
    if (collectionNames.includes('test_surveys')) {
      testSurveys = await db.collection('test_surveys').countDocuments();
    }
    
    console.log(`Found ${testSurveys} test surveys in test_surveys collection`);
    
    return NextResponse.json({
      success: true,
      dbStatus,
      collections: collectionNames,
      surveyCount: testSurveys
    });
  } catch (error) {
    console.error('Error fetching debug data:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch debug data',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 