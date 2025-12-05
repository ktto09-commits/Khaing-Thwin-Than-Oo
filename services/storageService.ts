
import { LogRecord, INITIAL_MACHINES, INITIAL_METERS, INITIAL_GENERATORS, Machine, MachineType, RecordType, TemperatureRecord, MaintenanceRecord, Meter, Generator, MeterRecord, GeneratorRunRecord, GeneratorServiceRecord, BaseRecord } from "../types";

const STORAGE_KEY = 'coldchain_logs_v1';
const SHEET_URL_KEY = 'coldchain_sheet_url';
const API_KEY_STORAGE_KEY = 'coldchain_api_key'; 
const MACHINES_KEY = 'coldchain_machines';
const METERS_KEY = 'coldchain_meters';
const GENERATORS_KEY = 'coldchain_generators';

const DEFAULT_SHEET_URL = "https://script.google.com/macros/s/AKfycbxs1u6n0qAWY0RRQjgND1j8g6M2KHaU9u18MK3WIBo5xFkYyDwpHTwOmpLyHm87l3Uz/exec"; 

export const initializeData = () => {
  try {
    if (!localStorage.getItem(MACHINES_KEY) || localStorage.getItem(MACHINES_KEY) === '[]') {
      localStorage.setItem(MACHINES_KEY, JSON.stringify(INITIAL_MACHINES));
    }
    if (!localStorage.getItem(METERS_KEY) || localStorage.getItem(METERS_KEY) === '[]') {
      localStorage.setItem(METERS_KEY, JSON.stringify(INITIAL_METERS));
    }
    if (!localStorage.getItem(GENERATORS_KEY) || localStorage.getItem(GENERATORS_KEY) === '[]') {
      localStorage.setItem(GENERATORS_KEY, JSON.stringify(INITIAL_GENERATORS));
    }
  } catch (e) {
    console.error("Failed to initialize default data", e);
  }
};

export const getLogs = (): LogRecord[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error("Storage read error", e);
    return [];
  }
};

export const saveLog = (log: LogRecord): LogRecord[] => {
  const current = getLogs();
  const updated = [log, ...current];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Storage write error", e);
  }
  return updated;
};

export const deleteLog = (id: string): LogRecord[] => {
  const current = getLogs();
  const updated = current.filter(log => log.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Storage delete error", e);
  }
  return updated;
};

export const markLogsAsSynced = (logIds: string[]): LogRecord[] => {
  const current = getLogs();
  const updated = current.map(log => 
    logIds.includes(log.id) ? { ...log, syncedToSheet: true } : log
  );
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Storage update error", e);
  }
  return updated;
};

export const resetAllSyncStatus = (): LogRecord[] => {
  const current = getLogs();
  const updated = current.map(log => ({ ...log, syncedToSheet: false }));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Storage update error", e);
  }
  return updated;
};

export const clearLogs = () => {
  localStorage.removeItem(STORAGE_KEY);
};

// --- CONFIGURATION GETTERS ---

export const getStoredMachines = (): Machine[] => {
  try {
    const stored = localStorage.getItem(MACHINES_KEY);
    if (!stored) return INITIAL_MACHINES;
    const parsed = JSON.parse(stored);
    return (Array.isArray(parsed) && parsed.length > 0) ? parsed : INITIAL_MACHINES;
  } catch (e) { return INITIAL_MACHINES; }
};

export const getStoredMeters = (): Meter[] => {
  try {
    const stored = localStorage.getItem(METERS_KEY);
    if (!stored) return INITIAL_METERS;
    const parsed = JSON.parse(stored);
    return (Array.isArray(parsed) && parsed.length > 0) ? parsed : INITIAL_METERS;
  } catch (e) { return INITIAL_METERS; }
};

export const getStoredGenerators = (): Generator[] => {
  try {
    const stored = localStorage.getItem(GENERATORS_KEY);
    if (!stored) return INITIAL_GENERATORS;
    const parsed = JSON.parse(stored);
    return (Array.isArray(parsed) && parsed.length > 0) ? parsed : INITIAL_GENERATORS;
  } catch (e) { return INITIAL_GENERATORS; }
};

