import React from 'react';
import { Machine, MachineType } from '../types';
import { ThermometerSnowflake, Activity } from 'lucide-react';

interface Props {
  machine: Machine;
  onClick: (m: Machine) => void;
}

export const MachineCard: React.FC<Props> = ({ machine, onClick }) => {
  const isFreezer = machine.type === MachineType.FREEZER;
  
  return (
    <button
      onClick={() => onClick(machine)}
      className={`p-6 rounded-xl border-2 transition-all hover:scale-[1.02] shadow-sm text-left w-full flex items-center justify-between group
      ${isFreezer 
        ? 'border-cyan-100 bg-white hover:border-cyan-400 hover:shadow-cyan-100' 
        : 'border-blue-100 bg-white hover:border-blue-400 hover:shadow-blue-100'}`}
    >
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className={`p-2 rounded-lg ${isFreezer ? 'bg-cyan-100 text-cyan-700' : 'bg-blue-100 text-blue-700'}`}>
            {isFreezer ? <ThermometerSnowflake size={24} /> : <Activity size={24} />}
          </div>
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${isFreezer ? 'bg-cyan-50 text-cyan-800' : 'bg-blue-50 text-blue-800'}`}>
            {machine.type}
          </span>
        </div>
        <h3 className="text-lg font-bold text-slate-800">{machine.name}</h3>
        <p className="text-sm text-slate-500">Target: {machine.defaultSetpoint}°C</p>
      </div>
      <div className="text-slate-300 group-hover:text-slate-500 transition-colors">
        →
      </div>
    </button>
  );
};