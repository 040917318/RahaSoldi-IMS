
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Loader2, Lock, Mail, AlertCircle, CheckCircle, ShieldCheck, User, LayoutDashboard, ChevronRight, Sparkles } from 'lucide-react';
import { UserRole } from '../types';
import { motion, AnimatePresence } from 'motion/react';

const themes = [
  { 
    bg: 'bg-white', 
    surface: 'bg-[#f7f9ff]', 
    primary: 'bg-[#1a73e8]', 
    onPrimary: 'text-white', 
    text: 'text-[#1f1f1f]', 
    subtext: 'text-[#444746]', 
    accent: '#1a73e8',
    field: 'bg-[#f0f2f5]'
  },
  { 
    bg: 'bg-[#fdf8fd]', 
    surface: 'bg-[#f3eff4]', 
    primary: 'bg-[#6750a4]', 
    onPrimary: 'text-white', 
    text: 'text-[#1c1b1f]', 
    subtext: 'text-[#49454f]', 
    accent: '#6750a4',
    field: 'bg-[#eee8f4]'
  },
  { 
    bg: 'bg-[#f8faf7]', 
    surface: 'bg-[#eef2ec]', 
    primary: 'bg-[#386a20]', 
    onPrimary: 'text-white', 
    text: 'text-[#191c18]', 
    subtext: 'text-[#43493f]', 
    accent: '#386a20',
    field: 'bg-[#e7eee1]'
  },
  { 
    bg: 'bg-[#fff8f2]', 
    surface: 'bg-[#f7ece4]', 
    primary: 'bg-[#825500]', 
    onPrimary: 'text-white', 
    text: 'text-[#251a00]', 
    subtext: 'text-[#50452d]', 
    accent: '#825500',
    field: 'bg-[#f5e9d9]'
  },
];

export const Auth: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('cashier');
  const [isSignUp, setIsSignUp] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null);
  const [themeIndex, setThemeIndex] = useState(0);

  useEffect(() => {
    const updateTheme = () => {
      const thirtyMins = 30 * 60 * 1000;
      const currentTick = Math.floor(Date.now() / thirtyMins);
      setThemeIndex(currentTick % themes.length);
    };

    updateTheme();
    const interval = setInterval(updateTheme, 60000);
    return () => clearInterval(interval);
  }, []);

  const theme = themes[themeIndex];

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            data: {
              role: role,
            }
          }
        });
        if (signUpError) throw signUpError;
        setMessage({ text: 'Success! Please check your email to confirm your account.', type: 'success' });
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'An error occurred', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen ${theme.bg} flex flex-col items-center justify-center p-6 transition-colors duration-1000 font-sans`}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-12">
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 15 }}
            className={`inline-flex items-center justify-center w-20 h-20 rounded-[2.5rem] ${theme.primary} shadow-xl mb-6`}
          >
            <LayoutDashboard className="w-10 h-10 text-white" />
          </motion.div>
          <h1 className={`text-4xl font-medium tracking-tight ${theme.text} mb-3`}>
            {isSignUp ? 'Create account' : 'Sign in'}
          </h1>
          <p className={`${theme.subtext} font-normal text-lg`}>
            {isSignUp ? 'Initialize your enterprise profile' : 'Welcome back to Raha Soldi'}
          </p>
        </div>

        <div className={`rounded-[3rem] p-10 ${theme.surface} border border-black/[0.03] shadow-sm`}>
          <form className="space-y-5" onSubmit={handleAuth}>
            <div className="space-y-2">
              <label htmlFor="email" className={`block text-sm font-medium ${theme.subtext} ml-5 mb-1 px-1`}>
                Email address
              </label>
              <div className="relative group">
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`block w-full px-7 py-5 bg-white border border-[#747474] rounded-[2rem] ${theme.text} placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-opacity-30 focus:border-[#1a73e8] transition-all text-lg`}
                  placeholder="name@email.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className={`block text-sm font-medium ${theme.subtext} ml-5 mb-1 px-1`}>
                Password
              </label>
              <div className="relative group">
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`block w-full px-7 py-5 bg-white border border-[#747474] rounded-[2rem] ${theme.text} placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-opacity-30 focus:border-[#1a73e8] transition-all text-lg`}
                  placeholder="Enter password"
                />
              </div>
            </div>

            <AnimatePresence mode="wait">
              {isSignUp && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="space-y-2 overflow-hidden"
                >
                  <label htmlFor="role" className={`block text-sm font-medium ${theme.subtext} ml-5 mb-1 px-1`}>
                    Access Level
                  </label>
                  <div className="relative">
                    <select
                      id="role"
                      value={role}
                      onChange={(e) => setRole(e.target.value as UserRole)}
                      className={`block w-full px-7 py-5 bg-white border border-[#747474] rounded-[2rem] ${theme.text} appearance-none focus:outline-none focus:ring-2 focus:ring-opacity-30 transition-all text-lg`}
                    >
                      <option value="cashier">Standard User</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {message && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`rounded-3xl p-5 flex items-start space-x-3 ${message.type === 'error' ? 'bg-[#ffdad6] text-[#410002]' : 'bg-[#d6f6cf] text-[#002106]'}`}
                >
                  {message.type === 'error' ? <AlertCircle className="w-6 h-6 shrink-0" /> : <CheckCircle className="w-6 h-6 shrink-0" />}
                  <span className="text-sm font-medium leading-relaxed">{message.text}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="pt-8">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading}
                className={`w-full py-5 rounded-[3rem] ${theme.primary} ${theme.onPrimary} font-medium text-lg flex items-center justify-center space-x-3 transition-all shadow-md hover:shadow-xl disabled:opacity-50`}
              >
                {loading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    <span>{isSignUp ? 'Create account' : 'Next'}</span>
                    {!isSignUp && <ChevronRight className="w-5 h-5" />}
                  </>
                )}
              </motion.button>
            </div>
          </form>

          <div className="mt-10 pt-8 border-t border-black/[0.03] flex justify-center">
            <button
              onClick={() => { setIsSignUp(!isSignUp); setMessage(null); }}
              className={`px-8 py-3 rounded-[3rem] border border-[#747474] ${theme.primary.replace('bg-', 'text-')} font-medium hover:bg-black/[0.04] transition-colors`}
            >
              {isSignUp ? 'Sign in instead' : 'Create account'}
            </button>
          </div>
        </div>

        <div className="mt-16 flex justify-center gap-10 text-sm font-medium text-[#444746]">
          <button className="hover:underline">Privacy</button>
          <button className="hover:underline">Terms</button>
          <button className="hover:underline">Help</button>
        </div>
      </motion.div>
    </div>
  );
};