export const getMachineName = (id: string) => {
  const machines = getStoredMachines();
  const machine = machines.find(m => m.id === id);
  return machine ? machine.name : id;
};

export const getMeterName = (id: string) => {
  const meters = getStoredMeters();
  const meter = meters.find(m => m.id === id);
  return meter ? meter.name : id;
};

export const getGeneratorName = (id: string) => {
  const gens = getStoredGenerators();
  const gen = gens.find(g => g.id === id);
  return gen ? gen.name : id;
};

export const getMachineIdByName = (name: string): string => {
  const machines = getStoredMachines();
  const machine = machines.find(m => m.name === name);
  return machine ? machine.id : '';
};

export const getMeterIdByName = (name: string): string => {
  const meters = getStoredMeters();
  const meter = meters.find(m => m.name === name);
  return meter ? meter.id : '';
};

export const getGeneratorIdByName = (name: string): string => {
  const gens = getStoredGenerators();
  const gen = gens.find(g => g.name === name);
  return gen ? gen.id : '';
};

export const saveSheetUrl = (url: string) => {
  localStorage.setItem(SHEET_URL_KEY, url.trim());
};

export const getSheetUrl = () => {
  return localStorage.getItem(SHEET_URL_KEY) || DEFAULT_SHEET_URL;
};

// --- API KEY STORAGE ---
export const saveApiKey = (key: string) => {
  localStorage.setItem(API_KEY_STORAGE_KEY, key.trim());
};

export const getStoredApiKey = () => {
  return localStorage.getItem(API_KEY_STORAGE_KEY) || '';
};

export const uploadApiKeyToCloud = async (key: string) => {
    try {
        await invokeSheetAction('SET_CONFIG', { key: 'GEMINI_API_KEY', value: key });
        return true;
    } catch(e) {
        console.error("Failed to upload API Key", e);
        return false;
    }
};

// --- API CALLING ---

export const invokeSheetAction = async (action: string, payload: any = {}) => {
  const url = getSheetUrl();
  if (!url) throw new Error("No Sheet URL configured");

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...payload })
    });

    if (!response.ok) throw new Error(`Network error: ${response.statusText}`);
    return await response.json();
  } catch (error: any) {
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      throw new Error("Connection failed");
    }
    throw error;
  }
};

// --- SYNC FUNCTIONS (CONFIG) ---

export const syncConfigsFromCloud = async () => {
  try {
    // 0. API KEY SYNC (Cloud -> Local)
    try {
        const configRes = await invokeSheetAction('GET_CONFIG');
        if (configRes && configRes.config && configRes.config['GEMINI_API_KEY']) {
            const cloudKey = configRes.config['GEMINI_API_KEY'];
            if (cloudKey && cloudKey.length > 10) {
                saveApiKey(cloudKey);
                console.log("API Key synced from cloud.");
            }
        }
    } catch (e) { console.log("Config sync failed (script might be old)", e); }

    // 1. Machines
    try {
      const mRes = await invokeSheetAction('GET_MACHINES');
      if (mRes.machines && mRes.machines.length > 0) {
        const machines: Machine[] = mRes.machines.map((m: any) => ({
            id: String(m.id || m.ID || ''), 
            name: String(m.name || m.Name || ''), 
            type: (m.type || m.Type || 'FREEZER') as MachineType, 
            defaultSetpoint: Number(m.defaultSetpoint !== undefined ? m.defaultSetpoint : (m.Setpoint || 0))
        }));
        localStorage.setItem(MACHINES_KEY, JSON.stringify(machines));
      }
    } catch (e) { /* Ignore */ }

    // 2. Meters
    try {
      const meterRes = await invokeSheetAction('GET_METERS');
      if (meterRes.meters && meterRes.meters.length > 0) {
        const meters: Meter[] = meterRes.meters.map((m: any) => ({
            id: String(m.id || m.ID || ''), 
            name: String(m.name || m.Name || '')
        }));
        localStorage.setItem(METERS_KEY, JSON.stringify(meters));
      }
    } catch (e) { /* Ignore */ }

    // 3. Generators
    try {
      const genRes = await invokeSheetAction('GET_GENERATORS');
      if (genRes.generators && genRes.generators.length > 0) {
        const gens: Generator[] = genRes.generators.map((g: any) => {
            const find = (keys: string[]) => {
                for (const k of keys) {
                    if (g[k] !== undefined && g[k] !== "") return g[k];
                    const foundKey = Object.keys(g).find(objKey => 
                        objKey.toLowerCase().replace(/\s/g, '') === k.toLowerCase().replace(/\s/g, '')
                    );
                    if (foundKey && g[foundKey] !== undefined) return g[foundKey];
                }
                return '';
            };

            const id = String(find(['id', 'name', 'Name']) || '');
            const name = String(find(['name', 'Name']) || id);

            return {
                id: id,
                name: name,
                model: String(find(['model', 'Model', 'Make']) || ''),
                airFilter: String(find(['airFilter', 'Air Filter', 'AirFilter']) || ''),
                oilFilter: String(find(['oilFilter', 'Oil Filter', 'OilFilter']) || ''),
                fuelFilter: String(find(['fuelFilter', 'Fuel Filter', 'FuelFilter']) || ''),
                fanBelt: String(find(['fanBelt', 'Fan Belt', 'FanBelt']) || ''),
                waterSeparator: String(find(['waterSeparator', 'Water Separator', 'Fuel Water Separator', 'WaterSeparator']) || '')
            };
        });
        localStorage.setItem(GENERATORS_KEY, JSON.stringify(gens));
      }
    } catch (e) { /* Ignore */ }
    
    return true;
  } catch (e) {
    return false;
  }
};

