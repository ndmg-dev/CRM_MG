import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Loader2, KeyRound, Eye, EyeOff } from 'lucide-react';
import { useNativeSystemPath } from '@/hooks/useNativeSystemBase';

export function ResetPassword() {
    const navigate = useNavigate();
    const toAbs = useNativeSystemPath();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Parse URL params
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const email = params.get('email');

    useEffect(() => {
        if (!token || !email) {
            setError('Link de recuperação inválido ou incompleto.');
        }
    }, [token, email]);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!token || !email) {
            setError('Parâmetros inválidos.');
            return;
        }

        if (password !== confirmPassword) {
            setError('As senhas não coincidem.');
            return;
        }

        if (password.length < 6) {
            setError('A senha deve ter no mínimo 6 caracteres.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await api.post('/auth/reset-password', {
                email,
                token,
                new_password: password
            });
            setSuccessMsg(response.data.msg);
            setTimeout(() => {
                navigate(toAbs('login'));
            }, 3000);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Ocorreu um erro ao redefinir a senha.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-mg-bg flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background radial gradient */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-gradient-radial from-mg-gold/[0.04] via-transparent to-transparent" />
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,rgba(201,162,77,0.03)_0%,transparent_50%)]" />
            </div>

            {/* Card */}
            <div className="w-full max-w-[420px] relative animate-fade-in">
                <div className="bg-mg-surface border border-mg-border rounded-premium-xl p-8 md:p-10 shadow-premium-lg relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-[1px] bg-gold-gradient opacity-40" />

                    {/* Header */}
                    <div className="flex flex-col items-center mb-8">
                        <div className="w-14 h-14 rounded-premium bg-gold-gradient items-center justify-center text-mg-bg flex shadow-glow mb-4">
                            <KeyRound className="w-7 h-7" />
                        </div>
                        <h1 className="text-2xl font-bold text-mg-text tracking-tight">
                            Redefinir Senha
                        </h1>
                        <p className="text-mg-muted text-sm mt-1.5 text-center leading-relaxed">
                            Crie uma nova senha para sua conta
                        </p>
                    </div>

                    {error && (
                        <div className="bg-mg-error/10 text-mg-error border border-mg-error/20 px-4 py-3 rounded-premium mb-6 text-sm text-center font-medium animate-fade-in">
                            {error}
                        </div>
                    )}

                    {successMsg ? (
                        <div className="bg-mg-success/10 text-mg-success border border-mg-success/20 px-4 py-6 rounded-premium mb-6 text-sm text-center font-medium animate-fade-in">
                            <p>{successMsg}</p>
                            <p className="mt-2 text-xs opacity-80">Redirecionando para o login...</p>
                        </div>
                    ) : (
                        <form onSubmit={handleReset} className="space-y-5">
                            <div>
                                <label className="label-premium" htmlFor="new-password">
                                    Nova Senha
                                </label>
                                <div className="relative">
                                    <input
                                        id="new-password"
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="input-premium pr-11"
                                        disabled={!token || !email}
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

                            <div>
                                <label className="label-premium" htmlFor="confirm-password">
                                    Confirmar Nova Senha
                                </label>
                                <div className="relative">
                                    <input
                                        id="confirm-password"
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="input-premium pr-11"
                                        disabled={!token || !email}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || !token || !email}
                                className="btn-primary w-full mt-2"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Salvando...
                                    </>
                                ) : (
                                    'Redefinir Senha'
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
