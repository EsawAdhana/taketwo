import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { connectDB } from '@/lib/mongodb';
import Conversation from '@/models/Conversation';
import User from '@/models/User';

export async function GET(
  req: Request,
  { params }: { params: { conversationId: string } }
) {
  try {
    const session = await getServerSession();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const conversationId = params.conversationId;

    // Get current user by email since session.user.id might be undefined
    const currentUser = await User.findOne({ email: session.user.email });
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Current user not found' }, { status: 404 });
    }
    
    const userId = currentUser._id.toString();

    // Find the conversation and verify the user is a participant
    const conversation = await Conversation.findById(conversationId)
      .populate('participants', 'name image')
      .populate('lastMessage');

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Verify user is part of the conversation
    const isParticipant = conversation.participants.some(
      (p: any) => p._id.toString() === userId
    );
    
    if (!isParticipant) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Transform the conversation to include other participants' info
    const otherParticipants = conversation.participants.filter(
      (p: any) => p._id.toString() !== userId
    );
    
    const transformedConversation = {
      _id: conversation._id,
      participants: conversation.participants,
      otherParticipants,
      lastMessage: conversation.lastMessage,
      isGroup: conversation.isGroup,
      name: conversation.name || (otherParticipants[0]?.name || 'Unknown User'),
      updatedAt: conversation.updatedAt
    };

    return NextResponse.json({ success: true, data: transformedConversation });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 