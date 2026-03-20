import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Bell, Shield, Wifi, LogOut, ChevronLeft,
  Bot, Info, Moon, Smartphone
} from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../components/Layout/Header';
import { useAppStore } from '../store';
import { vendorApi } from '../services/api';

export default function Settings() {
  const navigate = useNavigate();
  const { user, household, clearAuth } = useAppStore();

  const [notifications, setNotifications] = useState({
    wakeSuccess: true,
    wakeFailed: true,
    deviceError: true,
    dailySummary: false,
  });

  const [showDeviceModal, setShowDeviceModal] = useState(false);

  const handleLogout = () => {
    clearAuth();
    toast.success('התנתקת בהצלחה');
    navigate('/login');
  };

  const settingsSections = [
    {
      title: 'חשבון',
      icon: User,
      items: [
        {
          label: 'שם',
          value: user?.name,
          type: 'display',
        },
        {
          label: 'אימייל',
          value: user?.email,
          type: 'display',
        },
        {
          label: 'שם הבית',
          value: household?.home_name,
          type: 'display',
        },
      ],
    },
  ];

  return (
    <div>
      <Header title="הגדרות" />

      <div className="p-4 space-y-4">
        {/* Profile */}
        <div className="card">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-700 flex items-center justify-center">
              <User size={24} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-gray-800 text-lg">{user?.name}</h2>
              <p className="text-sm text-gray-500">{user?.email}</p>
              <p className="text-xs text-gray-400 mt-0.5">{household?.home_name}</p>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Bell size={18} className="text-primary-700" />
            <h3 className="font-bold text-gray-700">התראות</h3>
          </div>
          <div className="space-y-3">
            {[
              { key: 'wakeSuccess', label: 'הצלחת השכמה', desc: 'כשהילד מתעורר' },
              { key: 'wakeFailed', label: 'כישלון השכמה', desc: 'כשהילד לא מתעורר' },
              { key: 'deviceError', label: 'שגיאות מכשיר', desc: 'בעיות בחיבור הרובוט' },
              { key: 'dailySummary', label: 'סיכום יומי', desc: 'סיכום פעילות יומי' },
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">{item.label}</p>
                  <p className="text-xs text-gray-400">{item.desc}</p>
                </div>
                <button
                  onClick={() => setNotifications(prev => ({ ...prev, [item.key]: !prev[item.key as keyof typeof prev] }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    notifications[item.key as keyof typeof notifications] ? 'bg-primary-700' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                      notifications[item.key as keyof typeof notifications] ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Device */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Bot size={18} className="text-primary-700" />
            <h3 className="font-bold text-gray-700">מכשיר</h3>
          </div>
          <button
            onClick={() => setShowDeviceModal(true)}
            className="w-full flex items-center justify-between py-2 group"
          >
            <div className="flex items-center gap-3">
              <Wifi size={16} className="text-gray-400" />
              <span className="text-sm text-gray-700">חבר מכשיר חדש</span>
            </div>
            <ChevronLeft size={16} className="text-gray-400 group-hover:text-gray-600" />
          </button>
        </div>

        {/* Privacy */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Shield size={18} className="text-primary-700" />
            <h3 className="font-bold text-gray-700">פרטיות ואבטחה</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">הצפנת נתונים</p>
                <p className="text-xs text-gray-400">כל הנתונים מוצפנים</p>
              </div>
              <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full font-medium">פעיל</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">קבצי צליל</p>
                <p className="text-xs text-gray-400">שמורים באופן מקומי בלבד</p>
              </div>
              <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">מקומי</span>
            </div>
          </div>
        </div>

        {/* App Info */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Info size={18} className="text-primary-700" />
            <h3 className="font-bold text-gray-700">אודות האפליקציה</h3>
          </div>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>גרסה</span>
              <span className="font-medium">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span>WakeBot Pro</span>
              <span className="font-medium text-primary-700">פעיל</span>
            </div>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full py-3.5 bg-red-50 text-red-600 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-red-100 transition-colors border border-red-100"
        >
          <LogOut size={18} />
          התנתק
        </button>
      </div>

      {/* Device connection modal */}
      {showDeviceModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl w-full max-w-lg p-6 pb-8">
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-5" />
            <h2 className="text-lg font-bold text-gray-800 mb-2">חבר מכשיר</h2>
            <p className="text-sm text-gray-500 mb-5">WakeBot תומך במגוון רובוטים</p>

            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-primary-50 border border-primary-100 rounded-xl">
                <Bot size={24} className="text-primary-700" />
                <div>
                  <p className="font-bold text-sm text-primary-800">WakeBot Pro (הדגמה)</p>
                  <p className="text-xs text-gray-500">סימולציה מובנית ✓</p>
                </div>
                <span className="mr-auto text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">פעיל</span>
              </div>

              {['iRobot Roomba', 'Roborock', 'Dreame'].map(vendor => (
                <div key={vendor} className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-100 rounded-xl opacity-60">
                  <Smartphone size={24} className="text-gray-400" />
                  <div>
                    <p className="font-semibold text-sm text-gray-600">{vendor}</p>
                    <p className="text-xs text-gray-400">בקרוב</p>
                  </div>
                  <span className="mr-auto text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">בקרוב</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowDeviceModal(false)}
              className="btn-secondary w-full py-3 mt-4"
            >
              סגור
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
