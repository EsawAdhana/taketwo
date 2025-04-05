import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import clientPromise from '@/lib/mongodb';
import { HOUSING_REGIONS, NON_NEGOTIABLES, Preference, PreferenceStrength } from '@/constants/survey-constants';

// This endpoint is for testing purposes only
// Should be disabled in production
const ENABLE_TEST_ENDPOINT = process.env.NODE_ENV !== 'production';

// Names for generating test users
const FIRST_NAMES = [
  "James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda", 
  "William", "Elizabeth", "David", "Barbara", "Richard", "Susan", "Joseph", "Jessica", 
  "Thomas", "Sarah", "Charles", "Karen", "Christopher", "Nancy", "Daniel", "Lisa", 
  "Matthew", "Betty", "Anthony", "Margaret", "Mark", "Sandra", "Donald", "Ashley", 
  "Steven", "Kimberly", "Paul", "Emily", "Andrew", "Donna", "Joshua", "Michelle", 
  "Kenneth", "Dorothy", "Kevin", "Carol", "Brian", "Amanda", "George", "Melissa", 
  "Edward", "Deborah", "Ronald", "Stephanie", "Timothy", "Rebecca", "Jason", "Sharon"
];

const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Jones", "Brown", "Davis", "Miller", "Wilson", 
  "Moore", "Taylor", "Anderson", "Thomas", "Jackson", "White", "Harris", "Martin", 
  "Thompson", "Garcia", "Martinez", "Robinson", "Clark", "Rodriguez", "Lewis", "Lee", 
  "Walker", "Hall", "Allen", "Young", "Hernandez", "King", "Wright", "Lopez", 
  "Hill", "Scott", "Green", "Adams", "Baker", "Gonzalez", "Nelson", "Carter", 
  "Mitchell", "Perez", "Roberts", "Turner", "Phillips", "Campbell", "Parker", "Evans", 
  "Edwards", "Collins", "Stewart", "Sanchez", "Morris", "Rogers", "Reed", "Cook"
];

// Function to generate a random test user
function generateTestUser(index: number, existingCount: number = 0): any {
  const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  const name = `${firstName} ${lastName}`;
  // Add existing count to index to ensure unique emails
  const userIndex = existingCount + index;
  const email = `test${userIndex}@example.com`;
  
  // Random gender with 50% probability
  const gender = Math.random() < 0.5 ? "Male" : "Female";
  
  // 70% chance of allowing different gender roommates
  const roomWithDifferentGender = Math.random() < 0.7;
  
  // Select random housing region
  const regions = Object.keys(HOUSING_REGIONS);
  const housingRegion = regions[Math.floor(Math.random() * regions.length)];
  
  // Select 1-3 random cities from the region
  const availableCities = HOUSING_REGIONS[housingRegion as keyof typeof HOUSING_REGIONS];
  const numCities = Math.floor(Math.random() * 3) + 1;
  const housingCities = [];
  
  // Handle 'Other' region case
  if (availableCities.length === 0) {
    housingCities.push("Other City");
  } else {
    const shuffledCities = [...availableCities].sort(() => 0.5 - Math.random());
    for (let i = 0; i < Math.min(numCities, shuffledCities.length); i++) {
      housingCities.push(shuffledCities[i]);
    }
  }
  
  // Generate random dates for internship in the next 3 months
  const now = new Date();
  const year = now.getFullYear();
  const startMonth = now.getMonth() + 1; // Current month (1-indexed)
  
  // Random internship duration: 8, 10, or 12 weeks
  const internshipWeeks = [8, 10, 12][Math.floor(Math.random() * 3)];
  const internshipDays = internshipWeeks * 7;
  
  // Start date between now and 1 month in the future
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + Math.floor(Math.random() * 30)); // Random start within a month
  
  // End date based on internship duration
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + internshipDays);
  
  const internshipStartDate = startDate.toISOString().split('T')[0]; // YYYY-MM-DD
  const internshipEndDate = endDate.toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Random roommate preference
  const desiredRoommates = (Math.floor(Math.random() * 4) + 1).toString();
  
  // Random budget between 1000 and 5000
  const monthlyBudget = 1000 + Math.floor(Math.random() * 4001);
  
  // Generate preferences with some variety
  let preferences: Preference[];
  
  // 20% chance of having neutral preferences
  if (Math.random() < 0.2) {
    preferences = generateNeutralPreferences();
  } else {
    // Generate a mix of preferences
    const defaultStrength: PreferenceStrength = getRandomPreferenceStrength();
    
    // Select 1-3 items to have a specific different preference
    const numSpecificPrefs = Math.floor(Math.random() * 3) + 1;
    const specificItems = [];
    const shuffledPrefs = [...NON_NEGOTIABLES].sort(() => 0.5 - Math.random());
    
    for (let i = 0; i < numSpecificPrefs; i++) {
      specificItems.push(shuffledPrefs[i]);
    }
    
    // Select a different strength for these specific items
    let specificStrength: PreferenceStrength;
    do {
      specificStrength = getRandomPreferenceStrength();
    } while (specificStrength === defaultStrength);
    
    preferences = generatePreferences(defaultStrength, specificItems, specificStrength);
  }
  
  return {
    name,
    email,
    gender,
    roomWithDifferentGender,
    housingRegion,
    housingCities,
    internshipStartDate,
    internshipEndDate,
    desiredRoommates,
    monthlyBudget,
    preferences,
    additionalNotes: `Test user ${index} with ${gender.toLowerCase()} gender`,
    isSubmitted: true,
    isDraft: false,
  };
}

