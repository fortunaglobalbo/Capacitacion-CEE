'use client';

import React from 'react';
import { GuiaPasosSubtab } from '@/components/guia/GuiaPasosSubtab';

export default function GruposPublicPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f8fafc 0%, #eaeef4 100%)',
      padding: '20px 12px'
    }}>
      <GuiaPasosSubtab />
    </div>
  );
}
