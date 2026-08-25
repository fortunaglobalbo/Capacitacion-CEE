'use client';

import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { 
  Search, Download, FileText, Building2, CreditCard, Upload, 
  AlertTriangle, CheckCircle2, MapPin, Clock, FileCheck, UserCheck, 
  Printer, Sparkles, PhoneCall, MessageCircle, ExternalLink, Layers, 
  Check, Share2, Send, ArrowRight, ArrowLeft, Camera, RefreshCw, Eye,
  HelpCircle, User, ShieldCheck, FileSpreadsheet
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
  link_whatsapp?: string | null;
  inscripcion_id?: string | number;
  comprobante_url?: string | null;
  documento_url?: string | null;
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

interface VirtualFichaForm {
  funcion: string;
  area: string;
  distrito: string;
  unidadEducativa: string;
  subsistema: string;
  nivel: string;
  celular: string;
  correo: string;
  rda: string;
  fechaNacimiento: string;
}

const cycleThemes = [
  {
    bg: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
    border: '2.5px solid #3b82f6',
    badgeBg: '#1d4ed8',
    badgeColor: '#ffffff',
    titleColor: '#1e3a8a',
    priceBg: '#ffffff',
    priceBorder: '#bfdbfe',
    priceColor: '#1d4ed8'
  },
  {
    bg: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
    border: '2.5px solid #22c55e',
    badgeBg: '#15803d',
    badgeColor: '#ffffff',
    titleColor: '#14532d',
    priceBg: '#ffffff',
    priceBorder: '#bbf7d0',
    priceColor: '#15803d'
  },
  {
    bg: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
    border: '2.5px solid #f59e0b',
    badgeBg: '#b45309',
    badgeColor: '#ffffff',
    titleColor: '#78350f',
    priceBg: '#ffffff',
    priceBorder: '#fde68a',
    priceColor: '#b45309'
  },
  {
    bg: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
    border: '2.5px solid #a855f7',
    badgeBg: '#7e22ce',
    badgeColor: '#ffffff',
    titleColor: '#581c87',
    priceBg: '#ffffff',
    priceBorder: '#e9d5ff',
    priceColor: '#7e22ce'
  }
];

export function InscripcionesPublicComponent() {
  const [ciSearch, setCiSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [participant, setParticipant] = useState<ParticipantData | null>(null);
  const [searched, setSearched] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Progressive Wizard Stage (Niveles 1, 2, 3, 4)
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [selectedCourseIdx, setSelectedCourseIdx] = useState<number>(0);

  // Virtual Ficha Form State
  const [virtualFicha, setVirtualFicha] = useState<VirtualFichaForm>({
    funcion: 'Docente',
    area: 'Urbano',
    distrito: 'SANTA CRUZ 1',
    unidadEducativa: '',
    subsistema: 'Educación Regular',
    nivel: 'Primaria',
    celular: '',
    correo: '',
    rda: '',
    fechaNacimiento: ''
  });

  // Document (RDA / Certificado) State
  const [uploadedDocUrl, setUploadedDocUrl] = useState<string | null>(null);
  const [docType, setDocType] = useState<'rda' | 'certificado'>('rda');
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Voucher State
  const [uploadingCourseId, setUploadingCourseId] = useState<string | number | null>(null);

  // Live Camera state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<'documento' | 'comprobante' | null>(null);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (cameraActive && videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream;
    }
  }, [cameraActive, videoStream]);

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

  // Filter input to numbers only
  const handleCiChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const onlyNums = e.target.value.replace(/\D/g, '');
    setCiSearch(onlyNums);
  };

  // Search participant by CI in Supabase
  const handleSearchCI = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const ci = ciSearch.trim();
    if (!ci) {
      Swal.fire({
        icon: 'warning',
        title: 'Ingresa tu Carnet',
        text: 'Por favor escribe únicamente los números de tu Carnet de Identidad (sin extensión ni letras).',
        confirmButtonColor: '#0f172a'
      });
      return;
    }

    setSearching(true);
    setSearched(false);
    setParticipant(null);
    setCurrentStep(1);

    try {
      // 1. Fetch catalog
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

      // 3. Fetch enrollments
      const { data: cic1 } = await supabase
        .from('inscripcion_ciclo')
        .select('*, cursos(*)')
        .eq('participante_ci', ci);

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
              link_whatsapp: rawCurso.link_inscripcion_externo || rawCurso.grupo_whatsapp || rawCurso.link_whatsapp || null,
              inscripcion_id: item.id,
              comprobante_url: item.comprobante_url || null,
              documento_url: item.documento_url || null
            };

            enrolledMap.set(String(rawCurso.id), enrichedCourse);
          }
        });
      };

      combineItems(cic1);
      combineItems(cic2);

      const coursesList = Array.from(enrolledMap.values());

      if (partData || coursesList.length > 0) {
        const foundPart: ParticipantData = {
          ci: partData?.ci || ci,
          nombres: partData?.nombres || 'Participante',
          apellidos: partData?.apellidos || '',
          rda: partData?.rda || '',
          celular: partData?.celular || '',
          correo: partData?.correo || '',
          unidad_educativa: partData?.unidad_educativa || partData?.colegio || '',
          distrito: partData?.distrito || 'SANTA CRUZ',
          cargo: partData?.cargo || 'DOCENTE',
          especialidad: partData?.especialidad || '',
          sie: partData?.sie || '',
          cursos: coursesList
        };

        setParticipant(foundPart);
        setSelectedCourseIdx(0);

        // Pre-fill virtual ficha with detected data
        setVirtualFicha({
          funcion: partData?.cargo?.toLowerCase().includes('admin') ? 'Administrativo' : (partData?.cargo?.toLowerCase().includes('direct') ? 'Director' : 'Docente'),
          area: 'Urbano',
          distrito: foundPart.distrito || 'SANTA CRUZ',
          unidadEducativa: foundPart.unidad_educativa || '',
          subsistema: 'Educación Regular',
          nivel: 'Primaria',
          celular: foundPart.celular || '',
          correo: foundPart.correo || '',
          rda: foundPart.rda || '',
          fechaNacimiento: ''
        });

        // Set existing document if any
        if (coursesList[0]?.documento_url) {
          setUploadedDocUrl(coursesList[0].documento_url);
        }
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

  // Start Camera
  const startCamera = async (target: 'documento' | 'comprobante') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      setVideoStream(stream);
      setCameraTarget(target);
      setCameraActive(true);
    } catch (err: any) {
      Swal.fire('Cámara', 'No se pudo acceder a la cámara del dispositivo: ' + err.message, 'warning');
    }
  };

  // Stop Camera
  const stopCamera = () => {
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      setVideoStream(null);
    }
    setCameraActive(false);
    setCameraTarget(null);
  };

  // Capture Photo from Camera
  const handleCapturePhoto = async () => {
    if (!videoRef.current || !videoStream || !cameraTarget) return;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 1280;
      canvas.height = videoRef.current.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);

      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `${cameraTarget}_${participant?.ci || 'ci'}_${Date.now()}.jpg`, { type: 'image/jpeg' });

      if (cameraTarget === 'documento') {
        await handleUploadDocument(file);
      } else if (cameraTarget === 'comprobante') {
        const activeCourse = participant?.cursos[selectedCourseIdx] || participant?.cursos[0];
        if (activeCourse) {
          await handleUploadVoucher(activeCourse, file);
        }
      }

      stopCamera();
    } catch (err: any) {
      Swal.fire('Error de captura', err.message || 'No se pudo procesar la foto.', 'error');
    }
  };

  // Upload RDA / Work Certificate Document
  const handleUploadDocument = async (file: File) => {
    if (!participant || !file) return;

    setUploadingDoc(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `doc_${docType}_${participant.ci}_${Date.now()}.${fileExt}`;
      const filePath = `documentos/${fileName}`;

      const { error: uploadErr } = await supabase.storage
        .from('comprobantes')
        .upload(filePath, file, { upsert: true });

      let filePublicUrl = filePath;
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from('comprobantes').getPublicUrl(filePath);
        if (urlData) filePublicUrl = urlData.publicUrl;
      } else {
        // Fallback convert to base64 if storage not configured
        const reader = new FileReader();
        reader.readAsDataURL(file);
        await new Promise((resolve) => {
          reader.onload = () => {
            filePublicUrl = reader.result as string;
            resolve(null);
          };
        });
      }

      setUploadedDocUrl(filePublicUrl);

      // Update in inscripcion_ciclo if possible
      const activeCourse = participant.cursos[selectedCourseIdx];
      if (activeCourse?.inscripcion_id) {
        await supabase
          .from('inscripcion_ciclo')
          .update({ documento_url: filePublicUrl } as any)
          .eq('id', activeCourse.inscripcion_id);
      }

      Swal.fire({
        icon: 'success',
        title: '¡Documento Subido con Éxito!',
        text: 'Tu documento ha sido adjuntado correctamente al sistema.',
        confirmButtonColor: '#16a34a'
      });
    } catch (err: any) {
      console.error('Error al subir documento:', err);
      Swal.fire({
        icon: 'error',
        title: 'Error al subir',
        text: err.message || 'No se pudo guardar el archivo.',
        confirmButtonColor: '#dc2626'
      });
    } finally {
      setUploadingDoc(false);
    }
  };

  // Upload deposit voucher
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
      } else {
        // Fallback convert to base64
        const reader = new FileReader();
        reader.readAsDataURL(file);
        await new Promise((resolve) => {
          reader.onload = () => {
            filePublicUrl = reader.result as string;
            resolve(null);
          };
        });
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
        text: 'Tu comprobante de pago ha sido guardado exitosamente.',
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

  // Share Ficha via WhatsApp / Web Share
  const handleShareFicha = (targetCourse?: EnrolledCourse) => {
    if (!participant) return;
    const course = targetCourse || participant.cursos[selectedCourseIdx] || participant.cursos[0];
    const courseTitle = course?.ciclo_nombre || 'Programa Formativo UNEFCO';
    const text = `📄 *FICHA DE INSCRIPCIÓN UNEFCO SANTA CRUZ*\n👤 Maestro(a): ${participant.apellidos} ${participant.nombres}\n💳 CI: ${participant.ci}\n📚 Ciclo: ${courseTitle}\n💰 Costo: Bs. ${course?.costo || 150}\n🏫 Unidad Educativa: ${virtualFicha.unidadEducativa || participant.unidad_educativa || 'POR LLENAR'}\n\nConsulta los detalles y requisitos de inscripción aquí: ${window.location.href}`;

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

  // Print Official 2-up Letter Ficha de Inscripción with Virtual Form Data
  const handlePrintOfficialFicha = (targetCourse?: EnrolledCourse) => {
    if (!participant) return;

    const courseToPrint: EnrolledCourse = targetCourse || participant.cursos[selectedCourseIdx] || participant.cursos[0] || {
      id: 'default',
      ciclo_nombre: 'PROGRAMA FORMATIVO CONTINUA UNEFCO',
      area_formativa: 'TECNOLOGÍA EDUCATIVA',
      costo: 150,
      distrito: virtualFicha.distrito || participant.distrito || 'SANTA CRUZ'
    };

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      Swal.fire('Bloqueador', 'Habilita las ventanas flotantes para imprimir o guardar como PDF la ficha.', 'warning');
      return;
    }

    const logoMineduUrl = window.location.origin + '/logo-minedu.jpg';
    const logoUnefcoUrl = window.location.origin + '/logo-unefco.jpg';

    // Helper for checkbox checked mark
    const chk = (condition: boolean) => condition ? '<span class="chk-active">X</span>' : '<span class="chk"></span>';

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

          <!-- 2. Personal Info Section (Pre-filled from Virtual Form) -->
          <table class="personal-table">
            <tr>
              <td class="lbl" width="20%">Apellido(s) y Nombre(s):</td>
              <td class="val" colspan="3"><b>${participant.apellidos} ${participant.nombres}</b></td>
              <td class="lbl" width="12%">Telf/Cel:</td>
              <td class="val" width="15%"><b>${virtualFicha.celular || participant.celular || ''}</b></td>
            </tr>
            <tr>
              <td class="lbl">Carnet de Identidad:</td>
              <td class="val" width="25%"><b>${participant.ci}</b></td>
              <td class="lbl" width="10%">E-mail:</td>
              <td class="val"><b>${virtualFicha.correo || participant.correo || ''}</b></td>
              <td class="lbl">RDA/RP:</td>
              <td class="val"><b>${virtualFicha.rda || participant.rda || ''}</b></td>
            </tr>
            <tr>
              <td class="lbl">Fecha de Nacimiento:</td>
              <td class="val" colspan="5"><b>${virtualFicha.fechaNacimiento || ''}</b></td>
            </tr>
          </table>

          <!-- 3. Form Selection Options (Checkboxes filled) -->
          <div class="checks-section">
            <div class="check-row">
              <span class="lbl-check">Función que cumple:</span>
              <span class="chk-box-label">Docente ${chk(virtualFicha.funcion === 'Docente')}</span>
              <span class="chk-box-label">Director ${chk(virtualFicha.funcion === 'Director')}</span>
              <span class="chk-box-label">Administrativo ${chk(virtualFicha.funcion === 'Administrativo')}</span>
              <span class="chk-box-label">Estudiante ESFM ${chk(virtualFicha.funcion === 'Estudiante ESFM')}</span>
              <span class="chk-box-label">Estudiante Sec. ${chk(virtualFicha.funcion === 'Estudiante Sec.')}</span>
              <span class="chk-box-label">Padre de Familia ${chk(virtualFicha.funcion === 'Padre de Familia')}</span>
              <span class="chk-box-label">No aplica ${chk(virtualFicha.funcion === 'No aplica')}</span>
            </div>

            <div class="check-row">
              <span class="lbl-check">Área:</span>
              <span class="chk-box-label">Urbano ${chk(virtualFicha.area === 'Urbano')}</span>
              <span class="chk-box-label">Rural ${chk(virtualFicha.area === 'Rural')}</span>
            </div>

            <table class="check-table">
              <tr>
                <td width="75%">
                  <div class="field-line">
                    <span class="lbl-line">Distrito Educativo:</span>
                    <span class="val-line"><b>${virtualFicha.distrito || participant.distrito || 'SANTA CRUZ'}</b></span>
                  </div>
                  <div class="field-line">
                    <span class="lbl-line">Unidad Educativa:</span>
                    <span class="val-line"><b>${virtualFicha.unidadEducativa || participant.unidad_educativa || ''}</b></span>
                  </div>
                </td>
                <td width="25%" align="right">
                  <div class="check-vertical">
                    <span class="chk-box-label">No aplica ${chk(!virtualFicha.distrito)}</span>
                    <span class="chk-box-label">No aplica ${chk(!virtualFicha.unidadEducativa)}</span>
                  </div>
                </td>
              </tr>
            </table>

            <div class="check-row" style="margin-top: 4px;">
              <span class="lbl-check">Subsistema:</span>
              <span class="chk-box-label">Educación Regular ${chk(virtualFicha.subsistema === 'Educación Regular')}</span>
              <span class="chk-box-label">Educación Alternativa y Especial ${chk(virtualFicha.subsistema === 'Educación Alternativa y Especial')}</span>
              <span class="chk-box-label">Ed. Superior ${chk(virtualFicha.subsistema === 'Ed. Superior')}</span>
              <span class="chk-box-label">No aplica ${chk(virtualFicha.subsistema === 'No aplica')}</span>
            </div>

            <div class="check-row">
              <span class="lbl-check">Nivel de Ed. Regular:</span>
              <span class="chk-box-label">Inicial ${chk(virtualFicha.nivel === 'Inicial')}</span>
              <span class="chk-box-label">Primaria ${chk(virtualFicha.nivel === 'Primaria')}</span>
              <span class="chk-box-label">Secundaria ${chk(virtualFicha.nivel === 'Secundaria')}</span>
              <span class="chk-box-label">Ed. Superior ${chk(virtualFicha.nivel === 'Ed. Superior')}</span>
              <span class="chk-box-label">No aplica ${chk(virtualFicha.nivel === 'No aplica')}</span>
            </div>
          </div>

          <!-- 4. Footer & Signature -->
          <table class="footer-table">
            <tr>
              <td width="50%" align="left" valign="bottom">
                <span class="lbl">Fecha de inscripción:</span>
                <span style="border-bottom: 1px solid #000; padding: 0 14px; font-weight: bold;">
                  ${new Date().getDate().toString().padStart(2, '0')}
                </span> / 
                <span style="border-bottom: 1px solid #000; padding: 0 14px; font-weight: bold;">
                  ${(new Date().getMonth() + 1).toString().padStart(2, '0')}
                </span> / 
                <span style="border-bottom: 1px solid #000; padding: 0 18px; font-weight: bold;">
                  ${new Date().getFullYear()}
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
            font-family: Arial, sans-serif;
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
          .chk-active { display: inline-block; width: 11px; height: 11px; border: 1.5px solid #000; text-align: center; font-size: 7.5pt; line-height: 11px; font-weight: 900; background: #000; color: #fff; }
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
          
          <!-- Cut line -->
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

  const activeCourse = participant?.cursos[selectedCourseIdx] || participant?.cursos[0];

  return (
    <div className="inscripciones-container">
      {/* Styles */}
      <style>{`
        .inscripciones-container {
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
          margin-bottom: 28px;
          position: relative;
          overflow: hidden;
        }
        .banner-title {
          margin: 0;
          font-size: clamp(1.4rem, 4.5vw, 2.4rem);
          font-weight: 900;
          color: #ffffff;
          letter-spacing: 0.5px;
          line-height: 1.25;
        }
        .banner-subtitle {
          margin: 14px auto 0;
          max-width: 840px;
          font-size: clamp(0.98rem, 2.8vw, 1.18rem);
          color: #cbd5e1;
          line-height: 1.6;
          font-weight: 600;
        }

        /* Stepper navigation bar */
        .stepper-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #ffffff;
          border-radius: 20px;
          padding: 12px 16px;
          border: 2.5px solid #cbd5e1;
          box-shadow: 0 6px 18px rgba(0,0,0,0.06);
          margin-bottom: 28px;
          gap: 8px;
          overflow-x: auto;
        }
        .stepper-btn {
          flex: 1 1 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 12px 16px;
          border-radius: 14px;
          font-size: 1rem;
          font-weight: 800;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
          color: #64748b;
          background: transparent;
        }
        .stepper-btn.active {
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          color: #ffffff;
          box-shadow: 0 4px 14px rgba(15, 23, 42, 0.25);
        }
        .stepper-btn.completed {
          background: #f0fdf4;
          color: #166534;
          border: 1.5px solid #86efac;
        }

        .step-card {
          background: #ffffff;
          border-radius: 24px;
          padding: 32px 28px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
          border: 3.5px solid #bfa05e;
          margin-bottom: 28px;
          box-sizing: border-box;
        }
        .step-card-blue {
          border: 3.5px solid #0284c7;
          box-shadow: 0 10px 28px rgba(2, 132, 199, 0.12);
        }

        /* Seamless Unified Search Input Group */
        .search-input-group {
          display: flex;
          align-items: stretch;
          border-radius: 16px;
          box-shadow: 0 4px 14px rgba(15, 23, 42, 0.12);
          overflow: hidden;
          border: 2.5px solid #cbd5e1;
          background: #ffffff;
          margin-top: 16px;
        }
        .search-input-field {
          flex: 1 1 auto;
          border: none !important;
          outline: none !important;
          padding: 16px 20px;
          font-size: 1.2rem;
          font-weight: 800;
          color: #0f172a;
          background: transparent;
          width: 100%;
          box-sizing: border-box;
        }
        .search-btn {
          flex: 0 0 auto;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          color: #ffffff;
          border: none !important;
          padding: 16px 30px;
          font-size: 1.15rem;
          font-weight: 900;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          white-space: nowrap;
        }

        .form-virtual-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 16px;
          margin-top: 16px;
        }
        .form-virtual-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .form-virtual-label {
          font-size: 0.95rem;
          font-weight: 800;
          color: #1e293b;
        }
        .form-virtual-input {
          padding: 12px 14px;
          border-radius: 12px;
          border: 2px solid #cbd5e1;
          font-size: 1.05rem;
          font-weight: 700;
          color: #0f172a;
          outline: none;
          background: #f8fafc;
        }
        .form-virtual-input:focus {
          border-color: #0284c7;
          background: #ffffff;
        }

        .action-buttons-group {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
        }

        @media (max-width: 768px) {
          .inscripciones-container {
            padding: 12px 8px;
          }
          .banner-header {
            padding: 24px 14px;
            border-radius: 18px;
            margin-bottom: 18px;
          }
          .step-card {
            padding: 20px 14px;
            border-radius: 18px;
            margin-bottom: 20px;
          }
          .search-input-group {
            flex-direction: column;
          }
          .search-input-field {
            padding: 14px 16px;
            font-size: 1.1rem;
            border-bottom: 2px solid #e2e8f0 !important;
          }
          .search-btn {
            width: 100%;
            padding: 14px 20px;
          }
          .action-buttons-group {
            width: 100%;
            flex-direction: column;
          }
          .action-buttons-group > button,
          .action-buttons-group > a {
            width: 100% !important;
            justify-content: center;
          }
          .stepper-nav {
            padding: 8px;
          }
          .stepper-btn {
            font-size: 0.85rem;
            padding: 8px 10px;
          }
        }
      `}</style>

      {/* Main Banner Header */}
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
          padding: '8px 22px',
          borderRadius: '24px',
          fontSize: '0.95rem',
          fontWeight: 900,
          textTransform: 'uppercase',
          letterSpacing: '1px',
          marginBottom: '16px'
        }}>
          <Sparkles size={18} /> Inscripción Guiada Paso a Paso
        </div>

        <h1 className="banner-title">
          PORTAL DE INSCRIPCIÓN Y FICHA OFICIAL UNEFCO
        </h1>

        <p className="banner-subtitle">
          Completa tu registro fácilmente a través de nuestros 4 niveles guiados para maestras y maestros.
        </p>
      </div>

      {/* SEARCH BAR (Visible if not searched or can change CI) */}
      <div className="step-card" style={{ marginBottom: participant ? '18px' : '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h2 style={{ margin: 0, fontSize: 'clamp(1.2rem, 3.2vw, 1.5rem)', fontWeight: 900, color: '#0f172a' }}>
            🔍 INGRESA TU CARNET DE IDENTIDAD (CI)
          </h2>
          {participant && (
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#166534', background: '#dcfce7', padding: '4px 12px', borderRadius: '12px' }}>
              ✓ Identificado
            </span>
          )}
        </div>

        <p style={{ margin: 0, fontSize: '1.05rem', color: '#475569', fontWeight: 600, lineHeight: 1.5 }}>
          Escribe tu número de carnet sin extensiones. El sistema cargará automáticamente tu pre-inscripción:
        </p>

        <form onSubmit={handleSearchCI}>
          <div className="search-input-group">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className="search-input-field"
              placeholder="Escribe tu número de Carnet (ej. 8639400)..."
              value={ciSearch}
              onChange={handleCiChange}
            />
            <button type="submit" disabled={searching} className="search-btn">
              <Search size={22} /> {searching ? 'Buscando...' : 'Consultar Carnet'}
            </button>
          </div>
          <p style={{ margin: '8px 0 0 0', fontSize: '0.88rem', color: '#64748b', fontWeight: 600 }}>
            ℹ️ <em>Escribe únicamente los números de tu carnet sin letras de extensión (ej. 8639400).</em>
          </p>
        </form>

        {/* Not found notice */}
        {searched && !participant && (
          <div style={{
            background: '#fff1f2',
            border: '3px solid #e11d48',
            borderRadius: '18px',
            padding: '18px 16px',
            color: '#9f1239',
            marginTop: '20px',
            boxShadow: '0 8px 24px rgba(225, 29, 72, 0.15)'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '14px' }}>
              <AlertTriangle size={36} style={{ color: '#e11d48', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#be123c' }}>
                  ⚠️ NO TE ENCUENTRAS EN NUESTRA BASE DE DATOS
                </h3>
                <p style={{ margin: '6px 0 0 0', fontSize: '1.02rem', color: '#881337', fontWeight: 700, lineHeight: 1.55 }}>
                  Es posible que aún no hayas llenado el formulario de pre-inscripción o tu carnet tenga algún dígito incorrecto.
                </p>
              </div>
            </div>

            <div style={{
              background: '#ffffff',
              border: '2px solid #fda4af',
              borderRadius: '14px',
              padding: '14px 12px',
              color: '#4c0519'
            }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '1.1rem', fontWeight: 900, color: '#9f1239' }}>
                📞 CONTÁCTANOS PARA VERIFICAR TU FORMULARIO:
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                {contacts.map((c) => (
                  <a
                    key={c.num}
                    href={`https://wa.me/591${c.num}?text=Hola,%20consulte%20mi%20carnet%20y%20no%20aparezco%20registrado.`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                      color: '#ffffff',
                      textDecoration: 'none',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      fontSize: '0.95rem',
                      fontWeight: 900,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <span>{c.num}</span>
                    <MessageCircle size={18} />
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PROGRESSIVE WIZARD (Visible when participant is found) */}
      {participant && (
        <>
          {/* Multi-cycle Selector Tabs if more than 1 cycle */}
          {participant.cursos.length > 1 && (
            <div style={{
              background: '#f8fafc',
              border: '2.5px solid #cbd5e1',
              borderRadius: '18px',
              padding: '14px 16px',
              marginBottom: '20px'
            }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0f172a', display: 'block', marginBottom: '8px' }}>
                📚 ESTÁS INSCRITO EN {participant.cursos.length} CICLOS. SELECCIONA EL CICLO A GESTIONAR:
              </span>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {participant.cursos.map((c, idx) => (
                  <button
                    key={c.id || idx}
                    type="button"
                    onClick={() => setSelectedCourseIdx(idx)}
                    style={{
                      padding: '10px 18px',
                      borderRadius: '12px',
                      fontSize: '0.98rem',
                      fontWeight: 900,
                      cursor: 'pointer',
                      border: selectedCourseIdx === idx ? '2.5px solid #0284c7' : '1.5px solid #cbd5e1',
                      background: selectedCourseIdx === idx ? '#0284c7' : '#ffffff',
                      color: selectedCourseIdx === idx ? '#ffffff' : '#334155',
                      boxShadow: selectedCourseIdx === idx ? '0 4px 12px rgba(2, 132, 199, 0.3)' : 'none'
                    }}
                  >
                    CICLO {idx + 1}: {c.ciclo_nombre || c.area_formativa} (Bs. {c.costo || 150})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Stepper Navigation */}
          <div className="stepper-nav">
            <button
              type="button"
              className={`stepper-btn ${currentStep === 1 ? 'active' : 'completed'}`}
              onClick={() => setCurrentStep(1)}
            >
              <span>1️⃣</span> <span>Nivel 1: Ficha Virtual</span>
            </button>
            <button
              type="button"
              className={`stepper-btn ${currentStep === 2 ? 'active' : (currentStep > 2 ? 'completed' : '')}`}
              onClick={() => setCurrentStep(2)}
            >
              <span>2️⃣</span> <span>Nivel 2: Documentos (RDA)</span>
            </button>
            <button
              type="button"
              className={`stepper-btn ${currentStep === 3 ? 'active' : (currentStep > 3 ? 'completed' : '')}`}
              onClick={() => setCurrentStep(3)}
            >
              <span>3️⃣</span> <span>Nivel 3: Depósito Bancario</span>
            </button>
            <button
              type="button"
              className={`stepper-btn ${currentStep === 4 ? 'active' : ''}`}
              onClick={() => setCurrentStep(4)}
            >
              <span>4️⃣</span> <span>Nivel 4: Entrega en Oficinas</span>
            </button>
          </div>

          {/* ========================================================
              NIVEL 1: WHATSAPP GROUP & VIRTUAL FICHA DE INSCRIPCIÓN
             ======================================================== */}
          {currentStep === 1 && (
            <div className="step-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #bfa05e 0%, #9a7b38 100%)',
                  color: '#ffffff',
                  fontWeight: 900,
                  fontSize: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  1
                </span>
                <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#9a7b38', background: '#fefce8', padding: '6px 14px', borderRadius: '14px', border: '1.5px solid #fef08a' }}>
                  Nivel 1 de 4
                </span>
              </div>

              {/* Greeting & WhatsApp Button */}
              <div style={{
                background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                border: '2.5px solid #16a34a',
                borderRadius: '18px',
                padding: '20px 18px',
                marginBottom: '24px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <CheckCircle2 size={32} style={{ color: '#16a34a', flexShrink: 0 }} />
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 900, color: '#15803d' }}>
                      ¡Bienvenido(a), {participant.nombres} {participant.apellidos}!
                    </h3>
                    <span style={{ fontSize: '1rem', color: '#166534', fontWeight: 700 }}>
                      Carnet de Identidad: <b>{participant.ci}</b> | Ciclo: <b>{activeCourse?.ciclo_nombre || 'Programa Formativo UNEFCO'}</b>
                    </span>
                  </div>
                </div>

                {activeCourse?.link_whatsapp && (
                  <div style={{ marginTop: '14px' }}>
                    <a
                      href={activeCourse.link_whatsapp}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                        color: '#ffffff',
                        textDecoration: 'none',
                        borderRadius: '14px',
                        padding: '16px 24px',
                        fontSize: '1.15rem',
                        fontWeight: 900,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '10px',
                        boxShadow: '0 6px 18px rgba(37, 211, 102, 0.35)',
                        width: '100%',
                        justifyContent: 'center',
                        boxSizing: 'border-box'
                      }}
                    >
                      <MessageCircle size={24} /> 💬 UNIRSE AL GRUPO OFICIAL DE WHATSAPP
                    </a>
                  </div>
                )}
              </div>

              {/* FORMULARIO VIRTUAL DE LLENADO DE FICHA */}
              <div style={{
                background: '#ffffff',
                border: '2.5px solid #cbd5e1',
                borderRadius: '20px',
                padding: '22px 18px',
                boxShadow: '0 4px 14px rgba(0,0,0,0.04)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <FileText size={24} style={{ color: '#0284c7' }} />
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}>
                    LLENADO VIRTUAL DE LA FICHA DE INSCRIPCIÓN
                  </h3>
                </div>
                <p style={{ margin: 0, fontSize: '0.98rem', color: '#475569', fontWeight: 600 }}>
                  Completa tus datos en este formulario virtual. La ficha se generará automáticamente con toda la información lista para <strong>Imprimir, Descargar en PDF o Compartir</strong>:
                </p>

                <div className="form-virtual-grid">
                  {/* Función que cumple */}
                  <div className="form-virtual-field">
                    <label className="form-virtual-label">Función que cumple *</label>
                    <select
                      className="form-virtual-input"
                      value={virtualFicha.funcion}
                      onChange={(e) => setVirtualFicha({ ...virtualFicha, funcion: e.target.value })}
                    >
                      <option value="Docente">Docente</option>
                      <option value="Director">Director</option>
                      <option value="Administrativo">Administrativo</option>
                      <option value="Estudiante ESFM">Estudiante ESFM</option>
                      <option value="Estudiante Sec.">Estudiante Secundaria</option>
                      <option value="Padre de Familia">Padre de Familia</option>
                      <option value="No aplica">No aplica</option>
                    </select>
                  </div>

                  {/* Área */}
                  <div className="form-virtual-field">
                    <label className="form-virtual-label">Área *</label>
                    <select
                      className="form-virtual-input"
                      value={virtualFicha.area}
                      onChange={(e) => setVirtualFicha({ ...virtualFicha, area: e.target.value })}
                    >
                      <option value="Urbano">Urbano</option>
                      <option value="Rural">Rural</option>
                    </select>
                  </div>

                  {/* Distrito Educativo */}
                  <div className="form-virtual-field">
                    <label className="form-virtual-label">Distrito Educativo *</label>
                    <input
                      type="text"
                      className="form-virtual-input"
                      value={virtualFicha.distrito}
                      onChange={(e) => setVirtualFicha({ ...virtualFicha, distrito: e.target.value.toUpperCase() })}
                      placeholder="Ej: SANTA CRUZ 1"
                    />
                  </div>

                  {/* Unidad Educativa */}
                  <div className="form-virtual-field">
                    <label className="form-virtual-label">Unidad Educativa / Colegio *</label>
                    <input
                      type="text"
                      className="form-virtual-input"
                      value={virtualFicha.unidadEducativa}
                      onChange={(e) => setVirtualFicha({ ...virtualFicha, unidadEducativa: e.target.value.toUpperCase() })}
                      placeholder="Nombre de tu Unidad Educativa..."
                    />
                  </div>

                  {/* Subsistema */}
                  <div className="form-virtual-field">
                    <label className="form-virtual-label">Subsistema *</label>
                    <select
                      className="form-virtual-input"
                      value={virtualFicha.subsistema}
                      onChange={(e) => setVirtualFicha({ ...virtualFicha, subsistema: e.target.value })}
                    >
                      <option value="Educación Regular">Educación Regular</option>
                      <option value="Educación Alternativa y Especial">Educación Alternativa y Especial</option>
                      <option value="Ed. Superior">Educación Superior</option>
                      <option value="No aplica">No aplica</option>
                    </select>
                  </div>

                  {/* Nivel de Ed. Regular */}
                  <div className="form-virtual-field">
                    <label className="form-virtual-label">Nivel de Ed. Regular *</label>
                    <select
                      className="form-virtual-input"
                      value={virtualFicha.nivel}
                      onChange={(e) => setVirtualFicha({ ...virtualFicha, nivel: e.target.value })}
                    >
                      <option value="Inicial">Inicial</option>
                      <option value="Primaria">Primaria</option>
                      <option value="Secundaria">Secundaria</option>
                      <option value="Ed. Superior">Educación Superior</option>
                      <option value="No aplica">No aplica</option>
                    </select>
                  </div>

                  {/* Teléfono / Celular */}
                  <div className="form-virtual-field">
                    <label className="form-virtual-label">Teléfono / Celular</label>
                    <input
                      type="text"
                      className="form-virtual-input"
                      value={virtualFicha.celular}
                      onChange={(e) => setVirtualFicha({ ...virtualFicha, celular: e.target.value })}
                      placeholder="Número de celular..."
                    />
                  </div>

                  {/* RDA / RP */}
                  <div className="form-virtual-field">
                    <label className="form-virtual-label">Nº de RDA</label>
                    <input
                      type="text"
                      className="form-virtual-input"
                      value={virtualFicha.rda}
                      onChange={(e) => setVirtualFicha({ ...virtualFicha, rda: e.target.value })}
                      placeholder="Tu número de RDA..."
                    />
                  </div>
                </div>

                {/* Print & Share Buttons */}
                <div style={{ marginTop: '22px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => handlePrintOfficialFicha()}
                    style={{
                      flex: '1 1 240px',
                      background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '14px',
                      padding: '16px 20px',
                      fontSize: '1.1rem',
                      fontWeight: 900,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      boxShadow: '0 4px 14px rgba(22, 163, 74, 0.3)'
                    }}
                  >
                    <Printer size={22} /> 🖨️ Imprimir / Guardar en PDF
                  </button>

                  <button
                    type="button"
                    onClick={() => handleShareFicha()}
                    style={{
                      flex: '1 1 200px',
                      background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '14px',
                      padding: '16px 20px',
                      fontSize: '1.1rem',
                      fontWeight: 900,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      boxShadow: '0 4px 14px rgba(2, 132, 199, 0.3)'
                    }}
                  >
                    <Share2 size={22} /> 📲 Compartir Ficha
                  </button>
                </div>
              </div>

              {/* Navigation Next Button */}
              <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  style={{
                    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '14px',
                    padding: '16px 28px',
                    fontSize: '1.15rem',
                    fontWeight: 900,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '10px',
                    boxShadow: '0 6px 18px rgba(15, 23, 42, 0.3)'
                  }}
                >
                  Continuar al Nivel 2 (Documentos) <ArrowRight size={22} />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================
              NIVEL 2: REUNIR Y SUBIR DOCUMENTACIÓN (RDA / CERTIFICADO)
             ======================================================== */}
          {currentStep === 2 && (
            <div className="step-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #bfa05e 0%, #9a7b38 100%)',
                  color: '#ffffff',
                  fontWeight: 900,
                  fontSize: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  2
                </span>
                <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#9a7b38', background: '#fefce8', padding: '6px 14px', borderRadius: '14px', border: '1.5px solid #fef08a' }}>
                  Nivel 2 de 4
                </span>
              </div>

              <h2 style={{ margin: '0 0 10px 0', fontSize: 'clamp(1.25rem, 3.5vw, 1.55rem)', fontWeight: 900, color: '#0f172a' }}>
                PASO 2: DOCUMENTACIÓN REQUERIDA (RDA O CERTIFICADO)
              </h2>

              <p style={{ margin: 0, fontSize: '1.05rem', color: '#475569', fontWeight: 600, lineHeight: 1.6 }}>
                Reúne la documentación física correspondiente según tu función:
              </p>

              {/* Explanation Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', margin: '20px 0' }}>
                <div style={{
                  background: '#f8fafc',
                  border: docType === 'rda' ? '2.5px solid #0284c7' : '1.5px solid #cbd5e1',
                  borderRadius: '16px',
                  padding: '18px 16px',
                  cursor: 'pointer',
                  boxShadow: docType === 'rda' ? '0 4px 14px rgba(2, 132, 199, 0.15)' : 'none'
                }} onClick={() => setDocType('rda')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <FileCheck size={28} style={{ color: '#0284c7' }} />
                    <span style={{ fontWeight: 900, fontSize: '1.12rem', color: '#0f172a' }}>
                      1. Fotocopia de RDA (Docentes)
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.95rem', color: '#475569', fontWeight: 600 }}>
                    Fotocopia legible de tu Registro Docente de Aprendizaje (RDA) actualizado.
                  </p>
                </div>

                <div style={{
                  background: '#f8fafc',
                  border: docType === 'certificado' ? '2.5px solid #0284c7' : '1.5px solid #cbd5e1',
                  borderRadius: '16px',
                  padding: '18px 16px',
                  cursor: 'pointer',
                  boxShadow: docType === 'certificado' ? '0 4px 14px rgba(2, 132, 199, 0.15)' : 'none'
                }} onClick={() => setDocType('certificado')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <UserCheck size={28} style={{ color: '#0284c7' }} />
                    <span style={{ fontWeight: 900, fontSize: '1.12rem', color: '#0f172a' }}>
                      2. Certificado de Trabajo (Administrativos)
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.95rem', color: '#475569', fontWeight: 600 }}>
                    Certificado de Trabajo original demostrando funciones en la Unidad Educativa.
                  </p>
                </div>
              </div>

              {/* Uploader & Live Camera Option */}
              <div style={{
                background: '#f0f9ff',
                border: '2px solid #bae6fd',
                borderRadius: '20px',
                padding: '22px 18px',
                textAlign: 'center'
              }}>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '1.2rem', fontWeight: 900, color: '#0369a1' }}>
                  📸 SUBIR O SACAR FOTO A TU {docType === 'rda' ? 'RDA' : 'CERTIFICADO DE TRABAJO'}
                </h3>
                <p style={{ margin: '0 0 16px 0', fontSize: '0.95rem', color: '#0c4a6e', fontWeight: 600 }}>
                  Puedes subir tu documento en archivo <strong>PDF o Foto</strong>, o presionar el botón para <strong>tomar una foto con la cámara</strong>:
                </p>

                {uploadedDocUrl ? (
                  <div style={{
                    background: '#dcfce7',
                    border: '2px solid #16a34a',
                    borderRadius: '14px',
                    padding: '14px',
                    color: '#166534',
                    fontWeight: 800,
                    fontSize: '1.05rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    marginBottom: '14px'
                  }}>
                    <CheckCircle2 size={24} /> ¡Documento adjuntado exitosamente en el sistema!
                  </div>
                ) : null}

                {uploadingDoc ? (
                  <div style={{ color: '#0284c7', fontWeight: 800, fontSize: '1.05rem', padding: '12px' }}>
                    Subiendo documento... Por favor espera.
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <label style={{
                      background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                      color: '#ffffff',
                      borderRadius: '14px',
                      padding: '14px 22px',
                      fontSize: '1.05rem',
                      fontWeight: 900,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)'
                    }}>
                      <Upload size={20} /> Subir Archivo (PDF o Imagen)
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadDocument(file);
                        }}
                        style={{ display: 'none' }}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => startCamera('documento')}
                      style={{
                        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '14px',
                        padding: '14px 22px',
                        fontSize: '1.05rem',
                        fontWeight: 900,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.25)'
                      }}
                    >
                      <Camera size={20} /> Sacar Foto con Cámara
                    </button>
                  </div>
                )}
              </div>

              {/* Camera Viewfinder if active for Document */}
              {cameraActive && cameraTarget === 'documento' && (
                <div style={{
                  marginTop: '20px',
                  background: '#0f172a',
                  padding: '20px',
                  borderRadius: '20px',
                  color: '#ffffff',
                  textAlign: 'center'
                }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '1.1rem', fontWeight: 800, color: '#38bdf8' }}>
                    📸 Centra el documento en la pantalla y presiona "Capturar Foto":
                  </h4>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    style={{
                      width: '100%',
                      maxWidth: '540px',
                      borderRadius: '14px',
                      border: '3px solid #38bdf8',
                      marginBottom: '14px'
                    }}
                  />
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                    <button
                      type="button"
                      onClick={handleCapturePhoto}
                      style={{
                        background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '12px',
                        padding: '12px 24px',
                        fontSize: '1.05rem',
                        fontWeight: 900,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <Camera size={20} /> Capturar Foto
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      style={{
                        background: '#334155',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '12px',
                        padding: '12px 20px',
                        fontSize: '1rem',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Navigation Back / Next Buttons */}
              <div style={{ marginTop: '28px', display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  style={{
                    background: '#f1f5f9',
                    color: '#334155',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: '14px',
                    padding: '14px 22px',
                    fontSize: '1.05rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <ArrowLeft size={20} /> Volver al Nivel 1
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  style={{
                    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '14px',
                    padding: '16px 28px',
                    fontSize: '1.15rem',
                    fontWeight: 900,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '10px',
                    boxShadow: '0 6px 18px rgba(15, 23, 42, 0.3)'
                  }}
                >
                  Continuar al Nivel 3 (Depósito) <ArrowRight size={22} />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================
              NIVEL 3: DEPÓSITO BANCARIO & COMPROBANTE DE PAGO
             ======================================================== */}
          {currentStep === 3 && (
            <div className="step-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #bfa05e 0%, #9a7b38 100%)',
                  color: '#ffffff',
                  fontWeight: 900,
                  fontSize: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  3
                </span>
                <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#9a7b38', background: '#fefce8', padding: '6px 14px', borderRadius: '14px', border: '1.5px solid #fef08a' }}>
                  Nivel 3 de 4
                </span>
              </div>

              <h2 style={{ margin: '0 0 10px 0', fontSize: 'clamp(1.25rem, 3.5vw, 1.55rem)', fontWeight: 900, color: '#0f172a' }}>
                PASO 3: DEPÓSITO BANCARIO Y REGISTRO DE COMPROBANTE
              </h2>

              <p style={{ margin: 0, fontSize: '1.05rem', color: '#475569', fontWeight: 600, lineHeight: 1.6 }}>
                Realiza el depósito correspondiente a la cuenta oficial de UNEFCO en Banco Unión:
              </p>

              {/* Official Bank Account Banner */}
              <div style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                color: '#ffffff',
                borderRadius: '20px',
                padding: '24px 20px',
                boxShadow: '0 8px 24px rgba(15, 23, 42, 0.25)',
                border: '3px solid #bfa05e',
                margin: '20px 0'
              }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#f59e0b', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CreditCard size={24} /> CUENTA BANCARIA OFICIAL PARA EL DEPÓSITO:
                </div>

                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#ffffff', marginBottom: '8px' }}>
                  🏛️ BANCO UNIÓN
                </div>

                <div style={{
                  background: 'rgba(255, 255, 255, 0.12)',
                  border: '1.5px solid rgba(255, 255, 255, 0.25)',
                  borderRadius: '16px',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <div>
                    <span style={{ fontSize: '0.95rem', color: '#cbd5e1', fontWeight: 700, display: 'block' }}>Número de Cuenta:</span>
                    <span style={{ fontSize: '1.6rem', fontWeight: 900, color: '#ffffff', letterSpacing: '1px' }}>
                      1-28754013
                    </span>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.95rem', color: '#cbd5e1', fontWeight: 700, display: 'block' }}>Monto por Ciclo:</span>
                    <span style={{ fontSize: '1.6rem', fontWeight: 900, color: '#facc15' }}>
                      Bs. {activeCourse?.costo || 150}
                    </span>
                  </div>
                </div>
              </div>

              {/* Upload Voucher Section */}
              <div style={{
                background: '#f0fdf4',
                border: '2px solid #86efac',
                borderRadius: '20px',
                padding: '22px 18px',
                textAlign: 'center'
              }}>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '1.2rem', fontWeight: 900, color: '#15803d' }}>
                  📸 SUBIR O SACAR FOTO DE TU COMPROBANTE DE PAGO
                </h3>
                <p style={{ margin: '0 0 16px 0', fontSize: '0.95rem', color: '#166534', fontWeight: 600 }}>
                  Adjunta la foto o archivo PDF de tu comprobante de depósito realizado en Banco Unión:
                </p>

                {activeCourse?.comprobante_url ? (
                  <div style={{
                    background: '#dcfce7',
                    border: '2px solid #16a34a',
                    borderRadius: '14px',
                    padding: '14px',
                    color: '#166534',
                    fontWeight: 800,
                    fontSize: '1.05rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    marginBottom: '14px'
                  }}>
                    <CheckCircle2 size={24} /> ¡Comprobante de depósito registrado correctamente!
                  </div>
                ) : null}

                {uploadingCourseId === activeCourse?.id ? (
                  <div style={{ color: '#15803d', fontWeight: 800, fontSize: '1.05rem', padding: '12px' }}>
                    Guardando comprobante... Por favor espera.
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <label style={{
                      background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                      color: '#ffffff',
                      borderRadius: '14px',
                      padding: '14px 22px',
                      fontSize: '1.05rem',
                      fontWeight: 900,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)'
                    }}>
                      <Upload size={20} /> Subir Comprobante (Foto o PDF)
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file && activeCourse) handleUploadVoucher(activeCourse, file);
                        }}
                        style={{ display: 'none' }}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => startCamera('comprobante')}
                      style={{
                        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '14px',
                        padding: '14px 22px',
                        fontSize: '1.05rem',
                        fontWeight: 900,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.25)'
                      }}
                    >
                      <Camera size={20} /> Sacar Foto al Comprobante
                    </button>
                  </div>
                )}
              </div>

              {/* Camera Viewfinder if active for Voucher */}
              {cameraActive && cameraTarget === 'comprobante' && (
                <div style={{
                  marginTop: '20px',
                  background: '#0f172a',
                  padding: '20px',
                  borderRadius: '20px',
                  color: '#ffffff',
                  textAlign: 'center'
                }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '1.1rem', fontWeight: 800, color: '#38bdf8' }}>
                    📸 Enfoca el comprobante bancario del Banco Unión y presiona "Capturar Foto":
                  </h4>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    style={{
                      width: '100%',
                      maxWidth: '540px',
                      borderRadius: '14px',
                      border: '3px solid #38bdf8',
                      marginBottom: '14px'
                    }}
                  />
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                    <button
                      type="button"
                      onClick={handleCapturePhoto}
                      style={{
                        background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '12px',
                        padding: '12px 24px',
                        fontSize: '1.05rem',
                        fontWeight: 900,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <Camera size={20} /> Capturar Foto
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      style={{
                        background: '#334155',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '12px',
                        padding: '12px 20px',
                        fontSize: '1rem',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Navigation Back / Next Buttons */}
              <div style={{ marginTop: '28px', display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  style={{
                    background: '#f1f5f9',
                    color: '#334155',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: '14px',
                    padding: '14px 22px',
                    fontSize: '1.05rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <ArrowLeft size={20} /> Volver al Nivel 2
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  style={{
                    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '14px',
                    padding: '16px 28px',
                    fontSize: '1.15rem',
                    fontWeight: 900,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '10px',
                    boxShadow: '0 6px 18px rgba(15, 23, 42, 0.3)'
                  }}
                >
                  Continuar al Nivel 4 (Finalización) <ArrowRight size={22} />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================
              NIVEL 4: RESUMEN FINAL & ENTREGA EN OFICINAS UNEFCO
             ======================================================== */}
          {currentStep === 4 && (
            <div className="step-card step-card-blue">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                  color: '#ffffff',
                  fontWeight: 900,
                  fontSize: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  4
                </span>
                <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#0369a1', background: '#f0f9ff', padding: '6px 14px', borderRadius: '14px', border: '1.5px solid #bae6fd' }}>
                  Nivel 4: Entrega Final
                </span>
              </div>

              <h2 style={{ margin: '0 0 10px 0', fontSize: 'clamp(1.3rem, 3.8vw, 1.6rem)', fontWeight: 900, color: '#0f172a' }}>
                PASO 4: ENTREGA FINAL DE REQUISITOS EN OFICINAS
              </h2>

              <p style={{ margin: 0, fontSize: '1.05rem', color: '#334155', fontWeight: 600, lineHeight: 1.6 }}>
                ¡Felicitaciones! Has completado los 3 pasos virtuales. Ahora apersónate a nuestras oficinas de UNEFCO para entregar los 3 documentos físicos:
              </p>

              {/* Requirements Checklist */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', margin: '20px 0' }}>
                <div style={{
                  background: '#ffffff',
                  border: '2px solid #cbd5e1',
                  borderRadius: '16px',
                  padding: '18px 16px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.04)'
                }}>
                  <FileText size={32} style={{ color: '#0284c7', marginBottom: '8px' }} />
                  <span style={{ fontWeight: 900, fontSize: '1.1rem', color: '#0f172a', display: 'block', marginBottom: '4px' }}>
                    1. Ficha de Inscripción
                  </span>
                  <span style={{ fontSize: '0.95rem', color: '#475569', fontWeight: 600 }}>
                    Ficha generada e impresa con tus datos, firmada a mano.
                  </span>
                </div>

                <div style={{
                  background: '#ffffff',
                  border: '2px solid #cbd5e1',
                  borderRadius: '16px',
                  padding: '18px 16px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.04)'
                }}>
                  <FileCheck size={32} style={{ color: '#16a34a', marginBottom: '8px' }} />
                  <span style={{ fontWeight: 900, fontSize: '1.1rem', color: '#0f172a', display: 'block', marginBottom: '4px' }}>
                    2. Fotocopia de RDA o Certificado
                  </span>
                  <span style={{ fontSize: '0.95rem', color: '#475569', fontWeight: 600 }}>
                    Fotocopia de tu RDA actualizado o Certificado de Trabajo.
                  </span>
                </div>

                <div style={{
                  background: '#ffffff',
                  border: '2px solid #cbd5e1',
                  borderRadius: '16px',
                  padding: '18px 16px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.04)'
                }}>
                  <CreditCard size={32} style={{ color: '#bfa05e', marginBottom: '8px' }} />
                  <span style={{ fontWeight: 900, fontSize: '1.1rem', color: '#0f172a', display: 'block', marginBottom: '4px' }}>
                    3. Comprobante Original
                  </span>
                  <span style={{ fontSize: '0.95rem', color: '#475569', fontWeight: 600 }}>
                    Comprobante de depósito original realizado en Banco Unión.
                  </span>
                </div>
              </div>

              {/* Office Location Banner */}
              <div style={{
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: '#ffffff',
                borderRadius: '20px',
                padding: '22px 18px',
                boxShadow: '0 8px 20px rgba(2, 132, 199, 0.3)'
              }}>
                <div style={{ fontWeight: 900, fontSize: '1.25rem', color: '#ffffff', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Building2 size={26} /> LUGAR Y HORARIO DE ATENCIÓN EN OFICINAS:
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '1.05rem', fontWeight: 800, color: '#f0f9ff' }}>
                    <MapPin size={22} style={{ color: '#38bdf8', flexShrink: 0, marginTop: '2px' }} />
                    <span><strong>Dirección:</strong> Oficinas de UNEFCO Santa Cruz (Av. San Martín s/n Equipetrol, ESFM Enrique Finot).</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '1.05rem', fontWeight: 800, color: '#f0f9ff' }}>
                    <Clock size={22} style={{ color: '#38bdf8', flexShrink: 0, marginTop: '2px' }} />
                    <span><strong>Horario de Atención:</strong> Horario continuo de <strong>08:00 a 16:00</strong>.</span>
                  </div>
                </div>
              </div>

              {/* Navigation Back Buttons */}
              <div style={{ marginTop: '28px', display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  style={{
                    background: '#f1f5f9',
                    color: '#334155',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: '14px',
                    padding: '14px 22px',
                    fontSize: '1.05rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <ArrowLeft size={20} /> Volver al Nivel 3
                </button>

                <button
                  type="button"
                  onClick={() => handlePrintOfficialFicha()}
                  style={{
                    background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '14px',
                    padding: '14px 24px',
                    fontSize: '1.1rem',
                    fontWeight: 900,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <Printer size={20} /> Imprimir Ficha Oficial
                </button>
              </div>
            </div>
          )}

          {/* ADVERTENCIA DE DEPÓSITOS */}
          <div style={{
            background: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)',
            border: '3.5px solid #e11d48',
            borderRadius: '24px',
            padding: '24px 26px',
            boxShadow: '0 10px 30px rgba(225, 29, 72, 0.22)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '18px',
            marginTop: '16px'
          }}>
            <AlertTriangle size={38} style={{ color: '#e11d48', flexShrink: 0, marginTop: '4px' }} />
            <div>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '1.25rem', fontWeight: 900, color: '#9f1239', textTransform: 'uppercase' }}>
                🚨 ADVERTENCIA IMPORTANTE SOBRE DEPÓSITOS BANCARIOS
              </h3>
              <p style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#be123c', lineHeight: 1.55 }}>
                <strong>NO REALIZAR NINGÚN DEPÓSITO</strong> hasta contar con la <strong>confirmación directa del técnico departamental asignado</strong>.
              </p>
              <p style={{ margin: '8px 0 0 0', fontSize: '1rem', color: '#881337', lineHeight: 1.55, fontWeight: 800 }}>
                📲 <em>Cualquier comunicado oficial se dará únicamente a través del <strong>grupo de WhatsApp oficial</strong> del curso.</em>
              </p>
              <p style={{ margin: '6px 0 0 0', fontSize: '0.98rem', color: '#9f1239', lineHeight: 1.5, fontWeight: 700 }}>
                ⚠️ <em>Toma en cuenta que los depósitos bancarios son válidos <strong>ÚNICAMENTE DENTRO DEL MES EN EL QUE SE REALIZAN</strong>.</em>
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
