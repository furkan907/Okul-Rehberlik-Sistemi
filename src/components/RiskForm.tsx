import React, { useState } from 'react';
import { Heart, Home, Activity, CheckCircle2, ChevronRight, User, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';
import { RiskDetails } from '../types';

export const RiskForm: React.FC = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<RiskDetails>({
    anne_hayatta: true,
    baba_hayatta: true,
    parcalanmis_aile: false,
    ekonomik_durum: '',
    saglik_sorunu: false,
    ozel_egitim_ihtiyacı: false,
    devamsizlik_riski: false,
    diger_notlar: ''
  });

  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Firebase entegrasyonu buraya gelecek
    console.log('Form verisi:', formData);
    setSubmitted(true);
  };
  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-10 rounded-2xl shadow-xl max-w-md w-full text-center border border-slate-100"
        >
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
            <CheckCircle2 size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2 tracking-tight">İşlem Tamamlandı</h2>
          <p className="text-slate-500 text-sm leading-relaxed">Öğrenci risk haritası verileri sisteme kaydedildi. Katkınız için teşekkür ederiz.</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-slate-900 text-white rounded-xl shadow-lg mb-4">
            <ShieldAlert size={24} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Risk Analiz Formu</h1>
          <p className="text-slate-500 text-xs mt-2 font-medium uppercase tracking-widest">Öğrenci Yakın Bilgi Formu</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-8 border border-slate-200">
          <div className="space-y-6">
            {/* Section: Aile */}
            <div className="space-y-4">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Home size={14} />
                Ailevi Durum
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 cursor-pointer hover:border-blue-300 transition-all">
                  <span className="text-xs font-semibold text-slate-700">Anne Hayatta mı?</span>
                  <input 
                    type="checkbox" 
                    checked={formData.anne_hayatta}
                    onChange={(e) => setFormData({...formData, anne_hayatta: e.target.checked})}
                    className="w-4 h-4 accent-slate-900"
                  />
                </label>
                <label className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 cursor-pointer hover:border-blue-300 transition-all">
                  <span className="text-xs font-semibold text-slate-700">Baba Hayatta mı?</span>
                  <input 
                    type="checkbox" 
                    checked={formData.baba_hayatta}
                    onChange={(e) => setFormData({...formData, baba_hayatta: e.target.checked})}
                    className="w-4 h-4 accent-slate-900"
                  />
                </label>
              </div>

              <label className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 cursor-pointer hover:border-rose-300 transition-all">
                <span className="text-xs font-semibold text-slate-700">Parçalanmış Aile mi?</span>
                <input 
                  type="checkbox" 
                  checked={formData.parcalanmis_aile}
                  onChange={(e) => setFormData({...formData, parcalanmis_aile: e.target.checked})}
                  className="w-4 h-4 accent-slate-900"
                />
              </label>
            </div>

            <div className="h-px bg-slate-100" />

            {/* Section: Sosyal */}
            <div className="space-y-4">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Activity size={14} />
                Sosyal ve Sağlık
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Ekonomik Durum</label>
                <select 
                  required
                  value={formData.ekonomik_durum}
                  onChange={(e) => setFormData({...formData, ekonomik_durum: e.target.value as any})}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none text-slate-700 font-medium"
                >
                  <option value="">Seçiniz</option>
                  <option value="Iyi">İyi</option>
                  <option value="Orta">Orta</option>
                  <option value="Kotu">Kötü</option>
                </select>
              </div>

              <div className="space-y-2">
                {[
                  { id: 'saglik_sorunu', label: 'Kronik sağlık sorunu', icon: Heart },
                  { id: 'ozel_egitim_ihtiyacı', label: 'Özel eğitim desteği', icon: User },
                  { id: 'devamsizlik_riski', label: 'Devamsızlık riski', icon: ShieldAlert }
                ].map((item) => (
                  <label key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 cursor-pointer hover:border-blue-300 transition-all">
                    <span className="text-xs font-semibold text-slate-700">{item.label}</span>
                    <input 
                      type="checkbox" 
                      checked={(formData as any)[item.id]}
                      onChange={(e) => setFormData({...formData, [item.id]: e.target.checked})}
                      className="w-4 h-4 accent-slate-900"
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Ek Notlar</label>
              <textarea 
                rows={3}
                placeholder="Önemli gördüğünüz diğer durumlar..."
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none resize-none text-slate-700 leading-relaxed font-medium"
                value={formData.diger_notlar}
                onChange={(e) => setFormData({...formData, diger_notlar: e.target.value})}
              />
            </div>

            <button 
              type="submit"
              className="w-full py-3 bg-slate-900 text-white rounded-lg font-bold text-sm hover:bg-slate-800 shadow-sm transition-all flex items-center justify-center gap-2"
            >
              Formu Gönder <ChevronRight size={16} />
            </button>
          </div>
        </form>

        <p className="text-center text-[10px] text-slate-400 mt-8 font-medium uppercase tracking-widest">
          Güvenli Altyapı • KVKK Uyumlu
        </p>
      </div>
    </div>
  );
};
