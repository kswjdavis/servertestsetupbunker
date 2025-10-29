import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ErrorBoundary from './components/common/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './components/Layout/MainLayout';
import LoadingSpinner from './components/common/LoadingSpinner';

// Lazy-loaded pages for code splitting
const LoginPage = lazy(() => import('./pages/LoginPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const BunkerDetail = lazy(() => import('./pages/BunkerDetail'));
const BunkerCreatePage = lazy(() => import('./pages/BunkerCreatePage'));
const BunkerEditPage = lazy(() => import('./pages/BunkerEditPage'));
const DeviceList = lazy(() => import('./pages/DeviceList'));
const Settings = lazy(() => import('./pages/Settings'));
const ProvisioningPage = lazy(() => import('./pages/ProvisioningPage'));
const SystemHealthPage = lazy(() => import('./pages/SystemHealthPage'));
const PrintDeploymentGuidePage = lazy(() => import('./pages/PrintDeploymentGuidePage'));

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<LoadingSpinner fullScreen />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<ProtectedRoute />}>
                <Route path="/deployment-guide" element={<PrintDeploymentGuidePage />} />
                <Route element={<MainLayout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/system-health" element={<SystemHealthPage />} />
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
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
