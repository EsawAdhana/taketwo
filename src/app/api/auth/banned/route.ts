import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'Missing email parameter' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db('monkeyhouse');

    // Check if user is in banned_users collection
    const bannedUser = await db.collection('banned_users').findOne({
      userEmail: email,
      permanent: true
    });

    return NextResponse.json({
      isBanned: !!bannedUser,
      banInfo: bannedUser ? {
        reason: bannedUser.reason,
        bannedAt: bannedUser.bannedAt
      } : null
    });
  } catch (error) {
    console.error('Error checking banned status:', error);
    return NextResponse.json(
      { error: 'Failed to check banned status' },
      { status: 500 }
    );
  }
} 