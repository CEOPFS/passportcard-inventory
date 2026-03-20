import React from 'react';
import { Link } from 'react-router-dom';
import { User, Clock, MessageSquare, ChevronLeft } from 'lucide-react';
import { Child } from '../../types';

const DAYS_HE = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

interface ChildCardProps {
  child: Child;
}

export default function ChildCard({ child }: ChildCardProps) {
  const isActive = child.active === 1 || child.active === true;

  const nextSchedule = child.schedules?.find(s => s.enabled);

  return (
    <Link to={`/children/${child.id}`} className="block">
      <div className="card flex items-center gap-4 hover:shadow-md transition-shadow active:bg-gray-50">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          {child.avatar_url ? (
            <img
              src={child.avatar_url}
              alt={child.name}
              className="w-14 h-14 rounded-full object-cover"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary-400 to-primary-700 flex items-center justify-center">
              <User size={24} className="text-white" />
            </div>
          )}
          <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-gray-800 text-base">{child.name}</h3>
            {child.age && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                גיל {child.age}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-500">
            {child.room_name && (
              <span className="flex items-center gap-1">
                🏠 {child.room_name}
              </span>
            )}
            {child.message_count !== undefined && (
              <span className="flex items-center gap-1">
                <MessageSquare size={12} />
                {child.message_count} הקלטות
              </span>
            )}
          </div>

          {nextSchedule && (
            <div className="flex items-center gap-1 mt-1.5">
              <Clock size={12} className="text-accent-500" />
              <span className="text-xs text-accent-600 font-medium">
                {DAYS_HE[nextSchedule.day_of_week]}' {nextSchedule.time_of_day}
              </span>
            </div>
          )}
        </div>

        {/* Status & Arrow */}
        <div className="flex flex-col items-end gap-2">
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {isActive ? 'פעיל' : 'כבוי'}
          </span>
          <ChevronLeft size={16} className="text-gray-400" />
        </div>
      </div>
    </Link>
  );
}
