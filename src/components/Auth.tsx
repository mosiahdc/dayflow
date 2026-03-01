import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function Auth() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLogin, setIsLogin] = useState(true);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handle = async () => {
        setLoading(true);
        setError('');
        const fn = isLogin
            ? supabase.auth.signInWithPassword({ email, password })
            : supabase.auth.signUp({ email, password });
        const { error: err } = await fn;
        if (err) setError(err.message);
        setLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-brand-bg dark:bg-brand-dark">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg w-full max-w-sm">
                <h1 className="text-2xl font-bold text-brand-dark dark:text-white mb-6">
                    DayFlow
                </h1>
                <input
                    className="w-full border rounded-lg px-3 py-2 mb-3 text-sm dark:bg-gray-700 dark:text-white dark:border-gray-600"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />
                <input
                    className="w-full border rounded-lg px-3 py-2 mb-3 text-sm dark:bg-gray-700 dark:text-white dark:border-gray-600"
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handle()}
                />
                {error && <p className="text-red-500 text-xs mb-3">{error}</p>}
                <button
                    onClick={handle}
                    disabled={loading}
                    className="w-full bg-brand-accent text-white rounded-lg py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                >
                    {loading ? 'Please wait…' : isLogin ? 'Sign In' : 'Sign Up'}
                </button>
                <p className="text-center text-xs text-brand-muted mt-4">
                    {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
                    <button
                        className="text-brand-accent hover:underline"
                        onClick={() => setIsLogin(!isLogin)}
                    >
                        {isLogin ? 'Sign Up' : 'Sign In'}
                    </button>
                </p>
            </div>
        </div>
    );
}