import React, { useState } from 'react';
import { LayoutDashboard, Users, UserPlus, Settings, LogOut, Search, Bell } from 'lucide-react';
import { DashboardStats } from './StatCards';
import { StudentTable } from './StudentTable';
import { ImportModal } from './ImportModal';
import { StudentDetailPanel } from './StudentDetailPanel';
import { Student } from '../../types';

export const Dashboard: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const handleImport = (newStudents: Partial<Student>[]) => {
    // Gerçek uygulamada burası Firestore'a yazacak
    const formattedStudents = newStudents.map((s, i) => ({
      ...s,
      id: s.tc || `temp-${i}`,
      risk_skoru: Math.floor(Math.random() * 10), // Şimdilik test için rastgele
      son_guncellenme: new Date(),
    })) as Student[];
    
    setStudents([...students, ...formattedStudents]);
    setIsImportModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 hidden lg:flex flex-col text-white shadow-xl">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3 text-white font-bold text-xl mb-4">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-lg">
              R
            </div>
            <span className="text-lg font-semibold tracking-tight">Rehberlik</span>
          </div>

          <nav className="space-y-1 mt-6">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 mb-2">Yönetim</div>
            <a href="#" className="flex items-center gap-3 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
              <LayoutDashboard size={18} /> Dashboard
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2 text-slate-400 hover:bg-slate-800 hover:text-white rounded-lg text-sm font-medium transition-colors">
              <Users size={18} /> Öğrenciler
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2 text-slate-400 hover:bg-slate-800 hover:text-white rounded-lg text-sm font-medium transition-colors">
              <Settings size={18} /> Ayarlar
            </a>
          </nav>
        </div>
        
        <div className="mt-auto p-4 border-t border-slate-800">
          <button className="flex items-center gap-3 px-3 py-2 text-slate-400 hover:bg-slate-800 hover:text-white w-full rounded-lg transition-colors text-sm font-medium">
            <LogOut size={16} /> Çıkış Yap
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex flex-col h-screen">
        <header className="h-16 bg-white border-b border-slate-200 px-8 sticky top-0 z-20 flex justify-between items-center shrink-0">
          <h1 className="text-lg font-semibold text-slate-900">Öğrenci Yönetim Paneli</h1>
          <div className="flex items-center gap-4">
            <button className="p-2 text-slate-400 hover:bg-slate-50 rounded-lg transition-colors">
              <Bell size={18} />
            </button>
            <div className="flex items-center gap-3 h-10 px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50/50">
              <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[10px] text-white">M.A</div>
              <span className="text-sm font-medium text-slate-700">Merve Aydın</span>
            </div>
          </div>
        </header>

        <div className="p-8 overflow-y-auto w-full">
          {/* Header Actions */}
          <div className="flex justify-between items-end mb-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Hoş Geldiniz 👋</h2>
              <p className="text-slate-500 text-sm mt-1">Okul risk durumunu ve öğrenci formlarını buradan yönetebilirsiniz.</p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setIsImportModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm transition-all"
              >
                <UserPlus size={18} /> e-Okul Listesi Yükle
              </button>
            </div>
          </div>

          <DashboardStats students={students} />

          <StudentTable 
            students={students} 
            onSelectStudent={setSelectedStudent} 
          />
        </div>
      </main>

      <ImportModal 
        isOpen={isImportModalOpen} 
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImport}
      />

      <StudentDetailPanel 
        student={selectedStudent}
        onClose={() => setSelectedStudent(null)}
      />
    </div>
  );
};
