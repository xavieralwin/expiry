import { Outlet } from 'react-router-dom';
import { NavLink } from 'react-router-dom';
import { Activity, Clock, List, LogOut, Globe, LayoutDashboard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { trackButtonClick } from '../lib/analytics';

export default function Layout() {
  const navigate = useNavigate();
  
  const handleLogout = () => {
    trackButtonClick('Layout - Sign Out');
    localStorage.removeItem('isAuthenticated');
    navigate('/login');
  };
  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-100 text-slate-600 border-r border-slate-200 flex flex-col hidden md:flex">
        <div className="p-6 border-b border-slate-200 flex items-center space-x-3">
          <div className="bg-[#a78bfa] p-2 rounded-xl">
            <Activity className="w-5 h-5 text-purple-950" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">
            URL Tracker
          </h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <NavLink 
            to="/" 
            onClick={() => trackButtonClick('Sidebar - Dashboard')}
            className={({isActive}) => `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-[#86efac] text-emerald-950 font-bold shadow-sm' : 'text-slate-500 hover:bg-slate-200 hover:text-slate-800'}`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span>Dashboard</span>
          </NavLink>

          <NavLink 
            to="/records" 
            onClick={() => trackButtonClick('Sidebar - All Records')}
            className={({isActive}) => `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-[#a78bfa] text-purple-950 font-bold shadow-sm' : 'text-slate-500 hover:bg-slate-200 hover:text-slate-800'}`}
          >
            <List className="w-5 h-5" />
            <span>All Records</span>
          </NavLink>

          <NavLink 
            to="/vanity" 
            onClick={() => trackButtonClick('Sidebar - Vanity URLs')}
            className={({isActive}) => `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-[#fef08a] text-yellow-950 font-bold shadow-sm' : 'text-slate-500 hover:bg-slate-200 hover:text-slate-800'}`}
          >
            <Globe className="w-5 h-5" />
            <span>Vanity URLs</span>
          </NavLink>
          
          <NavLink 
            to="/expiring" 
            onClick={() => trackButtonClick('Sidebar - Expiring Soon')}
            className={({isActive}) => `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-orange-500 text-white font-bold shadow-sm' : 'text-slate-500 hover:bg-slate-200 hover:text-slate-800'}`}
          >
            <Clock className="w-5 h-5" />
            <span>Expiring Soon</span>
          </NavLink>
        </nav>
        
        <div className="p-4 border-t border-slate-200">
          <button 
            onClick={handleLogout}
            className="flex items-center space-x-3 px-4 py-3 rounded-xl w-full text-slate-500 hover:bg-red-100 hover:text-red-700 transition-all font-medium cursor-pointer"
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
