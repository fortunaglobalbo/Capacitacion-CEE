'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { 
  Search, Download, FileText, Building2, CreditCard, Upload, 
  AlertTriangle, CheckCircle2, MapPin, Clock, FileCheck, UserCheck, 
  Printer, Sparkles, PhoneCall, MessageCircle, ExternalLink, Layers, Check, Share2, Send
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

  // Search participant by CI in Supabase with catalog enrichment
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
      // 1. Fetch catalog from ciclos_formativos
      const { data: catData } = await supabase.from('ciclos_formativos').select('*');
      const cicMap = new Map<string, any>();
      if (catData) {
        catData.forEach(c => cicMap.set(c.id, c));
      }

      // 2. Fetch participant info
      const { data: partData } = await supabase
        .from('participantes')
        .select('*')
        .eq('ci', ci)
        .maybeSingle();

      // 3. Fetch enrollments by participante_ci
      const { data: cic1 } = await supabase
        .from('inscripcion_ciclo')
        .select('*, cursos(*)')
        .eq('participante_ci', ci);

      // 4. Fetch enrollments by ci_participante (fallback)
      const { data: cic2 } = await supabase
        .from('inscripcion_ciclo')
        .select('*, cursos(*)')
        .eq('ci_participante', ci);

      const enrolledMap = new Map<string, EnrolledCourse>();

      const combineItems = (items: any[] | null) => {
        if (!items) return;
        items.forEach((item: any) => {
          if (item.cursos) {
            const rawCurso = item.cursos;
            const cf = cicMap.get(rawCurso.ciclo_id) || {};
            
            const enrichedCourse: EnrolledCourse = {
              ...rawCurso,
              costo: rawCurso.costo || 150,
              ciclo_nombre: cf.nombre || rawCurso.ciclo_nombre || rawCurso.grupo_nombre || 'Programa Formativo UNEFCO',
              area_formativa: cf.area_formativa || rawCurso.area_formativa || rawCurso.ciclo_grupo || 'EDUCACIÓN CONTINUA',
              tema1: rawCurso.tema1 || cf.tema1 || rawCurso.grupo_nombre || '',
              tema2: rawCurso.tema2 || cf.tema2 || '',
              tema3: rawCurso.tema3 || cf.tema3 || '',
              tema4: rawCurso.tema4 || cf.tema4 || '',
              inscripcion_id: item.id,
              comprobante_url: item.comprobante_url || null
            };

            enrolledMap.set(String(rawCurso.id), enrichedCourse);
          }
        });
      };

      combineItems(cic1);
      combineItems(cic2);

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

  // Upload deposit receipt to Supabase for a course
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

      if (course.inscripcion_id) {
        await supabase
          .from('inscripcion_ciclo')
          .update({ comprobante_url: filePublicUrl })
          .eq('id', course.inscripcion_id);
      }

      setParticipant(prev => {
        if (!prev) return null;
        return {
          ...prev,
          cursos: prev.cursos.map(c => c.id === course.id ? { ...c, comprobante_url: filePublicUrl } : c)
        };
      });

      Swal.fire({
        icon: 'success',
        title: '¡Comprobante Registrado!',
        text: 'Tu comprobante de pago ha sido guardado exitosamente en el sistema de maestros.',
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

  // Share Ficha Link / Text via WhatsApp or Native Web Share
  const handleShareFicha = (targetCourse?: EnrolledCourse) => {
    if (!participant) return;
    const courseTitle = targetCourse?.ciclo_nombre || 'Programa Formativo UNEFCO';
    const text = `📄 *FICHA DE INSCRIPCIÓN UNEFCO SANTA CRUZ*\n👤 Maestro(a): ${participant.apellidos} ${participant.nombres}\n💳 CI: ${participant.ci}\n📚 Ciclo: ${courseTitle}\n💰 Precio: Bs. ${targetCourse?.costo || 150}\n\nIngresa a nuestra plataforma para consultar tus datos: ${window.location.href}`;

    if (navigator.share) {
      navigator.share({
        title: 'Ficha de Inscripción UNEFCO',
        text: text,
        url: window.location.href
      }).catch(() => {});
    } else {
      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
      window.open(waUrl, '_blank');
    }
  };

  // Print Official 2-up Letter Ficha de Inscripción (Only Area, Ciclo, Costo and Cursos pre-filled)
  const handlePrintOfficialFicha = (targetCourse?: EnrolledCourse) => {
    if (!participant) return;

    const courseToPrint: EnrolledCourse = targetCourse || participant.cursos[0] || {
      id: 'default',
      ciclo_nombre: 'PROGRAMA FORMATIVO CONTINUA UNEFCO',
      area_formativa: 'TECNOLOGÍA EDUCATIVA',
      costo: 150,
      distrito: participant.distrito || 'SANTA CRUZ'
    };

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      Swal.fire('Bloqueador', 'Habilita las ventanas flotantes para imprimir o guardar como PDF la ficha.', 'warning');
      return;
    }

    const logoMineduUrl = window.location.origin + '/logo-minedu.jpg';
    const logoUnefcoUrl = window.location.origin + '/logo-unefco.jpg';

    const buildFichaHtml = () => {
      return `
        <div class="ficha">
          <!-- Header Logos & Title -->
          <table class="header-table">
            <tr>
              <td width="35%" align="left" valign="middle">
                <img src="${logoMineduUrl}" class="logo-img" alt="Ministerio de Educación" />
              </td>
              <td width="30%" align="center" valign="middle">
                <div class="title-main">FICHA DE INSCRIPCIÓN</div>
                <div class="title-sub">ITINERARIOS FORMATIVOS - MODALIDAD SEMIPRESENCIAL</div>
              </td>
              <td width="35%" align="right" valign="middle">
                <img src="${logoUnefcoUrl}" class="logo-img" alt="UNEFCO" />
              </td>
            </tr>
          </table>

          <!-- 1. Table for Course Details (Pre-filled) -->
          <table class="data-table">
            <tr>
              <td class="lbl" width="18%">Área</td>
              <td class="val"><b>${courseToPrint.area_formativa || courseToPrint.ciclo_grupo || 'EDUCACIÓN CONTINUA'}</b></td>
            </tr>
            <tr>
              <td class="lbl">Ciclo Formativo</td>
              <td class="val"><b>${courseToPrint.ciclo_nombre || 'PROGRAMA FORMATIVO UNEFCO'}</b></td>
            </tr>
            <tr>
              <td class="lbl">Costo / Monto</td>
              <td class="val"><b>Bs. ${courseToPrint.costo || 150}</b></td>
            </tr>
            <tr>
              <td class="lbl">Curso Nº 1</td>
              <td class="val">${courseToPrint.tema1 || ''}</td>
            </tr>
            <tr>
              <td class="lbl">Curso Nº 2</td>
              <td class="val">${courseToPrint.tema2 || ''}</td>
            </tr>
            <tr>
              <td class="lbl">Curso Nº 3</td>
              <td class="val">${courseToPrint.tema3 || ''}</td>
            </tr>
            <tr>
              <td class="lbl">Curso Nº 4</td>
              <td class="val">${courseToPrint.tema4 || ''}</td>
            </tr>
          </table>

          <!-- 2. Personal Info Section (BLANK for manual completion) -->
          <table class="personal-table">
            <tr>
              <td class="lbl" width="20%">Apellido(s) y Nombre(s):</td>
              <td class="val" colspan="3"></td>
              <td class="lbl" width="12%">Telf/Cel:</td>
              <td class="val" width="15%"></td>
            </tr>
            <tr>
              <td class="lbl">Carnet de Identidad:</td>
              <td class="val" width="25%"></td>
              <td class="lbl" width="10%">E-mail:</td>
              <td class="val"></td>
              <td class="lbl">RDA/RP:</td>
              <td class="val"></td>
            </tr>
            <tr>
              <td class="lbl">Fecha de Nacimiento:</td>
              <td class="val" colspan="5"></td>
            </tr>
          </table>

          <!-- 3. Form Selection Options (Checkboxes BLANK) -->
          <div class="checks-section">
            <div class="check-row">
              <span class="lbl-check">Función que cumple:</span>
              <span class="chk-box-label">Docente <span class="chk"></span></span>
              <span class="chk-box-label">Director <span class="chk"></span></span>
              <span class="chk-box-label">Administrativo <span class="chk"></span></span>
              <span class="chk-box-label">Estudiante ESFM <span class="chk"></span></span>
              <span class="chk-box-label">Estudiante Sec. <span class="chk"></span></span>
              <span class="chk-box-label">Padre de Familia <span class="chk"></span></span>
              <span class="chk-box-label">No aplica <span class="chk"></span></span>
            </div>

            <div class="check-row">
              <span class="lbl-check">Área:</span>
              <span class="chk-box-label">Urbano <span class="chk"></span></span>
              <span class="chk-box-label">Rural <span class="chk"></span></span>
            </div>

            <table class="check-table">
              <tr>
                <td width="75%">
                  <div class="field-line">
                    <span class="lbl-line">Distrito Educativo:</span>
                    <span class="val-line"></span>
                  </div>
                  <div class="field-line">
                    <span class="lbl-line">Unidad Educativa:</span>
                    <span class="val-line"></span>
                  </div>
                </td>
                <td width="25%" align="right">
                  <div class="check-vertical">
                    <span class="chk-box-label">No aplica <span class="chk"></span></span>
                    <span class="chk-box-label">No aplica <span class="chk"></span></span>
                  </div>
                </td>
              </tr>
            </table>

            <div class="check-row" style="margin-top: 4px;">
              <span class="lbl-check">Subsistema:</span>
              <span class="chk-box-label">Educación Regular <span class="chk"></span></span>
              <span class="chk-box-label">Educación Alternativa y Especial <span class="chk"></span></span>
              <span class="chk-box-label">Ed. Superior <span class="chk"></span></span>
              <span class="chk-box-label">No aplica <span class="chk"></span></span>
            </div>

            <div class="check-row">
              <span class="lbl-check">Nivel de Ed. Regular:</span>
              <span class="chk-box-label">Inicial <span class="chk"></span></span>
              <span class="chk-box-label">Primaria <span class="chk"></span></span>
              <span class="chk-box-label">Secundaria <span class="chk"></span></span>
              <span class="chk-box-label">Ed. Superior <span class="chk"></span></span>
              <span class="chk-box-label">No aplica <span class="chk"></span></span>
            </div>
          </div>

          <!-- 4. Footer & Signature (BLANK) -->
          <table class="footer-table">
            <tr>
              <td width="50%" align="left" valign="bottom">
                <span class="lbl">Fecha de inscripción:</span>
                <span style="border-bottom: 1px solid #000; padding: 0 20px; font-weight: bold;">
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                </span> / 
                <span style="border-bottom: 1px solid #000; padding: 0 20px; font-weight: bold;">
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                </span> / 
                <span style="border-bottom: 1px solid #000; padding: 0 30px; font-weight: bold;">
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                </span>
              </td>
              <td width="50%" align="center" valign="bottom">
                <div class="signature-line"></div>
                <div class="signature-lbl">Firma Participante</div>
              </td>
            </tr>
          </table>
        </div>
      `;
    };

    const fichaHtml = buildFichaHtml();

    printWindow.document.write(`
      <html>
      <head>
        <title>Ficha de Inscripción - ${participant.ci}</title>
        <style>
          @page {
            size: letter portrait;
            margin: 0.25in 0.25in;
          }
          html, body {
            height: 100%;
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            background: #fff;
          }
          .sheet-container {
            display: flex;
            flex-direction: column;
            height: 100%;
            justify-content: space-between;
            box-sizing: border-box;
            padding: 0.1in 0;
            position: relative;
          }
          .ficha {
            height: 48%;
            box-sizing: border-box;
            border: 2px solid #000;
            border-radius: 4px;
            padding: 10px 14px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            position: relative;
            background: #fff;
          }
          .divider-line {
            border-top: 1.5px dashed #777;
            width: 100%;
            text-align: center;
            padding: 6px 0;
            font-size: 8pt;
            color: #555;
            box-sizing: border-box;
          }
          table { width: 100%; border-collapse: collapse; }
          .header-table { margin-bottom: 6px; border-bottom: 1.5px solid #000; padding-bottom: 4px; }
          .logo-img { height: 44px; max-width: 100%; object-fit: contain; display: block; }
          .title-main { font-size: 13pt; font-weight: bold; letter-spacing: 0.5px; color: #000; line-height: 1.1; }
          .title-sub { font-size: 7.2pt; font-weight: bold; color: #333; }
          .lbl { font-size: 7.8pt; font-weight: bold; color: #000; }
          .val { font-size: 8.2pt; color: #111; }
          .data-table { margin-bottom: 6px; }
          .data-table td { border: 1px solid #000; padding: 3px 5px; vertical-align: middle; }
          .data-table .lbl { background-color: #f2f2f2; text-align: right; padding-right: 8px; }
          .personal-table { margin-bottom: 6px; }
          .personal-table td { border: 1px solid #000; padding: 3px 5px; vertical-align: middle; }
          .personal-table .lbl { background-color: #f2f2f2; text-align: right; padding-right: 6px; }
          .checks-section { font-size: 7pt; line-height: 1.15; margin-bottom: 6px; flex: 1; display: flex; flex-direction: column; justify-content: flex-start; }
          .check-row { margin-bottom: 4px; display: flex; flex-wrap: wrap; align-items: center; }
          .lbl-check { font-weight: bold; margin-right: 8px; width: 100px; display: inline-block; }
          .chk-box-label { margin-right: 10px; display: inline-flex; align-items: center; gap: 4px; }
          .chk { display: inline-block; width: 11px; height: 11px; border: 1.5px solid #000; text-align: center; font-size: 7pt; line-height: 11px; font-weight: bold; background: #fff; }
          .check-table { width: 100%; }
          .check-table td { padding: 0; vertical-align: middle; }
          .field-line { display: flex; align-items: flex-end; margin-bottom: 3px; width: 98%; }
          .lbl-line { font-weight: bold; margin-right: 6px; white-space: nowrap; }
          .val-line { border-bottom: 1px solid #444; flex: 1; padding-left: 5px; font-size: 8pt; font-weight: bold; height: 13px; line-height: 13px; }
          .check-vertical { display: flex; flex-direction: column; gap: 3px; align-items: flex-end; }
          .footer-table { margin-top: auto; padding-top: 6px; }
          .signature-line { border-top: 1px solid #000; width: 80%; margin: 0 auto; }
          .signature-lbl { font-size: 8pt; font-weight: bold; margin-top: 2px; }
        </style>
      </head>
      <body>
        <div class="sheet-container">
          <!-- Duplicate Copy 1 (UNEFCO COPY) -->
          ${fichaHtml}
          
          <!-- Visual line dividing the page when cutting -->
          <div class="divider-line">---------------------- CORTE POR AQUÍ PARA ENTREGAR AL MAESTRO / UNEFCO ----------------------</div>
          
          <!-- Duplicate Copy 2 (PARTICIPANT COPY) -->
          ${fichaHtml}
        </div>
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          };
        </script>
      </body>
      </html>
    `);
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
          <Sparkles size={20} /> Guía Paso a Paso para la Inscripción UNEFCO
        </div>

        <h1 style={{
          margin: 0,
          fontSize: '2.4rem',
          fontWeight: 900,
          color: '#ffffff',
          letterSpacing: '0.5px',
          lineHeight: 1.25
        }}>
          PASOS Y FICHA OFICIAL DE INSCRIPCIÓN DE PARTICIPANTES
        </h1>

        <p style={{
          margin: '14px auto 0',
          maxWidth: '840px',
          fontSize: '1.18rem',
          color: '#cbd5e1',
          lineHeight: 1.6,
          fontWeight: 600
        }}>
          Sigue atentamente los 4 pasos para completar exitosamente tu inscripción a nuestros programas formativos.
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
          PASO 1: INGRESAR CARNET (CI) Y OBTENER FICHA DE INSCRIPCIÓN
        </h2>
        <p style={{ margin: 0, fontSize: '1.12rem', color: '#475569', fontWeight: 600, lineHeight: 1.6 }}>
          <strong>Instrucciones:</strong> Escribe tu número de Carnet de Identidad en el siguiente campo. El sistema verificará tu pre-inscripción y te dará las opciones para <strong>imprimir, descargar en PDF o compartir por WhatsApp</strong> tu Ficha Oficial de Inscripción.
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
                placeholder="Escribe tu número de Carnet de Identidad (CI)..."
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

                {/* List of enrolled cycles with price and ficha options */}
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
                              💰 Precio a Depositar: Bs. {c.costo || 150}
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

                        {/* Options: Print/PDF + Share WhatsApp */}
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={() => handlePrintOfficialFicha(c)}
                            style={{
                              background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '12px',
                              padding: '14px 20px',
                              fontSize: '1.05rem',
                              fontWeight: 900,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)'
                            }}
                          >
                            <Printer size={20} /> Imprimir / PDF
                          </button>

                          <button
                            type="button"
                            onClick={() => handleShareFicha(c)}
                            style={{
                              background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '12px',
                              padding: '14px 20px',
                              fontSize: '1.05rem',
                              fontWeight: 900,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              boxShadow: '0 4px 12px rgba(37, 211, 102, 0.25)'
                            }}
                          >
                            <Share2 size={20} /> Compartir Ficha
                          </button>
                        </div>
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
                      <span style={{ fontSize: '1.05rem', color: '#b45309', fontWeight: 800 }}>💰 Precio del Ciclo: Bs. 150</span>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        type="button"
                        onClick={() => handlePrintOfficialFicha()}
                        style={{
                          background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '12px',
                          padding: '14px 20px',
                          fontSize: '1.05rem',
                          fontWeight: 900,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                      >
                        <Printer size={20} /> Imprimir / PDF
                      </button>

                      <button
                        type="button"
                        onClick={() => handleShareFicha()}
                        style={{
                          background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '12px',
                          padding: '14px 20px',
                          fontSize: '1.05rem',
                          fontWeight: 900,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                      >
                        <Share2 size={20} /> Compartir Ficha
                      </button>
                    </div>
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
                    Escríbenos por WhatsApp a cualquiera de nuestros números de atención para verificar tu formulario:
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
        alignItems: 'stretch',
        marginBottom: '36px'
      }}>

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
              PASO 2: REUNIR LA DOCUMENTACIÓN REQUERIDA
            </h3>

            <p style={{
              margin: 0,
              fontSize: '1.1rem',
              color: '#475569',
              lineHeight: 1.6,
              fontWeight: 600
            }}>
              <strong>Instrucciones:</strong> Reúne la documentación física correspondiente según tu función desempeñada:
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
              PASO 3: DEPÓSITO BANCARIO Y REGISTRO DIGITAL
            </h3>

            <p style={{
              margin: '0 0 16px 0',
              fontSize: '1.1rem',
              color: '#475569',
              lineHeight: 1.6,
              fontWeight: 600
            }}>
              <strong>Instrucciones:</strong> Realiza el depósito correspondiente a la cuenta bancaria oficial de UNEFCO y registra tu comprobante digitalmente:
            </p>

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
                <CreditCard size={22} /> CUENTA BANCARIA OFICIAL:
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
                  📤 REGISTRAR TU COMPROBANTE DIGITAL
                </h4>
                <p style={{ margin: '0 0 14px 0', fontSize: '1rem', color: '#166534', fontWeight: 600 }}>
                  Adjunta el archivo o foto de tu voucher de depósito para tu ciclo:
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
                      {course.ciclo_nombre || course.grupo_nombre || 'Curso Registrado'} (Bs. {course.costo || 150})
                    </div>

                    {course.comprobante_url ? (
                      <div style={{ color: '#166534', fontWeight: 800, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Check size={18} /> ¡Comprobante registrado exitosamente!
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
                💳 <strong>Monto a Depositar:</strong> Ingresa tu Carnet en el <strong>Paso 1</strong> para habilitar la subida del comprobante digital.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* PASO 4: ENTREGA FINAL EN OFICINAS DE UNEFCO */}
      <div style={{
        background: '#ffffff',
        borderRadius: '24px',
        padding: '32px 28px',
        boxShadow: '0 10px 28px rgba(2, 132, 199, 0.12)',
        border: '3.5px solid #0284c7',
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
            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            color: '#ffffff',
            fontWeight: 900,
            fontSize: '1.6rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)'
          }}>
            4
          </span>
          <span style={{
            fontSize: '0.9rem',
            fontWeight: 900,
            color: '#0369a1',
            background: '#f0f9ff',
            padding: '6px 16px',
            borderRadius: '16px',
            border: '1.5px solid #bae6fd'
          }}>
            Paso 4: Entrega Final
          </span>
        </div>

        <h2 style={{ margin: '0 0 12px 0', fontSize: '1.6rem', fontWeight: 900, color: '#0f172a' }}>
          PASO 4: ENTREGA FINAL DE REQUISITOS EN OFICINAS
        </h2>
        <p style={{ margin: 0, fontSize: '1.12rem', color: '#334155', fontWeight: 600, lineHeight: 1.6 }}>
          Una vez cumplidos los tres pasos anteriores, apersónate a nuestras oficinas a entregar los 3 documentos completos para finalizar tu inscripción:
        </p>

        <div style={{
          marginTop: '20px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '16px'
        }}>
          <div style={{ background: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: '16px', padding: '16px' }}>
            <span style={{ fontWeight: 900, fontSize: '1.1rem', color: '#0f172a', display: 'block', marginBottom: '4px' }}>
              1. Ficha de Inscripción
            </span>
            <span style={{ fontSize: '1rem', color: '#475569', fontWeight: 600 }}>
              La Ficha de Inscripción impresa y completada con tus datos llenados a mano y firmada.
            </span>
          </div>

          <div style={{ background: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: '16px', padding: '16px' }}>
            <span style={{ fontWeight: 900, fontSize: '1.1rem', color: '#0f172a', display: 'block', marginBottom: '4px' }}>
              2. Fotocopia de RDA o Certificado
            </span>
            <span style={{ fontSize: '1rem', color: '#475569', fontWeight: 600 }}>
              Fotocopia de tu RDA actualizado (o Certificado de Trabajo si eres personal Administrativo).
            </span>
          </div>

          <div style={{ background: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: '16px', padding: '16px' }}>
            <span style={{ fontWeight: 900, fontSize: '1.1rem', color: '#0f172a', display: 'block', marginBottom: '4px' }}>
              3. Comprobante de Depósito
            </span>
            <span style={{ fontSize: '1rem', color: '#475569', fontWeight: 600 }}>
              El comprobante bancario original de depósito realizado a la cuenta del Banco Unión.
            </span>
          </div>
        </div>

        {/* LUGAR DE PRESENTACION */}
        <div style={{
          marginTop: '24px',
          background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
          color: '#ffffff',
          borderRadius: '18px',
          padding: '22px 24px',
          boxShadow: '0 6px 18px rgba(2, 132, 199, 0.25)'
        }}>
          <div style={{ fontWeight: 900, fontSize: '1.25rem', color: '#ffffff', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={24} /> LUGAR DE PRESENTACIÓN EN OFICINAS:
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f0f9ff', lineHeight: 1.6 }}>
            📍 <strong>Dirección:</strong> Oficinas de UNEFCO Santa Cruz (Av. San Martín s/n Equipetrol, ESFM Enrique Finot).<br />
            ⏰ <strong>Horario de Atención:</strong> Horario continuo de <strong>08:00 a 16:00</strong>.
          </div>
        </div>
      </div>

      {/* ADVERTENCIA DE DEPÓSITOS & CONFIRMACIÓN TÉCNICA DEPARTAMENTAL */}
      <div style={{
        background: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)',
        border: '3.5px solid #e11d48',
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
            <strong>NO REALIZAR NINGÚN DEPÓSITO</strong> hasta contar con la <strong>confirmación directa del técnico departamental asignado</strong>.
          </p>
          <p style={{ margin: '10px 0 0 0', fontSize: '1.12rem', color: '#881337', lineHeight: 1.6, fontWeight: 800 }}>
            📲 <em>Cualquier comunicado oficial se dará únicamente a través del <strong>grupo de WhatsApp oficial</strong> del curso.</em>
          </p>
          <p style={{ margin: '8px 0 0 0', fontSize: '1.05rem', color: '#9f1239', lineHeight: 1.55, fontWeight: 700 }}>
            ⚠️ <em>Toma en cuenta que los depósitos bancarios son válidos <strong>ÚNICAMENTE DENTRO DEL MES EN EL QUE SE REALIZAN</strong>.</em>
          </p>
        </div>
      </div>

    </div>
  );
}
