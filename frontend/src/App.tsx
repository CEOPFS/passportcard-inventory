import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAppStore } from './store';
import { connectSocket, onWakeUpdate, onWakeComplete, onAlertNew } from './services/socket';

// Pages
import Login from './pages/Login';
import Home from './pages/Home';
import Children from './pages/Children';
import ChildProfile from './pages/ChildProfile';
import MapPage from './pages/MapPage';
import Recordings from './pages/Recordings';
import Schedule from './pages/Schedule';
import LiveView from './pages/LiveView';
import History from './pages/History';
import Settings from './pages/Settings';

// Layout
import Navbar from './components/Layout/Navbar';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function App() {
  const { isAuthenticated, user, updateActiveSession, removeActiveSession, addAlert } = useAppStore();

  useEffect(() => {
    if (isAuthenticated && user) {
      connectSocket(user.id);

      const cleanupWakeUpdate = onWakeUpdate((data) => {
        updateActiveSession(data.sessionId, {
          state: data.state,
          message: data.message,
          childName: data.childName,
          attempt: data.attempt,
          confidence: data.confidence,
        });
      });

      const cleanupWakeComplete = onWakeComplete((data) => {
        removeActiveSession(data.sessionId);
      });

      const cleanupAlertNew = onAlertNew((data) => {
        addAlert({
          id: Date.now().toString(),
          user_id: user.id,
          type: data.type,
          message: data.message,
          read: false,
          child_id: data.childId,
          session_id: data.sessionId,
          created_at: new Date().toISOString(),
        });
      });

      return () => {
        cleanupWakeUpdate();
        cleanupWakeComplete();
        cleanupAlertNew();
      };
    }
  }, [isAuthenticated, user]);

  return (
    <BrowserRouter>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#1e3a5f',
            color: '#fff',
            fontFamily: 'Arial, sans-serif',
            direction: 'rtl',
            borderRadius: '12px',
          },
        }}
      />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <div className="min-h-screen bg-gray-50" style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>
                <Home />
                <Navbar />
              </div>
            </PrivateRoute>
          }
        />
        <Route
          path="/children"
          element={
            <PrivateRoute>
              <div className="min-h-screen bg-gray-50" style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>
                <Children />
                <Navbar />
              </div>
            </PrivateRoute>
          }
        />
        <Route
          path="/children/:id"
          element={
            <PrivateRoute>
              <div className="min-h-screen bg-gray-50" style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>
                <ChildProfile />
                <Navbar />
              </div>
            </PrivateRoute>
          }
        />
        <Route
          path="/children/:id/recordings"
          element={
            <PrivateRoute>
              <div className="min-h-screen bg-gray-50" style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>
                <Recordings />
                <Navbar />
              </div>
            </PrivateRoute>
          }
        />
        <Route
          path="/children/:id/schedule"
          element={
            <PrivateRoute>
              <div className="min-h-screen bg-gray-50" style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>
                <Schedule />
                <Navbar />
              </div>
            </PrivateRoute>
          }
        />
        <Route
          path="/map"
          element={
            <PrivateRoute>
              <div className="min-h-screen bg-gray-50" style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>
                <MapPage />
                <Navbar />
              </div>
            </PrivateRoute>
          }
        />
        <Route
          path="/live/:sessionId"
          element={
            <PrivateRoute>
              <div className="min-h-screen bg-gray-50" style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>
                <LiveView />
                <Navbar />
              </div>
            </PrivateRoute>
          }
        />
        <Route
          path="/history"
          element={
            <PrivateRoute>
              <div className="min-h-screen bg-gray-50" style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>
                <History />
                <Navbar />
              </div>
            </PrivateRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <PrivateRoute>
              <div className="min-h-screen bg-gray-50" style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>
                <Settings />
                <Navbar />
              </div>
            </PrivateRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
