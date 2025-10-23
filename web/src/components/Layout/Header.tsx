import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Header() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="bg-gray-800 text-white">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link to="/dashboard" className="text-xl font-bold">
              Bunkercolab
            </Link>
            <nav className="hidden md:flex space-x-4">
              <Link to="/dashboard" className="hover:text-gray-300">
                Dashboard
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
                <span className="text-sm">
                  {currentUser.username} ({currentUser.role})
                </span>
                <button
                  onClick={handleLogout}
                  className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm"
                >
                  Logout
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}