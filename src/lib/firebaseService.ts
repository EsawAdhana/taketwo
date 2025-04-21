import { 
  db,
  usersCollection,
  conversationsCollection,
  messagesCollection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  collection,
  updateDoc,
  deleteDoc,
  addDoc
} from './firebase';
import { User } from 'next-auth';

// Add a new collection reference for surveys
const surveysCollection = collection(db, 'surveys');

// Firebase data interfaces
export interface FirebaseUser {
  _id?: string;
  email: string;
  name?: string;
  image?: string;
  createdAt?: Date | Timestamp;
  updatedAt?: Date | Timestamp;
}

export interface FirebaseMessage {
  _id?: string;
  content: string;
  senderId: string | FirebaseUser | { _id: string; name?: string; image?: string; };
  conversationId: string;
  readBy?: Array<string | FirebaseUser | { _id: string; name?: string; image?: string; }>;
  createdAt?: Date | Timestamp;
  updatedAt?: Date | Timestamp;
}

export interface FirebaseConversation {
  _id?: string;
  participants: string[] | FirebaseUser[];
  lastMessage?: string | FirebaseMessage;
  name?: string | null;
  isGroup?: boolean;
  createdAt?: Date | Timestamp;
  updatedAt?: Date | Timestamp;
}

// User Methods
export const createOrUpdateUser = async (user: User | FirebaseUser) => {
  if (!user.email) throw new Error('User email is required');
  
  const userRef = doc(usersCollection, user.email);
  const userDoc = await getDoc(userRef);
  
  // Check if the user has a survey with firstName
  const surveyRef = doc(surveysCollection, user.email);
  const surveyDoc = await getDoc(surveyRef);
  let surveyFirstName = '';
  
  if (surveyDoc.exists()) {
    const surveyData = surveyDoc.data();
    if (surveyData.firstName && typeof surveyData.firstName === 'string') {
      surveyFirstName = surveyData.firstName.trim();
    }
  }
  
  const userData: FirebaseUser = {
    email: user.email,
    name: surveyFirstName || user.name || '',
    image: user.image || '',
    updatedAt: Timestamp.now()
  };
  
  if (!userDoc.exists()) {
    // Create new user
    userData.createdAt = Timestamp.now();
    await setDoc(userRef, userData);
  } else {
    // Update existing user - but only overwrite name if it's provided and non-empty
    const updateData: Partial<FirebaseUser> = {
      updatedAt: Timestamp.now()
    };
    
    if (user.image) updateData.image = user.image;
    
    // Prioritize firstName from survey, then name from user object
    if (surveyFirstName) {
      updateData.name = surveyFirstName;
    } else if (user.name && user.name.trim() !== '') {
      updateData.name = user.name;
    }
    
    await updateDoc(userRef, updateData);
    
    // Return the updated user data
    const updatedDoc = await getDoc(userRef);
    if (updatedDoc.exists()) {
      return {
        _id: user.email,
        ...updatedDoc.data()
      } as FirebaseUser;
    }
  }
  
  return {
    _id: user.email,
    ...userData
  };
};

export const getUser = async (email: string) => {
  const userRef = doc(usersCollection, email);
  const userDoc = await getDoc(userRef);
  
  if (!userDoc.exists()) {
    return null;
  }
  
  return {
    _id: userDoc.id,
    ...userDoc.data()
  } as FirebaseUser;
};

// Conversation Methods
export const createConversation = async (conversation: Omit<FirebaseConversation, '_id' | 'createdAt' | 'updatedAt'>) => {
  const now = Timestamp.now();
  const conversationData = {
    ...conversation,
    createdAt: now,
    updatedAt: now
  };
  
  const docRef = await addDoc(conversationsCollection, conversationData);
  
  return {
    _id: docRef.id,
    ...conversationData
  };
};

export const getConversation = async (conversationId: string) => {
  const conversationRef = doc(conversationsCollection, conversationId);
  const conversationDoc = await getDoc(conversationRef);
  
  if (!conversationDoc.exists()) {
    return null;
  }
  
  return {
    _id: conversationDoc.id,
    ...conversationDoc.data()
  } as FirebaseConversation;
};

