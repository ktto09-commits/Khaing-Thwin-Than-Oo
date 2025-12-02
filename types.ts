export enum MachineType {
  FREEZER = 'FREEZER',
  CHILLER = 'CHILLER'
}

export enum RecordType {
  TEMPERATURE = 'TEMPERATURE',
  MAINTENANCE = 'MAINTENANCE'
}

export interface Machine {
  id: string;
  name: string;
  type: MachineType;
  defaultSetpoint: number;
}

export interface BaseRecord {
  id: string;
  machineId: string;
  timestamp: string; // ISO String
  recordType: RecordType;
  syncedToSheet: boolean;
  recordedBy?: string; // Name of the user who created the record
}

export interface TemperatureRecord extends BaseRecord {
  recordType: RecordType.TEMPERATURE;
  currentTemp: number;
  setpointTemp: number;
  notes?: string;
  isAnomaly?: boolean; // AI Detected
}

export interface MaintenanceRecord extends BaseRecord {
  recordType: RecordType.MAINTENANCE;
  issueDescription: string;
  severity: 'LOW' | 'MEDIUM' | 'CRITICAL';
  actionTaken?: string;
  aiSuggestedFix?: string;
  photoData?: string; // Base64 string of the attached image
}

export type LogRecord = TemperatureRecord | MaintenanceRecord;

export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER'
}

export interface User {
  username: string;
  password?: string; // Optional when just listing for display
  name: string;
  role: UserRole;
}

export const INITIAL_MACHINES: Machine[] = [
  // Chest Freezers (4 pcs)
  { id: 'cf-01', name: 'Chest Freezer 01', type: MachineType.FREEZER, defaultSetpoint: -18 },
  { id: 'cf-02', name: 'Chest Freezer 02', type: MachineType.FREEZER, defaultSetpoint: -18 },
  { id: 'cf-03', name: 'Chest Freezer 03', type: MachineType.FREEZER, defaultSetpoint: -18 },
  { id: 'cf-04', name: 'Chest Freezer 04', type: MachineType.FREEZER, defaultSetpoint: -18 },

  // HQ 1 door chiller (2 pcs)
  { id: 'hq1-01', name: 'HQ 1-Door Chiller 01', type: MachineType.CHILLER, defaultSetpoint: 4 },
  { id: 'hq1-02', name: 'HQ 1-Door Chiller 02', type: MachineType.CHILLER, defaultSetpoint: 4 },

  // HQ 2 door chiller (2 pcs)
  { id: 'hq2-01', name: 'HQ 2-Door Chiller 01', type: MachineType.CHILLER, defaultSetpoint: 4 },
  { id: 'hq2-02', name: 'HQ 2-Door Chiller 02', type: MachineType.CHILLER, defaultSetpoint: 4 },

  // 4 door freezer (5 pcs)
  { id: '4df-01', name: '4-Door Freezer 01', type: MachineType.FREEZER, defaultSetpoint: -18 },
  { id: '4df-02', name: '4-Door Freezer 02', type: MachineType.FREEZER, defaultSetpoint: -18 },
  { id: '4df-03', name: '4-Door Freezer 03', type: MachineType.FREEZER, defaultSetpoint: -18 },
  { id: '4df-04', name: '4-Door Freezer 04', type: MachineType.FREEZER, defaultSetpoint: -18 },
  { id: '4df-05', name: '4-Door Freezer 05', type: MachineType.FREEZER, defaultSetpoint: -18 },

  // 6 door freezer (1 pc)
  { id: '6df-01', name: '6-Door Freezer 01', type: MachineType.FREEZER, defaultSetpoint: -18 },

  // Deep freezer (5 pcs) - Assuming colder setpoint
  { id: 'df-01', name: 'Deep Freezer 01', type: MachineType.FREEZER, defaultSetpoint: -25 },
  { id: 'df-02', name: 'Deep Freezer 02', type: MachineType.FREEZER, defaultSetpoint: -25 },
  { id: 'df-03', name: 'Deep Freezer 03', type: MachineType.FREEZER, defaultSetpoint: -25 },
  { id: 'df-04', name: 'Deep Freezer 04', type: MachineType.FREEZER, defaultSetpoint: -25 },
  { id: 'df-05', name: 'Deep Freezer 05', type: MachineType.FREEZER, defaultSetpoint: -25 },

  // Cold store (1 pc)
  { id: 'cs-01', name: 'Cold Store 01', type: MachineType.FREEZER, defaultSetpoint: -20 },

  // Container cold store (3 pcs)
  { id: 'ccs-01', name: 'Container Cold Store 01', type: MachineType.FREEZER, defaultSetpoint: -18 },
  { id: 'ccs-02', name: 'Container Cold Store 02', type: MachineType.FREEZER, defaultSetpoint: -18 },
  { id: 'ccs-03', name: 'Container Cold Store 03', type: MachineType.FREEZER, defaultSetpoint: -18 },
];