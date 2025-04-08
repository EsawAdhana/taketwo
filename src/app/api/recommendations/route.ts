import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { getRecommendedMatches, getTopMatchesByRegion } from '@/utils/recommendationEngine';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Extract query parameters
    const url = new URL(req.url);
    const region = url.searchParams.get('region');
    const minScore = url.searchParams.get('minScore');
    const showTestUsers = url.searchParams.get('showTestUsers') === 'true';
    const isTest = url.searchParams.get('test') === 'true';
    const minScoreValue = minScore ? parseInt(minScore, 10) : 50;
    
    // Testing mode - return list of test users
    if (isTest && process.env.NODE_ENV !== 'production') {
      const client = (await import('@/lib/mongodb')).default;
      const mongodb = await client;
      const db = mongodb.db('monkeyhouse');
      
      // Find all users whose email contains "test" using a string pattern
      const testUsers = await db.collection('users')
        .find({ email: { $regex: "test" } })
        .project({ email: 1, name: 1 })
        .toArray();
      
      return NextResponse.json({ testUsers });
    }
    
    // Get recommended matches based on showTestUsers parameter
    let matches;
    if (region) {
      matches = await getTopMatchesByRegion(
        session.user.email,
        region,
        10, // Limit to top 10 matches in the region
        true, // Use enhanced scoring
        minScoreValue,
        showTestUsers // Pass showTestUsers parameter
      );
    } else {
      matches = await getRecommendedMatches(
        session.user.email,
        minScoreValue,
        undefined, // No filter emails
        true, // Use enhanced scoring
        showTestUsers // Pass showTestUsers parameter
      );
    }

    // Get email addresses of the matches
    const client = (await import('@/lib/mongodb')).default;
    const mongodb = await client;
    const db = mongodb.db('monkeyhouse');
    
    // Fetch user profiles for all matches
    const matchEmails = matches.map(match => match.userEmail);
    
    // Get profiles from both regular users and test users if showTestUsers is true
    let userProfiles = [];
    if (showTestUsers) {
      // Get profiles from both collections
      const regularProfiles = await db.collection('users')
        .find({ email: { $in: matchEmails } })
        .project({ email: 1, name: 1, image: 1 })
        .toArray();
        
      const testProfiles = await db.collection('test_surveys')
        .find({ userEmail: { $in: matchEmails } })
        .project({ userEmail: 1, name: 1 })
        .toArray()
        .then(profiles => profiles.map(p => ({
          email: p.userEmail,
          name: p.name,
          image: null
        })));
        
      userProfiles = [...regularProfiles, ...testProfiles];
    } else {
      // Only get regular user profiles
      userProfiles = await db.collection('users')
        .find({ email: { $in: matchEmails } })
        .project({ email: 1, name: 1, image: 1 })
        .toArray();
    }
    
    // Create a map of user emails to profiles for easy lookup
    const userProfileMap = new Map();
    userProfiles.forEach(profile => {
      userProfileMap.set(profile.email, profile);
    });
    
    // Fetch survey data from appropriate collections based on showTestUsers
    let surveyData = [];
    if (showTestUsers) {
      // Get survey data from both collections
      const regularSurveys = await db.collection('surveys')
        .find({ userEmail: { $in: matchEmails } })
        .toArray();
        
      const testSurveys = await db.collection('test_surveys')
        .find({ userEmail: { $in: matchEmails } })
        .toArray();
        
      surveyData = [...regularSurveys, ...testSurveys];
    } else {
      // Only get regular survey data
      surveyData = await db.collection('surveys')
        .find({ userEmail: { $in: matchEmails } })
        .toArray();
    }
    
    // Create a map of user emails to survey data for easy lookup
    const surveyDataMap = new Map();
    surveyData.forEach(data => {
      surveyDataMap.set(data.userEmail, data);
    });
    
    // Enrich match data with user profiles and survey data
    const enrichedMatches = matches.map(match => ({
      ...match,
      userProfile: userProfileMap.get(match.userEmail) || { email: match.userEmail },
      fullProfile: surveyDataMap.get(match.userEmail) || null
    }));

    return NextResponse.json({ matches: enrichedMatches });
  } catch (error) {
    console.error('Error getting recommendations:', error);
    return NextResponse.json(
      { error: 'Failed to get recommendations' },
      { status: 500 }
    );
  }
} 