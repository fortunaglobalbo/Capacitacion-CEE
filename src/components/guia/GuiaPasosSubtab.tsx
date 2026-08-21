'use client';

import React from 'react';
import { Download, FileSpreadsheet, MessageCircle, Users, Sparkles, PhoneCall, ExternalLink, CheckCircle } from 'lucide-react';

export function GuiaPasosSubtab() {
  const [copied, setCopied] = React.useState<string | null>(null);

  const handleCopy = (num: string) => {
    navigator.clipboard.writeText(num);
    setCopied(num);
    setTimeout(() => setCopied(null), 2000);
  };

  const contacts = [
    { num: '77476059', label: 'Atención 1' },
    { num: '68405551', label: 'Atención 2' },
    { num: '72174446', label: 'Atención 3' },
    { num: '76200708', label: 'Atención 4' }
  ];

  return (
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '24px 16px',
      fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif"
    }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
        color: '#ffffff',
        borderRadius: '20px',
        padding: '32px 24px',
        textAlign: 'center',
        boxShadow: '0 10px 25px rgba(15, 23, 42, 0.25)',
        border: '2px solid #bfa05e',
        marginBottom: '32px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          top: '-20px',
          right: '-20px',
          width: '150px',
          height: '150px',
          background: 'radial-gradient(circle, rgba(191, 160, 94, 0.25) 0%, transparent 70%)',
          borderRadius: '50%'
        }} />

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(191, 160, 94, 0.2)',
          border: '1px solid #bfa05e',
          color: '#f59e0b',
          padding: '6px 16px',
          borderRadius: '20px',
          fontSize: '0.85rem',
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '1px',
          marginBottom: '14px'
        }}>
          <Sparkles size={16} /> Pasos para la Pre-Inscripción por Grupos
        </div>

        <h1 style={{
          margin: 0,
          fontSize: '2rem',
          fontWeight: 900,
          color: '#ffffff',
          letterSpacing: '0.5px',
          lineHeight: 1.2
        }}>
          GUÍA PASO A PASO PARA MAESTRAS Y MAESTROS
        </h1>

        <p style={{
          margin: '12px auto 0',
          maxWidth: '680px',
          fontSize: '0.98rem',
          color: '#cbd5e1',
          lineHeight: 1.5
        }}>
          Descarga la convocatoria oficial, organiza a tu equipo de trabajo y envía tu lista para registrar a tu grupo de participantes.
        </p>

        <div style={{
          marginTop: '20px',
          display: 'inline-block',
          background: 'linear-gradient(135deg, #bfa05e 0%, #9a7b38 100%)',
          color: '#ffffff',
          padding: '8px 22px',
          borderRadius: '30px',
          fontWeight: 900,
          fontSize: '0.9rem',
          boxShadow: '0 4px 12px rgba(191, 160, 94, 0.35)',
          letterSpacing: '0.5px'
        }}>
          📣 ¡PARTICIPA Y SÉ PARTE DEL CAMBIO EDUCATIVO!
        </div>
      </div>

      {/* Grid of 3 Steps */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '24px',
        alignItems: 'stretch'
      }}>

        {/* PASO 1 */}
        <div style={{
          background: '#ffffff',
          borderRadius: '20px',
          padding: '28px 24px',
          boxShadow: '0 8px 20px rgba(0, 0, 0, 0.06)',
          border: '2px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          position: 'relative'
        }}>
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px'
            }}>
              <span style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #bfa05e 0%, #9a7b38 100%)',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: '1.4rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 10px rgba(191, 160, 94, 0.3)'
              }}>
                1
              </span>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 800,
                color: '#9a7b38',
                background: '#fefce8',
                padding: '4px 10px',
                borderRadius: '12px',
                border: '1px solid #fef08a'
              }}>
                Paso Inicial
              </span>
            </div>

            <h3 style={{
              margin: '0 0 10px 0',
              fontSize: '1.25rem',
              fontWeight: 900,
              color: '#0f172a',
              lineHeight: 1.3
            }}>
              PASO 1: DESCARGAR LA CONVOCATORIA
            </h3>

            <p style={{
              margin: 0,
              fontSize: '0.88rem',
              color: '#64748b',
              lineHeight: 1.55
            }}>
              Consulta los requisitos oficiales, fechas de inicio, carga horaria y detalles normativos para la inscripción de maestros.
            </p>

            <div style={{
              marginTop: '20px',
              padding: '16px',
              background: '#f8fafc',
              borderRadius: '12px',
              border: '1px dashed #cbd5e1',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📄</div>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>
                Documento oficial en PDF (Google Drive)
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
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                color: '#ffffff',
                textDecoration: 'none',
                padding: '14px 20px',
                borderRadius: '12px',
                fontWeight: 800,
                fontSize: '0.92rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                boxShadow: '0 4px 12px rgba(15, 23, 42, 0.2)',
                transition: 'transform 0.15s ease'
              }}
            >
              <Download size={18} /> Descargar Convocatoria <ExternalLink size={14} />
            </a>
          </div>
        </div>

        {/* PASO 2 */}
        <div style={{
          background: '#ffffff',
          borderRadius: '20px',
          padding: '28px 24px',
          boxShadow: '0 8px 20px rgba(0, 0, 0, 0.06)',
          border: '2px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          position: 'relative'
        }}>
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px'
            }}>
              <span style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #bfa05e 0%, #9a7b38 100%)',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: '1.4rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 10px rgba(191, 160, 94, 0.3)'
              }}>
                2
              </span>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 800,
                color: '#9a7b38',
                background: '#fefce8',
                padding: '4px 10px',
                borderRadius: '12px',
                border: '1px solid #fef08a'
              }}>
                Trabajo en Equipo
              </span>
            </div>

            <h3 style={{
              margin: '0 0 10px 0',
              fontSize: '1.25rem',
              fontWeight: 900,
              color: '#0f172a',
              lineHeight: 1.3
            }}>
              PASO 2: FORMAR TU GRUPO DE MAESTRAS Y MAESTROS
            </h3>

            <p style={{
              margin: 0,
              fontSize: '0.88rem',
              color: '#64748b',
              lineHeight: 1.55
            }}>
              Organízate con tus colegas y descarga la planilla oficial en Excel para registrar los nombres, carnets y datos del grupo.
            </p>

            <div style={{
              marginTop: '20px',
              padding: '16px',
              background: '#f0fdf4',
              borderRadius: '12px',
              border: '1px dashed #86efac',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📊</div>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#166534' }}>
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
                background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                color: '#ffffff',
                textDecoration: 'none',
                padding: '14px 20px',
                borderRadius: '12px',
                fontWeight: 800,
                fontSize: '0.92rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)',
                transition: 'transform 0.15s ease'
              }}
            >
              <FileSpreadsheet size={18} /> Descargar Plantilla Excel <ExternalLink size={14} />
            </a>
          </div>
        </div>

        {/* PASO 3 */}
        <div style={{
          background: '#ffffff',
          borderRadius: '20px',
          padding: '28px 24px',
          boxShadow: '0 8px 20px rgba(0, 0, 0, 0.06)',
          border: '2px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          position: 'relative'
        }}>
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px'
            }}>
              <span style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #bfa05e 0%, #9a7b38 100%)',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: '1.4rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 10px rgba(191, 160, 94, 0.3)'
              }}>
                3
              </span>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 800,
                color: '#9a7b38',
                background: '#fefce8',
                padding: '4px 10px',
                borderRadius: '12px',
                border: '1px solid #fef08a'
              }}>
                Envío por WhatsApp
              </span>
            </div>

            <h3 style={{
              margin: '0 0 10px 0',
              fontSize: '1.25rem',
              fontWeight: 900,
              color: '#0f172a',
              lineHeight: 1.3
            }}>
              PASO 3: ENVIAR TU ARCHIVO A LOS SIGUIENTES NÚMEROS
            </h3>

            <p style={{
              margin: 0,
              fontSize: '0.88rem',
              color: '#64748b',
              lineHeight: 1.55
            }}>
              Envía tu plantilla completada directamente a cualquiera de nuestras líneas habilitadas por WhatsApp:
            </p>

            <div style={{
              marginTop: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              {contacts.map((c, i) => {
                const walink = `https://wa.me/591${c.num}?text=Hola,%20adjunto%20mi%20archivo%20de%20grupo%20de%20maestras%20y%20maestros%20para%20la%20inscripci%C3%B3n.`;
                const isCopied = copied === c.num;
                return (
                  <div key={c.num} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '8px 12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <PhoneCall size={15} style={{ color: '#25D366' }} />
                      <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#1e293b' }}>
                        {c.num}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => handleCopy(c.num)}
                        style={{
                          background: isCopied ? '#dcfce7' : '#ffffff',
                          border: '1px solid #cbd5e1',
                          color: isCopied ? '#166534' : '#475569',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
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
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <MessageCircle size={13} /> Chat <ExternalLink size={10} />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>

      {/* Footer Banner Mascot Info */}
      <div style={{
        marginTop: '32px',
        background: '#ffffff',
        borderRadius: '16px',
        padding: '20px 24px',
        border: '1.5px solid #bfa05e',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        boxShadow: '0 4px 14px rgba(191, 160, 94, 0.15)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            fontSize: '2.4rem',
            background: '#fefce8',
            width: '54px',
            height: '54px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid #fef08a'
          }}>
            🧲
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: '#0f172a' }}>
              UNEFCO &middot; Pre-Inscripción Facilitada
            </h4>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.83rem', color: '#64748b' }}>
              Si tienes dudas en cualquier paso, comunícate directamente con nuestros técnicos a través de WhatsApp.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <a
            href="https://drive.google.com/file/d/1xLv07-cLHRhSQOzw4pNiC5tA7FpL-ZEL/view?usp=sharing"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              color: '#0f172a',
              textDecoration: 'none',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Download size={14} /> Ver Convocatoria
          </a>
          <a
            href="https://docs.google.com/spreadsheets/d/1dSqj3I2f8PGm0MYpib9FZ0FuIGC7rqaS/edit?usp=sharing&ouid=113363672352349214932&rtpof=true&sd=true"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: '#f0fdf4',
              border: '1px solid #86efac',
              color: '#166534',
              textDecoration: 'none',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <FileSpreadsheet size={14} /> Abrir Excel
          </a>
        </div>
      </div>
    </div>
  );
}
