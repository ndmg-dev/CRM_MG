import { useState, useEffect } from 'react';
import { api } from '../lib/api';

import Map, { Marker, NavigationControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
    X, Building2, MapPin, Star, Phone, Globe, Mail, ShieldCheck,
    ExternalLink, RefreshCw, Clock, CheckCircle2, AlertCircle,
    Navigation, XCircle, Loader2
} from 'lucide-react';

interface LeadDetailsProps {
    lead: any;
    onClose: () => void;
    onLeadUpdated?: (lead: any) => void;
}

export function LeadDetails({ lead: rawLead, onClose, onLeadUpdated }: LeadDetailsProps) {
    const [refreshing, setRefreshing] = useState(false);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Email Modal State
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [templates, setTemplates] = useState<any[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [previewData, setPreviewData] = useState<any>(null);
    const [sendingEmail, setSendingEmail] = useState(false);

    const showToast = (type: 'success' | 'error', message: string) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 4000);
    };

    // Fetch templates when modal opens
    useEffect(() => {
        if (showEmailModal && templates.length === 0) {
            api.get('/emails').then(res => setTemplates(res.data)).catch(console.error);
        }
    }, [showEmailModal, templates.length]);

    // Fetch preview when template changes
    useEffect(() => {
        if (selectedTemplateId && rawLead) {
            setPreviewData(null);
            api.post('/emails/preview', {
                lead_id: rawLead.id,
                template_id: parseInt(selectedTemplateId)
            }).then(res => setPreviewData(res.data)).catch(() => showToast('error', 'Erro ao carregar preview do e-mail.'));
        } else {
            setPreviewData(null);
        }
    }, [selectedTemplateId, rawLead]);

    // Fetch fresh lead data when drawer opens (ensures newly discovered emails appear)
    const [freshLead, setFreshLead] = useState<any>(null);
    useEffect(() => {
        if (rawLead?.id) {
            api.get(`/leads/${rawLead.id}`)
                .then(res => {
                    setFreshLead(res.data);
                    if (onLeadUpdated) onLeadUpdated(res.data);
                })
                .catch(() => setFreshLead(null));
        }
    }, [rawLead?.id]);

    const activeLead = freshLead || rawLead;

    if (!activeLead) return null;

    // Normalize lead data to handle schema variations and avoid crashes
    const lead = {
        ...activeLead,
        name: activeLead.name || 'Empresa não identificada',
        category: activeLead.category || activeLead.business_type || '—',
        phone: activeLead.phone || activeLead.phone_number || activeLead.international_phone || null,
        email: activeLead.email || null,
        website: activeLead.website || activeLead.site || null,
        address: activeLead.address || activeLead.formatted_address || null,
        rating: activeLead.rating ?? activeLead.google_rating ?? null,
        review_count: activeLead.review_count ?? activeLead.user_ratings_total ?? null,
        score: activeLead.score ?? 0,
        status: activeLead.status || 'NOVO',
        google_maps_url: activeLead.google_maps_url || activeLead.maps_url || null,
        city: activeLead.city || null,
        state: activeLead.state || null,
        place_id: activeLead.place_id || null,
        do_not_contact: activeLead.do_not_contact || false,
        business_status: activeLead.business_status || null,
        opening_hours: activeLead.opening_hours || null
    };

    const handleSendEmail = async () => {
        setSendingEmail(true);
        try {
            await api.post('/emails/send', {
                lead_id: lead.id,
                template_id: parseInt(selectedTemplateId)
            });
            showToast('success', 'E-mail enviado com sucesso!');
            onLeadUpdated?.({ ...lead, status: 'PROSPECTADO' });
            setTimeout(() => setShowEmailModal(false), 2000);
        } catch (err: any) {
            showToast('error', err.response?.data?.detail || 'Erro ao enviar e-mail.');
        } finally {
            setSendingEmail(false);
        }
    };

    const handleRefreshGoogle = async () => {
        if (!lead.place_id) {
            showToast('error', 'Lead sem place_id — não é possível atualizar via Google.');
            return;
        }
        setRefreshing(true);
        try {
            const response = await api.post(`/leads/${lead.id}/refresh-google-data`);
            onLeadUpdated?.(response.data);
            showToast('success', 'Dados atualizados com sucesso!');
        } catch {
            showToast('error', 'Erro ao atualizar dados do Google.');
        } finally {
            setRefreshing(false);
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 70) return 'text-mg-success';
        if (score >= 40) return 'text-mg-gold';
        return 'text-mg-muted';
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'NOVO': return 'badge-neutral';
            case 'PROSPECTADO': return 'badge-gold';
            case 'EM NEGOCIAÇÃO': return 'badge-warning';
            case 'CLIENTE': return 'badge-success';
            case 'NÃO INTERESSADO': return 'badge-error';
            default: return 'badge-neutral';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div
                className="w-full max-w-[480px] bg-mg-bg border-l border-mg-border h-full flex flex-col shadow-premium-lg animate-slide-in-right"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-mg-border bg-mg-surface relative">
                    <div className="absolute top-0 left-0 right-0 h-[1px] bg-gold-gradient opacity-30" />
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2.5 bg-mg-goldmuted text-mg-gold rounded-premium flex-shrink-0 icon-glow">
                            <Building2 className="w-5 h-5 relative z-10" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-semibold text-lg text-mg-text leading-tight truncate">{lead.name}</h3>
                            <p className="text-sm text-mg-muted capitalize">{lead.category}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-mg-muted hover:text-mg-text hover:bg-mg-elevated rounded-premium transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

                    {/* Status & Score */}
                    <div className="flex items-center justify-between bg-mg-surface p-4 rounded-premium-lg border border-mg-border">
                        <div>
                            <p className="section-title mb-2">Status</p>
                            <span className={getStatusBadge(lead.status || 'NOVO')}>
                                {lead.status || 'NOVO'}
                            </span>
                        </div>
                        <div className="text-right">
                            <p className="section-title mb-2">Lead Score</p>
                            <span className={`text-2xl font-bold ${getScoreColor(lead.score || 0)}`}>
                                {lead.score || 0}
                                <span className="text-sm font-medium ml-1 opacity-60">pts</span>
                            </span>
                        </div>
                    </div>

                    {/* Contact Data */}
                    <div>
                        <h4 className="section-title mb-3">
                            <ShieldCheck className="w-4 h-4 text-mg-gold" />
                            Dados de Contato
                        </h4>
                        <div className="space-y-2.5">
                            <ContactRow
                                icon={<Phone className="w-4 h-4" />}
                                value={lead.phone || lead.international_phone}
                                fallback="Não informado pela fonte"
                                href={lead.phone ? `tel:${lead.phone}` : undefined}
                            />
                            <ContactRow
                                icon={<Mail className="w-4 h-4" />}
                                value={lead.email}
                                fallback="Não informado pela fonte"
                                href={lead.email ? `mailto:${lead.email}` : undefined}
                            />
                            <ContactRow
                                icon={<Globe className="w-4 h-4" />}
                                value={lead.website}
                                fallback="Sem site cadastrado"
                                href={lead.website || undefined}
                                isLink
                            />
                        </div>
                    </div>

                    {/* Location */}
                    <div>
                        <h4 className="section-title mb-3">
                            <MapPin className="w-4 h-4 text-mg-gold" />
                            Localização
                        </h4>
                        <div className="space-y-2.5">
                            <div className="flex items-start p-3.5 bg-mg-surface border border-mg-border rounded-premium">
                                <MapPin className="w-4 h-4 text-mg-muted mr-3 mt-0.5 flex-shrink-0" />
                                <div>
                                    {lead.address ? (
                                        <span className="text-sm text-mg-text">{lead.address}</span>
                                    ) : (
                                        <span className="text-sm text-mg-text capitalize">
                                            {lead.city && lead.state ? `${lead.city}, ${lead.state}` : 'Não informado pela fonte'}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Mini Mapa */}
                            {lead.latitude && lead.longitude && (
                                <div className="mt-4 rounded-premium overflow-hidden border border-mg-border/50 h-[200px] relative shadow-inner">
                                    <Map
                                        initialViewState={{
                                            longitude: lead.longitude,
                                            latitude: lead.latitude,
                                            zoom: 15
                                        }}
                                        mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
                                        attributionControl={false}
                                    >
                                        <NavigationControl position="bottom-right" showCompass={false} />
                                        <Marker longitude={lead.longitude} latitude={lead.latitude} anchor="bottom">
                                            <div className="relative group cursor-pointer">
                                                {/* Pulse effect */}
                                                <div className="absolute -inset-2 bg-mg-gold/20 rounded-full animate-ping" />
                                                <div className="absolute -inset-1 bg-mg-gold/40 rounded-full blur-sm" />
                                                {/* Pin body */}
                                                <div className="relative bg-mg-bg p-1.5 rounded-full border-2 border-mg-gold shadow-lg transform transition-transform group-hover:scale-110">
                                                    <Building2 className="w-4 h-4 text-mg-gold" />
                                                </div>
                                            </div>
                                        </Marker>
                                    </Map>
                                    <div className="absolute bottom-2 left-2 bg-[#0A0C0E]/80 backdrop-blur-sm px-2 py-1 border border-mg-border/50 rounded text-[10px] text-mg-muted pointer-events-none">
                                        OpenStreetMap contributors
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Google Intelligence */}
                    <div>
                        <h4 className="section-title mb-3">
                            <Star className="w-4 h-4 text-mg-gold" />
                            Inteligência Google
                        </h4>
                        <div className="grid grid-cols-2 gap-2.5">
                            <div className="p-3.5 bg-mg-surface border border-mg-border rounded-premium text-center">
                                <div className="flex items-center justify-center gap-1 mb-1">
                                    <Star className="w-3.5 h-3.5 text-mg-gold fill-mg-gold" />
                                    <span className="text-lg font-bold text-mg-text">
                                        {lead.rating || '—'}
                                    </span>
                                </div>
                                <p className="text-2xs text-mg-muted">Avaliação</p>
                            </div>
                            <div className="p-3.5 bg-mg-surface border border-mg-border rounded-premium text-center">
                                <span className="text-lg font-bold text-mg-text block mb-1">
                                    {lead.review_count || '—'}
                                </span>
                                <p className="text-2xs text-mg-muted">Avaliações</p>
                            </div>
                        </div>

                        {lead.business_status && (
                            <div className="mt-2.5 flex items-center p-3 bg-mg-surface border border-mg-border rounded-premium">
                                {lead.business_status === 'OPERATIONAL' ? (
                                    <CheckCircle2 className="w-4 h-4 text-mg-success mr-3" />
                                ) : (
                                    <AlertCircle className="w-4 h-4 text-mg-warning mr-3" />
                                )}
                                <span className="text-sm text-mg-text">
                                    {lead.business_status === 'OPERATIONAL' ? 'Em operação' : lead.business_status}
                                </span>
                            </div>
                        )}

                        {lead.opening_hours && (
                            <div className="mt-2.5 flex items-start p-3 bg-mg-surface border border-mg-border rounded-premium">
                                <Clock className="w-4 h-4 text-mg-muted mr-3 mt-0.5 flex-shrink-0" />
                                <span className="text-sm text-mg-sub">{lead.opening_hours}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-5 border-t border-mg-border bg-mg-surface space-y-2.5">
                    <div className="flex gap-2.5">
                        {lead.google_maps_url && (
                            <a
                                href={lead.google_maps_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-secondary flex-1 text-xs"
                            >
                                <Navigation className="w-3.5 h-3.5" />
                                Google Maps
                            </a>
                        )}
                        {lead.website && (
                            <a
                                href={lead.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-secondary flex-1 text-xs"
                            >
                                <ExternalLink className="w-3.5 h-3.5" />
                                Abrir Site
                            </a>
                        )}
                    </div>

                    <button
                        onClick={handleRefreshGoogle}
                        disabled={refreshing || !lead.place_id}
                        className="btn-secondary w-full text-sm"
                    >
                        {refreshing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <RefreshCw className="w-4 h-4" />
                        )}
                        {refreshing ? 'Atualizando...' : 'Atualizar dados do Google'}
                    </button>

                    <button
                        onClick={() => setShowEmailModal(true)}
                        disabled={!lead.email || lead.do_not_contact}
                        className="btn-primary w-full text-sm"
                        title={!lead.email ? 'Lead não possui e-mail' : lead.do_not_contact ? 'Lead marcou não contatar' : ''}
                    >
                        <Mail className="w-4 h-4 mr-2" />
                        Enviar Prospecção (E-mail)
                    </button>
                </div>

                {/* Email Prospect Modal */}
                {showEmailModal && (
                    <div className="absolute inset-0 bg-mg-bg z-20 flex flex-col">
                        <div className="flex items-center justify-between p-5 border-b border-mg-border bg-mg-surface">
                            <h3 className="font-semibold text-mg-text flex items-center gap-2">
                                <Mail className="w-5 h-5 text-mg-gold" />
                                Nova Prospecção
                            </h3>
                            <button onClick={() => setShowEmailModal(false)} className="p-1.5 text-mg-muted hover:text-mg-text">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
                            <div>
                                <label className="block text-sm font-medium text-mg-sub mb-1">Para:</label>
                                <div className="p-3 bg-mg-surface border border-mg-border rounded-premium text-sm text-mg-text">
                                    {lead.email}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-mg-sub mb-1">Template:</label>
                                <select
                                    className="input-premium w-full"
                                    value={selectedTemplateId}
                                    onChange={e => setSelectedTemplateId(e.target.value)}
                                >
                                    <option value="">Selecione um template...</option>
                                    {templates.map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>

                            {previewData ? (
                                <div className="mt-4 border border-mg-border rounded-premium overflow-hidden bg-mg-surface">
                                    <div className="bg-mg-elevated p-3 border-b border-mg-border">
                                        <p className="text-xs text-mg-muted mb-1">Assunto:</p>
                                        <p className="text-sm font-medium text-mg-text">{previewData.subject}</p>
                                    </div>
                                    <div className="p-4 text-sm text-mg-sub prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: previewData.html_body }} />
                                </div>
                            ) : selectedTemplateId ? (
                                <div className="flex justify-center p-8">
                                    <Loader2 className="w-6 h-6 animate-spin text-mg-gold" />
                                </div>
                            ) : null}
                        </div>

                        <div className="p-5 border-t border-mg-border bg-mg-surface flex gap-3">
                            <button onClick={() => setShowEmailModal(false)} className="btn-secondary flex-1">
                                Cancelar
                            </button>
                            <button
                                onClick={handleSendEmail}
                                disabled={!selectedTemplateId || sendingEmail}
                                className="btn-primary flex-1"
                            >
                                {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enviar E-mail'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Toast */}
                {toast && (
                    <div className={toast.type === 'success' ? 'toast-success' : 'toast-error'}>
                        {toast.type === 'success'
                            ? <CheckCircle2 className="w-4 h-4" />
                            : <XCircle className="w-4 h-4" />
                        }
                        {toast.message}
                    </div>
                )}
            </div>
        </div>
    );
}

function ContactRow({
    icon, value, fallback, href, isLink
}: {
    icon: React.ReactNode;
    value?: string | null;
    fallback: string;
    href?: string;
    isLink?: boolean;
}) {
    return (
        <div className="flex items-center p-3.5 bg-mg-surface border border-mg-border rounded-premium group hover:border-mg-borderbold transition-all">
            <span className="text-mg-muted mr-3 flex-shrink-0">{icon}</span>
            {value ? (
                href ? (
                    <a
                        href={href}
                        target={isLink ? '_blank' : undefined}
                        rel={isLink ? 'noopener noreferrer' : undefined}
                        className={`text-sm truncate ${isLink ? 'text-mg-info hover:underline' : 'text-mg-text hover:text-mg-gold'} transition-colors`}
                    >
                        {value}
                    </a>
                ) : (
                    <span className="text-sm text-mg-text truncate">{value}</span>
                )
            ) : (
                <span className="text-sm text-mg-muted italic">{fallback}</span>
            )}
        </div>
    );
}
