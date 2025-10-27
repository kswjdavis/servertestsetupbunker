import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import EmergencyToggle from '../emergency/EmergencyToggle';

export default function Header() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [emergencyActive, setEmergencyActive] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="bg-gray-800 text-white">
      {/* Desktop single row header */}
      <div className="hidden md:block">
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-8">
              <Link to="/dashboard" className="text-xl font-bold">
                Bunkercolab
              </Link>
              <nav className="flex space-x-4">
                <Link to="/dashboard" className="hover:text-gray-300">
                  Dashboard
                </Link>
                <Link to="/system-health" className="hover:text-gray-300">
                  System Health
                </Link>
                <Link to="/devices" className="hover:text-gray-300">
                  Devices
                </Link>
                <Link to="/settings" className="hover:text-gray-300">
                  Settings
                </Link>
              </nav>
            </div>

            <div className="flex items-center space-x-4">
              {currentUser && (
                <>
                  <EmergencyToggle
                    scope="global"
                    isActive={emergencyActive}
                    onToggle={setEmergencyActive}
                  />
                  <span className="text-sm">
                    {currentUser.username} ({currentUser.role})
                  </span>
                  <button
                    onClick={handleLogout}
                    className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm min-h-[44px] min-w-[60px]"
                  >
                    Logout
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile two-row header */}
      <div className="md:hidden">
        {/* First row: Logo and navigation */}
        <div className="border-b border-gray-700">
          <div className="px-4 py-3">
            <Link to="/dashboard" className="text-lg font-bold block mb-2">
              Bunkercolab
            </Link>
            <nav className="flex space-x-4 text-sm">
              <Link to="/dashboard" className="hover:text-gray-300">
                Dashboard
              </Link>
              <Link to="/system-health" className="hover:text-gray-300">
                System Health
              </Link>
              <Link to="/devices" className="hover:text-gray-300">
                Devices
              </Link>
              <Link to="/settings" className="hover:text-gray-300">
                Settings
              </Link>
            </nav>
          </div>
        </div>

        {/* Second row: Emergency toggle, user info, logout */}
        {currentUser && (
          <div className="px-4 py-2">
            <div className="flex items-center justify-between gap-2">
              <EmergencyToggle
                scope="global"
                isActive={emergencyActive}
                onToggle={setEmergencyActive}
                className="flex-shrink-0"
              />
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs truncate">
                  {currentUser.username} ({currentUser.role})
                </span>
                <button
                  onClick={handleLogout}
                  className="bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-xs flex-shrink-0"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
