'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { 
  Search, Download, FileText, Building2, CreditCard, Upload,
  AlertTriangle, CheckCircle2, MapPin, Clock, FileCheck, UserCheck, 
  Printer, Sparkles, PhoneCall, MessageCircle, ExternalLink, BookOpen, Layers, Check
} from 'lucide-react';
import Swal from 'sweetalert2';

interface EnrolledCourse {
  id: string | number;
  ciclo_nombre?: string;
  grupo_nombre?: string;
  area_formativa?: string;
  ciclo_grupo?: string;
  costo?: number;
  tema1?: string;
  tema2?: string;
  tema3?: string;
  tema4?: string;
  facilitador_nombre?: string;
  tecnico_nombre?: string;
  distrito?: string;
  lugar?: string;
  area_urbano_rural?: string;
  inscripcion_id?: string | number;
  comprobante_url?: string | null;
}

interface ParticipantData {
  ci: string;
  nombres: string;
  apellidos: string;
  rda?: string;
  celular?: string;
  correo?: string;
  unidad_educativa?: string;
  distrito?: string;
  cargo?: string;
  especialidad?: string;
  sie?: string;
  cursos: EnrolledCourse[];
}

export function InscripcionesPublicComponent() {
  const [ciSearch, setCiSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [participant, setParticipant] = useState<ParticipantData | null>(null);
  const [searched, setSearched] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Upload receipt states per course
  const [uploadingCourseId, setUploadingCourseId] = useState<string | number | null>(null);

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

  // Search participant by CI in Supabase
  const handleSearchCI = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const ci = ciSearch.trim();
    if (!ci) {
      Swal.fire({
        icon: 'warning',
        title: 'Ingresa tu Carnet',
        text: 'Por favor escribe tu número de Carnet de Identidad (CI) para consultar tus datos.',
        confirmButtonColor: '#0f172a'
      });
      return;
    }

    setSearching(true);
    setSearched(false);
    setParticipant(null);

    try {
      // 1. Fetch participant info
      const { data: partData } = await supabase
        .from('participantes')
        .select('*')
        .eq('ci', ci)
        .maybeSingle();

      // 2. Fetch cycle enrollments from inscripcion_ciclo
      const { data: cicloData } = await supabase
        .from('inscripcion_ciclo')
        .select('*, cursos(*)')
        .eq('ci_participante', ci);

      // 3. Fetch regular enrollments from inscripciones
      const { data: regularData } = await supabase
        .from('inscripciones')
        .select('*, cursos(*)')
        .eq('ci_participante', ci);

      const enrolledMap = new Map<string, EnrolledCourse>();

      if (cicloData) {
        cicloData.forEach((item: any) => {
          if (item.cursos) {
            enrolledMap.set(String(item.cursos.id), {
              ...item.cursos,
              inscripcion_id: item.id,
              comprobante_url: item.comprobante_url || null
            });
          }
        });
      }

      if (regularData) {
        regularData.forEach((item: any) => {
          if (item.cursos) {
            const existing = enrolledMap.get(String(item.cursos.id));
            if (!existing) {
              enrolledMap.set(String(item.cursos.id), {
                ...item.cursos,
                inscripcion_id: item.id,
                comprobante_url: item.comprobante_url || null
              });
            }
          }
        });
      }

      const coursesList = Array.from(enrolledMap.values());

      if (partData || coursesList.length > 0) {
        setParticipant({
          ci: partData?.ci || ci,
          nombres: partData?.nombres || 'Participante',
          apellidos: partData?.apellidos || '',
          rda: partData?.rda || '',
          celular: partData?.celular || '',
          correo: partData?.correo || '',
          unidad_educativa: partData?.unidad_educativa || partData?.colegio || '',
          distrito: partData?.distrito || '',
          cargo: partData?.cargo || 'DOCENTE',
          especialidad: partData?.especialidad || '',
          sie: partData?.sie || '',
          cursos: coursesList
        });
      } else {
        setParticipant(null);
      }
    } catch (err) {
      console.error('Error al buscar CI:', err);
    } finally {
      setSearching(false);
      setSearched(true);
    }
  };

  // Upload deposit receipt to Supabase for specific course
  const handleUploadVoucher = async (course: EnrolledCourse, file: File) => {
    if (!participant || !file) return;

    setUploadingCourseId(course.id);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `voucher_${participant.ci}_curso_${course.id}_${Date.now()}.${fileExt}`;
      const filePath = `comprobantes/${fileName}`;

      const { error: uploadErr } = await supabase.storage
        .from('comprobantes')
        .upload(filePath, file, { upsert: true });

      let filePublicUrl = filePath;
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from('comprobantes').getPublicUrl(filePath);
        if (urlData) filePublicUrl = urlData.publicUrl;
      }

      // Update inscripcion_ciclo or inscripciones record
      if (course.inscripcion_id) {
        await supabase
          .from('inscripcion_ciclo')
          .update({ comprobante_url: filePublicUrl })
          .eq('id', course.inscripcion_id);
      }

      // Update local state
      setParticipant(prev => {
        if (!prev) return null;
        return {
          ...prev,
          cursos: prev.cursos.map(c => c.id === course.id ? { ...c, comprobante_url: filePublicUrl } : c)
        };
      });

      Swal.fire({
        icon: 'success',
        title: '¡Comprobante Subido!',
        text: 'Tu comprobante de pago ha sido guardado exitosamente en el sistema para la revisión del técnico.',
        confirmButtonColor: '#16a34a'
      });
    } catch (err: any) {
      console.error('Error al subir comprobante:', err);
      Swal.fire({
        icon: 'error',
        title: 'Error al subir',
        text: err.message || 'No se pudo guardar el archivo.',
        confirmButtonColor: '#dc2626'
      });
    } finally {
      setUploadingCourseId(null);
    }
  };

  // Print Official Ficha de Inscripción matching system template
  const handlePrintOfficialFicha = (targetCourse?: EnrolledCourse) => {
    if (!participant) return;

    const courseToPrint: EnrolledCourse = targetCourse || participant.cursos[0] || {
      id: 'default',
      ciclo_nombre: 'PROGRAMA DE FORMACIÓN CONTINUA UNEFCO',
      area_formativa: 'TECNOLOGÍA EDUCATIVA',
      costo: 40,
      distrito: participant.distrito || 'SANTA CRUZ'
    };

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      Swal.fire('Bloqueador', 'Habilita las ventanas emergentes en tu navegador para imprimir la Ficha.', 'warning');
      return;
    }

    const todayStr = new Date().toLocaleDateString('es-BO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

    const isUrbano = (courseToPrint.area_urbano_rural || '').toUpperCase().includes('URBANO');
    const isRural = (courseToPrint.area_urbano_rural || '').toUpperCase().includes('RURAL');

    const groupText = (courseToPrint.ciclo_grupo || courseToPrint.area_formativa || '').toUpperCase();
    const isInicial = groupText.includes('INICIAL');
    const isPrimaria = groupText.includes('PRIMARIA');
    const isSecundaria = groupText.includes('SECUNDARIA');

    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Ficha de Inscripción - ${participant.ci}</title>
        <style>
          @page { size: letter portrait; margin: 0.3in 0.25in; }
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #fff; color: #000; }
          .no-print { text-align: right; padding: 12px; background: #0f172a; color: white; }
          .no-print button { background: #16a34a; color: white; border: none; padding: 10px 22px; font-weight: bold; border-radius: 6px; cursor: pointer; font-size: 14px; }
          .ficha { border: 2px solid #000; border-radius: 4px; padding: 14px 18px; background: #fff; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; }
          .header-table { margin-bottom: 10px; border-bottom: 2px solid #000; padding-bottom: 6px; }
          .bolivia-pill { height: 8px; width: 70px; background: linear-gradient(to right, #e8112d 33.3%, #f7e112 33.3%, #f7e112 66.6%, #009e49 66.6%); margin-bottom: 4px; }
          .m-title { font-size: 8pt; font-weight: 800; }
          .m-sub { font-size: 6pt; color: #555; font-weight: bold; }
          .title-main { font-size: 15pt; font-weight: bold; text-align: center; }
          .title-sub { font-size: 8.5pt; font-weight: bold; text-align: center; color: #333; }
          .unefco-title { font-size: 14pt; font-weight: 900; color: #0c2340; text-align: right; }
          .unefco-sub { font-size: 6pt; color: #444; font-weight: 600; text-align: right; }
          .lbl { font-size: 8.5pt; font-weight: bold; background: #f2f2f2; text-align: right; padding-right: 8px; }
          .val { font-size: 9pt; }
          .data-table td, .personal-table td { border: 1px solid #000; padding: 4px 6px; vertical-align: middle; }
          .checks-section { margin-top: 10px; font-size: 8pt; }
          .check-row { margin-bottom: 6px; display: flex; align-items: center; gap: 12px; }
          .chk-box-label { font-size: 8pt; font-weight: 600; }
          .chk { display: inline-block; width: 14px; height: 14px; border: 1px solid #000; text-align: center; line-height: 14px; font-weight: bold; margin-left: 3px; }
          .footer-table { margin-top: 24px; }
          .signature-line { border-top: 1px solid #000; width: 200px; margin: 0 auto; }
          .signature-lbl { font-size: 8.5pt; font-weight: bold; text-align: center; margin-top: 4px; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="no-print">
          <button onclick="window.print()">🖨️ IMPRIMIR FICHA OFICIAL</button>
        </div>

        <div class="ficha">
          <table class="header-table">
            <tr>
              <td width="25%" align="left">
                <div class="bolivia-pill"></div>
                <div class="m-title">MINISTERIO DE EDUCACIÓN</div>
                <div class="m-sub">ESTADO PLURINACIONAL DE BOLIVIA</div>
              </td>
              <td width="50%" align="center">
                <div class="title-main">FICHA DE INSCRIPCIÓN</div>
                <div class="title-sub">ITINERARIOS FORMATIVOS - MODALIDAD SEMIPRESENCIAL</div>
              </td>
              <td width="25%" align="right">
                <div class="unefco-title">UNEFCO</div>
                <div class="unefco-sub">Unidad Especializada de Formación Continua</div>
              </td>
            </tr>
          </table>

          <table class="data-table" style="margin-bottom: 8px;">
            <tr>
              <td class="lbl" width="20%">Área Formativa</td>
              <td class="val"><b>${courseToPrint.area_formativa || courseToPrint.ciclo_grupo || 'EDUCACIÓN CONTINUA'}</b></td>
            </tr>
            <tr>
              <td class="lbl">Ciclo Formativo</td>
              <td class="val"><b>${courseToPrint.ciclo_nombre || 'PROGRAMA FORMATIVO UNEFCO'}</b></td>
            </tr>
            <tr>
              <td class="lbl">Costo / Monto</td>
              <td class="val"><b>Bs. ${courseToPrint.costo || 40}</b></td>
            </tr>
            <tr>
              <td class="lbl">Curso Nº 1</td>
              <td class="val">${courseToPrint.tema1 || courseToPrint.grupo_nombre || 'Módulo 1'}</td>
            </tr>
            <tr>
              <td class="lbl">Curso Nº 2</td>
              <td class="val">${courseToPrint.tema2 || '—'}</td>
            </tr>
            <tr>
              <td class="lbl">Curso Nº 3</td>
              <td class="val">${courseToPrint.tema3 || '—'}</td>
            </tr>
            <tr>
              <td class="lbl">Curso Nº 4</td>
              <td class="val">${courseToPrint.tema4 || '—'}</td>
            </tr>
          </table>

          <table class="personal-table" style="margin-bottom: 8px;">
            <tr>
              <td class="lbl" width="22%">Apellido(s) y Nombre(s):</td>
              <td class="val" colspan="3"><b>${participant.apellidos} ${participant.nombres}</b></td>
              <td class="lbl" width="12%">Telf/Cel:</td>
              <td class="val" width="15%">${participant.celular || '—'}</td>
            </tr>
            <tr>
              <td class="lbl">Carnet de Identidad:</td>
              <td class="val" width="25%"><b>${participant.ci}</b></td>
              <td class="lbl" width="10%">Correo:</td>
              <td class="val">${participant.correo || '—'}</td>
              <td class="lbl">RDA/RP:</td>
              <td class="val">${participant.rda || '—'}</td>
            </tr>
          </table>

          <div class="checks-section">
            <div class="check-row">
              <span style="font-weight:bold;">Función que cumple:</span>
              <span class="chk-box-label">Docente <span class="chk">X</span></span>
              <span class="chk-box-label">Director <span class="chk"></span></span>
              <span class="chk-box-label">Administrativo <span class="chk"></span></span>
              <span class="chk-box-label">Estudiante ESFM <span class="chk"></span></span>
            </div>

            <div class="check-row">
              <span style="font-weight:bold;">Área:</span>
              <span class="chk-box-label">Urbano <span class="chk">${isUrbano ? 'X' : ''}</span></span>
              <span class="chk-box-label">Rural <span class="chk">${isRural ? 'X' : ''}</span></span>
              <span style="font-weight:bold; margin-left: 20px;">Distrito:</span>
              <span>${courseToPrint.distrito || participant.distrito || 'SANTA CRUZ'}</span>
            </div>

            <div class="check-row">
              <span style="font-weight:bold;">Unidad Educativa:</span>
              <span>${participant.unidad_educativa || '—'} ${participant.sie ? `(SIE: ${participant.sie})` : ''}</span>
            </div>

            <div class="check-row">
              <span style="font-weight:bold;">Nivel de Ed. Regular:</span>
              <span class="chk-box-label">Inicial <span class="chk">${isInicial ? 'X' : ''}</span></span>
              <span class="chk-box-label">Primaria <span class="chk">${isPrimaria ? 'X' : ''}</span></span>
              <span class="chk-box-label">Secundaria <span class="chk">${isSecundaria ? 'X' : ''}</span></span>
            </div>
          </div>

          <table class="footer-table" style="width: 100%;">
            <tr>
              <td width="50%" align="left" valign="bottom">
                <span style="font-size: 8.5pt; font-weight: bold;">Fecha de inscripción:</span>
                <span style="border-bottom: 1px solid #000; padding: 0 10px; font-weight: bold;">
                  ${todayStr}
                </span>
              </td>
              <td width="50%" align="center" valign="bottom">
                <div class="signature-line"></div>
                <div class="signature-lbl">Firma del Participante (CI: ${participant.ci})</div>
              </td>
            </tr>
          </table>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
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
          Ingresa tu Carnet (CI) para consultar el nombre de tus ciclos, el precio a depositar, descargar tu Ficha Oficial y subir tu comprobante de pago.
        </p>
      </div>

      {/* PASO 1: SEARCH CI & FICHA DOWNLOAD */}
      <div style={{
        background: '#ffffff',
        borderRadius: '24px',
        padding: '32px 28px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
        border: '3.5px solid #bfa05e',
        marginBottom: '36px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px'
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
            fontSize: '0.9rem',
            fontWeight: 900,
            color: '#9a7b38',
            background: '#fefce8',
            padding: '6px 16px',
            borderRadius: '16px',
            border: '1.5px solid #fef08a'
          }}>
            Paso 1: Consulta y Ficha
          </span>
        </div>

        <h2 style={{ margin: '0 0 10px 0', fontSize: '1.6rem', fontWeight: 900, color: '#0f172a' }}>
          PASO 1: INGRESAR CARNET (CI) Y FICHA DE INSCRIPCIÓN
        </h2>
        <p style={{ margin: 0, fontSize: '1.12rem', color: '#475569', fontWeight: 600 }}>
          Escribe tu número de Carnet de Identidad para ver tus ciclos registrados, el costo a depositar y descargar tu Ficha:
        </p>

        {/* Responsive search input container */}
        <form onSubmit={handleSearchCI} style={{ marginTop: '20px' }}>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            alignItems: 'center'
          }}>
            <div style={{ flex: '1 1 280px', minWidth: '240px' }}>
              <input
                type="text"
                placeholder="Ingresa tu Carnet de Identidad (CI)..."
                value={ciSearch}
                onChange={(e) => setCiSearch(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '16px 20px',
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  borderRadius: '14px',
                  border: '2.5px solid #cbd5e1',
                  outline: 'none',
                  color: '#0f172a'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={searching}
              style={{
                flex: '0 0 auto',
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '14px',
                padding: '16px 32px',
                fontSize: '1.18rem',
                fontWeight: 900,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                boxShadow: '0 4px 14px rgba(15, 23, 42, 0.25)'
              }}
            >
              <Search size={22} /> {searching ? 'Buscando...' : 'Consultar Carnet'}
            </button>
          </div>
        </form>

        {/* SEARCH RESULTS */}
        {searched && (
          <div style={{ marginTop: '24px' }}>
            {participant ? (
              /* SUCCESS: Participant Found */
              <div style={{
                background: '#ffffff',
                borderRadius: '20px',
                padding: '24px',
                boxShadow: '0 8px 24px rgba(22, 163, 74, 0.12)',
                border: '3px solid #16a34a'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <CheckCircle2 size={36} style={{ color: '#16a34a', flexShrink: 0 }} />
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: '#15803d' }}>
                      ¡REGISTRO ENCONTRADO EN LA BASE DE DATOS!
                    </h3>
                    <span style={{ fontSize: '1.05rem', color: '#166534', fontWeight: 700 }}>
                      Maestro(a): {participant.apellidos} {participant.nombres} | CI: {participant.ci}
                    </span>
                  </div>
                </div>

                {/* List of enrolled cycles with price and ficha download */}
                <h4 style={{ margin: '18px 0 12px 0', fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={22} style={{ color: '#bfa05e' }} /> TUS CICLOS Y CURSOS REGISTRADOS ({participant.cursos.length}):
                </h4>

                {participant.cursos.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {participant.cursos.map((c, idx) => (
                      <div key={c.id || idx} style={{
                        background: '#f8fafc',
                        border: '2px solid #cbd5e1',
                        borderRadius: '16px',
                        padding: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '16px'
                      }}>
                        <div style={{ flex: '1 1 300px' }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                            <span style={{
                              background: '#0f172a',
                              color: '#ffffff',
                              padding: '4px 12px',
                              borderRadius: '10px',
                              fontSize: '0.85rem',
                              fontWeight: 900
                            }}>
                              CICLO {idx + 1}
                            </span>

                            {/* COST / PRECIO DEL CICLO */}
                            <span style={{
                              background: '#fefce8',
                              border: '1.5px solid #fef08a',
                              color: '#b45309',
                              padding: '4px 12px',
                              borderRadius: '10px',
                              fontSize: '0.95rem',
                              fontWeight: 900
                            }}>
                              💰 Precio: Bs. {c.costo || 40}
                            </span>
                          </div>

                          <h5 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}>
                            {c.ciclo_nombre || c.area_formativa || 'Programa Formativo UNEFCO'}
                          </h5>

                          <p style={{ margin: '6px 0 0 0', fontSize: '1.02rem', color: '#475569', fontWeight: 600 }}>
                            {c.grupo_nombre ? `Grupo: ${c.grupo_nombre} | ` : ''}
                            Distrito: {c.distrito || participant.distrito || 'Santa Cruz'}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handlePrintOfficialFicha(c)}
                          style={{
                            background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '12px',
                            padding: '14px 22px',
                            fontSize: '1.08rem',
                            fontWeight: 900,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)'
                          }}
                        >
                          <Printer size={20} /> Descargar Ficha del Ciclo {idx + 1}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{
                    background: '#f8fafc',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: '16px',
                    padding: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '14px'
                  }}>
                    <div>
                      <h5 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#0f172a' }}>
                        Pre-Inscripción Confirmada
                      </h5>
                      <span style={{ fontSize: '1.05rem', color: '#b45309', fontWeight: 800 }}>💰 Precio estándar: Bs. 40</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handlePrintOfficialFicha()}
                      style={{
                        background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '12px',
                        padding: '14px 22px',
                        fontSize: '1.08rem',
                        fontWeight: 900,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)'
                      }}
                    >
                      <Printer size={20} /> Imprimir Ficha Oficial
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* WARNING: CI NOT FOUND -> Contact info */
              <div style={{
                background: '#fff1f2',
                border: '3px solid #e11d48',
                borderRadius: '20px',
                padding: '24px',
                color: '#9f1239',
                boxShadow: '0 8px 24px rgba(225, 29, 72, 0.15)'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '14px' }}>
                  <AlertTriangle size={36} style={{ color: '#e11d48', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: '#be123c' }}>
                      ⚠️ NO TE ENCUENTRAS EN NUESTRA BASE DE DATOS
                    </h3>
                    <p style={{ margin: '6px 0 0 0', fontSize: '1.12rem', color: '#881337', fontWeight: 700, lineHeight: 1.55 }}>
                      Es muy posible que aún <strong>no hayas llenado el formulario de pre-inscripción</strong> o tu carnet fue escrito con algún error.
                    </p>
                  </div>
                </div>

                <div style={{
                  background: '#ffffff',
                  border: '2px solid #fda4af',
                  borderRadius: '16px',
                  padding: '18px',
                  color: '#4c0519',
                  marginTop: '14px'
                }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '1.2rem', fontWeight: 900, color: '#9f1239' }}>
                    📞 POR FAVOR CONTÁCTATE CON NOSOTROS PARA AYUDARTE:
                  </h4>
                  <p style={{ margin: '0 0 14px 0', fontSize: '1.05rem', fontWeight: 600, color: '#881337' }}>
                    Escríbenos por WhatsApp a cualquiera de nuestros números de atención:
                  </p>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '12px'
                  }}>
                    {contacts.map((c) => {
                      const walink = `https://wa.me/591${c.num}?text=Hola,%20consulte%20mi%20carnet%20y%20no%20aparezco%20registrado.%20Deseo%20inscribirme.`;
                      const isCopied = copied === c.num;
                      return (
                        <div key={c.num} style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: '#f8fafc',
                          border: '1.5px solid #cbd5e1',
                          borderRadius: '12px',
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
                                border: '1px solid #cbd5e1',
                                color: isCopied ? '#166534' : '#334155',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                fontSize: '0.8rem',
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
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontSize: '0.82rem',
                                fontWeight: 900,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <MessageCircle size={13} /> Chat
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* PASO 2 & PASO 3 GRID */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
        gap: '28px',
        alignItems: 'stretch'
      }}>

        {/* PASO 2: DOCUMENTACIÓN EN OFICINAS */}
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
              Presenta en nuestras oficinas la Ficha de Inscripción junto con los siguientes documentos requeridos:
            </p>

            <div style={{
              marginTop: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}>
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

        {/* PASO 3: DEPÓSITO BANCARIO & SUBIR COMPROBANTE */}
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
              padding: '22px',
              boxShadow: '0 6px 16px rgba(15, 23, 42, 0.2)',
              border: '2px solid #bfa05e',
              marginBottom: '20px'
            }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#f59e0b', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CreditCard size={22} /> DATOS PARA EL DEPÓSITO BANCARIO:
              </div>

              <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#ffffff', marginBottom: '6px' }}>
                🏛️ BANCO UNIÓN
              </div>

              <div style={{
                background: 'rgba(255, 255, 255, 0.12)',
                border: '1.5px solid rgba(255, 255, 255, 0.25)',
                borderRadius: '14px',
                padding: '14px 18px',
                marginTop: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <span style={{ fontSize: '1.1rem', color: '#cbd5e1', fontWeight: 700 }}>Nº de Cuenta Oficial:</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 900, color: '#ffffff', letterSpacing: '1px' }}>
                  1-28754013
                </span>
              </div>
            </div>

            {/* Subir comprobante para los ciclos en que está registrado */}
            {participant && participant.cursos.length > 0 ? (
              <div style={{
                background: '#f0fdf4',
                border: '2px solid #16a34a',
                borderRadius: '18px',
                padding: '18px'
              }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '1.2rem', fontWeight: 900, color: '#15803d' }}>
                  📤 SUBIR TU COMPROBANTE DE DEPÓSITO DIGITAL
                </h4>
                <p style={{ margin: '0 0 14px 0', fontSize: '1rem', color: '#166534', fontWeight: 600 }}>
                  Selecciona la foto o imagen de tu comprobante de pago para adjuntarlo a tu pre-inscripción:
                </p>

                {participant.cursos.map((course) => (
                  <div key={course.id} style={{
                    background: '#ffffff',
                    border: '1.5px solid #86efac',
                    borderRadius: '14px',
                    padding: '14px',
                    marginBottom: '12px'
                  }}>
                    <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a', marginBottom: '4px' }}>
                      {course.ciclo_nombre || course.grupo_nombre || 'Curso Registrado'} (Bs. {course.costo || 40})
                    </div>

                    {course.comprobante_url ? (
                      <div style={{ color: '#166534', fontWeight: 800, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Check size={18} /> ¡Comprobante ya subido al sistema!
                      </div>
                    ) : (
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadVoucher(course, file);
                        }}
                        disabled={uploadingCourseId === course.id}
                        style={{
                          width: '100%',
                          padding: '8px',
                          fontSize: '0.95rem',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          background: '#f8fafc'
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{
                background: '#f8fafc',
                border: '2px solid #cbd5e1',
                borderRadius: '16px',
                padding: '18px',
                fontSize: '1.08rem',
                color: '#334155',
                fontWeight: 600,
                lineHeight: 1.6
              }}>
                💳 <strong>Monto a Depositar:</strong> Consulta tu Carnet en el <strong>Paso 1</strong> para ver el monto exacto de tu ciclo (Bs. 40 / 50) y habilitar la opción de subir tu comprobante de depósito.
              </div>
            )}
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