export const getConversationsByUser = async (userEmail: string) => {
  const q = query(
    conversationsCollection,
    where('participants', 'array-contains', userEmail),
    orderBy('updatedAt', 'desc')
  );
  
  const querySnapshot = await getDocs(q);
  const conversations: FirebaseConversation[] = [];
  
  querySnapshot.forEach((doc) => {
    conversations.push({
      _id: doc.id,
      ...doc.data()
    } as FirebaseConversation);
  });
  
  return conversations;
};

export const updateConversation = async (conversationId: string, data: Partial<FirebaseConversation>) => {
  const conversationRef = doc(conversationsCollection, conversationId);
  await updateDoc(conversationRef, {
    ...data,
    updatedAt: Timestamp.now()
  });
  
  return {
    _id: conversationId,
    ...data
  };
};

export const deleteConversation = async (conversationId: string) => {
  // Delete all messages in the conversation
  const messagesQuery = query(
    messagesCollection,
    where('conversationId', '==', conversationId)
  );
  
  const messagesSnapshot = await getDocs(messagesQuery);
  const deletionPromises = messagesSnapshot.docs.map(doc => deleteDoc(doc.ref));
  
  await Promise.all(deletionPromises);
  
  // Delete the conversation document
  const conversationRef = doc(conversationsCollection, conversationId);
  await deleteDoc(conversationRef);
  
  return { success: true };
};

// Message Methods
export const createMessage = async (message: Omit<FirebaseMessage, '_id' | 'createdAt' | 'updatedAt'>) => {
  const now = Timestamp.now();
  
  // Ensure senderId is properly handled as either string or object
  let processedMessage: any = {
    ...message,
    readBy: message.readBy || [],
    createdAt: now,
    updatedAt: now
  };
  
  // Convert sender object to string ID if needed
  if (typeof message.senderId === 'object' && message.senderId !== null && '_id' in message.senderId) {
    processedMessage.senderId = message.senderId._id;
  }
  
  const docRef = await addDoc(messagesCollection, processedMessage);
  
  // Update the conversation's lastMessage
  const conversationRef = doc(conversationsCollection, message.conversationId);
  await updateDoc(conversationRef, {
    lastMessage: docRef.id,
    updatedAt: now
  });
  
  return {
    _id: docRef.id,
    ...processedMessage
  };
};

export const getMessagesByConversation = async (conversationId: string) => {
  const q = query(
    messagesCollection,
    where('conversationId', '==', conversationId),
    orderBy('createdAt', 'asc')
  );
  
  const querySnapshot = await getDocs(q);
  const messages: FirebaseMessage[] = [];
  
  querySnapshot.forEach((doc) => {
    messages.push({
      _id: doc.id,
      ...doc.data()
    } as FirebaseMessage);
  });
  
  return messages;
};

export const getNewMessagesSince = async (conversationId: string, timestamp: Date | Timestamp) => {
  const firestoreTimestamp = timestamp instanceof Date ? Timestamp.fromDate(timestamp) : timestamp;
  
  const q = query(
    messagesCollection,
    where('conversationId', '==', conversationId),
    where('createdAt', '>', firestoreTimestamp),
    orderBy('createdAt', 'asc')
  );
  
  const querySnapshot = await getDocs(q);
  const messages: FirebaseMessage[] = [];
  
  querySnapshot.forEach((doc) => {
    messages.push({
      _id: doc.id,
      ...doc.data()
    } as FirebaseMessage);
  });
  
  return messages;
};

export const markMessageAsRead = async (messageId: string, userEmail: string) => {
  const messageRef = doc(messagesCollection, messageId);
  const messageDoc = await getDoc(messageRef);
  
  if (!messageDoc.exists()) {
    throw new Error('Message not found');
  }
  
  const messageData = messageDoc.data() as FirebaseMessage;
  const readBy = Array.isArray(messageData.readBy) ? messageData.readBy : [];
  
  // Check if the user has already read this message
  if (readBy.some(reader => 
    typeof reader === 'string' ? reader === userEmail : reader._id === userEmail
  )) {
    // Already marked as read
    return;
  }
  
  // Add user to readBy array
  await updateDoc(messageRef, {
    readBy: [...readBy, userEmail],
    updatedAt: Timestamp.now()
  });
  
  return true;
};

