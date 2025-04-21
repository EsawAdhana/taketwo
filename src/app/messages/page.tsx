'use client';

import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useMessageNotifications } from '@/contexts/MessageNotificationContext';
import { useFirebaseRealtime } from '@/hooks/useFirebaseRealtime';
import { 
  conversationsCollection, 
  query, 
  where, 
  orderBy,
  Timestamp,
  doc,
  getDoc,
  db,
  usersCollection
} from '@/lib/firebase';
import { 
  FirebaseConversation,
  getConversationsByUser,
  deleteConversation as deleteFirebaseConversation,
  enrichParticipantsWithUserData
} from '@/lib/firebaseService';

interface Participant {
  _id: string;
  name: string;
  image: string;
}

interface Conversation {
  _id: string;
  participants: Participant[];
  otherParticipants: Participant[];
  lastMessage?: {
    content: string;
    createdAt: string;
  };
  isGroup: boolean;
  name: string;
  updatedAt: string;
}

// Helper function to compare two conversations for equality
function areConversationsEqual(prev: Conversation, next: Conversation): boolean {
  // ID must be same
  if (prev._id !== next._id) return false;
  
  // Check if lastMessage has changed
  if (prev.lastMessage?.content !== next.lastMessage?.content) return false;
  if (prev.lastMessage?.createdAt !== next.lastMessage?.createdAt) return false;
  
  // Check if updatedAt has changed
  if (prev.updatedAt !== next.updatedAt) return false;
  
  // Assume they're the same if we got here
  return true;
}

