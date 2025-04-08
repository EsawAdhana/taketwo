import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { connectDB } from '@/lib/mongodb';
import Message from '@/models/Message';
import Conversation from '@/models/Conversation';
import User from '@/models/User';

export async function GET(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('conversationId');
    const lastMessageTimestamp = searchParams.get('lastMessageTimestamp');

    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 });
    }

    if (!lastMessageTimestamp) {
      return NextResponse.json({ error: 'Last message timestamp is required' }, { status: 400 });
    }

    // Get current user by email since session.user.id might be undefined
    const currentUser = await User.findOne({ email: session.user.email });
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Current user not found' }, { status: 404 });
    }
    
    const userId = currentUser._id;

    // Verify user is part of the conversation
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    
    // Check if user is part of conversation participants
    const isParticipant = conversation.participants.some(p => 
      p.toString() === userId.toString()
    );
    
    if (!isParticipant) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find messages that are newer than the last message timestamp
    const newMessages = await Message.find({
      conversationId,
      createdAt: { $gt: new Date(lastMessageTimestamp) }
    })
      .sort({ createdAt: 1 })
      .populate('senderId', 'name image')
      .populate('readBy', 'name image');

    return NextResponse.json({ success: true, data: newMessages });
  } catch (error) {
    console.error('Error polling for new messages:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 