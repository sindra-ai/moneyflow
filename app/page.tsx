'use client';

import { AuthProvider } from '@/lib/auth';
import { StoreProvider } from '@/lib/store';
import { AppShell } from '@/components/AppShell';
import { ToastHost } from '@/components/Toast';

export default function Page() {
  return (
    <AuthProvider>
      <StoreProvider>
        <ToastHost>
          <AppShell />
        </ToastHost>
      </StoreProvider>
    </AuthProvider>
  );
}
