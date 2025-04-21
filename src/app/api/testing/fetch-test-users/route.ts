import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { 
  db, 
  collection, 
  getDocs 
} from '@/lib/firebase';

// Only for development
const ENABLE_TEST_ENDPOINT = process.env.NODE_ENV !== 'production';

// Define Firestore collection reference
const testSurveysCollection = collection(db, 'test_surveys');

export async function GET() {
  // Check if test endpoint is enabled
  if (!ENABLE_TEST_ENDPOINT) {
    return NextResponse.json(
      { error: 'Test endpoints are disabled in production' },
      { status: 403 }
    );
  }
  
  try {
    const session = await getServerSession();
    
    // Only allow authenticated users to access this endpoint
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Get all test users from Firestore
    const usersSnapshot = await getDocs(testSurveysCollection);
    
    // Format the users for the frontend
    const formattedUsers = usersSnapshot.docs.map(doc => {
      const user = doc.data();
      return {
        name: user.name || 'Unknown',
        email: user.userEmail,
        region: user.housingRegion,
        gender: user.gender,
        city: Array.isArray(user.housingCities) && user.housingCities.length > 0 
          ? user.housingCities[0] 
          : 'Unknown'
      };
    });
    
    return NextResponse.json({
      success: true,
      users: formattedUsers
    });
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to fetch test users',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 