import React, { useState, useRef, useEffect } from 'react';
import { Machine, RecordType, MaintenanceRecord } from '../types';
import { analyzeMaintenanceIssue } from '../services/geminiService';
import { v4 as uuidv4 } from 'uuid';
import { Wrench, Save, Loader2, Sparkles, AlertOctagon, Camera, X, Image as ImageIcon, Mic, MicOff } from 'lucide-react';

interface Props {
  machine: Machine;
  startWithCamera?: boolean;
  onSave: (record: MaintenanceRecord) => void;
  onCancel: () => void;
}

export const MaintenanceForm: React.FC<Props> = ({ machine, startWithCamera, onSave, onCancel }) => {
  const [issue, setIssue] = useState('');
  const [severity, setSeverity] = useState<MaintenanceRecord['severity']>('LOW');
  const [action, setAction] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (startWithCamera && fileInputRef.current && !photoData) {
      const timer = setTimeout(() => {
        fileInputRef.current?.click();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [startWithCamera]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

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
      setIssue(prev => prev ? `${prev} ${transcript}` : transcript);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleGetAdvice = async (language: 'English' | 'Myanmar') => {
    if (!issue) return;
    setIsProcessing(true);
    // Pass photoData if available for vision analysis
    const advice = await analyzeMaintenanceIssue(machine.name, issue, photoData || undefined, language);
    setAiAdvice(advice);
    setIsProcessing(false);
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
          setPhotoData(compressedData);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newRecord: MaintenanceRecord = {
      id: uuidv4(),
      machineId: machine.id,
      timestamp: new Date().toISOString(),
      recordType: RecordType.MAINTENANCE,
      issueDescription: issue || 'Photo Log',
      severity,
      actionTaken: action,
      aiSuggestedFix: aiAdvice || undefined,
      photoData: photoData || undefined,
      syncedToSheet: false
    };
    onSave(newRecord);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-xl shadow-lg border border-red-100">
      <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
        <div className="p-2 bg-red-100 text-red-600 rounded-lg">
          <Wrench size={24} />
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-800">Report Issue</h3>
          <p className="text-sm text-slate-500">Maintenance log for {machine.name}</p>
        </div>
      </div>

      <div className={startWithCamera ? "order-first mb-6" : ""}>
        <label className="block text-sm font-medium text-slate-700 mb-2">Photo Evidence</label>
        
        <input 
          type="file" 
          accept="image/*" 
          ref={fileInputRef} 
          onChange={handlePhotoSelect} 
          className="hidden" 
        />

        {!photoData ? (
          <button 
            type="button" 
            onClick={() => fileInputRef.current?.click()}
            className={`w-full py-4 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:bg-slate-50 hover:border-slate-400 transition-colors flex flex-col items-center gap-2 ${startWithCamera ? 'bg-slate-50 border-blue-300 ring-2 ring-blue-200' : ''}`}
          >
            <Camera size={24} className={startWithCamera ? "text-blue-500" : ""} />
            <span className="text-sm font-medium">Take Photo or Upload</span>
          </button>
        ) : (
          <div className="relative inline-block w-full">
             <img src={photoData} alt="Issue Evidence" className="h-48 w-full rounded-lg border border-slate-200 object-cover" />
             <button
               type="button"
               onClick={() => setPhotoData(null)}
               className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-2 shadow-md hover:bg-red-600"
             >
               <X size={20} />
             </button>
          </div>
        )}
      </div>

      <div>
        <div className="flex justify-between items-center mb-1">
          <label className="block text-sm font-medium text-slate-700">Issue Description</label>
          <button
            type="button"
            onClick={toggleListening}
            className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full transition-colors ${
              isListening ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {isListening ? <MicOff size={12} /> : <Mic size={12} />}
            {isListening ? 'Listening...' : 'Dictate'}
          </button>
        </div>
        <textarea
          required
          rows={3}
          value={issue}
          onChange={(e) => setIssue(e.target.value)}
          className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-500 ${isListening ? 'ring-2 ring-red-200 border-red-300' : ''}`}
          placeholder="Describe the damage or error code..."
        />
        
        <div className="mt-2 flex gap-2">
            <button
                type="button"
                onClick={() => handleGetAdvice('English')}
                disabled={!issue || isProcessing}
                className="flex-1 py-2 text-sm text-purple-700 font-bold bg-purple-50 rounded-lg border border-purple-200 flex items-center justify-center gap-2 hover:bg-purple-100 disabled:opacity-50 transition-colors"
            >
                {isProcessing ? <Loader2 className="animate-spin" size={14}/> : <Sparkles size={14} />}
                Ask AI (English)
            </button>
            <button
                type="button"
                onClick={() => handleGetAdvice('Myanmar')}
                disabled={!issue || isProcessing}
                className="flex-1 py-2 text-sm text-purple-700 font-bold bg-purple-50 rounded-lg border border-purple-200 flex items-center justify-center gap-2 hover:bg-purple-100 disabled:opacity-50 transition-colors"
            >
                {isProcessing ? <Loader2 className="animate-spin" size={14}/> : <Sparkles size={14} />}
                Ask AI (Myanmar)
            </button>
        </div>
      </div>

      {aiAdvice && (
        <div className="bg-purple-50 p-4 rounded-lg border border-purple-100 text-sm text-slate-700">
          <h4 className="font-bold text-purple-800 mb-1 flex items-center gap-2">
            <Sparkles size={14} /> AI Suggestion
          </h4>
          <div className="whitespace-pre-wrap">{aiAdvice}</div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Severity</label>
        <div className="flex gap-2">
          {['LOW', 'MEDIUM', 'CRITICAL'].map((level) => (
            <button
              type="button"
              key={level}
              onClick={() => setSeverity(level as any)}
              className={`flex-1 py-2 text-sm font-bold rounded-lg border 
                ${severity === level 
                  ? (level === 'CRITICAL' ? 'bg-red-600 text-white border-red-600' : level === 'MEDIUM' ? 'bg-orange-500 text-white border-orange-500' : 'bg-yellow-500 text-white border-yellow-500')
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Action Taken (Optional)</label>
        <input
          type="text"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-500"
          placeholder="E.g., Reset breaker, Called vendor..."
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 text-slate-600 font-medium hover:bg-slate-100 rounded-lg"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 bg-slate-900 text-white py-3 rounded-lg font-bold hover:bg-slate-800 flex justify-center items-center gap-2"
        >
          <Save size={20} />
          Save Log
        </button>
      </div>
    </form>
  );
};