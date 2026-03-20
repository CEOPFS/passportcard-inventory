import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  rightAction?: React.ReactNode;
  backPath?: string;
}

export default function Header({ title, subtitle, showBack = false, rightAction, backPath }: HeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (backPath) {
      navigate(backPath);
    } else {
      navigate(-1);
    }
  };

  return (
    <header className="bg-primary-700 text-white px-4 pt-4 pb-5 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-3">
        {showBack && (
          <button
            onClick={handleBack}
            className="p-1 rounded-lg hover:bg-white/10 active:bg-white/20 transition-colors"
          >
            <ChevronRight size={24} />
          </button>
        )}
        <div>
          <h1 className="text-lg font-bold leading-tight">{title}</h1>
          {subtitle && <p className="text-xs text-blue-200 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {rightAction && <div>{rightAction}</div>}
    </header>
  );
}
