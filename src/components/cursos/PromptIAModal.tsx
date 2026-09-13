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

export interface PlantillaSlot {
  id: number;
  nombre: string;
  descripcion: string;
  url: string;
  defaultUrl: string;
}

// IndexedDB para almacenamiento ilimitado de imágenes de plantillas
const IDB_NAME = 'cee_plantillas_db';
const IDB_STORE = 'plantillas';

function openPlantillasDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB no soportado'));
    }
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function savePlantillaToIDB(key: string, dataUrl: string): Promise<void> {
  try {
    const db = await openPlantillasDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.put(dataUrl, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('Advertencia IndexedDB save:', e);
  }
}

async function getPlantillaFromIDB(key: string): Promise<string | null> {
  try {
    const db = await openPlantillasDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function removePlantillaFromIDB(key: string): Promise<void> {
  try {
    const db = await openPlantillasDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

/**
 * Comprime y escala cualquier imagen (JPG, PNG, WEBP, fotos pesadas de celular)
 * a una resolución óptima para afiches (~1400px máx) produciendo un JPEG de ~150-250KB.
 * Esto evita errores de límite de memoria y de cuota de localStorage.
 */
function compressImageForTemplate(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo seleccionado.'));
    reader.onload = (event) => {
      const result = event.target?.result;
      if (!result || typeof result !== 'string') {
        return reject(new Error('El archivo no contiene datos legibles.'));
      }

      const img = new Image();
      img.onerror = () => reject(new Error('El formato del archivo no es compatible con el visor de imágenes.'));
      img.onload = () => {
        try {
          const maxDimension = 1400;
          let width = img.naturalWidth || img.width || 800;
          let height = img.naturalHeight || img.height || 1000;

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return resolve(result);
          }

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          const compressed = canvas.toDataURL('image/jpeg', 0.85);
          resolve(compressed);
        } catch (canvasErr) {
          console.warn('Compresión canvas en fallback:', canvasErr);
          resolve(result);
        }
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  });
}

const DEFAULT_PLANTILLAS: PlantillaSlot[] = [
  {
    id: 1,
    nombre: 'Plantilla 1: Oficial C.E.A.',
    descripcion: 'Diseño azul marino y amarillo, logo institucional y banner ministerial',
    url: '',
    defaultUrl: '/plantilla_afiche.jpg'
  },
  {
    id: 2,
    nombre: 'Plantilla 2: Corporativa Azul',
    descripcion: 'Estilo formal y estructurado de alto impacto para cursos técnicos',
    url: '',
    defaultUrl: '/plantilla_afiche.jpg'
  },
  {
    id: 3,
    nombre: 'Plantilla 3: Moderna Tech',
    descripcion: 'Diseño oscuro de alta tecnología con tipografía moderna y nítida',
    url: '',
    defaultUrl: '/plantilla_afiche.jpg'
  },
  {
    id: 4,
    nombre: 'Plantilla 4: Ejecutiva Dorada',
    descripcion: 'Acabado premium de prestigio para licitaciones y cargos directivos',
    url: '',
    defaultUrl: '/plantilla_afiche.jpg'
  }
];

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

  // Estados de las 4 Plantillas Oficiales (Persistentes globalmente en localStorage para todos los cursos)
  const [plantillas, setPlantillas] = useState<PlantillaSlot[]>(() => {
    if (typeof window !== 'undefined') {
      return DEFAULT_PLANTILLAS.map(p => {
        const saved = localStorage.getItem(`plantilla_oficial_slot_${p.id}`);
        return {
          ...p,
          url: saved || (p.id === 1 ? '/plantilla_afiche.jpg' : '')
        };
      });
    }
    return DEFAULT_PLANTILLAS;
  });

  const [activeSlotId, setActiveSlotId] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('plantilla_oficial_activa_slot');
      return saved ? Number(saved) || 1 : 1;
    }
    return 1;
  });

  const [uploadingSlotId, setUploadingSlotId] = useState<number>(1);
  const [isUpdatingPlantilla, setIsUpdatingPlantilla] = useState<boolean>(false);

  // Determinar la plantilla activa actual
  const activePlantilla = plantillas.find(p => p.id === activeSlotId) || plantillas[0];
  const plantillaUrl = activePlantilla.url || activePlantilla.defaultUrl || '/plantilla_afiche.jpg';

  // Estados de QR y Canvas Base64
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
  const plantillaFileInputRef = useRef<HTMLInputElement>(null);

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

      // Cargar plantilla activa y convertir a base64 para copiado inteligente
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = plantillaUrl;
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
            setPlantillaBase64(plantillaUrl);
          }
        }
      };
      img.onerror = () => {
        setPlantillaBase64(plantillaUrl);
      };
    }
  }, [curso.id, plantillaUrl]);

  // Cargar plantillas desde IndexedDB si faltasen en localStorage
  useEffect(() => {
    let active = true;
    (async () => {
      const updated = await Promise.all(
        plantillas.map(async (p) => {
          if (!p.url) {
            const idbVal = await getPlantillaFromIDB(`plantilla_oficial_slot_${p.id}`);
            if (idbVal) return { ...p, url: idbVal };
          }
          return p;
        })
      );
      if (active) {
        setPlantillas(updated);
      }
    })();
    return () => { active = false; };
  }, []);

  // Generar el texto exacto del prompt
  const getPromptText = () => {
    return `Actúa como un experto en diseño y marketing educativo. Tu objetivo es crear afiches publicitarios para cursos de capacitación, asegurando que se incluya **exactamente** la siguiente información obligatoria:

### Información Obligatoria (No omitir ni modificar):
1. **Título Principal:** "CURSOS DE CAPACITACIÓN".
2. **Título del Curso:** ${nombreCurso}
3. **Sección "Aprenderás":** ${aprenderas}
4. **Inversión:** "Inversión: Bs. ${costo}"
5. **Modalidad:** "${modalidad}"
6. **Código QR Oficial de Inscripción:** Ubicado en la esquina inferior izquierda del afiche (sobre un recuadro blanco cuadrado de alto contraste). Se debe incluir **obligatoriamente el Código QR oficial provisto sin sufrir ninguna modificación**, respetando estrictamente su matriz original, orientación, proporción de aspecto cuadrada 1:1, contraste nítido y módulos de escaneo para que sea 100% escaneable desde cualquier smartphone.
7. **Banner de Certificación (Abajo a la derecha):**
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
- **Preservación del Código QR Oficial (Estricto)**: El Código QR oficial adjunto debe insertarse en la esquina inferior izquierda tal cual es, **SIN sufrir modificaciones**, sin inclinaciones en perspectiva 3D, sin curvaturas, sin filtros ni desenfoques que rompan los patrones de lectura de las esquinas del QR. Debe mantenerse plano, cuadrado, limpio y de máxima resolución.
- **Integración**: Coloca el logo de C.E.A. Martha Mendoza arriba a la derecha. El Código QR oficial en la esquina inferior izquierda, y el Banner de Certificación abajo a la derecha. El texto obligatorio y el código QR deben ser nítidos y legibles, integrados armoniosamente en el diseño publicitario.

### Instrucciones:
1. Charla con el usuario para obtener el nombre del curso y los puntos clave de "Aprenderás".
2. Genera un copy publicitario para redes sociales con emojis.
3. Inserta el Código QR oficial respetando intacto su formato, nitidez y funcionalidad de escaneo sin ninguna modificación.
4. Crea la imagen hiperrealista final integrando todos los elementos mencionados.

EJEMPLO:
CURSO 1 : ${nombreCurso}

Aprenderás: ${aprenderas}

---
📱 CÓDIGO QR OFICIAL: Inserta la imagen adjunta del QR en la esquina inferior izquierda sin ninguna modificación de formato o perspectiva.
🔗 Enlace oficial codificado en el QR: ${enlaceInscripcion}`;
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
      const img = new Image();
      if (plantillaUrl.startsWith('data:')) {
        img.src = plantillaUrl;
      } else {
        const response = await fetch(plantillaUrl);
        const blob = await response.blob();
        img.src = URL.createObjectURL(blob);
      }
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 800;
      canvas.height = img.naturalHeight || 1000;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0);

      canvas.toBlob(async (pngBlob) => {
        if (pngBlob && navigator.clipboard && typeof window.ClipboardItem !== 'undefined') {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': pngBlob })
          ]);
          showCopiedFeedback('plantilla', `Plantilla Oficial (${activePlantilla.nombre}) copiada al portapapeles.`);
        } else {
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

  // 5. Copiar AMBAS imágenes (Plantilla Oficial Activa + Código QR Oficial)
  const handleCopyBothImages = async () => {
    try {
      // 1. Cargar imagen de la plantilla activa
      const imgPlantilla = new Image();
      if (plantillaUrl.startsWith('data:')) {
        imgPlantilla.src = plantillaUrl;
      } else {
        const plantillaResp = await fetch(plantillaUrl);
        const plantillaBlob = await plantillaResp.blob();
        imgPlantilla.src = URL.createObjectURL(plantillaBlob);
      }
      await new Promise((res, rej) => {
        imgPlantilla.onload = res;
        imgPlantilla.onerror = rej;
      });

      // 2. Cargar imagen del QR
      let qrSource = qrDataUrl;
      if (!qrSource) {
        qrSource = await QRCode.toDataURL(enlaceInscripcion, { width: 500, margin: 2 });
      }
      const imgQr = new Image();
      imgQr.src = qrSource;
      await new Promise((res, rej) => {
        imgQr.onload = res;
        imgQr.onerror = rej;
      });

      // 3. Crear canvas compuesto de alta resolución (ambas imágenes nítidas)
      const pWidth = imgPlantilla.naturalWidth || 800;
      const pHeight = imgPlantilla.naturalHeight || 1000;
      const sidePanelWidth = Math.max(Math.round(pWidth * 0.62), 480);
      const totalWidth = pWidth + sidePanelWidth + 30;
      const totalHeight = pHeight;

      const canvas = document.createElement('canvas');
      canvas.width = totalWidth;
      canvas.height = totalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No se pudo inicializar canvas');

      // Fondo corporativo
      ctx.fillStyle = '#0a192f';
      ctx.fillRect(0, 0, totalWidth, totalHeight);

      // Dibujar plantilla de afiche a la izquierda
      ctx.drawImage(imgPlantilla, 0, 0, pWidth, pHeight);

      // Panel derecho para el QR Oficial
      const qrPanelX = pWidth + 20;
      const qrPanelY = 50;

      // Título en panel
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
      ctx.fillText('CÓDIGO QR OFICIAL', qrPanelX + 20, qrPanelY + 40);

      ctx.fillStyle = '#93c5fd';
      ctx.font = '16px system-ui, -apple-system, sans-serif';
      ctx.fillText('Sin modificaciones • 100% Escaneable', qrPanelX + 20, qrPanelY + 75);

      // Recuadro blanco para el QR
      const boxSize = sidePanelWidth - 40;
      const qrBoxX = qrPanelX + 20;
      const qrBoxY = qrPanelY + 105;

      ctx.fillStyle = '#ffffff';
      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(qrBoxX, qrBoxY, boxSize, boxSize, 16);
        ctx.fill();
      } else {
        ctx.fillRect(qrBoxX, qrBoxY, boxSize, boxSize);
      }

      // Dibujar QR centrado con margen dentro del recuadro
      const padding = 24;
      ctx.drawImage(imgQr, qrBoxX + padding, qrBoxY + padding, boxSize - (padding * 2), boxSize - (padding * 2));

      // Indicaciones inferiores
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
      ctx.fillText('🔴 Insertar intacto en esquina inferior izq.', qrPanelX + 20, qrBoxY + boxSize + 45);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '13px monospace';
      const shortUrl = enlaceInscripcion.length > 42 ? enlaceInscripcion.substring(0, 40) + '...' : enlaceInscripcion;
      ctx.fillText(shortUrl, qrPanelX + 20, qrBoxY + boxSize + 75);

      // 4. Copiar al portapapeles
      canvas.toBlob(async (blob) => {
        if (!blob) throw new Error('Error al generar imagen combinada');

        const htmlContent = `
          <div>
            <h3>Plantilla Oficial (${activePlantilla.nombre}):</h3>
            <p><img src="${plantillaBase64 || plantillaUrl}" alt="Plantilla" style="max-width: 450px;" /></p>
            <h3>Código QR Oficial (Sin Modificaciones):</h3>
            <p><img src="${qrDataUrl}" alt="Código QR" style="max-width: 300px;" /></p>
            <p><strong>Enlace directo:</strong> <a href="${enlaceInscripcion}">${enlaceInscripcion}</a></p>
          </div>
        `;

        if (navigator.clipboard && typeof window.ClipboardItem !== 'undefined') {
          const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
          const textBlob = new Blob([`PLANTILLA Y CÓDIGO QR OFICIAL\nEnlace: ${enlaceInscripcion}`], { type: 'text/plain' });

          try {
            await navigator.clipboard.write([
              new ClipboardItem({
                'image/png': blob,
                'text/html': htmlBlob,
                'text/plain': textBlob
              })
            ]);
            showCopiedFeedback('both_images', '¡Ambas imágenes (Plantilla + QR) copiadas! Pégalas directamente en Gemini con Ctrl+V.');
            return;
          } catch {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            showCopiedFeedback('both_images', '¡Ambas imágenes (Plantilla + QR) copiadas al portapapeles!');
            return;
          }
        }

        showCopiedFeedback('both_images', 'Imágenes preparadas.');
      }, 'image/png');

    } catch (err: any) {
      console.error('Error al copiar ambas imágenes:', err);
      Swal.fire('Error', 'No se pudieron procesar ambas imágenes automáticamente. Puedes copiarlas individualmente con los botones dedicados.', 'error');
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
    a.href = plantillaUrl;
    a.download = `plantilla_oficial_opcion_${activeSlotId}.jpg`;
    a.click();
  };

  // Selección de slot oficial activo
  const handleSelectSlot = (slotId: number) => {
    setActiveSlotId(slotId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('plantilla_oficial_activa_slot', String(slotId));
    }
    const selected = plantillas.find(p => p.id === slotId);
    Swal.fire({
      icon: 'success',
      title: `¡${selected?.nombre || `Plantilla ${slotId}`} Seleccionada!`,
      text: 'Esta plantilla ahora es la oficial activa para afiches, copiado y generación de prompts en todos los cursos.',
      toast: true,
      position: 'top-end',
      timer: 2600,
      showConfirmButton: false
    });
  };

  // Disparar input para subir imagen en slot específico
  const triggerUploadForSlot = (slotId: number) => {
    setUploadingSlotId(slotId);
    plantillaFileInputRef.current?.click();
  };

  const handlePlantillaFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleUpdateSlotImage(uploadingSlotId, file);
    e.target.value = '';
  };

  const handleUpdateSlotImage = async (slotId: number, file: File) => {
    try {
      setIsUpdatingPlantilla(true);

      // 1. Validar que sea un archivo de imagen
      if (file.type && !file.type.startsWith('image/')) {
        throw new Error('El archivo seleccionado no es una imagen válida.');
      }

      // 2. Comprimir y optimizar la imagen con canvas (inmune a cuota de localStorage)
      const base64Url = await compressImageForTemplate(file);

      // 3. Guardar en IndexedDB (sin límite de 5MB)
      await savePlantillaToIDB(`plantilla_oficial_slot_${slotId}`, base64Url);

      // 4. Guardar en localStorage de forma segura con protección anti-cuota
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(`plantilla_oficial_slot_${slotId}`, base64Url);
          localStorage.setItem('plantilla_oficial_activa_slot', String(slotId));
        } catch (storageErr) {
          console.warn('LocalStorage lleno, se usará IndexedDB para esta plantilla:', storageErr);
          try {
            localStorage.setItem('plantilla_oficial_activa_slot', String(slotId));
          } catch {}
        }
      }

      // 5. Actualizar estado reactivo
      setPlantillas(prev => prev.map(p => p.id === slotId ? { ...p, url: base64Url } : p));
      setActiveSlotId(slotId);

      // 6. Intentar sincronizar en backend de forma segura y opcional
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('isPlantilla', 'true');
        formData.append('slotId', String(slotId));
        await fetch('/api/afiche/upload', { method: 'POST', body: formData });
      } catch (e) {
        console.warn('Backend sync opcional ignorado:', e);
      }

      Swal.fire({
        icon: 'success',
        title: `¡Plantilla ${slotId} Guardada!`,
        text: `La imagen se procesó exitosamente y se configuró como la Plantilla Oficial Activa para todos los cursos.`,
        confirmButtonColor: '#2563eb'
      });
    } catch (err: any) {
      console.error('Error al actualizar plantilla:', err);
      Swal.fire('Error', err?.message || 'No se pudo procesar la imagen.', 'error');
    } finally {
      setIsUpdatingPlantilla(false);
    }
  };

  const handleResetSlot = async (slotId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(`plantilla_oficial_slot_${slotId}`);
      } catch {}
    }
    await removePlantillaFromIDB(`plantilla_oficial_slot_${slotId}`);

    setPlantillas(prev => prev.map(p => p.id === slotId ? { ...p, url: p.defaultUrl } : p));
    Swal.fire({
      icon: 'info',
      title: `Plantilla ${slotId} restablecida a su diseño por defecto`,
      toast: true,
      position: 'top-end',
      timer: 2200,
      showConfirmButton: false
    });
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

          {/* BOTONES SUPERIORES: ACCIONES ENUMERADAS EN ORDEN */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* 1. Plantilla + QR */}
            <button
              type="button"
              onClick={handleCopyBothImages}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                border: 'none',
                background: copiedType === 'both_images' ? '#16a34a' : 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                color: '#ffffff',
                boxShadow: '0 3px 10px rgba(124, 58, 237, 0.3)',
                transition: 'all 0.2s'
              }}
              title="1. Copia la Plantilla de Referencia + Código QR juntos para pegar en Gemini con Ctrl+V"
            >
              {copiedType === 'both_images' ? <Check size={15} /> : <ImageIcon size={15} />}
              {copiedType === 'both_images' ? '1. ¡Plantilla + QR Copiados!' : '1. Plantilla + QR'}
            </button>

            {/* 2. Copiar solo prompt de texto */}
            <button
              type="button"
              onClick={handleCopyPromptOnly}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                border: 'none',
                background: copiedType === 'prompt' ? '#16a34a' : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: '#ffffff',
                boxShadow: '0 3px 10px rgba(2, 132, 199, 0.25)',
                transition: 'all 0.2s'
              }}
              title="2. Copia solo el texto completo del Prompt para IA"
            >
              {copiedType === 'prompt' ? <Check size={15} /> : <Copy size={15} />}
              {copiedType === 'prompt' ? '2. ¡Prompt Copiado!' : '2. Copiar solo prompt de texto'}
            </button>

            {/* 3. Gemini AI */}
            <a
              href="https://gemini.google.com/app"
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 13px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 800,
                textDecoration: 'none',
                background: 'linear-gradient(135deg, #1e40af 0%, #312e81 100%)',
                color: '#ffffff',
                boxShadow: '0 3px 10px rgba(30, 64, 175, 0.25)'
              }}
              title="3. Abrir Google Gemini para generar el afiche con IA"
            >
              <Sparkles size={14} color="#fbbf24" /> 3. Gemini AI
            </a>

            {/* 4. Editar en PICS */}
            <a
              href="https://docs.google.com/images/u/0/"
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 13px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 800,
                textDecoration: 'none',
                background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
                color: '#ffffff',
                boxShadow: '0 3px 10px rgba(234, 88, 12, 0.25)'
              }}
              title="4. Abrir Google Docs Imágenes para retocar y editar afiches"
            >
              <ExternalLink size={14} /> 4. Editar en PICS
            </a>
          </div>
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

                {/* Requisito de Preservación de QR Oficial */}
                <div style={{
                  background: '#f0fdf4',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: '1px solid #bbf7d0',
                  fontSize: '11px',
                  color: '#166534',
                  lineHeight: '1.45'
                }}>
                  <strong style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px', fontSize: '12px' }}>
                    <QrCode size={14} color="#16a34a" /> Código QR Oficial Obligatorio:
                  </strong>
                  • Ubicado en la esquina inferior izquierda.<br />
                  • <strong>Sin modificaciones</strong>: se preserva plano, cuadrado y nítido para garantizar su lectura en cualquier celular.
                </div>

                {/* Acciones de Copiado de esta vista */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* Botón Destacado: Copiar Ambas Imágenes */}
                  <button
                    type="button"
                    onClick={handleCopyBothImages}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '11px',
                      borderRadius: '10px',
                      background: copiedType === 'both_images' ? '#15803d' : 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: '13px',
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(124, 58, 237, 0.35)'
                    }}
                    title="Copia juntas la Plantilla de Referencia y el Código QR oficial para pegarlas en Gemini"
                  >
                    {copiedType === 'both_images' ? <Check size={17} /> : <ImageIcon size={17} />}
                    {copiedType === 'both_images' ? '¡Ambas Imágenes Copiadas!' : '🖼️📱 Copiar Plantilla + QR (Ambas)'}
                  </button>

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

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={handleCopyPlantillaImage}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        background: '#f1f5f9',
                        color: '#334155',
                        fontWeight: 600,
                        fontSize: '11px',
                        border: '1px solid #cbd5e1',
                        cursor: 'pointer'
                      }}
                    >
                      <ImageIcon size={13} color="#2563eb" /> Solo Plantilla
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyQrImage}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        background: '#f1f5f9',
                        color: '#334155',
                        fontWeight: 600,
                        fontSize: '11px',
                        border: '1px solid #cbd5e1',
                        cursor: 'pointer'
                      }}
                    >
                      <QrCode size={13} color="#16a34a" /> Solo Código QR
                    </button>
                  </div>

                  {/* CAJA DE HERRAMIENTAS DIRECTAS (GEMINI + DOCS) */}
                  <div style={{
                    background: '#f8fafc',
                    borderRadius: '12px',
                    padding: '12px',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    marginTop: '4px'
                  }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                      🚀 Abrir Herramientas de Creación:
                    </span>

                    <a
                      href="https://gemini.google.com/app"
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '7px',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #1e3a8a 0%, #312e81 100%)',
                        color: '#ffffff',
                        fontWeight: 800,
                        fontSize: '12px',
                        textDecoration: 'none',
                        boxShadow: '0 2px 8px rgba(30, 58, 138, 0.25)'
                      }}
                    >
                      <Sparkles size={14} color="#fbbf24" /> Generar en Gemini AI (Abrir)
                    </a>

                    <a
                      href="https://docs.google.com/images/u/0/"
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '7px',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        background: '#ffffff',
                        color: '#1e293b',
                        fontWeight: 700,
                        fontSize: '12px',
                        border: '1px solid #cbd5e1',
                        textDecoration: 'none'
                      }}
                    >
                      <ExternalLink size={14} color="#2563eb" /> Editar Imágenes en Google Docs (Abrir)
                    </a>
                  </div>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              
              {/* SELECTOR DE LAS 4 PLANTILLAS OFICIALES */}
              <div style={{
                background: '#ffffff',
                borderRadius: '16px',
                border: '1.5px solid #e2e8f0',
                padding: '18px 20px',
                boxShadow: '0 4px 14px rgba(0,0,0,0.03)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Layers size={18} color="#2563eb" /> Variedad de Plantillas Oficiales (4 Opciones)
                    </h3>
                    <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                      Puedes subir imágenes personalizadas a cada espacio. La que selecciones será la <strong>Plantilla Oficial activa</strong> para todos los cursos.
                    </p>
                  </div>

                  <span style={{
                    fontSize: '12px',
                    fontWeight: 800,
                    padding: '4px 12px',
                    borderRadius: '20px',
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    border: '1px solid #bfdbfe',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}>
                    <CheckCircle2 size={14} color="#16a34a" /> Oficial Activa: Opción {activeSlotId}
                  </span>
                </div>

                {/* 4 Tarjetas de Plantillas */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                  gap: '12px'
                }}>
                  {plantillas.map((p) => {
                    const isSelected = p.id === activeSlotId;
                    const previewImg = p.url || p.defaultUrl || '/plantilla_afiche.jpg';
                    const hasCustom = !!p.url && p.url !== p.defaultUrl;

                    return (
                      <div
                        key={p.id}
                        onClick={() => handleSelectSlot(p.id)}
                        style={{
                          border: isSelected ? '2.5px solid #2563eb' : '1.5px solid #e2e8f0',
                          backgroundColor: isSelected ? '#f0f7ff' : '#ffffff',
                          borderRadius: '12px',
                          padding: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          boxShadow: isSelected ? '0 4px 14px rgba(37, 99, 235, 0.16)' : 'none',
                          transition: 'all 0.15s'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 800,
                            color: isSelected ? '#1d4ed8' : '#475569',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            {isSelected && <CheckCircle2 size={13} color="#2563eb" />}
                            Opción {p.id}
                          </span>

                          {isSelected ? (
                            <span style={{
                              background: '#16a34a',
                              color: '#ffffff',
                              fontSize: '10px',
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: '999px'
                            }}>
                              OFICIAL ACTIVA
                            </span>
                          ) : (
                            <span style={{
                              background: '#f1f5f9',
                              color: '#64748b',
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '6px'
                            }}>
                              Clic para activar
                            </span>
                          )}
                        </div>

                        {/* Miniatura */}
                        <div style={{
                          height: '130px',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          background: '#0f172a',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '1px solid #cbd5e1'
                        }}>
                          <img
                            src={previewImg}
                            alt={p.nombre}
                            style={{ maxHeight: '130px', width: '100%', objectFit: 'contain' }}
                          />
                        </div>

                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 800, color: '#1e293b' }}>
                            {p.nombre}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', lineHeight: '1.25' }}>
                            {p.descripcion}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '6px', marginTop: 'auto' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerUploadForSlot(p.id);
                            }}
                            disabled={isUpdatingPlantilla}
                            style={{
                              flex: 1,
                              padding: '6px 8px',
                              borderRadius: '6px',
                              background: isSelected ? '#2563eb' : '#ffffff',
                              color: isSelected ? '#ffffff' : '#334155',
                              border: isSelected ? 'none' : '1px solid #cbd5e1',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: isUpdatingPlantilla ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px'
                            }}
                            title={`Subir una imagen personalizada para la Plantilla ${p.id}`}
                          >
                            <UploadCloud size={12} /> {hasCustom ? 'Cambiar' : 'Subir'}
                          </button>

                          {hasCustom && (
                            <button
                              type="button"
                              onClick={(e) => handleResetSlot(p.id, e)}
                              style={{
                                padding: '6px 8px',
                                borderRadius: '6px',
                                background: '#fef2f2',
                                color: '#991b1b',
                                border: '1px solid #fecaca',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                              title="Restablecer diseño original"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Input oculto para cambiar cualquier slot de plantilla */}
              <input
                ref={plantillaFileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePlantillaFileInputChange}
                style={{ display: 'none' }}
              />

              {/* Detalle en tamaño grande de la Plantilla Oficial Activa + Código QR */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                
                {/* Tarjeta: Plantilla Oficial Activa */}
                <div style={{
                  background: '#f8fafc',
                  borderRadius: '16px',
                  padding: '20px',
                  border: '1.5px solid #2563eb',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  boxShadow: '0 4px 16px rgba(37, 99, 235, 0.08)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <ImageIcon size={20} color="#2563eb" />
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                      {activePlantilla.nombre}
                    </h3>
                  </div>
                  <div style={{ marginBottom: '14px' }}>
                    <span style={{
                      background: '#16a34a',
                      color: '#ffffff',
                      fontSize: '11px',
                      fontWeight: 800,
                      padding: '3px 10px',
                      borderRadius: '999px',
                      letterSpacing: '0.4px'
                    }}>
                      ★ PLANTILLA OFICIAL ACTIVA
                    </span>
                  </div>

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
                      src={plantillaUrl}
                      alt="Plantilla Oficial Activa"
                      style={{ maxHeight: '340px', width: 'auto', display: 'block', objectFit: 'contain' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', maxWidth: '360px' }}>
                    <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
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

                    <button
                      type="button"
                      disabled={isUpdatingPlantilla}
                      onClick={() => triggerUploadForSlot(activeSlotId)}
                      style={{
                        width: '100%',
                        padding: '9px 14px',
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        border: '1.5px dashed #3b82f6',
                        borderRadius: '8px',
                        fontWeight: 700,
                        fontSize: '12px',
                        cursor: isUpdatingPlantilla ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        transition: 'all 0.2s'
                      }}
                      title="Sube una nueva imagen para cambiar esta plantilla oficial"
                    >
                      <UploadCloud size={15} />
                      {isUpdatingPlantilla ? 'Cargando imagen...' : `🔄 Cambiar Imagen de Plantilla ${activeSlotId}`}
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

          <div>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '9px 24px',
                background: '#0f172a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(15, 23, 42, 0.15)',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = '#1e293b')}
              onMouseOut={(e) => (e.currentTarget.style.background = '#0f172a')}
            >
              Cerrar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
