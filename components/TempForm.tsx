import React, { useState, useRef, useEffect } from 'react';
import { Machine, RecordType, TemperatureRecord } from '../types';
import { detectAnomaly } from '../services/geminiService';
import { v4 as uuidv4 } from 'uuid';
import { AlertTriangle, Save, Loader2, Mic, MicOff } from 'lucide-react';

interface Props {
  machine: Machine;
  onSave: (record: TemperatureRecord) => void;
  onCancel: () => void;
}

export const TempForm: React.FC<Props> = ({ machine, onSave, onCancel }) => {
  const [currentTemp, setCurrentTemp] = useState<string>('');
  const [setpointTemp, setSetpointTemp] = useState<string>(machine.defaultSetpoint.toString());
  const [notes, setNotes] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiWarning, setAiWarning] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

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
      setNotes(prev => prev ? `${prev} ${transcript}` : transcript);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAnalyzing(true);
    setAiWarning(null);

    const tempVal = parseFloat(currentTemp);
    const setVal = parseFloat(setpointTemp);

    // AI Check
    const analysis = await detectAnomaly(tempVal, setVal, machine.type);
    
    if (analysis.isAnomaly) {
       setAiWarning(analysis.message);
       // Allow user to confirm save even if warning
    } else {
        doSave(tempVal, setVal, false);
    }
    setIsAnalyzing(false);
  };

  const doSave = (temp: number, setpoint: number, isAnomaly: boolean) => {
    const newRecord: TemperatureRecord = {
      id: uuidv4(),
      machineId: machine.id,
      timestamp: new Date().toISOString(),
      recordType: RecordType.TEMPERATURE,
      currentTemp: temp,
      setpointTemp: setpoint,
      notes,
      syncedToSheet: false,
      isAnomaly
    };
    onSave(newRecord);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-xl shadow-lg border border-slate-200">
      <div>
        <h3 className="text-xl font-bold text-slate-800 mb-1">Log Temperature</h3>
        <p className="text-sm text-slate-500">Recording for {machine.name}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Current Temp (°C)</label>
          <input
            type="number"
            step="0.1"
            required
            value={currentTemp}
            onChange={(e) => setCurrentTemp(e.target.value)}
            className="w-full p-4 text-2xl font-bold text-center border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            placeholder="0.0"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Setpoint (°C)</label>
          <input
            type="number"
            step="0.1"
            required
            value={setpointTemp}
            onChange={(e) => setSetpointTemp(e.target.value)}
            className="w-full p-4 text-2xl font-bold text-center border rounded-lg bg-slate-50 text-slate-500 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-1">
          <label className="block text-sm font-medium text-slate-700">Notes (Optional)</label>
          <button
            type="button"
            onClick={toggleListening}
            className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full transition-colors ${
              isListening ? 'bg-blue-100 text-blue-600 animate-pulse' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {isListening ? <MicOff size={12} /> : <Mic size={12} />}
            {isListening ? 'Listening...' : 'Dictate'}
          </button>
        </div>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${isListening ? 'ring-2 ring-blue-200 border-blue-300' : ''}`}
          placeholder="E.g., Door was open for loading..."
        />
      </div>

      {aiWarning && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg flex gap-3 items-start">
           <AlertTriangle className="text-red-600 shrink-0 mt-1" size={20} />
           <div>
             <h4 className="font-bold text-red-700">Anomaly Detected</h4>
             <p className="text-sm text-red-600 mb-3">{aiWarning}</p>
             <button
                type="button"
                onClick={() => doSave(parseFloat(currentTemp), parseFloat(setpointTemp), true)}
                className="text-sm bg-red-600 text-white px-3 py-1.5 rounded hover:bg-red-700"
             >
                Confirm & Save Anyway
             </button>
           </div>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 text-slate-600 font-medium hover:bg-slate-100 rounded-lg"
        >
          Cancel
        </button>
        {!aiWarning && (
          <button
            type="submit"
            disabled={isAnalyzing}
            className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 flex justify-center items-center gap-2 disabled:opacity-70"
          >
            {isAnalyzing ? <Loader2 className="animate-spin" /> : <Save size={20} />}
            Save Record
          </button>
        )}
      </div>
    </form>
  );
};