export interface User {
  id: string;
  name: string;
  email: string;
  locale: string;
  timezone: string;
  notification_prefs?: Record<string, any>;
  created_at?: string;
}

export interface Household {
  id: string;
  user_id: string;
  home_name: string;
  vendor_account_id?: string;
  created_at?: string;
}

export interface Device {
  id: string;
  household_id: string;
  vendor: string;
  model: string;
  capabilities: string[];
  battery_level: number;
  firmware_version?: string;
  map_data?: MapData;
  status: 'idle' | 'navigating' | 'playing_audio' | 'charging' | 'error' | 'docked';
  created_at?: string;
}

export interface MapRoom {
  id: string;
  name: string;
  nameHe: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface MapData {
  width: number;
  height: number;
  rooms: MapRoom[];
  robotPosition: { x: number; y: number };
  forbiddenZones: Array<{ x: number; y: number; width: number; height: number }>;
  chargingStation: { x: number; y: number };
  mapImageUrl?: string;
}

export interface Child {
  id: string;
  household_id: string;
  name: string;
  age?: number;
  room_name?: string;
  wake_point_x: number;
  wake_point_y: number;
  safety_radius: number;
  active: number | boolean;
  avatar_url?: string;
  created_at?: string;
  schedules?: Schedule[];
  message_count?: number;
  last_session?: WakeSession;
}

export interface WakeMessage {
  id: string;
  child_id: string;
  file_path: string;
  duration: number;
  order_index: number;
  volume: number;
  is_active: number | boolean;
  label?: string;
  created_at?: string;
}

export interface Schedule {
  id: string;
  child_id: string;
  day_of_week: number;
  time_of_day: string;
  enabled: number | boolean;
  exceptions: string[];
  created_at?: string;
}

export interface WakeSession {
  id: string;
  child_id: string;
  device_id?: string;
  scheduled_at?: string;
  started_at?: string;
  completed_at?: string;
  result_status: 'pending' | 'in_progress' | 'success' | 'failed' | 'stopped' | 'error';
  attempts_count: number;
  wake_confidence: number;
  parent_notified: number | boolean;
  log_entries: LogEntry[];
  created_at?: string;
  child_name?: string;
  avatar_url?: string;
}

export interface LogEntry {
  timestamp: string;
  event: string;
  message: string;
}

export interface Alert {
  id: string;
  user_id: string;
  type: string;
  message: string;
  read: number | boolean;
  child_id?: string;
  session_id?: string;
  created_at?: string;
}

export interface AuthState {
  token: string | null;
  user: User | null;
  household: Household | null;
  isAuthenticated: boolean;
}

export interface WakeUpdate {
  sessionId: string;
  state: string;
  message: string;
  childName: string;
  attempt?: number;
  confidence?: number;
}

export interface VendorInfo {
  id: string;
  name: string;
  logo: string;
  models: string[];
  capabilities: string[];
  authType: string;
  comingSoon?: boolean;
}
