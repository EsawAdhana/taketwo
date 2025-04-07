import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import clientPromise from '@/lib/mongodb';

export async function GET() {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const client = await clientPromise;
    const db = client.db('monkeyhouse');
    
    // Check regular surveys collection first
    let survey = await db.collection('surveys').findOne({
      userEmail: session.user.email
    });
    
    // If not found, check test surveys
    if (!survey) {
      survey = await db.collection('test_surveys').findOne({
        userEmail: session.user.email
      });
    }
    
    return NextResponse.json({ data: survey });
  } catch (error) {
    console.error('Error fetching survey:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const data = await req.json();
    const client = await clientPromise;
    const db = client.db('monkeyhouse');
    
    // Remove _id from data if it exists
    const { _id, ...surveyData } = data;
    
    // Update or insert survey data
    await db.collection('surveys').updateOne(
      { userEmail: session.user.email },
      {
        $set: {
          ...surveyData,
          userEmail: session.user.email,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving survey:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 