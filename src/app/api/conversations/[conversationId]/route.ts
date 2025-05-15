import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { 
  getConversation, 
  updateConversation,
  deleteConversation 
} from '@/lib/firebaseService';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const session = await getServerSession();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { conversationId } = await params;
    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 });
    }
    const userEmail = session.user.email;
    
    // Get conversation by ID
    const conversation = await getConversation(conversationId);
    
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    
    // Check if user is a participant
    const participants = Array.isArray(conversation.participants) 
      ? conversation.participants.map((p: any) => typeof p === 'string' ? p : p._id || p.email)
      : [];
    
    if (!userEmail || !participants.includes(userEmail)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    
    // Transform the conversation to include other participants' info
    const otherParticipants = participants.filter(p => p !== userEmail);
    
    const transformedConversation = {
      ...conversation,
      otherParticipants
    };

    return NextResponse.json({ success: true, data: transformedConversation });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const session = await getServerSession();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { conversationId } = await params;
    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 });
    }
    const userEmail = session.user.email;
    
    // Get conversation to check permissions
    const conversation = await getConversation(conversationId);
    
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    
    // Check if user is a participant
    const participants = Array.isArray(conversation.participants) 
      ? conversation.participants.map((p: any) => typeof p === 'string' ? p : p._id || p.email)
      : [];
    
    if (!userEmail || !participants.includes(userEmail)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    
    // Get update data
    const updateData = await req.json();
    
    // Update conversation
    const updatedConversation = await updateConversation(conversationId, updateData);

    return NextResponse.json({ success: true, data: updatedConversation });
  } catch (error) {
    console.error('Error updating conversation:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const session = await getServerSession();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { conversationId } = await params;
    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 });
    }
    const userEmail = session.user.email;
    
    // Get conversation to check permissions
    const conversation = await getConversation(conversationId);
    
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    
    // Check if user is a participant
    const participants = Array.isArray(conversation.participants) 
      ? conversation.participants.map((p: any) => typeof p === 'string' ? p : p._id || p.email)
      : [];
    
    if (!userEmail || !participants.includes(userEmail)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    
    // Delete conversation
    await deleteConversation(conversationId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 