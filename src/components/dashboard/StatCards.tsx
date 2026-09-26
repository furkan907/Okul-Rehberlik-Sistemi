import React from 'react';
import { Users, FileCheck2, FileWarning, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  trend?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, color }) => (
  <motion.div 
    whileHover={{ y: -2 }}
    className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col"
  >
    <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">{title}</div>
    <div className={`text-2xl font-bold ${color.includes('rose') ? 'text-rose-600' : color.includes('emerald') ? 'text-emerald-600' : color.includes('blue') ? 'text-blue-600' : color.includes('amber') ? 'text-amber-600' : 'text-slate-900'}`}>
      {value}
    </div>
  </motion.div>
);

export const DashboardStats: React.FC<{ students: any[] }> = ({ students }) => {
  const total = students.length;
  const completed = students.filter(s => s.form_dolduruldu).length;
  const pending = total - completed;
  const riskCount = students.filter(s => s.risk_skoru > 3).length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <StatCard 
        title="Toplam Öğrenci" 
        value={total} 
        icon={Users} 
        color="text-slate-900" 
      />
      <StatCard 
        title="Doldurulan Form" 
        value={completed} 
        icon={FileCheck2} 
        color="text-emerald-600"
      />
      <StatCard 
        title="Bekleyen Form" 
        value={pending} 
        icon={FileWarning} 
        color="text-amber-600" 
      />
      <StatCard 
        title="Kritik Riskli" 
        value={riskCount} 
        icon={FileWarning} 
        color="text-rose-600" 
      />
    </div>
  );
};
