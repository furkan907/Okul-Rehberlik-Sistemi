import React from 'react';
import { X, Heart, Home, Activity, AlertTriangle, Calendar, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Student } from '../../types';

interface DetailPanelProps {
  student: Student | null;
  onClose: () => void;
}

const DetailCard: React.FC<{ title: string; value: string | boolean; icon: any; color: string }> = ({ title, value, color }) => (
  <div className="flex justify-between py-2 text-sm border-b border-slate-50 last:border-0">
    <span className="text-slate-600">{title}</span>
    <span className={`font-medium ${typeof value === 'boolean' ? (value ? 'text-red-600' : 'text-slate-500') : 'text-slate-900'}`}>
      {typeof value === 'boolean' ? (value ? 'Evet' : 'Hayır') : value}
    </span>
  </div>
);

export const StudentDetailPanel: React.FC<DetailPanelProps> = ({ student, onClose }) => {
  return (
    <AnimatePresence>
      {student && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-[2px] z-40"
          />
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full max-w-sm bg-white shadow-2xl z-50 overflow-hidden flex flex-col border-l border-slate-200"
          >
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-900 leading-tight">Öğrenci Detayı</h3>
                <p className="text-xs text-slate-500 mt-0.5">{student.ad} {student.soyad} ({student.tc.slice(-4)})</p>
              </div>
              <button 
                onClick={onClose}
                className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {!student.form_dolduruldu ? (
                <div className="bg-slate-50 border border-slate-100 p-6 rounded-xl text-center">
                  <AlertTriangle className="text-amber-500 mx-auto mb-3" size={32} />
                  <h3 className="font-bold text-slate-900 text-sm">Form Bekleniyor</h3>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">Bu öğrenci henüz risk haritası formunu doldurmamıştır. Velisine hatırlatma yapabilirsiniz.</p>
                </div>
              ) : (
                <>
                  <section>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Aile ve Yaşam Durumu</div>
                    <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100 space-y-1">
                      <DetailCard title="Anne Hayatta mı?" value={student.risk_detaylari?.anne_hayatta || false} icon={Heart} color="bg-rose-500" />
                      <DetailCard title="Baba Hayatta mı?" value={student.risk_detaylari?.baba_hayatta || false} icon={Heart} color="bg-rose-500" />
                      <DetailCard title="Parçalanmış Aile" value={student.risk_detaylari?.parcalanmis_aile || false} icon={Home} color="bg-amber-500" />
                      <DetailCard title="Ekonomik Durum" value={student.risk_detaylari?.ekonomik_durum || 'Belirtilmedi'} icon={Activity} color="bg-blue-500" />
                    </div>
                  </section>

                  <section>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Kritik Riskler</div>
                    <div className="flex flex-wrap gap-2">
                      {student.risk_detaylari?.saglik_sorunu && <span className="bg-rose-50 text-rose-700 px-2 py-1 rounded text-xs font-medium border border-rose-100">Sağlık Sorunu</span>}
                      {student.risk_detaylari?.ozel_egitim_ihtiyacı && <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-medium border border-blue-100">Özel Eğitim</span>}
                      {student.risk_detaylari?.devamsizlik_riski && <span className="bg-amber-50 text-amber-700 px-2 py-1 rounded text-xs font-medium border border-amber-100">Devamsızlık</span>}
                    </div>
                  </section>

                  {student.risk_detaylari?.diger_notlar && (
                    <section>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Rehberlik Notu</div>
                      <div className="bg-blue-50/30 p-4 rounded-xl border border-blue-100 text-xs text-slate-600 leading-relaxed italic">
                        "{student.risk_detaylari.diger_notlar}"
                      </div>
                    </section>
                  )}
                </>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100">
              <button className="w-full bg-slate-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors">
                Görüşme Kaydı Ekle
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
