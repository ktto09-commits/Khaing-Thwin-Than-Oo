import { LogRecord, INITIAL_MACHINES, Machine, MachineType } from "../types";

const STORAGE_KEY = 'coldchain_logs_v1';
const SHEET_URL_KEY = 'coldchain_sheet_url';
const MACHINES_KEY = 'coldchain_machines';
// Updated with the provided Google Apps Script Web App URL
const DEFAULT_SHEET_URL = "https://script.google.com/macros/s/AKfycbxs1u6n0qAWY0RRQjgND1j8g6M2KHaU9u18MK3WIBo5xFkYyDwpHTwOmpLyHm87l3Uz/exec"; 

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

export const clearLogs = () => {
  localStorage.removeItem(STORAGE_KEY);
};

export const getStoredMachines = (): Machine[] => {
  try {
    const stored = localStorage.getItem(MACHINES_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error("Machine storage read error", e);
  }
  return INITIAL_MACHINES;
};

export const getMachineName = (id: string) => {
  const machines = getStoredMachines();
  const machine = machines.find(m => m.id === id);
  return machine ? machine.name : id;
};

export const saveSheetUrl = (url: string) => {
  localStorage.setItem(SHEET_URL_KEY, url.trim());
};

export const getSheetUrl = () => {
  return localStorage.getItem(SHEET_URL_KEY) || DEFAULT_SHEET_URL;
};

// Generic API caller for Google Sheet
export const invokeSheetAction = async (action: string, payload: any = {}) => {
  const url = getSheetUrl();
  if (!url) {
     throw new Error("No Sheet URL configured");
  }

  // We use standard fetch with text/plain to avoid CORS Preflight (OPTIONS) requests
  // Google Apps Script Web Apps don't handle OPTIONS requests well.
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({ action, ...payload })
  });

  if (!response.ok) {
     throw new Error(`Network response was not ok: ${response.statusText}`);
  }

  return await response.json();
};

export const syncMachinesFromCloud = async (): Promise<Machine[]> => {
  try {
    const response = await invokeSheetAction('GET_MACHINES');
    if (response && response.machines && Array.isArray(response.machines) && response.machines.length > 0) {
      const machines: Machine[] = response.machines.map((m: any) => ({
        id: String(m.id),
        name: String(m.name),
        type: m.type === 'CHILLER' ? MachineType.CHILLER : MachineType.FREEZER,
        defaultSetpoint: Number(m.defaultSetpoint) || 0
      }));
      
      localStorage.setItem(MACHINES_KEY, JSON.stringify(machines));
      console.log("Machines synced from cloud:", machines.length);
      return machines;
    }
  } catch (e: any) {
    if (e.message !== "No Sheet URL configured") {
        console.error("Failed to sync machines from cloud:", e);
    }
  }
  return getStoredMachines();
};

export const syncLogsToGoogleSheet = async (logs: LogRecord[]) => {
  const payload = logs.map(log => {
    const machineName = getMachineName(log.machineId);
    const date = new Date(log.timestamp).toLocaleString();
    const recordedBy = log.recordedBy || 'Unknown User';
    
    if (log.recordType === 'TEMPERATURE') {
      return {
        machine: machineName,
        date: date,
        recordedBy: recordedBy,
        type: 'Temperature',
        value: log.currentTemp,
        target: log.setpointTemp,
        notes: log.notes || '',
        ai: log.isAnomaly ? 'Anomaly Detected' : 'Normal',
        photo: ''
      };
    } else {
      // Clean base64 string for script processing (remove data:image/jpeg;base64, prefix)
      let cleanPhoto = '';
      if (log.photoData) {
        cleanPhoto = log.photoData.includes(',') ? log.photoData.split(',')[1] : log.photoData;
      }

      return {
        machine: machineName,
        date: date,
        recordedBy: recordedBy,
        type: 'Maintenance',
        value: log.issueDescription,
        target: log.severity,
        notes: log.actionTaken || '',
        ai: log.aiSuggestedFix || '',
        photo: cleanPhoto
      };
    }
  });

  // Call the new Generic API with 'SYNC_LOGS' action
  await invokeSheetAction('SYNC_LOGS', { data: payload });
  return true;
};

export const copyToClipboard = async (logs: LogRecord[]) => {
  try {
    const text = logs.map(log => {
        const machine = getMachineName(log.machineId);
        const time = new Date(log.timestamp).toLocaleString();
        const user = log.recordedBy || 'Unknown';
        if (log.recordType === 'TEMPERATURE') {
            return `${time} [${user}] - ${machine}: ${log.currentTemp}°C ${log.isAnomaly ? '(Anomaly)' : ''} ${log.notes ? `(${log.notes})` : ''}`;
        } else {
            return `${time} [${user}] - ${machine}: ISSUE - ${log.issueDescription} [${log.severity}]`;
        }
    }).join('\n');
    
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    return false;
  }
};

export const exportToCSV = (logs: LogRecord[]) => {
    const headers = ["ID", "Machine Name", "Date/Time", "Recorded By", "Type", "Value/Issue", "Target/Severity", "Notes/Action", "AI Status", "Photo Base64"];
    
    const rows = logs.map(log => {
        const machine = getMachineName(log.machineId);
        const date = new Date(log.timestamp).toLocaleString();
        const user = log.recordedBy || 'Unknown';
        
        if (log.recordType === 'TEMPERATURE') {
            return [
                log.id,
                machine,
                date,
                user,
                'Temperature',
                log.currentTemp,
                log.setpointTemp,
                log.notes || '',
                log.isAnomaly ? 'Anomaly' : 'Normal',
                ''
            ];
        } else {
            return [
                log.id,
                machine,
                date,
                user,
                'Maintenance',
                log.issueDescription,
                log.severity,
                log.actionTaken || '',
                'Advice Given',
                log.photoData ? 'Yes' : 'No'
            ];
        }
    });

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `coldchain_export_${new Date().toISOString().slice(0,10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};