'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { query, where, messagesCollection, onSnapshot, Timestamp } from '@/lib/firebase';
import { getUnreadMessages } from '@/lib/firebaseService';

interface UnreadConversation {
  conversationId: string;
  unreadCount: number;
}

interface MessageNotificationContextType {
  unreadCount: number;
  unreadByConversation: UnreadConversation[];
  refreshUnreadCount: () => Promise<void>;
  decrementUnreadCount: (conversationId: string) => void;
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
  const unsubscribeRef = useRef<() => void | null>(null);
  
  const fetchUnreadCount = useCallback(async () => {
    if (!session?.user?.email || isFetchingRef.current) return;
    
    try {
      isFetchingRef.current = true;
      
      // Use Firebase service to get unread messages
      const unreadData = await getUnreadMessages(session.user.email);
      
      setUnreadCount(unreadData.total);
      setUnreadByConversation(unreadData.byConversation);
    } catch (error) {
      console.error('Error fetching unread messages count:', error);
    } finally {
      isFetchingRef.current = false;
    }
  }, [session?.user?.email]);
  
  const setupRealtimeUnreadMessages = useCallback(() => {
    if (!session?.user?.email) return;
    
    // Clean up any existing subscription
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    
    try {
      // Set up a real-time listener for messages
      const q = query(
        messagesCollection,
        where('senderId', '!=', session.user.email)
      );
      
      const unsubscribe = onSnapshot(q, async () => {
        // When we get updates, fetch the current unread state
        await fetchUnreadCount();
      }, (error) => {
        console.error('Error in real-time unread messages listener:', error);
      });
      
      unsubscribeRef.current = unsubscribe;
      return unsubscribe;
    } catch (error) {
      console.error('Error setting up real-time unread messages:', error);
    }
  }, [session?.user?.email, fetchUnreadCount]);
  
  const refreshUnreadCount = async () => {
    await fetchUnreadCount();
  };
  
  const decrementUnreadCount = (conversationId: string) => {
    // Update unread count state
    setUnreadByConversation(prev => {
      const updatedConversations = prev.map(conv => {
        if (conv.conversationId === conversationId) {
          return {
            ...conv,
            unreadCount: Math.max(0, conv.unreadCount - 1)
          };
        }
        return conv;
      });
      
      // Recalculate total
      const newTotal = updatedConversations.reduce((total, conv) => total + conv.unreadCount, 0);
      setUnreadCount(newTotal);
      
      return updatedConversations;
    });
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
  
  useEffect(() => {
    if (!session?.user?.email) return;
    
    // Initial fetch
    fetchUnreadCount();
    
    // Set up real-time listener
    const unsubscribe = setupRealtimeUnreadMessages();
    
    return () => {
      // Clean up on unmount
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [session?.user?.email, fetchUnreadCount, setupRealtimeUnreadMessages]);
  
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