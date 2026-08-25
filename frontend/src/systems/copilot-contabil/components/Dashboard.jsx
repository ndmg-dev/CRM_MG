import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const API_URL = import.meta.env.VITE_COPILOT_API_URL || 'http://localhost:8000';

// Icons
const IconChat = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);
const IconMail = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
  </svg>
);
const IconActivity = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);
const IconUsers = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const IconClock = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const IconArrowRight = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
);

const STAT_CONFIG = [
  { key: 'totalConversations', label: 'Total de Conversas', sub: 'Sessoes de consultoria', color: '#E8C468', accent: 'rgba(232, 196, 104,0.08)', border: 'rgba(232, 196, 104,0.15)', Icon: IconChat },
  { key: 'totalMessages', label: 'Total de Mensagens', sub: 'Perguntas e Respostas', color: '#D4AF37', accent: 'rgba(212, 175, 55,0.08)', border: 'rgba(212, 175, 55,0.15)', Icon: IconMail },
  { key: 'messagesThisWeek', label: 'Mensagens (7 dias)', sub: 'Atividade recente', color: '#E8C468', accent: 'rgba(232, 196, 104,0.08)', border: 'rgba(232, 196, 104,0.15)', Icon: IconActivity },
  { key: 'totalMembers', label: 'Membros da Equipe', sub: 'Usuarios ativos', color: '#D4AF37', accent: 'rgba(212, 175, 55,0.08)', border: 'rgba(212, 175, 55,0.15)', Icon: IconUsers },
];

const StatCard = ({ label, value, sub, color, accent, border, Icon, delay }) => (
  <div
    className="suggestion-card-animate rounded-xl border p-5 relative overflow-hidden group hover:-translate-y-0.5 transition-all duration-300"
    style={{ background: 'rgba(11, 11, 13,0.5)', borderColor: border, animationDelay: `${delay}s` }}
  >
    {/* Gradient overlay on hover */}
    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: `radial-gradient(circle at 80% 20%, ${accent}, transparent 70%)` }} />
    <div className="relative">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] text-slate-500 font-mono uppercase tracking-wider">{label}</p>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: accent, color }}>
          <Icon />
        </div>
      </div>
      <p className="text-3xl font-bold font-mono" style={{ color }}>{value}</p>
      {sub && <p className="text-[10px] text-slate-600 font-mono mt-1.5">{sub}</p>}
    </div>
  </div>
);

const Dashboard = () => {
  const [stats, setStats] = useState({ totalConversations: 0, totalMessages: 0, totalMembers: 0, messagesThisWeek: 0 });
  const [recentConversations, setRecentConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadDashboardData(); }, []);

  const loadDashboardData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const headers = { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' };

      const convRes = await fetch(`${API_URL}/api/chat/conversations`, { headers });
      let convCount = 0;
      let convList = [];
      if (convRes.ok) {
        const convData = await convRes.json();
        convList = convData.conversations || [];
        convCount = convList.length;
      }

      let totalMsgs = 0;
      let weekMsgs = 0;
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      for (const conv of convList.slice(0, 20)) {
        const msgRes = await fetch(`${API_URL}/api/chat/conversations/${conv.id}/messages`, { headers });
        if (msgRes.ok) {
          const msgData = await msgRes.json();
          const msgs = msgData.messages || [];
          totalMsgs += msgs.length;
          weekMsgs += msgs.filter(m => new Date(m.created_at) > oneWeekAgo).length;
        }
      }

      const profileRes = await fetch(`${API_URL}/api/team/members`, { headers }).catch(() => null);
      let memberCount = 1;
      if (profileRes && profileRes.ok) {
        const profileData = await profileRes.json();
        memberCount = (profileData.members || []).length || 1;
      }

      setStats({ totalConversations: convCount, totalMessages: totalMsgs, totalMembers: memberCount, messagesThisWeek: weekMsgs });
      setRecentConversations(convList.slice(0, 5));
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 h-full overflow-y-auto" style={{ background: '#0A0A0C' }}>
      {/* Header */}
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight gradient-title">Dashboard de Uso</h1>
          <p className="text-xs text-slate-500 font-mono mt-1">Metricas reais da plataforma Copilot Contabil IA</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#E8C468]/[0.06] border border-[#E8C468]/15">
          <span className="w-1.5 h-1.5 rounded-full bg-[#E8C468] status-dot" />
          <span className="text-[10px] font-mono text-[#E8C468]/70">Sistema Operacional</span>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-40 gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-slate-700 border-t-[#D4AF37] animate-spin" />
          <span className="font-mono text-xs text-slate-600">Carregando metricas...</span>
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {STAT_CONFIG.map((cfg, i) => (
              <StatCard key={cfg.key} {...cfg} value={stats[cfg.key]} delay={i * 0.08} />
            ))}
          </div>

          {/* Recent Conversations */}
          <div className="rounded-xl border border-slate-800/50 overflow-hidden" style={{ background: 'rgba(11, 11, 13,0.5)' }}>
            <div className="px-5 py-3.5 border-b border-slate-800/40 bg-slate-900/30 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-300">Conversas Recentes</h2>
              <span className="text-[10px] font-mono text-slate-600">{recentConversations.length} sessoes</span>
            </div>
            {recentConversations.length === 0 ? (
              <div className="px-4 py-12 text-center flex flex-col items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-800/40 flex items-center justify-center">
                  <IconChat />
                </div>
                <p className="text-xs text-slate-600 font-mono">Nenhuma conversa registrada ainda.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/30">
                {recentConversations.map((conv) => (
                  <div key={conv.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-800/20 transition-all group cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/[0.07] border border-[#D4AF37]/15 flex items-center justify-center text-[#D4AF37]">
                        <IconChat />
                      </div>
                      <div>
                        <p className="text-sm text-slate-300 font-medium group-hover:text-slate-100 transition-colors">{conv.title || 'Conversa sem titulo'}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 text-slate-600">
                          <IconClock />
                          <span className="text-[10px] font-mono">
                            {new Date(conv.created_at || conv.createdAt).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-slate-600 bg-slate-800/40 px-2 py-0.5 rounded">
                        {conv.id?.slice(0, 8)}
                      </span>
                      <div className="opacity-0 group-hover:opacity-100 text-slate-500 transition-all">
                        <IconArrowRight />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;