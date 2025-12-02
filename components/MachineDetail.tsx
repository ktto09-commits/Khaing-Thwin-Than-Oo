import React, { useState, useEffect } from 'react';
import { Machine, LogRecord, RecordType, TemperatureRecord, MaintenanceRecord, MachineType } from '../types';
import { TempForm } from './TempForm';
import { MaintenanceForm } from './MaintenanceForm';
import { generateDailyReport } from '../services/geminiService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts';
import { ArrowLeft, Thermometer, Wrench, History, AlertTriangle, FileText, Copy, Check, CloudCheck, Image as ImageIcon, Camera, Trash2, AlertCircle, Loader2, User } from 'lucide-react';
import { copyToClipboard } from '../services/storageService';

interface Props {
  machine: Machine;
  logs: LogRecord[];
  onBack: () => void;
  onAddLog: (log: LogRecord) => void;
  onMarkSynced: (ids: string[]) => void;
  onDeleteLog: (id: string) => void;
}

export const MachineDetail: React.FC<Props> = ({ machine, logs, onBack, onAddLog, onMarkSynced, onDeleteLog }) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'LOG_TEMP' | 'LOG_MAINTENANCE'>('OVERVIEW');
  const [startWithCamera, setStartWithCamera] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [logToDelete, setLogToDelete] = useState<string | null>(null);

  // Filter logs for this machine
  const machineLogs = logs.filter(l => l.machineId === machine.id).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  // Data for chart (Temperature only)
  const chartData = machineLogs
    .filter((l): l is TemperatureRecord => l.recordType === RecordType.TEMPERATURE)
    .slice(0, 20) // Last 20 points
    .reverse()
    .map((l) => ({
      time: new Date(l.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
      temp: l.currentTemp,
      setpoint: l.setpointTemp
    }));

  const handleGenerateReport = async () => {
    setReportLoading(true);
    const report = await generateDailyReport(machineLogs, machine);
    setAiReport(report);
    setReportLoading(false);
  };

  const handleCopy = async () => {
    const success = await copyToClipboard(machineLogs);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onMarkSynced(machineLogs.map(l => l.id));
    }
  };

  const renderOverview = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-4">
        <button 
          onClick={() => setActiveTab('LOG_TEMP')}
          className="p-4 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 flex flex-col items-center justify-center gap-2"
        >
          <Thermometer size={28} />
          <span className="font-bold">Log Temp</span>
        </button>
        
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => setActiveTab('LOG_MAINTENANCE')}
            className="p-2 bg-white border-2 border-red-100 text-red-600 rounded-xl shadow-lg shadow-red-50 hover:bg-red-50 hover:border-red-200 flex flex-col items-center justify-center gap-1"
          >
            <Wrench size={24} />
            <span className="text-xs font-bold text-center leading-tight">Report<br/>Issue</span>
          </button>
          
          <button 
            onClick={() => { setStartWithCamera(true); setActiveTab('LOG_MAINTENANCE'); }}
            className="p-2 bg-white border-2 border-purple-100 text-purple-600 rounded-xl shadow-lg shadow-purple-50 hover:bg-purple-50 hover:border-purple-200 flex flex-col items-center justify-center gap-1"
          >
            <Camera size={24} />
            <span className="text-xs font-bold text-center leading-tight">Quick<br/>Photo</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
           <p className="text-xs text-slate-500 uppercase tracking-wide font-bold">Latest Reading</p>
           {machineLogs.find(l => l.recordType === RecordType.TEMPERATURE) ? (
             <div className="mt-1">
               <span className="text-3xl font-bold text-slate-800">
                 {(machineLogs.find(l => l.recordType === RecordType.TEMPERATURE) as TemperatureRecord).currentTemp}°C
               </span>
               <span className="text-xs text-slate-400 ml-1">Target: {machine.defaultSetpoint}°</span>
             </div>
           ) : <span className="text-slate-400 italic">No data</span>}
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
           <p className="text-xs text-slate-500 uppercase tracking-wide font-bold">Health Status</p>
           <div className="mt-2 flex items-center gap-2">
             <div className={`w-3 h-3 rounded-full ${machineLogs.some(l => l.recordType === RecordType.MAINTENANCE && l.timestamp > new Date(Date.now() - 86400000).toISOString()) ? 'bg-red-500' : 'bg-green-500'}`}></div>
             <span className="font-bold text-slate-700">
                {machineLogs.some(l => l.recordType === RecordType.MAINTENANCE && l.timestamp > new Date(Date.now() - 86400000).toISOString()) ? 'Needs Check' : 'Good'}
             </span>
           </div>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm h-72">
          <h4 className="text-sm font-bold text-slate-500 mb-4">Temperature Trend (Last 20)</h4>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0"/>
              <XAxis dataKey="time" tick={{fontSize: 10}} stroke="#94a3b8" />
              <YAxis domain={['auto', 'auto']} tick={{fontSize: 10}} stroke="#94a3b8" />
              <Tooltip 
                contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
              />
              <Legend wrapperStyle={{fontSize: '12px', paddingTop: '10px'}}/>
              
              {/* Reference line for the default target */}
              <ReferenceLine 
                y={machine.defaultSetpoint} 
                stroke="red" 
                strokeDasharray="3 3" 
                label={{ position: 'insideBottomRight',  value: 'Default Target', fill: 'red', fontSize: 10 }} 
              />
              
              {/* Line for the actual setpoint recorded at that time */}
              <Line 
                type="step" 
                dataKey="setpoint" 
                name="Setpoint Setting"
                stroke="#94a3b8" 
                strokeWidth={1} 
                strokeDasharray="5 5" 
                dot={false} 
                activeDot={false} 
              />

              {/* Line for the actual temperature */}
              <Line 
                type="monotone" 
                dataKey="temp" 
                name="Temperature"
                stroke="#2563eb" 
                strokeWidth={2} 
                dot={{r: 3, fill: '#2563eb'}} 
                activeDot={{r: 5}} 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* AI Report Section */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-xl border border-indigo-100">
         <div className="flex justify-between items-center mb-2">
            <h4 className="font-bold text-indigo-900 flex items-center gap-2">
              <FileText size={16} /> AI Daily Summary
            </h4>
            <button 
              onClick={handleGenerateReport}
              disabled={reportLoading}
              className="text-xs bg-white text-indigo-600 px-3 py-1 rounded-full font-bold shadow-sm disabled:opacity-50"
            >
              {reportLoading ? 'Analyzing...' : 'Generate'}
            </button>
         </div>
         {aiReport ? (
           <p className="text-sm text-indigo-800 leading-relaxed">{aiReport}</p>
         ) : (
           <p className="text-xs text-indigo-400">Click generate to analyze recent trends and errors.</p>
         )}
      </div>

      {/* Recent History List */}
      <div>
        <div className="flex justify-between items-end mb-3">
          <h4 className="font-bold text-slate-700 flex items-center gap-2">
            <History size={18} /> Recent Activity
          </h4>
        </div>
        <div className="space-y-3">
          {machineLogs.slice(0, 5).map(log => (
            <div key={log.id} className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm flex justify-between items-start gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider
                    ${log.recordType === RecordType.TEMPERATURE ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>
                    {log.recordType === RecordType.TEMPERATURE ? 'Temp' : 'Issue'}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                  {log.syncedToSheet && (
                     <span title="Synced to Sheet" className="text-green-500 ml-1">
                       <CloudCheck size={14} />
                     </span>
                  )}
                  {log.recordedBy && (
                     <span title={`Recorded by ${log.recordedBy}`} className="flex items-center gap-1 text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded ml-auto">
                       <User size={10} /> {log.recordedBy}
                     </span>
                  )}
                </div>
                {log.recordType === RecordType.TEMPERATURE ? (
                   <div>
                     <span className="font-mono font-bold text-lg text-slate-800">
                       {(log as TemperatureRecord).currentTemp}°C
                     </span>
                     {(log as TemperatureRecord).isAnomaly && (
                       <span className="ml-2 text-xs text-red-600 font-bold bg-red-50 px-1 rounded">⚠ Anomaly</span>
                     )}
                     {log.notes && <p className="text-xs text-slate-500 mt-1 italic">"{log.notes}"</p>}
                   </div>
                ) : (
                  <div>
                    <p className="text-sm font-medium text-slate-800">{(log as MaintenanceRecord).issueDescription}</p>
                    <div className="flex gap-2 mt-1">
                       <span className="text-[10px] bg-red-100 text-red-800 px-1.5 rounded">{(log as MaintenanceRecord).severity}</span>
                       {(log as MaintenanceRecord).photoData && (
                         <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 rounded flex items-center gap-1">
                           <ImageIcon size={10} /> Photo
                         </span>
                       )}
                    </div>
                    {(log as MaintenanceRecord).photoData && (
                      <div className="mt-2">
                        <img 
                          src={(log as MaintenanceRecord).photoData} 
                          alt="Maintenance Issue" 
                          className="h-24 w-full object-cover rounded-lg border border-slate-200"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
              <button 
                onClick={() => setLogToDelete(log.id)}
                className="text-slate-300 hover:text-red-500 p-2 hover:bg-red-50 rounded-full transition-colors"
                title="Delete Record"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {machineLogs.length === 0 && <p className="text-center text-slate-400 py-4 text-sm">No records found.</p>}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {logToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl animate-in slide-in-from-bottom-4">
                <div className="flex flex-col items-center text-center gap-4">
                    <div className="p-3 bg-red-100 text-red-600 rounded-full">
                        <AlertCircle size={32} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">Delete Record?</h3>
                        <p className="text-sm text-slate-500 mt-1">
                            Are you sure you want to delete this log? This action cannot be undone.
                        </p>
                    </div>
                    <div className="flex gap-3 w-full mt-2">
                        <button
                            onClick={() => setLogToDelete(null)}
                            className="flex-1 py-3 text-slate-600 font-bold bg-slate-100 rounded-lg hover:bg-slate-200"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => {
                                onDeleteLog(logToDelete);
                                setLogToDelete(null);
                            }}
                            className="flex-1 py-3 text-white font-bold bg-red-600 rounded-lg hover:bg-red-700"
                        >
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );

  // Main Render Switch
  if (activeTab === 'LOG_TEMP') {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-lg mx-auto p-4">
          <TempForm 
            machine={machine} 
            onSave={(record) => {
              onAddLog(record);
              setActiveTab('OVERVIEW');
            }}
            onCancel={() => setActiveTab('OVERVIEW')}
          />
        </div>
      </div>
    );
  }

  if (activeTab === 'LOG_MAINTENANCE') {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-lg mx-auto p-4">
          <MaintenanceForm 
            machine={machine} 
            startWithCamera={startWithCamera}
            onSave={(record) => {
              onAddLog(record);
              setActiveTab('OVERVIEW');
              setStartWithCamera(false);
            }}
            onCancel={() => {
              setActiveTab('OVERVIEW');
              setStartWithCamera(false);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <header className="bg-white p-4 shadow-sm border-b sticky top-0 z-10 flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-colors">
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-800">{machine.name}</h1>
          <p className="text-xs text-slate-500 font-medium">{machine.type} • Target: {machine.defaultSetpoint}°C</p>
        </div>
      </header>

      <main className="p-4 max-w-lg mx-auto">
        {renderOverview()}
      </main>
      
       {copied && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-4 py-2 rounded-full shadow-lg text-sm font-bold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4 z-50">
          <Check size={16} /> Copied to Clipboard
        </div>
      )}
    </div>
  );
};