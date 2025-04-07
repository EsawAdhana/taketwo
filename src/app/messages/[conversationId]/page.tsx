'use client';

import { useEffect, useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { io } from 'socket.io-client';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

interface Participant {
  _id: string;
  name: string;
  image: string;
}

interface Message {
  _id: string;
  content: string;
  senderId: {
    _id: string;
    name: string;
    image: string;
  };
  readBy: {
    _id: string;
    name: string;
    image: string;
  }[];
  createdAt: string;
}

interface Conversation {
  _id: string;
  participants: Participant[];
  otherParticipants: Participant[];
  isGroup: boolean;
  name: string;
}

export default function ConversationPage({
  params,
}: {
  params: { conversationId: string };
}) {
  const { data: session } = useSession();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [socket, setSocket] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize socket connection
    const initSocket = async () => {
      await fetch('/api/socket');
      const socket = io();
      setSocket(socket);

      socket.on('connect', () => {
        console.log('Connected to socket server');
        socket.emit('join-conversation', params.conversationId);
      });

      socket.on('new-message', (message: Message) => {
        setMessages((prev) => [...prev, message]);
        scrollToBottom();
      });

      socket.on('message-read', (data: { messageId: string; userId: string }) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === data.messageId
              ? {
                  ...msg,
                  readBy: [...msg.readBy, { _id: data.userId }],
                }
              : msg
          )
        );
      });

      return () => {
        socket.emit('leave-conversation', params.conversationId);
        socket.disconnect();
      };
    };

    initSocket();
  }, [params.conversationId]);

  const fetchMessages = async () => {
    try {
      const response = await fetch(`/api/messages?conversationId=${params.conversationId}`);
      const data = await response.json();
      setMessages(data);
      scrollToBottom();
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const fetchConversation = async () => {
    try {
      const response = await fetch('/api/conversations');
      const data = await response.json();
      const currentConversation = data.find((conv: Conversation) => conv._id === params.conversationId);
      setConversation(currentConversation);
    } catch (error) {
      console.error('Error fetching conversation:', error);
    }
  };

  useEffect(() => {
    if (session?.user) {
      fetchMessages();
      fetchConversation();
    }
  }, [session, params.conversationId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !socket || !conversation) return;

    const messageData = {
      content: newMessage,
      conversationId: params.conversationId,
    };

    socket.emit('send-message', messageData);
    setNewMessage('');
  };

  if (!conversation) {
    return <div>Loading...</div>;
  }

  const getConversationName = () => {
    if (conversation.isGroup) {
      return conversation.name;
    }
    return conversation.otherParticipants[0]?.name || 'Unknown User';
  };

  const getConversationImage = () => {
    if (conversation.isGroup) {
      return '/group-avatar.png'; // You might want to use a different default image for groups
    }
    return conversation.otherParticipants[0]?.image || '/default-avatar.png';
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center space-x-4 mb-6">
          <div className="relative w-12 h-12">
            <Image
              src={getConversationImage()}
              alt={getConversationName()}
              fill
              className="rounded-full object-cover"
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{getConversationName()}</h1>
            {conversation.isGroup && (
              <p className="text-sm text-gray-500">
                {conversation.otherParticipants.length + 1} participants
              </p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-4 h-[600px] flex flex-col">
          <div className="flex-1 overflow-y-auto mb-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message._id}
                className={`flex ${
                  message.senderId._id === session?.user?.id
                    ? 'justify-end'
                    : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[70%] rounded-lg p-3 ${
                    message.senderId._id === session?.user?.id
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100'
                  }`}
                >
                  <p>{message.content}</p>
                  <div className="flex items-center justify-end space-x-1 mt-1">
                    <p className="text-xs opacity-70">
                      {new Date(message.createdAt).toLocaleTimeString()}
                    </p>
                    {message.senderId._id === session?.user?.id && (
                      <span className="text-xs">
                        {message.readBy.length > 1 ? '✓✓' : '✓'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="flex space-x-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
} 