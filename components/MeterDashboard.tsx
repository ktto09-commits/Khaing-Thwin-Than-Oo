import React, { useState } from 'react';
import { Meter, MeterRecord, RecordType } from '../types';
import { getStoredMeters, saveLog } from '../services/storageService';
import { Zap, Plus, History, Camera, Save, X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface Props {
  logs: MeterRecord[];
  onAddLog: (log: MeterRecord) => void;
  currentUser: string;
  onDetailViewChange?: (isDetail: boolean) => void;
}

export const MeterDashboard: React.FC<Props> = ({ logs, onAddLog, currentUser, onDetailViewChange }) => {
  const meters = getStoredMeters();
  const [selectedMeter, setSelectedMeter] = useState<Meter | null>(null);
  const [reading, setReading] = useState('');
  const [isLogging, setIsLogging] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMeter) return;
    
    const newLog: MeterRecord = {
      id: uuidv4(),
      meterId: selectedMeter.id,
      timestamp: new Date().toISOString(),
      recordType: RecordType.METER_READING,
      syncedToSheet: false,
      recordedBy: currentUser,
      value: parseFloat(reading)
    };
    
    onAddLog(newLog);
    setIsLogging(false);
    setReading('');
  };

  const getMeterLogs = (id: string) => {
    return logs.filter(l => l.meterId === id).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  if (selectedMeter) {
    const history = getMeterLogs(selectedMeter.id);
    const chartData = history.slice(0, 20).reverse().map(l => ({
       date: new Date(l.timestamp).toLocaleDateString(),
       val: l.value
    }));

    return (
      <div className="p-4 animate-in slide-in-from-right duration-200">
         <button onClick={() => {setSelectedMeter(null); setIsLogging(false); onDetailViewChange?.(false); }} className="text-sm font-bold text-slate-500 mb-4 flex items-center gap-1">
           ← Back to Meters
         </button>
         
         <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-6">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
               <Zap className="text-yellow-500" /> {selectedMeter.name}
            </h2>
            <p className="text-slate-500 text-sm mt-1">Meter ID: {selectedMeter.id}</p>
            
            <div className="mt-4">
               <h3 className="text-xs font-bold uppercase text-slate-400 mb-1">Last Reading</h3>
               <p className="text-3xl font-mono font-bold text-slate-900">
                 {history[0]?.value ?? '--'} <span className="text-sm text-slate-400 font-sans">kWh</span>
               </p>
               <p className="text-xs text-slate-400">
                 {history[0] ? new Date(history[0].timestamp).toLocaleString() : 'No data'}
               </p>
            </div>
         </div>

         {!isLogging ? (
           <button 
             onClick={() => setIsLogging(true)}
             className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 mb-6"
           >
             <Plus size={18} /> Log New Reading
           </button>
         ) : (
           <form onSubmit={handleSave} className="bg-slate-100 p-4 rounded-xl mb-6 animate-in fade-in">
              <div className="flex justify-between items-center mb-3">
                 <h3 className="font-bold text-slate-700">New Reading</h3>
                 <button type="button" onClick={() => setIsLogging(false)}><X size={18} className="text-slate-400"/></button>
              </div>
              <input 
                type="number" step="0.1" autoFocus
                value={reading} onChange={e => setReading(e.target.value)}
                placeholder="0.00"
                className="w-full p-4 text-2xl font-mono border rounded-lg mb-3"
                required
              />
              <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold flex justify-center gap-2">
                 <Save size={18} /> Save
              </button>
           </form>
         )}

         {chartData.length > 1 && (
           <div className="h-48 mb-6">
             <ResponsiveContainer width="100%" height="100%">
               <LineChart data={chartData}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} />
                 <XAxis dataKey="date" hide />
                 <YAxis domain={['auto', 'auto']} />
                 <Tooltip />
                 <Line type="monotone" dataKey="val" stroke="#eab308" strokeWidth={2} dot={{r:3}} />
               </LineChart>
             </ResponsiveContainer>
           </div>
         )}

         <div className="space-y-3">
            <h3 className="font-bold text-slate-700 flex items-center gap-2"><History size={16}/> History</h3>
            {history.map(h => (
               <div key={h.id} className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-lg">
                  <div>
                    <p className="font-bold text-slate-800">{h.value} kWh</p>
                    <p className="text-xs text-slate-400">{new Date(h.timestamp).toLocaleString()}</p>
                  </div>
                  <div className="text-xs text-slate-300 bg-slate-50 px-2 py-1 rounded">
                     {h.recordedBy}
                  </div>
               </div>
            ))}
         </div>
      </div>
    );
  }

  return (
    <div className="p-4 pb-20">
      <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
        <Zap className="text-yellow-500" /> Meter Records
      </h2>
      <div className="grid grid-cols-1 gap-3">
        {meters.length === 0 && (
           <div className="p-8 text-center text-slate-400 border-2 border-dashed rounded-xl">
              No meters configured. <br/> Sync with Sheet to load list.
           </div>
        )}
        {meters.map(m => {
           const lastLog = getMeterLogs(m.id)[0];
           return (
             <button 
               key={m.id} 
               onClick={() => { setSelectedMeter(m); onDetailViewChange?.(true); }}
               className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center hover:bg-slate-50 transition-colors text-left"
             >
               <div>
                 <h3 className="font-bold text-slate-800">{m.name}</h3>
                 <p className="text-xs text-slate-400 mt-1">
                   {lastLog ? `${lastLog.value} kWh • ${new Date(lastLog.timestamp).toLocaleDateString()}` : 'No readings yet'}
                 </p>
               </div>
               <div className="text-slate-300">→</div>
             </button>
           );
        })}
      </div>
    </div>
  );
};