'use client';

import { AuthProvider } from '@/lib/auth';
import { StoreProvider } from '@/lib/store';
import { AppShell } from '@/components/AppShell';
import { ToastHost } from '@/components/Toast';
import { Splash } from '@/components/Splash';

export default function Page() {
  return (
    <>
      <Splash />
      <AuthProvider>
        <StoreProvider>
          <ToastHost>
            <AppShell />
          </ToastHost>
        </StoreProvider>
      </AuthProvider>
    </>
  );
}
