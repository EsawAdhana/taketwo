'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { io } from 'socket.io-client';
import Link from 'next/link';
import Image from 'next/image';

interface Conversation {
  _id: string;
  userId: {
    _id: string;
    name: string;
    image: string;
  };
  otherUserId: {
    _id: string;
    name: string;
    image: string;
  };
  lastMessage?: {
    content: string;
    createdAt: string;
  };
  updatedAt: string;
}

export default function MessagesPage() {
  const { data: session } = useSession();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [socket, setSocket] = useState<any>(null);

  useEffect(() => {
    // Initialize socket connection
    const initSocket = async () => {
      await fetch('/api/socket');
      const socket = io();
      setSocket(socket);

      socket.on('connect', () => {
        console.log('Connected to socket server');
      });

      socket.on('new-message', (message) => {
        // Update conversations list when a new message is received
        fetchConversations();
      });

      return () => {
        socket.disconnect();
      };
    };

    initSocket();
  }, []);

  const fetchConversations = async () => {
    try {
      const response = await fetch('/api/conversations');
      const data = await response.json();
      setConversations(data);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  };

  useEffect(() => {
    if (session?.user) {
      fetchConversations();
    }
  }, [session]);

  const getOtherUser = (conversation: Conversation) => {
    return conversation.userId._id === session?.user?.id
      ? conversation.otherUserId
      : conversation.userId;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">My Messages</h1>
      <div className="space-y-4">
        {conversations.map((conversation) => {
          const otherUser = getOtherUser(conversation);
          return (
            <Link
              key={conversation._id}
              href={`/messages/${conversation._id}`}
              className="block p-4 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center space-x-4">
                <div className="relative w-12 h-12">
                  <Image
                    src={otherUser.image || '/default-avatar.png'}
                    alt={otherUser.name || 'User'}
                    fill
                    className="rounded-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <h2 className="font-semibold">{otherUser.name}</h2>
                  {conversation.lastMessage && (
                    <p className="text-gray-600 text-sm truncate">
                      {conversation.lastMessage.content}
                    </p>
                  )}
                </div>
                <div className="text-sm text-gray-500">
                  {new Date(conversation.updatedAt).toLocaleDateString()}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
} 