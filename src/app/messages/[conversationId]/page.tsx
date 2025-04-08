'use client';

import { useEffect, useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
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
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageTimestampRef = useRef<string | null>(null);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Fetch conversation details
  const fetchConversation = async () => {
    try {
      const response = await fetch(`/api/conversations/${params.conversationId}`);
      const result = await response.json();
      
      if (response.ok && result.success && result.data) {
        setConversation(result.data);
      } else {
        console.error('Error fetching conversation:', result.error);
      }
    } catch (error) {
      console.error('Error fetching conversation:', error);
    }
  };

  // Fetch messages
  const fetchMessages = async () => {
    try {
      const response = await fetch(`/api/messages?conversationId=${params.conversationId}`);
      const result = await response.json();
      
      if (response.ok && result.success && result.data) {
        setMessages(result.data);
        
        // Update the last message timestamp
        if (result.data.length > 0) {
          lastMessageTimestampRef.current = result.data[result.data.length - 1].createdAt;
        }
        
        scrollToBottom();
      } else {
        console.error('Error fetching messages:', result.error);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Poll for new messages
  const pollForNewMessages = async () => {
    if (!lastMessageTimestampRef.current) return;
    
    try {
      const response = await fetch(
        `/api/messages/poll?conversationId=${params.conversationId}&lastMessageTimestamp=${lastMessageTimestampRef.current}`
      );
      const result = await response.json();
      
      if (response.ok && result.success && result.data && result.data.length > 0) {
        setMessages(prev => [...prev, ...result.data]);
        
        // Update the last message timestamp
        lastMessageTimestampRef.current = result.data[result.data.length - 1].createdAt;
        
        scrollToBottom();
      }
    } catch (error) {
      console.error('Error polling for new messages:', error);
    }
  };

  // Mark messages as read
  const markMessagesAsRead = async () => {
    if (!messages.length) return;
    
    // Get unread messages from other participants
    const unreadMessages = messages.filter(
      msg => 
        msg.senderId._id !== session?.user?.id && 
        !msg.readBy.some(reader => reader._id === session?.user?.id)
    );
    
    if (unreadMessages.length === 0) return;
    
    try {
      // Mark each unread message as read
      for (const message of unreadMessages) {
        await fetch('/api/messages/mark-read', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messageId: message._id,
            conversationId: params.conversationId,
          }),
        });
      }
      
      // Update the messages state to reflect read status
      setMessages(prev => 
        prev.map(msg => 
          unreadMessages.some(unread => unread._id === msg._id)
            ? { 
                ...msg, 
                readBy: [...msg.readBy, { 
                  _id: session?.user?.id || '', 
                  name: session?.user?.name || '', 
                  image: session?.user?.image || '' 
                }] 
              } 
            : msg
        )
      );
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  // Send a new message
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !session?.user) return;
    
    setIsSending(true);
    
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: newMessage,
          conversationId: params.conversationId,
        }),
      });
      
      const result = await response.json();
      
      if (response.ok && result.success && result.data) {
        setMessages(prev => [...prev, result.data]);
        setNewMessage('');
        
        // Update the last message timestamp
        lastMessageTimestampRef.current = result.data.createdAt;
        
        scrollToBottom();
      } else {
        console.error('Error sending message:', result.error);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  // Initialize the conversation
  useEffect(() => {
    if (!session) {
      router.push('/');
      return;
    }
    
    fetchConversation();
    fetchMessages();
    
    // Set up polling for new messages
    pollingIntervalRef.current = setInterval(pollForNewMessages, 3000);
    
    // Mark messages as read when the conversation is loaded
    markMessagesAsRead();
    
    return () => {
      // Clear the polling interval when the component unmounts
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [session, params.conversationId, router]);

  // Mark messages as read when the user scrolls to the bottom
  useEffect(() => {
    const handleScroll = () => {
      const messagesContainer = document.getElementById('messages-container');
      
      if (messagesContainer) {
        const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
        
        // If the user has scrolled to the bottom, mark messages as read
        if (scrollHeight - scrollTop <= clientHeight + 100) {
          markMessagesAsRead();
        }
      }
    };
    
    const messagesContainer = document.getElementById('messages-container');
    
    if (messagesContainer) {
      messagesContainer.addEventListener('scroll', handleScroll);
      
      return () => {
        messagesContainer.removeEventListener('scroll', handleScroll);
      };
    }
  }, [messages]);

  if (!conversation) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading conversation...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Header */}
      <div className="flex items-center p-4 border-b border-gray-800">
        <div className="flex items-center space-x-3">
          {conversation.isGroup ? (
            <div className="relative w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
              <span className="text-lg font-semibold text-white">
                {conversation.name.charAt(0).toUpperCase()}
              </span>
            </div>
          ) : (
            <div className="relative w-10 h-10">
              <Image
                src={conversation.otherParticipants[0]?.image || '/default-avatar.png'}
                alt={conversation.otherParticipants[0]?.name || 'User'}
                fill
                className="rounded-full object-cover"
              />
            </div>
          )}
          <div>
            <h2 className="text-lg font-semibold text-white">
              {conversation.isGroup
                ? conversation.name
                : conversation.otherParticipants[0]?.name || 'User'}
            </h2>
            <p className="text-sm text-gray-400">
              {conversation.isGroup
                ? `${conversation.participants.length} participants`
                : 'Online'}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div 
        id="messages-container"
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {isLoading ? (
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <p>No messages yet</p>
            <p className="text-sm">Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => (
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
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-white'
                }`}
              >
                {message.senderId._id !== session?.user?.id && (
                  <div className="flex items-center mb-1">
                    <div className="relative w-6 h-6 mr-2">
                      <Image
                        src={message.senderId.image || '/default-avatar.png'}
                        alt={message.senderId.name}
                        fill
                        className="rounded-full object-cover"
                      />
                    </div>
                    <span className="text-xs font-medium">
                      {message.senderId.name}
                    </span>
                  </div>
                )}
                <p>{message.content}</p>
                <div className="flex justify-end items-center mt-1">
                  <span className="text-xs opacity-70">
                    {new Date(message.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {message.senderId._id === session?.user?.id && (
                    <div className="ml-2 flex items-center">
                      {message.readBy.length > 1 ? (
                        <div className="flex -space-x-1">
                          {message.readBy
                            .filter((reader) => reader._id !== session?.user?.id)
                            .slice(0, 2)
                            .map((reader) => (
                              <div
                                key={reader._id}
                                className="relative w-4 h-4 rounded-full border border-gray-800"
                              >
                                <Image
                                  src={reader.image || '/default-avatar.png'}
                                  alt={reader.name}
                                  fill
                                  className="rounded-full object-cover"
                                />
                              </div>
                            ))}
                          {message.readBy.length > 3 && (
                            <div className="relative w-4 h-4 rounded-full bg-gray-700 flex items-center justify-center">
                              <span className="text-[8px] text-white">
                                +{message.readBy.length - 3}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs opacity-70">Sent</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-gray-800">
        <form onSubmit={sendMessage} className="flex space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isSending}
          />
          <button
            type="submit"
            className="bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            disabled={!newMessage.trim() || isSending}
          >
            {isSending ? (
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
            ) : (
              'Send'
            )}
          </button>
        </form>
      </div>
    </div>
  );
} 