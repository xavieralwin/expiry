import { useState, useEffect } from 'react';
import { fetchRecords } from '../lib/api';
import { differenceInDays, format, parseISO, startOfMonth } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { LayoutDashboard, Link, AlertTriangle, Monitor, Globe } from 'lucide-react';

export default function OverviewDashboard() {
  const [stats, setStats] = useState({
    total: 0,
    live: 0,
    expiringSoon: 0,
    vanity: 0,
  });
  const [envStats, setEnvStats] = useState({ ICMS: 0, AEM: 0, Drupal: 0, Other: 0 });
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecords()
      .then(records => {
        const now = new Date();
        let liveCount = 0;
        let expiringCount = 0;
        let vanityCount = 0;
        
        const envCounts = { ICMS: 0, AEM: 0, Drupal: 0, Other: 0 };
        const expiryByMonth = {};

        records.forEach(r => {
          if (r.pageType === 'Akamai 301 Redirect') return; // Exclude Akamai from main stats
          // Accumulate main stats
          if (r.status === 'Live' || r.status === 'Active') liveCount++;
          if (r.pageType === 'Vanity URL') vanityCount++;
          
          if (r.expiryDate) {
             const expiry = new Date(r.expiryDate);
             const daysLeft = differenceInDays(expiry, now);
             if (daysLeft >= 0 && daysLeft <= 30 && (r.status === 'Live' || r.status === 'Active')) {
               expiringCount++;
             }

             // Accumulate chart data for future expirations (up to 6 months out)
             if (daysLeft >= -30 && daysLeft <= 180) { // include recently expired and next 6 months
                const monthKey = format(expiry, 'MMM yyyy');
                const sortKey = startOfMonth(expiry).getTime();
                if (!expiryByMonth[sortKey]) {
                  expiryByMonth[sortKey] = { name: monthKey, val: sortKey, count: 0 };
                }
                expiryByMonth[sortKey].count++;
             }
          }

          // Environment Stats
          const env = r.environment || 'ICMS';
          if (envCounts[env] !== undefined) {
             envCounts[env]++;
          } else {
             envCounts['Other']++;
          }
        });

        setStats({
          total: records.filter(r => r.pageType !== 'Akamai 301 Redirect').length,
          live: liveCount,
          expiringSoon: expiringCount,
          vanity: vanityCount
        });
        
        setEnvStats(envCounts);

        // Sort chart data chronologically
        const sortedChart = Object.values(expiryByMonth)
           .sort((a, b) => a.val - b.val)
           .map(item => ({ name: item.name, Expirations: item.count }));
        
        setChartData(sortedChart);
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading Dashboard Analytics...</div>;
  }

  return (
    <div className="p-8 pb-20">
      <header className="mb-8 block">
        <h2 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
           <LayoutDashboard className="w-8 h-8 text-purple-600" />
           Overview Dashboard
        </h2>
        <p className="text-slate-500 mt-1">High-level insights into your URL ecosystem.</p>
      </header>

      {/* Primary KPI Cards matching requested colors */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 mt-4">
        {/* Lilac / Purple: Total Records */}
        <div className="bg-[#a78bfa] rounded-3xl p-6 shadow-sm border border-purple-200 flex flex-col justify-between h-40">
          <div className="flex justify-between items-start text-purple-900">
            <h3 className="font-semibold text-lg opacity-80">Total Tracked</h3>
            <div className="bg-white/30 p-2 rounded-xl">
               <Monitor className="w-5 h-5 text-purple-950" />
            </div>
          </div>
          <div>
            <p className="text-5xl font-bold text-purple-950">{stats.total.toLocaleString()}</p>
          </div>
        </div>

        {/* Mint Green: Live & Active */}
        <div className="bg-[#86efac] rounded-3xl p-6 shadow-sm border border-green-200 flex flex-col justify-between h-40">
          <div className="flex justify-between items-start text-green-900">
            <h3 className="font-semibold text-lg opacity-80">Live / Active</h3>
            <div className="bg-white/40 p-2 rounded-xl">
               <Link className="w-5 h-5 text-green-950" />
            </div>
          </div>
          <div>
            <p className="text-5xl font-bold text-emerald-950">{stats.live.toLocaleString()}</p>
          </div>
        </div>

        {/* Orange: Expiring Soon */}
        <div className="bg-orange-500 rounded-3xl p-6 shadow-sm border border-orange-400 flex flex-col justify-between h-40">
          <div className="flex justify-between items-start text-orange-50">
            <h3 className="font-semibold text-lg opacity-90">Expiring &lt;30d</h3>
            <div className="bg-white/20 p-2 rounded-xl">
               <AlertTriangle className="w-5 h-5 text-white" />
            </div>
          </div>
          <div>
            <p className="text-5xl font-bold text-white">{stats.expiringSoon.toLocaleString()}</p>
          </div>
        </div>

        {/* Soft Yellow: Vanity URLs */}
        <div className="bg-[#fef08a] rounded-3xl p-6 shadow-sm border border-yellow-200 flex flex-col justify-between h-40">
          <div className="flex justify-between items-start text-yellow-900">
            <h3 className="font-semibold text-lg opacity-80">Vanity URLs</h3>
            <div className="bg-white/40 p-2 rounded-xl">
               <Globe className="w-5 h-5 text-yellow-950" />
            </div>
          </div>
          <div>
            <p className="text-5xl font-bold text-yellow-950">{stats.vanity.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Main Content Area: Chart and Environment Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Chart Section */}
        <div className="col-span-1 lg:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <h3 className="text-xl font-bold text-slate-800 mb-6">Expiry Forecast</h3>
          <div className="h-[300px] w-full">
            {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} />
                <YAxis tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="Expirations" fill="#a78bfa" radius={[6, 6, 6, 6]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
            ) : (
                <div className="h-full flex items-center justify-center text-slate-400">No chart data near this period.</div>
            )}
          </div>
        </div>

        {/* Right Side: Environment List (Soft Blue Background reference) */}
        <div className="col-span-1 bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <h3 className="text-xl font-bold text-slate-800 mb-6">Environment Details</h3>
          
          <div className="space-y-4">
            {Object.entries(envStats).filter(([_, val]) => val > 0).map(([env, val]) => (
              <div key={env} className="bg-[#bfdbfe] rounded-2xl p-4 flex justify-between items-center bg-opacity-70">
                <div className="flex items-center gap-3">
                   <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                   <span className="font-semibold text-blue-900">{env}</span>
                </div>
                <div className="bg-white/60 px-3 py-1 rounded-full text-blue-900 font-bold shadow-sm text-sm">
                  {val.toLocaleString()}
                </div>
              </div>
            ))}
            
            {/* If there are no domains, show empty state */}
            {Object.values(envStats).every(v => v === 0) && (
              <div className="text-slate-400 text-center py-6 text-sm">No environments populated.</div>
            )}
            
            <div className="pt-4 border-t border-slate-100 mt-4">
               <p className="text-xs text-slate-500 text-center uppercase tracking-widest font-semibold">Distribution Summary</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
