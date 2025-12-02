import React, { useState, useEffect } from 'react';
import { X, UserPlus, Trash2, Shield, User as UserIcon, Save, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { getUsers, addUser, removeUser, syncUsersFromCloud } from '../services/authService';
import { User, UserRole } from '../types';

interface Props {
  onClose: () => void;
  onOpenSheetSetup: () => void;
}

export const AdminPanel: React.FC<Props> = ({ onClose, onOpenSheetSetup }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [newUser, setNewUser] = useState({ username: '', password: '', name: '', role: UserRole.USER });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    refreshUsers();
  }, []);

  const refreshUsers = () => {
    setUsers(getUsers());
  };

  const handleSyncUsers = async () => {
    setIsSyncing(true);
    await syncUsersFromCloud();
    refreshUsers();
    setIsSyncing(false);
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password || !newUser.name) return;

    setIsLoading(true);
    const success = await addUser({
      username: newUser.username,
      password: newUser.password,
      name: newUser.name,
      role: newUser.role
    });
    setIsLoading(false);

    if (success) {
      setNewUser({ username: '', password: '', name: '', role: UserRole.USER });
      refreshUsers();
      setError('');
    } else {
      setError('Username already exists');
    }
  };

  const handleDeleteUser = async (username: string) => {
    if (confirm(`Are you sure you want to delete user "${username}"?`)) {
      setIsLoading(true);
      await removeUser(username);
      refreshUsers();
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
        >
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
          <Shield size={24} className="text-blue-600"/>
          Admin Dashboard
        </h2>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Create User Column */}
          <div className="space-y-4">
            <h3 className="font-bold text-slate-700 border-b pb-2">Create New User</h3>
            <form onSubmit={handleAddUser} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Full Name</label>
                <input 
                  type="text" 
                  value={newUser.name}
                  onChange={e => setNewUser({...newUser, name: e.target.value})}
                  className="w-full p-2 border rounded-lg text-sm"
                  placeholder="e.g. John Doe"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Username</label>
                <input 
                  type="text" 
                  value={newUser.username}
                  onChange={e => setNewUser({...newUser, username: e.target.value})}
                  className="w-full p-2 border rounded-lg text-sm"
                  placeholder="e.g. johnd"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Password</label>
                <input 
                  type="text" 
                  value={newUser.password}
                  onChange={e => setNewUser({...newUser, password: e.target.value})}
                  className="w-full p-2 border rounded-lg text-sm"
                  placeholder="Min 6 chars"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Role</label>
                <select 
                  value={newUser.role}
                  onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}
                  className="w-full p-2 border rounded-lg text-sm bg-white"
                >
                  <option value={UserRole.USER}>User (Restricted)</option>
                  <option value={UserRole.ADMIN}>Admin (Full Access)</option>
                </select>
              </div>

              {error && <p className="text-red-500 text-xs">{error}</p>}

              <button 
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 flex items-center justify-center gap-2 text-sm disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="animate-spin" size={16}/> : <UserPlus size={16} />}
                Add User
              </button>
            </form>

            <div className="mt-6 pt-4 border-t">
              <h3 className="font-bold text-slate-700 mb-2">System Config</h3>
              <button 
                onClick={onOpenSheetSetup}
                className="w-full py-3 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg font-bold flex items-center justify-center gap-2 text-sm border border-slate-200"
              >
                <Save size={16} /> Configure Google Sheet
              </button>
              <p className="text-xs text-slate-400 mt-2">
                Only admins can change the backend Google Sheet URL.
              </p>
            </div>
          </div>

          {/* User List Column */}
          <div>
            <div className="flex justify-between items-center border-b pb-2 mb-4">
              <h3 className="font-bold text-slate-700">Existing Users ({users.length})</h3>
              <button 
                onClick={handleSyncUsers}
                disabled={isSyncing}
                className="text-xs flex items-center gap-1 text-blue-600 font-bold hover:underline disabled:opacity-50"
              >
                {isSyncing ? <Loader2 size={12} className="animate-spin"/> : <RefreshCw size={12} />}
                Sync List
              </button>
            </div>
            
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 relative">
               {isLoading && (
                 <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center">
                   <Loader2 className="animate-spin text-blue-600" />
                 </div>
               )}
              {users.map((user) => (
                <div key={user.username} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${user.role === UserRole.ADMIN ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                      {user.role === UserRole.ADMIN ? <Shield size={16} /> : <UserIcon size={16} />}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{user.name}</p>
                      <p className="text-xs text-slate-500">@{user.username} • <span className="opacity-75">{user.role}</span></p>
                    </div>
                  </div>
                  {user.username !== 'KhaingThwin' && (
                    <button 
                      onClick={() => handleDeleteUser(user.username)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                      title="Delete User"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};