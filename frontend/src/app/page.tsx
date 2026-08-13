'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopNav } from '@/components/layout/TopNav';
import { ChatContainer } from '@/components/chat/ChatContainer';
import { PreviewPanel } from '@/components/preview/PreviewPanel';
import { SettingsModal } from '@/components/modals/SettingsModal';
import { Toast } from '@/components/ui/Toast';
import { SplashScreen } from '@/components/SplashScreen';
import { UserOnboardingModal } from '@/components/modals/UserOnboardingModal';

export default function Page() {
  const [showSplash, setShowSplash] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    // Check splash
    const hasSeenSplash = sessionStorage.getItem('chaty_splash_seen');
    if (hasSeenSplash === 'true') {
      setShowSplash(false);
    }

    // Check user profile onboarding
    const userId = localStorage.getItem('chaty_user_id');
    if (!userId) {
      setShowOnboarding(true);
    }
  }, []);

  const handleSplashFinish = () => {
    sessionStorage.setItem('chaty_splash_seen', 'true');
    setShowSplash(false);
  };

  const handleOnboardingComplete = (name: string, userId: string) => {
    setShowOnboarding(false);
  };

  return (
    <div
      className="flex h-[100dvh] w-screen overflow-hidden relative safe-area-top"
      style={{ background: 'var(--bg)' }}
    >
      {showOnboarding && (
        <UserOnboardingModal onComplete={handleOnboardingComplete} />
      )}
      {!showOnboarding && showSplash && (
        <SplashScreen onFinish={handleSplashFinish} />
      )}
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 h-full">
        <TopNav />
        <ChatContainer />
      </div>
      <PreviewPanel />
      <SettingsModal />
      <Toast />
    </div>
  );
}
