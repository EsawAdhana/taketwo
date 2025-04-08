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
    
    // Get recommended matches
    let matches;
    if (region) {
      matches = await getTopMatchesByRegion(
        session.user.email,
        region,
        10 // Limit to top 10 matches in the region
      );
    } else {
      matches = await getRecommendedMatches(
        session.user.email,
        minScoreValue
      );
    }

    // Get email addresses of the matches
    const client = (await import('@/lib/mongodb')).default;
    const mongodb = await client;
    const db = mongodb.db('monkeyhouse');
    
    // If showTestUsers is enabled, fetch test users as well
    let testUserMatches = [];
    if (showTestUsers) {
      // Find test users who have submitted a survey
      const testUsers = await db.collection('users')
        .find({ email: { $regex: "test" } })
        .project({ email: 1 })
        .toArray();
      
      const testUserEmails = testUsers.map(user => user.email);
      
      // Get test users who have submitted a survey
      const testUserSurveys = await db.collection('surveys')
        .find({ 
          userEmail: { $in: testUserEmails },
          isSubmitted: true
        })
        .toArray();
      
      // Calculate compatibility scores for each test user
      const testUserPromises = testUserSurveys.map(async (survey) => {
        if (survey.userEmail === session.user.email) return null; // Skip self
        
        try {
          const userSurvey = await db.collection('surveys').findOne({ userEmail: session.user.email });
          if (!userSurvey || !userSurvey.isSubmitted) return null;
          
          const userSurveyData = {
            ...userSurvey,
            isSubmitted: true
          };
          
          const potentialMatchSurveyData = {
            ...survey,
            isSubmitted: true
          };
          
          // Calculate compatibility score using the recommendation engine
          const compatScore = await getRecommendedMatches(
            session.user.email,
            0, // No minimum score for test users
            [survey.userEmail], // Only get for this specific test user
            true // Use enhanced scoring
          );
          
          return compatScore.length > 0 ? compatScore[0] : null;
        } catch (error) {
          console.error(`Error calculating compatibility for test user ${survey.userEmail}:`, error);
          return null;
        }
      });
      
      const testUserResults = await Promise.all(testUserPromises);
      testUserMatches = testUserResults.filter(Boolean);
    }
    
    // Combine regular matches with test user matches if requested
    const combinedMatches = showTestUsers 
      ? [...matches, ...testUserMatches] 
      : matches;
    
    // Fetch user profiles for all matches
    const matchEmails = combinedMatches.map(match => match.userEmail);
    const userProfiles = await db.collection('users')
      .find({ email: { $in: matchEmails } })
      .project({ email: 1, name: 1, image: 1 })
      .toArray();
    
    // Create a map of user emails to profiles for easy lookup
    const userProfileMap = new Map();
    userProfiles.forEach(profile => {
      userProfileMap.set(profile.email, profile);
    });
    
    // Fetch survey data for the matches
    const surveyData = await db.collection('surveys')
      .find({ userEmail: { $in: matchEmails } })
      .toArray();
    
    // Create a map of user emails to survey data for easy lookup
    const surveyDataMap = new Map();
    surveyData.forEach(data => {
      surveyDataMap.set(data.userEmail, data);
    });
    
    // Enrich match data with user profiles and survey data
    const enrichedMatches = combinedMatches.map(match => ({
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