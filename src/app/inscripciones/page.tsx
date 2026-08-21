'use client';

import React from 'react';
import { InscripcionesPublicComponent } from '@/components/inscripciones/InscripcionesPublicComponent';

export default function InscripcionesPublicPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f8fafc 0%, #eaeef4 100%)',
      padding: '20px 12px'
    }}>
      <InscripcionesPublicComponent />
    </div>
  );
}
