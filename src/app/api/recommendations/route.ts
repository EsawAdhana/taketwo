import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getRecommendationsByUser } from '@/lib/firebaseService';

export async function GET(req: Request) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const showTestUsers = searchParams.get('showTestUsers') === 'true';
    
    // Get recommendations
    const recommendations = await getRecommendationsByUser(session.user.email, showTestUsers);
    
    return NextResponse.json({ success: true, data: recommendations });
  } catch (error) {
    console.error('Error getting recommendations:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 