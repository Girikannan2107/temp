import React, { useState, useEffect } from 'react';
import Dashboard from './pages/Dashboard';
import { 
  UploadCloud, 
  FileText, 
  TrendingUp, 
  History, 
  Sun, 
  Moon, 
  Flame, 
  Activity, 
  Database,
  ChevronRight
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('ingest'); // 'ingest', 'viewer', 'analytics', 'historical'
  const [isDark, setIsDark] = useState(true);

  // Sync dark mode class with HTML element
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const navItems = [
    { id: 'ingest', label: 'Ingest & Upload', subtitle: 'Stage cycle reports', icon: UploadCloud },
    { id: 'viewer', label: 'Digitized Viewer', subtitle: 'Parsed document blocks', icon: FileText },
    { id: 'analytics', label: 'Analytics', subtitle: 'Tonnage & cluster signals', icon: TrendingUp },
    { id: 'historical', label: 'Historical Logs', subtitle: 'Saved cycle archive', icon: History }
  ];

  // Breadcrumbs text helper
  const getBreadcrumbs = () => {
    const activeItem = navItems.find(item => item.id === activeTab);
    if (!activeItem) return { title: '', desc: '' };
    return { title: activeItem.label, desc: activeItem.subtitle };
  };

  const breadcrumb = getBreadcrumbs();

  return (
    <div className="flex bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 min-h-screen transition-colors duration-300 font-sans selection:bg-orange-500 selection:text-white">
      {/* 1. LEFT SIDEBAR */}
      <aside className="w-64 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 flex flex-col shrink-0 sticky top-0 h-screen transition-colors duration-300 z-50">
        
        {/* Sidebar Header */}
        <div className="p-6 border-b border-slate-250 dark:border-slate-800 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-orange-500 text-white shadow-md shadow-orange-500/20">
            <Flame size={20} className="animate-pulse" />
          </div>
          <div>
            <h1 className="font-extrabold text-lg tracking-tight text-slate-900 dark:text-white leading-none">
              FORGE.IQ
            </h1>
            <span className="text-[9px] font-semibold tracking-wider text-slate-400 dark:text-slate-500 uppercase mt-1 block">
              PARSING ENGINE V3.2
            </span>
          </div>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 px-4 py-6 space-y-2.5 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-left relative transition-all duration-200 group ${
                  isActive 
                    ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-white font-bold' 
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/35 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
                }`}
              >
                {/* Active Orange Bar indicator */}
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 bg-orange-500 rounded-r" />
                )}
                
                <Icon size={18} className={`${isActive ? 'text-orange-500' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`} />
                <div>
                  <div className="text-xs leading-none">{item.label}</div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 font-normal mt-0.5 leading-none">{item.subtitle}</div>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
          <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 shadow-sm">
            <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Engine Status</div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 absolute" />
                <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300 ml-1">READY</span>
              </div>
              <span className="text-[10px] font-bold font-mono text-orange-500 bg-orange-50 dark:bg-orange-950/40 border border-orange-200/50 dark:border-orange-900/30 px-1.5 py-0.5 rounded">
                98.4%
              </span>
            </div>
          </div>
        </div>

      </aside>

      {/* 2. MAIN VIEWPORT */}
      <main className="flex-1 flex flex-col min-h-screen overflow-x-hidden relative">
        
        {/* Top Header */}
        <header className="sticky top-0 z-40 bg-white/85 dark:bg-slate-950/85 border-b border-slate-200 dark:border-slate-800 backdrop-blur-md px-6 py-4 flex items-center justify-between transition-colors duration-300">
          
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
              <Flame size={14} className="text-orange-500" />
              <span>Forge.IQ</span>
            </div>
            <ChevronRight size={12} className="text-slate-300 dark:text-slate-700" />
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-800 dark:text-slate-200">{breadcrumb.title}</span>
              <span className="text-[10px] text-slate-450 dark:text-slate-500 font-medium hidden sm:inline">&bull; {breadcrumb.desc}</span>
            </div>
          </div>

          {/* Telemetry Actions */}
          <div className="flex items-center gap-5">
            {/* Live Stats */}
            <div className="hidden md:flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-850">
                <Flame size={13} className="text-orange-500" />
                <span className="text-slate-400 font-bold dark:text-slate-500">Temp:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">1042°C</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-850">
                <Activity size={13} className="text-emerald-500" />
                <span className="text-slate-400 font-bold dark:text-slate-500">Throughput:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">4.2 t/h</span>
              </div>
            </div>

            {/* Divider */}
            <span className="hidden md:block w-px h-5 bg-slate-200 dark:bg-slate-800" />

            {/* Dark Mode Toggle */}
            <button
              onClick={() => setIsDark(!isDark)}
              className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-all hover:scale-105 shadow-sm"
              aria-label="Toggle theme"
            >
              {isDark ? <Sun size={16} className="text-amber-500" /> : <Moon size={16} />}
            </button>
          </div>
        </header>

        {/* Content Body */}
        <section className="flex-1 p-6 sm:p-8 max-w-[1600px] w-full mx-auto relative z-10 fade-in">
          <Dashboard activeTab={activeTab} setActiveTab={setActiveTab} />
        </section>

        {/* Simple visual separator at footer */}
        <footer className="py-6 border-t border-slate-200 dark:border-slate-900 bg-slate-100/30 dark:bg-slate-950/20 text-center text-[11px] text-slate-400 dark:text-slate-500 transition-colors duration-300">
          <div className="max-w-[1600px] mx-auto px-8 flex flex-col sm:flex-row items-center justify-between gap-3 font-medium">
            <p>&copy; 2026 Pouring Industry &bull; Forge.IQ Advanced Metal Analysis Engine</p>
            <div className="flex items-center gap-4 text-slate-400 dark:text-slate-500">
              <span className="flex items-center gap-1"><Database size={12} className="text-orange-500" /> Sync Active</span>
              <span className="text-slate-300 dark:text-slate-800">|</span>
              <span>Reliability Rate: <strong className="text-orange-500">99.8%</strong></span>
            </div>
          </div>
        </footer>

      </main>
    </div>
  );
}