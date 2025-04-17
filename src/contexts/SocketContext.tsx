'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSession } from 'next-auth/react';

// Define types for the context
interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  joinConversation: (conversationId: string) => void;
  leaveConversation: (conversationId: string) => void;
  sendMessage: (message: any) => void;
  markMessageAsRead: (data: { messageId: string, conversationId: string, userId: string }) => void;
}

// Create the context
const SocketContext = createContext<SocketContextType | undefined>(undefined);

// Create provider component
export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { data: session } = useSession();

  useEffect(() => {
    // Only initialize socket if we have a user session
    if (!session?.user) return;

    // Initialize socket connection
    const socketIo = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000', {
      auth: {
        token: document.cookie.split('; ')
          .find(row => row.startsWith('next-auth.session-token='))
          ?.split('=')[1]
      }
    });

    // Set up event listeners
    socketIo.on('connect', () => {
      console.log('Socket connected');
      setIsConnected(true);
    });

    socketIo.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    });

    // Store the socket instance
    setSocket(socketIo);

    // Clean up on unmount
    return () => {
      socketIo.disconnect();
    };
  }, [session]);

  // Function to join a conversation
  const joinConversation = (conversationId: string) => {
    if (socket && isConnected) {
      socket.emit('join-conversation', conversationId);
    }
  };

  // Function to leave a conversation
  const leaveConversation = (conversationId: string) => {
    if (socket && isConnected) {
      socket.emit('leave-conversation', conversationId);
    }
  };

  // Function to send a message
  const sendMessage = (message: any) => {
    if (socket && isConnected) {
      socket.emit('send-message', message);
    }
  };

  // Function to mark a message as read
  const markMessageAsRead = (data: { messageId: string, conversationId: string, userId: string }) => {
    if (socket && isConnected) {
      socket.emit('mark-read', data);
    }
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        joinConversation,
        leaveConversation,
        sendMessage,
        markMessageAsRead
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

// Custom hook to use the socket context
export function useSocket() {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
} 