import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongodb';
import Conversation from '@/models/Conversation';
import Message from '@/models/Message';

export async function GET(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const conversations = await Conversation.find({
      $or: [{ userId: session.user.id }, { otherUserId: session.user.id }],
    })
      .populate('userId', 'name image')
      .populate('otherUserId', 'name image')
      .populate('lastMessage')
      .sort({ updatedAt: -1 });

    return NextResponse.json(conversations);
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

    const { otherUserId } = await req.json();

    if (!otherUserId) {
      return NextResponse.json({ error: 'Other user ID is required' }, { status: 400 });
    }

    await connectDB();

    // Check if conversation already exists
    let conversation = await Conversation.findOne({
      $or: [
        { userId: session.user.id, otherUserId },
        { userId: otherUserId, otherUserId: session.user.id },
      ],
    });

    if (!conversation) {
      conversation = await Conversation.create({
        userId: session.user.id,
        otherUserId,
      });
    }

    return NextResponse.json(conversation);
  } catch (error) {
    console.error('Error creating conversation:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 