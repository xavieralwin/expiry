import { Outlet } from 'react-router-dom';
import { NavLink } from 'react-router-dom';
import { Activity, Clock, List, LogOut, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Layout() {
  const navigate = useNavigate();
  
  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    navigate('/login');
  };
  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 border-r border-slate-800 flex flex-col hidden md:flex">
        <div className="p-6 border-b border-slate-800 flex items-center space-x-3">
          <div className="bg-gradient-to-r from-purple-500 to-indigo-600 p-2 rounded-lg">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-300 to-indigo-200">
            URL Tracker
          </h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <NavLink 
            to="/" 
            className={({isActive}) => `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-purple-800/50 text-purple-200 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`}
          >
            <List className="w-5 h-5" />
            <span>All Records</span>
          </NavLink>

          <NavLink 
            to="/vanity" 
            className={({isActive}) => `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-purple-800/50 text-purple-200 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`}
          >
            <Globe className="w-5 h-5" />
            <span>Vanity URLs</span>
          </NavLink>
          
          <NavLink 
            to="/expiring" 
            className={({isActive}) => `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-orange-900/50 text-orange-200 font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`}
          >
            <Clock className="w-5 h-5" />
            <span>Expiring Soon</span>
          </NavLink>
        </nav>
        
        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={handleLogout}
            className="flex items-center space-x-3 px-4 py-3 rounded-xl w-full text-slate-400 hover:bg-slate-800 hover:text-red-400 transition-all font-medium cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