export default function MessagesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { refreshUnreadCount, hasUnreadMessages, unreadByConversation } = useMessageNotifications();

  // Custom function to get unread count since the context one isn't working
  const getUnreadCount = (conversationId: string) => {
    const conversation = unreadByConversation.find(conv => conv.conversationId === conversationId);
    return conversation?.unreadCount || 0;
  };

  // Function to transform Firebase data to conversation format
  const transformConversationData = useCallback(async (data: FirebaseConversation[], userEmail: string) => {
    if (!data || data.length === 0 || !userEmail) return [];
    
    // Process each conversation with detailed participant data
    const processedConversations = await Promise.all(data.map(async (conv: FirebaseConversation) => {
      // Enrich participants with full user data including images
      const participantsWithDetail = await enrichParticipantsWithUserData(
        Array.isArray(conv.participants) ? conv.participants : []
      );
      
      // Filter to get other participants with complete data
      const otherParticipants = participantsWithDetail
        .filter((p: any) => p._id !== userEmail && p.email !== userEmail)
        .map((p: any) => ({
          _id: p._id,
          name: p.name || '',
          image: p.image || ''
        }));
      
      return {
        _id: conv._id as string,
        participants: participantsWithDetail,
        otherParticipants,
        lastMessage: conv.lastMessage 
          ? {
              content: typeof conv.lastMessage === 'string' 
                ? '' 
                : conv.lastMessage.content || '',
              createdAt: typeof conv.lastMessage === 'string'
                ? new Date().toISOString()
                : conv.lastMessage.createdAt instanceof Timestamp
                  ? conv.lastMessage.createdAt.toDate().toISOString()
                  : new Date().toISOString()
            }
          : undefined,
        isGroup: conv.isGroup || false,
        name: conv.name || '',
        updatedAt: conv.updatedAt instanceof Timestamp 
          ? conv.updatedAt.toDate().toISOString() 
          : conv.updatedAt instanceof Date
            ? conv.updatedAt.toISOString()
            : new Date().toISOString()
      };
    }));
    
    return processedConversations;
  }, []);

  // Modify the fetchConversations function to use the transform function
  const fetchConversations = async () => {
    if (!session?.user?.email) return;
    
    try {
      // Get conversations from Firebase
      const result = await getConversationsByUser(session.user.email as string);
      
      if (result && result.length > 0) {
        // Transform Firebase data using our helper function
        const conversationData = await transformConversationData(result, session.user.email);
        setConversations(conversationData);
      }
      
      // Refresh unread counts after fetching conversations
      await refreshUnreadCount();
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  };

  // Set up real-time listener for conversations
  // Memoize the query to prevent it from being recreated on every render
  const conversationsQuery = useCallback(() => {
    if (!session?.user?.email) return null;
    
    return query(
      conversationsCollection,
      where('participants', 'array-contains', session.user.email as string),
      orderBy('updatedAt', 'desc')
    );
  }, [session?.user?.email]);

  // Store the query result to avoid recreation on every render
  const queryRef = useRef(conversationsQuery());

  // Update the query ref when the session changes
  useEffect(() => {
    queryRef.current = conversationsQuery();
  }, [conversationsQuery]);

  const previousConversationsRef = useRef<Conversation[]>([]);
  const isFirstRenderRef = useRef(true);
  
  // Batched updates ref to prevent multiple state updates
  const batchedUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // When Firebase sends new data, use this batched update pattern
  const batchedSetConversations = useCallback((newConversations: Conversation[]) => {
    // Clear any existing timeout
    if (batchedUpdateTimeoutRef.current) {
      clearTimeout(batchedUpdateTimeoutRef.current);
    }
    
    // Set a new timeout to batch updates
    batchedUpdateTimeoutRef.current = setTimeout(() => {
      // Compare new data with previous data
      const prevConversations = previousConversationsRef.current;
      
      // Only update if there are actual changes
      if (isFirstRenderRef.current || newConversations.length !== prevConversations.length || 
          newConversations.some((conv, index) => {
            return index >= prevConversations.length || 
                   !areConversationsEqual(conv, prevConversations[index]);
          })) {
        setConversations(newConversations);
        previousConversationsRef.current = newConversations;
        isFirstRenderRef.current = false;
      }
      
      batchedUpdateTimeoutRef.current = null;
    }, 50); // Small timeout to batch rapid updates
  }, []);

  // Use the transform function in Firebase real-time updates too
  const { data: realtimeConversations } = useFirebaseRealtime<FirebaseConversation[]>({
    subscriptionType: 'query',
    target: queryRef.current!,
    enabled: !!session?.user?.email && !!queryRef.current,
    onData: async (data) => {
      if (!data || data.length === 0 || !session?.user?.email) return;
      
      try {
        // Transform Firebase data using our helper function
        const conversationData = await transformConversationData(data, session.user.email);
        batchedSetConversations(conversationData);
      } catch (error) {
        console.error('Error processing real-time data:', error);
      }
    }
  });

  // Refresh unread counts separately when realtimeConversations changes
  useEffect(() => {
    if (realtimeConversations) {
      // Add a slight delay to prevent refresh loops
      const timer = setTimeout(() => {
        refreshUnreadCount();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [realtimeConversations, refreshUnreadCount]);

  // Initial fetch
  useEffect(() => {
    if (!session?.user?.email) return;
    
    // Initial data fetch before Firebase real-time updates take over
    fetchConversations();
  }, [session]);

  // Helper function to get user display name from survey firstName or other sources
  const getName = async (userId: string): Promise<string> => {
    try {
      // First check if user has a survey with firstName
      const surveyRef = doc(db, 'surveys', userId);
      const surveyDoc = await getDoc(surveyRef);
      
      if (surveyDoc.exists()) {
        const surveyData = surveyDoc.data();
        if (surveyData.firstName && typeof surveyData.firstName === 'string' && surveyData.firstName.trim() !== '') {
          return surveyData.firstName;
        }
      }
      
      // Then check user document
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.name && userData.name !== 'User' && userData.name.trim() !== '') {
          return userData.name;
        }
      }
      
      // Use email username as fallback
      if (userId.includes('@')) {
        const username = userId.split('@')[0];
        return username.charAt(0).toUpperCase() + username.slice(1);
      }
      
      return 'User';
    } catch (error) {
      console.error('Error getting user name:', error);
      
      // Fallback to extracting from email
      if (userId.includes('@')) {
        const username = userId.split('@')[0];
        return username.charAt(0).toUpperCase() + username.slice(1);
      }
      
      return 'User';
    }
  };

  // Cached participant names to avoid repeated lookups
  const [participantNames, setParticipantNames] = useState<Record<string, string>>({});

  // Memoize the getName function to prevent recreating it on each render
  const memoizedGetName = useCallback(async (userId: string): Promise<string> => {
    return getName(userId);
  }, []);

  // Update getConversationName to use the getName function with caching
  const getConversationName = useCallback(async (conversation: Conversation): Promise<string> => {
    if (conversation.isGroup) {
      return conversation.name;
    }
    
    // If this conversation has only one other participant, get their name
    if (conversation.otherParticipants.length > 0) {
      const userId = conversation.otherParticipants[0]._id;
      
      // Check if we already have the name cached
      if (participantNames[userId]) {
        return participantNames[userId];
      }
      
      // Otherwise look it up
      const name = await memoizedGetName(userId);
      
      // Cache the result
      setParticipantNames(prev => ({
        ...prev,
        [userId]: name
      }));
      
      return name;
    }
    
    return 'Unknown User';
  }, [memoizedGetName, participantNames]);

  const getConversationImage = (conversation: Conversation) => {
    // Default fallback image for missing profile pictures
    const defaultProfileImage = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23cccccc"%3E%3Cpath d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/%3E%3C/svg%3E';
    
    if (conversation.isGroup) {
      // For group chats, use a group icon or the first participant's image
      return conversation.otherParticipants[0]?.image || defaultProfileImage;
    } else if (conversation.otherParticipants.length > 0) {
      // For DMs, use the other participant's profile picture if available
      const otherParticipant = conversation.otherParticipants[0];
      if (otherParticipant.image) {
        return otherParticipant.image;
      }
    }
    
    // Fallback for any other case
    return defaultProfileImage;
  };

  // Memoize the getConversationImage function
  const memoizedGetConversationImage = useCallback((conversation: Conversation) => {
    return getConversationImage(conversation);
  }, []);

  const deleteConversation = async (e: React.MouseEvent, conversationId: string) => {
    e.preventDefault(); // Prevent navigation to conversation detail
    e.stopPropagation(); // Prevent event bubbling
    
    if (!window.confirm('Are you sure you want to delete this entire conversation? This action cannot be undone.')) {
      return;
    }
    
    setDeletingId(conversationId);
    
    try {
      // Use Firebase service to delete the conversation
      const result = await deleteFirebaseConversation(conversationId);
      
      if (result && result.success) {
        // Remove will happen automatically via the real-time listener, but we can also do it manually
        setConversations(prev => prev.filter(conv => conv._id !== conversationId));
      } else {
        console.error('Error deleting conversation');
        alert('Failed to delete conversation. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
      alert('Failed to delete conversation. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  // Modified component to handle displaying conversation names properly - wrapped in memo to prevent unnecessary re-renders
  const ConversationItem = memo(({ conversation, deleteConversation, hasUnreadMessages, getUnreadCount, deletingId }: { 
    conversation: Conversation;
    deleteConversation: (e: React.MouseEvent, id: string) => void;
    hasUnreadMessages: (id: string) => boolean;
    getUnreadCount: (id: string) => number;
    deletingId: string | null;
  }) => {
    const [displayName, setDisplayName] = useState<string>('');
    const conversationId = conversation._id;
    
    // Get the conversation name on mount and when conversation changes
    useEffect(() => {
      let isMounted = true;
      
      const loadName = async () => {
        if (conversation.isGroup) {
          if (isMounted) setDisplayName(conversation.name);
        } else {
          try {
            const name = await getConversationName(conversation);
            if (isMounted) setDisplayName(name);
          } catch (error) {
            console.error('Error loading conversation name:', error);
            if (isMounted) setDisplayName('Unknown User');
          }
        }
      };
      
      loadName();
      
      return () => {
        isMounted = false;
      };
    }, [conversation, conversationId, getConversationName]);
    
    // Create a stable version of the delete handler
    const handleDelete = useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      deleteConversation(e, conversationId);
    }, [conversationId, deleteConversation]);
    
    // Completely stable rendering with no state changes on hover
    return (
      <div className="relative mb-4">
        {/* 
          Use a stable class structure with no state-based classes that could change during hover 
          Note: Using standard Tailwind CSS classes only - no custom transitions or animations
        */}
        <div 
          className={`
            conversation-item
            bg-white dark:bg-gray-800 
            rounded-xl shadow hover:shadow-md 
            border border-gray-100 dark:border-gray-700 
            overflow-hidden
            ${hasUnreadMessages(conversationId) ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : ''}
          `}
          style={{ position: 'relative' }} /* Use inline styles for critical positioning */
        >
          {/* Delete button with visibility controlled by CSS only */}
          <div className="delete-button"
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              zIndex: 20,
              opacity: 0, /* Hidden by default */
              transition: 'none' /* No transitions that could cause flicker */
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <button
              onClick={handleDelete}
              disabled={deletingId === conversationId}
              className="p-2 rounded-full bg-white dark:bg-gray-700 shadow-md text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer"
              title="Delete conversation"
              aria-label="Delete conversation"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>

          {/* Message content */}
          <div className="p-4 flex items-center space-x-4">
            <div className="relative flex-shrink-0">
              <div className="relative w-12 h-12">
                <Image
                  src={memoizedGetConversationImage(conversation)}
                  alt={displayName || 'Loading...'}
                  fill
                  sizes="(max-width: 768px) 48px, 48px"
                  className="rounded-full object-cover"
                />
              </div>
              {hasUnreadMessages(conversationId) && (
                <div className="absolute -bottom-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 border-white dark:border-gray-800">
                  {getUnreadCount(conversationId) > 99 ? '99+' : getUnreadCount(conversationId)}
                </div>
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h2 className={`font-semibold truncate ${hasUnreadMessages(conversationId) ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-gray-100'}`}>
                  {displayName || (conversation.isGroup ? conversation.name : 'Loading...')}
                </h2>
              </div>
              <div className="flex items-center justify-between mt-1">
                {conversation.isGroup && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    {conversation.otherParticipants.length + 1} participants
                  </p>
                )}
                {conversation.lastMessage && (
                  <p className={`text-sm truncate flex-1 ml-2 ${hasUnreadMessages(conversationId) ? 'font-medium text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}>
                    {conversation.lastMessage.content}
                  </p>
                )}
              </div>
            </div>

            {/* Date */}
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {new Date(conversation.updatedAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: new Date(conversation.updatedAt).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
              })}
            </span>
          </div>
          
          {/* Clickable overlay with no transitions or animations */}
          <Link
            href={`/messages/${conversationId}`}
            className="absolute inset-0 z-10 cursor-pointer"
            aria-label={`Open conversation with ${displayName || 'Loading...'}`}
            style={{ transition: 'none' }}
            onClick={(e) => {
              // Don't navigate if we're clicking on the delete button
              if ((e.target as HTMLElement).closest('button')) {
                e.preventDefault();
              }
            }}
          />
        </div>

        {/* Custom styles injected once per component to control hover behavior */}
        <style jsx>{`
          /* Use direct CSS with no transitions that could cause flicker */
          .conversation-item:hover .delete-button {
            opacity: 1 !important;
          }
        `}</style>
      </div>
    );
  }, (prevProps, nextProps) => {
    // Only re-render if something important changed
    // 1. If conversation ID changed (shouldn't happen)
    if (prevProps.conversation._id !== nextProps.conversation._id) return false;
    
    // 2. If delete state changed
    if (prevProps.deletingId !== nextProps.deletingId) return false;
    
    // 3. If unread state changed
    const prevUnread = prevProps.hasUnreadMessages(prevProps.conversation._id);
    const nextUnread = nextProps.hasUnreadMessages(nextProps.conversation._id);
    if (prevUnread !== nextUnread) return false;
    
    // 4. If unread count changed
    const prevCount = prevProps.getUnreadCount(prevProps.conversation._id);
    const nextCount = nextProps.getUnreadCount(nextProps.conversation._id);
    if (prevCount !== nextCount) return false;
    
    // 5. If lastMessage changed
    if (prevProps.conversation.lastMessage?.content !== nextProps.conversation.lastMessage?.content) return false;
    
    // 6. If updatedAt changed
    if (prevProps.conversation.updatedAt !== nextProps.conversation.updatedAt) return false;
    
    // If we get here, props haven't meaningfully changed, don't re-render
    return true; 
  });
  
  // For debugging purposes
  ConversationItem.displayName = 'ConversationItem';

  // Memoize the hasUnreadMessages function to avoid recreating it
  const stableHasUnreadMessages = useCallback((id: string) => {
    return hasUnreadMessages(id);
  }, [hasUnreadMessages]);
  
  // Memoize the getUnreadCount function to avoid recreating it
  const stableGetUnreadCount = useCallback((id: string) => {
    return getUnreadCount(id);
  }, [getUnreadCount]);
  
  // Memoize the deleteConversation function to avoid recreating it
  const stableDeleteConversation = useCallback((e: React.MouseEvent, id: string) => {
    return deleteConversation(e, id);
  }, [deleteConversation]);

  return (
    <main className="min-h-screen bg-white dark:bg-gray-900 py-4 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Messages</h1>
        {/* Conversations List */}
        <div className="container mx-auto px-4 py-6">
          <div className="max-w-3xl mx-auto space-y-4">
            {conversations.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center border border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                </div>
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">No messages yet</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">Start connecting with potential roommates!</p>
              </div>
            ) : (
              conversations.map((conversation) => (
                <ConversationItem
                  key={conversation._id}
                  conversation={conversation}
                  deleteConversation={stableDeleteConversation}
                  hasUnreadMessages={stableHasUnreadMessages}
                  getUnreadCount={stableGetUnreadCount}
                  deletingId={deletingId}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
} 