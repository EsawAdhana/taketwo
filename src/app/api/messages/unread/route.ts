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

    // Get current user by email
    const currentUser = await User.findOne({ email: session.user.email });
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Current user not found' }, { status: 404 });
    }
    
    const userId = currentUser._id;
    
    // Check if detailed counts per conversation are requested
    const { searchParams } = new URL(req.url);
    const detailed = searchParams.get('detailed') === 'true';

    // Find conversations the user is part of
    const conversations = await Conversation.find({
      participants: userId
    });

    if (!conversations.length) {
      return NextResponse.json({ 
        success: true, 
        data: { 
          unreadCount: 0,
          unreadByConversation: detailed ? [] : undefined
        } 
      });
    }

    const conversationIds = conversations.map(conv => conv._id);

    // Count unread messages across all conversations
    const unreadCount = await Message.countDocuments({
      conversationId: { $in: conversationIds },
      senderId: { $ne: userId },
      readBy: { $not: { $elemMatch: { $eq: userId } } }
    });
    
    // If detailed counts are requested, get unread count per conversation
    let unreadByConversation;
    
    if (detailed) {
      const results = await Promise.all(
        conversationIds.map(async (conversationId) => {
          const count = await Message.countDocuments({
            conversationId,
            senderId: { $ne: userId },
            readBy: { $not: { $elemMatch: { $eq: userId } } }
          });
          
          return {
            conversationId,
            unreadCount: count
          };
        })
      );
      
      // Filter out conversations with no unread messages
      unreadByConversation = results.filter(item => item.unreadCount > 0);
    }

    return NextResponse.json({ 
      success: true, 
      data: { 
        unreadCount,
        unreadByConversation
      } 
    });
  } catch (error) {
    console.error('Error fetching unread messages count:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 