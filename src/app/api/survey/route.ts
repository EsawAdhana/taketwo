import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createOrUpdateSurvey, getSurveyByUser } from '@/lib/firebaseService';

export async function GET(req: Request) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userEmail = session.user.email;
    
    // Get survey data
    const survey = await getSurveyByUser(userEmail);
    
    if (!survey) {
      return NextResponse.json({ 
        success: true, 
        data: null,
        message: 'Survey not found' 
      });
    }
    
    return NextResponse.json({ success: true, data: survey });
  } catch (error) {
    console.error('Error fetching survey:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userEmail = session.user.email;
    const surveyData = await req.json();
    
    // Create or update survey
    await createOrUpdateSurvey(userEmail, surveyData);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Survey saved successfully' 
    });
  } catch (error) {
    console.error('Error saving survey:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 