// --- SYNC FUNCTIONS (LOGS) ---

export const syncLogsFromCloud = async (): Promise<LogRecord[]> => {
  const localLogs = getLogs();
  const newLogs: LogRecord[] = [];

  try {
    // 1. Machine Logs
    try {
      const res1 = await invokeSheetAction('GET_LOGS');
      if (res1.logs) {
        for (const row of res1.logs) {
          let mId = row.machineId || getMachineIdByName(row.machineName);
          if (!mId) continue;
          const logId = row.id || `restored-mach-${Math.random()}`;
          if (localLogs.some(l => l.id === logId)) continue;
          
          const ts = row.isoTimestamp || new Date(row.dateStr).toISOString();

          if (row.type === 'Temperature') {
              newLogs.push({
                  id: logId, machineId: mId, timestamp: ts, recordType: RecordType.TEMPERATURE, syncedToSheet: true,
                  recordedBy: row.recordedBy, currentTemp: parseFloat(row.value), setpointTemp: parseFloat(row.target),
                  notes: row.notes, isAnomaly: row.ai && row.ai.includes('Anomaly')
              } as TemperatureRecord);
          } else {
              newLogs.push({
                  id: logId, machineId: mId, timestamp: ts, recordType: RecordType.MAINTENANCE, syncedToSheet: true,
                  recordedBy: row.recordedBy, issueDescription: row.value, severity: row.target, actionTaken: row.notes,
                  aiSuggestedFix: row.ai
              } as MaintenanceRecord);
          }
        }
      }
    } catch (e) { /* Ignore */ }

    // 2. Meter Logs
    try {
      const res2 = await invokeSheetAction('GET_METER_LOGS');
      if (res2.logs) {
        for (const row of res2.logs) {
            let mId = row.meterId || getMeterIdByName(row.meterName);
            if (!mId) continue;
            const logId = row.id || `restored-meter-${Math.random()}`;
            if (localLogs.some(l => l.id === logId)) continue;
            
            newLogs.push({
              id: logId, meterId: mId, timestamp: row.isoTimestamp || new Date(row.dateStr).toISOString(),
              recordType: RecordType.METER_READING, syncedToSheet: true, recordedBy: row.recordedBy,
              value: parseFloat(row.value)
            } as MeterRecord);
        }
      }
    } catch (e) { /* Ignore */ }

    // 3. Generator Logs
    try {
      const res3 = await invokeSheetAction('GET_GEN_LOGS');
      if (res3.logs) {
        for (const row of res3.logs) {
            const logId = row.id || `restored-gen-${Math.random()}`;
            if (localLogs.some(l => l.id === logId)) continue;
            
            let gId = row.genId || getGeneratorIdByName(row.genName);
            
            // Robust fallback if precise ID missing
            if (!gId && row.genName) {
                // Try case-insensitive name match against stored generators
                const gens = getStoredGenerators();
                const match = gens.find(g => g.name.toLowerCase() === row.genName.toLowerCase());
                if (match) {
                    gId = match.id;
                } else {
                    gId = row.genName; // Last resort: use name as ID
                }
            }
            
            if (!gId) continue;

            const ts = row.isoTimestamp || new Date(row.dateStr).toISOString();
            
            // Handle Parsing Safely
            let parsedRunHours = undefined;
            if (row.runHours !== undefined && row.runHours !== '' && row.runHours !== null) {
               const val = parseFloat(row.runHours);
               if (!isNaN(val)) parsedRunHours = val;
            }

            if (row.type === 'RUN_HOURS') {
              newLogs.push({
                  id: logId, generatorId: gId, timestamp: ts, recordType: RecordType.GENERATOR_RUN, syncedToSheet: true,
                  recordedBy: row.recordedBy, runHours: parsedRunHours || 0, notes: row.notes
              } as GeneratorRunRecord);
            } else {
              newLogs.push({
                  id: logId, generatorId: gId, timestamp: ts, recordType: RecordType.GENERATOR_SERVICE, syncedToSheet: true,
                  recordedBy: row.recordedBy, serviceType: row.notes, partsReplaced: row.parts,
                  // Map runHours back if it exists in the row data
                  runHours: parsedRunHours,
                  aiAdvice: row.ai || undefined
              } as GeneratorServiceRecord);
            }
        }
      }
    } catch (e) { /* Ignore */ }

    if (newLogs.length > 0) {
      const merged = [...newLogs, ...localLogs].sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      return merged;
    }
  } catch (e) {
    console.warn("Log Sync Error:", e);
  }
  return getLogs();
};

