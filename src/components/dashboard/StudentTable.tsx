import React from 'react';
import { Search, Filter, Info, ChevronRight } from 'lucide-react';
import { Student } from '../../types';

interface TableProps {
  students: Student[];
  onSelectStudent: (student: Student) => void;
}

export const StudentTable: React.FC<TableProps> = ({ students, onSelectStudent }) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [classFilter, setClassFilter] = React.useState('all');

  const filteredStudents = students.filter(s => {
    const matchesSearch = (s.ad + s.soyad).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = classFilter === 'all' || s.sinif === classFilter;
    return matchesSearch && matchesClass;
  });

  const uniqueClasses = Array.from(new Set(students.map(s => s.sinif))).sort();

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
      <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50/50">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text"
            placeholder="Ara..."
            className="w-full pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 transition-all outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-500 font-medium">Filtrele:</span>
          <select 
            className="text-xs border border-slate-200 rounded px-2 py-1.5 bg-white outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
          >
            <option value="all">Tüm Sınıflar</option>
            {uniqueClasses.map(c => <option key={c} value={c}>{c}. Sınıf</option>)}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-white border-b border-slate-200 text-slate-500 font-medium">
            <tr>
              <th className="px-6 py-3">Öğrenci Ad Soyad</th>
              <th className="px-6 py-3">Sınıf/Şube</th>
              <th className="px-6 py-3">Form Durumu</th>
              <th className="px-6 py-3">Risk Skoru</th>
              <th className="px-6 py-3 text-right">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                  Kayıtlı öğrenci bulunamadı.
                </td>
              </tr>
            ) : (
              filteredStudents.map((student) => (
                <tr 
                  key={student.id} 
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => onSelectStudent(student)}
                >
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{student.ad} {student.soyad}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{student.tc}</div>
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {student.sinif}-{student.sube}
                  </td>
                  <td className="px-6 py-4">
                    {student.form_dolduruldu ? (
                      <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                        DOLDURULDU
                      </span>
                    ) : (
                      <span className="bg-red-100 text-red-700 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                        BEKLİYOR
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden w-12">
                        <div 
                          className={`h-full rounded-full ${
                            student.risk_skoru > 6 ? 'bg-rose-500' : 
                            student.risk_skoru > 3 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${(student.risk_skoru / 10) * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-slate-600">{student.risk_skoru}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right text-blue-600 font-medium hover:underline">
                    Detay
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
