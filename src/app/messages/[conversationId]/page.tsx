'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FiFlag, FiX, FiUsers, FiMapPin, FiCalendar, FiList, FiStar, FiInfo } from 'react-icons/fi';
import UserProfileModal from '@/components/UserProfileModal';
import ReportUserModal from '@/components/ReportUserModal';
import ChatInfoModal from '@/components/ChatInfoModal';
import { useMessageNotifications } from '@/contexts/MessageNotificationContext';
import { formatDistance } from 'date-fns';
import ReportModal from '@/components/ReportModal';
import { usePolling } from '@/hooks/usePolling';

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
  const [showChatInfo, setShowChatInfo] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedUser, setSelectedUser] = useState<{email: string, name: string, image: string} | null>(null);
  const [loadingUserProfile, setLoadingUserProfile] = useState(false);
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const { refreshUnreadCount } = useMessageNotifications();
  const lastMessageTimestampRef = useRef<string | null>(null);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    // Use setTimeout to ensure DOM has updated before scrolling
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
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
    // Skip if missing data
    if (!lastMessageTimestampRef.current || !session?.user?.email) {
      return;
    }
    
    const response = await fetch(
      `/api/messages/poll?conversationId=${params.conversationId}&lastMessageTimestamp=${encodeURIComponent(lastMessageTimestampRef.current)}`, 
      {
        // Add cache control to prevent duplicate requests
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        },
        signal: usePollingState.abortController?.signal
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch messages: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.success && result.data.length > 0) {
      // Add the new messages to our list
      const newMessages = result.data;
      
      setMessages(prev => {
        // Avoid duplicates by checking IDs
        const currentMessageIds = new Set(prev.map((msg: Message) => msg._id));
        const uniqueNewMessages = newMessages.filter((msg: Message) => !currentMessageIds.has(msg._id));
        
        if (uniqueNewMessages.length > 0) {
          const updatedMessages = [...prev, ...uniqueNewMessages];
          
          // Update last message timestamp
          if (uniqueNewMessages.length > 0) {
            const latestMessage = uniqueNewMessages[uniqueNewMessages.length - 1];
            lastMessageTimestampRef.current = latestMessage.createdAt;
            
            // Mark new messages as read
            for (const message of uniqueNewMessages) {
              // Get the current user's email from session
              const currentUserEmail = session?.user?.email;
              // Only mark messages as read if they're not from the current user
              if (message.senderId._id !== currentUserEmail) {
                markMessageAsRead(message._id);
              }
            }
            
            // Scroll to bottom when new messages arrive
            scrollToBottom();
          }
          
          return updatedMessages;
        }
        
        return prev;
      });
    }
  };

  // Use the polling hook
  const usePollingState = usePolling({
    pollingFunction: pollForNewMessages,
    initialInterval: 2000,
    maxInterval: 30000,
    enabled: !!session?.user && !!params.conversationId
  });

  // Mark a specific message as read
  const markMessageAsRead = async (messageId: string) => {
    try {
      await fetch('/api/messages/mark-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messageId,
          conversationId: params.conversationId,
        }),
      });
      
      refreshUnreadCount();
    } catch (error) {
      console.error('Error marking message as read:', error);
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
        await markMessageAsRead(message._id);
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
      
      // Refresh unread count after marking messages as read
      refreshUnreadCount();
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

  // Handle profile picture click
  const handleProfileClick = async (participant: Participant) => {
    // Skip if clicking on own profile
    if (participant._id === session?.user?.id) return;
    
    // Set the selected user
    setSelectedUser({
      email: participant._id,
      name: participant.name,
      image: participant.image
    });
    
    setLoadingUserProfile(true);
    
    try {
      // First, try to get the user email from the ID
      const userResponse = await fetch(`/api/users/getEmail?userId=${encodeURIComponent(participant._id)}`);
      
      if (userResponse.ok) {
        const userData = await userResponse.json();
        if (userData.success && userData.email) {
          // Now use the email to fetch the user profile
          const profileResponse = await fetch(`/api/user?email=${encodeURIComponent(userData.email)}`);
          
          if (profileResponse.ok) {
            const profileData = await profileResponse.json();
            setUserProfile(profileData);
          } else {
            console.error('Failed to fetch user profile');
            setUserProfile(null);
          }
        } else {
          console.error('Failed to get user email');
          setUserProfile(null);
        }
      } else {
        console.error('Failed to fetch user email');
        setUserProfile(null);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setUserProfile(null);
    } finally {
      setLoadingUserProfile(false);
    }
  };

  const handleReportSuccess = () => {
    setShowReportModal(false);
  };

  useEffect(() => {
    if (!session) {
      router.push('/');
      return;
    }
    
    fetchConversation();
    fetchMessages();
    
    // Mark messages as read when the conversation is loaded
    markMessagesAsRead();
    
    // Cleanup is handled by the hook
    return () => {};
  }, [session, params.conversationId, router]);

  // Effect to auto-scroll when messages change
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  // Mark messages as read when new messages are received
  useEffect(() => {
    if (messages.length > 0) {
      markMessagesAsRead();
    }
  }, [messages]);

  // Effect to close the participants menu when clicking outside of it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const menu = document.getElementById('participants-menu');
      const groupIcon = document.querySelector('.group-icon');
      
      if (menu && !menu.classList.contains('hidden')) {
        // Check if the click is outside the menu and group icon
        if (!menu.contains(event.target as Node) && !groupIcon?.contains(event.target as Node)) {
          menu.classList.add('hidden');
        }
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Add a helper notification
  useEffect(() => {
    if (conversation && !localStorage.getItem('profile_click_tip_shown')) {
      const tipTimeout = setTimeout(() => {
        const tipElement = document.getElementById('profile-click-tip');
        if (tipElement) {
          tipElement.classList.remove('opacity-0');
          tipElement.classList.add('opacity-100');
          
          setTimeout(() => {
            tipElement.classList.remove('opacity-100');
            tipElement.classList.add('opacity-0');
            
            // Mark as shown in localStorage so we don't show it again
            localStorage.setItem('profile_click_tip_shown', 'true');
          }, 5000);
        }
      }, 2000);
      
      return () => clearTimeout(tipTimeout);
    }
  }, [conversation]);

  if (!conversation) {
    return (
      <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 flex justify-between items-center">
          <div className="animate-pulse h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="animate-pulse h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900 space-y-4">
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="animate-pulse flex flex-col">
                <div className={`${i % 2 === 0 ? 'mr-auto' : 'ml-auto'} max-w-[70%]`}>
                  <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg mb-1"></div>
                  <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded self-end mt-1"></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Message Input */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <form onSubmit={sendMessage} className="flex space-x-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-200 dark:border-gray-600"
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

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 flex justify-between items-center">
        {!conversation ? (
          <>
            <div className="animate-pulse h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="animate-pulse h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
          </>
        ) : (
          <>
            <div className="flex items-center space-x-3">
              <Link 
                href="/messages"
                className="p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div className="flex items-center space-x-3">
                <div className="relative">
                  {conversation.isGroup ? (
                    <div 
                      className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center cursor-pointer group-icon"
                      onClick={() => {
                        // Show a list of participants that can be clicked
                        const menu = document.getElementById('participants-menu');
                        if (menu) {
                          menu.classList.toggle('hidden');
                        }
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      
                      {/* Participants dropdown menu */}
                      <div id="participants-menu" className="absolute top-12 left-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-md shadow-lg z-10 border border-gray-200 dark:border-gray-700 hidden">
                        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Group Participants</h3>
                        </div>
                        <div className="py-1 max-h-64 overflow-y-auto">
                          {conversation.participants.map((participant) => (
                            <div
                              key={participant._id}
                              className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center"
                              onClick={() => {
                                // Close the menu
                                const menu = document.getElementById('participants-menu');
                                if (menu) {
                                  menu.classList.add('hidden');
                                }
                                // Only handle click for other participants
                                if (participant._id !== session?.user?.id) {
                                  handleProfileClick(participant);
                                }
                              }}
                            >
                              <div className="relative w-8 h-8 mr-2 group">
                                <Image
                                  src={participant.image || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23cccccc"%3E%3Cpath d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/%3E%3C/svg%3E'}
                                  alt={participant.name}
                                  fill
                                  sizes="(max-width: 768px) 32px, 32px"
                                  className="rounded-full object-cover hover:ring-2 hover:ring-blue-500 transition-all"
                                />
                                {participant._id === session?.user?.id ? (
                                  <span className="absolute bottom-0 right-0 bg-green-500 rounded-full w-3 h-3 border-2 border-white dark:border-gray-800"></span>
                                ) : participant._id !== session?.user?.id && (
                                  <div className="absolute bottom-0 right-0 bg-blue-500 rounded-full w-3 h-3 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity border border-white dark:border-gray-800">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-2 w-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                  </div>
                                )}
                              </div>
                              <div className="flex-1">
                                <span className="text-sm text-gray-800 dark:text-gray-200">
                                  {participant.name}
                                  {participant._id === session?.user?.id && ' (You)'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="relative w-10 h-10 group">
                      <Image
                        src={conversation.otherParticipants[0]?.image || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23cccccc"%3E%3Cpath d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/%3E%3C/svg%3E'}
                        alt={conversation.otherParticipants[0]?.name || 'User'}
                        fill
                        sizes="(max-width: 768px) 40px, 40px"
                        className="rounded-full object-cover cursor-pointer ring-offset-2 ring-transparent hover:ring-2 hover:ring-blue-500 transition-all"
                        onClick={() => handleProfileClick(conversation.otherParticipants[0])}
                        title="View profile"
                      />
                      <div className="absolute bottom-0 right-0 bg-blue-500 rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <h1 className="font-semibold text-gray-900 dark:text-gray-100">
                    {conversation.isGroup
                      ? conversation.name
                      : conversation.otherParticipants[0]?.name || 'Unknown User'}
                  </h1>
                  {conversation.isGroup && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {conversation.participants.length} participants
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            {/* Menu button positioned at the far right corner */}
            <div className="relative">
              <button 
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="Conversation menu"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
              
              {/* Dropdown menu */}
              {showMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg z-10 border border-gray-200 dark:border-gray-700">
                  <div className="py-1">
                    <button
                      onClick={deleteConversation}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                      disabled={isDeleting}
                    >
                      {isDeleting ? 'Deleting...' : 'Delete conversation'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      
      {/* Tip notification */}
      <div 
        id="profile-click-tip" 
        className="fixed top-16 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-md shadow-lg opacity-0 transition-opacity duration-300 z-20 flex items-center"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Tip: Click on profile pictures to view user details</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900 space-y-4">
        {!conversation ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="animate-pulse flex flex-col">
                <div className={`${i % 2 === 0 ? 'mr-auto' : 'ml-auto'} max-w-[70%]`}>
                  <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg mb-1"></div>
                  <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded self-end mt-1"></div>
                </div>
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="bg-gray-100 dark:bg-gray-800 rounded-full p-4 inline-block mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">
                Start the conversation
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Send a message to begin chatting
              </p>
            </div>
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
                    : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm border border-gray-200 dark:border-gray-700'
                }`}
              >
                {message.senderId._id !== session?.user?.id && (
                  <div className="flex items-center mb-1">
                    <div 
                      className="relative w-6 h-6 mr-2 cursor-pointer group"
                      onClick={() => handleProfileClick(message.senderId)}
                      title="View profile"
                    >
                      <Image
                        src={message.senderId.image || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23cccccc"%3E%3Cpath d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/%3E%3C/svg%3E'}
                        alt={message.senderId.name}
                        fill
                        sizes="(max-width: 768px) 24px, 24px"
                        className="rounded-full object-cover hover:ring-1 hover:ring-blue-500 transition-all"
                      />
                      <div className="absolute bottom-0 right-0 bg-blue-500 rounded-full w-2.5 h-2.5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-1.5 w-1.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </div>
                    </div>
                    <span className="text-xs font-medium dark:text-gray-300">
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
                                className="relative w-4 h-4 rounded-full border border-white dark:border-blue-600 cursor-pointer group hover:z-10"
                                onClick={() => handleProfileClick(reader)}
                                title={`View ${reader.name}'s profile`}
                              >
                                <Image
                                  src={reader.image || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23cccccc"%3E%3Cpath d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/%3E%3C/svg%3E'}
                                  alt={reader.name}
                                  fill
                                  sizes="(max-width: 768px) 16px, 16px"
                                  className="rounded-full object-cover hover:ring-1 hover:ring-blue-300 transition-all"
                                />
                                <div className="absolute top-0 right-0 w-full h-full rounded-full bg-blue-500 bg-opacity-0 group-hover:bg-opacity-20 transition-all"></div>
                              </div>
                            ))}
                          {message.readBy.length > 3 && (
                            <div className="relative w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                              <span className="text-[8px] text-gray-600 dark:text-gray-300">
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
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <form onSubmit={sendMessage} className="flex space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-200 dark:border-gray-600"
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
      
      {/* Chat Info Modal */}
      {showChatInfo && conversation && (
        <ChatInfoModal
          conversation={conversation}
          currentUserId={session?.user?.id}
          onClose={() => setShowChatInfo(false)}
          onDeleteConversation={deleteConversation}
          onViewProfile={(participant) => {
            setShowChatInfo(false);
            handleProfileClick(participant);
          }}
          isDeleting={isDeleting}
        />
      )}
      
      {/* User Profile Modal */}
      {selectedUser && (
        <UserProfileModal
          userData={userProfile}
          userProfile={selectedUser}
          onClose={() => {
            setSelectedUser(null);
            setUserProfile(null);
          }}
          loading={loadingUserProfile}
          displayName="Other's Profile"
          onReport={() => setShowReportModal(true)}
        />
      )}
      
      {/* Report Modal */}
      {showReportModal && selectedUser && (
        <ReportUserModal
          userEmail={selectedUser.email}
          userName={selectedUser.name}
          onClose={() => setShowReportModal(false)}
          onSuccess={handleReportSuccess}
        />
      )}
    </div>
  );
}

// Function to format date for display
const formatDate = (dateString: string) => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (e) {
    return dateString || 'N/A';
  }
}; 