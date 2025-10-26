import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ErrorBoundary from './components/common/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './components/Layout/MainLayout';

// Pages
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import BunkerDetail from './pages/BunkerDetail';
import BunkerCreatePage from './pages/BunkerCreatePage';
import BunkerEditPage from './pages/BunkerEditPage';
import DeviceList from './pages/DeviceList';
import Settings from './pages/Settings';
import ProvisioningPage from './pages/ProvisioningPage';

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<MainLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/bunkers/new" element={<BunkerCreatePage />} />
                <Route path="/bunkers/:id" element={<BunkerDetail />} />
                <Route path="/bunkers/:id/edit" element={<BunkerEditPage />} />
                <Route path="/devices" element={<DeviceList />} />
                <Route path="/devices/provision" element={<ProvisioningPage />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
            </Route>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
