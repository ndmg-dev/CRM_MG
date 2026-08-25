import { useEffect, useState, useRef } from 'react';
import { api } from '../lib/api';
import { Terminal, CheckCircle2, AlertCircle, Info, Loader2, PlayCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useNativeSystemPath } from '@/hooks/useNativeSystemBase';

interface CampaignSearchLogsProps {
    campaignId: number | null;
}

interface LogEntry {
    id: number;
    level: string;
    message: string;
    created_at: string;
}

export function CampaignSearchLogs({ campaignId }: CampaignSearchLogsProps) {
    const toAbs = useNativeSystemPath();
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [status, setStatus] = useState<string>('AGUARDANDO');
    const [stats, setStats] = useState({
        found: 0,
        saved: 0,
        duplicates: 0,
        errors: 0
    });

    const logsEndRef = useRef<HTMLDivElement>(null);
    const statusRef = useRef(status);

    // Keep the ref in sync with state so the interval always sees latest value
    useEffect(() => {
        statusRef.current = status;
    }, [status]);

    const fetchLogsAndStatus = async () => {
        if (!campaignId) return;

        try {
            const [logsRes, campaignRes] = await Promise.all([
                api.get(`/campaigns/${campaignId}/logs`),
                api.get(`/campaigns/${campaignId}`)
            ]);

            setLogs(logsRes.data);

            const campaign = campaignRes.data;
            setStatus(campaign.status);
            setStats({
                found: campaign.total_found || 0,
                saved: campaign.total_saved || 0,
                duplicates: campaign.total_duplicates || 0,
                errors: campaign.total_errors || 0
            });

        } catch (err) {
            console.error('Failed to fetch campaign logs', err);
        }
    };

    useEffect(() => {
        if (!campaignId) {
            setLogs([]);
            setStatus('AGUARDANDO');
            return;
        }

        // Initial fetch
        fetchLogsAndStatus();

        // Polling: runs every 2s and checks the ref (not a stale closure)
        const interval = setInterval(() => {
            const current = statusRef.current;
            if (current === 'RODANDO' || current === 'AGUARDANDO') {
                fetchLogsAndStatus();
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [campaignId]);

    useEffect(() => {
        // Auto-scroll to bottom
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    if (!campaignId) {
        return (
            <div className="card-premium h-64 flex flex-col items-center justify-center text-center">
                <Terminal className="w-10 h-10 text-mg-muted/50 mb-3" />
                <p className="text-mg-sub font-medium">Nenhuma busca em andamento</p>
                <p className="text-xs text-mg-muted mt-1">Inicie uma campanha para ver os logs do motor de captação.</p>
            </div>
        );
    }

    const getLevelIcon = (level: string) => {
        switch (level) {
            case 'success': return <CheckCircle2 className="w-3.5 h-3.5 text-mg-success" />;
            case 'error': return <AlertCircle className="w-3.5 h-3.5 text-mg-error" />;
            case 'warning': return <AlertCircle className="w-3.5 h-3.5 text-mg-warning" />;
            default: return <Info className="w-3.5 h-3.5 text-mg-gold" />;
        }
    };

    const getLevelColor = (level: string) => {
        switch (level) {
            case 'success': return 'text-mg-success';
            case 'error': return 'text-mg-error';
            case 'warning': return 'text-mg-warning';
            default: return 'text-mg-muted';
        }
    };

    const isRunning = status === 'RODANDO' || status === 'AGUARDANDO';

    return (
        <div className="bg-[#0B0D10]/95 backdrop-blur-md border border-mg-gold/20 rounded-premium-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-mg-border bg-mg-surface flex items-center justify-between relative">
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gold-gradient opacity-40" />
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-mg-elevated flex items-center justify-center border border-mg-border icon-glow">
                        <Terminal className="w-4 h-4 text-mg-gold relative z-10" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-sm text-mg-text flex items-center gap-2">
                            Motor de Captação
                            {isRunning && <Loader2 className="w-3 h-3 text-mg-gold animate-spin" />}
                        </h3>
                        <p className="text-xs text-mg-muted flex items-center gap-1.5 mt-0.5">
                            Status:
                            <span className={`font-medium ${status === 'CONCLUIDO' ? 'text-mg-success' : status === 'ERRO' ? 'text-mg-error' : 'text-mg-gold'}`}>
                                {status}
                            </span>
                        </p>
                    </div>
                </div>

                {/* Stats Row */}
                <div className="flex items-center gap-4 text-xs">
                    <div className="flex flex-col items-end">
                        <span className="text-mg-muted">Encontrados</span>
                        <span className="font-semibold text-mg-text">{stats.found}</span>
                    </div>
                    <div className="w-px h-8 bg-mg-border" />
                    <div className="flex flex-col items-end">
                        <span className="text-mg-muted">Salvos</span>
                        <span className="font-semibold text-mg-success">{stats.saved}</span>
                    </div>
                    <div className="w-px h-8 bg-mg-border" />
                    <div className="flex flex-col items-end">
                        <span className="text-mg-muted">Duplicados</span>
                        <span className="font-semibold text-mg-warning">{stats.duplicates}</span>
                    </div>
                    <div className="w-px h-8 bg-mg-border" />
                    <div className="flex flex-col items-end">
                        <span className="text-mg-muted">Erros</span>
                        <span className="font-semibold text-mg-error">{stats.errors}</span>
                    </div>
                </div>
            </div>

            {/* Logs Area */}
            <div className="p-4 h-64 overflow-y-auto font-mono text-xs custom-scrollbar bg-black/40">
                {logs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-mg-muted gap-2">
                        <Loader2 className="w-5 h-5 animate-spin text-mg-gold/50" />
                        <p>Aguardando eventos da campanha...</p>
                    </div>
                ) : (
                    <div className="space-y-1.5">
                        {logs.map((log) => {
                            const time = new Date(log.created_at).toLocaleTimeString([], { hour12: false });
                            return (
                                <div key={log.id} className="flex items-start gap-2 animate-fade-in group">
                                    <span className="text-mg-muted/50 mt-0.5 flex-shrink-0">[{time}]</span>
                                    <div className="mt-0.5 flex-shrink-0">{getLevelIcon(log.level)}</div>
                                    <span className={`${getLevelColor(log.level)} break-words leading-relaxed`}>
                                        {log.message}
                                    </span>
                                </div>
                            );
                        })}
                        <div ref={logsEndRef} />
                    </div>
                )}
            </div>

            {/* Footer Action */}
            {status === 'CONCLUIDO' && (
                <div className="p-3 border-t border-mg-border bg-mg-surface flex justify-end">
                    <Link to={toAbs('leads')} className="btn-secondary text-xs py-1.5">
                        <PlayCircle className="w-3.5 h-3.5 mr-1.5" />
                        Ver leads encontrados
                    </Link>
                </div>
            )}
        </div>
    );
}