export const syncLogsToGoogleSheet = async (logs: LogRecord[]): Promise<string[]> => {
  const successfulIds: string[] = [];
  
  const machineLogs = logs.filter(l => l.recordType === RecordType.TEMPERATURE || l.recordType === RecordType.MAINTENANCE);
  const meterLogs = logs.filter(l => l.recordType === RecordType.METER_READING);
  const genLogs = logs.filter(l => l.recordType === RecordType.GENERATOR_RUN || l.recordType === RecordType.GENERATOR_SERVICE);

  if (machineLogs.length > 0) {
    try {
      const payload = machineLogs.map(log => {
          const l = log as TemperatureRecord | MaintenanceRecord;
          const base = {
            machine: getMachineName(l.machineId!) || l.machineId, 
            date: new Date(l.timestamp).toLocaleString(),
            recordedBy: l.recordedBy || 'Unknown', 
            id: l.id, 
            machineId: l.machineId, 
            timestamp: l.timestamp
          };
          if (l.recordType === RecordType.TEMPERATURE) {
            return { ...base, type: 'Temperature', value: l.currentTemp, target: l.setpointTemp, notes: l.notes||'', ai: l.isAnomaly?'Anomaly':'Normal', photo: ''};
          } else {
            const mr = l as MaintenanceRecord;
            const cleanPhoto = mr.photoData ? (mr.photoData.includes(',') ? mr.photoData.split(',')[1] : mr.photoData) : '';
            return { ...base, type: 'Maintenance', value: mr.issueDescription, target: mr.severity, notes: mr.actionTaken||'', ai: mr.aiSuggestedFix||'', photo: cleanPhoto };
          }
      });
      await invokeSheetAction('SYNC_LOGS', { data: payload });
      successfulIds.push(...machineLogs.map(l => l.id));
    } catch (e) {
      console.error("Machine sync failed", e);
    }
  }

  if (meterLogs.length > 0) {
    try {
      const payload = meterLogs.map(log => {
          const l = log as MeterRecord;
          const cleanPhoto = l.photoData ? (l.photoData.includes(',') ? l.photoData.split(',')[1] : l.photoData) : '';
          return {
            date: new Date(l.timestamp).toLocaleString(), 
            meterName: getMeterName(l.meterId!) || l.meterId, 
            value: l.value,
            recordedBy: l.recordedBy || 'Unknown', 
            photo: cleanPhoto, 
            id: l.id, 
            meterId: l.meterId, 
            timestamp: l.timestamp
          };
      });
      await invokeSheetAction('SYNC_METER_LOGS', { data: payload });
      successfulIds.push(...meterLogs.map(l => l.id));
    } catch (e) {
      console.error("Meter sync failed", e);
    }
  }

  if (genLogs.length > 0) {
    try {
      const payload = genLogs.map(log => {
          const l = log as GeneratorRunRecord | GeneratorServiceRecord;
          const genName = getGeneratorName(l.generatorId) || l.generatorId || 'Unknown Generator';
          
          const base = {
            date: new Date(log.timestamp).toLocaleString(), 
            recordedBy: log.recordedBy || 'Unknown',
            id: log.id, 
            timestamp: log.timestamp, 
            genId: l.generatorId || '', 
            genName: genName
          };
          
          if (log.recordType === RecordType.GENERATOR_RUN) {
            const l = log as GeneratorRunRecord;
            const val = Number(l.runHours);
            const safeRunHours = !isNaN(val) ? val : 0;
            
            return { 
                ...base, 
                type: 'RUN_HOURS', 
                runHours: safeRunHours, 
                notes: l.notes||'', 
                parts: '', 
                photo: '',
                ai: ''
            };
          } else {
            const l = log as GeneratorServiceRecord;
            const cleanPhoto = l.photoData ? (l.photoData.includes(',') ? l.photoData.split(',')[1] : l.photoData) : '';
            
            let safeServiceHours: number | string = '';
            if (l.runHours !== undefined && l.runHours !== null) {
                const val = Number(l.runHours);
                if (!isNaN(val)) safeServiceHours = val;
            }

            return { 
                ...base, 
                type: 'SERVICE', 
                runHours: safeServiceHours, 
                notes: l.serviceType || '', 
                parts: l.partsReplaced || '', 
                photo: cleanPhoto,
                ai: l.aiAdvice || ''
            };
          }
      });
      await invokeSheetAction('SYNC_GEN_LOGS', { data: payload });
      successfulIds.push(...genLogs.map(l => l.id));
    } catch (e) {
      console.error("Generator sync failed", e);
    }
  }
  
  return successfulIds;
};

