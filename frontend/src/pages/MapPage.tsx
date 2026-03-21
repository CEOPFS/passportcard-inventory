import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MapPin, RefreshCw, CheckCircle, Battery, Wifi, Cpu } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../components/Layout/Header';
import HomeMap from '../components/Map/HomeMap';
import { deviceApi, childrenApi } from '../services/api';
import { MapData, Child, Device } from '../types';
import { useAppStore } from '../store';

export default function MapPage() {
  const { children: storeChildren } = useAppStore();
  const location = useLocation();
  const justConnected = (location.state as any)?.justConnected;
  const connectedDeviceInfo = (location.state as any)?.device;

  const [mapData, setMapData] = useState<MapData | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [devicesRes, childrenRes] = await Promise.all([
        deviceApi.getAll(),
        childrenApi.getAll(),
      ]);

      const devices = devicesRes.data.devices;
      setChildren(childrenRes.data.children);

      if (devices.length > 0) {
        setDevice(devices[0]);
        const mapRes = await deviceApi.getMap(devices[0].id);
        setMapData(mapRes.data.map);
      }
    } catch (err) {
      toast.error('שגיאה בטעינת המפה');
    } finally {
      setLoading(false);
    }
  };

  const handleLocationSet = async (x: number, y: number, roomName: string) => {
    if (!selectedChildId) {
      toast.error('בחר ילד תחילה');
      return;
    }

    try {
      await childrenApi.updateLocation(selectedChildId, {
        wake_point_x: x,
        wake_point_y: y,
        room_name: roomName,
      });

      setChildren(prev => prev.map(c =>
        c.id === selectedChildId
          ? { ...c, wake_point_x: x, wake_point_y: y, room_name: roomName }
          : c
      ));

      const childName = children.find(c => c.id === selectedChildId)?.name;
      toast.success(`מיקום ההשכמה של ${childName} עודכן ל${roomName}`);
      setEditMode(false);
    } catch (err) {
      toast.error('שגיאה בעדכון המיקום');
    }
  };

  return (
    <div>
      <Header
        title="מפת הבית"
        subtitle="הגדרת מיקומי השכמה"
        rightAction={
          <button onClick={fetchData} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
            <RefreshCw size={18} className="text-white" />
          </button>
        }
      />

      <div className="p-4 space-y-4">

        {/* Device connected banner */}
        {justConnected && connectedDeviceInfo && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle size={20} className="text-green-500" />
              <span className="font-bold text-green-800 text-sm">המכשיר חובר בהצלחה!</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white rounded-xl p-2 border border-green-100">
                <Cpu size={16} className="text-primary-600 mx-auto mb-1" />
                <p className="text-xs font-semibold text-gray-700 truncate">{connectedDeviceInfo.model}</p>
                <p className="text-xs text-gray-400">דגם</p>
              </div>
              <div className="bg-white rounded-xl p-2 border border-green-100">
                <Battery size={16} className="text-green-500 mx-auto mb-1" />
                <p className="text-xs font-semibold text-gray-700">{connectedDeviceInfo.battery_level ?? 100}%</p>
                <p className="text-xs text-gray-400">סוללה</p>
              </div>
              <div className="bg-white rounded-xl p-2 border border-green-100">
                <Wifi size={16} className="text-blue-500 mx-auto mb-1" />
                <p className="text-xs font-semibold text-gray-700">מחובר</p>
                <p className="text-xs text-gray-400">סטטוס</p>
              </div>
            </div>
            {connectedDeviceInfo.did && (
              <p className="text-xs text-gray-400 text-center">מזהה מכשיר: {connectedDeviceInfo.did}</p>
            )}
            <p className="text-xs text-gray-500 text-center">לחץ על חדר במפה כדי להגדיר מיקום השכמה לכל ילד</p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary-700 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : mapData ? (
          <>
            {/* Edit mode toggle */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setEditMode(!editMode)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  editMode
                    ? 'bg-accent-500 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <MapPin size={16} />
                {editMode ? 'מצב עריכה פעיל' : 'ערוך מיקומים'}
              </button>
            </div>

            {/* Child selector for edit mode */}
            {editMode && (
              <div className="bg-accent-50 border border-accent-200 rounded-xl p-3">
                <p className="text-sm font-semibold text-accent-800 mb-2">בחר ילד לעדכון מיקום:</p>
                <div className="flex flex-wrap gap-2">
                  {children.map(child => (
                    <button
                      key={child.id}
                      onClick={() => setSelectedChildId(child.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        selectedChildId === child.id
                          ? 'bg-accent-500 text-white'
                          : 'bg-white border border-accent-200 text-accent-700 hover:bg-accent-100'
                      }`}
                    >
                      {child.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Map */}
            <HomeMap
              mapData={mapData}
              children={children}
              selectedChildId={selectedChildId || undefined}
              onLocationSet={editMode ? handleLocationSet : undefined}
              editMode={editMode}
            />

            {/* Children locations summary */}
            {children.length > 0 && (
              <div>
                <h3 className="font-bold text-gray-600 text-sm mb-2 px-1">מיקומי השכמה</h3>
                <div className="space-y-2">
                  {children.map(child => (
                    <div
                      key={child.id}
                      className="card flex items-center justify-between cursor-pointer hover:bg-gray-50"
                      onClick={() => {
                        setSelectedChildId(child.id);
                        setEditMode(true);
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                          <span className="text-sm font-bold text-primary-700">{child.name.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800 text-sm">{child.name}</p>
                          <p className="text-xs text-gray-500">{child.room_name || 'לא הוגדר חדר'}</p>
                        </div>
                      </div>
                      <div className="text-xs text-gray-400">
                        {child.wake_point_x > 0 && child.wake_point_y > 0
                          ? `(${Math.round(child.wake_point_x)}, ${Math.round(child.wake_point_y)})`
                          : 'לא הוגדר'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
            <MapPin size={48} className="text-gray-200 mx-auto mb-3" />
            <h3 className="font-bold text-gray-500 mb-1">אין מפה זמינה</h3>
            <p className="text-sm text-gray-400">חבר מכשיר כדי לראות את מפת הבית</p>
          </div>
        )}
      </div>
    </div>
  );
}
