import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Loader2, LogIn, Eye, EyeOff } from 'lucide-react';
import { AnimatedConstellationBackground } from '../components/backgrounds/AnimatedConstellationBackground';
import logoMendonca from '../assets/logo.png';
import { useNativeSystemBase } from '@/hooks/useNativeSystemBase';

const TOKEN_KEY = 'mgprospect_token';

export function Login() {
    const navigate = useNavigate();
    const base = useNativeSystemBase();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [isForgotPassword, setIsForgotPassword] = useState(false);

    if (localStorage.getItem(TOKEN_KEY)) {
        // Caminho absoluto (rota índice) — ver comentário em
        // hooks/useNativeSystemBase.ts.
        return <Navigate to={base} replace />;
    }

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccessMsg('');

        try {
            const formData = new URLSearchParams();
            formData.append('username', email);
            formData.append('password', password);

            const response = await api.post('/auth/login', formData);
            localStorage.setItem(TOKEN_KEY, response.data.access_token);
            // Original fazia reload completo (window.location.href = '/');
            // aqui usamos navigate + replace, igual ao padrão do Ponto Admin,
            // pra evitar reload da SPA inteira do CRM.
            navigate(base, { replace: true });
        } catch {
            setError('E-mail ou senha inválidos.');
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        if (!email) return;
        setLoading(true);
        setError('');
        setSuccessMsg('');

        try {
            const response = await api.post('/auth/forgot-password', { email });
            setSuccessMsg(response.data.msg);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Erro ao processar solicitação.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-mg-bg flex items-center justify-center p-4 relative overflow-hidden">
            <AnimatedConstellationBackground />

            {/* Login Card */}
            <div className="w-full max-w-[420px] relative animate-fade-in z-10">
                <div className="bg-[#0B0D10]/95 backdrop-blur-md border border-mg-gold/20 rounded-premium-xl p-8 md:p-10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] relative overflow-hidden group">
                    {/* Top gold line accent & Glow */}
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-gold-gradient opacity-60" />
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-4 bg-mg-gold/20 blur-xl rounded-full" />

                    {/* Subtle inner radial gradient */}
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(201,162,77,0.05)_0%,transparent_70%)] pointer-events-none" />

                    {/* Logo */}
                    <div className="flex flex-col items-center mb-8 relative z-10">
                        <img
                            src={logoMendonca}
                            alt="Mendonça Galvão Contadores Associados"
                            className="w-full max-w-[160px] max-h-[80px] object-contain mb-6 mx-auto drop-shadow-md"
                        />

                        <h1 className="text-2xl font-bold text-mg-text mt-2 tracking-tight text-center">
                            MG Prospect AI
                        </h1>
                        <p className="text-mg-muted text-sm mt-1.5 text-center leading-relaxed">
                            Inteligência comercial para prospecção contábil
                        </p>
                    </div>

                    {/* Error message */}
                    {error && (
                        <div className="relative z-10 bg-mg-error/10 text-mg-error border border-mg-error/20 px-4 py-3 rounded-premium mb-6 text-sm text-center font-medium animate-fade-in">
                            {error}
                        </div>
                    )}

                    {/* Success message */}
                    {successMsg && (
                        <div className="relative z-10 bg-mg-success/10 text-mg-success border border-mg-success/20 px-4 py-3 rounded-premium mb-6 text-sm text-center font-medium animate-fade-in">
                            {successMsg}
                        </div>
                    )}

                    {/* Form */}
                    <div className="relative z-10">
                        {isForgotPassword ? (
                            <div className="space-y-5 animate-slide-in-right">
                                <p className="text-sm text-mg-muted text-center mb-6">
                                    Digite seu e-mail abaixo e enviaremos instruções para redefinir sua senha.
                                </p>
                                <div>
                                    <label className="label-premium" htmlFor="forgot-email">
                                        E-mail
                                    </label>
                                    <input
                                        id="forgot-email"
                                        type="text"
                                        required
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        placeholder="seu@email.com.br"
                                        className="input-premium bg-mg-bg/80 focus:bg-mg-bg transition-colors"
                                        autoComplete="email"
                                    />
                                </div>

                                <div className="flex flex-col gap-3 mt-2">
                                    <button
                                        type="button"
                                        onClick={handleForgotPassword}
                                        disabled={loading || !email}
                                        className="btn-primary w-full"
                                    >
                                        {loading ? (
                                            <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                                        ) : (
                                            'Enviar Link de Recuperação'
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsForgotPassword(false);
                                            setError('');
                                            setSuccessMsg('');
                                        }}
                                        className="btn-secondary w-full border-mg-border/50 hover:border-mg-gold/30"
                                    >
                                        Voltar para o Login
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleLogin} className="space-y-5 animate-fade-in">
                                <div>
                                    <label className="label-premium" htmlFor="login-email">
                                        E-mail
                                    </label>
                                    <input
                                        id="login-email"
                                        type="text"
                                        required
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        placeholder="seu@email.com.br"
                                        className="input-premium bg-mg-bg/80 focus:bg-mg-bg transition-colors"
                                        autoComplete="email"
                                    />
                                </div>

                                <div>
                                    <div className="flex items-center justify-between">
                                        <label className="label-premium mb-0" htmlFor="login-password">
                                            Senha
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsForgotPassword(true);
                                                setError('');
                                                setSuccessMsg('');
                                            }}
                                            className="text-xs text-mg-gold hover:text-mg-goldmuted transition-colors font-medium mb-1.5"
                                        >
                                            Esqueceu a senha?
                                        </button>
                                    </div>
                                    <div className="relative">
                                        <input
                                            id="login-password"
                                            type={showPassword ? 'text' : 'password'}
                                            required
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                            placeholder="••••••••"
                                            className="input-premium pr-11 bg-mg-bg/80 focus:bg-mg-bg transition-colors"
                                            autoComplete="current-password"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-mg-muted hover:text-mg-text transition-colors p-1"
                                            tabIndex={-1}
                                        >
                                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="btn-primary w-full mt-2 group"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Autenticando...
                                        </>
                                    ) : (
                                        <>
                                            <LogIn className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                                            Entrar no Sistema
                                        </>
                                    )}
                                </button>
                            </form>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-mg-muted/60 text-xs mt-6 tracking-wide">
                    Mendonça Galvão Contadores Associados
                </p>
            </div>
        </div>
    );
}
