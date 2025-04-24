'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FiFlag, FiX, FiUsers, FiMapPin, FiCalendar, FiList, FiStar, FiInfo, FiUser } from 'react-icons/fi';
import UserProfileModal from '@/components/UserProfileModal';
import ReportUserModal from '@/components/ReportUserModal';
import ChatInfoModal from '@/components/ChatInfoModal';
import { useMessageNotifications } from '@/contexts/MessageNotificationContext';
import { formatDistance } from 'date-fns';
import ReportModal from '@/components/ReportModal';
import { useFirebaseRealtime } from '@/hooks/useFirebaseRealtime';
import { 
  messagesCollection, 
  query, 
  where, 
  orderBy, 
  doc,
  Timestamp,
  getDoc,
  db
} from '@/lib/firebase';
import { 
  FirebaseMessage, 
  FirebaseConversation,
  getConversation,
  getMessagesByConversation,
  markMessageAsRead as markFirebaseMessageAsRead,
  createMessage,
  deleteConversation as deleteFirebaseConversation
} from '@/lib/firebaseService';

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

// Simple UserAvatar component
const UserAvatar = ({ size = 32, letter = null }: { size?: number, letter?: string | null }) => {
  return (
    <div 
      className="flex items-center justify-center bg-purple-500 text-white rounded-full border border-gray-200 dark:border-gray-600"
      style={{ width: size, height: size }}
    >
      {letter ? (
        <span className="text-sm font-semibold">{letter}</span>
      ) : (
        <FiUser size={size * 0.6} />
      )}
    </div>
  );
};

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
  const { refreshUnreadCount, decrementUnreadCount } = useMessageNotifications();
  const [pendingMessages, setPendingMessages] = useState<Set<string>>(new Set());
  const [participantsFullyLoaded, setParticipantsFullyLoaded] = useState<boolean>(false);

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
      // Get conversation from Firebase
      const result = await getConversation(params.conversationId);
      
      if (result) {
        // Transform Firebase data to match expected format
        const conversationData: Conversation = {
          _id: result._id as string,
          participants: Array.isArray(result.participants) 
            ? result.participants.map((p: any) => ({
                _id: typeof p === 'string' ? p : p._id || p.email,
                name: typeof p === 'string' ? '' : p.name || '',
                image: typeof p === 'string' ? '' : p.image || ''
              }))
            : [],
          otherParticipants: Array.isArray(result.participants) 
            ? result.participants
                .filter((p: any) => {
                  const pId = typeof p === 'string' ? p : p._id || p.email;
                  return pId !== session?.user?.email;
                })
                .map((p: any) => ({
                  _id: typeof p === 'string' ? p : p._id || p.email,
                  name: typeof p === 'string' ? '' : p.name || '',
                  image: typeof p === 'string' ? '' : p.image || ''
                }))
            : [],
          isGroup: result.isGroup || false,
          name: result.name || ''
        };
        
        setConversation(conversationData);
        
        // Now enrich the participants data to avoid the flash of default content
        if (Array.isArray(result.participants)) {
          const enrichedParticipants = await enrichParticipantsWithUserData(result.participants);
          const enrichedOtherParticipants = enrichedParticipants.filter(p => p._id !== session?.user?.email);
          
          setConversation(prev => {
            if (!prev) return null;
            return {
              ...prev,
              participants: enrichedParticipants.map(p => ({
                _id: p._id,
                name: p.name || '',
                image: p.image || ''
              })),
              otherParticipants: enrichedOtherParticipants.map(p => ({
                _id: p._id,
                name: p.name || '',
                image: p.image || ''
              }))
            };
          });
          setParticipantsFullyLoaded(true);
        }
      } else {
        console.error('Conversation not found');
      }
    } catch (error) {
      console.error('Error fetching conversation:', error);
    }
  };

  // Fetch messages
  const fetchMessages = async () => {
    try {
      // Get messages from Firebase
      const result = await getMessagesByConversation(params.conversationId);
      
      if (result && result.length > 0) {
        // Transform Firebase data to match expected format
        const messageData = result.map((msg: FirebaseMessage) => ({
          _id: msg._id as string,
          content: msg.content,
          senderId: typeof msg.senderId === 'string' 
            ? { 
                _id: msg.senderId,
                name: '',
                image: ''
              }
            : {
                _id: msg.senderId._id || '',
                name: msg.senderId.name || '',
                image: msg.senderId.image || ''
              },
          readBy: Array.isArray(msg.readBy) 
            ? msg.readBy.map((reader: any) => ({
                _id: typeof reader === 'string' ? reader : reader._id || '',
                name: typeof reader === 'string' ? '' : reader.name || '',
                image: typeof reader === 'string' ? '' : reader.image || ''
              }))
            : [],
          createdAt: msg.createdAt instanceof Timestamp 
            ? msg.createdAt.toDate().toISOString()
            : msg.createdAt instanceof Date
              ? msg.createdAt.toISOString()
              : typeof msg.createdAt === 'string'
                ? msg.createdAt
                : new Date().toISOString()
        }));
        
        setMessages(messageData);
        scrollToBottom();
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Set up real-time listener for messages
  const messagesQuery = useCallback(() => {
    return query(
      messagesCollection,
      where('conversationId', '==', params.conversationId),
      orderBy('createdAt', 'asc')
    );
  }, [params.conversationId]);

  // Store the query result to avoid recreation on every render
  const queryRef = useRef(messagesQuery());

  // Update the query ref when conversation ID changes
  useEffect(() => {
    queryRef.current = messagesQuery();
  }, [messagesQuery]);

  // Track which messages have already been marked as read
  const readMessageIdsRef = useRef<Set<string>>(new Set());

  // Use Firebase real-time hook
  const { data: realtimeMessages } = useFirebaseRealtime<FirebaseMessage[]>({
    subscriptionType: 'query',
    target: queryRef.current,
    enabled: !!session?.user && !!params.conversationId,
    onData: (data) => {
      if (!data || data.length === 0) return;
      
      // Transform Firebase data but preserve existing profile info
      setMessages(prevMessages => {
        // Create a map of existing messages by ID for quick lookup
        const existingMessagesMap = new Map(
          prevMessages.map(msg => [msg._id, msg])
        );
        
        // Track new messages that need profile data
        const newMessageIds = new Set<string>();
        
        // Process new messages while preserving profile data from existing messages
        const updatedMessages = data.map((msg: FirebaseMessage) => {
          const messageId = msg._id as string;
          const existingMessage = existingMessagesMap.get(messageId);
          
          // Start with basic sender data
          let senderData = typeof msg.senderId === 'string' 
            ? { 
                _id: msg.senderId,
                name: '',
                image: ''
              }
            : {
                _id: msg.senderId._id || '',
                name: msg.senderId.name || '',
                image: msg.senderId.image || ''
              };
          
          // For receiver, if this is a new message that lacks profile data, track it for loading
          if (!existingMessage && senderData._id !== session?.user?.email) {
            // New message from someone else, check if we have complete profile data
            if (!senderData.name || !senderData.image) {
              newMessageIds.add(messageId);
            }
          }
          
          // If we have existing message data for this ID, preserve the sender's profile information
          if (existingMessage && existingMessage.senderId._id === senderData._id) {
            senderData = {
              ...senderData,
              name: existingMessage.senderId.name || senderData.name,
              image: existingMessage.senderId.image || senderData.image,
              profile: existingMessage.senderId.profile || undefined
            };
          }
          
          // Process readBy data
          const readBy = Array.isArray(msg.readBy) 
            ? msg.readBy.map((reader: any) => {
                const readerId = typeof reader === 'string' ? reader : reader._id || '';
                // Try to find existing reader data to preserve
                const existingReader = existingMessage?.readBy.find(r => r._id === readerId);
                
                return {
                  _id: readerId,
                  name: existingReader?.name || (typeof reader === 'string' ? '' : reader.name || ''),
                  image: existingReader?.image || (typeof reader === 'string' ? '' : reader.image || '')
                };
              })
            : [];
          
          // Create the processed message with preserved data where possible
          return {
            _id: messageId,
            content: msg.content,
            senderId: senderData,
            readBy: readBy,
            createdAt: msg.createdAt instanceof Timestamp 
              ? msg.createdAt.toDate().toISOString()
              : msg.createdAt instanceof Date
                ? msg.createdAt.toISOString()
                : typeof msg.createdAt === 'string'
                  ? msg.createdAt
                  : new Date().toISOString()
          };
        });
        
        // Update the pending messages state with new messages that need profile data
        if (newMessageIds.size > 0) {
          setPendingMessages(prev => {
            const updatedPending = new Set(prev);
            newMessageIds.forEach(id => updatedPending.add(id));
            return updatedPending;
          });
          
          // For each new message, fetch the profile data
          newMessageIds.forEach(messageId => {
            const messageData = updatedMessages.find(m => m._id === messageId);
            if (messageData) {
              fetchProfileForMessage(messageId, messageData.senderId._id);
            }
          });
        }
        
        return updatedMessages;
      });
    }
  });

  // Function to fetch profile data for a specific message sender
  const fetchProfileForMessage = async (messageId: string, senderId: string) => {
    try {
      // First, try to get the user email from the ID
      const userResponse = await fetch(`/api/users/getEmail?userId=${encodeURIComponent(senderId)}`);
      
      if (userResponse.ok) {
        const userData = await userResponse.json();
        
        if (userData.success && userData.email) {
          // Now use the email to fetch the user profile
          const profileResponse = await fetch(`/api/user?email=${encodeURIComponent(userData.email)}`);
          
          if (profileResponse.ok) {
            const profileData = await profileResponse.json();
            
            // Update the message with the profile data
            setMessages(prev => prev.map(message => {
              if (message._id === messageId) {
                // Create enhanced sender data
                const enhancedSender = {
                  ...message.senderId,
                  name: getName({ 
                    _id: senderId, 
                    profile: profileData 
                  }, profileData) || message.senderId.name,
                  image: getProfileImage({ 
                    _id: senderId, 
                    profile: profileData 
                  }) || message.senderId.image,
                  profile: profileData
                };
                
                return {
                  ...message,
                  senderId: enhancedSender
                };
              }
              return message;
            }));
            
            // Remove from pending messages
            setPendingMessages(prev => {
              const updated = new Set(prev);
              updated.delete(messageId);
              return updated;
            });
          }
        }
      }
    } catch (error) {
      console.error('Error fetching profile for message:', error);
      // Remove from pending state after a timeout to prevent indefinite loading
      setTimeout(() => {
        setPendingMessages(prev => {
          const updated = new Set(prev);
          updated.delete(messageId);
          return updated;
        });
      }, 5000);
    }
  };

  // Handle marking messages as read in a separate effect
  useEffect(() => {
    if (!realtimeMessages || !session?.user?.email) return;
    
    // Find unread messages that haven't been processed yet
    const currentUserEmail = session.user.email;
    const unreadMessages = realtimeMessages.filter((msg: FirebaseMessage) => {
      if (!msg._id) return false;
      
      const senderId = typeof msg.senderId === 'string' ? msg.senderId : msg.senderId._id;
      const readBy = Array.isArray(msg.readBy) ? msg.readBy.map(r => typeof r === 'string' ? r : r._id) : [];
      
      // Check if this message is unread and hasn't been processed yet
      return senderId !== currentUserEmail && 
             !readBy.includes(currentUserEmail) && 
             !readMessageIdsRef.current.has(msg._id);
    });
    
    // Mark unread messages as read (batched)
    if (unreadMessages.length > 0) {
      // Batch these operations
      const markReadPromises = unreadMessages.map(async (msg: FirebaseMessage) => {
        if (msg._id) {
          readMessageIdsRef.current.add(msg._id);
          return markMessageAsRead(msg._id);
        }
      });
      
      Promise.all(markReadPromises).then(() => {
        // Scroll to bottom when new messages are marked as read
        scrollToBottom();
      });
    }
  }, [realtimeMessages, session?.user?.email]);

  // Mark a specific message as read
  const markMessageAsRead = async (messageId: string) => {
    if (!session?.user?.email) return;
    
    try {
      await markFirebaseMessageAsRead(messageId, session.user.email);
      // Update unread count in notification context
      decrementUnreadCount(params.conversationId);
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  // Helper function to get user name from session or first name from survey
  const getUserName = async () => {
    if (!session?.user?.email) return '';
    
    try {
      // Try to get the user's survey data first
      const surveyRef = doc(db, 'surveys', session.user.email);
      const surveyDoc = await getDoc(surveyRef);
      
      if (surveyDoc.exists()) {
        const surveyData = surveyDoc.data();
        if (surveyData.firstName && typeof surveyData.firstName === 'string' && surveyData.firstName.trim()) {
          return surveyData.firstName.trim();
        }
      }
      
      // Fallback to session name
      return session.user.name || '';
    } catch (error) {
      console.error('Error getting user name:', error);
      return session.user.name || '';
    }
  };

  // Send a new message
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !session?.user?.email) return;
    
    setIsSending(true);
    
    try {
      // Get the proper user name
      const userName = await getUserName();
      
      // Get current user's image, ensuring we have the correct one
      const userImage = session.user.image || '';
      
      // Create the sender data with complete profile information
      const senderData = {
        _id: session.user.email,
        name: userName,
        image: userImage,
        profile: {
          firstName: userName,
          userProfile: {
            image: userImage
          },
          surveyData: {
            firstName: userName,
            image: userImage
          }
        }
      };

      // Create the message object
      const messageContent = newMessage;
      const messageId = `temp-${Date.now()}`;
      const now = new Date().toISOString();
      
      // Immediately add the message to local state first to prevent UI flicker
      const localMessage = {
        _id: messageId,
        content: messageContent,
        senderId: senderData,
        readBy: [{ _id: session.user.email, name: userName, image: userImage }],
        createdAt: now
      };
      
      // Update local state with the new message to avoid flickering
      setMessages(prevMessages => [...prevMessages, localMessage]);
      setNewMessage(''); // Clear input immediately
      
      // Scroll to bottom immediately for better UX
      scrollToBottom();
      
      // Create a new message in Firebase with complete data
      const messageData = {
        content: messageContent,
        conversationId: params.conversationId,
        senderId: senderData,
        readBy: [session.user.email] // Mark as read by sender
      };
      
      // Send to Firebase in the background
      await createMessage(messageData);
      
      // No need to update messages again as the real-time listener will replace our temporary message
      
    } catch (error) {
      console.error('Error sending message:', error);
      // Optionally notify the user about the error
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
      // Use Firebase service to delete the conversation
      const result = await deleteFirebaseConversation(params.conversationId);
      
      if (result && result.success) {
        // Redirect to the messages page after successful deletion
        router.push('/messages');
      } else {
        console.error('Error deleting conversation');
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
    if (participant._id === session?.user?.id || participant._id === session?.user?.email) return;
    
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
    
    // Immediately show loading state
    setIsLoading(true);
    
    // Fetch conversation data with priority
    const loadData = async () => {
      await fetchConversation();
      fetchMessages();
    };
    
    loadData();
    
    // Cleanup is handled by the hook
    return () => {};
  }, [session, params.conversationId, router]);

  // Effect to auto-scroll when messages change
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
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

  // In the messages section, update the handleProfileClick to fetch profile data for all users:
  useEffect(() => {
    // Fetch profiles for all unique sender IDs to ensure names display correctly
    const fetchAllProfiles = async () => {
      if (!messages || messages.length === 0) return;
      
      // Get unique sender IDs
      const uniqueSenderIds = [...new Set(messages.map(message => message.senderId._id))];
      
      // For each sender, fetch their profile if not current user
      for (const senderId of uniqueSenderIds) {
        if (senderId === session?.user?.id || senderId === session?.user?.email) {
          continue;
        }
        
        try {
          // First, try to get the user email from the ID
          const userResponse = await fetch(`/api/users/getEmail?userId=${encodeURIComponent(senderId)}`);
          
          if (userResponse.ok) {
            const userData = await userResponse.json();
            
            if (userData.success && userData.email) {
              // Now use the email to fetch the user profile
              const profileResponse = await fetch(`/api/user?email=${encodeURIComponent(userData.email)}`);
              
              if (profileResponse.ok) {
                const profileData = await profileResponse.json();
                
                // Store profile with the message senders
                setMessages(prev => prev.map(message => {
                  if (message.senderId._id === senderId) {
                    return {
                      ...message,
                      senderId: {
                        ...message.senderId,
                        profile: profileData
                      }
                    };
                  }
                  return message;
                }));
              } else {
                // Profile fetch failed
              }
            } else {
              // Email fetch success but no email found
            }
          } else {
            // Email fetch failed
          }
        } catch (error) {
          // Error fetching profile for sender
        }
      }
    };
    
    if (messages.length > 0) {
      fetchAllProfiles();
    }
  }, [messages.length, session?.user?.id, session?.user?.email]);

  // Update the helper function to get profile image from the correct paths
  const getProfileImage = (user: any): string | null => {
    if (!user) return null;
    
    // Check all possible image paths in order of preference
    if (user.image && user.image !== "") return user.image;
    
    // Check nested profile paths
    if (user.profile) {
      // Check userProfile paths
      if (user.profile.userProfile) {
        if (user.profile.userProfile.image) return user.profile.userProfile.image;
        if (user.profile.userProfile.imageUrl) return user.profile.userProfile.imageUrl;
        if (user.profile.userProfile.profileImageUrl) return user.profile.userProfile.profileImageUrl;
      }
      
      // Check surveyData paths
      if (user.profile.surveyData) {
        if (user.profile.surveyData.imageUrl) return user.profile.surveyData.imageUrl;
        if (user.profile.surveyData.profileImageUrl) return user.profile.surveyData.profileImageUrl;
        if (user.profile.surveyData.image) return user.profile.surveyData.image;
      }
      
      // Check direct profile paths
      if (user.profile.imageUrl) return user.profile.imageUrl;
      if (user.profile.image) return user.profile.image;
    }
    
    // No image found
    return null;
  };

  // Also update the getName function to check the correct profile paths
  const getName = (user: {_id?: string, name?: string, email?: string, profile?: any} | null, fullProfile?: any): string => {
    if (!user) return 'Unknown User';
    
    // Check if this is the current user - if so, just return "You"
    if (user._id === session?.user?.id || user._id === session?.user?.email) {
      return "You";
    }
    
    // Check in the profile.surveyData path first (based on console output)
    if (user.profile?.surveyData?.firstName && typeof user.profile.surveyData.firstName === 'string' && user.profile.surveyData.firstName.trim() !== '') {
      return user.profile.surveyData.firstName;
    }
    
    // Then check in profile.userProfile path
    if (user.profile?.userProfile?.firstName && typeof user.profile.userProfile.firstName === 'string' && user.profile.userProfile.firstName.trim() !== '') {
      return user.profile.userProfile.firstName;
    }
    
    // Combine profile objects to check all possible places for firstName
    const combinedProfile = { 
      ...user.profile,
      ...fullProfile
    };
    
    // Look for firstName in all possible locations (highest priority first)
    
    // Direct firstName property in any profile
    if (combinedProfile?.firstName && typeof combinedProfile.firstName === 'string' && combinedProfile.firstName.trim() !== '') {
      return combinedProfile.firstName;
    }
    
    // Survey firstName
    if (combinedProfile?.survey?.firstName && typeof combinedProfile.survey.firstName === 'string' && combinedProfile.survey.firstName.trim() !== '') {
      return combinedProfile.survey.firstName;
    }
    
    // Check user's own profile data
    if (user.profile?.firstName && typeof user.profile.firstName === 'string' && user.profile.firstName.trim() !== '') {
      return user.profile.firstName;
    }
    
    if (user.profile?.survey?.firstName && typeof user.profile.survey.firstName === 'string' && user.profile.survey.firstName.trim() !== '') {
      return user.profile.survey.firstName;
    }
    
    // Next try to get firstName from user profile api
    if (user.name && user.name !== 'User' && user.name.trim() !== '') {
      // If name contains space, try to get first name
      if (user.name.includes(' ')) {
        return user.name.split(' ')[0];
      }
      return user.name;
    }
    
    // Return 'User' instead of extracting from email
    return 'User';
  };

  // Format date
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      
      if (isToday) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (date.toDateString() === yesterday.toDateString()) {
          return 'Yesterday ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
          return date.toLocaleDateString([], { 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit', 
            minute: '2-digit'
          });
        }
      }
    } catch (e) {
      return dateString;
    }
  };

  // Add back CSS for smooth transitions
  useEffect(() => {
    // Add CSS for smooth message animations
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .message-animate {
        animation: slideUp 0.2s ease-out forwards;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Add a conditional rendering based on loading state
  if (isLoading && !participantsFullyLoaded) {
    return (
      <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-center">
            <div className="w-12 h-12 rounded-full bg-gray-300 dark:bg-gray-700 mx-auto mb-4"></div>
            <div className="h-4 w-32 bg-gray-300 dark:bg-gray-700 rounded mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

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
                                {participant._id === session?.user?.id || participant._id === session?.user?.email ? (
                                  <span className="absolute bottom-0 right-0 bg-green-500 rounded-full w-3 h-3 border-2 border-white dark:border-gray-800"></span>
                                ) : (
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
                                  {getName(participant, userProfile)}
                                  {participant._id === session?.user?.id || participant._id === session?.user?.email ? ' (You)' : ''}
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
                      : getName(conversation.otherParticipants[0], userProfile)}
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
      <div className="flex-1 overflow-y-auto p-3 bg-gray-50 dark:bg-gray-900">
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
          messages.map((message) => {
            const isCurrentUser = message.senderId._id === session?.user?.id || 
                                   message.senderId._id === session?.user?.email;
            const isPending = pendingMessages.has(message._id);
            
            // Skip rendering pending messages that aren't from the current user
            if (isPending && !isCurrentUser) {
              return null;
            }
            
            return (
              <div
                key={message._id}
                className={`flex ${
                  isCurrentUser
                    ? 'justify-end items-start'
                    : 'justify-start items-start'
                } mb-2 message-animate`}
                style={{ marginBottom: '10px' }}
              >
                {!isCurrentUser && (
                  <div className="flex-shrink-0 mr-2 mt-0.5">
                    <div
                      className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center cursor-pointer"
                      onClick={() =>
                        handleProfileClick(message.senderId)
                      }
                    >
                      {getProfileImage(message.senderId) ? (
                        <Image
                          src={getProfileImage(message.senderId) as string}
                          alt="User Avatar"
                          width={32}
                          height={32}
                          className="rounded-full border border-gray-200 dark:border-gray-600"
                        />
                      ) : (
                        <UserAvatar 
                          size={32} 
                          letter={getName(message.senderId, message.senderId.profile)?.charAt(0)}
                        />
                      )}
                    </div>
                  </div>
                )}
                <div className={`flex flex-col ${isCurrentUser ? 'items-end mr-1' : 'items-start'} max-w-[70%]`}>
                  {!isCurrentUser && (
                    <span 
                      className="text-xs text-gray-600 dark:text-gray-300 mb-0.5 cursor-pointer"
                      onClick={() => handleProfileClick(message.senderId)}
                    >
                      {getName(message.senderId, message.senderId.profile)}
                    </span>
                  )}
                  <div
                    className={`rounded-lg py-1.5 px-2.5 text-sm break-words ${
                      isCurrentUser
                        ? 'bg-blue-500 text-white rounded-tr-none'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-tl-none'
                    } w-auto inline-block`}
                    style={{
                      maxWidth: '100%',
                      width: 'auto',
                      display: 'inline-block'
                    }}
                  >
                    {message.content}
                  </div>
                  <div className={`text-xs text-gray-500 dark:text-gray-400 mt-0.5 ${isCurrentUser ? 'text-right' : 'text-left'}`} style={{width: 'auto', fontSize: '0.75rem'}}>
                    {formatDate(message.createdAt)}
                    {isCurrentUser && (
                      <span className="ml-1">
                        {message.read ? (
                          <span className="text-blue-500 dark:text-blue-400">Read</span>
                        ) : (
                          'Sent'
                        )}
                      </span>
                    )}
                  </div>
                </div>
                {isCurrentUser && (
                  <div className="flex-shrink-0 ml-1 mt-0.5">
                    <div
                      className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center cursor-pointer"
                    >
                      {session?.user?.image ? (
                        <Image
                          src={session.user.image}
                          alt="Your Avatar"
                          width={32}
                          height={32}
                          className="rounded-full border border-gray-200 dark:border-gray-600"
                        />
                      ) : (
                        <UserAvatar 
                          size={32} 
                          letter={session?.user?.name?.charAt(0) || 'Y'} 
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
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
          userName={getName(selectedUser, userProfile)}
          onClose={() => setShowReportModal(false)}
          onSuccess={handleReportSuccess}
        />
      )}
    </div>
  );
} 