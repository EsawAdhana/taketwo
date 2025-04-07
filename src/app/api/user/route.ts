import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get email from query parameters
    const url = new URL(req.url);
    const email = url.searchParams.get('email');
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db('taketwo');

    // Find the user's survey data
    const surveyData = await db.collection('surveys').findOne({
      userEmail: email
    });

    if (!surveyData) {
      return NextResponse.json(
        { error: 'No survey data found for this user' },
        { status: 404 }
      );
    }

    // Get basic user profile from users collection
    const userProfile = await db.collection('users').findOne(
      { email },
      { projection: { email: 1, name: 1, image: 1 } }
    );

    return NextResponse.json({
      surveyData,
      userProfile
    });
  } catch (error) {
    console.error('Error fetching user data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user data' },
      { status: 500 }
    );
  }
}

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