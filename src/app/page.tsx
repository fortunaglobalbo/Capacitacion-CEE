'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Users,
  BookOpen,
  QrCode,
  ExternalLink,
  Copy,
  MessageCircle,
  Sparkles
} from 'lucide-react';
import Swal from 'sweetalert2';
import GestionParticipantes from '@/components/participantes/GestionParticipantes';
import GestionCursos from '@/components/cursos/GestionCursos';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<'participantes' | 'cursos' | 'informacion'>('participantes');

  const handleCopyPublicLink = () => {
    const url = `${window.location.origin}/inscripciones`;
    navigator.clipboard.writeText(url);
    Swal.fire({
      icon: 'success',
      title: '¡Enlace Copiado!',
      text: 'El enlace del Formulario de Inscripción se copió al portapapeles.',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 2500
    });
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#0f172a'
    }}>
      {/* NAVBAR SUPERIOR */}
      <header style={{
        background: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)',
        color: '#ffffff',
        padding: '16px 24px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{
          maxWidth: '1280px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          {/* Logo y Título */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              background: '#ffffff',
              borderRadius: '50%',
              padding: '3px',
              width: '54px',
              height: '54px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              flexShrink: 0
            }}>
              <Image
                src="/logo-cee.png"
                alt="Logo CEE Martha Mendoza"
                width={48}
                height={48}
                style={{ objectFit: 'contain' }}
                priority
              />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  background: 'rgba(59, 130, 246, 0.3)',
                  color: '#93c5fd',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  border: '1px solid rgba(147, 197, 253, 0.3)'
                }}>
                  C.E.A. MARTHA MENDOZA • SUCRE
                </span>
              </div>
              <h1 style={{ margin: '2px 0 0 0', fontSize: '22px', fontWeight: 800, letterSpacing: '-0.5px' }}>
                Curso de Capacitación
              </h1>
            </div>
          </div>

          {/* Navegación y Botones de Acción */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* Pestañas Principales */}
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.1)', padding: '4px', borderRadius: '10px' }}>
              <button
                type="button"
                onClick={() => setActiveTab('participantes')}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s',
                  background: activeTab === 'participantes' ? '#3b82f6' : 'transparent',
                  color: '#ffffff'
                }}
              >
                <Users size={16} /> Participantes
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('cursos')}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s',
                  background: activeTab === 'cursos' ? '#3b82f6' : 'transparent',
                  color: '#ffffff'
                }}
              >
                <BookOpen size={16} /> Cursos y WhatsApp
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('informacion')}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s',
                  background: activeTab === 'informacion' ? '#3b82f6' : 'transparent',
                  color: '#ffffff'
                }}
              >
                <QrCode size={16} /> Datos de Pago / QR
              </button>
            </div>

            {/* Botón Abrir / Copiar Formulario Público */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <Link
                href="/inscripciones"
                target="_blank"
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  background: '#10b981',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '13px',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
                }}
              >
                <ExternalLink size={15} /> Formulario Público
              </Link>
              <button
                type="button"
                onClick={handleCopyPublicLink}
                title="Copiar enlace general de inscripción"
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: 'rgba(255,255,255,0.15)',
                  color: '#ffffff',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Copy size={15} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 20px' }}>
        {/* PESTAÑA 1: PARTICIPANTES */}
        {activeTab === 'participantes' && (
          <section>
            <div style={{ marginBottom: '16px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                Gestión de Participantes
              </h2>
              <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                Listado oficial de inscritos, verificación de carnets escaneados y comprobantes de pago.
              </p>
            </div>

            <GestionParticipantes />
          </section>
        )}

        {/* PESTAÑA 2: CURSOS Y WHATSAPP */}
        {activeTab === 'cursos' && (
          <section>
            <GestionCursos />
          </section>
        )}

        {/* PESTAÑA 3: DATOS DE PAGO / QR */}
        {activeTab === 'informacion' && (
          <section style={{ maxWidth: '760px', margin: '0 auto' }}>
            <div style={{
              background: '#ffffff',
              borderRadius: '20px',
              padding: '32px 28px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 10px 30px rgba(0,0,0,0.04)'
            }}>
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div style={{
                  width: '84px',
                  height: '84px',
                  borderRadius: '50%',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  margin: '0 auto 12px auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Image
                    src="/logo-cee.png"
                    alt="Logo CEA Martha Mendoza"
                    width={74}
                    height={74}
                    style={{ objectFit: 'contain' }}
                  />
                </div>
                <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 6px 0', color: '#0f172a' }}>
                  Datos Oficiales de Pago por QR
                </h2>
                <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
                  Banco BISA • Cuenta Institucional para Matrículas
                </p>
              </div>

              {/* QR y Datos Bancarios */}
              <div style={{
                background: 'linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%)',
                borderRadius: '16px',
                padding: '24px',
                border: '1px solid #cbd5e1',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px',
                marginBottom: '24px'
              }}>
                <div style={{
                  background: '#ffffff',
                  padding: '12px',
                  borderRadius: '12px',
                  boxShadow: '0 6px 16px rgba(0,0,0,0.08)',
                  width: '210px',
                  height: '210px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <img
                    src="/qr-pago-bisa.png"
                    alt="QR Banco Bisa"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                </div>

                <div style={{ width: '100%', maxWidth: '420px', background: '#ffffff', borderRadius: '12px', padding: '16px', border: '1px solid #e2e8f0', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ color: '#64748b' }}>Entidad Bancaria:</span>
                    <strong style={{ color: '#0f172a' }}>Banco BISA</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ color: '#64748b' }}>Número de Cuenta:</span>
                    <strong style={{ color: '#0f172a' }}>4983644011</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ color: '#64748b' }}>Beneficiario:</span>
                    <strong style={{ color: '#0f172a' }}>TORREZ SANCHEZ MISAEL</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ color: '#64748b' }}>Motivo:</span>
                    <strong style={{ color: '#0f172a' }}>CURSOS DE FORMACIÓN CONTINUA</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '6px' }}>
                    <span style={{ color: '#16a34a', fontWeight: 700 }}>Monto Base Matrícula:</span>
                    <strong style={{ color: '#16a34a', fontSize: '15px' }}>BOB 150.00</strong>
                  </div>
                </div>
              </div>

              {/* Botón de Enlace al Formulario */}
              <div style={{ textAlign: 'center' }}>
                <Link
                  href="/inscripciones"
                  target="_blank"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 26px',
                    background: '#2563eb',
                    color: '#ffffff',
                    borderRadius: '10px',
                    fontWeight: 700,
                    textDecoration: 'none',
                    fontSize: '14px',
                    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)'
                  }}
                >
                  <ExternalLink size={16} /> Abrir Formulario de Inscripción en Nueva Pestaña
                </Link>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
