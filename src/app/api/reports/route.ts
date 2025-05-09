import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { 
  db, 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  Timestamp,
  updateDoc,
  doc
} from '@/lib/firebase';

// Define Firestore collection references
const reportsCollection = collection(db, 'reports');
const blocksCollection = collection(db, 'blocks');
const bannedUsersCollection = collection(db, 'banned_users');

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
    
    const now = Timestamp.now();
    
    // Add the report
    const report = {
      reportedUserEmail,
      reporterEmail: session.user.email,
      reason,
      details: details || '',
      status: 'pending',
      createdAt: now,
      updatedAt: now
    };
    
    await addDoc(reportsCollection, report);
    
    // Create a block for the reporter
    await addDoc(blocksCollection, {
      blockedUserEmail: reportedUserEmail,
      blockedByEmail: session.user.email,
      reason: 'User reported',
      createdAt: now,
      updatedAt: now,
      active: true,
      fromReport: true
    });
    
    // Count total reports
    const totalReportsQuery = query(
      reportsCollection,
      where('reportedUserEmail', '==', reportedUserEmail)
    );
    
    const totalReportsSnapshot = await getDocs(totalReportsQuery);
    const totalReports = totalReportsSnapshot.size;
    
    // If user has 2 or more reports (from anyone), permanently ban them
    if (totalReports >= 2) {
      // Add to banned users collection
      await addDoc(bannedUsersCollection, {
        userEmail: reportedUserEmail,
        reason: 'Received 2 or more reports',
        reportCount: totalReports,
        bannedAt: now,
        permanent: true
      });
      
      // Mark all pending reports as resolved
      const pendingReportsQuery = query(
        reportsCollection,
        where('reportedUserEmail', '==', reportedUserEmail),
        where('status', '==', 'pending')
      );
      
      const pendingReportsSnapshot = await getDocs(pendingReportsQuery);
      
      const updatePromises = pendingReportsSnapshot.docs.map(reportDoc => 
        updateDoc(doc(reportsCollection, reportDoc.id), { 
          status: 'resolved', 
          updatedAt: now 
        })
      );
      
      await Promise.all(updatePromises);
      
      // Create system-wide block
      await addDoc(blocksCollection, {
        blockedUserEmail: reportedUserEmail,
        blockedByEmail: 'system',
        reason: 'Account banned due to multiple reports',
        createdAt: now,
        updatedAt: now,
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
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(req.url);
    const userEmail = searchParams.get('userEmail');
    
    if (!userEmail) {
      return NextResponse.json(
        { error: 'Missing userEmail parameter' },
        { status: 400 }
      );
    }
    
    // Query Firestore for reports
    const reportsQuery = query(
      reportsCollection,
      where('reportedUserEmail', '==', userEmail)
    );
    
    const reportsSnapshot = await getDocs(reportsQuery);
    const reports = reportsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return NextResponse.json({ 
      success: true, 
      reports 
    });
  } catch (error) {
    console.error('Error getting reports:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 