'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { io, Socket } from 'socket.io-client';

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
  const socketRef = useRef<Socket | null>(null);
  
  const fetchUnreadCount = useCallback(async () => {
    if (!session?.user) return;
    
    try {
      const response = await fetch('/api/messages/unread?detailed=true');
      const result = await response.json();
      
      if (response.ok && result.success) {
        setUnreadCount(result.data.unreadCount);
        setUnreadByConversation(result.data.unreadByConversation || []);
      }
    } catch (error) {
      console.error('Error fetching unread messages count:', error);
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
  
  // Initialize socket server
  const initSocketServer = useCallback(async () => {
    try {
      const response = await fetch('/api/socket');
      if (!response.ok) {
        console.error('Failed to initialize Socket.IO server');
        return false;
      }
      return true;
    } catch (error) {
      console.error('Socket server initialization error:', error);
      return false;
    }
  }, []);
  
  useEffect(() => {
    // Skip if no user is logged in
    if (!session?.user) return;
    
    let socketIo: Socket | null = null;
    
    const setupSocket = async () => {
      // First initialize the socket server
      await initSocketServer();
      
      await fetchUnreadCount(); // Initial fetch
      
      // Set up socket connection for real-time updates
      const socketUrl = window.location.origin; // Use same origin to avoid CORS issues
      
      socketIo = io(socketUrl, {
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        forceNew: true,
        path: '/api/socketio'
      });
      
      socketRef.current = socketIo;
      
      socketIo.on('connect', () => {
        console.log('Notification socket connected');
      });
      
      socketIo.on('connect_error', (err) => {
        console.error('Socket connection error:', err);
        // Try to fetch the count manually as a fallback
        fetchUnreadCount();
      });
      
      socketIo.on('new-message', () => {
        fetchUnreadCount();
      });
      
      socketIo.on('messages-read', () => {
        fetchUnreadCount();
      });
      
      socketIo.on('disconnect', (reason) => {
        console.log('Notification socket disconnected:', reason);
        // Try to fetch the count manually as a fallback
        fetchUnreadCount();
      });
    };
    
    setupSocket();
    
    // Poll for updates as a fallback mechanism
    const intervalId = setInterval(() => {
      fetchUnreadCount();
    }, 30000); // Check every 30 seconds
    
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      clearInterval(intervalId);
    };
  }, [session?.user, fetchUnreadCount, initSocketServer]);
  
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