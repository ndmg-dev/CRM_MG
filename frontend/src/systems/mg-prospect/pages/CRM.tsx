import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Building2, GripVertical, Phone, Globe, Star, Users } from 'lucide-react';

const STAGES = ['NOVO', 'PROSPECTADO', 'INTERESSADO', 'EM NEGOCIAÇÃO', 'CLIENTE', 'NÃO INTERESSADO'];

const STAGE_COLORS: Record<string, string> = {
    'NOVO': 'border-mg-muted/30',
    'PROSPECTADO': 'border-mg-gold/30',
    'INTERESSADO': 'border-mg-gold/60',
    'EM NEGOCIAÇÃO': 'border-mg-warning/30',
    'CLIENTE': 'border-mg-success/30',
    'NÃO INTERESSADO': 'border-mg-error/30',
};

const STAGE_DOT: Record<string, string> = {
    'NOVO': 'bg-mg-muted',
    'PROSPECTADO': 'bg-mg-gold',
    'INTERESSADO': 'bg-mg-gold shadow-glow',
    'EM NEGOCIAÇÃO': 'bg-mg-warning',
    'CLIENTE': 'bg-mg-success',
    'NÃO INTERESSADO': 'bg-mg-error',
};

export function CRM() {
    const [leads, setLeads] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [dragOverStage, setDragOverStage] = useState<string | null>(null);

    useEffect(() => {
        fetchLeads();
    }, []);

    const fetchLeads = async () => {
        try {
            // CRM needs more leads to show the board properly, limit=1000
            const response = await api.get('/leads?page=1&limit=1000');
            // Extract items from the new paginated response structure
            setLeads(response.data.items || []);
        } catch (error) {
            console.error('Erro ao buscar leads:', error);
            setLeads([]);
        } finally {
            setLoading(false);
        }
    };

    const handleDragStart = (e: React.DragEvent, leadId: number) => {
        e.dataTransfer.setData('leadId', leadId.toString());
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, stage: string) => {
        e.preventDefault();
        setDragOverStage(stage);
    };

    const handleDragLeave = () => {
        setDragOverStage(null);
    };

    const handleDrop = async (e: React.DragEvent, newStatus: string) => {
        e.preventDefault();
        setDragOverStage(null);
        const leadId = e.dataTransfer.getData('leadId');

        if (!leadId) return;

        setLeads(prevLeads =>
            prevLeads.map(lead =>
                lead.id.toString() === leadId ? { ...lead, status: newStatus } : lead
            )
        );

        try {
            await api.patch(`/leads/${leadId}/stage`, { status: newStatus });
        } catch (error) {
            console.error('Erro ao atualizar status:', error);
            fetchLeads();
        }
    };

    if (loading) {
        return (
            <div className="space-y-6 animate-fade-in">
                <div className="flex overflow-x-auto pb-4 gap-5">
                    {STAGES.map(stage => (
                        <div key={stage} className="flex-shrink-0 w-[300px] bg-mg-surface border border-mg-border rounded-premium-lg p-4">
                            <div className="skeleton h-5 w-32 rounded mb-4" />
                            <div className="space-y-3">
                                <div className="skeleton-card" />
                                <div className="skeleton-card" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col space-y-6 animate-fade-in">
            {/* Kanban Board */}
            <div className="flex-1 flex overflow-x-auto pb-4 gap-5 custom-scrollbar">
                {STAGES.map((stage) => {
                    const columnLeads = leads.filter(lead => lead.status === stage);
                    const isDragOver = dragOverStage === stage;

                    return (
                        <div
                            key={stage}
                            onDragOver={(e) => handleDragOver(e, stage)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, stage)}
                            className={`flex-shrink-0 w-[300px] flex flex-col bg-mg-bg border rounded-premium-lg transition-all duration-200 ${
                                isDragOver
                                    ? 'border-mg-gold/40 shadow-glow'
                                    : 'border-mg-border'
                            }`}
                        >
                            {/* Column Header */}
                            <div className={`p-4 border-b ${STAGE_COLORS[stage]} bg-mg-surface/60 rounded-t-premium-lg flex justify-between items-center`}>
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${STAGE_DOT[stage]}`} />
                                    <h3 className="font-semibold text-sm text-mg-text">{stage}</h3>
                                </div>
                                <span className="px-2 py-0.5 rounded-full text-2xs font-bold bg-mg-elevated text-mg-muted border border-mg-border">
                                    {columnLeads.length}
                                </span>
                            </div>

                            {/* Column Body */}
                            <div className="flex-1 p-3 overflow-y-auto space-y-2.5 min-h-[200px] custom-scrollbar">
                                {columnLeads.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-8 text-center">
                                        <Users className="w-5 h-5 text-mg-muted/40 mb-2" />
                                        <p className="text-2xs text-mg-muted/50">Arraste leads aqui</p>
                                    </div>
                                )}
                                {columnLeads.map((lead) => (
                                    <div
                                        key={lead.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, lead.id)}
                                        className="bg-mg-elevated border border-mg-border p-4 rounded-premium cursor-grab active:cursor-grabbing hover:border-mg-borderbold hover:shadow-cardhover transition-all duration-200 group"
                                    >
                                        <div className="flex items-start justify-between mb-2.5">
                                            <div className="font-medium text-sm text-mg-text leading-tight pr-3 group-hover:text-mg-gold transition-colors">
                                                {lead.name}
                                            </div>
                                            <GripVertical className="w-4 h-4 text-mg-muted/30 group-hover:text-mg-muted cursor-grab flex-shrink-0 transition-colors" />
                                        </div>

                                        <div className="flex items-center text-2xs text-mg-muted mb-3">
                                            <Building2 className="w-3 h-3 mr-1.5" />
                                            <span className="truncate">{lead.category}</span>
                                        </div>

                                        <div className="flex items-center justify-between pt-3 border-t border-mg-border/50">
                                            <div className="flex gap-2">
                                                {lead.phone && (
                                                    <a href={`tel:${lead.phone}`} title={`Ligar: ${lead.phone}`} onClick={e => e.stopPropagation()} className="p-1 rounded bg-mg-surface hover:bg-mg-goldmuted hover:text-mg-gold transition-colors cursor-pointer">
                                                        <Phone className="w-3 h-3 text-mg-muted hover:text-mg-gold transition-colors" />
                                                    </a>
                                                )}
                                                {lead.website && (
                                                    <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noopener noreferrer" title={`Visitar Site: ${lead.website}`} onClick={e => e.stopPropagation()} className="p-1 rounded bg-mg-surface hover:bg-mg-goldmuted hover:text-mg-gold transition-colors cursor-pointer">
                                                        <Globe className="w-3 h-3 text-mg-muted hover:text-mg-gold transition-colors" />
                                                    </a>
                                                )}
                                                {lead.rating && lead.rating >= 4.0 && (
                                                    <span title={`Google Score: ${lead.rating}/5`} className="p-1 rounded bg-mg-surface cursor-help">
                                                        <Star className="w-3 h-3 text-mg-gold fill-mg-gold" />
                                                    </span>
                                                )}
                                            </div>
                                            <span className={`px-2 py-0.5 rounded text-2xs font-bold ${
                                                lead.score >= 70 ? 'text-mg-success bg-mg-success/10' :
                                                lead.score >= 40 ? 'text-mg-gold bg-mg-goldmuted' :
                                                'text-mg-muted bg-mg-surface'
                                            }`}>
                                                {lead.score} pts
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