export const getUnreadMessages = async (userEmail: string) => {
  // Get all conversations where the user is a participant
  const conversationsQuery = query(
    conversationsCollection,
    where('participants', 'array-contains', userEmail)
  );
  
  const conversationsSnapshot = await getDocs(conversationsQuery);
  const conversationIds: string[] = [];
  
  conversationsSnapshot.forEach(doc => {
    conversationIds.push(doc.id);
  });
  
  // If there are no conversations, return empty result
  if (conversationIds.length === 0) {
    return { total: 0, byConversation: [] };
  }
  
  // Get all messages where the user hasn't read them yet
  const messagesQuery = query(
    messagesCollection,
    where('conversationId', 'in', conversationIds),
    where('senderId', '!=', userEmail)
  );
  
  const messagesSnapshot = await getDocs(messagesQuery);
  let totalCount = 0;
  const unreadByConversation: { conversationId: string; unreadCount: number }[] = [];
  
  // Count unread messages by conversation
  messagesSnapshot.forEach(doc => {
    const message = doc.data() as FirebaseMessage;
    const readBy = Array.isArray(message.readBy) ? message.readBy : [];
    
    if (!readBy.includes(userEmail)) {
      totalCount++;
      
      const conversationId = message.conversationId;
      const existing = unreadByConversation.find(item => item.conversationId === conversationId);
      
      if (existing) {
        existing.unreadCount++;
      } else {
        unreadByConversation.push({
          conversationId,
          unreadCount: 1
        });
      }
    }
  });
  
  return {
    total: totalCount,
    byConversation: unreadByConversation
  };
};

// Survey Methods
export const getSurveyByUser = async (userEmail: string) => {
  const surveyRef = doc(surveysCollection, userEmail);
  const surveyDoc = await getDoc(surveyRef);
  
  if (!surveyDoc.exists()) {
    return null;
  }
  
  return {
    _id: surveyDoc.id,
    ...surveyDoc.data()
  };
};

export const createOrUpdateSurvey = async (userEmail: string, surveyData: any) => {
  const surveyRef = doc(surveysCollection, userEmail);
  const now = Timestamp.now();
  
  const updatedData = {
    ...surveyData,
    updatedAt: now
  };
  
  const surveyDoc = await getDoc(surveyRef);
  
  if (!surveyDoc.exists()) {
    // Create new survey
    await setDoc(surveyRef, {
      ...updatedData,
      createdAt: now,
      isSubmitted: true,
    });
  } else {
    // Update existing survey
    await updateDoc(surveyRef, updatedData);
  }
  
  return {
    _id: userEmail,
    ...updatedData
  };
};

// Recommendation Methods
export const getRecommendationsByUser = async (userEmail: string, showTestUsers: boolean = false) => {
  try {
    // First, get all users with submitted surveys
    const surveysQuery = query(
      surveysCollection,
      where('isSubmitted', '==', true)
    );
    
    const userSurveyRef = doc(surveysCollection, userEmail);
    const userSurveyDoc = await getDoc(userSurveyRef);
    
    if (!userSurveyDoc.exists()) {
      return { matches: [] };
    }
    
    const userSurveyData = userSurveyDoc.data();
    const surveysSnapshot = await getDocs(surveysQuery);
    
    // Calculate compatibility scores
    const matches = [];
    
    for (const doc of surveysSnapshot.docs) {
      const otherUserEmail = doc.id;
      
      // Skip own survey and non-test users if requested
      if (otherUserEmail === userEmail) continue;
      
      const isTestUser = otherUserEmail.includes('test');
      if (!showTestUsers && isTestUser) continue;
      
      const otherSurveyData = doc.data();
      
      // Calculate compatibility score (implementation depends on your algorithm)
      const compatibilityScore = calculateCompatibilityScore(userSurveyData, otherSurveyData);
      
      if (compatibilityScore.score > 0) {
        // Get user profile info
        const userDoc = await getUser(otherUserEmail);
        
        // Include both the auth name and the firstName from the survey
        matches.push({
          userEmail: otherUserEmail,
          userProfile: {
            name: userDoc?.name || 'User',
            email: otherUserEmail,
            image: userDoc?.image || ''
          },
          // Add the survey data including firstName
          fullProfile: otherSurveyData,
          score: compatibilityScore.score,
          compatibilityDetails: compatibilityScore.details
        });
      }
    }
    
    // Sort by score (highest first)
    matches.sort((a, b) => b.score - a.score);
    
    return { matches };
  } catch (error) {
    console.error('Error getting recommendations:', error);
    return { matches: [] };
  }
};

