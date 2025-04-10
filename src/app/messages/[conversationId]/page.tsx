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
  const [isDeleting, setIsDeleting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
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

  // Delete the current conversation
  const deleteConversation = async () => {
    if (!window.confirm('Are you sure you want to delete this entire conversation? This action cannot be undone.')) {
      return;
    }
    
    setIsDeleting(true);
    
    try {
      const response = await fetch(`/api/conversations/${params.conversationId}`, {
        method: 'DELETE',
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        // Redirect to the messages page after successful deletion
        router.push('/messages');
      } else {
        console.error('Error deleting conversation:', result.error);
        alert('Failed to delete conversation. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
      alert('Failed to delete conversation. Please try again.');
    } finally {
      setIsDeleting(false);
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-pulse text-gray-600">Loading conversation...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Conversation header */}
      <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {conversation && (
            <>
              <button 
                onClick={() => router.push('/messages')}
                className="p-1 rounded-full hover:bg-gray-100"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="flex items-center space-x-2">
                <div className="relative w-10 h-10">
                  <Image
                    src={conversation.otherParticipants[0]?.image || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23cccccc"%3E%3Cpath d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/%3E%3C/svg%3E'}
                    alt={conversation.otherParticipants[0]?.name || 'Unknown'}
                    fill
                    className="rounded-full object-cover"
                  />
                </div>
                <div>
                  <h1 className="font-semibold text-gray-900">
                    {conversation.isGroup
                      ? conversation.name
                      : conversation.otherParticipants[0]?.name || 'Unknown User'}
                  </h1>
                  {conversation.isGroup && (
                    <p className="text-sm text-gray-500">
                      {conversation.participants.length} participants
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
        
        {/* Menu button for additional options */}
        <div className="flex items-center">
          <div className="relative">
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-full hover:bg-gray-100"
              aria-label="Conversation menu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
            
            {/* Dropdown menu */}
            {showMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border border-gray-200">
                <div className="py-1">
                  <button
                    onClick={deleteConversation}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                    disabled={isDeleting}
                  >
                    {isDeleting ? 'Deleting...' : 'Delete conversation'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div 
        id="messages-container"
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50"
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
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-900 shadow-sm border border-gray-200'
                }`}
              >
                {message.senderId._id !== session?.user?.id && (
                  <div className="flex items-center mb-1">
                    <div className="relative w-6 h-6 mr-2">
                      <Image
                        src={message.senderId.image || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23cccccc"%3E%3Cpath d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/%3E%3C/svg%3E'}
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
                                className="relative w-4 h-4 rounded-full border border-white"
                              >
                                <Image
                                  src={reader.image || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23cccccc"%3E%3Cpath d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/%3E%3C/svg%3E'}
                                  alt={reader.name}
                                  fill
                                  className="rounded-full object-cover"
                                />
                              </div>
                            ))}
                          {message.readBy.length > 3 && (
                            <div className="relative w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center">
                              <span className="text-[8px] text-gray-600">
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
      <div className="p-4 border-t border-gray-200 bg-white">
        <form onSubmit={sendMessage} className="flex space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-gray-50 text-gray-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-200"
            disabled={isSending}
          />
          <button
            type="submit"
            className="bg-blue-500 text-white rounded-lg px-4 py-2 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
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