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
    <div className="df-auth-page">
      <section className="df-auth-story">
        <div className="df-auth-brand"><span className="df-brand-mark"><span /></span><b>DayFlow</b></div>
        <div className="df-auth-copy">
          <span className="df-kicker">PLAN · BUILD · REFLECT · GROW</span>
          <h1>A calmer, more intentional way to run your day.</h1>
          <p>One place for planning, habits, fasting, reading, reviews, and disciplined trading.</p>
          <div className="df-auth-points">
            <span>✓ Plan before the day gets noisy</span>
            <span>✓ Build routines you can actually maintain</span>
            <span>✓ Turn data into useful reflection</span>
          </div>
        </div>
        <small>Discipline today. A brighter tomorrow.</small>
      </section>
      <section className="df-auth-panel">
        <div className="df-auth-card">
          <span className="df-kicker">WELCOME TO DAYFLOW</span>
          <h2>{isLogin ? 'Sign in to continue' : 'Create your account'}</h2>
          <p>{isLogin ? 'Pick up where you left off.' : 'Start building your personal operating system.'}</p>
          <label>Email</label>
          <input placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <label>Password</label>
          <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handle()} autoComplete={isLogin ? 'current-password' : 'new-password'} />
          {error && <div className="df-auth-error">{error}</div>}
          <button className="df-auth-submit" onClick={handle} disabled={loading}>{loading ? 'Please wait…' : isLogin ? 'Sign in' : 'Create account'}</button>
          <div className="df-auth-switch">
            {isLogin ? "New to DayFlow?" : 'Already have an account?'}
            <button onClick={() => setIsLogin(!isLogin)}>{isLogin ? 'Create account' : 'Sign in'}</button>
          </div>
        </div>
      </section>
    </div>
  );
}
