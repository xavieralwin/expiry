import React, { useState, useEffect } from 'react';
import { AlertTriangle, Database, ShieldAlert } from 'lucide-react';
import { trackButtonClick } from '../lib/analytics';

export default function MaintenanceModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Show modal if user hasn't dismissed it in the current session
    const isDismissed = sessionStorage.getItem('maintenance_modal_dismissed');
    if (!isDismissed) {
      setIsOpen(true);
    }
  }, []);

  const handleDismiss = () => {
    trackButtonClick('Maintenance Notice - Dismissed');
    sessionStorage.setItem('maintenance_modal_dismissed', 'true');
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md transition-opacity duration-300">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl shadow-orange-500/10 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Background glow effects */}
        <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 rounded-full bg-orange-600/10 blur-3xl pointer-events-none" />

        {/* Content */}
        <div className="p-8 md:p-10 text-center flex flex-col items-center">
          {/* Animated Glowing Icon */}
          <div className="relative mb-6">
            <div className="absolute inset-0 rounded-full bg-amber-500/25 blur-xl animate-pulse" />
            <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-tr from-amber-500 to-orange-600 text-white shadow-lg shadow-orange-500/20">
              <Database className="w-10 h-10 animate-bounce" style={{ animationDuration: '3s' }} />
              <AlertTriangle className="w-5 h-5 absolute -bottom-1 -right-1 text-amber-200 bg-slate-900 rounded-full p-0.5 border border-slate-800" />
            </div>
          </div>

          <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight mb-3">
            Database Migration <br/>
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              In Progress
            </span>
          </h2>

          <div className="w-12 h-1 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full mb-6" />

          <p className="text-slate-300 text-sm md:text-base leading-relaxed mb-6">
            We are currently running a critical scheduled database migration. To prevent data corruption and sync conflicts, <strong>please do not add, edit, or delete any records</strong> at this time.
          </p>

          <div className="bg-slate-950/50 rounded-2xl p-4 border border-slate-800 mb-8 w-full">
            <div className="flex items-start space-x-3 text-left">
              <ShieldAlert className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-amber-400">Read-Only Mode Active</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  You can safely browse and search existing records, or export them to CSV. Data modifications are temporarily blocked.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="w-full py-4 px-6 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold rounded-2xl shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
          >
            I Understand, Proceed to View-Only
          </button>
        </div>
      </div>
    </div>
  );
}
