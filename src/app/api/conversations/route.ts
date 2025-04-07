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

    const conversations = await Conversation.find({
      participants: session.user.id
    })
      .populate('participants', 'name image')
      .populate('lastMessage')
      .sort({ updatedAt: -1 });

    // Transform the conversations to include other participants' info
    const transformedConversations = conversations.map(conv => {
      const otherParticipants = conv.participants.filter(
        (p: any) => p._id.toString() !== session.user.id
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

    return NextResponse.json(transformedConversations);
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

    // Ensure database connection with better error handling
    try {
      await connectDB();
    } catch (dbError) {
      console.error('Database connection error:', dbError);
      return NextResponse.json({ error: 'Database connection failed' }, { status: 503 });
    }

    // Validate that all participants are valid ObjectIds
    const validParticipants = participants.filter(id => {
      try {
        return mongoose.Types.ObjectId.isValid(id);
      } catch (error) {
        return false;
      }
    });

    if (validParticipants.length === 0) {
      return NextResponse.json({ error: 'No valid participants provided' }, { status: 400 });
    }

    // Ensure the current user is included in participants
    const currentUserId = session.user.id;
    if (!validParticipants.includes(currentUserId)) {
      validParticipants.push(currentUserId);
    }

    // For direct messages, check if conversation already exists
    if (!isGroup) {
      try {
        const existingConversation = await Conversation.findOne({
          participants: { $all: validParticipants, $size: validParticipants.length },
          isGroup: false
        });

        if (existingConversation) {
          return NextResponse.json(existingConversation);
        }
      } catch (findError) {
        console.error('Error finding existing conversation:', findError);
        // Continue to create a new conversation if finding fails
      }
    }

    // Create new conversation with validated participants
    const conversation = await Conversation.create({
      participants: validParticipants,
      isGroup: isGroup || false,
      name: name || null
    });

    // Populate the conversation with participant details
    const populatedConversation = await Conversation.findById(conversation._id)
      .populate('participants', 'name image')
      .populate('lastMessage');

    return NextResponse.json(populatedConversation);
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