import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Bell, Shield, Wifi, LogOut, ChevronLeft,
  Bot, Info, Smartphone, CheckCircle, Loader
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
  const [showDreameForm, setShowDreameForm] = useState(false);
  const [dreameModel, setDreameModel] = useState('X40 Ultra');
  const [dreameEmail, setDreameEmail] = useState('');
  const [dreamePassword, setDreamePassword] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [dreameConnected, setDreameConnected] = useState(false);

  const handleLogout = () => {
    clearAuth();
    toast.success('התנתקת בהצלחה');
    navigate('/login');
  };

  const handleConnectDreame = async () => {
    if (!dreameEmail.trim() || !dreamePassword.trim()) {
      toast.error('יש להזין אימייל וסיסמה של DreameHome');
      return;
    }
    setConnecting(true);
    try {
      await vendorApi.connect({ vendor: 'dreame', username: dreameEmail, password: dreamePassword, model: dreameModel });
      setDreameConnected(true);
      toast.success('Dreame חובר בהצלחה!');
      setShowDreameForm(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'שגיאה בחיבור המכשיר');
    } finally {
      setConnecting(false);
    }
  };

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
              {/* Mock / WakeBot Pro */}
              <div className="flex items-center gap-3 p-3 bg-primary-50 border border-primary-100 rounded-xl">
                <Bot size={24} className="text-primary-700" />
                <div>
                  <p className="font-bold text-sm text-primary-800">WakeBot Pro (הדגמה)</p>
                  <p className="text-xs text-gray-500">סימולציה מובנית ✓</p>
                </div>
                <span className="mr-auto text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">פעיל</span>
              </div>

              {/* Dreame — connectable */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowDreameForm(v => !v)}
                  className="w-full flex items-center gap-3 p-3 bg-white hover:bg-gray-50 transition-colors"
                >
                  <Smartphone size={24} className="text-blue-500" />
                  <div className="text-right flex-1">
                    <p className="font-semibold text-sm text-gray-800">Dreame</p>
                    <p className="text-xs text-gray-500">X40 Ultra, L20 Ultra, X30 Ultra ועוד</p>
                  </div>
                  {dreameConnected ? (
                    <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle size={10} /> מחובר
                    </span>
                  ) : (
                    <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">חבר</span>
                  )}
                </button>

                {showDreameForm && (
                  <div className="p-3 bg-gray-50 border-t border-gray-100 space-y-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">דגם</label>
                      <select
                        value={dreameModel}
                        onChange={e => setDreameModel(e.target.value)}
                        className="input-field text-sm py-2"
                      >
                        {['X40 Ultra', 'L20 Ultra', 'X30 Ultra', 'L10 Ultra'].map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">אימייל DreameHome</label>
                      <input
                        type="email"
                        placeholder="האימייל שלך באפליקציית DreameHome"
                        value={dreameEmail}
                        onChange={e => setDreameEmail(e.target.value)}
                        className="input-field text-sm py-2"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">סיסמה DreameHome</label>
                      <input
                        type="password"
                        placeholder="הסיסמה שלך באפליקציית DreameHome"
                        value={dreamePassword}
                        onChange={e => setDreamePassword(e.target.value)}
                        className="input-field text-sm py-2"
                      />
                      <p className="text-xs text-gray-400 mt-1">אותם פרטי כניסה שבהם אתה משתמש באפליקציית DreameHome</p>
                    </div>
                    <button
                      onClick={handleConnectDreame}
                      disabled={connecting}
                      className="btn-primary w-full py-2.5 text-sm flex items-center justify-center gap-2"
                    >
                      {connecting ? (
                        <><Loader size={14} className="animate-spin" /> מתחבר...</>
                      ) : (
                        'חבר Dreame'
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Coming soon */}
              {['iRobot Roomba', 'Roborock'].map(vendor => (
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
              onClick={() => { setShowDeviceModal(false); setShowDreameForm(false); }}
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
