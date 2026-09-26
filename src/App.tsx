import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Dashboard } from './components/dashboard/Dashboard';
import { RiskForm } from './components/RiskForm';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/form" element={<RiskForm />} />
        {/* Admin girişi ve diğer sayfalar buraya eklenecek */}
      </Routes>
    </Router>
  );
}
