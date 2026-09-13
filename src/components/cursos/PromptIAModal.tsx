'use client';

import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import Swal from 'sweetalert2';
import {
  X,
  Copy,
  Check,
  Download,
  UploadCloud,
  Sparkles,
  QrCode,
  Image as ImageIcon,
  FileText,
  Eye,
  CheckCircle2,
  Trash2,
  ExternalLink,
  Layers,
  Info
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

export interface PromptIAModalProps {
  curso: {
    id: string;
    nombre?: string;
    descripcion?: string;
    costo?: number;
    whatsapp_url?: string;
    afiche_url?: string;
    temario?: string;
    // Campos opcionales si viene de NotaCard / ciclos
    tema1?: string;
    tema2?: string;
    tema3?: string;
    tema4?: string;
    ciclo_nombre?: string;
  };
  onClose: () => void;
  onAficheSaved?: (aficheUrl: string) => void;
}

export default function PromptIAModal({ curso, onClose, onAficheSaved }: PromptIAModalProps) {
  // Tab activo: 'prompt' | 'plantilla_qr' | 'afiche'
  const [activeTab, setActiveTab] = useState<'prompt' | 'plantilla_qr' | 'afiche'>('prompt');

  // Datos editables para el prompt
  const [nombreCurso, setNombreCurso] = useState(() => {
    return curso.nombre || curso.ciclo_nombre || 'TRABAJO EN ALTURA Y ESPACIOS CONFINADOS EN ELECTRICIDAD';
  });

  const [aprenderas, setAprenderas] = useState(() => {
    if (curso.temario) return curso.temario;
    if (curso.tema1 || curso.tema2) {
      const temas = [curso.tema1, curso.tema2, curso.tema3, curso.tema4].filter(Boolean);
      return temas.join(', ');
    }
    if (curso.descripcion && curso.descripcion.trim().length > 5) {
      return curso.descripcion;
    }
    return 'Prevención de caídas a distinto nivel, uso de arnés dieléctrico, medición de atmósferas con multigasómetro, llenado de Permisos de Trabajo (PTS) y técnicas de rescate.';
  });

  const [costo, setCosto] = useState<number>(curso.costo || 150);
  const [modalidad, setModalidad] = useState<string>('Teórico - Práctico');

  // Estados de QR y Plantilla
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [plantillaBase64, setPlantillaBase64] = useState<string>('');
  const [enlaceInscripcion, setEnlaceInscripcion] = useState<string>('');

  // Estados de carga de afiche
  const [currentAficheUrl, setCurrentAficheUrl] = useState<string>(() => {
    if (curso.afiche_url) return curso.afiche_url;
    if (typeof window !== 'undefined') {
      return localStorage.getItem(`afiche_curso_${curso.id}`) || '';
    }
    return '';
  });
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewLocalUrl, setPreviewLocalUrl] = useState<string>('');
  const [isSavingAfiche, setIsSavingAfiche] = useState(false);
  const [copiedType, setCopiedType] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inicializar URL pública y QR
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      // Usar ruta directa de inscripción
      const url = `${origin}/inscripciones?curso=${curso.id || 'general'}`;
      setEnlaceInscripcion(url);

      QRCode.toDataURL(url, {
        width: 450,
        margin: 2,
        color: {
          dark: '#0a192f',
          light: '#ffffff'
        }
      }).then(dataUrl => {
        setQrDataUrl(dataUrl);
      }).catch(err => {
        console.error('Error generando QR:', err);
      });

      // Cargar plantilla oficial y convertir a base64 para copiado inteligente
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = '/plantilla_afiche.jpg';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 800;
        canvas.height = img.naturalHeight || 1000;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          try {
            const data64 = canvas.toDataURL('image/jpeg', 0.92);
            setPlantillaBase64(data64);
          } catch (e) {
            console.warn('Canvas toDataURL warning:', e);
          }
        }
      };
    }
  }, [curso.id]);

  // Generar el texto exacto del prompt
  const getPromptText = () => {
    return `Actúa como un experto en diseño y marketing educativo. Tu objetivo es crear afiches publicitarios para cursos de capacitación, asegurando que se incluya **exactamente** la siguiente información obligatoria:

### Información Obligatoria (No omitir ni modificar):
1. **Título Principal:** "CURSOS DE CAPACITACIÓN".
2. **Título del Curso:** ${nombreCurso}
3. **Sección "Aprenderás":** ${aprenderas}
4. **Inversión:** "Inversión: Bs. ${costo}"
5. **Modalidad:** "${modalidad}"
6. **Banner de Certificación (Abajo):**
🔴 CADA CERTIFICADO CUENTA CON RESOLUCIÓN MINISTERIAL
   📄 INCLUYE FOTOCOPIA LEGALIZADA lista y apta para:
   ✅ Compulsas de Mérito (Puntaje garantizado en convocatorias).
   ✅ Procesos de Licitación en SICOES (Cumplimiento de personal clave).
   ✅ Trámites de Ascenso y Registro SYSO ante el Ministerio de Trabajo, Empleo y Previsión Social (MTEPS).

### Proceso de Generación de Imagen:
Usa la herramienta de generación de imágenes para crear un afiche con estas especificaciones:
- **Elemento Central**: Un **personaje hiperrealista** (un instructor profesional o un estudiante con apariencia de experto) que transmita confianza y éxito.
- **Estilo**: Fotografía publicitaria de alta gama, limpia y corporativa.
- **Formato**: Vertical (4:5).
- **Colores**: Azul Marino, Amarillo, Blanco y Gris.
- **Integración**: Coloca el logo de C.E.A. Martha Mendoza arriba a la derecha. El texto obligatorio debe ser nítido y legible, integrado armoniosamente en el diseño.

### Instrucciones:
1. Charla con el usuario para obtener el nombre del curso y los puntos clave de "Aprenderás".
2. Genera un copy publicitario para redes sociales con emojis.
3. Crea la imagen hiperrealista final integrando todos los elementos mencionados.

EJEMPLO:
CURSO 1 : ${nombreCurso}

Aprenderás: ${aprenderas}

---
🔗 ENLACE OFICIAL DE INSCRIPCIÓN (Para el Código QR):
${enlaceInscripcion}`;
  };

  // Helper para mostrar feedback copiado
  const showCopiedFeedback = (type: string, message: string) => {
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2500);
    Swal.fire({
      icon: 'success',
      title: '¡Copiado con éxito!',
      text: message,
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 2800
    });
  };

  // 1. Copiar TODO (Prompt + Plantilla + QR)
  const handleCopyAll = async () => {
    const promptText = getPromptText();

    try {
      // Intentar copiar HTML enriquecido con imágenes incrustadas + texto plano
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; color: #1e293b; line-height: 1.5;">
          <pre style="white-space: pre-wrap; font-family: inherit;">${promptText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
          <hr />
          <h3>Plantilla de Afiche de Referencia:</h3>
          ${plantillaBase64 ? `<p><img src="${plantillaBase64}" alt="Plantilla de Afiche" style="max-width: 400px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" /></p>` : ''}
          <h3>Código QR para Inscripciones:</h3>
          ${qrDataUrl ? `<p><img src="${qrDataUrl}" alt="Código QR" style="max-width: 250px;" /></p>` : ''}
          <p><strong>Enlace directo:</strong> <a href="${enlaceInscripcion}">${enlaceInscripcion}</a></p>
        </div>
      `;

      if (navigator.clipboard && typeof window.ClipboardItem !== 'undefined') {
        const textBlob = new Blob([promptText], { type: 'text/plain' });
        const htmlBlob = new Blob([htmlContent], { type: 'text/html' });

        await navigator.clipboard.write([
          new ClipboardItem({
            'text/plain': textBlob,
            'text/html': htmlBlob
          })
        ]);
        showCopiedFeedback('all', 'Se copió el Prompt completo, la Plantilla y el QR (compatible con chats, documentos y editores).');
        return;
      }

      // Fallback a texto
      await navigator.clipboard.writeText(promptText);
      showCopiedFeedback('all', 'Se copió el texto completo del Prompt y enlaces al portapapeles.');
    } catch (err) {
      console.warn('Fallback copy plain text due to:', err);
      try {
        await navigator.clipboard.writeText(promptText);
        showCopiedFeedback('all', 'Prompt copiado al portapapeles en texto plano.');
      } catch (e) {
        Swal.fire('Error', 'No se pudo copiar automáticamente. Por favor seleccione el texto manualmente.', 'error');
      }
    }
  };

  // 2. Copiar solo Prompt
  const handleCopyPromptOnly = async () => {
    try {
      await navigator.clipboard.writeText(getPromptText());
      showCopiedFeedback('prompt', 'Prompt copiado listo para pegar en ChatGPT, Midjourney, Claude o Gemini.');
    } catch (err) {
      Swal.fire('Error', 'No se pudo copiar el texto.', 'error');
    }
  };

  // 3. Copiar Imagen de Plantilla como PNG
  const handleCopyPlantillaImage = async () => {
    try {
      const response = await fetch('/plantilla_afiche.jpg');
      const blob = await response.blob();
      // Convertir a PNG para compatibilidad con ClipboardItem
      const img = new Image();
      img.src = URL.createObjectURL(blob);
      await new Promise(res => { img.onload = res; });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0);

      canvas.toBlob(async (pngBlob) => {
        if (pngBlob && navigator.clipboard && typeof window.ClipboardItem !== 'undefined') {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': pngBlob })
          ]);
          showCopiedFeedback('plantilla', 'Imagen de la plantilla copiada. Puedes pegarla (Ctrl+V) directamente en tu editor o chat con IA.');
        } else {
          // Descarga directa si el navegador no permite escribir imagen al portapapeles
          handleDownloadPlantilla();
        }
      }, 'image/png');
    } catch (err) {
      handleDownloadPlantilla();
    }
  };

  // 4. Copiar Imagen de Código QR
  const handleCopyQrImage = async () => {
    if (!qrDataUrl) return;
    try {
      const res = await fetch(qrDataUrl);
      const blob = await res.blob();
      if (navigator.clipboard && typeof window.ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        showCopiedFeedback('qr', 'Código QR copiado al portapapeles como imagen PNG.');
      } else {
        handleDownloadQr();
      }
    } catch (err) {
      handleDownloadQr();
    }
  };

  // Descargas
  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `QR_Inscripcion_${curso.id || 'curso'}.png`;
    a.click();
  };

  const handleDownloadPlantilla = () => {
    const a = document.createElement('a');
    a.href = '/plantilla_afiche.jpg';
    a.download = 'plantilla_afiche_referencia.jpg';
    a.click();
  };

  // Manejo de Arrastrar y Soltar para Afiche
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processSelectedFile(e.target.files[0]);
    }
  };

  const processSelectedFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      Swal.fire('Archivo inválido', 'Por favor selecciona un archivo de imagen (JPG, PNG, WEBP).', 'warning');
      return;
    }
    setUploadedFile(file);
    const localUrl = URL.createObjectURL(file);
    setPreviewLocalUrl(localUrl);
    setActiveTab('afiche');
  };

  // Guardar Afiche
  const handleSaveAfiche = async () => {
    if (!uploadedFile && !previewLocalUrl) {
      Swal.fire('Seleccione un afiche', 'Por favor sube o arrastra una imagen para el afiche antes de guardar.', 'info');
      return;
    }

    setIsSavingAfiche(true);
    try {
      let finalUrl = currentAficheUrl;

      if (uploadedFile) {
        // Enviar a la API local de Next.js
        const formData = new FormData();
        formData.append('file', uploadedFile);
        formData.append('cursoId', curso.id || 'general');

        const res = await fetch('/api/afiche/upload', {
          method: 'POST',
          body: formData
        });

        const resData = await res.json();
        if (!res.ok || !resData.success) {
          throw new Error(resData.message || 'Error al guardar imagen en servidor');
        }

        finalUrl = resData.url;
      }

      // Guardar en localStorage para respaldo instantáneo
      if (typeof window !== 'undefined' && curso.id) {
        localStorage.setItem(`afiche_curso_${curso.id}`, finalUrl);
        // También actualizar temario si se editó
        localStorage.setItem(`temario_curso_${curso.id}`, aprenderas);
      }

      // Intentar actualizar Supabase (con fallback silencioso si las columnas no existen aún)
      if (curso.id) {
        try {
          await supabase
            .from('cursos')
            .update({
              afiche_url: finalUrl,
              updated_at: new Date().toISOString()
            })
            .eq('id', curso.id);
        } catch (dbErr) {
          console.warn('Nota: columna afiche_url en Supabase pendiente de migración SQL, guardado en servidor y local:', dbErr);
        }
      }

      setCurrentAficheUrl(finalUrl);
      setUploadedFile(null);
      if (onAficheSaved) {
        onAficheSaved(finalUrl);
      }

      Swal.fire({
        icon: 'success',
        title: '¡Afiche Guardado!',
        text: 'El afiche oficial del curso fue asignado y guardado exitosamente.',
        confirmButtonColor: '#2563eb'
      });

    } catch (err: any) {
      console.error('Error al guardar afiche:', err);
      Swal.fire('Error', err.message || 'No se pudo guardar el afiche.', 'error');
    } finally {
      setIsSavingAfiche(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '16px'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '1080px',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        overflow: 'hidden',
        animation: 'modalSlideIn 0.25s ease-out'
      }}>
        
        {/* ENCABEZADO DEL MODAL */}
        <div style={{
          background: 'linear-gradient(135deg, #0d3b66 0%, #1e3a8a 50%, #0f172a 100%)',
          color: '#ffffff',
          padding: '18px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)'
            }}>
              <Sparkles size={22} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  background: 'rgba(245, 158, 11, 0.25)',
                  color: '#fbbf24',
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '999px',
                  letterSpacing: '0.5px',
                  border: '1px solid rgba(251, 191, 36, 0.4)'
                }}>
                  GENERADOR INTELIGENTE
                </span>
                <span style={{ fontSize: '12px', color: '#93c5fd' }}>ID: {curso.id || 'Nuevo'}</span>
              </div>
              <h2 style={{ margin: '3px 0 0 0', fontSize: '19px', fontWeight: 800, color: '#f8fafc' }}>
                PROMPT IA • Generador de Afiche, QR y Plantilla
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              color: '#ffffff',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)')}
            onMouseOut={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)')}
            title="Cerrar modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* BARRA DE PESTAÑAS Y ACCIÓN RÁPIDA */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '12px 24px',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0'
        }}>
          {/* Pestañas */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              onClick={() => setActiveTab('prompt')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 16px',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                border: 'none',
                background: activeTab === 'prompt' ? '#0d3b66' : '#ffffff',
                color: activeTab === 'prompt' ? '#ffffff' : '#64748b',
                boxShadow: activeTab === 'prompt' ? '0 4px 12px rgba(13, 59, 102, 0.25)' : 'none',
                transition: 'all 0.2s'
              }}
            >
              <FileText size={16} /> 1. Prompt IA Oficial
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('plantilla_qr')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 16px',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                border: 'none',
                background: activeTab === 'plantilla_qr' ? '#0d3b66' : '#ffffff',
                color: activeTab === 'plantilla_qr' ? '#ffffff' : '#64748b',
                boxShadow: activeTab === 'plantilla_qr' ? '0 4px 12px rgba(13, 59, 102, 0.25)' : 'none',
                transition: 'all 0.2s'
              }}
            >
              <Layers size={16} /> 2. Plantilla & Código QR
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('afiche')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 16px',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                border: 'none',
                background: activeTab === 'afiche' ? '#0d3b66' : '#ffffff',
                color: activeTab === 'afiche' ? '#ffffff' : '#64748b',
                boxShadow: activeTab === 'afiche' ? '0 4px 12px rgba(13, 59, 102, 0.25)' : 'none',
                transition: 'all 0.2s'
              }}
            >
              <UploadCloud size={16} /> 3. Subir Afiche Final
              {currentAficheUrl && (
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
              )}
            </button>
          </div>

          {/* BOTÓN SUPERIOR: COPIAR TODO */}
          <button
            type="button"
            onClick={handleCopyAll}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 18px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              border: 'none',
              background: copiedType === 'all' ? '#16a34a' : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              color: '#ffffff',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
              transition: 'all 0.2s'
            }}
            title="Copia el Prompt con formato + Plantilla + QR todo en uno para pegar en documentos, chats o editores"
          >
            {copiedType === 'all' ? <Check size={16} /> : <Copy size={16} />}
            {copiedType === 'all' ? '¡TODO COPIADO!' : 'Copiar Todo (Prompt + QR + Plantilla)'}
          </button>
        </div>

        {/* CONTENIDO DEL MODAL SEGÚN PESTAÑA */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, backgroundColor: '#ffffff' }}>

          {/* ======================================================== */}
          {/* PESTAÑA 1: PROMPT IA */}
          {/* ======================================================== */}
          {activeTab === 'prompt' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 380px) 1fr', gap: '24px' }}>
              
              {/* Columna Izquierda: Parámetros y Datos del Curso */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{
                  background: '#f8fafc',
                  padding: '16px',
                  borderRadius: '14px',
                  border: '1px solid #e2e8f0'
                }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Info size={16} color="#2563eb" /> Datos del Curso para el Prompt
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                        Título del Curso:
                      </label>
                      <input
                        type="text"
                        value={nombreCurso}
                        onChange={(e) => setNombreCurso(e.target.value)}
                        placeholder="Nombre específico del curso..."
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '13px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                        Sección "¿Qué aprenderás?" (Temario):
                      </label>
                      <textarea
                        rows={4}
                        value={aprenderas}
                        onChange={(e) => setAprenderas(e.target.value)}
                        placeholder="Puntos clave y contenidos detallados..."
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '12px',
                          boxSizing: 'border-box',
                          resize: 'vertical'
                        }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                          Inversión (Bs):
                        </label>
                        <input
                          type="number"
                          value={costo}
                          onChange={(e) => setCosto(Number(e.target.value))}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            fontSize: '13px',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                          Modalidad:
                        </label>
                        <input
                          type="text"
                          value={modalidad}
                          onChange={(e) => setModalidad(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            fontSize: '13px',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Resumen del Banner de Certificación */}
                <div style={{
                  background: '#fef2f2',
                  padding: '14px',
                  borderRadius: '12px',
                  border: '1px solid #fecaca',
                  fontSize: '11px',
                  color: '#991b1b',
                  lineHeight: '1.45'
                }}>
                  <strong style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>
                    🔴 Banner de Certificación Obligatorio:
                  </strong>
                  • Resolución Ministerial garantizada<br />
                  • Fotocopia Legalizada para Compulsas de Mérito<br />
                  • Procesos de Licitación en SICOES (Personal clave)<br />
                  • Trámites de Ascenso y Registro SYSO (MTEPS)
                </div>

                {/* Acciones de Copiado de esta vista */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={handleCopyPromptOnly}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '10px',
                      borderRadius: '8px',
                      background: copiedType === 'prompt' ? '#15803d' : '#0d3b66',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '13px',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {copiedType === 'prompt' ? <Check size={16} /> : <Copy size={16} />}
                    Copiar Solo Prompt de Texto
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyPlantillaImage}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '9px',
                      borderRadius: '8px',
                      background: '#f1f5f9',
                      color: '#334155',
                      fontWeight: 600,
                      fontSize: '12px',
                      border: '1px solid #cbd5e1',
                      cursor: 'pointer'
                    }}
                  >
                    <ImageIcon size={15} color="#2563eb" /> Copiar Imagen Plantilla de Referencia
                  </button>
                </div>
              </div>

              {/* Columna Derecha: Vista Previa del Prompt Completo */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 800, color: '#334155' }}>
                    Formato del Prompt Generado (Listo para IA):
                  </label>
                  <button
                    type="button"
                    onClick={handleCopyPromptOnly}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: 'none',
                      border: 'none',
                      color: '#2563eb',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    <Copy size={14} /> Copiar Prompt
                  </button>
                </div>

                <div style={{
                  background: '#0f172a',
                  color: '#e2e8f0',
                  padding: '16px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  lineHeight: '1.6',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  overflowY: 'auto',
                  maxHeight: '460px',
                  border: '1px solid #334155'
                }}>
                  {getPromptText()}
                </div>
              </div>

            </div>
          )}

          {/* ======================================================== */}
          {/* PESTAÑA 2: PLANTILLA & CÓDIGO QR */}
          {/* ======================================================== */}
          {activeTab === 'plantilla_qr' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              
              {/* Tarjeta: Plantilla Oficial de Referencia */}
              <div style={{
                background: '#f8fafc',
                borderRadius: '16px',
                padding: '20px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <ImageIcon size={20} color="#2563eb" />
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                    Plantilla Oficial de Referencia
                  </h3>
                </div>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 16px 0', maxWidth: '380px' }}>
                  Esta imagen sirve como guía visual exacta de colores (azul, amarillo, blanco), tipografía, logo y estructura corporativa.
                </p>

                <div style={{
                  borderRadius: '12px',
                  overflow: 'hidden',
                  border: '2px solid #cbd5e1',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.1)',
                  maxHeight: '340px',
                  marginBottom: '16px',
                  background: '#000000'
                }}>
                  <img
                    src="/plantilla_afiche.jpg"
                    alt="Plantilla Afiche Referencia"
                    style={{ maxHeight: '340px', width: 'auto', display: 'block', objectFit: 'contain' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', width: '100%', maxWidth: '360px' }}>
                  <button
                    type="button"
                    onClick={handleCopyPlantillaImage}
                    style={{
                      flex: 1,
                      padding: '9px 12px',
                      borderRadius: '8px',
                      background: copiedType === 'plantilla' ? '#15803d' : '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    {copiedType === 'plantilla' ? <Check size={14} /> : <Copy size={14} />}
                    Copiar Imagen
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadPlantilla}
                    style={{
                      padding: '9px 14px',
                      borderRadius: '8px',
                      background: '#ffffff',
                      color: '#334155',
                      border: '1px solid #cbd5e1',
                      fontWeight: 600,
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Download size={14} /> Descargar
                  </button>
                </div>
              </div>

              {/* Tarjeta: Código QR Dinámico del Curso */}
              <div style={{
                background: '#f8fafc',
                borderRadius: '16px',
                padding: '20px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <QrCode size={20} color="#16a34a" />
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                    Código QR de Inscripción
                  </h3>
                </div>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 16px 0', maxWidth: '380px' }}>
                  Generado automáticamente para el enlace público de este curso. Colócalo en la esquina inferior izquierda del afiche.
                </p>

                <div style={{
                  background: '#ffffff',
                  padding: '16px',
                  borderRadius: '16px',
                  border: '2px solid #cbd5e1',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.06)',
                  marginBottom: '16px'
                }}>
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="Código QR de Inscripción"
                      style={{ width: '220px', height: '220px', display: 'block' }}
                    />
                  ) : (
                    <div style={{ width: '220px', height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                      Generando QR...
                    </div>
                  )}
                </div>

                <div style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '11px',
                  color: '#2563eb',
                  maxWidth: '340px',
                  wordBreak: 'break-all',
                  marginBottom: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <ExternalLink size={12} /> {enlaceInscripcion}
                </div>

                <div style={{ display: 'flex', gap: '10px', width: '100%', maxWidth: '360px' }}>
                  <button
                    type="button"
                    onClick={handleCopyQrImage}
                    style={{
                      flex: 1,
                      padding: '9px 12px',
                      borderRadius: '8px',
                      background: copiedType === 'qr' ? '#15803d' : '#16a34a',
                      color: '#ffffff',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    {copiedType === 'qr' ? <Check size={14} /> : <Copy size={14} />}
                    Copiar QR
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadQr}
                    style={{
                      padding: '9px 14px',
                      borderRadius: '8px',
                      background: '#ffffff',
                      color: '#334155',
                      border: '1px solid #cbd5e1',
                      fontWeight: 600,
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Download size={14} /> Descargar
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* ======================================================== */}
          {/* PESTAÑA 3: SUBIR O ARRASTRAR AFICHE */}
          {/* ======================================================== */}
          {activeTab === 'afiche' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: previewLocalUrl || currentAficheUrl ? '1fr 340px' : '1fr', gap: '24px' }}>
                
                {/* Zona de Drag & Drop */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: dragActive ? '3px dashed #2563eb' : '2px dashed #cbd5e1',
                      backgroundColor: dragActive ? '#eff6ff' : '#f8fafc',
                      borderRadius: '16px',
                      padding: '40px 24px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: '260px'
                    }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileInputChange}
                      style={{ display: 'none' }}
                    />

                    <div style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      background: '#e0e7ff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '16px',
                      color: '#4338ca'
                    }}>
                      <UploadCloud size={32} />
                    </div>

                    <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 800, color: '#1e293b' }}>
                      Arrastra y suelta aquí el afiche publicitario
                    </h4>
                    <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: '#64748b', maxWidth: '380px' }}>
                      O haz clic para explorar en tu computadora (Formatos soportados: JPG, PNG, WEBP).
                    </p>

                    <button
                      type="button"
                      style={{
                        padding: '8px 18px',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 700,
                        color: '#334155',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
                      }}
                    >
                      Examinar Archivo...
                    </button>
                  </div>

                  {uploadedFile && (
                    <div style={{
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '10px',
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CheckCircle2 size={18} color="#16a34a" />
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#15803d' }}>
                            Archivo seleccionado: {uploadedFile.name}
                          </div>
                          <div style={{ fontSize: '11px', color: '#65a30d' }}>
                            {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB • Listo para guardar
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleSaveAfiche}
                        disabled={isSavingAfiche}
                        style={{
                          padding: '8px 18px',
                          background: '#16a34a',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          fontWeight: 700,
                          fontSize: '13px',
                          cursor: isSavingAfiche ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        {isSavingAfiche ? 'Guardando...' : '💾 Confirmar y Guardar Afiche'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Previsualización del Afiche Cargado */}
                {(previewLocalUrl || currentAficheUrl) && (
                  <div style={{
                    background: '#f8fafc',
                    borderRadius: '16px',
                    border: '1px solid #e2e8f0',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: '#15803d', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={14} /> {previewLocalUrl ? 'Vista Previa Nueva' : 'Afiche Actual'}
                      </span>

                      {currentAficheUrl && (
                        <a
                          href={currentAficheUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: '11px', color: '#2563eb', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}
                        >
                          <Eye size={12} /> Ver Completo
                        </a>
                      )}
                    </div>

                    <div style={{
                      borderRadius: '12px',
                      overflow: 'hidden',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                      maxHeight: '360px',
                      width: '100%',
                      background: '#000000',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <img
                        src={previewLocalUrl || currentAficheUrl}
                        alt="Afiche del Curso"
                        style={{ maxHeight: '360px', width: '100%', objectFit: 'contain' }}
                      />
                    </div>

                    {!uploadedFile && currentAficheUrl && (
                      <div style={{ marginTop: '14px', width: '100%', display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          style={{
                            flex: 1,
                            padding: '8px',
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Reemplazar Afiche
                        </button>
                      </div>
                    )}
                  </div>
                )}

              </div>

            </div>
          )}

        </div>

        {/* PIE DE PÁGINA DEL MODAL */}
        <div style={{
          padding: '14px 24px',
          background: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={14} color="#f59e0b" />
            <span>Los afiches y QR quedan vinculados al curso <strong>{curso.nombre || curso.id}</strong>.</span>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={handleCopyAll}
              style={{
                padding: '9px 18px',
                background: '#0d3b66',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Copy size={14} /> Copiar Todo
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '9px 18px',
                background: '#e2e8f0',
                color: '#334155',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Cerrar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
