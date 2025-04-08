'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FiArrowLeft, FiHome, FiSettings, FiSend } from 'react-icons/fi';

export default function Navigation() {
  const pathname = usePathname();
  
  // Check if we're in a conversation
  const isInConversation = pathname.startsWith('/messages/') && pathname !== '/messages';
  
  // Check if we're in the messages list
  const isInMessagesList = pathname === '/messages';
  
  // Check if we're in the dashboard
  const isInDashboard = pathname === '/dashboard';

  // Check if we're in settings
  const isInSettings = pathname === '/settings';
  
  // Use dark theme for conversation pages
  const isDarkTheme = isInConversation;
  const buttonClasses = isDarkTheme 
    ? "p-2 text-white hover:bg-gray-800 rounded-full transition-colors" 
    : "p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors";
  
  // Don't render the global navigation when in conversation page
  if (isInConversation) {
    return null;
  }
  
  return (
    <div className="fixed top-4 right-4 z-50 flex items-center space-x-3">
      {/* Home/Dashboard button - show unless in dashboard */}
      {!isInDashboard && (
        <Link 
          href="/dashboard" 
          className={buttonClasses}
          aria-label="Dashboard"
        >
          <FiHome size={20} />
        </Link>
      )}
      
      {/* Messages button - show unless in messages */}
      {!isInMessagesList && !isInConversation && (
        <Link 
          href="/messages" 
          className={buttonClasses}
          aria-label="Messages"
        >
          <FiSend size={20} />
        </Link>
      )}
      
      {/* Settings button - show unless in settings */}
      {!isInSettings && (
        <Link 
          href="/settings" 
          className={buttonClasses}
          aria-label="Settings"
        >
          <FiSettings size={20} />
        </Link>
      )}
    </div>
  );
} 