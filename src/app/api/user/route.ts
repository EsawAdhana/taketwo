import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { NextRequest } from 'next/server';

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

    const client = await clientPromise;
    const db = client.db('monkeyhouse');

    // Find the user's survey data
    const surveyData = await db.collection('surveys').findOne({
      userEmail: email
    });

    if (!surveyData) {
      return NextResponse.json(
        { error: 'No survey data found for this user' },
        { status: 404 }
      );
    }

    // Get basic user profile from users collection
    const userProfile = await db.collection('users').findOne(
      { email },
      { projection: { email: 1, name: 1, image: 1 } }
    );

    return NextResponse.json({
      surveyData,
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

    const client = await clientPromise;
    const db = client.db('monkeyhouse');
    
    const userEmail = session.user.email;
    
    // First, find any user data that needs to be cleaned up
    const userProfile = await db.collection('users').findOne({ email: userEmail });
    
    // Delete related data in a specific order to prevent null references
    // 1. Delete the user's survey data
    const surveyResult = await db.collection('surveys').deleteOne({
      userEmail: userEmail
    });

    // 2. Delete any messages or conversations the user is part of
    let messagesDeleted = 0;
    let conversationsDeleted = 0;
    
    if (userProfile && userProfile._id) {
      const userId = userProfile._id.toString();
      
      // Find conversations the user is part of
      const userConversations = await db.collection('conversations').find({
        participants: userId
      }).toArray();
      
      // Delete all messages from these conversations
      if (userConversations.length > 0) {
        const conversationIds = userConversations.map(c => c._id.toString());
        const messagesResult = await db.collection('messages').deleteMany({
          conversationId: { $in: conversationIds }
        });
        messagesDeleted = messagesResult.deletedCount;
        
        // Delete the conversations
        const conversationsResult = await db.collection('conversations').deleteMany({
          participants: userId
        });
        conversationsDeleted = conversationsResult.deletedCount;
      }
    }
    
    // 3. Finally delete the user from the users collection
    const userResult = await db.collection('users').deleteOne({
      email: userEmail
    });

    if (!surveyResult.deletedCount && !userResult.deletedCount) {
      return NextResponse.json(
        { error: 'No user data found to delete' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'User data deleted successfully',
      details: {
        surveyDeleted: surveyResult.deletedCount > 0,
        userDeleted: userResult.deletedCount > 0,
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