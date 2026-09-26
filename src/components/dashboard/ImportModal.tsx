import React, { useState } from 'react';
import { Upload, X, CheckCircle2, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { parseStudentExcel } from '../../services/excelService';
import { parseStudentPDF } from '../../services/pdfService';
import { Student } from '../../types';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: Partial<Student>[]) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImport }) => {
  const [dragActive, setDragActive] = useState(false);
  const [previewData, setPreviewData] = useState<Partial<Student>[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFile = async (file: File) => {
    setIsProcessing(true);
    try {
      let students: Partial<Student>[] = [];
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        students = await parseStudentPDF(file);
      } else {
        students = await parseStudentExcel(file);
      }
      setPreviewData(students);
    } catch (error) {
      console.error('File parsing error:', error);
      alert('Dosya okunamadı. Lütfen formatı (PDF/Excel) kontrol edin.');
    } finally {
      setIsProcessing(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="text-blue-600" size={20} />
            e-Okul Listesi Yükle
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1 hover:bg-slate-200 rounded">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {previewData.length === 0 ? (
            <div 
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={onDrop}
              className={`border border-dashed rounded-xl p-10 text-center transition-all ${
                dragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-400 bg-slate-50/30'
              }`}
            >
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center text-blue-600">
                  <Upload size={24} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Excel veya CSV dosyasını buraya bırakın</p>
                  <p className="text-xs text-slate-500 mt-1">Öğrenci listesi içeren e-Okul dosyası</p>
                </div>
                <input 
                  type="file" 
                  accept=".xlsx, .xls, .csv, .pdf" 
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                  className="hidden" 
                  id="excel-upload"
                />
                <label 
                  htmlFor="excel-upload"
                  className="mt-3 px-6 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 cursor-pointer transition-all shadow-sm"
                >
                  Dosya Seç
                </label>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl flex items-start gap-3">
                <CheckCircle2 className="text-blue-600 mt-0.5" size={18} />
                <div>
                  <p className="text-sm font-bold text-blue-900">{previewData.length} Öğrenci Tespit Edildi</p>
                  <p className="text-xs text-blue-700 mt-0.5">Lütfen aşağıdaki önizlemeyi kontrol edin.</p>
                </div>
              </div>

              <div className="max-h-52 overflow-y-auto border border-slate-100 rounded-xl">
                <table className="w-full text-[13px] text-left">
                  <thead className="bg-slate-50/50 sticky top-0 border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-2 font-semibold text-slate-600">TC No</th>
                      <th className="px-4 py-2 font-semibold text-slate-600">Ad Soyad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {previewData.slice(0, 10).map((s, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2 text-slate-500 font-mono">{s.tc?.slice(0, 3)}*****{s.tc?.slice(-2)}</td>
                        <td className="px-4 py-2 font-medium text-slate-800">{s.ad} {s.soyad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  onClick={() => setPreviewData([])}
                  className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Dosyayı Değiştir
                </button>
                <button 
                  onClick={() => onImport(previewData)}
                  disabled={isProcessing}
                  className="flex-[2] py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 shadow-sm transition-all disabled:opacity-50"
                >
                  {isProcessing ? 'İşleniyor...' : 'Veritabanına Aktar'}
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
