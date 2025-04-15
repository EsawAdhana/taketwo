'use client';

import { useEffect, useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { FiSettings, FiHome } from 'react-icons/fi';
import { useMessageNotifications } from '@/contexts/MessageNotificationContext';

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

export default function MessagesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { refreshUnreadCount, hasUnreadMessages, unreadByConversation } = useMessageNotifications();

  // Custom function to get unread count since the context one isn't working
  const getUnreadCount = (conversationId: string) => {
    const conversation = unreadByConversation.find(conv => conv.conversationId === conversationId);
    return conversation?.unreadCount || 0;
  };

  useEffect(() => {
    if (!session?.user) return;
    
    // Fetch conversations initially
    fetchConversations();
    
    // Start polling for conversations
    const startPolling = () => {
      // Clear any existing interval
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      
      // Flag to prevent overlapping requests
      let isPolling = false;
      // Counter for consecutive errors to implement backoff
      let errorCount = 0;
      // Default polling interval
      let pollingInterval = 5000; 
      
      // Set interval to fetch conversations
      const pollForConversations = async () => {
        // Skip if already polling
        if (isPolling) return;
        
        try {
          isPolling = true;
          const controller = new AbortController();
          // Set timeout to 3 seconds
          const timeoutId = setTimeout(() => controller.abort(), 3000);
          
          // Wrap fetchConversations in a timeout
          const fetchWithTimeout = async () => {
            const response = await fetch('/api/conversations', {
              cache: 'no-store',
              headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache'
              },
              signal: controller.signal
            });
            
            if (!response.ok) {
              throw new Error(`Failed to fetch conversations: ${response.status}`);
            }
            
            const result = await response.json();
            if (result.success && result.data) {
              setConversations(result.data);
            } else {
              throw new Error('Invalid response format');
            }
          };
          
          await fetchWithTimeout().finally(() => clearTimeout(timeoutId));
          await refreshUnreadCount();
          
          // Reset error count on success
          errorCount = 0;
        } catch (error) {
          // Handle errors silently when likely offline
          if (error instanceof DOMException && error.name === 'AbortError') {
            // Silent fail - request timed out
            errorCount++;
          } else if (!navigator.onLine) {
            // Browser reports we're offline - silent fail
            errorCount++;
          } else if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
            // Server is likely down - silent fail
            errorCount++;
          } else {
            // Log other unexpected errors
            console.error('Error in polling cycle:', error);
            errorCount++;
          }
        } finally {
          isPolling = false;
          
          // Implement exponential backoff if we have consecutive errors
          if (errorCount > 0) {
            // Recalculate polling interval with exponential backoff
            // Cap at 60 seconds max interval
            const maxBackoff = 60000;
            pollingInterval = Math.min(5000 * Math.pow(1.5, errorCount - 1), maxBackoff);
            
            // Reset the polling interval
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = setInterval(pollForConversations, pollingInterval);
            }
          }
        }
      };
      
      // Poll immediately
      pollForConversations();
      
      // Then set interval
      pollingIntervalRef.current = setInterval(pollForConversations, pollingInterval);
      
      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      };
    };
    
    // Start polling
    const cleanupPolling = startPolling();
    
    return () => {
      // Clean up polling on unmount
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      
      // Call cleanup function
      if (cleanupPolling) cleanupPolling();
    };
  }, [session, refreshUnreadCount]);

  const fetchConversations = async () => {
    try {
      const response = await fetch('/api/conversations', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        return;
      }
      
      const result = await response.json();
      if (result.success && result.data) {
        setConversations(result.data);
      }
    } catch (error) {
      // Silently fail for initial fetch
    }
  };

  const getConversationName = (conversation: Conversation) => {
    if (conversation.isGroup) {
      return conversation.name;
    }
    return conversation.otherParticipants[0]?.name || 'Unknown User';
  };

  const getConversationImage = (conversation: Conversation) => {
    if (conversation.isGroup) {
      // For group chats, you might want to show a group icon or the first participant's image
      return conversation.otherParticipants[0]?.image || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23cccccc"%3E%3Cpath d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/%3E%3C/svg%3E';
    }
    return conversation.otherParticipants[0]?.image || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23cccccc"%3E%3Cpath d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/%3E%3C/svg%3E';
  };

  const deleteConversation = async (e: React.MouseEvent, conversationId: string) => {
    e.preventDefault(); // Prevent navigation to conversation detail
    e.stopPropagation(); // Prevent event bubbling
    
    if (!window.confirm('Are you sure you want to delete this entire conversation? This action cannot be undone.')) {
      return;
    }
    
    setDeletingId(conversationId);
    
    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: 'DELETE',
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        // Remove the deleted conversation from the state
        setConversations(prev => prev.filter(conv => conv._id !== conversationId));
      } else {
        console.error('Error deleting conversation:', result.error);
        alert('Failed to delete conversation. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
      alert('Failed to delete conversation. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

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
                <div
                  key={conversation._id}
                  className={`relative group bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 border border-gray-100 dark:border-gray-700 overflow-hidden ${hasUnreadMessages(conversation._id) ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : ''}`}
                >
                  <Link
                    href={`/messages/${conversation._id}`}
                    className="flex items-center p-4 space-x-4"
                  >
                    <div className="relative flex-shrink-0">
                      <div className="relative w-12 h-12">
                        <Image
                          src={getConversationImage(conversation)}
                          alt={getConversationName(conversation)}
                          fill
                          sizes="(max-width: 768px) 48px, 48px"
                          className="rounded-full object-cover"
                        />
                      </div>
                      {hasUnreadMessages(conversation._id) && (
                        <div className="absolute -bottom-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-5 h-5 flex items-center justify-center px-1 border-2 border-white dark:border-gray-800">
                          {getUnreadCount(conversation._id) > 99 ? '99+' : getUnreadCount(conversation._id)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h2 className={`font-semibold truncate ${hasUnreadMessages(conversation._id) ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-gray-100'}`}>
                          {getConversationName(conversation)}
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
                          <p className={`text-sm truncate flex-1 ml-2 ${hasUnreadMessages(conversation._id) ? 'font-medium text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}>
                            {conversation.lastMessage.content}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>

                  {/* Date Span moved here and positioned bottom-right */}
                  <span className="absolute bottom-4 right-4 text-sm text-gray-500 dark:text-gray-400">
                    {new Date(conversation.updatedAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: new Date(conversation.updatedAt).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                    })}
                  </span>

                  {/* Delete button positioned top-right */}
                  <button
                    onClick={(e) => deleteConversation(e, conversation._id)}
                    disabled={deletingId === conversation._id}
                    className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                    title="Delete conversation"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
} 