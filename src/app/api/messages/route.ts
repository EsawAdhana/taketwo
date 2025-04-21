import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { 
  getMessagesByConversation, 
  createMessage,
  getConversation 
} from '@/lib/firebaseService';

export async function GET(req: Request) {
  try {
    const session = await getServerSession();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const conversationId = url.searchParams.get('conversationId');
    
    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 });
    }

    const userEmail = session.user.email;
    
    // Get conversation to check permissions
    const conversation = await getConversation(conversationId);
    
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    
    // Check if user is a participant
    const participants = Array.isArray(conversation.participants) 
      ? conversation.participants.map((p: any) => typeof p === 'string' ? p : p._id || p.email)
      : [];
    
    if (!userEmail || !participants.includes(userEmail)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    
    // Get messages
    const messages = await getMessagesByConversation(conversationId);

    return NextResponse.json({ success: true, data: messages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userEmail = session.user.email;
    
    if (!userEmail) {
      return NextResponse.json({ error: 'User email not found' }, { status: 400 });
    }
    
    const { conversationId, content } = await req.json();
    
    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 });
    }
    
    if (!content || content.trim() === '') {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 });
    }
    
    // Get conversation to check permissions
    const conversation = await getConversation(conversationId);
    
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    
    // Check if user is a participant
    const participants = Array.isArray(conversation.participants) 
      ? conversation.participants.map((p: any) => typeof p === 'string' ? p : p._id || p.email)
      : [];
    
    if (!participants.includes(userEmail)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    
    // Create message
    const message = await createMessage({
      conversationId,
      content,
      senderId: userEmail,
      readBy: [userEmail]
    });

    return NextResponse.json({ success: true, data: message });
  } catch (error) {
    console.error('Error creating message:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 