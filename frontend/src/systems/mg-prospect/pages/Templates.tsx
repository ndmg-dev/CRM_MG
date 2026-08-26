import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Mail, Save, FileText, Loader2, Code2, Monitor, Smartphone, Code } from 'lucide-react';
import logoMendonca from '../assets/logo.png';

export function Templates() {
    const [templates, setTemplates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // UI states
    const [viewMode, setViewMode] = useState<'editor' | 'preview-desktop' | 'preview-mobile' | 'html'>('editor');

    // Estados do formulário
    const [name, setName] = useState('Apresentação Contábil B2B Premium');
    const [subject, setSubject] = useState('Uma ideia para a {nome_empresa}');
    const [body, setBody] = useState(`Olá, tudo bem?

Somos a Mendonça Galvão Contadores Associados, um escritório de contabilidade com sede em Petrolina, PE.

Encontramos a {nome_empresa} enquanto pesquisávamos empresas de {segmento} na região de {cidade}/{estado}. Nos chamou atenção o trabalho de vocês, e gostaríamos de saber como está a parte contábil e fiscal do negócio.

Sabemos que, no dia a dia, a prioridade de quem empreende é fazer o negócio crescer. Questões como tributos, obrigações acessórias e folha de pagamento acabam ficando em segundo plano, e é justamente aí que entra o nosso trabalho.

Cuidamos de toda a estrutura contábil para que você possa focar no que realmente importa. Algumas das frentes em que atuamos:

• Abertura e regularização de empresas
• Gestão fiscal e tributária completa
• Folha de pagamento e obrigações trabalhistas
• Planejamento tributário para redução legal de impostos
• Atendimento próximo, com pessoas reais dedicadas à sua empresa

<div class="divider"></div>

Gostaríamos de propor uma conversa rápida, sem compromisso, para entender melhor a realidade da {nome_empresa} e avaliar se faz sentido trabalharmos juntos.

<div class="cta-container">
    <a href="{link_formulario_interesse}" class="cta-button">Agendar uma conversa</a>
</div>

<p style="text-align: center; margin-top: 30px; font-size: 14px; color: #718096;">
    <a href="{link_instagram}" style="color: #D4AF37; margin-right: 15px;">Nosso Instagram</a> |
    <a href="{link_whatsapp}" style="color: #D4AF37; margin-left: 15px;">Fale pelo WhatsApp</a>
</p>

<p style="font-size: 14px; color: #718096;">Atenciosamente,<br><strong style="color: #2D3748;">Equipe Mendonça Galvão</strong><br>Contadores Associados</p>`);

    const availableVariables = [
        '{nome_empresa}', '{cidade}', '{estado}', '{segmento}',
        '{telefone}', '{website}', '{nome_campanha}', '{link_instagram}',
        '{link_formulario_interesse}', '{link_whatsapp}', '{unsubscribe_url}'
    ];

    async function fetchTemplates() {
        try {
            const response = await api.get('/emails');
            setTemplates(response.data);
        } catch (error) {
            console.error("Erro ao buscar templates:", error);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchTemplates();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.post('/emails', { name, subject, html_body: body });
            fetchTemplates();
            alert("Modelo salvo com sucesso!");
        } catch {
            alert("Erro ao salvar template.");
        } finally {
            setSaving(false);
        }
    };

    const insertVariable = (variable: string) => {
        setBody(prev => prev + variable);
    };

    // Helper to generate the preview HTML
    const getPreviewHtml = () => {
        let content = body;

        // Substituir variáveis mockadas
        const mockedData: Record<string, string> = {
            '{nome_empresa}': 'Farmácia Extra Popular',
            '{cidade}': 'Petrolina',
            '{estado}': 'PE',
            '{segmento}': 'Farmácia',
            '{telefone}': '(87) 3864-0024',
            '{website}': 'www.extrapopular.com.br',
            '{nome_campanha}': 'Campanha Teste',
            '{link_instagram}': 'https://www.instagram.com/mendoncagalvaoo/',
            '{link_formulario_interesse}': '#',
            '{link_whatsapp}': '#',
            '{unsubscribe_url}': '#'
        };

        for (const [key, value] of Object.entries(mockedData)) {
            content = content.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
        }

        // Normalizar line endings
        content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        // Processar o conteúdo: separar blocos HTML existentes de texto puro
        // Dividir por blocos HTML (div, p, a com style, etc.) preservando-os
        const htmlBlockRegex = /(<div[\s\S]*?<\/div>|<p[\s\S]*?<\/p>)/gi;
        const parts = content.split(htmlBlockRegex);

        const processedParts = parts.map(part => {
            // Se é um bloco HTML, preservar como está
            if (part.match(/^<(div|p)\s/i)) {
                return part;
            }
            // Se é texto puro, converter \n\n em parágrafos e \n em <br>
            const paragraphs = part.split('\n\n').filter(p => p.trim());
            if (paragraphs.length === 0) return '';

            return paragraphs.map(para => {
                // Detectar se é uma lista de bullet points
                const lines = para.split('\n');
                const bulletLines = lines.filter(l => l.trim().startsWith('•'));

                if (bulletLines.length > 1) {
                    // É uma lista — separar título (se houver) dos itens
                    const titleLines = lines.filter(l => !l.trim().startsWith('•') && l.trim());
                    const items = bulletLines.map(l => `<li>${l.trim().substring(1).trim()}</li>`).join('');
                    const title = titleLines.length > 0
                        ? `<p>${titleLines.map(l => l.trim()).join('<br>')}</p>`
                        : '';
                    return `${title}<ul>${items}</ul>`;
                }

                // Parágrafo normal
                return `<p>${para.replace(/\n/g, '<br>')}</p>`;
            }).join('');
        });

        content = processedParts.join('');

        return `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <style>
                    body { margin: 0; padding: 0; background-color: #F8F9FA; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #2D3748; -webkit-font-smoothing: antialiased; }
                    .container { max-width: 600px; margin: 40px auto; background-color: #FFFFFF; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border-top: 4px solid #D4AF37; }
                    .header { text-align: center; padding: 30px 20px; background-color: #1A202C; }
                    .header img { max-width: 180px; height: auto; }
                    .content { padding: 40px 35px; font-size: 15px; line-height: 1.8; color: #4A5568; text-align: justify; }
                    .content p { margin: 0 0 18px 0; }
                    .content ul { margin: 8px 0 20px 0; padding-left: 0; list-style: none; }
                    .content ul li { padding: 6px 0 6px 24px; position: relative; color: #4A5568; }
                    .content ul li::before { content: ''; position: absolute; left: 4px; top: 14px; width: 8px; height: 8px; background: #D4AF37; border-radius: 50%; }
                    .cta-container { text-align: center; margin: 30px 0; }
                    .cta-button { display: inline-block; background-color: #D4AF37; color: #1A202C !important; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: bold; font-size: 15px; letter-spacing: 0.3px; }
                    .divider { height: 1px; background: linear-gradient(to right, transparent, #D4AF37, transparent); margin: 28px 0; }
                    .footer { background-color: #F1F5F9; padding: 24px 30px; text-align: center; font-size: 12px; color: #718096; }
                    .footer a { color: #D4AF37; text-decoration: none; }
                    .footer p { margin: 6px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <img src="${logoMendonca}" alt="Mendonça Galvão Contadores Associados" style="max-width: 180px; height: auto;" />
                    </div>
                    <div class="content">
                        ${content}
                    </div>
                    <div class="footer">
                        <p>Mendonça Galvão Contadores Associados<br>Petrolina - PE</p>
                        <p>Contato institucional enviado para apresentação de serviços contábeis.</p>
                        <p>Caso não queira receber novos contatos, <a href="#">clique aqui para descadastrar</a>.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-mg-text flex items-center gap-2">
                    <Mail className="w-6 h-6 text-mg-gold" />
                    Modelos de E-mail Premium
                </h2>
                <div className="flex bg-mg-surface rounded-premium p-1 border border-mg-border">
                    <button onClick={() => setViewMode('editor')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${viewMode === 'editor' ? 'bg-mg-gold text-mg-bg' : 'text-mg-muted hover:text-mg-text'}`}>
                        <FileText className="w-4 h-4" /> Editor
                    </button>
                    <button onClick={() => setViewMode('preview-desktop')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${viewMode === 'preview-desktop' ? 'bg-mg-gold text-mg-bg' : 'text-mg-muted hover:text-mg-text'}`}>
                        <Monitor className="w-4 h-4" /> Desktop
                    </button>
                    <button onClick={() => setViewMode('preview-mobile')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${viewMode === 'preview-mobile' ? 'bg-mg-gold text-mg-bg' : 'text-mg-muted hover:text-mg-text'}`}>
                        <Smartphone className="w-4 h-4" /> Mobile
                    </button>
                    <button onClick={() => setViewMode('html')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${viewMode === 'html' ? 'bg-mg-gold text-mg-bg' : 'text-mg-muted hover:text-mg-text'}`}>
                        <Code className="w-4 h-4" /> HTML
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Área Principal (Editor ou Preview) */}
                <div className="lg:col-span-3">
                    {viewMode === 'editor' ? (
                        <div className="card-premium">
                            <form onSubmit={handleSave} className="space-y-5">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="label-premium">Nome do Modelo (Interno)</label>
                                        <input
                                            type="text" required value={name} onChange={(e) => setName(e.target.value)}
                                            className="input-premium"
                                        />
                                    </div>
                                    <div>
                                        <label className="label-premium">Assunto do E-mail</label>
                                        <input
                                            type="text" required value={subject} onChange={(e) => setSubject(e.target.value)}
                                            className="input-premium"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="label-premium flex justify-between">
                                        Corpo do E-mail (HTML ou Texto)
                                    </label>
                                    <textarea
                                        required value={body} onChange={(e) => setBody(e.target.value)} rows={15}
                                        className="input-premium resize-none font-mono text-sm leading-relaxed custom-scrollbar"
                                    />
                                </div>

                                <div className="flex justify-end pt-3 border-t border-mg-border">
                                    <button type="submit" disabled={saving} className="btn-primary">
                                        {saving ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Salvando...
                                            </>
                                        ) : (
                                            <>
                                                <Save className="w-4 h-4" />
                                                Salvar Modelo
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    ) : viewMode === 'html' ? (
                        <div className="card-premium h-[600px] flex flex-col">
                            <label className="label-premium mb-2">HTML Final Renderizado</label>
                            <textarea
                                readOnly value={getPreviewHtml()}
                                className="w-full flex-1 input-premium font-mono text-xs text-mg-muted/70 bg-black/50 custom-scrollbar"
                            />
                        </div>
                    ) : (
                        <div className="bg-[#E2E8F0] rounded-xl p-8 flex items-center justify-center min-h-[700px]">
                            <div className={`bg-white shadow-2xl transition-all duration-300 overflow-hidden ${viewMode === 'preview-mobile' ? 'w-[375px] h-[667px] rounded-3xl border-[12px] border-gray-900' : 'w-[800px] h-[650px] rounded-md border border-gray-300'}`}>
                                <iframe
                                    srcDoc={getPreviewHtml()}
                                    className="w-full h-full bg-white border-0"
                                    title="Email Preview"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Variáveis */}
                    <div className="card-surface">
                        <h3 className="section-title mb-4">
                            <Code2 className="w-4 h-4 text-mg-gold" />
                            Variáveis
                        </h3>
                        <p className="text-2xs text-mg-muted mb-4">
                            Clique para inserir no texto:
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {availableVariables.map(v => (
                                <button
                                    key={v}
                                    type="button"
                                    onClick={() => insertVariable(v)}
                                    className="text-xs px-2.5 py-1 bg-mg-bg hover:bg-mg-gold/10 text-mg-gold rounded border border-mg-border/50 hover:border-mg-gold/30 transition-colors"
                                >
                                    {v}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Modelos salvos */}
                    <div className="card-surface">
                        <h3 className="section-title mb-4">
                            <Mail className="w-4 h-4 text-mg-gold" />
                            Modelos Salvos
                        </h3>
                        {loading ? (
                            <div className="space-y-2.5">
                                {[...Array(3)].map((_, i) => (
                                    <div key={i} className="skeleton h-12 rounded-premium" />
                                ))}
                            </div>
                        ) : templates.length === 0 ? (
                            <div className="flex flex-col items-center py-6 text-center">
                                <FileText className="w-5 h-5 text-mg-muted/40 mb-2" />
                                <p className="text-sm text-mg-muted">Nenhum modelo salvo</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {templates.map(tpl => (
                                    <div
                                        key={tpl.id}
                                        onClick={() => {
                                            setName(tpl.name);
                                            setSubject(tpl.subject);
                                            setBody(tpl.html_body);
                                            setViewMode('editor');
                                        }}
                                        className="flex items-center p-3 bg-mg-bg border border-mg-border/50 rounded-premium cursor-pointer hover:border-mg-borderbold hover:shadow-cardhover transition-all group"
                                    >
                                        <FileText className="w-4 h-4 text-mg-muted mr-3 group-hover:text-mg-gold transition-colors" />
                                        <span className="text-sm font-medium truncate group-hover:text-mg-gold transition-colors">{tpl.name}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
