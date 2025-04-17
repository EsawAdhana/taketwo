'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { useSocket } from './SocketContext';

interface UnreadConversation {
  conversationId: string;
  unreadCount: number;
}

interface MessageNotificationContextType {
  unreadCount: number;
  unreadByConversation: UnreadConversation[];
  refreshUnreadCount: () => Promise<void>;
  decrementUnreadCount: () => void;
  hasUnreadMessages: (conversationId: string) => boolean;
  getUnreadCount: (conversationId: string) => number;
}

const MessageNotificationContext = createContext<MessageNotificationContextType | undefined>(undefined);

export function MessageNotificationProvider({ children }: { children: React.ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadByConversation, setUnreadByConversation] = useState<UnreadConversation[]>([]);
  const { data: session } = useSession();
  const pathname = usePathname();
  const isFetchingRef = useRef(false);
  const { socket, isConnected } = useSocket();
  
  const fetchUnreadCount = useCallback(async () => {
    if (!session?.user || isFetchingRef.current) return;
    
    try {
      isFetchingRef.current = true;
      const controller = new AbortController();
      // Set timeout to prevent long-hanging requests
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const response = await fetch('/api/messages/unread?detailed=true', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        },
        signal: controller.signal
      }).finally(() => clearTimeout(timeoutId));
      
      if (!response.ok) {
        // Silent fail - likely server is down or we're offline
        return;
      }
      
      const result = await response.json();
      
      if (result.success) {
        setUnreadCount(result.data.unreadCount);
        setUnreadByConversation(result.data.unreadByConversation || []);
      }
    } catch (error) {
      // Only log unexpected errors
      if (error instanceof DOMException && error.name === 'AbortError') {
        // Silent fail - timeout
      } else if (!navigator.onLine) {
        // Browser reports we're offline - silent fail
      } else if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        // Server is likely down - silent fail
      } else {
        // Log other unexpected errors
        console.error('Error fetching unread messages count:', error);
      }
    } finally {
      isFetchingRef.current = false;
    }
  }, [session?.user]);
  
  const refreshUnreadCount = async () => {
    await fetchUnreadCount();
  };
  
  const decrementUnreadCount = () => {
    setUnreadCount(prev => Math.max(0, prev - 1));
  };
  
  const hasUnreadMessages = (conversationId: string) => {
    return unreadByConversation.some(conv => 
      conv.conversationId === conversationId && conv.unreadCount > 0
    );
  };
  
  const getUnreadCount = (conversationId: string) => {
    const conversation = unreadByConversation.find(conv => conv.conversationId === conversationId);
    return conversation?.unreadCount || 0;
  };
  
  // Listen for socket events related to messages and notifications
  useEffect(() => {
    if (!socket || !isConnected) return;
    
    // Listen for new messages
    socket.on('new-message', (message) => {
      // If the message is not from the current user and we're not on the message page,
      // increment the unread count for that conversation
      if (message.senderId._id !== session?.user?.email) {
        // Check if we're not currently viewing the conversation
        if (!pathname.includes(`/messages/${message.conversationId}`)) {
          setUnreadCount(prev => prev + 1);
          
          // Update unread by conversation
          setUnreadByConversation(prev => {
            const index = prev.findIndex(item => item.conversationId === message.conversationId);
            if (index >= 0) {
              const newArray = [...prev];
              newArray[index] = {
                ...newArray[index],
                unreadCount: newArray[index].unreadCount + 1
              };
              return newArray;
            } else {
              return [...prev, { conversationId: message.conversationId, unreadCount: 1 }];
            }
          });
        }
      }
    });
    
    // Listen for message read events
    socket.on('message-read', (data) => {
      if (data.userId !== session?.user?.email) {
        // Update the unread counts if needed
        refreshUnreadCount();
      }
    });
    
    return () => {
      socket.off('new-message');
      socket.off('message-read');
    };
  }, [socket, isConnected, session?.user?.email, pathname, refreshUnreadCount]);
  
  // Initial fetch of unread counts
  useEffect(() => {
    if (!session?.user) return;
    
    // Initial fetch with a slight delay to allow the app to stabilize
    const initialFetchTimer = setTimeout(() => {
      fetchUnreadCount();
    }, 500);
    
    return () => {
      clearTimeout(initialFetchTimer);
    };
  }, [session?.user, fetchUnreadCount]);
  
  return (
    <MessageNotificationContext.Provider 
      value={{ 
        unreadCount,
        unreadByConversation,
        refreshUnreadCount,
        decrementUnreadCount,
        hasUnreadMessages,
        getUnreadCount
      }}
    >
      {children}
    </MessageNotificationContext.Provider>
  );
}

export function useMessageNotifications() {
  const context = useContext(MessageNotificationContext);
  if (context === undefined) {
    throw new Error('useMessageNotifications must be used within a MessageNotificationProvider');
  }
  return context;
} 