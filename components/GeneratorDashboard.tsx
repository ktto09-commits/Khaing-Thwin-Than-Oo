
import React, { useState, useRef } from 'react';
import { GeneratorRunRecord, GeneratorServiceRecord, RecordType, Generator } from '../types';
import { getStoredGenerators } from '../services/storageService';
import { analyzeMaintenanceIssue } from '../services/geminiService';
import { Settings, Timer, X, Wrench, FileText, Filter, ArrowRight, ArrowLeft, PenTool, Droplets, Activity, AlertTriangle, CheckCircle2, AlertCircle, CloudCheck, User, AlertOctagon, Sparkles, Loader2, Camera, Mic, MicOff, Image as ImageIcon, Save } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface Props {
  runLogs: GeneratorRunRecord[];
  serviceLogs: GeneratorServiceRecord[];
  onAddLog: (log: any) => void;
  currentUser: string;
  onDetailViewChange?: (isDetail: boolean) => void;
}

export const GeneratorDashboard: React.FC<Props> = ({ runLogs, serviceLogs, onAddLog, currentUser, onDetailViewChange }) => {
  const generators = getStoredGenerators();
  const [selectedGen, setSelectedGen] = useState<Generator | null>(null);
  const [activeTab, setActiveTab] = useState<'STATUS' | 'MAINTENANCE' | 'SPECS'>('STATUS');
  
  const [isLoggingRun, setIsLoggingRun] = useState(false);
  const [isLoggingService, setIsLoggingService] = useState(false);
  const [isAskingAi, setIsAskingAi] = useState(false);
  
  // Forms
  const [runHours, setRunHours] = useState('');
  const [runNotes, setRunNotes] = useState('');
  
  const [serviceType, setServiceType] = useState('Regular Service');
  const [parts, setParts] = useState('');
  const [serviceRunHours, setServiceRunHours] = useState('');

  // AI Form
  const [aiIssue, setAiIssue] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [aiPhoto, setAiPhoto] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- SERVICE LOGIC HELPER ---
  const getServiceStatus = (genId: string) => {
    const runs = runLogs.filter(l => l.generatorId === genId);
    const servicesWithReadings = serviceLogs
        .filter(l => l.generatorId === genId && typeof l.runHours === 'number')
        .map(l => ({ timestamp: l.timestamp, runHours: l.runHours as number }));
    
    const allReadings = [...runs, ...servicesWithReadings].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const currentReading = allReadings[0]?.runHours || 0;
    
    const maintenanceServices = serviceLogs
        .filter(l => l.generatorId === genId && l.serviceType === 'Regular Service')
        .sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    const lastService = maintenanceServices[0];
    let hoursSince = currentReading;
    
    if (lastService) {
        if (typeof lastService.runHours === 'number') {
           hoursSince = Math.max(0, currentReading - lastService.runHours);
        } else {
           const readingAtServiceLog = allReadings.find(r => new Date(r.timestamp) <= new Date(lastService.timestamp));
           const readingAtService = readingAtServiceLog?.runHours || 0;
           hoursSince = Math.max(0, currentReading - readingAtService);
        }
    }

    let status: 'GOOD' | 'WARNING' | 'CRITICAL' = 'GOOD';
    if (hoursSince >= 500) status = 'CRITICAL';
    else if (hoursSince >= 450) status = 'WARNING';

    return {
      hoursSince,
      status,
      currentReading,
      lastServiceDate: lastService ? new Date(lastService.timestamp).toLocaleDateString() : 'None'
    };
  };

  const genRunLogs = selectedGen ? runLogs.filter(l => l.generatorId === selectedGen.id).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) : [];
  const genServiceLogs = selectedGen ? serviceLogs.filter(l => l.generatorId === selectedGen.id).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) : [];
  
  const genStatus = selectedGen ? getServiceStatus(selectedGen.id) : null;

  const handleRunSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGen) return;

    const hoursVal = parseFloat(runHours);
    if (isNaN(hoursVal)) {
        alert("Please enter a valid number for Run Hours.");
        return;
    }

    const newLog: GeneratorRunRecord = {
       id: uuidv4(), timestamp: new Date().toISOString(), recordType: RecordType.GENERATOR_RUN,
       syncedToSheet: false, recordedBy: currentUser, generatorId: selectedGen.id,
       runHours: hoursVal, notes: runNotes
    };
    onAddLog(newLog);
    setIsLoggingRun(false); setRunHours(''); setRunNotes('');
  };

  const handleServiceSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGen) return;

    let hoursToSave: number | undefined = undefined;
    if (serviceType === 'Regular Service' || serviceType === 'Repair') {
        if (serviceRunHours) {
            const val = parseFloat(serviceRunHours);
            if (!isNaN(val)) hoursToSave = val;
            else {
                alert("Please enter valid Run Hours for this service record.");
                return;
            }
        } else if (serviceType === 'Regular Service') {
             alert("Regular Service requires current Run Hours to reset the maintenance counter.");
             return;
        }
    }

    const newLog: GeneratorServiceRecord = {
       id: uuidv4(), timestamp: new Date().toISOString(), recordType: RecordType.GENERATOR_SERVICE,
       syncedToSheet: false, recordedBy: currentUser, generatorId: selectedGen.id,
       serviceType, partsReplaced: parts,
       runHours: hoursToSave
    };
    onAddLog(newLog);
    setIsLoggingService(false); setParts(''); setServiceRunHours('');
  };

  const handleSaveAiLog = () => {
    if (!selectedGen || !aiResponse) return;
    
    // Save as a service record with type "AI Diagnosis"
    const newLog: GeneratorServiceRecord = {
       id: uuidv4(), 
       timestamp: new Date().toISOString(), 
       recordType: RecordType.GENERATOR_SERVICE,
       syncedToSheet: false, 
       recordedBy: currentUser, 
       generatorId: selectedGen.id,
       serviceType: 'AI Diagnosis',
       partsReplaced: aiIssue, // Store the question in parts/details
       aiAdvice: aiResponse,
       photoData: aiPhoto || undefined
    };
    
    onAddLog(newLog);
    setIsAskingAi(false);
    setAiResponse(null);
    setAiIssue('');
    setAiPhoto(null);
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setAiIssue(prev => prev ? `${prev} ${transcript}` : transcript);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          const compressedData = canvas.toDataURL('image/jpeg', 0.7);
          setAiPhoto(compressedData);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAskAi = async () => {
      if (!selectedGen || !aiIssue) return;
      setAiLoading(true);
      // Call with 'Generator' equipment type and photo
      const advice = await analyzeMaintenanceIssue(selectedGen.name, aiIssue, aiPhoto || undefined, 'Myanmar', 'Generator');
      setAiResponse(advice);
      setAiLoading(false);
  };

  // --- VIEW 1: LIST OF GENERATORS ---
  if (!selectedGen) {
     return (
        <div className="p-4 pb-20">
           <div className="bg-slate-900 text-white p-6 rounded-2xl mb-6 shadow-lg">
              <h2 className="text-xl font-bold flex items-center gap-2 mb-1">
                 <Settings className="text-orange-400" /> Generator Fleet
              </h2>
              <p className="text-sm text-slate-400">Monitor usage and service intervals.</p>
           </div>
           
           {generators.length === 0 && (
              <div className="text-center p-8 border-2 border-dashed border-slate-300 rounded-xl text-slate-400">
                 No generators found.<br/>Sync from Cloud to load list.
              </div>
           )}

           <div className="grid grid-cols-1 gap-3">
              {generators.map(g => {
                 const status = getServiceStatus(g.id);
                 let borderClass = 'border-l-4 border-l-emerald-500';
                 if (status.status === 'WARNING') borderClass = 'border-l-4 border-l-amber-500';
                 if (status.status === 'CRITICAL') borderClass = 'border-l-4 border-l-red-600';
                 
                 return (
                 <button 
                    key={g.id} 
                    onClick={() => { setSelectedGen(g); setActiveTab('STATUS'); onDetailViewChange?.(true); }}
                    className={`bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center hover:bg-slate-50 transition-all text-left group ${borderClass}`}
                 >
                    <div>
                       <div className="flex items-center gap-2">
                         <h3 className="font-bold text-slate-800 text-lg">{g.name}</h3>
                         {status.status === 'WARNING' && <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1"><AlertTriangle size={10}/> Prep Parts</span>}
                         {status.status === 'CRITICAL' && <span className="bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1"><AlertCircle size={10}/> Service Due</span>}
                       </div>
                       
                       <div className="flex items-center gap-3 mt-1">
                          <p className="text-xs text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded">
                             {g.model || 'Unknown Model'}
                          </p>
                          <p className="text-xs text-slate-400">
                             {status.hoursSince.toFixed(0)} hrs since svc
                          </p>
                       </div>
                    </div>
                    <div className="text-slate-300 group-hover:text-slate-500">
                       <ArrowRight size={20}/>
                    </div>
                 </button>
                 );
              })}
           </div>
           
           <div className="mt-6 flex gap-4 justify-center text-[10px] text-slate-400 uppercase font-bold tracking-wider">
               <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Good</div>
               <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500"></div> Prep (450h+)</div>
               <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-600"></div> Due (500h+)</div>
           </div>
        </div>
     );
  }

  // --- VIEW 2: DETAIL DASHBOARD ---
  return (
    <div className="pb-20 animate-in slide-in-from-right duration-200">
      {/* Detail Header */}
      <div className="bg-slate-900 text-white p-4 pt-4 pb-6 rounded-b-3xl mb-4 sticky top-0 z-10 shadow-lg">
         <button onClick={() => { setSelectedGen(null); onDetailViewChange?.(false); }} className="text-slate-400 hover:text-white flex items-center gap-1 text-xs font-bold mb-3">
            <ArrowLeft size={14}/> Back to List
         </button>
         <div className="flex justify-between items-start">
             <div>
                <h2 className="text-2xl font-bold mb-1">{selectedGen.name}</h2>
                <p className="text-sm text-slate-400 mb-4">{selectedGen.model}</p>
             </div>
             {genStatus && (
               <div className={`px-3 py-1 rounded-lg text-xs font-bold border ${
                 genStatus.status === 'GOOD' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                 genStatus.status === 'WARNING' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                 'bg-red-500/10 border-red-500/20 text-red-400'
               }`}>
                  {genStatus.status === 'GOOD' ? 'Status: Good' : genStatus.status === 'WARNING' ? 'Service Soon' : 'Service Overdue'}
               </div>
             )}
         </div>
         
         <div className="flex bg-slate-800 p-1 rounded-xl">
            <button onClick={() => setActiveTab('STATUS')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${activeTab === 'STATUS' ? 'bg-slate-600 text-white' : 'text-slate-400'}`}>Status</button>
            <button onClick={() => setActiveTab('MAINTENANCE')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${activeTab === 'MAINTENANCE' ? 'bg-slate-600 text-white' : 'text-slate-400'}`}>Service</button>
            <button onClick={() => setActiveTab('SPECS')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${activeTab === 'SPECS' ? 'bg-slate-600 text-white' : 'text-slate-400'}`}>Parts</button>
         </div>
      </div>

      <div className="p-4">
        {/* STATUS TAB */}
        {activeTab === 'STATUS' && genStatus && (
           <div className="animate-in fade-in">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-4">
                 <div className="flex justify-between items-center mb-4">
                     <h3 className="text-xs font-bold uppercase text-slate-400 flex items-center gap-2">
                        <Activity size={14}/> Total Run Hours
                     </h3>
                     <span className="text-slate-400 text-[10px] font-mono">{genStatus.lastServiceDate !== 'None' ? `Last Regular Svc: ${genStatus.lastServiceDate}` : 'No Regular Service'}</span>
                 </div>
                 <p className="text-4xl font-mono font-bold text-slate-800">{genStatus.currentReading.toFixed(1)}</p>
                 
                 {/* Progress Bar for Service */}
                 <div className="mt-6">
                    <div className="flex justify-between text-xs mb-1 font-bold">
                        <span className="text-slate-500">Service Interval</span>
                        <span className={`${genStatus.hoursSince >= 500 ? 'text-red-600' : genStatus.hoursSince >= 450 ? 'text-amber-600' : 'text-emerald-600'}`}>
                           {genStatus.hoursSince.toFixed(0)} / 500 hrs
                        </span>
                    </div>
                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                           className={`h-full transition-all duration-500 rounded-full ${genStatus.status === 'CRITICAL' ? 'bg-red-500' : genStatus.status === 'WARNING' ? 'bg-amber-500' : 'bg-emerald-500'}`}
                           style={{ width: `${Math.min(100, (genStatus.hoursSince / 500) * 100)}%` }}
                        ></div>
                    </div>
                    {genStatus.status === 'WARNING' && <p className="text-[10px] text-amber-600 mt-1 font-bold">Approaching 500h - Prepare oil & filters!</p>}
                    {genStatus.status === 'CRITICAL' && <p className="text-[10px] text-red-600 mt-1 font-bold">Limit exceeded. Service immediately.</p>}
                 </div>
              </div>

              {!isLoggingRun ? (
                 <button onClick={() => setIsLoggingRun(true)} className="w-full py-3 bg-orange-600 text-white rounded-xl font-bold flex justify-center gap-2 mb-6 shadow-lg shadow-orange-200 hover:bg-orange-700 active:scale-95 transition-all">
                    <Timer size={20}/> Log Run Hours
                 </button>
              ) : (
                 <form onSubmit={handleRunSave} className="bg-orange-50 p-4 rounded-xl mb-6 border border-orange-100 animate-in slide-in-from-top-2">
                    <div className="flex justify-between mb-2">
                       <h4 className="font-bold text-orange-900">Update Hours</h4>
                       <button type="button" onClick={() => setIsLoggingRun(false)}><X size={18} className="text-orange-400"/></button>
                    </div>
                    <input type="number" step="0.1" value={runHours} onChange={e => setRunHours(e.target.value)} className="w-full p-3 border rounded-lg mb-2 text-lg font-bold" placeholder="Current Meter Reading (e.g. 5120.5)" required />
                    <input type="text" value={runNotes} onChange={e => setRunNotes(e.target.value)} className="w-full p-3 border rounded-lg mb-3" placeholder="Notes (e.g. Test Run)" />
                    <button type="submit" className="w-full py-3 bg-orange-600 text-white rounded-lg font-bold">Save</button>
                 </form>
              )}

              <h3 className="font-bold text-slate-700 mb-2 pl-1">Run History (Last 50)</h3>
              <div className="space-y-2">
                 {genRunLogs.slice(0, 50).map(r => (
                    <div key={r.id} className="bg-white p-3 rounded-lg border border-slate-100 flex justify-between items-center shadow-sm">
                       <div>
                          <div className="flex items-center gap-2">
                             <span className="font-bold text-slate-800">{r.runHours} hrs</span>
                             {r.syncedToSheet && <span title="Synced to Cloud"><CloudCheck size={14} className="text-emerald-500" /></span>}
                          </div>
                          {r.notes && <span className="text-xs text-slate-500 block">{r.notes}</span>}
                       </div>
                       <div className="text-right">
                          <div className="text-xs text-slate-400">{new Date(r.timestamp).toLocaleDateString()}</div>
                          {r.recordedBy && <div className="text-[10px] text-slate-300 flex items-center gap-1 justify-end"><User size={10}/> {r.recordedBy}</div>}
                       </div>
                    </div>
                 ))}
                 {genRunLogs.length === 0 && <p className="text-slate-400 text-sm italic pl-1">No run logs recorded.</p>}
              </div>
           </div>
        )}

        {/* MAINTENANCE TAB */}
        {activeTab === 'MAINTENANCE' && (
           <div className="animate-in fade-in">
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-4">
                 <h3 className="text-xs font-bold uppercase text-blue-800 mb-1">Last Regular Service</h3>
                 <p className="font-bold text-lg text-slate-800">{genStatus && genStatus.lastServiceDate !== 'None' ? genStatus.lastServiceDate : 'None Recorded'}</p>
                 
                 {/* Show details of latest service even if not Regular */}
                 <p className="text-sm text-slate-600 mt-2 border-t border-blue-200 pt-2">
                    Latest Activity: <span className="font-bold">{genServiceLogs[0]?.serviceType || '-'}</span>
                 </p>
                 {genServiceLogs[0]?.runHours && (
                     <p className="text-xs text-slate-500">Meter: {genServiceLogs[0].runHours} hrs</p>
                 )}
              </div>
              
              <div className="grid grid-cols-2 gap-3 mb-6">
                <button onClick={() => setIsLoggingService(true)} className="py-3 bg-slate-900 text-white rounded-xl font-bold flex flex-col items-center justify-center gap-1 shadow-lg shadow-slate-200">
                    <Wrench size={20}/> <span>Log Service</span>
                </button>
                <button onClick={() => setIsAskingAi(true)} className="py-3 bg-purple-600 text-white rounded-xl font-bold flex flex-col items-center justify-center gap-1 shadow-lg shadow-purple-200">
                    <Sparkles size={20}/> <span>Ask AI Help</span>
                </button>
              </div>

              {isAskingAi && (
                  <div className="bg-purple-50 p-4 rounded-xl mb-6 border border-purple-100 animate-in zoom-in-95">
                      <div className="flex justify-between items-center mb-3">
                         <h3 className="font-bold text-purple-900 flex items-center gap-2"><Sparkles size={16}/> Generator Troubleshooter</h3>
                         <button onClick={() => {setIsAskingAi(false); setAiResponse(null); setAiPhoto(null);}}><X size={18} className="text-purple-400"/></button>
                      </div>
                      
                      <div className="mb-3">
                          <label className="text-xs font-bold text-purple-700 mb-1 block">Describe Issue (e.g. "Engine smoking", "Won't start")</label>
                          <div className="relative">
                            <textarea 
                                value={aiIssue} 
                                onChange={e => setAiIssue(e.target.value)} 
                                rows={3} 
                                className="w-full p-3 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-400"
                                placeholder="Details..."
                            />
                            <div className="absolute right-2 bottom-2 flex gap-2">
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  ref={fileInputRef} 
                                  onChange={handlePhotoSelect} 
                                  className="hidden" 
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`p-1.5 rounded-full transition-colors ${
                                    aiPhoto ? 'bg-indigo-100 text-indigo-600' : 'bg-purple-100 text-purple-600 hover:bg-purple-200'
                                    }`}
                                >
                                    <Camera size={14} />
                                </button>
                                <button
                                    type="button"
                                    onClick={toggleListening}
                                    className={`p-1.5 rounded-full transition-colors ${
                                    isListening ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-purple-100 text-purple-600 hover:bg-purple-200'
                                    }`}
                                >
                                    {isListening ? <MicOff size={14} /> : <Mic size={14} />}
                                </button>
                            </div>
                          </div>
                      </div>

                      {aiPhoto && (
                        <div className="relative mb-3 inline-block">
                          <img src={aiPhoto} alt="Issue" className="h-24 rounded-lg border border-purple-200" />
                          <button 
                             onClick={() => setAiPhoto(null)}
                             className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"
                          >
                            <X size={12}/>
                          </button>
                        </div>
                      )}

                      {aiResponse && (
                          <div className="bg-white p-3 rounded-lg border border-purple-100 text-sm text-slate-700 mb-3 whitespace-pre-wrap">
                              {aiResponse}
                          </div>
                      )}

                      {!aiResponse ? (
                          <button 
                            onClick={handleAskAi}
                            disabled={aiLoading || !aiIssue}
                            className="w-full py-2 bg-purple-600 text-white rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                              {aiLoading ? <Loader2 className="animate-spin" size={16}/> : <Sparkles size={16}/>}
                              {aiLoading ? 'Analyzing...' : 'Get Advice (Myanmar)'}
                          </button>
                      ) : (
                          <button 
                            onClick={handleSaveAiLog}
                            className="w-full py-2 bg-purple-700 text-white rounded-lg font-bold flex items-center justify-center gap-2"
                          >
                              <Save size={16} /> Save Advice to Log
                          </button>
                      )}
                  </div>
              )}

              {isLoggingService && (
                 <form onSubmit={handleServiceSave} className="bg-slate-100 p-4 rounded-xl mb-6 animate-in slide-in-from-top-2">
                    <div className="flex justify-between mb-2">
                       <h4 className="font-bold text-slate-800">New Service Log</h4>
                       <button type="button" onClick={() => setIsLoggingService(false)}><X size={18}/></button>
                    </div>
                    {serviceType === 'Regular Service' && (
                        <div className="text-xs text-amber-600 mb-2 bg-amber-50 p-2 rounded border border-amber-100">
                           Regular Service resets the 500h service counter.
                        </div>
                    )}
                    {serviceType === 'Repair' && (
                        <div className="text-xs text-blue-600 mb-2 bg-blue-50 p-2 rounded border border-blue-100">
                           Repair records run hours but <strong>does not</strong> reset service counter.
                        </div>
                    )}
                    <select value={serviceType} onChange={e => setServiceType(e.target.value)} className="w-full p-3 border rounded-lg mb-2 bg-white font-bold text-slate-700">
                       <option>Regular Service</option>
                       <option>Repair</option>
                       <option>Inspection</option>
                    </select>
                    
                    {(serviceType === 'Regular Service' || serviceType === 'Repair') && (
                        <div className="mb-2">
                           <input 
                             type="number" 
                             step="0.1" 
                             value={serviceRunHours} 
                             onChange={e => setServiceRunHours(e.target.value)} 
                             className="w-full p-3 border rounded-lg" 
                             placeholder={serviceType === 'Regular Service' ? "Run Hours at Service (Resets Counter)" : "Run Hours at Repair (Record Only)"} 
                             required={serviceType === 'Regular Service'}
                           />
                        </div>
                    )}

                    <textarea rows={3} value={parts} onChange={e => setParts(e.target.value)} className="w-full p-3 border rounded-lg mb-3" placeholder="Parts used / Notes..." />
                    <button type="submit" className="w-full py-3 bg-slate-900 text-white rounded-lg font-bold">Save Record</button>
                 </form>
              )}

              <h3 className="font-bold text-slate-700 mb-2 pl-1">Service History (Last 50)</h3>
              <div className="space-y-2">
                 {genServiceLogs.slice(0, 50).map(s => (
                    <div key={s.id} className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                       <div className="flex justify-between">
                          <div>
                             <div className="flex items-center gap-2">
                                <span className={`font-bold block ${s.serviceType === 'AI Diagnosis' ? 'text-purple-600' : 'text-slate-800'}`}>{s.serviceType}</span>
                                {s.syncedToSheet && <span title="Synced to Cloud"><CloudCheck size={14} className="text-emerald-500" /></span>}
                             </div>
                             {s.runHours !== undefined && <span className="text-[10px] text-slate-500 font-mono bg-slate-50 px-1 rounded">@{s.runHours} hrs</span>}
                          </div>
                          <div className="text-right">
                             <span className="text-xs text-slate-400">{new Date(s.timestamp).toLocaleDateString()}</span>
                             {s.recordedBy && <div className="text-[10px] text-slate-300 flex items-center gap-1 justify-end"><User size={10}/> {s.recordedBy}</div>}
                          </div>
                       </div>
                       {s.partsReplaced && <p className="text-xs text-slate-500 mt-1 pt-1 border-t border-slate-50">Details: {s.partsReplaced}</p>}
                       {s.aiAdvice && (
                           <div className="mt-2 bg-purple-50 p-2 rounded border border-purple-100 text-xs text-slate-700">
                               <span className="font-bold text-purple-800 block mb-1">AI Advice:</span>
                               {s.aiAdvice}
                           </div>
                       )}
                    </div>
                 ))}
                 {genServiceLogs.length === 0 && <p className="text-slate-400 text-sm italic pl-1">No service logs.</p>}
              </div>
           </div>
        )}

        {/* SPECS TAB */}
        {activeTab === 'SPECS' && (
           <div className="animate-in fade-in space-y-3">
              <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2 pl-1"><FileText size={18}/> Spare Parts</h3>
              
              <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                 <div className="flex items-start gap-3">
                    <div className="p-2 bg-slate-50 rounded-lg text-slate-400"><Filter size={18}/></div>
                    <div>
                       <p className="text-xs font-bold text-slate-400 uppercase">Air Filter</p>
                       <p className="font-bold text-slate-800 text-lg">{selectedGen.airFilter || 'N/A'}</p>
                    </div>
                 </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                 <div className="flex items-start gap-3">
                    <div className="p-2 bg-slate-50 rounded-lg text-slate-400"><Droplets size={18}/></div>
                    <div>
                       <p className="text-xs font-bold text-slate-400 uppercase">Oil Filter</p>
                       <p className="font-bold text-slate-800 text-lg">{selectedGen.oilFilter || 'N/A'}</p>
                    </div>
                 </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                 <div className="flex items-start gap-3">
                    <div className="p-2 bg-slate-50 rounded-lg text-slate-400"><Droplets size={18}/></div>
                    <div>
                       <p className="text-xs font-bold text-slate-400 uppercase">Fuel Filter</p>
                       <p className="font-bold text-slate-800 text-lg">{selectedGen.fuelFilter || 'N/A'}</p>
                    </div>
                 </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                 <div className="flex items-start gap-3">
                    <div className="p-2 bg-slate-50 rounded-lg text-slate-400"><Settings size={18}/></div>
                    <div>
                       <p className="text-xs font-bold text-slate-400 uppercase">Fan Belt</p>
                       <p className="font-bold text-slate-800 text-lg">{selectedGen.fanBelt || 'N/A'}</p>
                    </div>
                 </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                 <div className="flex items-start gap-3">
                    <div className="p-2 bg-slate-50 rounded-lg text-slate-400"><Droplets size={18}/></div>
                    <div>
                       <p className="text-xs font-bold text-slate-400 uppercase">Water Separator</p>
                       <p className="font-bold text-slate-800 text-lg">{selectedGen.waterSeparator || 'N/A'}</p>
                    </div>
                 </div>
              </div>

           </div>
        )}
      </div>
    </div>
  );
};