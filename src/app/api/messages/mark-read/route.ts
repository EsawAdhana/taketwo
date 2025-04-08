import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { connectDB } from '@/lib/mongodb';
import Message from '@/models/Message';
import Conversation from '@/models/Conversation';
import User from '@/models/User';
import mongoose from 'mongoose';

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { messageId, conversationId } = await req.json();

    if (!messageId || !conversationId) {
      return NextResponse.json({ error: 'Message ID and Conversation ID are required' }, { status: 400 });
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

    // Find the message
    const message = await Message.findById(messageId);
    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // Check if user already read the message
    const hasRead = message.readBy.some(id => id.toString() === userId.toString());
    if (hasRead) {
      return NextResponse.json({ success: true, data: message });
    }

    // Add user to readBy array
    await Message.findByIdAndUpdate(
      messageId, 
      { $addToSet: { readBy: userId } },
      { new: true }
    );
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking message as read:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 