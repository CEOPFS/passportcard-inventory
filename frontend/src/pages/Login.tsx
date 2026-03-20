import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Bot, Mail, Lock, User, Eye, EyeOff } from 'lucide-react';
import { authApi } from '../services/api';
import { useAppStore } from '../store';

export default function Login() {
  const navigate = useNavigate();
  const { setAuth } = useAppStore();

  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', password: '' });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authApi.login(loginForm);
      const { token, user, household } = res.data;
      setAuth(token, user, household);
      toast.success(`ברוך הבא, ${user.name}!`);
      navigate('/');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'שגיאה בהתחברות');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (registerForm.password.length < 6) {
      toast.error('הסיסמה חייבת להכיל לפחות 6 תווים');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.register(registerForm);
      const { token, user, household } = res.data;
      setAuth(token, user, household);
      toast.success(`ברוך הבא, ${user.name}! החשבון נוצר בהצלחה`);
      navigate('/');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'שגיאה ביצירת החשבון');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-700 to-primary-800 flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-white/10 rounded-3xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
          <Bot size={40} className="text-white" />
        </div>
        <h1 className="text-3xl font-black text-white">WakeBot</h1>
        <p className="text-blue-200 text-sm mt-1">מערכת השכמה חכמה לילדים</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* Tabs */}
        <div className="flex">
          <button
            onClick={() => setTab('login')}
            className={`flex-1 py-4 text-sm font-bold transition-all ${
              tab === 'login'
                ? 'text-primary-700 border-b-2 border-primary-700'
                : 'text-gray-400 border-b-2 border-gray-100'
            }`}
          >
            התחברות
          </button>
          <button
            onClick={() => setTab('register')}
            className={`flex-1 py-4 text-sm font-bold transition-all ${
              tab === 'register'
                ? 'text-primary-700 border-b-2 border-primary-700'
                : 'text-gray-400 border-b-2 border-gray-100'
            }`}
          >
            הרשמה
          </button>
        </div>

        <div className="p-6">
          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative">
                <Mail size={18} className="absolute right-3 top-3.5 text-gray-400" />
                <input
                  type="email"
                  placeholder="אימייל"
                  value={loginForm.email}
                  onChange={e => setLoginForm(prev => ({ ...prev, email: e.target.value }))}
                  className="input-field pr-10"
                  required
                  dir="ltr"
                />
              </div>
              <div className="relative">
                <Lock size={18} className="absolute right-3 top-3.5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="סיסמה"
                  value={loginForm.password}
                  onChange={e => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                  className="input-field pr-10 pl-10"
                  required
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-3.5 text-gray-400"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-3 text-base"
              >
                {loading ? 'מתחבר...' : 'התחבר'}
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-2 text-gray-400">או התנסה עם</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setLoginForm({ email: 'demo@wakebot.app', password: 'demo123' });
                }}
                className="btn-secondary w-full py-2.5 text-sm"
              >
                חשבון הדגמה
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="relative">
                <User size={18} className="absolute right-3 top-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="שם מלא"
                  value={registerForm.name}
                  onChange={e => setRegisterForm(prev => ({ ...prev, name: e.target.value }))}
                  className="input-field pr-10"
                  required
                />
              </div>
              <div className="relative">
                <Mail size={18} className="absolute right-3 top-3.5 text-gray-400" />
                <input
                  type="email"
                  placeholder="אימייל"
                  value={registerForm.email}
                  onChange={e => setRegisterForm(prev => ({ ...prev, email: e.target.value }))}
                  className="input-field pr-10"
                  required
                  dir="ltr"
                />
              </div>
              <div className="relative">
                <Lock size={18} className="absolute right-3 top-3.5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="סיסמה (לפחות 6 תווים)"
                  value={registerForm.password}
                  onChange={e => setRegisterForm(prev => ({ ...prev, password: e.target.value }))}
                  className="input-field pr-10 pl-10"
                  required
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-3.5 text-gray-400"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-3 text-base"
              >
                {loading ? 'יוצר חשבון...' : 'צור חשבון'}
              </button>
            </form>
          )}
        </div>
      </div>

      <p className="text-blue-300 text-xs mt-6 text-center">
        WakeBot Pro • גרסה 1.0.0
      </p>
    </div>
  );
}
