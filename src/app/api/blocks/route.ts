import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { 
  db, 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  Timestamp,
  getDoc 
} from '@/lib/firebase';

// Define our Firestore collection reference
const blocksCollection = collection(db, 'blocks');

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
    
    // Query Firestore for blocks
    const blocksQuery = query(
      blocksCollection,
      where('blockedUserEmail', '==', userEmail),
      where('active', '==', true)
    );
    
    const blocksSnapshot = await getDocs(blocksQuery);
    const blocks = blocksSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
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
    
    // Check if block already exists
    const existingBlockQuery = query(
      blocksCollection,
      where('blockedUserEmail', '==', blockedUserEmail),
      where('blockedByEmail', '==', session.user.email),
      where('active', '==', true)
    );
    
    const existingBlockSnapshot = await getDocs(existingBlockQuery);
    
    if (!existingBlockSnapshot.empty) {
      return NextResponse.json(
        { error: 'User is already blocked' },
        { status: 400 }
      );
    }
    
    // Add the block
    const now = Timestamp.now();
    const block = {
      blockedUserEmail,
      blockedByEmail: session.user.email,
      reason: reason || 'User reported',
      createdAt: now,
      updatedAt: now,
      active: true
    };
    
    const docRef = await addDoc(blocksCollection, block);
    
    return NextResponse.json({ success: true, blockId: docRef.id });
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
    const { blockId, active } = body;
    
    if (!blockId || active === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Get the block document
    const blockRef = doc(blocksCollection, blockId);
    const blockDoc = await getDoc(blockRef);
    
    if (!blockDoc.exists()) {
      return NextResponse.json(
        { error: 'Block not found' },
        { status: 404 }
      );
    }
    
    // Check if the user has permission (only the creator can update)
    const blockData = blockDoc.data();
    if (blockData.blockedByEmail !== session.user.email) {
      return NextResponse.json(
        { error: 'Unauthorized to update this block' },
        { status: 403 }
      );
    }
    
    // Update the block
    await updateDoc(blockRef, { 
      active, 
      updatedAt: Timestamp.now() 
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating block:', error);
    return NextResponse.json(
      { error: 'Failed to update block' },
      { status: 500 }
    );
  }
} 