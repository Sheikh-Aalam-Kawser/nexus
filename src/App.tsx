import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAppStore } from './store';
import Dashboard from './pages/Dashboard';
import Landing from './pages/Landing';
import MyTasks from './pages/MyTasks';
import { Toaster } from '@/components/ui/sonner';

export default function App() {
  const { user, tasks, autoEvaluatePrioritiesAndFocus } = useAppStore();
  const navigate = useNavigate();

  useEffect(() => {
    autoEvaluatePrioritiesAndFocus();
  }, [tasks.length, autoEvaluatePrioritiesAndFocus]);

  return (
    <div className="min-h-screen bg-[#09090b] text-slate-100 font-sans selection:bg-emerald-500/30 flex flex-col">
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/" />} />
        <Route path="/tasks" element={user ? <MyTasks /> : <Navigate to="/" />} />
      </Routes>
      <Toaster theme="dark" />
    </div>
  );
}
