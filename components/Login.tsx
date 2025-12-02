import React, { useState, useEffect } from 'react';
import { Snowflake, Lock, User as UserIcon, LogIn, AlertCircle, Loader2 } from 'lucide-react';
import { login, syncUsersFromCloud } from '../services/authService';
import { User } from '../types';

interface Props {
  onLogin: (user: User) => void;
}

export const Login: React.FC<Props> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(true);

  useEffect(() => {
    // Attempt to sync users from cloud when login screen loads
    const load = async () => {
      await syncUsersFromCloud();
      setSyncing(false);
    };
    load();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Simulate network delay for effect
    setTimeout(() => {
      const user = login(username, password);
      if (user) {
        onLogin(user);
      } else {
        setError('Invalid username or password');
      }
      setLoading(false);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        <div className="bg-blue-600 p-8 text-center relative">
          <div className="mx-auto bg-white/20 w-16 h-16 rounded-2xl flex items-center justify-center backdrop-blur-sm mb-4">
            <Snowflake size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">ColdChain Guardian</h1>
          <p className="text-blue-100 text-sm mt-1">Industrial Logbook & AI Assistant</p>
          
          {syncing && (
             <div className="absolute top-4 right-4 flex items-center gap-1 text-[10px] text-blue-200 bg-blue-700/50 px-2 py-1 rounded-full">
               <Loader2 size={10} className="animate-spin" /> Syncing Users...
             </div>
          )}
        </div>

        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Username</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-800 font-medium"
                  placeholder="Enter username"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-800 font-medium"
                  placeholder="Enter password"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-100 animate-in slide-in-from-top-2">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-lg hover:bg-slate-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="animate-pulse">Verifying...</span>
              ) : (
                <>
                  <LogIn size={20} /> Login
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};