export const exportToCSV = (logs: LogRecord[]) => {
  const headers = ["ID", "Type", "Name/Machine", "Date", "Value/Issue", "Details"];
  const rows = logs.map(l => {
     let name = '';
     let val = '';
     let det = '';
     if (l.recordType === RecordType.METER_READING) {
        name = getMeterName((l as MeterRecord).meterId);
        val = (l as MeterRecord).value.toString();
     } else if (l.recordType === RecordType.GENERATOR_RUN) {
        name = getGeneratorName((l as GeneratorRunRecord).generatorId);
        val = (l as GeneratorRunRecord).runHours + " hrs";
        det = (l as GeneratorRunRecord).notes || '';
     } else if (l.recordType === RecordType.GENERATOR_SERVICE) {
        name = getGeneratorName((l as GeneratorServiceRecord).generatorId);
        val = "Service";
        det = (l as GeneratorServiceRecord).serviceType;
     } else {
        name = getMachineName((l as BaseRecord).machineId!);
        val = l.recordType;
     }
     return [l.id, l.recordType, name, new Date(l.timestamp).toLocaleString(), val, det];
  });
  
  const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `export_${Date.now()}.csv`;
  link.click();
};

export const copyToClipboard = async (logs: LogRecord[]): Promise<boolean> => {
  try {
    const text = logs.map(l => {
       const date = new Date(l.timestamp).toLocaleString();
       if (l.recordType === RecordType.TEMPERATURE) {
          const t = l as TemperatureRecord;
          return `${date} - ${t.currentTemp}°C (Set: ${t.setpointTemp}) - ${t.notes || ''}`;
       } else if (l.recordType === RecordType.MAINTENANCE) {
          const m = l as MaintenanceRecord;
          return `${date} - ISSUE: ${m.issueDescription} [${m.severity}] - ${m.actionTaken || ''}`;
       }
       return `${date} - ${l.recordType}`;
    }).join('\n');
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    console.error("Clipboard error:", e);
    return false;
  }
};
