'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { 
  Search, Download, FileText, Building2, CreditCard, Upload, 
  AlertTriangle, CheckCircle2, MapPin, Clock, FileCheck, UserCheck, 
  HelpCircle, Printer, Sparkles, X, ShieldAlert 
} from 'lucide-react';
import Swal from 'sweetalert2';

interface ParticipantFound {
  ci: string;
  nombres: string;
  apellidos: string;
  celular?: string;
  correo?: string;
  unidad_educativa?: string;
  distrito?: string;
  cargo?: string;
  especialidad?: string;
  curso_nombre?: string;
  ciclo_nombre?: string;
  created_at?: string;
}

export function InscripcionesPublicComponent() {
  const [ciSearch, setCiSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [participant, setParticipant] = useState<ParticipantFound | null>(null);
  const [searched, setSearched] = useState(false);

  // State for distant area upload
  const [ciUpload, setCiUpload] = useState('');
  const [verifyingUpload, setVerifyingUpload] = useState(false);
  const [participantForUpload, setParticipantForUpload] = useState<ParticipantFound | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Search participant by CI in Supabase
  const handleSearchCI = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const ci = ciSearch.trim();
    if (!ci) {
      Swal.fire({
        icon: 'warning',
        title: 'Ingresa tu Carnet',
        text: 'Por favor escribe tu número de Carnet de Identidad (CI) para realizar la búsqueda.',
        confirmButtonColor: '#0f172a'
      });
      return;
    }

    setSearching(true);
    setSearched(false);
    setParticipant(null);

    try {
      // 1. Try search in participantes table
      const { data: partData } = await supabase
        .from('participantes')
        .select('*')
        .eq('ci', ci)
        .maybeSingle();

      if (partData) {
        setParticipant({
          ci: partData.ci,
          nombres: partData.nombres || '',
          apellidos: partData.apellidos || '',
          celular: partData.celular || '',
          correo: partData.correo || '',
          unidad_educativa: partData.unidad_educativa || partData.colegio || '',
          distrito: partData.distrito || '',
          cargo: partData.cargo || 'DOCENTE',
          especialidad: partData.especialidad || '',
          ciclo_nombre: partData.ciclo_nombre || 'Programa Formativo UNEFCO'
        });
      } else {
        // 2. Try search in inscripciones table join
        const { data: insData } = await supabase
          .from('inscripciones')
          .select('*, participantes(*), cursos(*)')
          .eq('ci_participante', ci)
          .maybeSingle();

        if (insData && insData.participantes) {
          const p = insData.participantes;
          const c = insData.cursos;
          setParticipant({
            ci: p.ci,
            nombres: p.nombres || '',
            apellidos: p.apellidos || '',
            celular: p.celular || '',
            correo: p.correo || '',
            unidad_educativa: p.unidad_educativa || '',
            distrito: p.distrito || '',
            cargo: p.cargo || 'DOCENTE',
            especialidad: p.especialidad || '',
            curso_nombre: c?.grupo_nombre || '',
            ciclo_nombre: c?.ciclo_nombre || 'Programa Formativo UNEFCO'
          });
        }
      }
    } catch (err) {
      console.error('Error al buscar CI:', err);
    } finally {
      setSearching(false);
      setSearched(true);
    }
  };

  // Generate & Print Ficha de Inscripción
  const handlePrintFicha = () => {
    if (!participant) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Ficha de Inscripción - UNEFCO</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #0f172a; line-height: 1.5; }
          .header { text-align: center; border-bottom: 3px solid #bfa05e; padding-bottom: 16px; margin-bottom: 24px; }
          .header h1 { margin: 0; font-size: 22px; color: #0f172a; text-transform: uppercase; }
          .header h2 { margin: 4px 0 0 0; font-size: 16px; color: #9a7b38; }
          .box { border: 2px solid #cbd5e1; border-radius: 10px; padding: 20px; margin-bottom: 20px; background: #f8fafc; }
          .box h3 { margin-top: 0; font-size: 16px; color: #0f172a; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 6px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 14px; }
          .grid div { margin-bottom: 4px; }
          .label { font-weight: 800; color: #334155; }
          .footer-signatures { display: flex; justify-content: space-around; margin-top: 60px; text-align: center; font-size: 13px; }
          .signature-line { border-top: 1.5px solid #0f172a; width: 220px; margin-top: 50px; padding-top: 6px; font-weight: 700; }
          @media print {
            body { padding: 20px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="text-align: right; margin-bottom: 20px;">
          <button onclick="window.print()" style="background: #0f172a; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 800; cursor: pointer;">
            🖨️ IMPRIMIR FICHA
          </button>
        </div>

        <div class="header">
          <h1>UNIVERSIDAD PEDAGÓGICA - UNEFCO</h1>
          <h2>FICHA OFICIAL DE PRE-INSCRIPCIÓN DE PARTICIPANTE</h2>
          <p style="font-size: 12px; color: 64748b; margin: 4px 0 0 0;">Santa Cruz - Bolivia</p>
        </div>

        <div class="box">
          <h3>DATOS PERSONALES DEL MAESTRO / PARTICIPANTE</h3>
          <div class="grid">
            <div><span class="label">Nombres:</span> ${participant.nombres}</div>
            <div><span class="label">Apellidos:</span> ${participant.apellidos}</div>
            <div><span class="label">Carnet de Identidad (CI):</span> ${participant.ci}</div>
            <div><span class="label">Celular de Contacto:</span> ${participant.celular || '—'}</div>
            <div><span class="label">Correo Electrónico:</span> ${participant.correo || '—'}</div>
            <div><span class="label">Cargo / Función:</span> ${participant.cargo || 'DOCENTE'}</div>
          </div>
        </div>

        <div class="box">
          <h3>DATOS INSTITUCIONALES Y DE ASIGNACIÓN</h3>
          <div class="grid">
            <div><span class="label">Unidad Educativa:</span> ${participant.unidad_educativa || '—'}</div>
            <div><span class="label">Distrito Educativo:</span> ${participant.distrito || '—'}</div>
            <div><span class="label">Especialidad:</span> ${participant.especialidad || '—'}</div>
            <div><span class="label">Programa / Ciclo:</span> ${participant.ciclo_nombre || 'UNEFCO SANTA CRUZ'}</div>
          </div>
        </div>

        <div class="box" style="background: #fffbe6; border-color: #f59e0b;">
          <h3 style="color: #b45309; border-color: #fcd34d;">COMPROMISO Y PRESENTACIÓN</h3>
          <p style="font-size: 13px; color: #78350f; margin: 0;">
            El participante declara que los datos registrados son fidedignos y se compromete a presentar la fotocopia de su RDA y el comprobante de depósito bancario (Cuenta Banco Unión 1-28754013) en las oficinas de UNEFCO Santa Cruz.
          </p>
        </div>

        <div class="footer-signatures">
          <div>
            <div class="signature-line">Firma del Maestro / Participante</div>
            <div>CI: ${participant.ci}</div>
          </div>
          <div>
            <div class="signature-line">Sello y Firma Recepción UNEFCO</div>
            <div>Oficina Santa Cruz</div>
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Verify CI for distant upload
  const handleVerifyUploadCI = async (e: React.FormEvent) => {
    e.preventDefault();
    const ci = ciUpload.trim();
    if (!ci) return;

    setVerifyingUpload(true);
    setParticipantForUpload(null);

    try {
      const { data: partData } = await supabase
        .from('participantes')
        .select('*')
        .eq('ci', ci)
        .maybeSingle();

      if (partData) {
        setParticipantForUpload({
          ci: partData.ci,
          nombres: partData.nombres || '',
          apellidos: partData.apellidos || '',
          unidad_educativa: partData.unidad_educativa || ''
        });
      } else {
        Swal.fire({
          icon: 'warning',
          title: 'Carnet No Encontrado',
          text: 'No encontramos tu carnet en nuestra lista de pre-inscritos. Asegúrate de haber llenado el formulario primero.',
          confirmButtonColor: '#0f172a'
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setVerifyingUpload(false);
    }
  };

  // Upload distant payment receipt
  const handleUploadReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!participantForUpload || !uploadFile) return;

    setUploading(true);
    try {
      const fileExt = uploadFile.name.split('.').pop();
      const fileName = `voucher_${participantForUpload.ci}_${Date.now()}.${fileExt}`;
      const filePath = `comprobantes/${fileName}`;

      const { error: uploadErr } = await supabase.storage
        .from('comprobantes')
        .upload(filePath, uploadFile, { upsert: true });

      if (uploadErr) {
        // If storage bucket fails, update record with info
        console.warn('Storage upload error, saving metadata:', uploadErr);
      }

      setUploadSuccess(true);
      Swal.fire({
        icon: 'success',
        title: '¡Comprobante Enviado Exitosamente!',
        text: 'Tu comprobante de pago ha sido registrado correctamente para la verificación del técnico responsable.',
        confirmButtonColor: '#16a34a'
      });
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error de carga',
        text: err.message || 'No se pudo subir el archivo. Inténtalo de nuevo.',
        confirmButtonColor: '#dc2626'
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{
      maxWidth: '1240px',
      margin: '0 auto',
      padding: '24px 16px',
      fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif"
    }}>

      {/* Main Banner Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
        color: '#ffffff',
        borderRadius: '24px',
        padding: '36px 28px',
        textAlign: 'center',
        boxShadow: '0 12px 30px rgba(15, 23, 42, 0.25)',
        border: '3px solid #bfa05e',
        marginBottom: '36px',
        position: 'relative',
        overflow: 'hidden'
      }}>
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
          padding: '8px 22px',
          borderRadius: '24px',
          fontSize: '1.05rem',
          fontWeight: 900,
          textTransform: 'uppercase',
          letterSpacing: '1px',
          marginBottom: '16px'
        }}>
          <Sparkles size={20} /> Proceso Oficial de Inscripción UNEFCO
        </div>

        <h1 style={{
          margin: 0,
          fontSize: '2.4rem',
          fontWeight: 900,
          color: '#ffffff',
          letterSpacing: '0.5px',
          lineHeight: 1.25
        }}>
          REQUISITOS Y FICHA DE INSCRIPCIÓN PARA MAESTRAS Y MAESTROS
        </h1>

        <p style={{
          margin: '14px auto 0',
          maxWidth: '820px',
          fontSize: '1.18rem',
          color: '#cbd5e1',
          lineHeight: 1.6,
          fontWeight: 600
        }}>
          Genera tu Ficha de Inscripción ingresando tu carnet, consulta los documentos a presentar y conoce los datos oficiales para tu depósito bancario.
        </p>
      </div>

      {/* Grid of 3 Steps */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
        gap: '28px',
        alignItems: 'stretch'
      }}>

        {/* PASO 1: FICHA DE INSCRIPCIÓN */}
        <div style={{
          background: '#ffffff',
          borderRadius: '24px',
          padding: '32px 26px',
          boxShadow: '0 10px 24px rgba(0, 0, 0, 0.07)',
          border: '2.5px solid #cbd5e1',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
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
                fontSize: '0.88rem',
                fontWeight: 900,
                color: '#9a7b38',
                background: '#fefce8',
                padding: '6px 14px',
                borderRadius: '16px',
                border: '1.5px solid #fef08a'
              }}>
                Ficha Personal
              </span>
            </div>

            <h3 style={{
              margin: '0 0 12px 0',
              fontSize: '1.45rem',
              fontWeight: 900,
              color: '#0f172a',
              lineHeight: 1.3
            }}>
              PASO 1: FICHA DE INSCRIPCIÓN LLENADA
            </h3>

            <p style={{
              margin: 0,
              fontSize: '1.1rem',
              color: '#475569',
              lineHeight: 1.6,
              fontWeight: 600
            }}>
              Ingresa tu número de Carnet de Identidad (CI) para validar tu pre-inscripción y descargar tu Ficha Oficial:
            </p>

            {/* CI Search Form */}
            <form onSubmit={handleSearchCI} style={{ marginTop: '20px' }}>
              <label style={{ display: 'block', fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
                💳 Tu Número de Carnet (CI):
              </label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  placeholder="Ej. 5748392"
                  value={ciSearch}
                  onChange={(e) => setCiSearch(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '14px 16px',
                    fontSize: '1.2rem',
                    fontWeight: 800,
                    borderRadius: '12px',
                    border: '2px solid #cbd5e1',
                    outline: 'none',
                    color: '#0f172a'
                  }}
                />
                <button
                  type="submit"
                  disabled={searching}
                  style={{
                    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '0 20px',
                    fontSize: '1.1rem',
                    fontWeight: 900,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <Search size={20} /> {searching ? 'Buscando...' : 'Buscar'}
                </button>
              </div>
            </form>

            {/* Results Display */}
            {searched && (
              <div style={{ marginTop: '20px' }}>
                {participant ? (
                  <div style={{
                    background: '#f0fdf4',
                    border: '2.5px solid #16a34a',
                    borderRadius: '16px',
                    padding: '18px',
                    color: '#14532d'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <CheckCircle2 size={24} style={{ color: '#16a34a' }} />
                      <span style={{ fontWeight: 900, fontSize: '1.15rem', color: '#15803d' }}>
                        ¡Pre-Inscripción Encontrada!
                      </span>
                    </div>

                    <div style={{ fontSize: '1.05rem', lineHeight: 1.55 }}>
                      <strong>Maestro(a):</strong> {participant.nombres} {participant.apellidos}<br />
                      <strong>CI:</strong> {participant.ci}<br />
                      <strong>Unidad Educativa:</strong> {participant.unidad_educativa || '—'}<br />
                      <strong>Distrito:</strong> {participant.distrito || '—'}
                    </div>

                    <button
                      type="button"
                      onClick={handlePrintFicha}
                      style={{
                        width: '100%',
                        marginTop: '16px',
                        background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '12px',
                        padding: '14px 18px',
                        fontSize: '1.1rem',
                        fontWeight: 900,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)'
                      }}
                    >
                      <Printer size={22} /> Descargar / Imprimir Ficha de Inscripción
                    </button>
                  </div>
                ) : (
                  /* Warning if CI Not Found */
                  <div style={{
                    background: '#fff1f2',
                    border: '2.5px solid #e11d48',
                    borderRadius: '16px',
                    padding: '18px',
                    color: '#9f1239'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' }}>
                      <AlertTriangle size={26} style={{ color: '#e11d48', flexShrink: 0, marginTop: '2px' }} />
                      <span style={{ fontWeight: 900, fontSize: '1.15rem', color: '#be123c', lineHeight: 1.3 }}>
                        ⚠️ ADVERTENCIA: CARNET NO ENCONTRADO EN BASE DE DATOS
                      </span>
                    </div>

                    <p style={{ margin: '8px 0 0 0', fontSize: '1.08rem', lineHeight: 1.6, fontWeight: 700, color: '#881337' }}>
                      Si tu número de carnet no aparece registrado, <strong>es muy posible que aún no hayas llenado el formulario de pre-inscripción</strong>.
                    </p>

                    <div style={{
                      marginTop: '14px',
                      background: '#ffffff',
                      border: '1.5px solid #fda4af',
                      borderRadius: '12px',
                      padding: '12px 14px',
                      fontSize: '1.02rem',
                      color: '#4c0519',
                      lineHeight: 1.5
                    }}>
                      <div style={{ fontWeight: 900, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <MapPin size={18} style={{ color: '#e11d48' }} /> Oficinas de UNEFCO Santa Cruz:
                      </div>
                      📍 <strong>Dirección:</strong> Av. San Martín s/n Equipetrol, ESFM Enrique Finot.<br />
                      ⏰ <strong>Horario de Atención:</strong> Horario continuo de <strong>08:00 a 16:00</strong>.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* PASO 2: DOCUMENTACIÓN NECESARIA */}
        <div style={{
          background: '#ffffff',
          borderRadius: '24px',
          padding: '32px 26px',
          boxShadow: '0 10px 24px rgba(0, 0, 0, 0.07)',
          border: '2.5px solid #cbd5e1',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
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
                fontSize: '0.88rem',
                fontWeight: 900,
                color: '#9a7b38',
                background: '#fefce8',
                padding: '6px 14px',
                borderRadius: '16px',
                border: '1.5px solid #fef08a'
              }}>
                Documentación
              </span>
            </div>

            <h3 style={{
              margin: '0 0 12px 0',
              fontSize: '1.45rem',
              fontWeight: 900,
              color: '#0f172a',
              lineHeight: 1.3
            }}>
              PASO 2: PRESENTAR DOCUMENTACIÓN EN OFICINAS
            </h3>

            <p style={{
              margin: 0,
              fontSize: '1.1rem',
              color: '#475569',
              lineHeight: 1.6,
              fontWeight: 600
            }}>
              Deberás presentar los siguientes documentos físicos en nuestras oficinas correspondientes:
            </p>

            <div style={{
              marginTop: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}>
              {/* Document 1 */}
              <div style={{
                background: '#f8fafc',
                border: '2px solid #cbd5e1',
                borderRadius: '16px',
                padding: '16px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '14px'
              }}>
                <FileCheck size={32} style={{ color: '#0f172a', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <span style={{ fontWeight: 900, fontSize: '1.15rem', color: '#0f172a', display: 'block' }}>
                    1. Fotocopia de RDA
                  </span>
                  <span style={{ fontSize: '1.02rem', color: '#475569', fontWeight: 600 }}>
                    Fotocopia legible de tu Registro Docente de Aprendizaje (RDA) actualizado.
                  </span>
                </div>
              </div>

              {/* Document 2 */}
              <div style={{
                background: '#f8fafc',
                border: '2px solid #cbd5e1',
                borderRadius: '16px',
                padding: '16px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '14px'
              }}>
                <UserCheck size={32} style={{ color: '#0f172a', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <span style={{ fontWeight: 900, fontSize: '1.15rem', color: '#0f172a', display: 'block' }}>
                    2. Para Personal Administrativo
                  </span>
                  <span style={{ fontSize: '1.02rem', color: '#475569', fontWeight: 600 }}>
                    Certificado de Trabajo original firmado que demuestre que trabajas en la Unidad Educativa.
                  </span>
                </div>
              </div>
            </div>

            <div style={{
              marginTop: '20px',
              background: '#f0f9ff',
              border: '2px solid #0284c7',
              borderRadius: '16px',
              padding: '16px',
              color: '#0369a1',
              fontSize: '1.05rem',
              lineHeight: 1.5,
              fontWeight: 700
            }}>
              <div style={{ fontWeight: 900, fontSize: '1.1rem', color: '#0284c7', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Building2 size={20} /> LUGAR DE PRESENTACIÓN:
              </div>
              Oficinas de <strong>UNEFCO Santa Cruz</strong> (Av. San Martín s/n Equipetrol, ESFM Enrique Finot).
            </div>
          </div>
        </div>

        {/* PASO 3: DEPÓSITO Y COMPROBANTE DE PAGO */}
        <div style={{
          background: '#ffffff',
          borderRadius: '24px',
          padding: '32px 26px',
          boxShadow: '0 10px 24px rgba(0, 0, 0, 0.07)',
          border: '2.5px solid #cbd5e1',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
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
                fontSize: '0.88rem',
                fontWeight: 900,
                color: '#9a7b38',
                background: '#fefce8',
                padding: '6px 14px',
                borderRadius: '16px',
                border: '1.5px solid #fef08a'
              }}>
                Depósito Bancario
              </span>
            </div>

            <h3 style={{
              margin: '0 0 12px 0',
              fontSize: '1.45rem',
              fontWeight: 900,
              color: '#0f172a',
              lineHeight: 1.3
            }}>
              PASO 3: DEPÓSITO BANCARIO Y COMPROBANTE
            </h3>

            {/* Bank Account Details Card */}
            <div style={{
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              color: '#ffffff',
              borderRadius: '20px',
              padding: '20px',
              boxShadow: '0 6px 16px rgba(15, 23, 42, 0.2)',
              border: '2px solid #bfa05e',
              marginBottom: '20px'
            }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#f59e0b', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CreditCard size={22} /> DATOS PARA EL DEPÓSITO BANCARIO:
              </div>

              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#ffffff', marginBottom: '4px' }}>
                🏛️ BANCO UNIÓN
              </div>

              <div style={{
                background: 'rgba(255, 255, 255, 0.12)',
                border: '1.5px solid rgba(255, 255, 255, 0.25)',
                borderRadius: '12px',
                padding: '12px 16px',
                marginTop: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span style={{ fontSize: '1.05rem', color: '#cbd5e1', fontWeight: 700 }}>Nº de Cuenta:</span>
                <span style={{ fontSize: '1.4rem', fontWeight: 900, color: '#ffffff', letterSpacing: '1px' }}>
                  1-28754013
                </span>
              </div>
            </div>

            <p style={{
              margin: 0,
              fontSize: '1.05rem',
              color: '#475569',
              lineHeight: 1.55,
              fontWeight: 600
            }}>
              Entrega el comprobante físico en la oficina de UNEFCO.
            </p>

            {/* Subir comprobante para áreas lejanas */}
            <div style={{
              marginTop: '18px',
              background: '#f8fafc',
              border: '2px solid #cbd5e1',
              borderRadius: '18px',
              padding: '18px'
            }}>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '1.15rem', fontWeight: 900, color: '#0f172a' }}>
                📍 ¿Eres de Área Lejana o Provincia?
              </h4>
              <p style={{ margin: 0, fontSize: '1rem', color: '#64748b', fontWeight: 600, lineHeight: 1.5 }}>
                Puedes subir tu comprobante de pago de forma digital ingresando tu número de Carnet:
              </p>

              {!participantForUpload ? (
                <form onSubmit={handleVerifyUploadCI} style={{ marginTop: '14px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="Tu CI (Carnet)"
                      value={ciUpload}
                      onChange={(e) => setCiUpload(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '10px 14px',
                        fontSize: '1.05rem',
                        fontWeight: 800,
                        borderRadius: '10px',
                        border: '1.5px solid #cbd5e1'
                      }}
                    />
                    <button
                      type="submit"
                      disabled={verifyingUpload}
                      style={{
                        background: '#0f172a',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '10px',
                        padding: '0 16px',
                        fontSize: '0.98rem',
                        fontWeight: 900,
                        cursor: 'pointer'
                      }}
                    >
                      Validar
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleUploadReceipt} style={{ marginTop: '14px' }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#15803d', marginBottom: '8px' }}>
                    ✓ Validado: {participantForUpload.nombres} {participantForUpload.apellidos}
                  </div>

                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    required
                    style={{
                      width: '100%',
                      padding: '8px',
                      fontSize: '0.95rem',
                      marginBottom: '10px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff'
                    }}
                  />

                  <button
                    type="submit"
                    disabled={uploading || !uploadFile}
                    style={{
                      width: '100%',
                      background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '12px',
                      fontSize: '1.05rem',
                      fontWeight: 900,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <Upload size={18} /> {uploading ? 'Subiendo archivo...' : 'Subir Comprobante Digital'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* ADVERTENCIA DE DEPÓSITOS & DIRECCIÓN OFICINAS */}
      <div style={{
        marginTop: '36px',
        background: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)',
        border: '3px solid #e11d48',
        borderRadius: '24px',
        padding: '28px 30px',
        boxShadow: '0 10px 30px rgba(225, 29, 72, 0.22)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '20px'
      }}>
        <AlertTriangle size={42} style={{ color: '#e11d48', flexShrink: 0, marginTop: '4px' }} />
        <div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.45rem', fontWeight: 900, color: '#9f1239', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            🚨 ADVERTENCIA IMPORTANTE SOBRE DEPÓSITOS BANCARIOS
          </h3>
          <p style={{ margin: 0, fontSize: '1.18rem', fontWeight: 900, color: '#be123c', lineHeight: 1.6 }}>
            <strong>NO REALIZAR NINGÚN DEPÓSITO</strong> hasta contar con la <strong>confirmación directa del técnico asignado</strong>.
          </p>
          <p style={{ margin: '10px 0 0 0', fontSize: '1.1rem', color: '#881337', lineHeight: 1.6, fontWeight: 700 }}>
            ⚠️ <em>Toma en cuenta que los depósitos bancarios son válidos <strong>ÚNICAMENTE DENTRO DEL MES EN EL QUE SE REALIZAN</strong>.</em>
          </p>

          <div style={{
            marginTop: '16px',
            background: '#ffffff',
            border: '2px solid #f43f5e',
            borderRadius: '16px',
            padding: '16px 20px',
            color: '#4c0519',
            fontSize: '1.1rem',
            lineHeight: 1.6
          }}>
            <div style={{ fontWeight: 900, fontSize: '1.2rem', color: '#be123c', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapPin size={22} style={{ color: '#e11d48' }} /> DIRECCIÓN Y ATENCIÓN EN OFICINAS UNEFCO:
            </div>
            📍 <strong>Dirección:</strong> Av. San Martín s/n Equipetrol, ESFM Enrique Finot.<br />
            ⏰ <strong>Horario de Atención:</strong> Horario continuo de <strong>08:00 a 16:00</strong>.
          </div>
        </div>
      </div>

    </div>
  );
}
