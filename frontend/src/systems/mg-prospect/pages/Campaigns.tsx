import { useState } from 'react';
import { Target, MapPin, Search, Play, CheckCircle2, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { CampaignSearchLogs } from '../components/CampaignSearchLogs';

export function Campaigns() {
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [activeCampaignId, setActiveCampaignId] = useState<number | null>(null);

    // Form states
    const [name, setName] = useState('');
    const [keyword, setKeyword] = useState('');
    const [city, setCity] = useState('Petrolina');
    const [state, setState] = useState('PE');
    const [maxLeads, setMaxLeads] = useState(50);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setSuccess(false);
        setActiveCampaignId(null);

        try {
            const response = await api.post('/campaigns', {
                name,
                keyword,
                target_city: city,
                target_state: state,
                radius_km: 10,
                max_leads: maxLeads
            });

            setSuccess(true);
            setActiveCampaignId(response.data.id);
            setName('');
            setKeyword('');
        } catch (error) {
            console.error("Erro ao criar campanha:", error);
            alert("Erro ao conectar com o servidor.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
            {success && (
                <div className="flex items-center gap-3 bg-mg-success/10 border border-mg-success/20 text-mg-success px-5 py-4 rounded-premium-lg text-sm font-medium animate-fade-in-up">
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                    Campanha iniciada com sucesso! O motor de busca está rodando em background.
                </div>
            )}

            {activeCampaignId && (
                <CampaignSearchLogs campaignId={activeCampaignId} />
            )}

            <div className="card-premium">
                <h3 className="text-lg font-semibold text-mg-text flex items-center gap-2 mb-6">
                    <Target className="w-5 h-5 text-mg-gold" />
                    Nova Campanha de Captação
                </h3>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Nome da Campanha */}
                        <div className="md:col-span-2">
                            <label className="label-premium flex items-center gap-2">
                                <Target className="w-3.5 h-3.5 text-mg-muted" />
                                Nome da Campanha (Interno)
                            </label>
                            <input
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Ex: Clínicas Médicas - Maio 2026"
                                className="input-premium"
                            />
                        </div>

                        {/* Segmento / Palavra-chave */}
                        <div className="md:col-span-2">
                            <label className="label-premium flex items-center gap-2">
                                <Search className="w-3.5 h-3.5 text-mg-muted" />
                                Segmento / Palavra-chave
                            </label>
                            <input
                                type="text"
                                required
                                value={keyword}
                                onChange={(e) => setKeyword(e.target.value)}
                                placeholder="Ex: Restaurantes, Clínicas Odontológicas, Lojas de Roupas..."
                                className="input-premium"
                            />
                        </div>

                        {/* Cidade e Estado */}
                        <div>
                            <label className="label-premium flex items-center gap-2">
                                <MapPin className="w-3.5 h-3.5 text-mg-muted" />
                                Cidade Alvo
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    required
                                    value={city}
                                    onChange={(e) => setCity(e.target.value)}
                                    className="input-premium flex-1"
                                />
                                <input
                                    type="text"
                                    required
                                    value={state}
                                    onChange={(e) => setState(e.target.value)}
                                    maxLength={2}
                                    className="input-premium w-20 uppercase text-center"
                                />
                            </div>
                        </div>

                        {/* Quantidade de Leads */}
                        <div>
                            <label className="label-premium">Limite de Leads</label>
                            <input
                                type="number"
                                required
                                min={10}
                                max={120}
                                value={maxLeads}
                                onChange={(e) => setMaxLeads(Number(e.target.value))}
                                className="input-premium"
                            />
                            <p className="text-2xs text-mg-muted mt-2">Recomendado: máximo de 60 por busca.</p>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-mg-border flex justify-end">
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Processando...
                                </>
                            ) : (
                                <>
                                    <Play className="w-4 h-4" />
                                    Iniciar Captação
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
