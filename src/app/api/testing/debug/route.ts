import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { 
  db, 
  collection, 
  getDocs, 
  query, 
  limit 
} from '@/lib/firebase';

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
    
    // Define collection references
    const testSurveysCollection = collection(db, 'test_surveys');
    
    // Get database connection status
    const dbStatus = {
      connected: !!db,
      dbName: 'firestore'
    };
    
    // Define known collections
    const collectionsToCheck = [
      'surveys',
      'test_surveys',
      'users',
      'conversations',
      'messages',
      'reports',
      'blocks',
      'banned_users'
    ];
    
    // Check collections
    const collectionStatus = {};
    const collectionCounts = {};
    
    for (const colName of collectionsToCheck) {
      try {
        const colRef = collection(db, colName);
        const querySnapshot = await getDocs(query(colRef, limit(1)));
        collectionStatus[colName] = true;
        
        // Get full count for test_surveys
        if (colName === 'test_surveys') {
          const countSnapshot = await getDocs(colRef);
          collectionCounts[colName] = countSnapshot.size;
        }
      } catch (error) {
        console.error(`Error checking collection ${colName}:`, error);
        collectionStatus[colName] = false;
        collectionCounts[colName] = 0;
      }
    }
    
    return NextResponse.json({
      success: true,
      debug: {
        dbConnection: dbStatus,
        collections: Object.keys(collectionStatus).filter(name => collectionStatus[name]),
        testSurveys: collectionCounts['test_surveys'] || 0
      }
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Debug check failed',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 