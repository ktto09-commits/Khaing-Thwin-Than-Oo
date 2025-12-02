import React, { useState, useEffect } from 'react';
import { INITIAL_MACHINES, Machine, LogRecord, RecordType, TemperatureRecord, User, UserRole, MachineType } from './types';
import { getLogs, saveLog, markLogsAsSynced, deleteLog, syncLogsToGoogleSheet, getStoredMachines, syncMachinesFromCloud } from './services/storageService';
import { getCurrentUser, logout } from './services/authService';
import { MachineCard } from './components/MachineCard';
import { MachineDetail } from './components/MachineDetail';
import { SheetSetup } from './components/SheetSetup';
import { Login } from './components/Login';
import { AdminPanel } from './components/AdminPanel';
import { Snowflake, LayoutDashboard, Info, X, Link, Download, CloudUpload, Loader2, Check, Search, AlertTriangle, CheckCircle2, LogOut, Shield, Filter, RefreshCw } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [showAbout, setShowAbout] = useState(false);
  const [showSheetSetup, setShowSheetSetup] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | MachineType>('ALL');

  useEffect(() => {
    // Check auth on load
    const currentUser = getCurrentUser();
    setUser(currentUser);
    
    // Load initial data
    setLogs(getLogs());
    setMachines(getStoredMachines());

    // Listen for PWA install event
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleLogin = async (loggedInUser: User) => {
    setUser(loggedInUser);
    // Optimistically load machines on login to ensure freshness
    const updatedMachines = await syncMachinesFromCloud();
    setMachines(updatedMachines);
  };

  const handleLogout = () => {
    logout();
    setUser(null);
    setSelectedMachine(null);
  };

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  const handleAddLog = (newLog: LogRecord) => {
    // Inject the current user's name into the log record
    const logWithUser = {
        ...newLog,
        recordedBy: user?.name || 'Unknown User'
    };
    const updated = saveLog(logWithUser);
    setLogs(updated);
  };

  const handleDeleteLog = (id: string) => {
    // Permission check
    if (user?.role !== UserRole.ADMIN) {
      alert("Only Admins can delete logs.");
      return;
    }
    const updated = deleteLog(id);
    setLogs(updated);
  };

  const handleMarkSynced = (ids: string[]) => {
    const updated = markLogsAsSynced(ids);
    setLogs(updated);
  };

  // Global Sync Logic
  const unsyncedCount = logs.filter(l => !l.syncedToSheet).length;

  const handleGlobalSync = async () => {
    setIsSyncing(true);
    try {
      // 1. Sync Logs (Push)
      const logsToSync = logs.filter(l => !l.syncedToSheet);
      if (logsToSync.length > 0) {
        await syncLogsToGoogleSheet(logsToSync);
        handleMarkSynced(logsToSync.map(l => l.id));
      }

      // 2. Sync Machines (Pull)
      const updatedMachines = await syncMachinesFromCloud();
      setMachines(updatedMachines);

      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 3000);
    } catch (e) {
      console.error(e);
      alert("Sync failed. Check your connection or Sheet URL.");
    } finally {
      setIsSyncing(false);
    }
  };

  // Status Logic
  const getMachineStatus = (machineId: string) => {
    const recentLogs = logs
      .filter(l => l.machineId === machineId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // If no logs ever, it's 'GOOD' (or neutral)
    if (recentLogs.length === 0) return 'GOOD';

    const hasRecentIssue = recentLogs.some(l => {
      const isRecent = (new Date().getTime() - new Date(l.timestamp).getTime()) < (24 * 60 * 60 * 1000); // 24 hours
      if (!isRecent) return false;
      return l.recordType === RecordType.MAINTENANCE || (l.recordType === RecordType.TEMPERATURE && (l as TemperatureRecord).isAnomaly);
    });

    return hasRecentIssue ? 'ISSUE' : 'GOOD';
  };

  const machinesWithIssues = machines.filter(m => getMachineStatus(m.id) === 'ISSUE').length;
  
  const filteredMachines = machines.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          m.type.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterType === 'ALL' || m.type === filterType;
    return matchesSearch && matchesFilter;
  });

  // AUTH GUARD
  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  if (selectedMachine) {
    return (
      <MachineDetail 
        machine={selectedMachine} 
        logs={logs}
        onBack={() => setSelectedMachine(null)}
        onAddLog={handleAddLog}
        onMarkSynced={handleMarkSynced}
        onDeleteLog={handleDeleteLog}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-slate-900 text-white p-6 shadow-lg relative z-10 rounded-b-3xl">
        <div className="flex flex-col gap-4 max-w-lg mx-auto">
          {/* Title Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-500 p-2 rounded-lg shadow-lg shadow-blue-500/50">
                <Snowflake size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">ColdChain Guardian</h1>
                <p className="text-xs text-slate-400">Welcome, {user.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowAbout(true)} 
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
                aria-label="About App"
              >
                <Info size={24} />
              </button>
              <button 
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-full transition-colors"
                aria-label="Logout"
              >
                <LogOut size={24} />
              </button>
            </div>
          </div>

          {/* Quick Actions Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {installPrompt && (
              <button 
                onClick={handleInstall}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-colors shadow-sm animate-pulse whitespace-nowrap"
              >
                <Download size={14} />
                Install
              </button>
            )}
            
            <button 
              onClick={handleGlobalSync}
              disabled={isSyncing}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors border whitespace-nowrap flex-1 justify-center
                ${syncSuccess 
                  ? 'bg-green-600 text-white border-green-600' 
                  : unsyncedCount > 0 
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-600 shadow-md shadow-indigo-900/20' 
                    : 'bg-slate-800 text-slate-500 border-slate-700 hover:bg-slate-700 hover:text-slate-300'
                }`}
            >
              {isSyncing ? <Loader2 size={14} className="animate-spin" /> : (syncSuccess ? <Check size={14}/> : (unsyncedCount > 0 ? <CloudUpload size={14}/> : <RefreshCw size={14} />))}
              {isSyncing ? 'Syncing...' : (syncSuccess ? 'Synced' : (unsyncedCount > 0 ? `Sync Logs (${unsyncedCount})` : 'Refresh Data'))}
            </button>

            {user.role === UserRole.ADMIN && (
              <button 
                onClick={() => setShowAdminPanel(true)}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-colors border border-purple-600 whitespace-nowrap shadow-lg shadow-purple-900/20"
              >
                <Shield size={14} />
                Admin
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Dashboard */}
      <main className="p-4 max-w-lg mx-auto space-y-6 -mt-6">
        
        {/* Status Overview Cards */}
        <div className="grid grid-cols-2 gap-3 relative z-20">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
                <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-slate-400 uppercase">Healthy</span>
                    <div className="p-1.5 bg-green-100 text-green-600 rounded-full">
                        <CheckCircle2 size={16} />
                    </div>
                </div>
                <div>
                    <span className="text-2xl font-black text-slate-800">{machines.length - machinesWithIssues}</span>
                    <span className="text-xs text-slate-400 ml-1">machines</span>
                </div>
            </div>
            <div className={`p-4 rounded-2xl shadow-sm border flex flex-col justify-between
                ${machinesWithIssues > 0 ? 'bg-orange-50 border-orange-100' : 'bg-white border-slate-100'}`}>
                <div className="flex justify-between items-start mb-2">
                    <span className={`text-xs font-bold uppercase ${machinesWithIssues > 0 ? 'text-orange-600' : 'text-slate-400'}`}>Attention</span>
                    <div className={`p-1.5 rounded-full ${machinesWithIssues > 0 ? 'bg-orange-200 text-orange-700' : 'bg-slate-100 text-slate-400'}`}>
                        <AlertTriangle size={16} />
                    </div>
                </div>
                <div>
                    <span className={`text-2xl font-black ${machinesWithIssues > 0 ? 'text-orange-700' : 'text-slate-800'}`}>{machinesWithIssues}</span>
                    <span className={`text-xs ml-1 ${machinesWithIssues > 0 ? 'text-orange-600' : 'text-slate-400'}`}>machines</span>
                </div>
            </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
             <input 
               type="text" 
               placeholder="Search machines..."
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm placeholder:text-slate-400"
             />
        </div>

        {/* Filter Buttons */}
        <div className="flex gap-2 pb-1">
          <button 
            onClick={() => setFilterType('ALL')} 
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border
              ${filterType === 'ALL' 
                ? 'bg-slate-800 text-white border-slate-800' 
                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
          >
            All
          </button>
          <button 
            onClick={() => setFilterType(MachineType.FREEZER)} 
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border flex items-center justify-center gap-1
              ${filterType === MachineType.FREEZER 
                ? 'bg-cyan-600 text-white border-cyan-600' 
                : 'bg-white text-slate-500 border-slate-200 hover:border-cyan-200 hover:text-cyan-600'}`}
          >
            <Snowflake size={12} />
            Freezers
          </button>
          <button 
            onClick={() => setFilterType(MachineType.CHILLER)} 
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border flex items-center justify-center gap-1
              ${filterType === MachineType.CHILLER 
                ? 'bg-blue-600 text-white border-blue-600' 
                : 'bg-white text-slate-500 border-slate-200 hover:border-blue-200 hover:text-blue-600'}`}
          >
            <div className="w-2.5 h-2.5 rounded-full border-2 border-current"></div>
            Chillers
          </button>
        </div>

        <div className="flex items-center gap-2 text-slate-800 mt-2">
          <LayoutDashboard size={18} />
          <h2 className="font-bold text-base">Machines List ({filteredMachines.length})</h2>
        </div>

        <div className="space-y-4 pb-20">
          {filteredMachines.map(machine => (
            <div key={machine.id} className="relative">
                 <MachineCard 
                    machine={machine} 
                    onClick={setSelectedMachine} 
                 />
                 {getMachineStatus(machine.id) === 'ISSUE' && (
                    <div className="absolute top-2 right-2 bg-red-500 w-3 h-3 rounded-full border-2 border-white"></div>
                 )}
            </div>
          ))}
          {filteredMachines.length === 0 && (
              <div className="text-center py-10 text-slate-400 text-sm">
                  {filterType === 'ALL' 
                    ? `No machines found matching "${searchQuery}"`
                    : `No ${filterType.toLowerCase()}s found matching "${searchQuery}"`
                  }
              </div>
          )}
        </div>
      </main>

      {/* About Modal */}
      {showAbout && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowAbout(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
            
            <div className="flex flex-col items-center text-center">
              <div className="bg-blue-100 p-4 rounded-full mb-4 text-blue-600 shadow-inner">
                <Snowflake size={40} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-1">ColdChain Guardian</h2>
              <p className="text-sm text-slate-500 mb-6">Industrial Logbook v1.0</p>
              
              <div className="bg-slate-50 rounded-xl p-5 w-full text-left space-y-4 mb-6 border border-slate-100">
                 <div>
                   <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Licensed To</h3>
                   <p className="text-base text-slate-800 font-bold flex items-center gap-2">
                     🍩 J'donuts Factory
                   </p>
                 </div>
                 <div className="w-full h-px bg-slate-200"></div>
                 <div>
                   <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Developer & Owner</h3>
                   <p className="text-base text-slate-800 font-bold">
                     Khaing Thwin Than Oo
                   </p>
                 </div>
              </div>

              <p className="text-xs text-slate-500 italic px-4 leading-relaxed">
                "This app can be used under permissions of J'donuts Factory and Khaing Thwin Than Oo."
              </p>

              <button 
                onClick={() => setShowAbout(false)}
                className="mt-8 w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Panel Modal */}
      {showAdminPanel && (
        <AdminPanel 
          onClose={() => setShowAdminPanel(false)}
          onOpenSheetSetup={() => setShowSheetSetup(true)}
        />
      )}

      {/* Sheet Setup Modal */}
      {showSheetSetup && <SheetSetup onClose={() => setShowSheetSetup(false)} />}
    </div>
  );
};

export default App;