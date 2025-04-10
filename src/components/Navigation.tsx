'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { FiHome, FiSettings, FiMessageSquare, FiClipboard, FiLogOut } from 'react-icons/fi';
import { signOut } from 'next-auth/react';

export default function Navigation() {
  const pathname = usePathname();
  
  // Don't render navigation on the landing page or conversation pages
  if (pathname === '/' || (pathname.startsWith('/messages/') && pathname !== '/messages')) {
    return null;
  }

  // Check which page is active
  const isActive = (path: string) => {
    if (path === '/dashboard' && pathname === '/dashboard') return true;
    if (path === '/messages' && pathname === '/messages') return true;
    if (path === '/survey' && pathname.startsWith('/survey')) return true;
    if (path === '/settings' && pathname === '/settings') return true;
    return false;
  };
  
  const navItemClasses = "flex items-center gap-1.5 px-4 py-2 rounded-md transition-colors";
  const activeClasses = "bg-blue-100 text-blue-700 font-medium";
  const inactiveClasses = "text-gray-600 hover:bg-gray-100";
  
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 flex justify-between items-center h-16">
        {/* Logo and brand */}
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="font-bold text-blue-600 text-lg">MonkeyHouse</span>
        </Link>
        
        {/* Navigation items */}
        <nav className="flex items-center">
          <Link 
            href="/dashboard" 
            className={`${navItemClasses} ${isActive('/dashboard') ? activeClasses : inactiveClasses}`}
          >
            <FiHome size={18} />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
          
          <Link 
            href="/messages" 
            className={`${navItemClasses} ${isActive('/messages') ? activeClasses : inactiveClasses}`}
          >
            <FiMessageSquare size={18} />
            <span className="hidden sm:inline">Messages</span>
          </Link>
          
          <Link 
            href="/survey" 
            className={`${navItemClasses} ${isActive('/survey') ? activeClasses : inactiveClasses}`}
          >
            <FiClipboard size={18} />
            <span className="hidden sm:inline">Survey</span>
          </Link>
          
          <Link 
            href="/settings" 
            className={`${navItemClasses} ${isActive('/settings') ? activeClasses : inactiveClasses}`}
          >
            <FiSettings size={18} />
            <span className="hidden sm:inline">Settings</span>
          </Link>
          
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className={`${navItemClasses} ${inactiveClasses} ml-2`}
            aria-label="Sign Out"
          >
            <FiLogOut size={18} />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </nav>
      </div>
    </header>
  );
} 