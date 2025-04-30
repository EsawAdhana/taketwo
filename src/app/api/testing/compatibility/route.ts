import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { debugCompatibility } from '@/utils/recommendationEngine';

// Only for development
const ENABLE_DEBUG = process.env.NODE_ENV !== 'production';

export async function GET(request: Request) {
  if (!ENABLE_DEBUG) {
    return NextResponse.json({ error: 'Debug endpoints disabled in production' }, { status: 403 });
  }
  
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const user1 = searchParams.get('user1');
    const user2 = searchParams.get('user2');
    
    if (!user1 || !user2) {
      return NextResponse.json({ 
        error: 'Missing parameters', 
        message: 'Both user1 and user2 email parameters are required' 
      }, { status: 400 });
    }
    
    // Run the debug function - this will log all details to the server console
    await debugCompatibility(user1, user2);
    
    return NextResponse.json({
      success: true,
      message: 'Debug compatibility calculation completed - check server logs for details',
      user1,
      user2
    });
  } catch (error) {
    console.error("Error in compatibility debug:", error);
    return NextResponse.json({
      error: 'Compatibility debug failed',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 