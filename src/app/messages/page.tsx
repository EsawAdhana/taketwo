'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { io } from 'socket.io-client';
import Link from 'next/link';
import Image from 'next/image';

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

  const getConversationName = (conversation: Conversation) => {
    if (conversation.isGroup) {
      return conversation.name;
    }
    return conversation.otherParticipants[0]?.name || 'Unknown User';
  };

  const getConversationImage = (conversation: Conversation) => {
    if (conversation.isGroup) {
      // For group chats, you might want to show a group icon or the first participant's image
      return conversation.otherParticipants[0]?.image || '/default-avatar.png';
    }
    return conversation.otherParticipants[0]?.image || '/default-avatar.png';
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">My Messages</h1>
      <div className="space-y-4">
        {conversations.map((conversation) => (
          <Link
            key={conversation._id}
            href={`/messages/${conversation._id}`}
            className="block p-4 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center space-x-4">
              <div className="relative w-12 h-12">
                <Image
                  src={getConversationImage(conversation)}
                  alt={getConversationName(conversation)}
                  fill
                  className="rounded-full object-cover"
                />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold">{getConversationName(conversation)}</h2>
                {conversation.isGroup && (
                  <p className="text-sm text-gray-500">
                    {conversation.otherParticipants.length + 1} participants
                  </p>
                )}
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
        ))}
      </div>
    </div>
  );
} 