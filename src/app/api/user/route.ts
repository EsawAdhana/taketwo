import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { 
  db, 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  deleteDoc,
  usersCollection,
  surveysCollection,
  conversationsCollection,
  messagesCollection
} from '@/lib/firebase';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get email from query parameters
    const url = new URL(req.url);
    const email = url.searchParams.get('email');
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required' },
        { status: 400 }
      );
    }

    // Find the user's survey data
    const surveyDoc = await getDoc(doc(surveysCollection, email));

    if (!surveyDoc.exists()) {
      return NextResponse.json(
        { error: 'No survey data found for this user' },
        { status: 404 }
      );
    }

    // Get basic user profile from users collection
    const userDoc = await getDoc(doc(usersCollection, email));
    
    if (!userDoc.exists()) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    const userData = userDoc.data();
    const userProfile = {
      email: userData.email,
      name: userData.name || '',
      image: userData.image || ''
    };

    return NextResponse.json({
      surveyData: {
        id: surveyDoc.id,
        ...surveyDoc.data()
      },
      userProfile
    });
  } catch (error) {
    console.error('Error fetching user data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user data' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userEmail = session.user.email;
    
    // First, check if the user exists
    const userDoc = await getDoc(doc(usersCollection, userEmail));
    
    // Track deletion statistics
    let surveyDeleted = false;
    let userDeleted = false;
    let messagesDeleted = 0;
    let conversationsDeleted = 0;
    
    // 1. Delete the user's survey data
    const surveyDoc = await getDoc(doc(surveysCollection, userEmail));
    if (surveyDoc.exists()) {
      await deleteDoc(doc(surveysCollection, userEmail));
      surveyDeleted = true;
    }

    // 2. Delete any messages or conversations the user is part of
    if (userDoc.exists()) {
      // Find conversations the user is part of
      const conversationsQuery = query(
        conversationsCollection,
        where('participants', 'array-contains', userEmail)
      );
      
      const conversationsSnapshot = await getDocs(conversationsQuery);
      
      if (!conversationsSnapshot.empty) {
        const conversationIds = conversationsSnapshot.docs.map(doc => doc.id);
        
        // Delete all messages from these conversations
        for (const conversationId of conversationIds) {
          const messagesQuery = query(
            messagesCollection,
            where('conversationId', '==', conversationId)
          );
          
          const messagesSnapshot = await getDocs(messagesQuery);
          
          for (const messageDoc of messagesSnapshot.docs) {
            await deleteDoc(doc(messagesCollection, messageDoc.id));
            messagesDeleted++;
          }
          
          // Delete the conversation
          await deleteDoc(doc(conversationsCollection, conversationId));
          conversationsDeleted++;
        }
      }
      
      // 3. Finally delete the user from the users collection
      await deleteDoc(doc(usersCollection, userEmail));
      userDeleted = true;
    }

    if (!surveyDeleted && !userDeleted) {
      return NextResponse.json(
        { error: 'No user data found to delete' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'User data deleted successfully',
      details: {
        surveyDeleted,
        userDeleted,
        messagesDeleted,
        conversationsDeleted
      }
    }, { status: 200 });
  } catch (error) {
    console.error('Error deleting user data:', error);
    return NextResponse.json(
      { error: 'Failed to delete user data' },
      { status: 500 }
    );
  }
} 