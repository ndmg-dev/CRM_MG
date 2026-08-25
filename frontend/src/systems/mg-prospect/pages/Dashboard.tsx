import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Users, Target, Award, TrendingUp, Activity, ArrowUpRight, Zap } from 'lucide-react';

interface DashboardStats {
    totalLeads: number;
    activeCampaigns: number;
    qualifiedLeads: number;
    interestedLeads: number;
    recentLeads: any[];
    campaigns: any[];
}

function SkeletonCards() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[...Array(4)].map((_, i) => (
                <div key={i} className="card-premium animate-pulse">
                    <div className="flex items-center justify-between mb-5">
                        <div className="skeleton w-11 h-11 rounded-premium" />
                        <div className="skeleton-text w-14" />
                    </div>
                    <div className="skeleton h-8 w-16 rounded mb-2" />
                    <div className="skeleton-text w-28" />
                </div>
            ))}
        </div>
    );
}

export function Dashboard() {
    const [stats, setStats] = useState<DashboardStats>({
        totalLeads: 0, activeCampaigns: 0, qualifiedLeads: 0, interestedLeads: 0, recentLeads: [], campaigns: []
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadDashboard() {
            try {
                const [leadsRes, campaignsRes, qualifiedRes, interestedRes] = await Promise.all([
                    api.get('/leads?page_size=5'),
                    api.get('/campaigns'),
                    api.get('/leads?min_score=40&page_size=1'),
                    api.get('/leads?status=INTERESSADO&page_size=1')
                ]);

                const totalLeads = leadsRes.data.total;
                const recentLeads = leadsRes.data.items;
                const campaigns = campaignsRes.data;
                const qualified = qualifiedRes.data.total;
                const interested = interestedRes.data.total;

                setStats({
                    totalLeads: totalLeads,
                    activeCampaigns: campaigns.length,
                    qualifiedLeads: qualified,
                    interestedLeads: interested,
                    recentLeads: recentLeads,
                    campaigns: campaigns.slice(-3).reverse(),
                });
            } catch (error) {
                console.error("Erro ao carregar dados:", error);
            } finally {
                setLoading(false);
            }
        }
        loadDashboard();
    }, []);

    const statCards = [
        {
            title: 'Leads Captados',
            value: stats.totalLeads,
            icon: Users,
            color: 'text-mg-info',
            bg: 'bg-mg-info/10',
            trend: '+12%'
        },
        {
            title: 'Campanhas',
            value: stats.activeCampaigns,
            icon: Target,
            color: 'text-purple-400',
            bg: 'bg-purple-400/10',
            trend: 'Ativas'
        },
        {
            title: 'Leads Qualificados',
            value: stats.qualifiedLeads,
            icon: Award,
            color: 'text-mg-success',
            bg: 'bg-mg-success/10',
            trend: `${stats.totalLeads > 0 ? Math.round((stats.qualifiedLeads / stats.totalLeads) * 100) : 0}%`
        },
        {
            title: 'Interessados',
            value: stats.interestedLeads,
            icon: Target, // Podia ser Zap, mas Target já importado
            color: 'text-mg-gold',
            bg: 'bg-mg-goldmuted',
            trend: `${stats.totalLeads > 0 ? Math.round((stats.interestedLeads / stats.totalLeads) * 100) : 0}% conv.`
        },
    ];

    const getScoreColor = (score: number) => {
        if (score >= 70) return 'text-mg-success';
        if (score >= 40) return 'text-mg-gold';
        return 'text-mg-muted';
    };

    if (loading) {
        return (
            <div className="space-y-8 animate-fade-in">
                <div>
                    <div className="skeleton h-7 w-40 rounded mb-2" />
                    <div className="skeleton-text w-72" />
                </div>
                <SkeletonCards />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                {statCards.map((stat, index) => {
                    const Icon = stat.icon;
                    return (
                        <div key={index} className="metric-card" style={{ animationDelay: `${index * 80}ms` }}>
                            <div className="flex items-center justify-between mb-5">
                                <div className={`p-2.5 rounded-premium ${stat.bg} ${stat.color} relative icon-glow`}>
                                    <Icon className="w-5 h-5 relative z-10" />
                                </div>
                                <span className="flex items-center text-2xs font-semibold text-mg-success bg-mg-success/10 px-2 py-0.5 rounded-full">
                                    <TrendingUp className="w-3 h-3 mr-1" />
                                    {stat.trend}
                                </span>
                            </div>
                            <div>
                                <h3 className="text-3xl font-bold text-mg-text mb-1 tracking-tight">{stat.value}</h3>
                                <p className="text-sm font-medium text-mg-muted">{stat.title}</p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Activity */}
                <div className="lg:col-span-2 card-surface">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="section-title">
                            <Activity className="w-4 h-4 text-mg-gold" />
                            Leads Recentes
                        </h3>
                        {stats.recentLeads.length > 0 && (
                            <span className="text-2xs text-mg-muted">Últimos captados</span>
                        )}
                    </div>

                    {stats.recentLeads.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="w-12 h-12 rounded-premium bg-mg-elevated flex items-center justify-center mb-4">
                                <Zap className="w-5 h-5 text-mg-muted" />
                            </div>
                            <p className="text-sm text-mg-muted font-medium">Nenhum lead captado ainda</p>
                            <p className="text-xs text-mg-muted/60 mt-1">Crie uma campanha para começar a prospecção</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {stats.recentLeads.map((lead: any) => (
                                <div key={lead.id} className="flex items-center justify-between p-3 rounded-premium bg-mg-bg/50 hover:bg-mg-elevated transition-colors group">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-8 h-8 rounded-lg bg-mg-goldmuted flex items-center justify-center flex-shrink-0">
                                            <Users className="w-3.5 h-3.5 text-mg-gold" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-mg-text truncate">{lead.name}</p>
                                            <p className="text-2xs text-mg-muted capitalize">{lead.category} • {lead.city}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`text-sm font-bold ${getScoreColor(lead.score)}`}>
                                            {lead.score}pts
                                        </span>
                                        <ArrowUpRight className="w-3.5 h-3.5 text-mg-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Campaigns sidebar */}
                <div className="card-surface">
                    <h3 className="section-title mb-5">
                        <Target className="w-4 h-4 text-mg-gold" />
                        Campanhas Recentes
                    </h3>

                    {stats.campaigns.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                            <div className="w-12 h-12 rounded-premium bg-mg-elevated flex items-center justify-center mb-4">
                                <Target className="w-5 h-5 text-mg-muted" />
                            </div>
                            <p className="text-sm text-mg-muted font-medium">Sem campanhas</p>
                            <p className="text-xs text-mg-muted/60 mt-1">Configure sua primeira campanha</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {stats.campaigns.map((campaign: any) => (
                                <div key={campaign.id} className="p-3.5 rounded-premium bg-mg-bg/50 border border-mg-border/50 hover:border-mg-borderbold transition-all">
                                    <div className="flex items-start justify-between mb-2">
                                        <p className="text-sm font-medium text-mg-text leading-tight">{campaign.name}</p>
                                        <span className={`badge text-2xs ${
                                            campaign.status === 'CONCLUIDO' ? 'badge-success' :
                                            campaign.status === 'RODANDO' ? 'badge-warning' :
                                            campaign.status === 'ERRO' ? 'badge-error' :
                                            'badge-neutral'
                                        }`}>
                                            {campaign.status}
                                        </span>
                                    </div>
                                    <p className="text-2xs text-mg-muted">
                                        {campaign.keyword} • {campaign.target_city}/{campaign.target_state}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
