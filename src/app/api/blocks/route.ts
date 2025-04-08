import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import clientPromise from '@/lib/mongodb';

// Get blocks for a user
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    
    // Only allow authenticated users to view blocks
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { searchParams } = new URL(req.url);
    const userEmail = searchParams.get('userEmail');
    
    if (!userEmail) {
      return NextResponse.json(
        { error: 'Missing user email parameter' },
        { status: 400 }
      );
    }
    
    const client = await clientPromise;
    const db = client.db('monkeyhouse');
    
    // Get active blocks for this user
    const blocks = await db.collection('blocks')
      .find({ 
        blockedUserEmail: userEmail,
        active: true
      })
      .toArray();
    
    return NextResponse.json({ blocks });
  } catch (error) {
    console.error('Error fetching blocks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch blocks' },
      { status: 500 }
    );
  }
}

// Create a new block
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    
    // Only allow authenticated users to create blocks
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const body = await req.json();
    const { blockedUserEmail, reason } = body;
    
    if (!blockedUserEmail) {
      return NextResponse.json(
        { error: 'Missing blocked user email' },
        { status: 400 }
      );
    }
    
    // Don't allow self-blocking
    if (blockedUserEmail === session.user.email) {
      return NextResponse.json(
        { error: 'Cannot block yourself' },
        { status: 400 }
      );
    }
    
    const client = await clientPromise;
    const db = client.db('monkeyhouse');
    
    // Create blocks collection if it doesn't exist
    if (!(await db.listCollections({ name: 'blocks' }).toArray()).length) {
      await db.createCollection('blocks');
    }
    
    // Check if block already exists
    const existingBlock = await db.collection('blocks').findOne({
      blockedUserEmail,
      active: true
    });
    
    if (existingBlock) {
      return NextResponse.json(
        { error: 'User is already blocked' },
        { status: 400 }
      );
    }
    
    // Add the block
    const block = {
      blockedUserEmail,
      blockedByEmail: session.user.email,
      reason: reason || 'User reported',
      createdAt: new Date(),
      updatedAt: new Date(),
      active: true
    };
    
    await db.collection('blocks').insertOne(block);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error creating block:', error);
    return NextResponse.json(
      { error: 'Failed to create block' },
      { status: 500 }
    );
  }
}

// Update a block (e.g., to deactivate it)
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession();
    
    // Only allow authenticated users to update blocks
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const body = await req.json();
    const { blockedUserEmail, active } = body;
    
    if (!blockedUserEmail || active === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    const client = await clientPromise;
    const db = client.db('monkeyhouse');
    
    // Update the block
    await db.collection('blocks').updateOne(
      { blockedUserEmail },
      { 
        $set: { 
          active,
          updatedAt: new Date()
        } 
      }
    );
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating block:', error);
    return NextResponse.json(
      { error: 'Failed to update block' },
      { status: 500 }
    );
  }
} 