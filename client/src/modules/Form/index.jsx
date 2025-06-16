import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Input from '../../components/Input';
import Button from '../../components/Button';

const Form = ({ isSignInPage = true }) => {
  const [data, setData] = useState({
    ...(isSignInPage ? {} : { fullName: '' }),
    email: '',
    password: '',
  });
  const [message, setMessage] = useState({ text: '', type: '' });

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`https://pingora-server.onrender.com/api/${isSignInPage ? 'login' : 'register'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const resData = await res.json();

      if (res.status === 400) {
        setMessage({ text: resData.error, type: 'error' });
      } else if (isSignInPage) {
        if (resData.token) {
          localStorage.setItem('user:token', resData.token);
          localStorage.setItem('user:detail', JSON.stringify(resData.user));
          navigate('/');
        }
      } else {
        // Registration success
        setMessage({ text: resData.message, type: 'success' });
        // Clear form
        setData({
          fullName: '',
          email: '',
          password: '',
        });
        // Redirect to login after 2 seconds
        setTimeout(() => {
          navigate('/users/sign_in');
        }, 2000);
      }
    } catch (error) {
      setMessage({ text: 'An error occurred. Please try again.', type: 'error' });
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 px-4 py-8 relative overflow-hidden">
      {/* Background design */}
      <div className="absolute inset-0 bg-[radial-gradient(rgba(120,119,198,0.2)_1px,transparent_1px)] [background-size:20px_20px] z-0" />
      <div className="absolute inset-0 z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-gradient-to-r from-blue-400/20 to-purple-600/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -right-20 w-[500px] h-[500px] bg-gradient-to-r from-purple-400/15 to-pink-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 w-80 h-80 bg-gradient-to-r from-cyan-400/15 to-blue-600/20 rounded-full blur-3xl" />
      </div>

      {/* Main container */}
      <div className="relative z-10 w-full max-w-7xl mx-auto flex flex-col xl:flex-row items-center justify-between gap-8 xl:gap-12">
        {/* Left content with margin and hover effect on heading */}
        <div className="flex flex-col w-full xl:w-[40%] text-left xl:ml-4">
          <h1 className="text-6xl font-black bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent mb-4 tracking-tight transition duration-300 hover:scale-105 hover:drop-shadow-[0_0_12px_rgba(100,180,255,0.7)]">
            Pingora
          </h1>
          <p className="text-xl text-gray-300 mb-6">Connect, Chat, Create Memories</p>
          <div className="space-y-4">
            {[
              {
                iconColor: 'from-blue-500 to-cyan-500',
                title: 'Lightning Fast Messaging',
                desc: 'Experience instant message delivery with real-time updates.',
              },
              {
                iconColor: 'from-purple-500 to-pink-500',
                title: 'Bank-Level Security',
                desc: 'Military-grade encryption protects every conversation.',
              },
              {
                iconColor: 'from-cyan-500 to-teal-500',
                title: 'Seamless File Sharing',
                desc: 'Share any file type instantly across all devices.',
              },
            ].map((item, index) => (
              <div
                key={index}
                className="flex items-center space-x-4 p-4 bg-slate-700/30 border border-slate-600/30 rounded-xl backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:scale-[1.01] hover:border-cyan-400/60"
              >
                <div className={`p-2 bg-gradient-to-br ${item.iconColor} rounded-lg shadow-lg`}>
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg text-white font-bold">{item.title}</h3>
                  <p className="text-sm text-gray-400">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right form content */}
        <div className="w-full xl:w-[60%] flex items-center justify-center">
          <div className="relative w-full max-w-lg transition-transform duration-300 hover:-translate-y-1 hover:scale-[1.01]">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-purple-600 to-cyan-600 rounded-3xl blur-lg opacity-20"></div>
            <div className="relative bg-slate-800/80 backdrop-blur-2xl rounded-3xl shadow-2xl border border-slate-600/50 p-8 min-h-[540px] w-full">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl mb-6 shadow-xl">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
                <h2 className="text-3xl font-bold text-white bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
                  {isSignInPage ? 'Welcome Back!' : 'Join Pingora'}
                </h2>
                <p className="text-gray-300">
                  {isSignInPage
                    ? 'Ready to reconnect with your world?'
                    : 'Start your journey with us today'}
                </p>
              </div>

              {message.text && (
                <div className={`mb-6 p-4 rounded-lg ${
                  message.type === 'success' 
                    ? 'bg-green-500/20 border border-green-500/50 text-green-300'
                    : 'bg-red-500/20 border border-red-500/50 text-red-300'
                }`}>
                  {message.text}
                </div>
              )}

              <form className="space-y-6" onSubmit={handleSubmit}>
                {!isSignInPage && (
                  <Input
                    label="Full Name"
                    name="fullName"
                    placeholder="Enter your full name"
                    value={data.fullName}
                    onChange={(e) => setData({ ...data, fullName: e.target.value })}
                  />
                )}
                <Input
                  label="Email"
                  type="email"
                  name="email"
                  placeholder="Enter your email"
                  value={data.email}
                  onChange={(e) => setData({ ...data, email: e.target.value })}
                />
                <Input
                  label="Password"
                  type="password"
                  name="password"
                  placeholder="Enter your password"
                  value={data.password}
                  onChange={(e) => setData({ ...data, password: e.target.value })}
                />
                <Button
                  label={isSignInPage ? 'Sign In' : 'Create Account'}
                  type="submit"
                  className="w-full py-4 text-lg font-bold bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 hover:scale-[1.01] transition-all duration-300 shadow-2xl"
                />
              </form>

              <div className="mt-6 text-center">
                <p className="text-gray-300 text-base">
                  {isSignInPage ? "Don't have an account?" : 'Already have an account?'}
                  <button
                    className="ml-2 text-transparent bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text hover:underline font-semibold"
                    onClick={() => navigate(isSignInPage ? '/users/sign_up' : '/users/sign_in')}
                  >
                    {isSignInPage ? 'Sign up now' : 'Sign in here'}
                  </button>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Form;
