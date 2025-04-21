import { NextResponse } from 'next/server';
import { 
  db, 
  collection, 
  getDocs,
  query, 
  limit 
} from '@/lib/firebase';

// Only for development
const ENABLE_TEST_ENDPOINT = process.env.NODE_ENV !== 'production';

export async function GET() {
  if (!ENABLE_TEST_ENDPOINT) {
    return NextResponse.json({ error: 'Test endpoints disabled in production' }, { status: 403 });
  }
  
  try {
    // Define collection references
    const surveysCollection = collection(db, 'surveys');
    const testSurveysCollection = collection(db, 'test_surveys');
    const usersCollection = collection(db, 'users');
    const conversationsCollection = collection(db, 'conversations');
    const messagesCollection = collection(db, 'messages');
    const reportsCollection = collection(db, 'reports');
    const blocksCollection = collection(db, 'blocks');
    const bannedUsersCollection = collection(db, 'banned_users');
    
    // Check if collections exist by trying to get one document from each
    const collectionsStatus = {};
    const collectionCounts = {};
    
    const collections = [
      { name: 'surveys', ref: surveysCollection },
      { name: 'test_surveys', ref: testSurveysCollection },
      { name: 'users', ref: usersCollection },
      { name: 'conversations', ref: conversationsCollection },
      { name: 'messages', ref: messagesCollection },
      { name: 'reports', ref: reportsCollection },
      { name: 'blocks', ref: blocksCollection },
      { name: 'banned_users', ref: bannedUsersCollection }
    ];
    
    // Check each collection
    for (const col of collections) {
      try {
        const querySnapshot = await getDocs(query(col.ref, limit(1)));
        collectionsStatus[col.name] = true;
        
        // Count documents in each collection
        const countSnapshot = await getDocs(col.ref);
        collectionCounts[col.name] = countSnapshot.size;
      } catch (error) {
        console.error(`Error checking collection ${col.name}:`, error);
        collectionsStatus[col.name] = false;
        collectionCounts[col.name] = 0;
      }
    }
    
    return NextResponse.json({
      success: true,
      connection: {
        connected: true,
        dbName: 'firestore',
        serverInfo: { version: 'Firebase Firestore' },
        collectionCount: Object.keys(collectionsStatus).length
      },
      collectionNames: Object.keys(collectionsStatus).filter(name => collectionsStatus[name]),
      counts: collectionCounts
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