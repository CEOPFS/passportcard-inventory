import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Users, Map, History, Settings } from 'lucide-react';
import { useAppStore } from '../../store';

const navItems = [
  { path: '/', icon: Home, label: 'בית' },
  { path: '/children', icon: Users, label: 'ילדים' },
  { path: '/map', icon: Map, label: 'מפה' },
  { path: '/history', icon: History, label: 'היסטוריה' },
  { path: '/settings', icon: Settings, label: 'הגדרות' },
];

export default function Navbar() {
  const location = useLocation();
  const unreadAlertCount = useAppStore((s) => s.unreadAlertCount);

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50"
         style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="flex items-center justify-around h-16">
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname === path ||
            (path !== '/' && location.pathname.startsWith(path));

          return (
            <Link
              key={path}
              to={path}
              className={`flex flex-col items-center justify-center flex-1 h-full relative transition-colors ${
                isActive ? 'text-primary-700' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <div className="relative">
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                {path === '/' && unreadAlertCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-bold">
                    {unreadAlertCount > 9 ? '9+' : unreadAlertCount}
                  </span>
                )}
              </div>
              <span className={`text-xs mt-1 font-medium ${isActive ? 'text-primary-700' : 'text-gray-400'}`}>
                {label}
              </span>
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary-700 rounded-b-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
