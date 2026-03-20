import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../components/Layout/Header';
import ChildCard from '../components/Children/ChildCard';
import { useAppStore } from '../store';
import { childrenApi } from '../services/api';

export default function Children() {
  const navigate = useNavigate();
  const { children, setChildren, addChild } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '',
    age: '',
    room_name: '',
  });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchChildren();
  }, []);

  const fetchChildren = async () => {
    setLoading(true);
    try {
      const res = await childrenApi.getAll();
      setChildren(res.data.children);
    } catch (err) {
      toast.error('שגיאה בטעינת רשימת הילדים');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name.trim()) {
      toast.error('שם הילד נדרש');
      return;
    }
    setAdding(true);
    try {
      const res = await childrenApi.create({
        name: addForm.name.trim(),
        age: addForm.age ? parseInt(addForm.age) : undefined,
        room_name: addForm.room_name.trim() || undefined,
      });
      addChild(res.data.child);
      toast.success(`${addForm.name} נוסף/ה בהצלחה!`);
      setShowAddModal(false);
      setAddForm({ name: '', age: '', room_name: '' });
      navigate(`/children/${res.data.child.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'שגיאה בהוספת ילד');
    } finally {
      setAdding(false);
    }
  };

  const filtered = children.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <Header
        title="ילדים"
        subtitle={`${children.length} ילדים רשומים`}
        rightAction={
          <button
            onClick={() => setShowAddModal(true)}
            className="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center text-white transition-colors"
          >
            <Plus size={22} />
          </button>
        }
      />

      <div className="p-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search size={18} className="absolute right-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="חפש ילד..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field pr-10 py-2.5"
          />
        </div>

        {/* Children list */}
        {loading ? (
          <div className="text-center py-10">
            <div className="w-8 h-8 border-4 border-primary-700 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
            <Users size={48} className="text-gray-200 mx-auto mb-3" />
            <p className="font-bold text-gray-500 mb-1">
              {search ? 'לא נמצאו תוצאות' : 'אין ילדים רשומים'}
            </p>
            <p className="text-sm text-gray-400 mb-4">
              {search ? 'נסה חיפוש אחר' : 'הוסף את הילד הראשון'}
            </p>
            {!search && (
              <button
                onClick={() => setShowAddModal(true)}
                className="btn-primary px-6 py-2.5"
              >
                <Plus size={16} className="inline ml-1" />
                הוסף ילד
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(child => (
              <ChildCard key={child.id} child={child} />
            ))}
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-0">
          <div className="bg-white rounded-t-3xl w-full max-w-lg p-6 pb-8 animate-slide-up">
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-5" />
            <h2 className="text-lg font-bold text-gray-800 mb-5">הוסף ילד חדש</h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <input
                type="text"
                placeholder="שם הילד *"
                value={addForm.name}
                onChange={e => setAddForm(prev => ({ ...prev, name: e.target.value }))}
                className="input-field"
                required
                autoFocus
              />
              <input
                type="number"
                placeholder="גיל (אופציונלי)"
                value={addForm.age}
                onChange={e => setAddForm(prev => ({ ...prev, age: e.target.value }))}
                className="input-field"
                min={1}
                max={18}
              />
              <input
                type="text"
                placeholder="שם החדר (אופציונלי)"
                value={addForm.room_name}
                onChange={e => setAddForm(prev => ({ ...prev, room_name: e.target.value }))}
                className="input-field"
              />
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary flex-1 py-3"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={adding}
                  className="btn-primary flex-1 py-3"
                >
                  {adding ? 'מוסיף...' : 'הוסף ילד'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
