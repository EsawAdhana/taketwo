import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import clientPromise from '@/lib/mongodb';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    
    // Only allow authenticated users to report
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const body = await req.json();
    const { reportedUserEmail, reason, details } = body;
    
    if (!reportedUserEmail || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Don't allow self-reporting
    if (reportedUserEmail === session.user.email) {
      return NextResponse.json(
        { error: 'Cannot report yourself' },
        { status: 400 }
      );
    }
    
    const client = await clientPromise;
    const db = client.db('monkeyhouse');
    
    // Create collections if they don't exist
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    if (!collectionNames.includes('reports')) {
      await db.createCollection('reports');
    }
    if (!collectionNames.includes('blocks')) {
      await db.createCollection('blocks');
    }
    if (!collectionNames.includes('banned_users')) {
      await db.createCollection('banned_users');
    }
    
    // Add the report
    const report = {
      reportedUserEmail,
      reporterEmail: session.user.email,
      reason,
      details: details || '',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await db.collection('reports').insertOne(report);
    
    // Create a block for the reporter
    await db.collection('blocks').insertOne({
      blockedUserEmail: reportedUserEmail,
      blockedByEmail: session.user.email,
      reason: 'User reported',
      createdAt: new Date(),
      updatedAt: new Date(),
      active: true,
      fromReport: true
    });
    
    // Check total number of unique reporters for this user
    const uniqueReporters = await db.collection('reports')
      .distinct('reporterEmail', { reportedUserEmail });
    
    // If user has 3 or more unique reporters, permanently ban them
    if (uniqueReporters.length >= 3) {
      // Add to banned users collection
      await db.collection('banned_users').insertOne({
        userEmail: reportedUserEmail,
        reason: 'Received 3 or more reports from different users',
        reportCount: uniqueReporters.length,
        bannedAt: new Date(),
        permanent: true
      });
      
      // Mark all pending reports as resolved
      await db.collection('reports').updateMany(
        { reportedUserEmail, status: 'pending' },
        { $set: { status: 'resolved', updatedAt: new Date() } }
      );
      
      // Create system-wide block
      await db.collection('blocks').insertOne({
        blockedUserEmail: reportedUserEmail,
        blockedByEmail: 'system',
        reason: 'Account banned due to multiple reports',
        createdAt: new Date(),
        updatedAt: new Date(),
        active: true,
        isSystemBlock: true
      });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error creating report:', error);
    return NextResponse.json(
      { error: 'Failed to create report' },
      { status: 500 }
    );
  }
}

// Get reports for a specific user
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    
    // Only allow authenticated users to view reports
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
    
    // Get reports for this user
    const reports = await db.collection('reports')
      .find({ reportedUserEmail: userEmail })
      .toArray();
    
    return NextResponse.json({ reports });
  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    );
  }
} 