import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, Link as RouterLink } from 'react-router-dom';
import { Activity, Clock, List, LogOut, Globe, LayoutDashboard, Network, Menu, X, Link, Calendar, Bell, UserCheck, ShieldCheck, Sun, Moon } from 'lucide-react';
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

// Toggle flag to temporarily hide unreleased features for UAT -> PROD deployment today.
// Change HIDE_UNRELEASED_FEATURES to false on Monday to re-enable them.
const HIDE_UNRELEASED_FEATURES = true;

export default function Layout() {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMigrationCompleteDismissed, setIsMigrationCompleteDismissed] = useState(
    () => sessionStorage.getItem('migration_complete_dismissed') === 'true'
  );

  // Theme State
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const toggleDarkMode = () => {
    trackButtonClick(`Theme Switcher - ${darkMode ? 'Light' : 'Dark'} Mode`);
    setDarkMode(prev => !prev);
  };

  // MA Leave notification state
  const [maBannerText, setMaBannerText] = useState('');

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

      // Find active leaves based on date range or Ongoing status (if end date has not passed)
      const activeLeaves = leaves.filter(l => {
        const from = parseDateString(l.fromDate);
        const to = parseDateString(l.toDate);
        if (to) {
          to.setHours(23, 59, 59, 999);
          if (today > to) return false; // End date passed -> Completed
        }
        if (l.maStatus === 'Ongoing') return true;
        if (from && to) {
          from.setHours(0, 0, 0, 0);
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

      // If no active or upcoming leaves scheduled
      setMaBannerText('📢 MA Mandatory Leave Alert: No mandatory leave scheduled for this week.');
    } catch {
      setMaBannerText('📢 MA Mandatory Leave Alert: No mandatory leave scheduled for this week.');
    }
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
    <div className="flex h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans overflow-hidden transition-colors duration-200">
      
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 z-20 shadow-sm">
        <div className="flex items-center space-x-2">
          <div className="bg-[#a78bfa] p-1.5 rounded-lg">
            <Activity className="w-5 h-5 text-purple-950" />
          </div>
          <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">URL Tracker</h1>
        </div>
        <div className="flex items-center space-x-1">
          {!HIDE_UNRELEASED_FEATURES && (
            <button
              onClick={toggleDarkMode}
              className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {darkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-indigo-500" />}
            </button>
          )}
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-slate-900/60 z-30 backdrop-blur-xs"
          onClick={closeMobileMenu}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-40 w-64 bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
        md:translate-x-0 md:flex
      `}>
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between md:justify-start space-x-3 bg-slate-100 dark:bg-slate-900 md:bg-transparent">
          <div className="flex items-center space-x-3">
            <div className="bg-[#a78bfa] p-2 rounded-xl">
              <Activity className="w-5 h-5 text-purple-950" />
            </div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">
              URL Tracker
            </h1>
          </div>
          <button onClick={closeMobileMenu} className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg md:hidden cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <NavLink 
            to="/" 
            onClick={() => { trackButtonClick('Sidebar - Dashboard'); closeMobileMenu(); }}
            className={({isActive}) => `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-[#86efac] text-emerald-950 font-bold shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100'}`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span>Dashboard</span>
          </NavLink>

          <NavLink 
            to="/records" 
            onClick={() => { trackButtonClick('Sidebar - All Records'); closeMobileMenu(); }}
            className={({isActive}) => `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-[#a78bfa] text-purple-950 font-bold shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100'}`}
          >
            <List className="w-5 h-5" />
            <span>All Records</span>
          </NavLink>

          <NavLink 
            to="/vanity" 
            onClick={() => { trackButtonClick('Sidebar - Vanity URLs'); closeMobileMenu(); }}
            className={({isActive}) => `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-[#fef08a] text-yellow-950 font-bold shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100'}`}
          >
            <Globe className="w-5 h-5" />
            <span>Vanity URLs</span>
          </NavLink>

          <NavLink 
            to="/akamai" 
            onClick={() => { trackButtonClick('Sidebar - Akamai Redirects'); closeMobileMenu(); }}
            className={({isActive}) => `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-[#93c5fd] text-blue-950 font-bold shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100'}`}
          >
            <Network className="w-5 h-5" />
            <span>Akamai</span>
          </NavLink>

          <NavLink 
            to="/rewrite-rules" 
            onClick={() => { trackButtonClick('Sidebar - Rewrite Rules'); closeMobileMenu(); }}
            className={({isActive}) => `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-[#fda4af] text-rose-950 font-bold shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100'}`}
          >
            <Link className="w-5 h-5" />
            <span>Rewrite Rules</span>
          </NavLink>
          
          <NavLink 
            to="/expiring" 
            onClick={() => { trackButtonClick('Sidebar - Expiring Soon'); closeMobileMenu(); }}
            className={({isActive}) => `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-orange-500 text-white font-bold shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100'}`}
          >
            <Clock className="w-5 h-5" />
            <span>Expiring Soon</span>
          </NavLink>

          {!HIDE_UNRELEASED_FEATURES && (
            <>
              <NavLink 
                to="/ma-leave-tracker" 
                onClick={() => { trackButtonClick('Sidebar - MA Leave Tracker'); closeMobileMenu(); }}
                className={({isActive}) => `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-purple-600 text-white font-bold shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 hover:text-purple-900 dark:hover:text-purple-300 font-medium'}`}
              >
                <Calendar className="w-5 h-5 text-purple-400" />
                <div className="flex items-center justify-between w-full">
                  <span>MA Leave Tracker</span>
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></span>
                </div>
              </NavLink>

              <NavLink 
                to="/soe-access-matrix" 
                onClick={() => { trackButtonClick('Sidebar - SOE Access'); closeMobileMenu(); }}
                className={({isActive}) => `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-indigo-600 text-white font-bold shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 hover:text-indigo-900 dark:hover:text-indigo-300 font-medium'}`}
              >
                <ShieldCheck className="w-5 h-5 text-indigo-400" />
                <span>SOE Access</span>
              </NavLink>
            </>
          )}
        </nav>
        
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
          {/* Theme Toggle Button */}
          {!HIDE_UNRELEASED_FEATURES && (
            <button 
              onClick={toggleDarkMode}
              className="flex items-center justify-between px-4 py-2.5 rounded-xl w-full bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300/80 dark:hover:bg-slate-700 transition-all font-semibold text-sm cursor-pointer"
            >
              <div className="flex items-center space-x-3">
                {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
                <span>{darkMode ? 'Light Theme' : 'Dark Theme'}</span>
              </div>
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-300/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                {darkMode ? 'Dark' : 'Light'}
              </span>
            </button>
          )}

          <button 
            onClick={handleLogout}
            className="flex items-center space-x-3 px-4 py-2.5 rounded-xl w-full text-slate-500 dark:text-slate-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-400 transition-all font-medium cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-auto pt-16 md:pt-0 relative z-0">
        
        {/* Global MA Leave Notification Banner */}
        {!HIDE_UNRELEASED_FEATURES && maBannerText && (
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

