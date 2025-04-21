import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { usersCollection, doc, getDoc } from '@/lib/firebase';

export async function GET(req: Request) {
  try {
    const session = await getServerSession();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized', success: false }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required', success: false }, { status: 400 });
    }

    // In Firebase, the document ID is typically the email or a custom ID
    // Get the user document from Firestore
    const userDoc = await getDoc(doc(usersCollection, userId));

    if (!userDoc.exists()) {
      return NextResponse.json({ error: 'User not found', success: false }, { status: 404 });
    }

    const userData = userDoc.data();

    return NextResponse.json({ 
      success: true, 
      email: userData.email
    });
  } catch (error) {
    console.error('Error retrieving user email:', error);
    return NextResponse.json({ error: 'Internal Server Error', success: false }, { status: 500 });
  }
} 