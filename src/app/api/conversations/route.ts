import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { 
  getConversationsByUser, 
  createConversation, 
  getUser 
} from '@/lib/firebaseService';

export async function GET(req: Request) {
  try {
    const session = await getServerSession();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.user.email) {
      return NextResponse.json({ error: 'User email not found' }, { status: 400 });
    }

    const userEmail = session.user.email;
    
    // Get conversations for the current user using Firebase
    const conversations = await getConversationsByUser(userEmail);

    // Transform the conversations to include other participants' info
    const transformedConversations = conversations.map(conv => {
      const participants = Array.isArray(conv.participants) 
        ? conv.participants.map((p: any) => typeof p === 'string' ? p : p)
        : [];
        
      const otherParticipants = participants.filter(
        (p: any) => p !== userEmail && p._id !== userEmail
      );
      
      return {
        _id: conv._id,
        participants: conv.participants,
        otherParticipants,
        lastMessage: conv.lastMessage,
        isGroup: conv.isGroup,
        name: conv.name || (otherParticipants[0]?.name || 'Unknown User'),
        updatedAt: conv.updatedAt
      };
    });

    return NextResponse.json({ success: true, data: transformedConversations });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.user.email) {
      return NextResponse.json({ error: 'User email not found' }, { status: 400 });
    }

    const { participants, isGroup, name } = await req.json();

    if (!participants || !Array.isArray(participants)) {
      return NextResponse.json({ error: 'Participants array is required' }, { status: 400 });
    }

    const userEmail = session.user.email;
    
    // Ensure the current user is included in participants
    let allParticipants = [...participants];
    if (!allParticipants.includes(userEmail)) {
      allParticipants.push(userEmail);
    }
    
    // Deduplicate participants
    allParticipants = Array.from(new Set(allParticipants));
    
    // For direct messages, check if it's just 2 participants and not a group
    const isDirectMessage = !isGroup && allParticipants.length === 2;
    
    // Create new conversation with validated participants
    const conversation = await createConversation({
      participants: allParticipants,
      isGroup: isGroup || false,
      name: name || null
    });

    return NextResponse.json({ success: true, data: conversation });
  } catch (error: unknown) {
    console.error('Error creating conversation:', error);
    
    // Provide more detailed error information
    if (error && typeof error === 'object' && 'name' in error) {
      return NextResponse.json({ 
        error: 'Validation Error', 
        details: error 
      }, { status: 400 });
    }
    
    return NextResponse.json({ 
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
} 