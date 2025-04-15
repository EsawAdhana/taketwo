'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';

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
  
  useEffect(() => {
    if (!session?.user) return;
    
    // Initial fetch with a slight delay to allow the app to stabilize
    const initialFetchTimer = setTimeout(() => {
      fetchUnreadCount();
    }, 500);
    
    // Use a staggered interval to reduce network congestion
    const intervalDelay = 10000 + Math.random() * 2000; // 10-12 seconds
    
    const intervalId = setInterval(() => {
      // Only fetch if browser reports we're online
      if (navigator.onLine) {
        fetchUnreadCount();
      }
    }, intervalDelay);
    
    return () => {
      clearTimeout(initialFetchTimer);
      clearInterval(intervalId);
      // Reset fetching flag on cleanup to prevent stuck state
      isFetchingRef.current = false;
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