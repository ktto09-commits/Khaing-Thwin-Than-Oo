
import React, { useState, useEffect } from 'react';
import { INITIAL_MACHINES, Machine, LogRecord, RecordType, TemperatureRecord, User, UserRole, MachineType, MeterRecord, GeneratorRunRecord, GeneratorServiceRecord } from './types';
import { getLogs, saveLog, markLogsAsSynced, deleteLog, syncLogsToGoogleSheet, getStoredMachines, syncLogsFromCloud, exportToCSV, syncConfigsFromCloud, initializeData } from './services/storageService';
import { getCurrentUser, logout } from './services/authService';
import { resetAiClient } from './services/geminiService';
import { MachineCard } from './components/MachineCard';
import { MachineDetail } from './components/MachineDetail';
import { SheetSetup } from './components/SheetSetup';
import { Login } from './components/Login';
import { AdminPanel } from './components/AdminPanel';
import { MeterDashboard } from './components/MeterDashboard';
import { GeneratorDashboard } from './components/GeneratorDashboard';
import { Snowflake, LayoutDashboard, Info, X, Link, Download, CloudUpload, Loader2, Check, Search, AlertTriangle, CheckCircle2, LogOut, Shield, Filter, RefreshCw, FileDown, Database, Zap, Settings, Factory, Building2 } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'MACHINES' | 'METERS' | 'GENERATOR'>('MACHINES');
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [isChildDetailView, setIsChildDetailView] = useState(false);
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [showAbout, setShowAbout] = useState(false);
  const [showSheetSetup, setShowSheetSetup] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isMachineLoading, setIsMachineLoading] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | MachineType>('ALL');

  // Helper to sync pending logs (upload) then get updates (download)
  const performFullSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      // 1. Upload unsynced logs
      const currentLogs = getLogs();
      const pendingLogs = currentLogs.filter(l => !l.syncedToSheet);
      if (pendingLogs.length > 0) {
        // Now returns array of synced IDs
        const syncedIds = await syncLogsToGoogleSheet(pendingLogs);
        if (syncedIds.length > 0) {
          const updated = markLogsAsSynced(syncedIds);
          setLogs(updated); // Update UI with synced status
        }
      }

      // 2. Download configs and logs
      await syncConfigsFromCloud();
      resetAiClient(); // Ensure we use new API Key if synced
      
      setMachines(getStoredMachines());
      
      const latestLogs = await syncLogsFromCloud();
      setLogs(latestLogs);

      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 3000);
    } catch (e) {
      console.warn("Sync cycle error:", e);
    } finally {
      setIsSyncing(false);
      setIsMachineLoading(false);
    }
  };

  useEffect(() => {
    // 1. Force load defaults if empty
    initializeData();

    // 2. Load State
    const currentUser = getCurrentUser();
    setUser(currentUser);
    setLogs(getLogs());
    setMachines(getStoredMachines());

    // 3. Auto-sync on startup
    if (currentUser) {
      setIsMachineLoading(true);
      // Use performFullSync to handle both upload (pending) and download
      performFullSync();
    }

    const handler = (e: any) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleLogin = async (loggedInUser: User) => {
    setUser(loggedInUser);
    setIsMachineLoading(true);
    await performFullSync();
  };

  const handleGlobalSync = () => {
    performFullSync();
  };

  const handleAddLog = async (newLog: LogRecord) => {
    // 1. Save locally immediately
    const logWithUser = { ...newLog, recordedBy: user?.name || 'Unknown User' };
    const updated = saveLog(logWithUser);
    setLogs(updated);

    // 2. Try to sync to sheet immediately
    setIsSyncing(true);
    try {
      const syncedIds = await syncLogsToGoogleSheet([logWithUser]);
      if (syncedIds.includes(logWithUser.id)) {
        // Mark as synced locally
        const synced = markLogsAsSynced([logWithUser.id]);
        setLogs(synced);
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 3000);
      }
    } catch (e) {
      console.warn("Immediate sync failed - will retry later", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleMarkSynced = (ids: string[]) => { setLogs(markLogsAsSynced(ids)); };
  const handleDeleteLog = (id: string) => { 
     if (user?.role === UserRole.ADMIN) setLogs(deleteLog(id)); 
     else alert("Admin only."); 
  };
  const handleLogout = () => { logout(); setUser(null); setSelectedMachine(null); };

  // Machine Status Logic
  const getMachineStatus = (machineId: string) => {
    const recentLogs = logs.filter(l => l.machineId === machineId).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    if (recentLogs.length === 0) return 'GOOD';
    const hasRecentIssue = recentLogs.some(l => {
      const isRecent = (new Date().getTime() - new Date(l.timestamp).getTime()) < (24 * 60 * 60 * 1000);
      return l.recordType === RecordType.MAINTENANCE || (l.recordType === RecordType.TEMPERATURE && (l as TemperatureRecord).isAnomaly);
    });
    return hasRecentIssue ? 'ISSUE' : 'GOOD';
  };
  const machinesWithIssues = machines.filter(m => getMachineStatus(m.id) === 'ISSUE').length;
  const filteredMachines = machines.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase()) || m.type.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterType === 'ALL' || m.type === filterType;
    return matchesSearch && matchesFilter;
  });

  if (!user) return <Login onLogin={handleLogin} />;

  const handleTabChange = (tab: 'MACHINES' | 'METERS' | 'GENERATOR') => {
      setActiveTab(tab);
      setSelectedMachine(null); // Clear detail view when switching tabs
      setIsChildDetailView(false); // Reset child views
  };

  // Determine if any detail view is active
  const isDetailViewActive = selectedMachine !== null || isChildDetailView;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      
      {/* Top Header - Hide if showing Detail View because Detail has its own header */}
      {!isDetailViewActive && (
      <header className="bg-slate-900 text-white p-6 shadow-lg rounded-b-3xl shrink-0">
        <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-500 p-2 rounded-lg"><Building2 size={24} className="text-white" /></div>
              <div><h1 className="text-xl font-bold">Facility Logbook</h1><p className="text-xs text-slate-400">Welcome, {user.name}</p></div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowAbout(true)} className="p-2 text-slate-400 hover:bg-slate-800 rounded-full"><Info size={24} /></button>
              <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-full"><LogOut size={24} /></button>
            </div>
        </div>
        
        {/* Quick Actions */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
           <button onClick={handleGlobalSync} disabled={isSyncing} className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 border whitespace-nowrap flex-1 justify-center ${syncSuccess ? 'bg-green-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
              {isSyncing ? <Loader2 size={14} className="animate-spin"/> : syncSuccess ? <Check size={14}/> : <RefreshCw size={14}/>} {isSyncing ? 'Syncing...' : 'Refresh Data'}
           </button>
           {user.role === UserRole.ADMIN && (
              <button onClick={() => setShowAdminPanel(true)} className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-bold flex items-center gap-2 whitespace-nowrap"><Shield size={14}/> Admin</button>
           )}
        </div>
      </header>
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        
        {/* MACHINES TAB */}
        {activeTab === 'MACHINES' && !selectedMachine && (
           <div className="p-4 space-y-4 pb-24 animate-in fade-in">
             {/* Stats */}
             <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100"><span className="text-xs font-bold text-slate-400">HEALTHY</span><p className="text-2xl font-black text-slate-800">{Math.max(0, machines.length - machinesWithIssues)}</p></div>
                <div className={`p-4 rounded-2xl shadow-sm border ${machinesWithIssues > 0 ? 'bg-orange-50 border-orange-100' : 'bg-white border-slate-100'}`}><span className="text-xs font-bold text-slate-400">ATTENTION</span><p className={`text-2xl font-black ${machinesWithIssues > 0 ? 'text-orange-700' : 'text-slate-800'}`}>{machinesWithIssues}</p></div>
             </div>

             {/* Search/Filter */}
             <div className="flex gap-2">
                <div className="relative flex-1"><Search className="absolute left-3 top-2.5 text-slate-400" size={16}/><input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-white border rounded-xl text-sm"/></div>
                <div className="flex bg-white rounded-xl border p-1">
                   <button onClick={() => setFilterType('ALL')} className={`px-3 py-1 text-xs font-bold rounded-lg ${filterType === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}>All</button>
                   <button onClick={() => setFilterType(MachineType.FREEZER)} className={`px-3 py-1 text-xs font-bold rounded-lg ${filterType === MachineType.FREEZER ? 'bg-cyan-100 text-cyan-700' : 'text-slate-400'}`}><Snowflake size={14}/></button>
                   <button onClick={() => setFilterType(MachineType.CHILLER)} className={`px-3 py-1 text-xs font-bold rounded-lg ${filterType === MachineType.CHILLER ? 'bg-blue-100 text-blue-700' : 'text-slate-400'}`}>C</button>
                </div>
             </div>

             {isMachineLoading ? <div className="text-center py-10"><Loader2 className="animate-spin inline text-slate-400"/></div> : 
               filteredMachines.length === 0 ? 
               <div className="text-center py-10 text-slate-400 border-2 border-dashed rounded-xl">No machines found.<br/>Sync with sheet.</div> :
               filteredMachines.map(m => (
                 <div key={m.id} className="relative">
                   <MachineCard machine={m} onClick={setSelectedMachine} />
                   {getMachineStatus(m.id) === 'ISSUE' && <div className="absolute top-2 right-2 bg-red-500 w-3 h-3 rounded-full border-2 border-white"></div>}
                 </div>
               ))
             }
           </div>
        )}

        {/* MACHINE DETAIL VIEW (Embedded) */}
        {activeTab === 'MACHINES' && selectedMachine && (
           <MachineDetail 
              machine={selectedMachine} 
              logs={logs} 
              onBack={() => setSelectedMachine(null)} 
              onAddLog={handleAddLog} 
              onMarkSynced={handleMarkSynced} 
              onDeleteLog={handleDeleteLog} 
           />
        )}

        {/* ENERGY TAB */}
        {activeTab === 'METERS' && (
           <MeterDashboard 
             logs={logs.filter(l => l.recordType === RecordType.METER_READING) as MeterRecord[]} 
             onAddLog={handleAddLog} 
             currentUser={user.name} 
             onDetailViewChange={setIsChildDetailView}
           />
        )}

        {/* GENERATOR TAB */}
        {activeTab === 'GENERATOR' && (
           <GeneratorDashboard 
             runLogs={logs.filter(l => l.recordType === RecordType.GENERATOR_RUN) as GeneratorRunRecord[]}
             serviceLogs={logs.filter(l => l.recordType === RecordType.GENERATOR_SERVICE) as GeneratorServiceRecord[]}
             onAddLog={handleAddLog}
             currentUser={user.name}
             onDetailViewChange={setIsChildDetailView}
           />
        )}
      </main>

      {/* Persistent Bottom Navigation - Visible ONLY on main pages (not details) */}
      {!isDetailViewActive && (
      <nav className="bg-white border-t border-slate-200 pb-safe pt-2 px-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] shrink-0 z-20">
         <div className="flex justify-around items-center h-14">
            <button onClick={() => handleTabChange('MACHINES')} className={`flex flex-col items-center gap-1 w-20 ${activeTab === 'MACHINES' ? 'text-blue-600' : 'text-slate-400'}`}>
               <div className={`p-1.5 rounded-full ${activeTab === 'MACHINES' ? 'bg-blue-50' : ''}`}><Snowflake size={20}/></div>
               <span className="text-[10px] font-bold">Machines</span>
            </button>
            <button onClick={() => handleTabChange('METERS')} className={`flex flex-col items-center gap-1 w-20 ${activeTab === 'METERS' ? 'text-yellow-600' : 'text-slate-400'}`}>
               <div className={`p-1.5 rounded-full ${activeTab === 'METERS' ? 'bg-yellow-50' : ''}`}><Zap size={20}/></div>
               <span className="text-[10px] font-bold">Energy</span>
            </button>
            <button onClick={() => handleTabChange('GENERATOR')} className={`flex flex-col items-center gap-1 w-20 ${activeTab === 'GENERATOR' ? 'text-orange-600' : 'text-slate-400'}`}>
               <div className={`p-1.5 rounded-full ${activeTab === 'GENERATOR' ? 'bg-orange-50' : ''}`}><Factory size={20}/></div>
               <span className="text-[10px] font-bold">Generator</span>
            </button>
         </div>
      </nav>
      )}

      {showAdminPanel && <AdminPanel onClose={() => setShowAdminPanel(false)} onOpenSheetSetup={() => setShowSheetSetup(true)} />}
      {showSheetSetup && <SheetSetup onClose={() => setShowSheetSetup(false)} />}
      {showAbout && <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-8" onClick={() => setShowAbout(false)}><div className="bg-white p-6 rounded-2xl w-full max-w-sm">
        <h2 className="font-bold text-xl mb-2">About</h2>
        <p className="text-sm text-slate-500 mb-1">Facility Logbook v2.2</p>
        <p className="text-sm text-slate-900 font-bold">Created by Khaing Thwin Than Oo</p>
        <p className="text-xs text-slate-500 font-medium mb-4">Senior M&E Incharge<br/>M&E Department, J'Donuts</p>
        <button className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold">Close</button>
      </div></div>}
    </div>
  );
};

export default App;
