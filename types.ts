
export enum MachineType {
  FREEZER = 'FREEZER',
  CHILLER = 'CHILLER'
}

export enum RecordType {
  TEMPERATURE = 'TEMPERATURE',
  MAINTENANCE = 'MAINTENANCE',
  METER_READING = 'METER_READING',
  GENERATOR_RUN = 'GENERATOR_RUN',
  GENERATOR_SERVICE = 'GENERATOR_SERVICE'
}

export interface Machine {
  id: string;
  name: string;
  type: MachineType;
  defaultSetpoint: number;
}

export interface Meter {
  id: string;
  name: string;
}

export interface Generator {
  id: string;
  name: string; // Shop Name (e.g., KMD)
  model: string; // Generator Name (e.g., Pai Kane)
  airFilter: string;
  oilFilter: string;
  fuelFilter: string;
  fanBelt: string;
  waterSeparator: string;
}

export interface BaseRecord {
  id: string;
  machineId?: string; 
  meterId?: string;   
  generatorId?: string; // Link to specific generator
  timestamp: string; // ISO String
  recordType: RecordType;
  syncedToSheet: boolean;
  recordedBy?: string; 
}

export interface TemperatureRecord extends BaseRecord {
  recordType: RecordType.TEMPERATURE;
  currentTemp: number;
  setpointTemp: number;
  notes?: string;
  isAnomaly?: boolean; 
}

export interface MaintenanceRecord extends BaseRecord {
  recordType: RecordType.MAINTENANCE;
  issueDescription: string;
  severity: 'LOW' | 'MEDIUM' | 'CRITICAL';
  actionTaken?: string;
  aiSuggestedFix?: string;
  photoData?: string; 
}

export interface MeterRecord extends BaseRecord {
  recordType: RecordType.METER_READING;
  meterId: string;
  value: number;
  photoData?: string;
}

export interface GeneratorRunRecord extends BaseRecord {
  recordType: RecordType.GENERATOR_RUN;
  generatorId: string;
  runHours: number;
  notes?: string;
}

export interface GeneratorServiceRecord extends BaseRecord {
  recordType: RecordType.GENERATOR_SERVICE;
  generatorId: string;
  serviceType: string; 
  notes?: string;
  partsReplaced?: string;
  nextServiceDue?: string; 
  photoData?: string;
  runHours?: number; // Meter reading at time of service
  aiAdvice?: string; // AI Diagnosis
}

export type LogRecord = TemperatureRecord | MaintenanceRecord | MeterRecord | GeneratorRunRecord | GeneratorServiceRecord;

export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER'
}

export interface User {
  username: string;
  password?: string; 
  name: string;
  role: UserRole;
}

export const INITIAL_MACHINES: Machine[] = [
  { id: 'cf-01', name: 'Chest Freezer 01', type: MachineType.FREEZER, defaultSetpoint: -18 }
];

export const INITIAL_METERS: Meter[] = [
  { id: 'm-01', name: 'Main Meter' },
  { id: 'm-02', name: 'Load 1' },
  { id: 'm-03', name: 'Load 2' },
  { id: 'm-04', name: 'Female Hostel' },
  { id: 'm-05', name: 'Male Hostel' },
  { id: 'm-06', name: 'Warehouse' },
  { id: 'm-07', name: 'Office' },
  { id: 'm-08', name: 'K1' },
  { id: 'm-09', name: 'K2' },
  { id: 'm-10', name: 'Solar Power' }
];

