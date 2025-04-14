import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import mongoose from 'mongoose';

export async function GET(req: Request) {
  try {
    const session = await getServerSession();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized', success: false }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required', success: false }, { status: 400 });
    }

    await connectDB();

    // Make sure the userId is valid
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ error: 'Invalid user ID format', success: false }, { status: 400 });
    }

    // Find the user by their ID
    const user = await User.findById(userId).select('email');

    if (!user) {
      return NextResponse.json({ error: 'User not found', success: false }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      email: user.email
    });
  } catch (error) {
    console.error('Error retrieving user email:', error);
    return NextResponse.json({ error: 'Internal Server Error', success: false }, { status: 500 });
  }
} 