// Get a random preference strength
function getRandomPreferenceStrength(): PreferenceStrength {
  const strengths: PreferenceStrength[] = ["deal breaker", "prefer not", "neutral", "prefer", "must have"];
  return strengths[Math.floor(Math.random() * strengths.length)];
}

// Helper function to generate neutral preferences
function generateNeutralPreferences(): Preference[] {
  return NON_NEGOTIABLES.map(item => ({
    item,
    strength: "neutral" as PreferenceStrength
  }));
}

// Helper function to generate preferences with specific strengths for certain items
function generatePreferences(
  defaultStrength: PreferenceStrength, 
  specificItems: string[] = [], 
  specificStrength: PreferenceStrength = "must have"
): Preference[] {
  return NON_NEGOTIABLES.map(item => ({
    item,
    strength: specificItems.includes(item) ? specificStrength : defaultStrength
  }));
}

export async function POST(req: NextRequest) {
  // Check if test endpoint is enabled
  if (!ENABLE_TEST_ENDPOINT) {
    return NextResponse.json(
      { error: 'Test endpoints are disabled in production' },
      { status: 403 }
    );
  }
  
  try {
    console.log("Starting add-test-users process");
    const session = await getServerSession();
    
    // Only allow authenticated users to access this endpoint
    if (!session?.user?.email) {
      console.log("Unauthorized attempt to add test users");
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Parse request body for numUsers parameter
    let numUsers = 10; // Default
    try {
      const body = await req.json();
      if (body.numUsers && typeof body.numUsers === 'number') {
        numUsers = Math.min(Math.max(1, body.numUsers), 100); // Limit between 1 and 100
      }
    } catch (e) {
      // If request body parsing fails, use default
      console.log("Failed to parse request body, using default numUsers:", numUsers);
    }
    
    const client = await clientPromise;
    const db = client.db('taketwo');
    console.log("Connected to database:", db.databaseName);
    
    // Check if test_surveys collection exists, create it if not
    const collections = await db.listCollections({ name: 'test_surveys' }).toArray();
    if (collections.length === 0) {
      console.log("Creating test_surveys collection");
      await db.createCollection('test_surveys');
    }
    
    // Get the count of existing test users to generate unique identifiers
    const existingCount = await db.collection('test_surveys').countDocuments();
    console.log(`Found ${existingCount} existing test users`);
    
    // Generate test users with indices that continue from existing users
    const TEST_USERS = [];
    
    for (let i = 1; i <= numUsers; i++) {
      TEST_USERS.push(generateTestUser(i, existingCount));
    }
    
    // Get new test user emails for reference
    const testEmails = TEST_USERS.map(user => user.email);
    console.log(`Generated ${testEmails.length} new test users`);
    
    // No longer delete existing test users - we'll append instead
    
    // Add test users to the test_surveys collection
    const testUserData = TEST_USERS.map(user => ({
      ...user,
      userEmail: user.email,
      updatedAt: new Date()
    }));
    
    const insertResult = await db.collection('test_surveys').insertMany(testUserData);
    console.log(`Inserted ${insertResult.insertedCount} test surveys`);
    
    // Verify data was inserted
    const totalSurveys = await db.collection('test_surveys').countDocuments();
    
    console.log(`Verification: Found ${totalSurveys} total test surveys after insertion`);
    
    return NextResponse.json({
      success: true,
      message: `Added ${TEST_USERS.length} test users to the database`,
      verificationCounts: {
        surveys: totalSurveys,
        newSurveys: insertResult.insertedCount
      }
    });
  } catch (error) {
    console.error('Error adding test users:', error);
    return NextResponse.json(
      { 
        error: 'Failed to add test users',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 