import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { NavLink } from 'react-router-dom';
import { Activity, Clock, List, LogOut, Globe, LayoutDashboard, Network, Menu, X, Link } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { trackButtonClick } from '../lib/analytics';

export default function Layout() {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const handleLogout = () => {
    trackButtonClick('Layout - Sign Out');
    localStorage.removeItem('isAuthenticated');
    navigate('/login');
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-800 font-sans overflow-hidden">
      
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-20 shadow-sm">
        <div className="flex items-center space-x-2">
          <div className="bg-[#a78bfa] p-1.5 rounded-lg">
            <Activity className="w-5 h-5 text-purple-950" />
          </div>
          <h1 className="text-lg font-bold text-slate-800">URL Tracker</h1>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-slate-800/50 z-30"
          onClick={closeMobileMenu}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-40 w-64 bg-slate-100 text-slate-600 border-r border-slate-200 flex flex-col transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
        md:translate-x-0 md:flex
      `}>
        <div className="p-6 border-b border-slate-200 flex items-center justify-between md:justify-start space-x-3 bg-slate-100 md:bg-transparent">
          <div className="flex items-center space-x-3">
            <div className="bg-[#a78bfa] p-2 rounded-xl">
              <Activity className="w-5 h-5 text-purple-950" />
            </div>
            <h1 className="text-xl font-bold text-slate-800">
              URL Tracker
            </h1>
          </div>
          <button onClick={closeMobileMenu} className="p-2 text-slate-500 hover:bg-slate-200 rounded-lg md:hidden cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <NavLink 
            to="/" 
            onClick={() => { trackButtonClick('Sidebar - Dashboard'); closeMobileMenu(); }}
            className={({isActive}) => `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-[#86efac] text-emerald-950 font-bold shadow-sm' : 'text-slate-500 hover:bg-slate-200 hover:text-slate-800'}`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span>Dashboard</span>
          </NavLink>

          <NavLink 
            to="/records" 
            onClick={() => { trackButtonClick('Sidebar - All Records'); closeMobileMenu(); }}
            className={({isActive}) => `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-[#a78bfa] text-purple-950 font-bold shadow-sm' : 'text-slate-500 hover:bg-slate-200 hover:text-slate-800'}`}
          >
            <List className="w-5 h-5" />
            <span>All Records</span>
          </NavLink>

          <NavLink 
            to="/vanity" 
            onClick={() => { trackButtonClick('Sidebar - Vanity URLs'); closeMobileMenu(); }}
            className={({isActive}) => `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-[#fef08a] text-yellow-950 font-bold shadow-sm' : 'text-slate-500 hover:bg-slate-200 hover:text-slate-800'}`}
          >
            <Globe className="w-5 h-5" />
            <span>Vanity URLs</span>
          </NavLink>

          <NavLink 
            to="/akamai" 
            onClick={() => { trackButtonClick('Sidebar - Akamai Redirects'); closeMobileMenu(); }}
            className={({isActive}) => `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-[#93c5fd] text-blue-950 font-bold shadow-sm' : 'text-slate-500 hover:bg-slate-200 hover:text-slate-800'}`}
          >
            <Network className="w-5 h-5" />
            <span>Akamai</span>
          </NavLink>

          <NavLink 
            to="/rewrite-rules" 
            onClick={() => { trackButtonClick('Sidebar - Rewrite Rules'); closeMobileMenu(); }}
            className={({isActive}) => `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-[#fda4af] text-rose-950 font-bold shadow-sm' : 'text-slate-500 hover:bg-slate-200 hover:text-slate-800'}`}
          >
            <Link className="w-5 h-5" />
            <span>Rewrite Rules</span>
          </NavLink>
          
          <NavLink 
            to="/expiring" 
            onClick={() => { trackButtonClick('Sidebar - Expiring Soon'); closeMobileMenu(); }}
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
      <main className="flex-1 min-w-0 overflow-auto pt-16 md:pt-0 relative z-0">
        <Outlet />
      </main>
    </div>
  );
}
