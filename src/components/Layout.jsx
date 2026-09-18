import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, Link as RouterLink } from 'react-router-dom';
import { Activity, Clock, List, LogOut, Globe, LayoutDashboard, Network, Menu, X, Link, Calendar, Bell, UserCheck } from 'lucide-react';
import { trackButtonClick } from '../lib/analytics';
import { IS_DB_MIGRATION_ACTIVE, IS_DB_MIGRATION_COMPLETE } from '../lib/maintenance';
import MaintenanceModal from './MaintenanceModal';
import { fetchMALeaves } from '../lib/api';

function parseDateString(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const str = dateStr.trim();
  if (!str) return null;

  const mdYMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (mdYMatch) {
    const month = parseInt(mdYMatch[1], 10) - 1;
    const day = parseInt(mdYMatch[2], 10);
    const year = parseInt(mdYMatch[3], 10);
    return new Date(year, month, day);
  }

  const yMdMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (yMdMatch) {
    const year = parseInt(yMdMatch[1], 10);
    const month = parseInt(yMdMatch[2], 10) - 1;
    const day = parseInt(yMdMatch[3], 10);
    return new Date(year, month, day);
  }

  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : fallback;
}

export default function Layout() {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMigrationCompleteDismissed, setIsMigrationCompleteDismissed] = useState(
    () => sessionStorage.getItem('migration_complete_dismissed') === 'true'
  );

  // MA Leave notification state
  const [maBannerText, setMaBannerText] = useState('');
  const [isMaBannerDismissed, setIsMaBannerDismissed] = useState(
    () => sessionStorage.getItem('ma_banner_dismissed') === 'true'
  );

  useEffect(() => {
    loadMaNotification();
    const handleUpdate = () => loadMaNotification();
    window.addEventListener('ma-leaves-updated', handleUpdate);
    return () => window.removeEventListener('ma-leaves-updated', handleUpdate);
  }, []);

  const loadMaNotification = async () => {
    try {
      const leaves = await fetchMALeaves();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Find active leaves based on date range or Ongoing status
      const activeLeaves = leaves.filter(l => {
        if (l.maStatus === 'Ongoing') return true;
        const from = parseDateString(l.fromDate);
        const to = parseDateString(l.toDate);
        if (from && to) {
          from.setHours(0, 0, 0, 0);
          to.setHours(23, 59, 59, 999);
          return today >= from && today <= to;
        }
        return false;
      });

      if (activeLeaves.length > 0) {
        const details = activeLeaves.map(l => `${l.seoId} (${l.idName})`).join(', ');
        setMaBannerText(`📢 MA Mandatory Leave Alert: ${details} ${activeLeaves.length === 1 ? 'is' : 'are'} on mandatory leave (mandy) this week!`);
        return;
      }

      // If no active leave today, check for upcoming leave
      const upcomingLeaves = leaves
        .map(l => ({ ...l, parsedFrom: parseDateString(l.fromDate) }))
        .filter(l => l.parsedFrom && l.parsedFrom >= today)
        .sort((a, b) => a.parsedFrom - b.parsedFrom);

      if (upcomingLeaves.length > 0) {
        const next = upcomingLeaves[0];
        setMaBannerText(`📢 Upcoming MA Leave: ${next.seoId} (${next.idName}) is scheduled from ${next.fromDate} to ${next.toDate}.`);
        return;
      }

      // Fallback if no dates set
      const defaultActive = leaves.find(l => l.seoId === 'KA10005') || leaves[0];
      if (defaultActive) {
        setMaBannerText(`📢 MA Mandatory Leave Alert: ${defaultActive.seoId} (${defaultActive.idName}) is on mandatory leave (mandy) this week!`);
      } else {
        setMaBannerText('📢 MA Mandatory Leave Alert: KA10005 (Ankit) is on mandatory leave (mandy) this week!');
      }
    } catch {
      setMaBannerText('📢 MA Mandatory Leave Alert: KA10005 (Ankit) is on mandatory leave (mandy) this week!');
    }
  };

  const handleDismissMaBanner = () => {
    sessionStorage.setItem('ma_banner_dismissed', 'true');
    setIsMaBannerDismissed(true);
  };

  const handleDismissMigrationComplete = () => {
    trackButtonClick('Migration Complete Notice - Dismissed');
    sessionStorage.setItem('migration_complete_dismissed', 'true');
    setIsMigrationCompleteDismissed(true);
  };
  
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
            to="/ma-leave-tracker" 
            onClick={() => { trackButtonClick('Sidebar - MA Leave Tracker'); closeMobileMenu(); }}
            className={({isActive}) => `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-purple-600 text-white font-bold shadow-md' : 'text-slate-500 hover:bg-purple-100 hover:text-purple-900 font-medium'}`}
          >
            <Calendar className="w-5 h-5 text-purple-400" />
            <div className="flex items-center justify-between w-full">
              <span>MA Leave Tracker</span>
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></span>
            </div>
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
        
        {/* Global MA Leave Notification Banner */}
        {!isMaBannerDismissed && maBannerText && (
          <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-950 text-white px-4 py-2.5 flex items-center justify-between gap-3 border-b border-purple-700/50 shadow-md sticky top-0 z-40 backdrop-blur-md">
            <div className="flex items-center justify-center gap-2.5 flex-grow text-xs md:text-sm font-semibold tracking-wide">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-300 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-400"></span>
              </span>
              <Bell className="w-4 h-4 text-purple-300 flex-shrink-0 animate-bounce" />
              <span className="text-purple-100 font-bold drop-shadow-sm">
                {maBannerText}
              </span>
              <RouterLink 
                to="/ma-leave-tracker" 
                className="ml-2 px-2.5 py-0.5 bg-purple-500/30 hover:bg-purple-500/50 border border-purple-400/40 text-purple-200 rounded-full text-xs font-bold transition-all underline decoration-purple-300 decoration-2 underline-offset-2 hover:text-white"
              >
                View Tracker &rarr;
              </RouterLink>
            </div>
            <button 
              onClick={handleDismissMaBanner} 
              className="text-purple-200 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer flex-shrink-0"
              title="Dismiss Notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {IS_DB_MIGRATION_ACTIVE && (
          <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white px-4 py-3 flex items-center justify-center gap-2 border-b border-orange-400/20 shadow-sm sticky top-0 z-30 backdrop-blur-sm">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-100 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
            </span>
            <span className="font-semibold text-xs md:text-sm tracking-wide text-center">
              DATABASE MIGRATION IN PROGRESS: READ-ONLY MODE ACTIVE. PLEASE DO NOT UPDATE OR DATA LOSS MAY OCCUR.
            </span>
          </div>
        )}
        {IS_DB_MIGRATION_COMPLETE && !IS_DB_MIGRATION_ACTIVE && !isMigrationCompleteDismissed && (
          <div className="bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-white px-4 py-3 flex items-center justify-between gap-2 border-b border-emerald-400/20 shadow-sm sticky top-0 z-30 backdrop-blur-sm transition-all duration-300">
            <div className="flex items-center justify-center gap-2 flex-grow">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-100 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
              </span>
              <span className="font-bold text-xs md:text-sm tracking-wide text-center uppercase">
                Database migration completed successfully. Full write access has been restored.
              </span>
            </div>
            <button 
              onClick={handleDismissMigrationComplete} 
              className="text-white hover:text-emerald-100 p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              title="Dismiss Notice"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <Outlet />
        {IS_DB_MIGRATION_ACTIVE && <MaintenanceModal />}
      </main>
    </div>
  );
}

