import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';

export async function GET(req: Request) {
  try {
    const session = await getServerSession();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');

    if (!query) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
    }

    await connectDB();

    // Search for users by name or email, excluding the current user
    // Use case-insensitive regex for partial matches
    const users = await User.find({
      email: { $ne: session.user.email }, // Exclude current user
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } }
      ]
    })
    .select('name email image') // Only return necessary fields
    .limit(10); // Limit results to prevent large response payloads

    return NextResponse.json({ success: true, data: users });
  } catch (error) {
    console.error('Error searching users:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 