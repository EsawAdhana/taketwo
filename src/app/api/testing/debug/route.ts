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
    const db = client.db('monkeyhouse');
    
    // Get database connection status
    const dbStatus = {
      connected: !!db,
      dbName: db?.databaseName || null
    };
    
    // Get all collections
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    // Get test survey count
    const testSurveys = await db.collection('test_surveys').countDocuments();
    
    return NextResponse.json({
      success: true,
      debug: {
        dbConnection: dbStatus,
        collections: collectionNames,
        testSurveys
      }
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Debug check failed',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 