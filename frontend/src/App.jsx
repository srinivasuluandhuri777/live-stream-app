import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Login from './pages/Login';
import HostDashboard from './pages/HostDashboard';
import ViewerDashboard from './pages/ViewerDashboard';
import StreamHost from './pages/StreamHost';
import StreamViewer from './pages/StreamViewer';

function ProtectedRoute({ children }) {
  const { user } = useAuthStore();
  const location = useLocation();
  
  if (!user) {
    // Save the current location to redirect back after login
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  }
  
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <HostDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/viewer"
          element={
            <ProtectedRoute>
              <ViewerDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/host/:streamId"
          element={
            <ProtectedRoute>
              <StreamHost />
            </ProtectedRoute>
          }
        />
        <Route
          path="/watch/:streamId"
          element={
            <ProtectedRoute>
              <StreamViewer />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

