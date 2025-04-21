import { FiX, FiUsers, FiTrash2, FiLogOut } from 'react-icons/fi';
import Image from 'next/image';

interface Participant {
  _id: string;
  name: string;
  image: string;
}

interface ChatInfoProps {
  conversation: {
    _id: string;
    participants: Participant[];
    otherParticipants: Participant[];
    isGroup: boolean;
    name: string;
  } | null;
  currentUserId?: string;
  onClose: () => void;
  onDeleteConversation: () => void;
  onViewProfile: (participant: Participant) => void;
  isDeleting: boolean;
}

export default function ChatInfoModal({
  conversation,
  currentUserId,
  onClose,
  onDeleteConversation,
  onViewProfile,
  isDeleting
}: ChatInfoProps) {
  if (!conversation) {
    return null;
  }

  // Helper function to get user display name
  const getName = (participant: Participant): string => {
    // Use name from participant profile if available and not empty/default
    if (participant.name && participant.name !== 'User' && participant.name.trim() !== '') {
      return participant.name;
    }
    
    // Try to extract email username if _id looks like an email
    if (participant._id && participant._id.includes('@')) {
      const username = participant._id.split('@')[0];
      return username.charAt(0).toUpperCase() + username.slice(1); // Capitalize first letter
    }
    
    // Fallback to user ID or 'Unknown User'
    return participant._id || 'Unknown User';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full mx-auto shadow-xl">
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
            <FiUsers className="mr-2" />
            <span>
              {conversation.isGroup ? conversation.name : 'Chat Members'} 
              {conversation.participants.length > 0 && ` (${conversation.participants.length})`}
            </span>
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-100"
            aria-label="Close modal"
          >
            <FiX size={24} />
          </button>
        </div>

        {/* Members List */}
        <div className="p-4">
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {conversation.participants.map((participant) => (
              <div
                key={participant._id}
                className={`flex items-center p-3 rounded-lg ${
                  participant._id === currentUserId 
                    ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800' 
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer'
                }`}
                onClick={() => {
                  if (participant._id !== currentUserId) {
                    onViewProfile(participant);
                  }
                }}
              >
                <div className="relative w-10 h-10 mr-3">
                  <Image
                    src={participant.image || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23cccccc"%3E%3Cpath d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/%3E%3C/svg%3E'}
                    alt={getName(participant)}
                    fill
                    sizes="(max-width: 768px) 40px, 40px"
                    className="rounded-full object-cover"
                  />
                  {participant._id === currentUserId && (
                    <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white text-xs font-bold rounded-full min-w-5 h-5 flex items-center justify-center px-1">
                      You
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 flex items-center">
                    {getName(participant)}
                    {participant._id === currentUserId && (
                      <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">(You)</span>
                    )}
                  </h3>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 