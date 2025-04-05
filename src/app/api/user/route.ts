import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function DELETE() {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const client = await clientPromise;
    const db = client.db('taketwo');

    // Delete the user's survey data
    const result = await db.collection('surveys').deleteOne({
      userEmail: session.user.email
    });

    if (!result.deletedCount) {
      return NextResponse.json(
        { error: 'No survey data found to delete' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: 'Survey data deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting survey data:', error);
    return NextResponse.json(
      { error: 'Failed to delete survey data' },
      { status: 500 }
    );
  }
} 