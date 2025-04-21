import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import {
  markMessageAsRead,
  getConversation
} from '@/lib/firebaseService';

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userEmail = session.user.email;
    const { messageId, conversationId } = await req.json();
    
    if (!messageId) {
      return NextResponse.json({ error: 'Message ID is required' }, { status: 400 });
    }
    
    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 });
    }
    
    // Verify user is part of the conversation
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
    
    // Mark message as read
    await markMessageAsRead(messageId, userEmail);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking message as read:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 