export const INITIAL_GENERATORS: Generator[] = [
  { id: 'KMD', name: 'KMD', model: 'Pai Kane', airFilter: 'A-5541-S', oilFilter: 'C-1701', fuelFilter: 'FC-52040', fanBelt: '', waterSeparator: '' },
  { id: 'HLD', name: 'HLD', model: 'Gesan', airFilter: 'A-7003-S', oilFilter: 'C-5102, C-7103', fuelFilter: 'EF-51040', fanBelt: '', waterSeparator: '' },
  { id: 'LMD', name: 'LMD', model: 'Denyo', airFilter: 'A-5628', oilFilter: 'O-1314, BO-177', fuelFilter: 'F-1303', fanBelt: 'B-50', waterSeparator: '' },
  { id: 'Sule', name: 'Sule', model: 'Gesan', airFilter: 'WHK 1930587, A-7003-S', oilFilter: 'C-5102', fuelFilter: 'EF-51040', fanBelt: 'EO 8.5L, CL 14L', waterSeparator: '' },
  { id: 'BAK', name: 'BAK', model: 'Gesan', airFilter: 'WHK 1930587, A-7003-S', oilFilter: 'C-5102', fuelFilter: 'EF-51040', fanBelt: '', waterSeparator: '' },
  { id: 'TSL', name: 'TSL', model: 'Denyo', airFilter: 'HMG-056D, K-1530, A-5558', oilFilter: 'O1301', fuelFilter: 'BF-101', fanBelt: 'RECMF-8480', waterSeparator: '' },
  { id: 'TGG', name: 'TGG', model: 'Pai Kane 30kva', airFilter: 'A-8506-S', oilFilter: 'C-1701', fuelFilter: 'FC-52040', fanBelt: '', waterSeparator: 'F-1004' },
  { id: 'SBT', name: 'SBT', model: 'Denyo', airFilter: 'A-5628', oilFilter: 'O-13254', fuelFilter: 'FC-1503', fanBelt: 'B-50', waterSeparator: '' },
  { id: 'SPT', name: 'SPT', model: 'Pai Kane', airFilter: 'A-5541-S', oilFilter: 'C-1701', fuelFilter: 'FC-52040', fanBelt: '', waterSeparator: '' },
  { id: 'ND', name: 'ND', model: 'Denyo', airFilter: 'A-1014', oilFilter: 'BO-177', fuelFilter: 'FC-1004, FC-1020', fanBelt: 'RECMF-8480', waterSeparator: '' },
  { id: 'ZM', name: 'ZM', model: 'Gesan', airFilter: 'WHK 1930587, A-7003-S', oilFilter: 'C-5102', fuelFilter: 'EF-51040', fanBelt: '', waterSeparator: '' },
  { id: 'HW', name: 'HW', model: 'Denyo', airFilter: 'A-6012', oilFilter: 'CO-1304', fuelFilter: 'FC-1503', fanBelt: '', waterSeparator: '' },
  { id: 'TKT', name: 'TKT', model: 'Gesan', airFilter: 'AS-51540', oilFilter: 'C-1142', fuelFilter: 'FC-1702', fanBelt: 'RECMF 6385', waterSeparator: '' },
  { id: 'IS', name: 'IS', model: 'Denyo', airFilter: 'A1176', oilFilter: 'O1301', fuelFilter: 'F-1303', fanBelt: 'B-50', waterSeparator: '' },
  { id: 'MNG', name: 'MNG', model: 'Denyo', airFilter: 'A-5628', oilFilter: 'BO-177', fuelFilter: 'F-1303', fanBelt: 'RCMF 8500', waterSeparator: '' },
  { id: 'Parami', name: 'Parami', model: 'Gesan', airFilter: 'A-8506-S', oilFilter: 'C-5102', fuelFilter: 'EF 51040', fanBelt: 'RECMF 6530', waterSeparator: '' },
  { id: 'K1', name: 'K1', model: 'Kohler', airFilter: 'A-2418', oilFilter: 'C-5501*2, C-5717', fuelFilter: 'FC-7108/ FC-7104', fanBelt: '41468/ 330051537', waterSeparator: 'SFC-7103-30, GM41512' },
  { id: 'K2', name: 'K2', model: 'Kohler', airFilter: 'A-2418', oilFilter: 'C-5501*2, C-5717', fuelFilter: 'FC-7108/ FC-7105', fanBelt: '41468/ 330051537', waterSeparator: 'SFC-7103-30, GM41512' }
];
