'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { io } from 'socket.io-client';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

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
  const [socket, setSocket] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    // Initialize socket connection
    const initSocket = async () => {
      await fetch('/api/socket');
      const socket = io();
      setSocket(socket);

      socket.on('connect', () => {
        // ... existing code ...
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
      const result = await response.json();
      if (result.success && result.data) {
        setConversations(result.data);
      } else {
        // ... existing code ...
      }
    } catch (error) {
      // ... existing code ...
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
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">My Messages</h1>
      <div className="space-y-4">
        {conversations.map((conversation) => (
          <div
            key={conversation._id}
            className="block p-4 border rounded-lg hover:bg-gray-50 transition-colors relative"
          >
            <Link
              href={`/messages/${conversation._id}`}
              className="flex items-center space-x-4"
            >
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
            </Link>
            
            {/* Delete button */}
            <button
              onClick={(e) => deleteConversation(e, conversation._id)}
              disabled={deletingId === conversation._id}
              className="absolute top-2 right-2 text-red-500 p-1 rounded-full hover:bg-red-50"
              title="Delete conversation"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              {deletingId === conversation._id && (
                <span className="absolute -top-1 -right-1 h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
} 