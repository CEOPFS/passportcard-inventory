import React from 'react';
import { AlertTriangle, Bell, CheckCircle, X } from 'lucide-react';
import { Alert } from '../../types';
import { alertsApi } from '../../services/api';
import { useAppStore } from '../../store';

interface AlertCardProps {
  alert: Alert;
}

const alertTypeConfig: Record<string, { icon: any; color: string; bgColor: string }> = {
  wake_failed: { icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-50' },
  wake_success: { icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-50' },
  device_error: { icon: AlertTriangle, color: 'text-orange-600', bgColor: 'bg-orange-50' },
  default: { icon: Bell, color: 'text-blue-600', bgColor: 'bg-blue-50' },
};

export default function AlertCard({ alert }: AlertCardProps) {
  const { markAlertRead, removeAlert } = useAppStore();

  const config = alertTypeConfig[alert.type] || alertTypeConfig.default;
  const Icon = config.icon;

  const handleRead = async () => {
    try {
      await alertsApi.markRead(alert.id);
      markAlertRead(alert.id);
    } catch (err) {
      console.error('Failed to mark alert as read:', err);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await alertsApi.delete(alert.id);
      removeAlert(alert.id);
    } catch (err) {
      console.error('Failed to delete alert:', err);
    }
  };

  return (
    <div
      className={`card flex items-start gap-3 cursor-pointer transition-opacity ${alert.read ? 'opacity-70' : ''}`}
      onClick={handleRead}
    >
      <div className={`w-10 h-10 rounded-full ${config.bgColor} flex items-center justify-center flex-shrink-0`}>
        <Icon size={18} className={config.color} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 font-medium leading-snug">{alert.message}</p>
        <p className="text-xs text-gray-400 mt-1">
          {alert.created_at ? new Date(alert.created_at).toLocaleString('he-IL') : ''}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {!alert.read && (
          <div className="w-2 h-2 bg-blue-500 rounded-full" />
        )}
        <button
          onClick={handleDelete}
          className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
