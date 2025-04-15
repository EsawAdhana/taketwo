import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { connectDB } from '@/lib/mongodb';
import Message from '@/models/Message';
import Conversation from '@/models/Conversation';
import User from '@/models/User';
import mongoose from 'mongoose';

export async function GET(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 });
    }

    // Get current user by email if ID is not available
    const currentUser = await User.findOne({ email: session.user.email });
    if (!currentUser) {
      return NextResponse.json({ error: 'Current user not found' }, { status: 404 });
    }
    
    const userId = currentUser._id;

    // Verify user is part of the conversation
    const conversation = await Conversation.findById(conversationId);
    if (!conversation || !conversation.participants.some((p: unknown) => 
      p !== null && p !== undefined && p.toString() === userId.toString()
    )) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const messages = await Message.find({ conversationId })
      .sort({ createdAt: 1 })
      .populate('senderId', 'name image')
      .populate('readBy', 'name image');

    return NextResponse.json({ success: true, data: messages });
  } catch (error: unknown) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ 
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { content, conversationId } = await req.json();

    if (!content || !conversationId) {
      return NextResponse.json({ error: 'Content and conversation ID are required' }, { status: 400 });
    }

    // Get current user by email since session.user.id might be undefined
    const currentUser = await User.findOne({ email: session.user.email });
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Current user not found' }, { status: 404 });
    }
    
    const senderId = currentUser._id;

    // Verify user is part of the conversation
    const conversation = await Conversation.findById(conversationId);
    
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    
    // Check if user is part of conversation participants
    const isParticipant = conversation.participants.some((p: unknown) => 
      p !== null && p !== undefined && p.toString() === senderId.toString()
    );
    
    if (!isParticipant) {
      return NextResponse.json({ error: 'Unauthorized - User not in conversation' }, { status: 401 });
    }

    // Create the message
    const message = await Message.create({
      content,
      conversationId,
      senderId: senderId,
      readBy: [senderId], // Mark as read by the sender
    });

    // Update the conversation's lastMessage
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: message._id,
    });

    // Populate the sender and readBy fields
    await message.populate('senderId', 'name image');
    await message.populate('readBy', 'name image');

    return NextResponse.json({ success: true, data: message });
  } catch (error: unknown) {
    console.error('Error sending message:', error);
    return NextResponse.json({ 
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
} 