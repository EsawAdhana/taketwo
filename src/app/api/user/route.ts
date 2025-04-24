import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { 
  db, 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  deleteDoc,
  updateDoc,
  usersCollection,
  surveysCollection,
  conversationsCollection,
  messagesCollection
} from '@/lib/firebase';

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

    // Find the user's survey data
    const surveyDoc = await getDoc(doc(surveysCollection, email));

    if (!surveyDoc.exists()) {
      return NextResponse.json(
        { error: 'No survey data found for this user' },
        { status: 404 }
      );
    }

    // Get basic user profile from users collection
    const userDoc = await getDoc(doc(usersCollection, email));
    
    if (!userDoc.exists()) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    const userData = userDoc.data();
    const userProfile = {
      email: userData.email,
      name: userData.name || '',
      image: userData.image || ''
    };

    return NextResponse.json({
      surveyData: {
        id: surveyDoc.id,
        ...surveyDoc.data()
      },
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

    const userEmail = session.user.email;
    
    // First, check if the user exists
    const userDoc = await getDoc(doc(usersCollection, userEmail));
    
    // Track deletion statistics
    let surveyDeleted = false;
    let userDeleted = false;
    let conversationsUpdated = 0;
    let messagesUpdated = 0;
    
    // 1. Delete the user's survey data
    const surveyDoc = await getDoc(doc(surveysCollection, userEmail));
    if (surveyDoc.exists()) {
      await deleteDoc(doc(surveysCollection, userEmail));
      surveyDeleted = true;
    }

    // 2. Update conversations instead of deleting them
    if (userDoc.exists()) {
      // Find conversations the user is part of
      const conversationsQuery = query(
        conversationsCollection,
        where('participants', 'array-contains', userEmail)
      );
      
      const conversationsSnapshot = await getDocs(conversationsQuery);
      
      if (!conversationsSnapshot.empty) {
        for (const conversationDoc of conversationsSnapshot.docs) {
          const conversation = conversationDoc.data();
          const conversationId = conversationDoc.id;
          
          // Update the participant information with anonymous placeholder
          if (Array.isArray(conversation.participants)) {
            const updatedParticipants = conversation.participants.map((p: any) => {
              if (typeof p === 'string' && p === userEmail) {
                // Replace with anonymous user object
                return {
                  _id: `deleted_${userEmail}`,
                  name: 'Deleted User',
                  image: '',
                  isDeleted: true
                };
              } else if (typeof p === 'object' && (p._id === userEmail || p.email === userEmail)) {
                // Replace user object with anonymous version
                return {
                  _id: `deleted_${userEmail}`,
                  name: 'Deleted User',
                  image: '',
                  isDeleted: true
                };
              }
              return p;
            });
            
            // Update the conversation with the modified participants
            await updateDoc(doc(conversationsCollection, conversationId), {
              participants: updatedParticipants
            });
            
            conversationsUpdated++;
            
            // Now update all messages from this user in this conversation
            const messagesQuery = query(
              messagesCollection,
              where('conversationId', '==', conversationId)
            );
            
            const messagesSnapshot = await getDocs(messagesQuery);
            
            for (const messageDoc of messagesSnapshot.docs) {
              const message = messageDoc.data();
              
              // Check if this message was sent by the deleted user
              let needsUpdate = false;
              let updatedSenderId;
              
              if (typeof message.senderId === 'string' && message.senderId === userEmail) {
                needsUpdate = true;
                updatedSenderId = {
                  _id: `deleted_${userEmail}`,
                  name: 'Deleted User',
                  image: '',
                  isDeleted: true
                };
              } else if (typeof message.senderId === 'object' && 
                        (message.senderId._id === userEmail || message.senderId.email === userEmail)) {
                needsUpdate = true;
                updatedSenderId = {
                  _id: `deleted_${userEmail}`,
                  name: 'Deleted User',
                  image: '',
                  isDeleted: true
                };
              }
              
              // If the user is in the readBy array, update it too
              let updatedReadBy;
              if (Array.isArray(message.readBy)) {
                updatedReadBy = message.readBy.map((reader: any) => {
                  if (typeof reader === 'string' && reader === userEmail) {
                    return `deleted_${userEmail}`;
                  } else if (typeof reader === 'object' && 
                            (reader._id === userEmail || reader.email === userEmail)) {
                    return {
                      _id: `deleted_${userEmail}`,
                      name: 'Deleted User',
                      image: '',
                      isDeleted: true
                    };
                  }
                  return reader;
                });
                
                // Only mark as needing update if readBy was changed
                if (JSON.stringify(updatedReadBy) !== JSON.stringify(message.readBy)) {
                  needsUpdate = true;
                }
              }
              
              // Update the message if needed
              if (needsUpdate) {
                const updateData: any = {};
                
                if (updatedSenderId) {
                  updateData.senderId = updatedSenderId;
                }
                
                if (updatedReadBy) {
                  updateData.readBy = updatedReadBy;
                }
                
                await updateDoc(doc(messagesCollection, messageDoc.id), updateData);
                messagesUpdated++;
              }
            }
          }
        }
      }
      
      // 3. Finally delete the user from the users collection
      await deleteDoc(doc(usersCollection, userEmail));
      userDeleted = true;
    }

    if (!surveyDeleted && !userDeleted) {
      return NextResponse.json(
        { error: 'No user data found to delete' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'User data deleted successfully',
      details: {
        surveyDeleted,
        userDeleted,
        conversationsUpdated,
        messagesUpdated
      }
    }, { status: 200 });
  } catch (error) {
    console.error('Error deleting user data:', error);
    return NextResponse.json(
      { error: 'Failed to delete user data' },
      { status: 500 }
    );
  }
} 