import React from 'react';
import { Battery, BatteryLow, BatteryFull, Wifi, WifiOff, Bot } from 'lucide-react';
import { Device } from '../../types';

const statusLabels: Record<string, { label: string; color: string }> = {
  idle: { label: 'מחכה', color: 'text-green-600 bg-green-50' },
  navigating: { label: 'מנווט', color: 'text-blue-600 bg-blue-50' },
  playing_audio: { label: 'מנגן', color: 'text-purple-600 bg-purple-50' },
  charging: { label: 'טוען', color: 'text-orange-600 bg-orange-50' },
  docked: { label: 'בתחנה', color: 'text-gray-600 bg-gray-50' },
  error: { label: 'שגיאה', color: 'text-red-600 bg-red-50' },
};

interface DeviceCardProps {
  device: Device;
}

export default function DeviceCard({ device }: DeviceCardProps) {
  const status = statusLabels[device.status] || { label: device.status, color: 'text-gray-600 bg-gray-50' };

  const getBatteryIcon = (level: number) => {
    if (level <= 20) return <BatteryLow size={18} className="text-red-500" />;
    if (level >= 80) return <BatteryFull size={18} className="text-green-500" />;
    return <Battery size={18} className="text-yellow-500" />;
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
            <Bot size={20} className="text-primary-700" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800 text-sm">{device.model}</h3>
            <p className="text-xs text-gray-500">{device.vendor === 'mock' ? 'WakeBot Demo' : device.vendor}</p>
          </div>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${status.color}`}>
          {status.label}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {getBatteryIcon(device.battery_level)}
          <span className="text-sm text-gray-600 font-medium">{device.battery_level}%</span>
        </div>

        <div className="flex items-center gap-1.5">
          <Wifi size={16} className="text-green-500" />
          <span className="text-xs text-gray-500">מחובר</span>
        </div>

        {device.firmware_version && (
          <span className="text-xs text-gray-400">v{device.firmware_version}</span>
        )}
      </div>
    </div>
  );
}
