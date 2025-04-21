import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getUnreadMessages } from '@/lib/firebaseService';

export async function GET(req: Request) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userEmail = session.user.email;
    
    // Get unread messages for user
    const unreadMessages = await getUnreadMessages(userEmail);
    
    // Format response with counts by conversation
    const unreadCounts: Record<string, number> = {};
    
    unreadMessages.forEach(msg => {
      const convId = msg.conversationId;
      if (!unreadCounts[convId]) {
        unreadCounts[convId] = 0;
      }
      unreadCounts[convId]++;
    });
    
    const result = {
      totalUnread: unreadMessages.length,
      byConversation: unreadCounts
    };

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching unread messages:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 