// Helper function to calculate compatibility
function calculateCompatibilityScore(userSurvey: any, otherSurvey: any) {
  // This is a placeholder - you'll need to implement your actual compatibility algorithm
  let score = 0;
  
  // Example scoring factors
  const locationScore = userSurvey.housingRegion === otherSurvey.housingRegion ? 20 : 0;
  
  // Budget compatibility
  let budgetScore = 0;
  if (userSurvey.minBudget && userSurvey.maxBudget && 
      otherSurvey.minBudget && otherSurvey.maxBudget) {
    
    const userAvgBudget = (userSurvey.minBudget + userSurvey.maxBudget) / 2;
    const otherAvgBudget = (otherSurvey.minBudget + otherSurvey.maxBudget) / 2;
    const budgetDiff = Math.abs(userAvgBudget - otherAvgBudget);
    
    // High score for similar budgets, lower for bigger differences
    if (budgetDiff < 200) budgetScore = 20;
    else if (budgetDiff < 500) budgetScore = 15;
    else if (budgetDiff < 1000) budgetScore = 10;
    else if (budgetDiff < 2000) budgetScore = 5;
    else budgetScore = 0;
  }
  
  // Gender compatibility
  let genderScore = 0;
  if (userSurvey.gender === otherSurvey.gender) {
    genderScore = 20;
  } else if (userSurvey.roomWithDifferentGender && otherSurvey.roomWithDifferentGender) {
    genderScore = 15;
  } else if (userSurvey.roomWithDifferentGender || otherSurvey.roomWithDifferentGender) {
    genderScore = 5;
  }
  
  // Timing compatibility
  let timingScore = 0;
  if (userSurvey.internshipStartDate && userSurvey.internshipEndDate && 
      otherSurvey.internshipStartDate && otherSurvey.internshipEndDate) {
    
    // Check overlap in dates
    const userStart = new Date(userSurvey.internshipStartDate);
    const userEnd = new Date(userSurvey.internshipEndDate);
    const otherStart = new Date(otherSurvey.internshipStartDate);
    const otherEnd = new Date(otherSurvey.internshipEndDate);
    
    // Simple check for overlap
    if (userStart <= otherEnd && otherStart <= userEnd) {
      timingScore = 20;
    }
  }
  
  // Preferences compatibility (simplified)
  let preferencesScore = 10; // Default value
  
  // Calculate total
  score = locationScore + budgetScore + genderScore + timingScore + preferencesScore;
  
  return {
    score,
    details: {
      locationScore,
      budgetScore,
      genderScore,
      timingScore,
      preferencesScore
    }
  };
}

export const searchUsers = async (searchQuery: string, currentUserEmail: string) => {
  try {
    // Get all users
    const querySnapshot = await getDocs(usersCollection);
    const users: FirebaseUser[] = [];
    
    querySnapshot.forEach((doc) => {
      const user = {
        _id: doc.id,
        ...doc.data()
      } as FirebaseUser;
      
      // Exclude current user and filter based on query
      if (user.email !== currentUserEmail && 
          (user.email.toLowerCase().includes(searchQuery.toLowerCase()) || 
           (user.name && user.name.toLowerCase().includes(searchQuery.toLowerCase())))) {
        users.push(user);
      }
    });
    
    // Sort results by relevance and limit to 10
    return users.slice(0, 10);
  } catch (error) {
    console.error('Error searching users:', error);
    throw error;
  }
};

// Utility function to ensure we have full user data with images 
export const enrichParticipantsWithUserData = async (participants: (string | any)[]) => {
  if (!participants || !Array.isArray(participants)) return [];
  
  const enrichedParticipants = await Promise.all(
    participants.map(async (participant) => {
      // If participant is just an email string, get full user data
      if (typeof participant === 'string') {
        try {
          const userRef = doc(usersCollection, participant);
          const userDoc = await getDoc(userRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            return {
              _id: participant,
              email: participant,
              name: userData.name || '',
              image: userData.image || ''
            };
          }
        } catch (error) {
          // Silently fail and use default values
        }
        
        // Fallback if user data can't be fetched
        return { _id: participant, email: participant, name: '', image: '' };
      }
      
      // If participant is an object, ensure it has all fields
      return {
        _id: participant._id || participant.email,
        email: participant.email || participant._id,
        name: participant.name || '',
        image: participant.image || ''
      };
    })
  );
  
  return enrichedParticipants;
}; 