import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { connectDB } from '@/lib/mongodb';
import Conversation from '@/models/Conversation';
import Message from '@/models/Message';
import User from '@/models/User';
import mongoose from 'mongoose';

export async function GET(req: Request) {
  try {
    const session = await getServerSession();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Ensure database connection
    try {
      await connectDB();
    } catch (dbError) {
      console.error('Database connection error:', dbError);
      return NextResponse.json({ error: 'Database connection failed' }, { status: 503 });
    }

    // Get current user by email since session.user.id might be undefined
    const currentUser = await User.findOne({ email: session.user.email });
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Current user not found' }, { status: 404 });
    }
    
    const userId = currentUser._id.toString();

    const conversations = await Conversation.find({
      participants: userId
    })
      .populate('participants', 'name image')
      .populate('lastMessage')
      .sort({ updatedAt: -1 });

    // Transform the conversations to include other participants' info
    const transformedConversations = conversations.map(conv => {
      const otherParticipants = conv.participants.filter(
        (p: any) => p._id.toString() !== userId
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

    const { participants, isGroup, name } = await req.json();

    if (!participants || !Array.isArray(participants)) {
      return NextResponse.json({ error: 'Participants array is required' }, { status: 400 });
    }

    // Ensure database connection
    try {
      await connectDB();
    } catch (dbError) {
      console.error('Database connection error:', dbError);
      return NextResponse.json({ error: 'Database connection failed' }, { status: 503 });
    }

    // Get current user by email since session.user.id might be undefined
    const currentUser = await User.findOne({ email: session.user.email });
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Current user not found' }, { status: 404 });
    }
    
    // Use the current user's ID from database
    const currentUserId = currentUser._id.toString();
    
    // Ensure the current user is included in participants
    let filteredParticipants = [...participants];
    
    // Deduplicate participants
    filteredParticipants = [...new Set(filteredParticipants)];
    
    // Look up users by email if the ID is not a valid ObjectId
    const validParticipants = await Promise.all(filteredParticipants.map(async (id) => {
      if (mongoose.Types.ObjectId.isValid(id)) {
        return id;
      }
      
      // If not a valid ObjectId, try to find user by email
      const user = await User.findOne({ email: id });
      return user ? user._id : null;
    }));

    // Filter out any null values (users not found)
    const finalParticipants = validParticipants.filter(id => id != null);

    if (finalParticipants.length === 0) {
      return NextResponse.json({ 
        error: 'No valid participants found',
        details: {
          received: participants,
          valid: finalParticipants
        }
      }, { status: 400 });
    }

    // For direct messages, check if conversation already exists
    if (!isGroup) {
      try {
        const existingConversation = await Conversation.findOne({
          participants: { $all: finalParticipants, $size: finalParticipants.length },
          isGroup: false
        });

        if (existingConversation) {
          return NextResponse.json({ success: true, data: existingConversation });
        }
      } catch (findError) {
        console.error('Error finding existing conversation:', findError);
        // Continue to create a new conversation if finding fails
      }
    }

    // Create new conversation with validated participants
    const conversation = await Conversation.create({
      participants: finalParticipants,
      isGroup: isGroup || false,
      name: name || null
    });

    // Populate the conversation with participant details
    const populatedConversation = await Conversation.findById(conversation._id)
      .populate('participants', 'name image')
      .populate('lastMessage');

    return NextResponse.json({ success: true, data: populatedConversation });
  } catch (error) {
    console.error('Error creating conversation:', error);
    
    // Provide more detailed error information
    if (error.name === 'ValidationError') {
      return NextResponse.json({ 
        error: 'Validation Error', 
        details: error.errors 
      }, { status: 400 });
    }
    
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 