import { NextRequest, NextResponse } from 'next/server';
import { 
  db, 
  collection, 
  query, 
  where, 
  getDocs 
} from '@/lib/firebase';

// Define our Firestore collection reference
const bannedUsersCollection = collection(db, 'banned_users');

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'Missing email parameter' },
        { status: 400 }
      );
    }

    // Query Firestore for banned users
    const bannedQuery = query(
      bannedUsersCollection,
      where('userEmail', '==', email),
      where('permanent', '==', true)
    );
    
    const bannedSnapshot = await getDocs(bannedQuery);
    const bannedUser = !bannedSnapshot.empty ? bannedSnapshot.docs[0].data() : null;

    return NextResponse.json({
      isBanned: !!bannedUser,
      banInfo: bannedUser ? {
        reason: bannedUser.reason,
        bannedAt: bannedUser.bannedAt
      } : null
    });
  } catch (error) {
    console.error('Error checking banned status:', error);
    return NextResponse.json(
      { error: 'Failed to check banned status' },
      { status: 500 }
    );
  }
} 