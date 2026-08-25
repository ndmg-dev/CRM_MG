import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { LeadDetails } from '../components/LeadDetails';
import { CustomSelect } from '../components/CustomSelect';
import { Search, Filter, Users, MapPin, Star, ArrowUpDown, Zap, ChevronLeft, ChevronRight, List as ListIcon, Radar, Globe2, Building2, Scale, ShoppingCart, Stethoscope, Briefcase, Laptop, Home, Utensils, Car, Coffee, Pill, Circle, UserCheck, MessageSquare, ThumbsUp, ThumbsDown, Target } from 'lucide-react';
import Map, { Marker, NavigationControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

export function Leads() {
    const [leads, setLeads] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedLead, setSelectedLead] = useState<any | null>(null);
    const [viewMode, setViewMode] = useState<'list' | 'radar'>('list');

    // Map Styles matching MapCN options
    const MAP_STYLES = {
        'carto-dark': { name: 'Default (Carto)', url: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json' },
        'osm': { name: 'OpenStreetMap', url: 'https://tiles.openfreemap.org/styles/liberty' },
        'osm-3d': { name: 'OpenStreetMap 3D', url: 'https://tiles.openfreemap.org/styles/liberty' }
    };
    const [mapStyleKey, setMapStyleKey] = useState<keyof typeof MAP_STYLES>('carto-dark');

    // Pagination & Filters State
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [campaignFilter, setCampaignFilter] = useState('');
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [sortBy, setSortBy] = useState<'score' | 'name' | 'created_at'>('score');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [page, setPage] = useState(1);
    const [pageSize] = useState(50);
    const [totalItems, setTotalItems] = useState(0);
    const [totalPages, setTotalPages] = useState(0);

    const fetchLeads = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                page_size: pageSize.toString(),
                sort_by: sortBy,
                sort_order: sortOrder
            });

            if (searchTerm) params.append('search', searchTerm);
            if (statusFilter) params.append('status', statusFilter);
            if (campaignFilter) params.append('campaign_id', campaignFilter);

            const response = await api.get(`/leads?${params.toString()}`);
            setLeads(response.data.items);
            setTotalItems(response.data.total);
            setTotalPages(response.data.total_pages);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Fetch campaigns for the filter dropdown
    useEffect(() => {
        api.get('/campaigns')
            .then(res => setCampaigns(res.data))
            .catch(console.error);
    }, []);

    // Debounce search term changes and trigger fetch
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchLeads();
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm, statusFilter, campaignFilter, sortBy, sortOrder, page]);

    // Reset page when filters change
    useEffect(() => {
        setPage(1);
    }, [searchTerm, statusFilter, campaignFilter, sortBy, sortOrder]);

    const getScoreColor = (score: number) => {
        if (score >= 70) return 'badge-success';
        if (score >= 40) return 'badge-gold';
        return 'badge-neutral';
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

    const toggleSort = (field: 'score' | 'name' | 'created_at') => {
        if (sortBy === field) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortOrder('desc');
        }
    };

    const getCategoryIcon = (category: string) => {
        if (!category) return Building2;

        const cat = category.toLowerCase();
        if (cat.includes('advoga') || cat.includes('direito') || cat.includes('jurídic')) return Scale;
        if (cat.includes('farmácia') || cat.includes('drogaria')) return Pill;
        if (cat.includes('clínica') || cat.includes('médic') || cat.includes('hospital')) return Stethoscope;
        if (cat.includes('mercado') || cat.includes('loja') || cat.includes('comércio')) return ShoppingCart;
        if (cat.includes('tech') || cat.includes('software') || cat.includes('ti')) return Laptop;
        if (cat.includes('imóveis') || cat.includes('imobiliária')) return Home;
        if (cat.includes('restaurante') || cat.includes('lanchonete')) return Utensils;
        if (cat.includes('café') || cat.includes('padaria')) return Coffee;
        if (cat.includes('carro') || cat.includes('oficina') || cat.includes('auto')) return Car;
        if (cat.includes('consultoria') || cat.includes('contabil')) return Briefcase;

        return Building2;
    };

    const handleLeadUpdated = (updatedLead: any) => {
        setLeads(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l));
        setSelectedLead(updatedLead);
    };

    const statusOptions = [
        { value: '', label: 'Todos os status', icon: <Filter className="w-4 h-4" /> },
        { value: 'NOVO', label: 'Novo', icon: <Circle className="w-4 h-4" />, badge: 'Novo', badgeClass: 'bg-mg-info/15 text-mg-info' },
        { value: 'PROSPECTADO', label: 'Prospectado', icon: <UserCheck className="w-4 h-4" />, badge: 'Ativo', badgeClass: 'bg-purple-400/15 text-purple-400' },
        { value: 'EM NEGOCIAÇÃO', label: 'Em Negociação', icon: <MessageSquare className="w-4 h-4" />, badge: 'Quente', badgeClass: 'bg-mg-gold/15 text-mg-gold' },
        { value: 'CLIENTE', label: 'Cliente', icon: <ThumbsUp className="w-4 h-4" />, badge: 'Fechado', badgeClass: 'bg-mg-success/15 text-mg-success' },
        { value: 'NÃO INTERESSADO', label: 'Não Interessado', icon: <ThumbsDown className="w-4 h-4" />, badge: 'Perdido', badgeClass: 'bg-mg-error/15 text-mg-error' },
    ];

    const campaignOptions = [
        { value: '', label: 'Todas as Campanhas', icon: <Target className="w-4 h-4" /> },
        ...campaigns.map(camp => ({
            value: String(camp.id),
            label: camp.name,
            icon: <Target className="w-4 h-4" />,
            badge: camp.status === 'CONCLUIDO' ? '✓' : camp.status === 'RODANDO' ? '⟳' : undefined,
            badgeClass: camp.status === 'CONCLUIDO' ? 'bg-mg-success/15 text-mg-success' : camp.status === 'RODANDO' ? 'bg-mg-gold/15 text-mg-gold' : undefined,
        })),
    ];

    return (
        <div className="space-y-6 animate-fade-in flex flex-col h-full">
            {/* Filters Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-mg-muted" />
                    <input
                        type="text"
                        placeholder="Buscar por nome ou e-mail..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="input-premium pl-10"
                    />
                </div>
                <CustomSelect
                    options={statusOptions}
                    value={statusFilter}
                    onChange={setStatusFilter}
                    placeholder="Todos os status"
                    icon={<Filter className="w-4 h-4" />}
                    minWidth="200px"
                />
                <CustomSelect
                    options={campaignOptions}
                    value={campaignFilter}
                    onChange={setCampaignFilter}
                    placeholder="Todas as Campanhas"
                    icon={<Target className="w-4 h-4" />}
                    searchable={true}
                    minWidth="220px"
                />
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
                {/* View Mode Toggle */}
                <div className="flex bg-mg-surface border border-mg-border rounded-premium p-1">
                    <button
                        onClick={() => setViewMode('list')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                            viewMode === 'list' ? 'bg-mg-gold text-mg-bg' : 'text-mg-muted hover:text-mg-text hover:bg-mg-elevated'
                        }`}
                    >
                        <ListIcon className="w-4 h-4" />
                        Lista
                    </button>
                    <button
                        onClick={() => setViewMode('radar')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                            viewMode === 'radar' ? 'bg-mg-gold text-mg-bg' : 'text-mg-muted hover:text-mg-text hover:bg-mg-elevated'
                        }`}
                    >
                        <Radar className="w-4 h-4" />
                        Radar
                    </button>
                </div>

                {/* Map Style Switcher (only visible in radar mode) */}
                {viewMode === 'radar' && (
                    <div className="relative">
                        <Globe2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-mg-muted" />
                        <select
                            value={mapStyleKey}
                            onChange={(e) => setMapStyleKey(e.target.value as keyof typeof MAP_STYLES)}
                            className="input-premium pl-10 pr-8 appearance-none cursor-pointer min-w-[200px]"
                        >
                            {Object.entries(MAP_STYLES).map(([key, style]) => (
                                <option key={key} value={key}>{style.name}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {/* Content Area */}
            {viewMode === 'list' ? (
                <div className="bg-mg-surface border border-mg-border rounded-premium-lg shadow-card flex-1 flex flex-col overflow-hidden">
                    <div className="overflow-x-auto">
                    <table className="table-premium">
                        <thead>
                            <tr>
                                <th
                                    className="cursor-pointer hover:text-mg-text transition-colors"
                                    onClick={() => toggleSort('name')}
                                >
                                    <span className="flex items-center gap-1.5">
                                        Empresa
                                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                                    </span>
                                </th>
                                <th>Categoria</th>
                                <th>Localização</th>
                                <th>Avaliação</th>
                                <th
                                    className="cursor-pointer hover:text-mg-text transition-colors"
                                    onClick={() => toggleSort('score')}
                                >
                                    <span className="flex items-center gap-1.5">
                                        Score
                                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                                    </span>
                                </th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                [...Array(10)].map((_, i) => (
                                    <tr key={i}>
                                        <td><div className="skeleton-text w-40" /></td>
                                        <td><div className="skeleton-text w-24" /></td>
                                        <td><div className="skeleton-text w-28" /></td>
                                        <td><div className="skeleton-text w-16" /></td>
                                        <td><div className="skeleton-text w-16" /></td>
                                        <td><div className="skeleton-text w-20" /></td>
                                    </tr>
                                ))
                            ) : leads.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="!border-0">
                                        <div className="flex flex-col items-center justify-center py-16 text-center">
                                            <div className="w-14 h-14 rounded-premium-lg bg-mg-elevated flex items-center justify-center mb-4">
                                                <Zap className="w-6 h-6 text-mg-muted" />
                                            </div>
                                            <p className="text-sm font-medium text-mg-muted">Nenhum lead encontrado</p>
                                            <p className="text-xs text-mg-muted/60 mt-1">
                                                {searchTerm ? 'Tente ajustar os filtros de busca' : 'Crie uma campanha para captação automática'}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                leads.map((lead) => (
                                    <tr
                                        key={lead.id}
                                        onClick={() => setSelectedLead(lead)}
                                        className="group"
                                    >
                                        <td>
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-mg-goldmuted flex items-center justify-center flex-shrink-0">
                                                    <Users className="w-3.5 h-3.5 text-mg-gold" />
                                                </div>
                                                <span className="font-medium text-mg-text group-hover:text-mg-gold transition-colors truncate max-w-[200px]">
                                                    {lead.name}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="text-mg-sub capitalize">{lead.category || '—'}</td>
                                        <td>
                                            <span className="flex items-center gap-1.5 text-mg-sub">
                                                <MapPin className="w-3 h-3 text-mg-muted" />
                                                {lead.city ? `${lead.city}/${lead.state || ''}` : '—'}
                                            </span>
                                        </td>
                                        <td>
                                            {lead.rating ? (
                                                <span className="flex items-center gap-1 text-mg-gold text-sm">
                                                    <Star className="w-3 h-3 fill-mg-gold" />
                                                    {lead.rating}
                                                </span>
                                            ) : (
                                                <span className="text-mg-muted">—</span>
                                            )}
                                        </td>
                                        <td>
                                            <span className={getScoreColor(lead.score)}>
                                                {lead.score} pts
                                            </span>
                                        </td>
                                        <td>
                                            <span className={getStatusBadge(lead.status)}>
                                                {lead.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {!loading && totalPages > 0 && (
                    <div className="flex items-center justify-between px-5 py-4 border-t border-mg-border mt-auto">
                        <p className="text-sm text-mg-muted">
                            Mostrando <span className="font-medium text-mg-text">{(page - 1) * pageSize + 1}</span> a{' '}
                            <span className="font-medium text-mg-text">{Math.min(page * pageSize, totalItems)}</span> de{' '}
                            <span className="font-medium text-mg-text">{totalItems}</span> leads
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-2 rounded-lg border border-mg-border text-mg-text disabled:opacity-50 disabled:cursor-not-allowed hover:bg-mg-elevated transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-sm font-medium text-mg-text px-2">
                                {page} / {totalPages}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="p-2 rounded-lg border border-mg-border text-mg-text disabled:opacity-50 disabled:cursor-not-allowed hover:bg-mg-elevated transition-colors"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
                </div>
            ) : (
                /* Radar Map Mode */
                <div className="bg-mg-surface border border-mg-border rounded-premium-lg shadow-card flex-1 flex flex-col overflow-hidden relative min-h-[500px]">
                    <Map
                        key={mapStyleKey}
                        initialViewState={{
                            longitude: leads.find(l => l.longitude)?.longitude || -42.80, // Default to approximate region if no leads
                            latitude: leads.find(l => l.latitude)?.latitude || -9.40,
                            zoom: 12,
                            pitch: mapStyleKey === 'osm-3d' ? 60 : 0,
                            bearing: mapStyleKey === 'osm-3d' ? -15 : 0
                        }}
                        mapStyle={MAP_STYLES[mapStyleKey].url}
                        attributionControl={false}
                    >
                        <NavigationControl position="bottom-right" showCompass={true} />

                        {leads.map(lead => {
                            if (!lead.latitude || !lead.longitude) return null;
                            return (
                                <Marker
                                    key={lead.id}
                                    longitude={lead.longitude}
                                    latitude={lead.latitude}
                                    anchor="bottom"
                                >
                                    <div
                                        className="relative group cursor-pointer"
                                        onClick={() => setSelectedLead(lead)}
                                    >
                                        <div className="absolute -inset-2 bg-mg-gold/30 rounded-full animate-ping" />
                                        <div className="absolute -inset-1 bg-mg-gold/50 rounded-full blur-[2px]" />
                                        <div className="relative bg-mg-bg/90 backdrop-blur p-1.5 rounded-full border border-mg-gold shadow-lg transform transition-transform group-hover:scale-125">
                                            {(() => {
                                                const Icon = getCategoryIcon(lead.category);
                                                return <Icon className="w-4 h-4 text-mg-gold" />;
                                            })()}
                                        </div>

                                        {/* Tooltip on hover */}
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-3 py-1.5 bg-[#0A0C0E]/90 backdrop-blur border border-mg-border rounded-premium opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                            <p className="text-xs font-bold text-mg-text">{lead.name}</p>
                                            <p className="text-[10px] text-mg-gold font-medium">{lead.score} pts</p>
                                        </div>
                                    </div>
                                </Marker>
                            );
                        })}
                    </Map>
                </div>
            )}

            {/* Lead Details Drawer */}
            {selectedLead && (
                <LeadDetails
                    lead={selectedLead}
                    onClose={() => setSelectedLead(null)}
                    onLeadUpdated={handleLeadUpdated}
                />
            )}
        </div>
    );
}
