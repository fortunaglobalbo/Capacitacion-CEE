'use client';

import React from 'react';
import { Download, FileSpreadsheet, MessageCircle, Users, Sparkles, PhoneCall, ExternalLink, AlertTriangle, CheckCircle2 } from 'lucide-react';

export function GuiaPasosSubtab() {
  const [copied, setCopied] = React.useState<string | null>(null);

  const handleCopy = (num: string) => {
    navigator.clipboard.writeText(num);
    setCopied(num);
    setTimeout(() => setCopied(null), 2000);
  };

  const contacts = [
    { num: '77476059', label: 'Línea de Atención 1' },
    { num: '68405551', label: 'Línea de Atención 2' },
    { num: '72174446', label: 'Línea de Atención 3' },
    { num: '76200708', label: 'Línea de Atención 4' }
  ];

  return (
    <div className="guia-container">
      <style>{`
        .guia-container {
          max-width: 1240px;
          margin: 0 auto;
          padding: 24px 16px;
          font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
          box-sizing: border-box;
        }
        .banner-header {
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%);
          color: #ffffff;
          border-radius: 24px;
          padding: 36px 28px;
          text-align: center;
          box-shadow: 0 12px 30px rgba(15, 23, 42, 0.25);
          border: 3px solid #bfa05e;
          margin-bottom: 36px;
          position: relative;
          overflow: hidden;
        }
        .banner-title {
          margin: 0;
          font-size: clamp(1.4rem, 4.5vw, 2.3rem);
          font-weight: 900;
          color: #ffffff;
          letter-spacing: 0.5px;
          line-height: 1.25;
        }
        .banner-subtitle {
          margin: 14px auto 0;
          max-width: 780px;
          font-size: clamp(0.98rem, 2.8vw, 1.15rem);
          color: #cbd5e1;
          line-height: 1.6;
          font-weight: 600;
        }
        .guia-steps-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(310px, 1fr));
          gap: 28px;
          align-items: stretch;
        }
        .guia-step-card {
          background: #ffffff;
          border-radius: 24px;
          padding: 32px 26px;
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.07);
          border: 2.5px solid #cbd5e1;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          position: relative;
          box-sizing: border-box;
        }
        .warning-box-mobile {
          margin-top: 36px;
          background: linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%);
          border: 3px solid #e11d48;
          border-radius: 24px;
          padding: 28px 30px;
          box-shadow: 0 10px 30px rgba(225, 29, 72, 0.22);
          display: flex;
          align-items: flex-start;
          gap: 20px;
        }

        @media (max-width: 768px) {
          .guia-container {
            padding: 12px 8px;
          }
          .banner-header {
            padding: 24px 14px;
            border-radius: 18px;
            margin-bottom: 20px;
          }
          .guia-steps-grid {
            grid-template-columns: 1fr;
            gap: 20px;
          }
          .guia-step-card {
            padding: 20px 14px;
            border-radius: 18px;
          }
          .warning-box-mobile {
            padding: 20px 14px;
            flex-direction: column;
            align-items: center;
            text-align: center;
            margin-top: 24px;
          }
        }
      `}</style>

      {/* Header Banner */}
      <div className="banner-header">
        <div style={{
          position: 'absolute',
          top: '-20px',
          right: '-20px',
          width: '180px',
          height: '180px',
          background: 'radial-gradient(circle, rgba(191, 160, 94, 0.3) 0%, transparent 70%)',
          borderRadius: '50%'
        }} />

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '10px',
          background: 'rgba(191, 160, 94, 0.22)',
          border: '1.5px solid #bfa05e',
          color: '#f59e0b',
          padding: '8px 20px',
          borderRadius: '24px',
          fontSize: '0.95rem',
          fontWeight: 900,
          textTransform: 'uppercase',
          letterSpacing: '1px',
          marginBottom: '16px'
        }}>
          <Sparkles size={18} /> Pasos para la Pre-Inscripción de Grupos
        </div>

        <h1 className="banner-title">
          GUÍA PASO A PASO PARA MAESTRAS Y MAESTROS
        </h1>

        <p className="banner-subtitle">
          Descarga la convocatoria oficial, organiza a tu equipo de docentes y envía tu lista para habilitar tu grupo de formación.
        </p>

        <div style={{
          marginTop: '22px',
          display: 'inline-block',
          background: 'linear-gradient(135deg, #bfa05e 0%, #9a7b38 100%)',
          color: '#ffffff',
          padding: '10px 22px',
          borderRadius: '30px',
          fontWeight: 900,
          fontSize: '0.95rem',
          boxShadow: '0 4px 14px rgba(191, 160, 94, 0.4)',
          letterSpacing: '0.5px'
        }}>
          📣 ¡PARTICIPA Y SÉ PARTE DEL CAMBIO EDUCATIVO!
        </div>
      </div>

      {/* Grid of 3 Steps */}
      <div className="guia-steps-grid">

        {/* PASO 1 */}
        <div className="guia-step-card">
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '18px'
            }}>
              <span style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #bfa05e 0%, #9a7b38 100%)',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: '1.6rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(191, 160, 94, 0.35)'
              }}>
                1
              </span>
              <span style={{
                fontSize: '0.85rem',
                fontWeight: 900,
                color: '#9a7b38',
                background: '#fefce8',
                padding: '6px 14px',
                borderRadius: '16px',
                border: '1.5px solid #fef08a'
              }}>
                Paso Inicial
              </span>
            </div>

            <h3 style={{
              margin: '0 0 12px 0',
              fontSize: '1.35rem',
              fontWeight: 900,
              color: '#0f172a',
              lineHeight: 1.3
            }}>
              PASO 1: DESCARGAR LA CONVOCATORIA
            </h3>

            <p style={{
              margin: 0,
              fontSize: '1.05rem',
              color: '#475569',
              lineHeight: 1.6,
              fontWeight: 600
            }}>
              Consulta los requisitos oficiales, fechas de inicio, carga horaria y detalles normativos para la inscripción de maestros.
            </p>

            <div style={{
              marginTop: '22px',
              padding: '18px',
              background: '#f8fafc',
              borderRadius: '16px',
              border: '2px dashed #cbd5e1',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2.8rem', marginBottom: '8px' }}>📄</div>
              <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#334155', display: 'block' }}>
                Documento Oficial en PDF
              </span>
              <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>
                Google Drive
              </span>
            </div>
          </div>

          <div style={{ marginTop: '24px' }}>
            <a
              href="https://drive.google.com/file/d/1xLv07-cLHRhSQOzw4pNiC5tA7FpL-ZEL/view?usp=sharing"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                color: '#ffffff',
                textDecoration: 'none',
                padding: '16px 20px',
                borderRadius: '14px',
                fontWeight: 900,
                fontSize: '1.05rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                boxShadow: '0 4px 14px rgba(15, 23, 42, 0.25)',
                transition: 'transform 0.15s ease'
              }}
            >
              <Download size={20} /> Descargar Convocatoria <ExternalLink size={16} />
            </a>
          </div>
        </div>

        {/* PASO 2 */}
        <div className="guia-step-card">
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '18px'
            }}>
              <span style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #bfa05e 0%, #9a7b38 100%)',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: '1.6rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(191, 160, 94, 0.35)'
              }}>
                2
              </span>
              <span style={{
                fontSize: '0.85rem',
                fontWeight: 900,
                color: '#9a7b38',
                background: '#fefce8',
                padding: '6px 14px',
                borderRadius: '16px',
                border: '1.5px solid #fef08a'
              }}>
                Trabajo en Equipo
              </span>
            </div>

            <h3 style={{
              margin: '0 0 12px 0',
              fontSize: '1.35rem',
              fontWeight: 900,
              color: '#0f172a',
              lineHeight: 1.3
            }}>
              PASO 2: FORMAR TU GRUPO DE MAESTRAS Y MAESTROS
            </h3>

            <p style={{
              margin: 0,
              fontSize: '1.05rem',
              color: '#475569',
              lineHeight: 1.6,
              fontWeight: 600
            }}>
              Organízate con tus colegas y descarga la plantilla oficial en Excel para registrar los datos del grupo.
            </p>

            {/* Requisito mínimo de 20 participantes */}
            <div style={{
              background: '#fff7ed',
              border: '2.5px solid #ea580c',
              borderRadius: '14px',
              padding: '14px 16px',
              color: '#9a3412',
              fontSize: '1.02rem',
              fontWeight: 800,
              marginTop: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              boxShadow: '0 2px 8px rgba(234, 88, 12, 0.12)'
            }}>
              <Users size={28} style={{ color: '#ea580c', flexShrink: 0 }} />
              <div style={{ lineHeight: 1.45 }}>
                <span style={{ color: '#c2410c', textTransform: 'uppercase', display: 'block', fontSize: '0.88rem', fontWeight: 900 }}>
                  👥 REQUISITO DE PARTICIPANTES:
                </span>
                El grupo debe contar con un <strong>MÍNIMO DE 20 PARTICIPANTES (maestras y maestros)</strong> para ser habilitado.
              </div>
            </div>

            <div style={{
              marginTop: '16px',
              padding: '16px',
              background: '#f0fdf4',
              borderRadius: '16px',
              border: '2px dashed #86efac',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2.6rem', marginBottom: '6px' }}>📊</div>
              <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#166534', display: 'block' }}>
                Plantilla Oficial Excel (Google Sheets)
              </span>
            </div>
          </div>

          <div style={{ marginTop: '24px' }}>
            <a
              href="https://docs.google.com/spreadsheets/d/1dSqj3I2f8PGm0MYpib9FZ0FuIGC7rqaS/edit?usp=sharing&ouid=113363672352349214932&rtpof=true&sd=true"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                color: '#ffffff',
                textDecoration: 'none',
                padding: '16px 20px',
                borderRadius: '14px',
                fontWeight: 900,
                fontSize: '1.05rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                boxShadow: '0 4px 14px rgba(22, 163, 74, 0.3)',
                transition: 'transform 0.15s ease'
              }}
            >
              <FileSpreadsheet size={20} /> Descargar Plantilla Excel <ExternalLink size={16} />
            </a>
          </div>
        </div>

        {/* PASO 3 */}
        <div className="guia-step-card">
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '18px'
            }}>
              <span style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #bfa05e 0%, #9a7b38 100%)',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: '1.6rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(191, 160, 94, 0.35)'
              }}>
                3
              </span>
              <span style={{
                fontSize: '0.85rem',
                fontWeight: 900,
                color: '#9a7b38',
                background: '#fefce8',
                padding: '6px 14px',
                borderRadius: '16px',
                border: '1.5px solid #fef08a'
              }}>
                Envío por WhatsApp
              </span>
            </div>

            <h3 style={{
              margin: '0 0 12px 0',
              fontSize: '1.35rem',
              fontWeight: 900,
              color: '#0f172a',
              lineHeight: 1.3
            }}>
              PASO 3: ENVIAR TU ARCHIVO A LOS SIGUIENTES NÚMEROS
            </h3>

            <p style={{
              margin: 0,
              fontSize: '1.05rem',
              color: '#475569',
              lineHeight: 1.6,
              fontWeight: 600
            }}>
              Envía tu plantilla completada por WhatsApp a cualquiera de nuestras líneas habilitadas:
            </p>

            <div style={{
              marginTop: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              {contacts.map((c) => {
                const walink = `https://wa.me/591${c.num}?text=Hola,%20adjunto%20mi%20archivo%20de%20grupo%20de%20maestras%20y%20maestros%20para%20la%20inscripci%C3%B3n.`;
                const isCopied = copied === c.num;
                return (
                  <div key={c.num} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#f8fafc',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: '14px',
                    padding: '10px 12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <PhoneCall size={18} style={{ color: '#25D366' }} />
                      <span style={{ fontWeight: 900, fontSize: '1.05rem', color: '#0f172a' }}>
                        {c.num}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => handleCopy(c.num)}
                        style={{
                          background: isCopied ? '#dcfce7' : '#ffffff',
                          border: '1.5px solid #cbd5e1',
                          color: isCopied ? '#166534' : '#334155',
                          padding: '6px 10px',
                          borderRadius: '8px',
                          fontSize: '0.82rem',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        {isCopied ? '¡Copiado!' : 'Copiar'}
                      </button>

                      <a
                        href={walink}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                          color: '#ffffff',
                          textDecoration: 'none',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          fontSize: '0.85rem',
                          fontWeight: 900,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 6px rgba(37, 211, 102, 0.3)'
                        }}
                      >
                        <MessageCircle size={15} /> Chat
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Aumento de información sobre el seguimiento del técnico */}
            <div style={{
              background: '#f0fdf4',
              border: '2px solid #16a34a',
              borderRadius: '16px',
              padding: '16px',
              color: '#14532d',
              fontSize: '1rem',
              fontWeight: 700,
              lineHeight: 1.55,
              marginTop: '18px',
              boxShadow: '0 2px 8px rgba(22, 163, 74, 0.1)'
            }}>
              <div style={{ fontWeight: 900, fontSize: '1.08rem', color: '#15803d', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={18} /> PASO SIGUIENTE TRAS EL ENVÍO:
              </div>
              Una vez que envíes tu archivo, <strong>el técnico asignado se pondrá en contacto contigo</strong> y procederá a <strong>armar el grupo oficial de WhatsApp</strong> para coordinar las clases y enviar los requisitos correspondientes.
            </div>
          </div>
        </div>

      </div>

      {/* ADVERTENCIA DE DEPÓSITOS */}
      <div className="warning-box-mobile">
        <AlertTriangle size={42} style={{ color: '#e11d48', flexShrink: 0, marginTop: '4px' }} />
        <div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 'clamp(1.2rem, 3.5vw, 1.45rem)', fontWeight: 900, color: '#9f1239', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            🚨 ADVERTENCIA IMPORTANTE SOBRE DEPÓSITOS BANCARIOS
          </h3>
          <p style={{ margin: 0, fontSize: 'clamp(1rem, 2.8vw, 1.18rem)', fontWeight: 900, color: '#be123c', lineHeight: 1.6 }}>
            <strong>NO REALIZAR NINGÚN DEPÓSITO</strong> hasta contar con la <strong>confirmación directa del técnico asignado</strong>.
          </p>
          <p style={{ margin: '10px 0 0 0', fontSize: '1.05rem', color: '#881337', lineHeight: 1.6, fontWeight: 700 }}>
            ⚠️ <em>Toma en cuenta que los depósitos bancarios son válidos <strong>ÚNICAMENTE DENTRO DEL MES EN EL QUE SE REALIZAN</strong>. Evita inconvenientes esperando la confirmación de apertura del grupo.</em>
          </p>
        </div>
      </div>
    </div>
  );
}
