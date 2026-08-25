'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import * as XLSX from 'xlsx';
import { Curso } from '@/types';
import {
  X, Search, UserPlus, Trash2, Save, Download, Printer,
  Loader2, ShieldAlert, CheckCircle2, AlertTriangle, Edit,
  Plus, Phone, ArrowRight, Check, RefreshCw, FileText, Camera, Upload,
  User, IdCard, Award, Hash, School, Sparkles, FileSpreadsheet, FileImage, File,
  CreditCard
} from 'lucide-react';
import Swal from 'sweetalert2';

interface Participante {
  ci: string;
  nombres: string;
  apellidos: string;
  rda: string | null;
  celular: string | null;
  sie: string | null;
  unidad_educativa: string | null;
  documento_url?: string | null;
  validado: boolean;
  observaciones_sie: string | null;
}

interface Inscripcion {
  id: number;
  nro: number;
  pagos: string;
  observaciones: string | null;
  comprobante_url?: string | null;
  documento_url?: string | null;
  participantes: Participante | null;
}

interface PreviewParticipant {
  ci: string;
  nombres: string;
  apellidos: string;
  rda: string;
  celular: string;
  sie: string;
  unidad_educativa: string;
}

interface ParticipantesModalProps {
  curso: Curso;
  onClose: () => void;
  onRefresh: () => void;
}

// --- Levenshtein Distance & Similarity Helpers ---
function getLevenshteinDistance(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, () =>
    Array(b.length + 1).fill(0)
  );
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + 1
        );
      }
    }
  }
  return matrix[a.length][b.length];
}

function cleanNameString(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^A-Za-z0-9\s]/g, "") // Remove punctuation/symbols (dots, commas, etc.)
    .replace(/\s+/g, " ")           // Collapse multiple spaces
    .trim()
    .toUpperCase();
}

function calculateDifferenceRatio(str1: string, str2: string): number {
  const s1 = cleanNameString(str1);
  const s2 = cleanNameString(str2);
  if (s1 === s2) return 0;
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 0;
  const distance = getLevenshteinDistance(s1, s2);
  return distance / maxLen;
}

export default function ParticipantesModal({
  curso,
  onClose,
  onRefresh
}: ParticipantesModalProps) {
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Importer Panel states
  const [showImporter, setShowImporter] = useState(false);
  const [activeImportTab, setActiveImportTab] = useState<'individual' | 'excel' | 'ia'>('ia');
  const [excelText, setExcelText] = useState('');
  const [previewList, setPreviewList] = useState<PreviewParticipant[]>([]);
  const [importingBatch, setImportingBatch] = useState(false);

  // Smart Excel / CSV File Importer Handler
  const handleSmartExcelFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

      const parsed: PreviewParticipant[] = [];

      for (const row of jsonRows) {
        const rowKeys = Object.keys(row);

        const getVal = (keywords: string[]) => {
          const foundKey = rowKeys.find(k => {
            const norm = String(k).toLowerCase().replace(/[^a-z0-9]/g, '');
            return keywords.some(kw => norm.includes(kw));
          });
          return foundKey ? String(row[foundKey]).trim() : '';
        };

        const rawCi = getVal(['ci', 'carnet', 'documento', 'cedula', 'dni']);
        const rawNombres = getVal(['nombres', 'nombre', 'participante']);
        const rawApellidos = getVal(['apellidos', 'apellido', 'paterno', 'materno']);
        const rawNombreCompleto = getVal(['nombrecompleto', 'nombreyapellido', 'estudiante', 'docente', 'maestro']);
        const rawCelular = getVal(['celular', 'telefono', 'whatsapp', 'cel', 'movil', 'fono']);
        const rawRda = getVal(['rda', 'registrorda', 'nrorda']);
        const rawUe = getVal(['unidadeducativa', 'colegio', 'escuela', 'ue', 'institucion']);
        const rawSie = getVal(['sie', 'codigosie', 'codsie']);

        let nombres = rawNombres;
        let apellidos = rawApellidos;

        if ((!nombres || !apellidos) && rawNombreCompleto) {
          const parts = rawNombreCompleto.trim().split(/\s+/);
          if (parts.length >= 3) {
            nombres = parts.slice(2).join(' ');
            apellidos = parts.slice(0, 2).join(' ');
          } else if (parts.length === 2) {
            nombres = parts[0];
            apellidos = parts[1];
          } else {
            nombres = rawNombreCompleto;
            apellidos = '';
          }
        }

        if (!rawCi && !nombres) continue;

        parsed.push({
          ci: rawCi.toUpperCase(),
          nombres: nombres.toUpperCase(),
          apellidos: apellidos.toUpperCase(),
          celular: rawCelular,
          rda: rawRda,
          unidad_educativa: rawUe.toUpperCase(),
          sie: rawSie,
        });
      }

      if (parsed.length === 0) {
        Swal.fire('Atención', 'No se encontraron registros válidos en el archivo Excel/CSV.', 'warning');
        return;
      }

      setPreviewList(parsed);
      Swal.fire({
        icon: 'success',
        title: '¡Archivo Excel/CSV Procesado!',
        text: `Se detectaron ${parsed.length} participantes listos para revisar e importar.`,
        timer: 2500,
        timerProgressBar: true,
      });
    } catch (err: any) {
      console.error(err);
      Swal.fire('Error', 'No se pudo leer el archivo Excel/CSV. Verifica el formato del archivo.', 'error');
    }
  };

  // Migration states
  const [showMigrator, setShowMigrator] = useState(false);
  const [migrSourceId, setMigrSourceId] = useState('');
  const [migrPreview, setMigrPreview] = useState<Inscripcion[]>([]);
  const [migrLoading, setMigrLoading] = useState(false);
  const [migrating, setMigrating] = useState(false);

  // Camera / IA uploader states
  const [cameraActive, setCameraActive] = useState(false);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [iaLoading, setIaLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Manual Add Form states
  const [addCi, setAddCi] = useState('');
  const [addNombres, setAddNombres] = useState('');
  const [addApellidos, setAddApellidos] = useState('');
  const [addRda, setAddRda] = useState('');
  const [addCelular, setAddCelular] = useState('');
  const [addSie, setAddSie] = useState('');
  const [addUnidadEducativa, setAddUnidadEducativa] = useState('');
  const [searchingCi, setSearchingCi] = useState(false);
  const [ciExists, setCiExists] = useState(false);

  // Edit core participant states
  const [editingPart, setEditingPart] = useState<Participante | null>(null);

  // SIE connection states
  const [sieUser, setSieUser] = useState('');
  const [siePass, setSiePass] = useState('');
  const [sieSession, setSieSession] = useState<{ sessionid: string; csrftoken: string } | null>(null);
  const [connectingSie, setConnectingSie] = useState(false);

  // Validation discrepancy details state
  const [discrepancyData, setDiscrepancyData] = useState<{
    db: Participante;
    sie: any;
    discrepancies: string[];
    inscripcionId: number;
  } | null>(null);
  const [validatingPartId, setValidatingPartId] = useState<number | null>(null);

  // Batch validating states
  const [validatingAll, setValidatingAll] = useState(false);
  const [validatingIndex, setValidatingIndex] = useState(0);
  const [validatingTotal, setValidatingTotal] = useState(0);

  // Fetch enrolled participants
  const fetchParticipantes = useCallback(async () => {
    setLoading(true);
    try {
      console.log('fetchParticipantes: Querying for curso.id =', curso.id);
      
      // 1. Try selecting with documento_url if column exists
      let queryRes: any = await supabase
        .from('inscripcion_ciclo')
        .select(`
          id,
          nro,
          pagos,
          observaciones,
          comprobante_url,
          documento_url,
          participantes (
            ci,
            nombres,
            apellidos,
            rda,
            celular,
            sie,
            unidad_educativa,
            documento_url,
            validado,
            observaciones_sie
          )
        `)
        .eq('curso_id', curso.id)
        .order('nro', { ascending: true });

      // 2. If PostgreSQL error because documento_url does not exist yet, fallback safely
      if (queryRes.error) {
        console.warn('fetchParticipantes: Falling back to base query without documento_url:', queryRes.error.message);
        queryRes = await supabase
          .from('inscripcion_ciclo')
          .select(`
            id,
            nro,
            pagos,
            observaciones,
            comprobante_url,
            participantes (
              ci,
              nombres,
              apellidos,
              rda,
              celular,
              sie,
              unidad_educativa,
              validado,
              observaciones_sie
            )
          `)
          .eq('curso_id', curso.id)
          .order('nro', { ascending: true });
      }

      const { data, error } = queryRes;

      if (error) throw error;
      const sortedData = ((data || []) as unknown as Inscripcion[]).sort((a, b) => {
        if (!a.participantes && !b.participantes) return 0;
        if (!a.participantes) return 1;
        if (!b.participantes) return -1;
        const lastNameA = a.participantes.apellidos?.trim().toLowerCase() || '';
        const lastNameB = b.participantes.apellidos?.trim().toLowerCase() || '';
        if (lastNameA !== lastNameB) {
          return lastNameA.localeCompare(lastNameB, 'es', { sensitivity: 'base' });
        }
        const firstNameA = a.participantes.nombres?.trim().toLowerCase() || '';
        const firstNameB = b.participantes.nombres?.trim().toLowerCase() || '';
        return firstNameA.localeCompare(firstNameB, 'es', { sensitivity: 'base' });
      });
      setInscripciones(sortedData);
    } catch (err: any) {
      console.error('Error fetching enrolled participants:', err);
      Swal.fire('Error', err?.message || 'No se pudieron cargar los participantes', 'error');
    } finally {
      setLoading(false);
    }
  }, [curso.id]);

  useEffect(() => {
    fetchParticipantes();

    // Check if session exists in sessionStorage
    const savedSession = sessionStorage.getItem('sie_session');
    if (savedSession) {
      try {
        setSieSession(JSON.parse(savedSession));
      } catch (e) {
        console.error('Failed to parse saved SIE session', e);
      }
    }
  }, [fetchParticipantes]);

  // Clean camera stream on unmount
  useEffect(() => {
    return () => {
      if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [videoStream]);

  // Handle updates to enrollment (pagos / observaciones)
  const handleUpdateEnrollment = async (id: number, pagos: string, observaciones: string) => {
    try {
      const { error } = await supabase
        .from('inscripcion_ciclo')
        .update({ pagos, observaciones: observaciones.trim() || null })
        .eq('id', id);

      if (error) throw error;

      Swal.fire({
        icon: 'success',
        title: 'Actualizado',
        text: 'Datos de inscripción guardados',
        timer: 1500,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
      fetchParticipantes();
    } catch (err: any) {
      Swal.fire('Error', err.message || 'No se pudo actualizar la inscripción', 'error');
    }
  };

  // Delete / Unenroll participant
  const handleDeleteEnrollment = async (id: number) => {
    const result = await Swal.fire({
      title: '¿Dar de baja al participante?',
      text: 'Se eliminará la inscripción del participante a este ciclo. Los datos personales del participante permanecerán en el sistema.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d93025',
      cancelButtonText: 'Cancelar',
      confirmButtonText: 'Sí, dar de baja'
    });

    if (result.isConfirmed) {
      try {
        const { error } = await supabase
          .from('inscripcion_ciclo')
          .delete()
          .eq('id', id);

        if (error) throw error;

        // Update course count to exact value from database
        const { count } = await supabase
          .from('inscripcion_ciclo')
          .select('*', { count: 'exact', head: true })
          .eq('curso_id', curso.id);
        await supabase
          .from('cursos')
          .update({ inscritos_formulario: count || 0 })
          .eq('id', curso.id);

        Swal.fire('Eliminado', 'Inscripción eliminada correctamente', 'success');
        onRefresh();
        fetchParticipantes();
      } catch (err: any) {
        Swal.fire('Error', err.message || 'No se pudo eliminar la inscripción', 'error');
      }
    }
  };

  // Manual Add Form CI search check
  const checkCiExist = async (ciVal: string) => {
    if (!ciVal.trim()) return;
    setSearchingCi(true);
    try {
      const { data, error } = await supabase
        .from('participantes')
        .select('*')
        .eq('ci', ciVal.trim())
        .single();

      if (data) {
        setAddNombres(data.nombres);
        setAddApellidos(data.apellidos);
        setAddRda(data.rda || '');
        setAddCelular(data.celular || '');
        setAddSie(data.sie || '');
        setAddUnidadEducativa(data.unidad_educativa || '');
        setCiExists(true);
      } else {
        setCiExists(false);
      }
    } catch (err) {
      setCiExists(false);
    } finally {
      setSearchingCi(false);
    }
  };

  // Handle Manual Add Participant Submission
  const handleAddParticipantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addCi.trim() || !addNombres.trim() || !addApellidos.trim()) {
      Swal.fire('Campos requeridos', 'Por favor llena los campos obligatorios (*)', 'warning');
      return;
    }

    const isEnrolled = inscripciones.some(
      (ins) => ins.participantes?.ci.trim() === addCi.trim()
    );
    if (isEnrolled) {
      Swal.fire('Ya registrado', 'Este participante ya está inscrito en este ciclo formativo', 'warning');
      return;
    }

    try {
      // 1. Get next serial number
      const { data: countData } = await supabase
        .from('inscripcion_ciclo')
        .select('nro')
        .eq('curso_id', curso.id)
        .order('nro', { ascending: false })
        .limit(1);
      const nextNro = countData && countData.length > 0 ? (countData[0].nro + 1) : 1;

      // Fetch existing participant record to merge and prevent nulling out existing fields
      const { data: dbPart, error: fetchPartErr } = await supabase
        .from('participantes')
        .select('*')
        .eq('ci', addCi.trim())
        .maybeSingle();

      if (fetchPartErr) throw fetchPartErr;

      // 2. Upsert participant (Core)
      const { error: partError } = await supabase
        .from('participantes')
        .upsert({
          ci: addCi.trim(),
          nombres: addNombres.trim().toUpperCase() || dbPart?.nombres,
          apellidos: addApellidos.trim().toUpperCase() || dbPart?.apellidos,
          rda: addRda.trim() || dbPart?.rda || null,
          celular: addCelular.trim() || dbPart?.celular || null,
          sie: addSie.trim() || dbPart?.sie || null,
          unidad_educativa: addUnidadEducativa.trim().toUpperCase() || dbPart?.unidad_educativa || null,
          validado: dbPart?.validado ?? false,
          observaciones_sie: dbPart?.observaciones_sie || null
        }, { onConflict: 'ci' });

      if (partError) throw partError;

      // 3. Insert enrollment
      const { error: relationError } = await supabase
        .from('inscripcion_ciclo')
        .insert({
          curso_id: curso.id,
          participante_ci: addCi.trim(),
          nro: nextNro,
          pagos: 'Pendiente'
        });

      if (relationError) throw relationError;

      // 4. Update count to exact value from database
      const { count } = await supabase
        .from('inscripcion_ciclo')
        .select('*', { count: 'exact', head: true })
        .eq('curso_id', curso.id);
      await supabase
        .from('cursos')
        .update({ inscritos_formulario: count || 0 })
        .eq('id', curso.id);

      Swal.fire('Inscripción Manual', 'Participante registrado e inscrito correctamente', 'success');

      // Reset form
      setAddCi('');
      setAddNombres('');
      setAddApellidos('');
      setAddRda('');
      setAddCelular('');
      setAddSie('');
      setAddUnidadEducativa('');
      setCiExists(false);

      onRefresh();
      fetchParticipantes();
    } catch (err: any) {
      Swal.fire('Error', err.message || 'No se pudo realizar el registro', 'error');
    }
  };

  // Handle Excel Tabulated text parsing
  const handleParseExcelText = () => {
    if (!excelText.trim()) {
      Swal.fire('Campo vacío', 'Pega primero las columnas de tu Excel en el cuadro de texto.', 'warning');
      return;
    }

    // Split lines, normalize carriage returns, filter out empty lines
    const rawLines = excelText.split('\n').map(l => l.replace('\r', '').trim()).filter(Boolean);
    const parsed: PreviewParticipant[] = [];

    let headerIndices: { [key: string]: number } = {};
    let hasHeader = false;

    if (rawLines.length > 0) {
      // Split the first line using tabs (Excel copy-paste behavior)
      const firstLineCells = rawLines[0].split('\t').map(c => c.trim().toLowerCase());

      // Check if the first line is indeed a header row
      const hasCiHeader = firstLineCells.some(c => c === 'ci' || c === 'c.i.' || c.includes('carnet') || c.includes('identidad') || c.includes('documento'));
      const hasNombreHeader = firstLineCells.some(c => c.includes('nombre'));
      const hasApellidoHeader = firstLineCells.some(c => c.includes('apellido'));
      const hasCelularHeader = firstLineCells.some(c => c.includes('celular') || c.includes('telefono') || c.includes('cel') || c.includes('telf'));

      if (hasCiHeader || hasNombreHeader || hasApellidoHeader || hasCelularHeader) {
        hasHeader = true;
        firstLineCells.forEach((cell, idx) => {
          if (cell === 'ci' || cell === 'c.i.' || cell.includes('carnet') || cell.includes('identidad') || cell.includes('documento')) {
            headerIndices['ci'] = idx;
          } else if (cell.includes('apellido')) {
            headerIndices['apellidos'] = idx;
          } else if (cell.includes('nombre')) {
            headerIndices['nombres'] = idx;
          } else if (cell.includes('rda')) {
            headerIndices['rda'] = idx;
          } else if (cell.includes('celular') || cell.includes('telefono') || cell.includes('cel') || cell.includes('telf')) {
            headerIndices['celular'] = idx;
          } else if (cell.includes('sie')) {
            headerIndices['sie'] = idx;
          } else if (cell.includes('unidad') || cell.includes('colegio') || cell.includes('escuela') || cell.includes('institucion') || cell.includes('ue') || cell.includes('u.e.')) {
            headerIndices['unidad_educativa'] = idx;
          }
        });
      }
    }

    const startIndex = hasHeader ? 1 : 0;

    for (let i = startIndex; i < rawLines.length; i++) {
      const line = rawLines[i];
      // Keep all columns even if empty to preserve alignment with header mapping
      const cells = line.split('\t').map(c => c.trim());

      // If the line is empty or has no content, skip it
      if (cells.filter(Boolean).length === 0) continue;

      let ci = '';
      let names = '';
      let surnames = '';
      let rda = '';
      let celular = '';
      let sie = '';
      let ue = '';

      if (hasHeader) {
        if (headerIndices['ci'] !== undefined && cells[headerIndices['ci']]) {
          ci = cells[headerIndices['ci']];
        }
        if (headerIndices['nombres'] !== undefined && cells[headerIndices['nombres']]) {
          names = cells[headerIndices['nombres']].toUpperCase();
        }
        if (headerIndices['apellidos'] !== undefined && cells[headerIndices['apellidos']]) {
          surnames = cells[headerIndices['apellidos']].toUpperCase();
        }
        if (headerIndices['rda'] !== undefined && cells[headerIndices['rda']]) {
          rda = cells[headerIndices['rda']];
        }
        if (headerIndices['celular'] !== undefined && cells[headerIndices['celular']]) {
          celular = cells[headerIndices['celular']];
        }
        if (headerIndices['sie'] !== undefined && cells[headerIndices['sie']]) {
          sie = cells[headerIndices['sie']];
        }
        if (headerIndices['unidad_educativa'] !== undefined && cells[headerIndices['unidad_educativa']]) {
          ue = cells[headerIndices['unidad_educativa']].toUpperCase();
        }
      } else {
        // Fallback: heuristic parsing without headers (filtering out empty cells first)
        const activeCells = cells.filter(Boolean);
        if (activeCells.length < 2) continue;

        activeCells.forEach((cell) => {
          // Skip row indexes like 1, 2, 3
          if (/^\d{1,2}$/.test(cell)) return;

          // Check if it's a mobile phone (7 or 8 digits starting with 6 or 7)
          if (/^[67]\d{6,7}$/.test(cell)) {
            celular = cell;
          }
          // Check if it's a SIE code (starts with 8, 8 digits)
          else if (/^8\d{7}$/.test(cell)) {
            sie = cell;
          }
          // Check if it's a CI (6 to 8 digits, not starting with 8)
          else if (/^\d{6,8}$/.test(cell) && !ci) {
            ci = cell;
          }
          // Check if it's a RDA (5 to 7 digits)
          else if (/^\d{5,7}$/.test(cell) && !rda) {
            rda = cell;
          }
          // Check if it's a school name
          else if (cell.includes('U.E.') || cell.includes('COLEGIO') || cell.includes('NUCLEO') || cell.includes('UNIDAD')) {
            ue = cell.toUpperCase();
          }
          // Identify text strings
          else {
            if (!surnames) {
              surnames = cell.toUpperCase();
            } else if (!names) {
              names = cell.toUpperCase();
            } else {
              names += ' ' + cell.toUpperCase();
            }
          }
        });
      }

      if (ci && (names || surnames)) {
        parsed.push({
          ci,
          nombres: names || 'DOCENTE',
          apellidos: surnames || 'SIN APELLIDO',
          rda,
          celular,
          sie,
          unidad_educativa: ue
        });
      }
    }

    if (parsed.length === 0) {
      Swal.fire('No detectado', 'No se pudieron identificar las columnas. Asegúrate de copiar desde Excel (con tabulaciones).', 'warning');
    } else {
      setPreviewList(parsed);
      setExcelText('');
      Swal.fire('Texto procesado', `Se detectaron ${parsed.length} participantes en la nómina. Revisa el resultado abajo.`, 'success');
    }
  };

  // Webcam Start/Stop
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setVideoStream(stream);
      setCameraActive(true);
    } catch (err) {
      console.error(err);
      Swal.fire('Cámara', 'No se pudo acceder a la cámara o webcam.', 'error');
    }
  };

  const stopCamera = () => {
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      setVideoStream(null);
    }
    setCameraActive(false);
  };

  // Capture photo & parse with AI (OpenCode Go)
  const handleCaptureAndParse = async () => {
    if (!videoRef.current || !videoStream) return;

    setIaLoading(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 1280;
      canvas.height = videoRef.current.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context error');

      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const base64Image = canvas.toDataURL('image/jpeg');

      // Send to parse route
      const res = await fetch('/api/ai/parse-nomina', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData: base64Image,
          mimeType: 'image/jpeg',
          fileName: 'captura_camara.jpg'
        })
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.message || 'Error analizando imagen');
      }

      setPreviewList(resData.data);
      stopCamera();
      Swal.fire('Escaneo Exitoso', `La IA (OpenCode Go) detectó ${resData.data.length} participantes en la imagen. Revisa la lista abajo.`, 'success');
    } catch (err: any) {
      Swal.fire('Error de escaneo IA', err.message || 'No se pudo procesar la nómina con IA.', 'error');
    } finally {
      setIaLoading(false);
    }
  };

  // Parse Uploaded File with AI (PDF, Excel, CSV, or Image)
  const handleAIFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIaLoading(true);
    try {
      const isExcelOrCsv = /\.(xlsx|xls|csv)$/i.test(file.name);

      if (isExcelOrCsv) {
        // Read sheet text content
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        let allSheetsText = '';

        workbook.SheetNames.forEach((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          const csv = XLSX.utils.sheet_to_csv(sheet);
          allSheetsText += `\n[Hoja: ${sheetName}]\n${csv}\n`;
        });

        // Send extracted text to OpenCode Go AI endpoint
        const res = await fetch('/api/ai/parse-nomina', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            extractedText: allSheetsText,
            fileName: file.name
          })
        });

        const resData = await res.json();
        if (!res.ok || !resData.success) {
          throw new Error(resData.message || 'Error procesando archivo con IA');
        }

        setPreviewList(resData.data);
        Swal.fire({
          icon: 'success',
          title: '¡Análisis con IA (OpenCode Go) Exitoso!',
          text: `La IA procesó el archivo Excel/CSV y extrajo ${resData.data.length} participantes listos para revisar e importar.`,
          timer: 3500
        });
      } else {
        // PDF or Image
        const reader = new FileReader();
        reader.onload = async (event) => {
          const base64Data = event.target?.result as string;
          try {
            const res = await fetch('/api/ai/parse-nomina', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fileData: base64Data,
                mimeType: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
                fileName: file.name
              })
            });

            const resData = await res.json();
            if (!res.ok || !resData.success) {
              throw new Error(resData.message || 'Error analizando documento con IA');
            }

            setPreviewList(resData.data);
            Swal.fire({
              icon: 'success',
              title: '¡Análisis con IA (OpenCode Go) Exitoso!',
              text: `La IA analizó el archivo y detectó ${resData.data.length} participantes listos para revisar e importar.`,
              timer: 3500
            });
          } catch (err: any) {
            Swal.fire('Error de IA', err.message || 'Falló el análisis del archivo con IA.', 'error');
          } finally {
            setIaLoading(false);
          }
        };
        reader.readAsDataURL(file);
        return;
      }
    } catch (err: any) {
      Swal.fire('Error de IA', err.message || 'Falló el análisis con Inteligencia Artificial.', 'error');
    } finally {
      setIaLoading(false);
    }
  };

  // Batch Save parsed participants from Preview
  const handleSavePreviewList = async () => {
    if (previewList.length === 0) return;
    setImportingBatch(true);

    try {
      // Filter out participants that don't have CI or Names
      const validParticipants = previewList.filter(p => p.ci.trim() && (p.nombres.trim() || p.apellidos.trim()));

      if (validParticipants.length === 0) {
        Swal.fire('Datos inválidos', 'Ningún participante tiene C.I. y Nombres válidos.', 'warning');
        setImportingBatch(false);
        return;
      }

      // 1. Get current list of CIs to avoid duplication in current course
      const existingCis = new Set(inscripciones.map(ins => ins.participantes?.ci.trim()));
      const rawFiltered = validParticipants.filter(p => !existingCis.has(p.ci.trim()));

      // Dedup by CI in the pasted batch to avoid "ON CONFLICT DO UPDATE cannot affect row a second time"
      const filteredToEnroll: PreviewParticipant[] = [];
      const seenCis = new Set<string>();
      rawFiltered.forEach(p => {
        const cleanedCi = p.ci.trim();
        if (!seenCis.has(cleanedCi)) {
          seenCis.add(cleanedCi);
          filteredToEnroll.push(p);
        }
      });

      if (filteredToEnroll.length === 0) {
        Swal.fire('Ya inscritos', 'Todos los participantes en vista previa ya se encuentran registrados en este ciclo.', 'info');
        setPreviewList([]);
        setImportingBatch(false);
        return;
      }

      // Fetch existing participants from database to merge and prevent nulling out existing fields
      const cisToQuery = filteredToEnroll.map(p => p.ci.trim());
      const { data: existingPartsDb, error: fetchPartsErr } = await supabase
        .from('participantes')
        .select('ci, nombres, apellidos, rda, celular, sie, unidad_educativa, validado, observaciones_sie')
        .in('ci', cisToQuery);

      if (fetchPartsErr) throw fetchPartsErr;

      const dbPartsMap = new Map(existingPartsDb?.map(dbP => [dbP.ci, dbP]) || []);

      // 2. Batch upsert participant records
      const upsertData = filteredToEnroll.map(p => {
        const dbPart = dbPartsMap.get(p.ci.trim());
        return {
          ci: p.ci.trim(),
          nombres: p.nombres.trim().toUpperCase() || dbPart?.nombres,
          apellidos: p.apellidos.trim().toUpperCase() || dbPart?.apellidos,
          rda: p.rda?.trim() || dbPart?.rda || null,
          celular: p.celular?.trim() || dbPart?.celular || null,
          sie: p.sie?.trim() || dbPart?.sie || null,
          unidad_educativa: p.unidad_educativa?.trim().toUpperCase() || dbPart?.unidad_educativa || null,
          validado: dbPart?.validado ?? false,
          observaciones_sie: dbPart?.observaciones_sie || null
        };
      });

      const { error: upsertErr } = await supabase
        .from('participantes')
        .upsert(upsertData, { onConflict: 'ci' });

      if (upsertErr) throw upsertErr;

      // 3. Batch insert enrollments
      // Get next Nro starting point
      const { data: countData } = await supabase
        .from('inscripcion_ciclo')
        .select('nro')
        .eq('curso_id', curso.id)
        .order('nro', { ascending: false })
        .limit(1);
      let nextNro = countData && countData.length > 0 ? (countData[0].nro + 1) : 1;

      const enrollmentsData = filteredToEnroll.map((p, idx) => ({
        curso_id: curso.id,
        participante_ci: p.ci.trim(),
        nro: nextNro + idx,
        pagos: 'Pendiente'
      }));

      const { error: enrollErr } = await supabase
        .from('inscripcion_ciclo')
        .insert(enrollmentsData);

      if (enrollErr) throw enrollErr;

      // 4. Update count in cursos table to exact value from database
      const { count } = await supabase
        .from('inscripcion_ciclo')
        .select('*', { count: 'exact', head: true })
        .eq('curso_id', curso.id);
      await supabase
        .from('cursos')
        .update({ inscritos_formulario: count || 0 })
        .eq('id', curso.id);

      Swal.fire('Lote Guardado', `Se importaron e inscribieron ${filteredToEnroll.length} participantes exitosamente.`, 'success');
      setPreviewList([]);
      setShowImporter(false);
      onRefresh();
      fetchParticipantes();
    } catch (err: any) {
      Swal.fire('Error de importación', err.message || 'No se pudieron guardar los participantes.', 'error');
    } finally {
      setImportingBatch(false);
    }
  };

  // Edit core participant details (spelling, RDA)
  const handleSaveCoreParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPart) return;

    try {
      const { error } = await supabase
        .from('participantes')
        .update({
          nombres: editingPart.nombres.trim().toUpperCase(),
          apellidos: editingPart.apellidos.trim().toUpperCase(),
          rda: editingPart.rda?.trim() || null,
          celular: editingPart.celular?.trim() || null,
          sie: editingPart.sie?.trim() || null,
          unidad_educativa: editingPart.unidad_educativa?.trim().toUpperCase() || null
        })
        .eq('ci', editingPart.ci);

      if (error) throw error;
      Swal.fire('Guardado', 'Datos personales del participante actualizados', 'success');
      setEditingPart(null);
      fetchParticipantes();
    } catch (err: any) {
      Swal.fire('Error', err.message || 'No se pudieron actualizar los datos del participante', 'error');
    }
  };

  // SIE Portal Login Connection
  const handleSieConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sieUser.trim() || !siePass) {
      Swal.fire('Campos requeridos', 'Ingresa tu usuario y contraseña de SIE UNEFCO', 'warning');
      return;
    }

    setConnectingSie(true);
    try {
      const res = await fetch('/api/sie/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: sieUser.trim(), password: siePass })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Falló la conexión');
      }

      setSieSession(data.cookies);
      sessionStorage.setItem('sie_session', JSON.stringify(data.cookies));
      setSiePass(''); // Clear password field
      Swal.fire({
        icon: 'success',
        title: 'Conectado a SIE',
        text: 'Autenticación con el portal oficial exitosa. Sesión iniciada.',
        timer: 2000,
        showConfirmButton: false
      });
    } catch (err: any) {
      Swal.fire('Error de Conexión', err.message || 'No se pudo iniciar sesión en SIE', 'error');
    } finally {
      setConnectingSie(false);
    }
  };

  // Disconnect SIE Session
  const handleSieDisconnect = () => {
    setSieSession(null);
    sessionStorage.removeItem('sie_session');
    Swal.fire({
      icon: 'info',
      title: 'Sesión Cerrada',
      text: 'Desconectado del portal oficial SIE',
      timer: 1500,
      showConfirmButton: false
    });
  };

  // Validate single participant (returns promise)
  const validateSingle = async (ins: Inscripcion, isBatch = false): Promise<{ success: boolean; status: string; message?: string }> => {
    const p = ins.participantes;
    if (!p) return { success: false, status: 'error', message: 'No hay datos' };

    try {
      const res = await fetch(`/api/sie/search?ci=${p.ci}`, {
        headers: {
          'x-sie-sessionid': sieSession!.sessionid,
          'x-sie-csrftoken': sieSession!.csrftoken
        }
      });

      const resData = await res.json();
      if (!res.ok) {
        if (resData.status === 'unauthorized') {
          handleSieDisconnect();
          return { success: false, status: 'unauthorized', message: 'Sesión expirada' };
        }
        return { success: false, status: 'error', message: resData.message || 'Error de red' };
      }

      if (resData.status === 'not_found') {
        const obs = `NO ENCONTRADO EN EL PORTAL SIE AL ${new Date().toLocaleDateString()}`;
        await supabase
          .from('participantes')
          .update({
            validado: false,
            observaciones_sie: obs
          })
          .eq('ci', p.ci);
        return { success: true, status: 'not_found' };
      } else if (resData.status === 'found') {
        // Select the candidate that matches best based on name similarity
        let sieData = resData.data[0];
        if (resData.data.length > 1) {
          const dbNombresForMatch = p.nombres.trim().toUpperCase();
          const dbApellidosForMatch = p.apellidos.trim().toUpperCase();
          const localFullNameForMatch = `${dbNombresForMatch} ${dbApellidosForMatch}`;
          
          let bestDiff = Infinity;
          for (const candidate of resData.data) {
            const candidateFullName = `${(candidate.nombres || '').trim().toUpperCase()} ${(candidate.apellidos || '').trim().toUpperCase()}`;
            const diff = calculateDifferenceRatio(localFullNameForMatch, candidateFullName);
            if (diff < bestDiff) {
              bestDiff = diff;
              sieData = candidate;
            }
          }
        }

        const dbNombres = p.nombres.trim().toUpperCase();
        const sieNombres = sieData.nombres.trim().toUpperCase();
        const dbApellidos = p.apellidos.trim().toUpperCase();
        const sieApellidos = sieData.apellidos.trim().toUpperCase();

        const localFullName = `${dbNombres} ${dbApellidos}`;
        const sieFullName = `${sieNombres} ${sieApellidos}`;

        // Calculate edit distance similarity on names only
        const nameDiff = calculateDifferenceRatio(localFullName, sieFullName);

        const dbRda = (p.rda || '').trim().replace(/\D/g, '');
        const sieRda = (sieData.rda || '').trim().replace(/\D/g, '');
        const isRdaMismatch = dbRda && sieRda && dbRda !== sieRda;

        // Check token subset (handles missing second surname or middle name where CI matches)
        const checkTokenSubset = (nameA: string, nameB: string): boolean => {
          const tokensA = cleanNameString(nameA).split(" ").filter(t => t.length > 1);
          const tokensB = cleanNameString(nameB).split(" ").filter(t => t.length > 1);
          if (tokensA.length === 0 || tokensB.length === 0) return false;
          const [shorter, longer] = tokensA.length <= tokensB.length ? [tokensA, tokensB] : [tokensB, tokensA];
          return shorter.every(token => longer.includes(token));
        };

        // Auto-validate criteria: CI matches, and name/surname difference <= 40% OR one name is a token subset of the other.
        const isMinimalDifference = nameDiff <= 0.40 || checkTokenSubset(localFullName, sieFullName);

        if (isMinimalDifference) {
          // Auto-validate: Copy SIE name/rda, keep local cellular number
          await supabase
            .from('participantes')
            .update({
              nombres: sieData.nombres.trim().toUpperCase(),
              apellidos: sieData.apellidos.trim().toUpperCase(),
              rda: sieData.rda || p.rda,
              validado: true,
              observaciones_sie: null
            })
            .eq('ci', p.ci);

          return { success: true, status: 'validated_auto' };
        } else {
          // Discrepancy detected
          const discrepancies: string[] = [];
          if (dbNombres !== sieNombres) discrepancies.push('NOMBRES');
          if (dbApellidos !== sieApellidos) discrepancies.push('APELLIDOS');
          if (isRdaMismatch) discrepancies.push('RDA');

          const dbCelular = (p.celular || '').trim().replace(/\D/g, '');
          const sieCelular = (sieData.celular || '').trim().replace(/\D/g, '');
          if (sieCelular && dbCelular && dbCelular !== sieCelular) {
            discrepancies.push('CELULAR');
          }

          const discrepanciesObs = `DISCREPANCIAS DETECTADAS: ` +
            discrepancies.map(field => {
              if (field === 'NOMBRES') return `Nombres DB: "${dbNombres}" / SIE: "${sieNombres}"`;
              if (field === 'APELLIDOS') return `Apellidos DB: "${dbApellidos}" / SIE: "${sieApellidos}"`;
              if (field === 'RDA') return `RDA DB: "${dbRda || '—'}" / SIE: "${sieRda || '—'}"`;
              if (field === 'CELULAR') return `Celular DB: "${dbCelular || '—'}" / SIE: "${sieCelular || '—'}"`;
              return field;
            }).join(' | ');

          // Save discrepancies to database
          await supabase
            .from('participantes')
            .update({
              validado: false,
              observaciones_sie: discrepanciesObs
            })
            .eq('ci', p.ci);

          if (!isBatch) {
            // Open comparison editor only in manual mode
            setDiscrepancyData({
              db: p,
              sie: sieData,
              discrepancies,
              inscripcionId: ins.id
            });
          }

          return { success: true, status: 'discrepancy' };
        }
      }
      return { success: false, status: 'error', message: 'Respuesta desconocida' };
    } catch (err: any) {
      return { success: false, status: 'error', message: err.message || 'Error en petición' };
    }
  };

  // Validate single participant manually
  const handleValidateParticipant = async (ins: Inscripcion) => {
    if (!sieSession) {
      Swal.fire('Iniciar sesión', 'Debes iniciar sesión en tu cuenta de SIE UNEFCO arriba para realizar validaciones.', 'info');
      return;
    }

    const p = ins.participantes;
    if (!p) return;

    setValidatingPartId(ins.id);
    const result = await validateSingle(ins, false);
    setValidatingPartId(null);

    if (result.success) {
      if (result.status === 'validated_auto') {
        Swal.fire({
          icon: 'success',
          title: 'Validado Automáticamente',
          text: `El participante ${p.apellidos} ${p.nombres} coincide perfectamente o tiene diferencias mínimas (≤ 40%). Se actualizaron sus datos con la información oficial de SIE, conservando el celular local.`,
          timer: 3000,
          showConfirmButton: false
        });
      } else if (result.status === 'not_found') {
        Swal.fire('No encontrado', 'El participante no está registrado en el portal de SIE UNEFCO. Se guardó la observación.', 'warning');
      }
      fetchParticipantes();
    } else {
      Swal.fire('Error', result.message || 'Ocurrió un error al validar', 'error');
    }
  };

  // Validate All sequentially
  const handleValidateAll = async () => {
    if (!sieSession) {
      Swal.fire('Iniciar sesión', 'Debes iniciar sesión en tu cuenta de SIE UNEFCO para validar.', 'info');
      return;
    }

    const unvalidated = inscripciones.filter(ins => ins.participantes && !ins.participantes.validado);
    if (unvalidated.length === 0) {
      Swal.fire('Validación Completa', 'Todos los participantes ya están validados.', 'success');
      return;
    }

    const confirm = await Swal.fire({
      title: '¿Validar Todos?',
      text: `Se iniciará el proceso secuencial en lote para validar ${unvalidated.length} participantes pendientes contra el portal SIE.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, iniciar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#2f80ed'
    });

    if (!confirm.isConfirmed) return;

    setValidatingAll(true);
    setValidatingTotal(unvalidated.length);
    setValidatingIndex(0);

    let validatedCount = 0;
    let discrepancyCount = 0;
    let notFoundCount = 0;
    let errorOccurred = false;

    for (let i = 0; i < unvalidated.length; i++) {
      setValidatingIndex(i + 1);
      const ins = unvalidated[i];

      const result = await validateSingle(ins, true);

      if (!result.success) {
        if (result.status === 'unauthorized') {
          Swal.fire('Sesión Expirada', 'La sesión de SIE ha expirado. Proceso de validación masiva detenido.', 'error');
          errorOccurred = true;
          break;
        }
        console.error(`Error validating CI ${ins.participantes?.ci}:`, result.message);
      } else {
        if (result.status === 'validated_auto') validatedCount++;
        else if (result.status === 'discrepancy') discrepancyCount++;
        else if (result.status === 'not_found') notFoundCount++;
      }

      // 1.2 second delay between queries
      await new Promise(resolve => setTimeout(resolve, 1200));
    }

    setValidatingAll(false);
    fetchParticipantes();

    if (!errorOccurred) {
      Swal.fire({
        title: 'Validación en Lote Completada',
        html: `
          <div style="text-align: left; padding: 10px;">
            <p>Se procesaron todos los participantes pendientes:</p>
            <ul style="list-style-type: disc; padding-left: 20px; font-size: 0.9rem; line-height: 1.5;">
              <li style="color: var(--green-600); font-weight: bold;">Validados automáticamente (≤ 40% dif): ${validatedCount}</li>
              <li style="color: var(--red-600); font-weight: bold;">Con discrepancias detectadas (para revisión): ${discrepancyCount}</li>
              <li style="color: var(--yellow-600); font-weight: bold;">No encontrados en portal: ${notFoundCount}</li>
            </ul>
            <p style="margin-top: 12px; font-size: 0.82rem; color: var(--gray-500);">Revisa las discrepancias marcadas en color rojo en la lista para resolverlas individualmente.</p>
          </div>
        `,
        icon: 'success',
        confirmButtonColor: '#2e9f5e'
      });
    }
  };

  // Resolve discrepancies
  const resolveDiscrepancies = async (action: 'correct' | 'validate_anyway') => {
    if (!discrepancyData) return;
    const { db, sie } = discrepancyData;

    try {
      if (action === 'correct') {
        // Correct local values using SIE official ones, keeping local celular
        await supabase
          .from('participantes')
          .update({
            nombres: sie.nombres.trim().toUpperCase(),
            apellidos: sie.apellidos.trim().toUpperCase(),
            rda: sie.rda || db.rda,
            // Celular remains db.celular (local is prioritised, as per requirement)
            validado: true,
            observaciones_sie: null
          })
          .eq('ci', db.ci);

        Swal.fire('Datos Corregidos', 'Los datos locales han sido corregidos con la información oficial de SIE (conservando el celular local) y marcados como validados.', 'success');
      } else {
        // Mark as validado but record discrepancies in observations
        const discrepanciesObs = `DISCREPANCIAS DETECTADAS: ` +
          discrepancyData.discrepancies.map(field => {
            if (field === 'NOMBRES') return `Nombres DB: "${db.nombres}" / SIE: "${sie.nombres}"`;
            if (field === 'APELLIDOS') return `Apellidos DB: "${db.apellidos}" / SIE: "${sie.apellidos}"`;
            if (field === 'RDA') return `RDA DB: "${db.rda || '—'}" / SIE: "${sie.rda || '—'}"`;
            if (field === 'CELULAR') return `Celular DB: "${db.celular || '—'}" / SIE: "${sie.celular || '—'}"`;
            return field;
          }).join(' | ');

        await supabase
          .from('participantes')
          .update({
            validado: true,
            observaciones_sie: discrepanciesObs
          })
          .eq('ci', db.ci);

        Swal.fire('Validado con observaciones', 'El participante fue validado conservando las discrepancias en observaciones.', 'success');
      }

      setDiscrepancyData(null);
      fetchParticipantes();
    } catch (err: any) {
      Swal.fire('Error', err.message || 'No se pudo resolver la discrepancia', 'error');
    }
  };

  // Export to Excel (Lightweight clean HTML blob)
  const handleExportExcel = () => {
    if (inscripciones.length === 0) {
      Swal.fire('Sin datos', 'No hay participantes inscritos para exportar', 'warning');
      return;
    }

    const title = `INSCRITOS_CICLO_${curso.id}_${curso.ciclo_nombre || 'CURSO'}`;

    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <style>
          table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; }
          th { background-color: #0c2340; color: white; font-weight: bold; border: 1px solid #cccccc; padding: 10px; }
          td { border: 1px solid #cccccc; padding: 8px; font-size: 11px; }
          .title { font-size: 16px; font-weight: bold; color: #0c2340; margin-bottom: 5px; }
          .subtitle { font-size: 12px; color: #555555; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="title">LISTA DE PARTICIPANTES INSCRITOS</div>
        <div class="subtitle">Curso: ID ${curso.id} - ${curso.ciclo_nombre || ''} | Facilitador: ${curso.facilitador_nombre || ''}</div>
        <table>
          <thead>
            <tr>
              <th>Nro</th>
              <th>C.I.</th>
              <th>RDA</th>
              <th>Apellidos</th>
              <th>Nombres</th>
              <th>Celular</th>
              <th>SIE</th>
              <th>Unidad Educativa</th>
              <th>Estado Pago</th>
              <th>Validado SIE</th>
              <th>Observaciones SIE</th>
            </tr>
          </thead>
          <tbody>
    `;

    inscripciones.forEach((ins) => {
      const p = ins.participantes;
      html += `
        <tr>
          <td align="center">${ins.nro}</td>
          <td>${p?.ci || ''}</td>
          <td>${p?.rda || ''}</td>
          <td>${p?.apellidos || ''}</td>
          <td>${p?.nombres || ''}</td>
          <td>${p?.celular || ''}</td>
          <td>${p?.sie || ''}</td>
          <td>${p?.unidad_educativa || ''}</td>
          <td>${ins.pagos}</td>
          <td>${p?.validado ? 'SÍ' : 'NO'}</td>
          <td>${p?.observaciones_sie || ''}</td>
          <td>${ins.observaciones || ''}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/\s+/g, '_')}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to PDF via browser printing styled as Letter page
  const handlePrintPDF = () => {
    if (inscripciones.length === 0) {
      Swal.fire('Sin datos', 'No hay participantes para imprimir', 'warning');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      Swal.fire('Bloqueador de ventanas', 'Por favor habilita las ventanas flotantes para imprimir.', 'warning');
      return;
    }

    const rowsHtml = inscripciones.map(ins => {
      const p = ins.participantes;
      return `
        <tr>
          <td style="text-align: center;">${ins.nro}</td>
          <td>${p?.ci || ''}</td>
          <td>${p?.rda || ''}</td>
          <td style="text-transform: uppercase;">${p?.apellidos || ''}</td>
          <td style="text-transform: uppercase;">${p?.nombres || ''}</td>
          <td>${p?.celular || ''}</td>
          <td>${p?.sie || ''}</td>
          <td style="text-transform: uppercase;">${p?.unidad_educativa || ''}</td>
          <td>${ins.pagos}</td>
          <td style="font-size: 8pt; color: #555;">${p?.observaciones_sie || (p?.validado ? 'VALIDADO' : 'PENDIENTE')}</td>
        </tr>
      `;
    }).join('');

    printWindow.document.write(`
      <html>
      <head>
        <title>Participantes Inscritos - ID ${curso.id}</title>
        <style>
          @page {
            size: letter landscape;
            margin: 0.4in 0.4in 0.6in 0.4in;
          }
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #333;
            margin: 0;
            padding: 0;
            font-size: 9pt;
            line-height: 1.3;
          }
          .header {
            border-bottom: 2px solid #0f3060;
            padding-bottom: 10px;
            margin-bottom: 15px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          .header-title h1 {
            margin: 0;
            font-size: 16pt;
            color: #0f3060;
            font-weight: 800;
          }
          .header-title p {
            margin: 2px 0 0 0;
            font-size: 9.5pt;
            color: #555;
          }
          .header-meta {
            text-align: right;
            font-size: 9pt;
            color: #444;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }
          th {
            background-color: #0f3060;
            color: white;
            font-weight: bold;
            font-size: 8.5pt;
            border: 1px solid #ddd;
            padding: 6px 4px;
            text-transform: uppercase;
          }
          td {
            border: 1px solid #ddd;
            padding: 5px 4px;
            font-size: 8.5pt;
          }
          tr:nth-child(even) td {
            background-color: #f9f9f9;
          }
          .signatures {
            margin-top: 50px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 100px;
            padding: 0 50px;
          }
          .signature-box {
            border-top: 1px solid #444;
            text-align: center;
            padding-top: 6px;
            font-size: 9.5pt;
            font-weight: 600;
            color: #444;
          }
          @media print {
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-title">
            <h1>UNEFCO - LISTA DE PARTICIPANTES INSCRITOS</h1>
            <p>Ciclo: <b>${curso.ciclo_nombre || 'Sin nombre'}</b></p>
          </div>
          <div class="header-meta">
            <b>ID Curso:</b> ${curso.id} | <b>Facilitador:</b> ${curso.facilitador_nombre || 'Sin asignar'}<br/>
            <b>Lugar:</b> ${curso.lugar} (${curso.distrito}) | <b>Técnico:</b> ${curso.tecnico_nombre || ''}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th width="3%">Nro</th>
              <th width="10%">C.I.</th>
              <th width="8%">RDA</th>
              <th width="20%">Apellidos</th>
              <th width="18%">Nombres</th>
              <th width="8%">Celular</th>
              <th width="8%">SIE</th>
              <th width="12%">Unidad Educativa</th>
              <th width="8%">Pago</th>
              <th width="15%">Detalle / Validación</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="signatures">
          <div class="signature-box">
            Firma del Facilitador<br/>
            <span style="font-size: 8pt; font-weight: normal; color: #777;">C.I. ${curso.facilitador_carnet || ''}</span>
          </div>
          <div class="signature-box">
            Firma del Técnico UNEFCO<br/>
            <span style="font-size: 8pt; font-weight: normal; color: #777;">C.I. ${curso.tecnico_carnet || ''}</span>
          </div>
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

  // Export to PDF via browser printing styled as Letter portrait Planilla: Control de Asistencia y Entrega de Material
  const handlePrintPlanilla = () => {
    if (inscripciones.length === 0) {
      Swal.fire('Sin datos', 'No hay participantes para imprimir', 'warning');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      Swal.fire('Bloqueador de ventanas', 'Por favor habilita las ventanas flotantes para imprimir.', 'warning');
      return;
    }

    const rowsHtml = inscripciones.map((ins, idx) => {
      const p = ins.participantes;
      const fullName = p ? `${p.apellidos || ''} ${p.nombres || ''}`.trim().toUpperCase() : '';
      return `
        <tr style="height: 38px;">
          <td style="text-align: center; border: 1px solid #777; padding: 4px; font-size: 8.5pt;">${idx + 1}</td>
          <td style="border: 1px solid #777; padding: 4px 8px; font-size: 8.5pt; text-transform: uppercase;">${fullName}</td>
          <td style="text-align: center; border: 1px solid #777; padding: 4px; font-size: 8.5pt;">${p?.ci || ''}</td>
          <td style="text-align: center; border: 1px solid #777; padding: 4px; font-size: 8.5pt;">${p?.celular || ''}</td>
          <td style="border: 1px solid #777; padding: 4px;"></td>
          <td style="border: 1px solid #777; padding: 4px;"></td>
        </tr>
      `;
    }).join('');

    const logoMinedu = `${window.location.origin}/logo-minedu.jpg`;
    const logoUnefco = `${window.location.origin}/logo-unefco.jpg`;

    const formattedFecha = curso.fecha_inicio 
      ? new Date(curso.fecha_inicio.replace(' ', 'T')).toLocaleDateString('es-ES') 
      : '';

    printWindow.document.write(`
      <html>
      <head>
        <title>Planilla de Asistencia y Material - ID ${curso.id}</title>
        <style>
          @page {
            size: letter portrait;
            margin: 0.3in 0.4in 0.4in 0.4in;
          }
          body {
            font-family: Arial, sans-serif;
            color: #000;
            margin: 0;
            padding: 0;
            font-size: 9pt;
            line-height: 1.2;
          }
          .header-logos {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 5px;
          }
          .logo-img {
            height: 55px;
            object-fit: contain;
          }
          .title-container {
            text-align: center;
            margin: 10px 0 15px 0;
          }
          .title-container h1 {
            margin: 0;
            font-size: 13pt;
            font-weight: bold;
            color: #000;
            text-transform: uppercase;
          }
          .metadata-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
          }
          .metadata-table td {
            border: 1px solid #777;
            padding: 5px 8px;
            font-size: 8.5pt;
            vertical-align: middle;
          }
          .metadata-table td strong {
            font-weight: bold;
          }
          .participants-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 40px;
          }
          .participants-table th {
            background-color: #08323e;
            color: #fff;
            font-weight: bold;
            font-size: 8.5pt;
            border: 1px solid #777;
            padding: 6px 4px;
            text-transform: uppercase;
            text-align: center;
          }
          .participants-table td {
            border: 1px solid #777;
            padding: 5px 6px;
            font-size: 8.5pt;
          }
          .footer-signatures {
            margin-top: 50px;
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 10px;
            text-align: center;
            font-size: 7.5pt;
            font-weight: bold;
            font-family: Arial, sans-serif;
          }
          .signature-box {
            padding-top: 50px;
          }
        </style>
      </head>
      <body>
        <div class="header-logos">
          <img src="${logoMinedu}" class="logo-img" alt="Ministerio de Educacion" />
          <img src="${logoUnefco}" class="logo-img" alt="UNEFCO" />
        </div>

        <div class="title-container">
          <h1>PLANILLA: CONTROL DE ASISTENCIA Y ENTREGA DE MATERIAL</h1>
        </div>

        <table class="metadata-table">
          <tr>
            <td colspan="2"><strong>CICLO:</strong> ${curso.ciclo_grupo || curso.area_formativa || ''}</td>
          </tr>
          <tr>
            <td colspan="2"><strong>CURSO:</strong> ${curso.ciclo_nombre || ''}</td>
          </tr>
          <tr>
            <td colspan="2"><strong>FACILITADORA(O):</strong> ${curso.facilitador_nombre || ''}</td>
          </tr>
          <tr>
            <td style="width: 65%;"><strong>Departamento:</strong> UNEFCO - Santa Cruz</td>
            <td style="width: 35%;"><strong>Modalidad:</strong> SEMIPRESENCIAL</td>
          </tr>
          <tr>
            <td><strong>Fecha del curso:</strong> ${formattedFecha}</td>
            <td><strong>Distrito:</strong> ${curso.distrito || ''}</td>
          </tr>
          <tr>
            <td><strong>Responsable Departamental a.i.:</strong> Alfonso Coronel Mamani</td>
            <td><strong>Sede:</strong> ${curso.lugar || ''}</td>
          </tr>
        </table>

        <table class="participants-table">
          <thead>
            <tr>
              <th style="width: 4%;">#</th>
              <th style="width: 50%;">Apellidos(s) Nombres(s)</th>
              <th style="width: 14%;">C.I.</th>
              <th style="width: 12%;">Celular</th>
              <th style="width: 10%;">Firma</th>
              <th style="width: 10%;">Firma</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="footer-signatures">
          <div class="signature-box">FIRMA FACILITADORA(O)</div>
          <div class="signature-box">V.B. RESPONSABLE DEPARTAMENTAL</div>
          <div class="signature-box">TECNICO(A) DEPARTAMENTAL</div>
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

  // Delete ALL enrollments (mass delete)
  const handleDeleteAllEnrollments = async () => {
    if (inscripciones.length === 0) {
      Swal.fire('Sin participantes', 'No hay participantes inscritos para eliminar.', 'info');
      return;
    }

    const firstConfirm = await Swal.fire({
      title: '⚠️ Eliminación Masiva',
      html: `<p>Estás a punto de eliminar <b>${inscripciones.length}</b> inscripciones de este ciclo formativo.</p><p style="color: #dc2626; font-weight: bold;">Esta acción no se puede deshacer.</p>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonText: 'Cancelar',
      confirmButtonText: 'Sí, eliminar todos'
    });

    if (!firstConfirm.isConfirmed) return;

    const secondConfirm = await Swal.fire({
      title: '¿Estás completamente seguro?',
      text: `Confirma escribiendo el número de participantes a eliminar: ${inscripciones.length}`,
      input: 'text',
      inputPlaceholder: `Escribe ${inscripciones.length}`,
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Eliminar definitivamente',
      cancelButtonText: 'Cancelar',
      inputValidator: (value) => {
        if (value !== String(inscripciones.length)) {
          return `Escribe "${inscripciones.length}" para confirmar`;
        }
        return null;
      }
    });

    if (!secondConfirm.isConfirmed) return;

    try {
      const { error } = await supabase
        .from('inscripcion_ciclo')
        .delete()
        .eq('curso_id', curso.id);

      if (error) throw error;

      await supabase
        .from('cursos')
        .update({ inscritos_formulario: 0 })
        .eq('id', curso.id);

      Swal.fire('Eliminados', `Se eliminaron ${inscripciones.length} inscripciones exitosamente.`, 'success');
      onRefresh();
      fetchParticipantes();
    } catch (err: any) {
      Swal.fire('Error', err.message || 'No se pudieron eliminar las inscripciones', 'error');
    }
  };

  // Bulk update payment status for all enrollments
  const handleBulkPaymentUpdate = async (newStatus: 'Pagado' | 'Pendiente') => {
    if (inscripciones.length === 0) {
      Swal.fire('Sin participantes', 'No hay participantes inscritos para actualizar.', 'info');
      return;
    }

    const isPagado = newStatus === 'Pagado';
    const result = await Swal.fire({
      title: isPagado ? '💰 Marcar Todos como Pagados' : '⏳ Marcar Todos como Pendientes',
      html: `<p>Se actualizará el estado de pago de <b>${inscripciones.length}</b> participante${inscripciones.length !== 1 ? 's' : ''} a <b style="color: ${isPagado ? '#059669' : '#d97706'}">${newStatus}</b>.</p>`,
      icon: isPagado ? 'question' : 'warning',
      showCancelButton: true,
      confirmButtonColor: isPagado ? '#059669' : '#d97706',
      cancelButtonText: 'Cancelar',
      confirmButtonText: isPagado ? 'Sí, marcar todos pagados' : 'Sí, marcar todos pendientes'
    });

    if (!result.isConfirmed) return;

    try {
      const { error } = await supabase
        .from('inscripcion_ciclo')
        .update({ pagos: newStatus })
        .eq('curso_id', curso.id);

      if (error) throw error;

      Swal.fire({
        icon: 'success',
        title: '¡Actualizado!',
        text: `Se marcaron ${inscripciones.length} participante${inscripciones.length !== 1 ? 's' : ''} como "${newStatus}".`,
        timer: 2000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
      fetchParticipantes();
    } catch (err: any) {
      Swal.fire('Error', err.message || 'No se pudieron actualizar los estados de pago', 'error');
    }
  };

  // ─── Migration handlers ─────────────────────────────────
  const handleFetchMigrationPreview = async () => {
    if (!migrSourceId.trim()) {
      Swal.fire('Campo requerido', 'Ingresa el ID del curso origen', 'warning');
      return;
    }
    if (migrSourceId.trim() === curso.id) {
      Swal.fire('Error', 'No puedes migrar participantes del mismo curso', 'error');
      return;
    }
    setMigrLoading(true);
    try {
      const { data, error } = await supabase
        .from('inscripcion_ciclo')
        .select(`
          id,
          nro,
          pagos,
          observaciones,
          participante_ci,
          participantes (
            ci,
            nombres,
            apellidos,
            rda,
            celular,
            sie,
            unidad_educativa,
            validado,
            observaciones_sie
          )
        `)
        .eq('curso_id', migrSourceId.trim())
        .order('nro', { ascending: true });
      if (error) throw error;
      if (!data || data.length === 0) {
        Swal.fire('Sin participantes', `El curso ${migrSourceId} no tiene participantes inscritos`, 'info');
        setMigrPreview([]);
        return;
      }
      setMigrPreview(data as unknown as Inscripcion[]);
    } catch (err: any) {
      Swal.fire('Error', err.message || 'No se pudieron cargar los participantes del curso origen', 'error');
      setMigrPreview([]);
    } finally {
      setMigrLoading(false);
    }
  };

  const handleConfirmMigration = async () => {
    if (migrPreview.length === 0) return;
    setMigrating(true);
    try {
      // Get existing CIs in current course to avoid duplicates
      const existingCis = new Set(inscripciones.map(i => i.participantes?.ci).filter(Boolean));
      let migrated = 0;
      let skipped = 0;
      for (const ins of migrPreview) {
        const ci = ins.participantes?.ci;
        if (!ci) { skipped++; continue; }
        if (existingCis.has(ci)) { skipped++; continue; }
        const { error } = await supabase.from('inscripcion_ciclo').insert({
          curso_id: curso.id,
          participante_ci: ci,
          pagos: ins.pagos || 'Pendiente',
          observaciones: ins.observaciones || null,
        });
        if (error) { skipped++; continue; }
        migrated++;
      }
      Swal.fire({
        icon: 'success',
        title: 'Migración completada',
        text: `Se migraron ${migrated} participante${migrated !== 1 ? 's' : ''}${skipped > 0 ? `. ${skipped} omitido${skipped !== 1 ? 's' : ''} (duplicados o sin CI)` : ''}.`,
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#bfa05e',
        timer: 3000,
        timerProgressBar: true,
      });
      setShowMigrator(false);
      setMigrPreview([]);
      setMigrSourceId('');
      fetchParticipantes();
    } catch (err: any) {
      Swal.fire('Error', err.message || 'Error durante la migración', 'error');
    } finally {
      setMigrating(false);
    }
  };

  // Filter list
  const filteredInscripciones = inscripciones.filter((ins) => {
    const p = ins.participantes;
    if (!p) return false;
    const q = searchQuery.toLowerCase();
    return (
      p.ci.includes(q) ||
      p.nombres.toLowerCase().includes(q) ||
      p.apellidos.toLowerCase().includes(q) ||
      (p.rda || '').includes(q) ||
      (p.celular || '').includes(q) ||
      (p.unidad_educativa || '').toLowerCase().includes(q)
    );
  });

  // Print official 2-up Letter Ficha de Inscripción for a participant
  const handlePrintFichaForParticipant = (p: Participante) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      Swal.fire('Bloqueador', 'Habilita las ventanas emergentes para imprimir la Ficha de Inscripción.', 'warning');
      return;
    }

    const logoMineduUrl = window.location.origin + '/logo-minedu.jpg';
    const logoUnefcoUrl = window.location.origin + '/logo-unefco.jpg';
    const chk = (condition: boolean) => condition ? '<span class="chk-active">X</span>' : '<span class="chk"></span>';

    const buildFichaHtml = () => `
      <div class="ficha">
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

        <table class="data-table">
          <tr>
            <td class="lbl" width="18%">Área</td>
            <td class="val"><b>${curso.area_urbano_rural || curso.ciclo_grupo || 'EDUCACIÓN CONTINUA'}</b></td>
          </tr>
          <tr>
            <td class="lbl">Ciclo Formativo</td>
            <td class="val"><b>${curso.ciclo_nombre || (curso as any).nombre || (curso as any).grupo_nombre || 'PROGRAMA FORMATIVO UNEFCO'}</b></td>
          </tr>
          <tr>
            <td class="lbl">Costo / Monto</td>
            <td class="val"><b>Bs. ${(curso as any).costo || 150}</b></td>
          </tr>
          <tr>
            <td class="lbl">Curso Nº 1</td>
            <td class="val">${curso.tema1 || ''}</td>
          </tr>
          <tr>
            <td class="lbl">Curso Nº 2</td>
            <td class="val">${curso.tema2 || ''}</td>
          </tr>
          <tr>
            <td class="lbl">Curso Nº 3</td>
            <td class="val">${curso.tema3 || ''}</td>
          </tr>
          <tr>
            <td class="lbl">Curso Nº 4</td>
            <td class="val">${curso.tema4 || ''}</td>
          </tr>
        </table>

        <table class="personal-table">
          <tr>
            <td class="lbl" width="20%">Apellido(s) y Nombre(s):</td>
            <td class="val" colspan="3"><b>${p.apellidos} ${p.nombres}</b></td>
            <td class="lbl" width="12%">Telf/Cel:</td>
            <td class="val" width="15%"><b>${p.celular || ''}</b></td>
          </tr>
          <tr>
            <td class="lbl">Carnet de Identidad:</td>
            <td class="val" width="25%"><b>${p.ci}</b></td>
            <td class="lbl" width="10%">E-mail:</td>
            <td class="val"><b>${(p as any).correo || ''}</b></td>
            <td class="lbl">RDA/RP:</td>
            <td class="val"><b>${p.rda || ''}</b></td>
          </tr>
          <tr>
            <td class="lbl">Fecha de Nacimiento:</td>
            <td class="val" colspan="5"><b></b></td>
          </tr>
        </table>

        <div class="checks-section">
          <div class="check-row">
            <span class="lbl-check">Función que cumple:</span>
            <span class="chk-box-label">Docente ${chk(true)}</span>
            <span class="chk-box-label">Director ${chk(false)}</span>
            <span class="chk-box-label">Administrativo ${chk(false)}</span>
            <span class="chk-box-label">Estudiante ESFM ${chk(false)}</span>
            <span class="chk-box-label">No aplica ${chk(false)}</span>
          </div>

          <div class="check-row">
            <span class="lbl-check">Área:</span>
            <span class="chk-box-label">Urbano ${chk(true)}</span>
            <span class="chk-box-label">Rural ${chk(false)}</span>
          </div>

          <table class="check-table">
            <tr>
              <td width="75%">
                <div class="field-line">
                  <span class="lbl-line">Distrito Educativo:</span>
                  <span class="val-line"><b>${curso.distrito || 'SANTA CRUZ 1'}</b></span>
                </div>
                <div class="field-line">
                  <span class="lbl-line">Unidad Educativa:</span>
                  <span class="val-line"><b>${p.unidad_educativa || ''}</b></span>
                </div>
              </td>
              <td width="25%" align="right">
                <div class="check-vertical">
                  <span class="chk-box-label">No aplica ${chk(!curso.distrito)}</span>
                  <span class="chk-box-label">No aplica ${chk(!p.unidad_educativa)}</span>
                </div>
              </td>
            </tr>
          </table>

          <div class="check-row" style="margin-top: 4px;">
            <span class="lbl-check">Subsistema:</span>
            <span class="chk-box-label">Educación Regular ${chk(true)}</span>
            <span class="chk-box-label">Educación Alternativa y Especial ${chk(false)}</span>
            <span class="chk-box-label">Ed. Superior ${chk(false)}</span>
            <span class="chk-box-label">No aplica ${chk(false)}</span>
          </div>

          <div class="check-row">
            <span class="lbl-check">Nivel de Ed. Regular:</span>
            <span class="chk-box-label">Inicial ${chk(false)}</span>
            <span class="chk-box-label">Primaria ${chk(true)}</span>
            <span class="chk-box-label">Secundaria ${chk(false)}</span>
            <span class="chk-box-label">Ed. Superior ${chk(false)}</span>
            <span class="chk-box-label">No aplica ${chk(false)}</span>
          </div>
        </div>

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

    const fichaHtml = buildFichaHtml();

    printWindow.document.write(`
      <html>
      <head>
        <title>Ficha de Inscripción - ${p.ci}</title>
        <style>
          @page { size: letter portrait; margin: 0.25in 0.25in; }
          html, body { height: 100%; margin: 0; padding: 0; box-sizing: border-box; background: #fff; font-family: Arial, sans-serif; }
          .sheet-container { display: flex; flex-direction: column; height: 100%; justify-content: space-between; box-sizing: border-box; padding: 0.1in 0; position: relative; }
          .ficha { height: 48%; box-sizing: border-box; border: 2px solid #000; border-radius: 4px; padding: 10px 14px; display: flex; flex-direction: column; justify-content: space-between; position: relative; background: #fff; }
          .divider-line { border-top: 1.5px dashed #777; width: 100%; text-align: center; padding: 6px 0; font-size: 8pt; color: #555; box-sizing: border-box; }
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
          ${fichaHtml}
          <div class="divider-line">---------------------- CORTE POR AQUÍ PARA ENTREGAR AL MAESTRO / UNEFCO ----------------------</div>
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

  // Direct printable window for documents / photos
  const handlePrintDirect = (url: string, title: string) => {
    if (!url) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.open(url, '_blank');
      return;
    }
    const isPdf = url.toLowerCase().endsWith('.pdf');
    if (isPdf) {
      printWindow.location.href = url;
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <style>
          @page { size: letter portrait; margin: 10mm; }
          body { margin: 0; padding: 10px; display: flex; flex-direction: column; align-items: center; font-family: sans-serif; }
          .header { text-align: center; margin-bottom: 10px; font-size: 14px; font-weight: bold; color: #1e293b; }
          img { max-width: 100%; max-height: 90vh; object-fit: contain; border-radius: 4px; box-shadow: 0 1px 4px rgba(0,0,0,0.1); }
        </style>
      </head>
      <body>
        <div class="header">${title}</div>
        <img src="${url}" alt="${title}" onload="window.print(); setTimeout(() => window.close(), 600);" />
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // View RDA or Work Certificate lightbox
  const handleViewDocument = (url: string, name: string) => {
    if (!url) {
      Swal.fire('Sin documento', 'Este participante aún no ha subido su RDA o Certificado de Trabajo.', 'info');
      return;
    }

    Swal.fire({
      title: `RDA / Certificado de Trabajo - ${name}`,
      html: `
        <div style="text-align: center; max-height: 70vh; overflow-y: auto;">
          ${url.toLowerCase().endsWith('.pdf') ? `
            <iframe src="${url}" style="width: 100%; height: 500px; border: none; border-radius: 8px;"></iframe>
          ` : `
            <img src="${url}" alt="Documento RDA / Certificado" style="max-width: 100%; border-radius: 8px; box-shadow: 0 4px 14px rgba(0,0,0,0.15);" />
          `}
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: '🖨️ Imprimir / Abrir Documento',
      cancelButtonText: 'Cerrar',
      confirmButtonColor: '#0284c7',
      width: '680px'
    }).then((res) => {
      if (res.isConfirmed) {
        handlePrintDirect(url, `RDA / Certificado - ${name}`);
      }
    });
  };

  // View deposit voucher lightbox
  const handleViewComprobante = (url: string, name: string) => {
    if (!url) {
      Swal.fire('Sin comprobante', 'Este participante aún no ha registrado un comprobante de depósito.', 'info');
      return;
    }

    Swal.fire({
      title: `Comprobante de Pago - ${name}`,
      html: `
        <div style="text-align: center; max-height: 70vh; overflow-y: auto;">
          ${url.toLowerCase().endsWith('.pdf') ? `
            <iframe src="${url}" style="width: 100%; height: 500px; border: none; border-radius: 8px;"></iframe>
          ` : `
            <img src="${url}" alt="Comprobante" style="max-width: 100%; border-radius: 8px; box-shadow: 0 4px 14px rgba(0,0,0,0.15);" />
          `}
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: '🖨️ Imprimir / Abrir Comprobante',
      cancelButtonText: 'Cerrar',
      confirmButtonColor: '#2563eb',
      width: '650px'
    }).then((res) => {
      if (res.isConfirmed) {
        handlePrintDirect(url, `Comprobante de Pago - ${name}`);
      }
    });
  };

  return (
    <>
      <div className="modal-overlay" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(11,21,32,0.6)', backdropFilter: 'blur(8px)', zIndex: 1000, padding: '10px', overflowY: 'auto' }}>
      <div className="modal-container" style={{ background: 'var(--white)', borderRadius: 'var(--radius-lg)', width: '98%', maxWidth: '98vw', height: '96vh', maxHeight: '96vh', boxShadow: 'var(--shadow-xl)', display: 'flex', flexDirection: 'column', animation: 'slideUp 0.3s ease', overflow: 'hidden' }}>

        {/* Modal Header */}
        <div className="modal-header" style={{ padding: '14px 20px', background: 'var(--primary-900)', color: 'var(--white)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>
              Participantes — ID {curso.id}
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.72rem', opacity: 0.8 }}>
              {curso.ciclo_nombre || 'Sin Ciclo'} | {curso.facilitador_nombre || 'Sin Facilitador'} | {curso.lugar}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-icon btn-ghost"
            onClick={onClose}
            style={{ color: 'var(--white)', padding: '6px', borderRadius: '50%' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>

          {/* Top Panel: SIE Connection & Actions Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', background: 'var(--gray-50)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--gray-200)' }}>

            {/* SIE Authentication Panel */}
            <div style={{ borderRight: '1px solid var(--gray-200)', paddingRight: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <ShieldAlert size={18} style={{ color: sieSession ? 'var(--green-500)' : 'var(--primary-500)' }} />
                <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary-800)' }}>
                  Conectividad SIE UNEFCO
                </h4>
              </div>

              {sieSession ? (
                /* Connected State */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--green-100)', color: 'var(--green-600)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', fontWeight: 600 }}>
                    <CheckCircle2 size={16} />
                    <span>Conexión establecida con éxito con el portal SIE.</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={handleSieDisconnect}>
                      Desconectar de SIE
                    </button>
                    {/* Validate All sequentially */}
                    <button
                      type="button"
                      className="btn btn-teal btn-sm"
                      onClick={handleValidateAll}
                      disabled={validatingAll}
                    >
                      {validatingAll ? (
                        <>
                          <Loader2 size={12} className="spin" />
                          Validando ({validatingIndex}/{validatingTotal})...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={12} />
                          Validar Todos
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                /* Disconnected State / Form */
                <form onSubmit={handleSieConnect} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--gray-600)' }}>USUARIO SIE</label>
                    <input
                      type="text"
                      value={sieUser}
                      onChange={(e) => setSieUser(e.target.value)}
                      placeholder="usuario@unefco.edu.bo"
                      style={{ padding: '6px 10px', fontSize: '0.82rem', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius-sm)' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--gray-600)' }}>CONTRASEÑA</label>
                    <input
                      type="password"
                      value={siePass}
                      onChange={(e) => setSiePass(e.target.value)}
                      placeholder="********"
                      style={{ padding: '6px 10px', fontSize: '0.82rem', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius-sm)' }}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={connectingSie} style={{ height: '33px' }}>
                    {connectingSie ? <Loader2 size={14} className="spin" /> : 'Conectar'}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Top Actions: Search, Exports, Add Manual */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={handleExportExcel} title="Exportar a Excel">
                <Download size={14} /> Excel
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={handlePrintPDF} title="Imprimir / Exportar PDF">
                <Printer size={14} /> PDF
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={handlePrintPlanilla} title="Imprimir Planilla de Asistencia y Material">
                <Printer size={14} /> Planilla
              </button>
              <button type="button" className="btn btn-sm" onClick={() => handleBulkPaymentUpdate('Pagado')} title="Marcar todos los participantes como Pagados" style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', color: '#fff', border: 'none', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px', boxShadow: '0 2px 8px rgba(16,185,129,0.25)' }}>
                <CheckCircle2 size={14} /> Marcar Todos Pagados
              </button>
              <button type="button" className="btn btn-sm" onClick={() => handleBulkPaymentUpdate('Pendiente')} title="Marcar todos los participantes como Pendientes" style={{ background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)', color: '#fff', border: 'none', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px', boxShadow: '0 2px 8px rgba(245,158,11,0.25)' }}>
                <AlertTriangle size={14} /> Marcar Todos Pendientes
              </button>
              <button type="button" className="btn btn-danger btn-sm" onClick={handleDeleteAllEnrollments} title="Eliminar todas las inscripciones">
                <Trash2 size={14} /> Eliminar Todos
              </button>
              <button type="button" className={`btn btn-sm ${showMigrator ? 'btn-secondary' : 'btn-primary'}`} onClick={() => { setShowMigrator(!showMigrator); if (showMigrator) { setMigrPreview([]); setMigrSourceId(''); } }} style={{ background: showMigrator ? undefined : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', color: showMigrator ? undefined : '#fff', border: 'none', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px', boxShadow: showMigrator ? undefined : '0 2px 8px rgba(99,102,241,0.25)' }}>
                <ArrowRight size={14} /> {showMigrator ? 'Cerrar Migrador' : 'Migrar Participantes'}
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--gray-500)', fontWeight: 600 }}>
                Total en Lista: <b>{filteredInscripciones.length} de {inscripciones.length}</b>
              </span>

              <div style={{ position: 'relative', flex: 1, maxWidth: '350px', minWidth: '180px' }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar inscrito..."
                  style={{ width: '100%', padding: '6px 10px 6px 30px', fontSize: '0.82rem', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius-sm)' }}
                />
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: 'var(--gray-400)' }} />
              </div>

              <button
                type="button"
                className={`btn ${showImporter ? 'btn-secondary' : 'btn-success'} btn-sm`}
                onClick={() => setShowImporter(!showImporter)}
              >
                <UserPlus size={14} /> {showImporter ? 'Cerrar Importador' : 'Importar Excel / CSV'}
              </button>
            </div>
          </div>

          {/* Unified Smart Importer Panel (Collapsible) */}
          {showImporter && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--primary-50)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--primary-100)', animation: 'slideDown 0.2s ease' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--primary-200)', paddingBottom: '10px' }}>
                <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 900, color: 'var(--primary-900)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <UserPlus size={18} /> Panel de Registro e Importación de Participantes
                </h4>

                {/* Tabs Selector */}
                <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.05)', padding: '3px', borderRadius: 'var(--radius-sm)', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-xs"
                    style={{ background: activeImportTab === 'ia' ? 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' : 'transparent', color: activeImportTab === 'ia' ? '#ffffff' : '#4338ca', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px', boxShadow: activeImportTab === 'ia' ? '0 2px 8px rgba(99, 102, 241, 0.35)' : 'none' }}
                    onClick={() => setActiveImportTab('ia')}
                  >
                    <Sparkles size={13} style={{ color: activeImportTab === 'ia' ? '#fbbf24' : '#6366f1' }} /> Importar con IA (OpenCode Go)
                  </button>
                  <button
                    type="button"
                    className="btn btn-xs"
                    style={{ background: activeImportTab === 'excel' ? 'var(--primary-500)' : 'transparent', color: activeImportTab === 'excel' ? 'var(--white)' : 'var(--gray-700)', display: 'flex', alignItems: 'center', gap: '4px' }}
                    onClick={() => setActiveImportTab('excel')}
                  >
                    <FileSpreadsheet size={12} /> Excel / CSV Local
                  </button>
                  <button
                    type="button"
                    className="btn btn-xs"
                    style={{ background: activeImportTab === 'individual' ? 'var(--primary-500)' : 'transparent', color: activeImportTab === 'individual' ? 'var(--white)' : 'var(--gray-700)' }}
                    onClick={() => setActiveImportTab('individual')}
                  >
                    Registro Individual
                  </button>
                </div>
              </div>

              {/* Tab Content: 1. AI OpenCode Go Importer */}
              {activeImportTab === 'ia' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* OpenCode Go Banner / Info */}
                  <div style={{
                    background: 'linear-gradient(135deg, #e0e7ff 0%, #ede9fe 100%)',
                    border: '1.5px solid #c7d2fe',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ background: '#4f46e5', color: '#ffffff', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(79, 70, 229, 0.4)' }}>
                        <Sparkles size={18} />
                      </div>
                      <div>
                        <span style={{ fontSize: '0.86rem', fontWeight: 900, color: '#312e81', display: 'block' }}>
                          Lector Multimodal con Inteligencia Artificial (OpenCode Go)
                        </span>
                        <span style={{ fontSize: '0.74rem', color: '#4338ca', fontWeight: 600 }}>
                          Analiza y extrae automáticamente listas de participantes desde archivos <b>PDF, Excel (.xlsx/.xls), CSV o Imágenes/Fotos</b>.
                        </span>
                      </div>
                    </div>

                    <span style={{
                      background: '#4338ca',
                      color: '#ffffff',
                      padding: '3px 10px',
                      borderRadius: '12px',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      letterSpacing: '0.5px'
                    }}>
                      PROVEEDOR: OPENCODE GO
                    </span>
                  </div>

                  {/* Dropzone for AI files */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '14px',
                    border: '2px dashed #818cf8',
                    borderRadius: 'var(--radius-md)',
                    padding: '28px 20px',
                    background: 'var(--white)',
                    transition: 'all 0.2s ease',
                    textAlign: 'center'
                  }}>
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <FileText size={32} style={{ color: '#dc2626' }} />
                        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#dc2626' }}>PDF</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <FileSpreadsheet size={32} style={{ color: '#16a34a' }} />
                        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#16a34a' }}>Excel / CSV</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <FileImage size={32} style={{ color: '#2563eb' }} />
                        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#2563eb' }}>Imagen</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <Camera size={32} style={{ color: '#7c3aed' }} />
                        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#7c3aed' }}>Cámara</span>
                      </div>
                    </div>

                    <div>
                      <span style={{ fontSize: '0.92rem', fontWeight: 900, color: 'var(--gray-800)', display: 'block', marginBottom: '4px' }}>
                        Selecciona o Arrastra tu Nómina (PDF, Excel, Imagen o CSV)
                      </span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--gray-500)', display: 'block' }}>
                        La IA de <b>OpenCode Go</b> analizará el archivo, descifrará los nombres, C.I., RDA, celular y colegio, y los estructurará automáticamente.
                      </span>
                    </div>

                    {iaLoading ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#4f46e5', fontWeight: 800, fontSize: '0.9rem', padding: '10px 22px', background: '#eef2ff', borderRadius: '8px', border: '1px solid #c7d2fe' }}>
                        <Loader2 size={20} className="spin" /> Procesando con IA (OpenCode Go)... Por favor espera unos segundos.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                        <label className="btn btn-primary btn-sm" style={{ cursor: 'pointer', background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', border: 'none', color: '#ffffff', display: 'inline-flex', gap: '8px', fontWeight: 800, padding: '10px 20px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)' }}>
                          <Upload size={16} /> Seleccionar Archivo (PDF / Excel / Imagen / CSV)
                          <input
                            type="file"
                            accept=".pdf,.xlsx,.xls,.csv,image/*"
                            onChange={handleAIFileUpload}
                            style={{ display: 'none' }}
                            disabled={iaLoading}
                          />
                        </label>

                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={startCamera}
                          disabled={iaLoading}
                          style={{ display: 'inline-flex', gap: '6px', fontWeight: 700, padding: '10px 16px', borderRadius: '8px' }}
                        >
                          <Camera size={16} /> Escanear con Cámara
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Camera Viewfinder if active */}
                  {cameraActive && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', background: '#0f172a', padding: '16px', borderRadius: 'var(--radius-md)', color: '#ffffff' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800 }}>Enfoca la lista física o nómina impresa:</span>
                      <video ref={videoRef} autoPlay playsInline style={{ width: '100%', maxWidth: '480px', borderRadius: '8px', border: '2px solid #6366f1' }} />
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button type="button" className="btn btn-success btn-sm" onClick={handleCaptureAndParse} disabled={iaLoading}>
                          <Camera size={14} /> Capturar y Analizar con IA
                        </button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={stopCamera}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab Content: 2. Manual Form */}
              {activeImportTab === 'individual' && (
                <form onSubmit={handleAddParticipantSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--gray-600)' }}>C.I. *</label>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input
                          type="text"
                          required
                          value={addCi}
                          onChange={(e) => setAddCi(e.target.value)}
                          onBlur={() => checkCiExist(addCi)}
                          placeholder="Ej: 1234567"
                          style={{ flex: 1, padding: '6px 10px', fontSize: '0.82rem', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius-sm)', background: 'var(--white)' }}
                        />
                        {searchingCi && <Loader2 size={16} className="spin" style={{ alignSelf: 'center' }} />}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--gray-600)' }}>Nombres *</label>
                      <input
                        type="text"
                        required
                        value={addNombres}
                        onChange={(e) => setAddNombres(e.target.value.toUpperCase())}
                        placeholder="NOMBRES"
                        style={{ padding: '6px 10px', fontSize: '0.82rem', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius-sm)', textTransform: 'uppercase', background: 'var(--white)' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--gray-600)' }}>Apellidos *</label>
                      <input
                        type="text"
                        required
                        value={addApellidos}
                        onChange={(e) => setAddApellidos(e.target.value.toUpperCase())}
                        placeholder="APELLIDOS"
                        style={{ padding: '6px 10px', fontSize: '0.82rem', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius-sm)', textTransform: 'uppercase', background: 'var(--white)' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--gray-600)' }}>RDA (Opcional)</label>
                      <input
                        type="text"
                        value={addRda}
                        onChange={(e) => setAddRda(e.target.value)}
                        placeholder="RDA"
                        style={{ padding: '6px 10px', fontSize: '0.82rem', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius-sm)', background: 'var(--white)' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--gray-600)' }}>Celular</label>
                      <input
                        type="text"
                        value={addCelular}
                        onChange={(e) => setAddCelular(e.target.value)}
                        placeholder="Celular"
                        style={{ padding: '6px 10px', fontSize: '0.82rem', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius-sm)', background: 'var(--white)' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--gray-600)' }}>Código SIE (Opcional)</label>
                      <input
                        type="text"
                        value={addSie}
                        onChange={(e) => setAddSie(e.target.value)}
                        placeholder="SIE"
                        style={{ padding: '6px 10px', fontSize: '0.82rem', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius-sm)', background: 'var(--white)' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', gridColumn: 'span 2' }}>
                      <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--gray-600)' }}>Unidad Educativa</label>
                      <input
                        type="text"
                        value={addUnidadEducativa}
                        onChange={(e) => setAddUnidadEducativa(e.target.value.toUpperCase())}
                        placeholder="UNIDAD EDUCATIVA"
                        style={{ padding: '6px 10px', fontSize: '0.82rem', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius-sm)', textTransform: 'uppercase', background: 'var(--white)' }}
                      />
                    </div>
                  </div>

                  {ciExists && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--green-600)', background: 'var(--green-100)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontWeight: 600 }}>
                      ✓ El participante ya existe en el sistema. Al confirmar, se le inscribirá a este ciclo automáticamente.
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                    <button type="submit" className="btn btn-success btn-sm">
                      Inscribir Participante
                    </button>
                  </div>
                </form>
              )}

              {/* Tab Content: 3. Smart Excel / CSV File Upload */}
              {activeImportTab === 'excel' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--gray-600)' }}>
                    Carga tu plantilla o nómina en archivo <b>Excel (.xlsx, .xls)</b> o <b>CSV (.csv)</b>. El lector inteligente detectará automáticamente las columnas de C.I., Nombres, Apellidos, Celular, RDA y Unidad Educativa sin importar el orden.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', border: '2px dashed var(--primary-300)', borderRadius: 'var(--radius-md)', padding: '24px', background: 'var(--white)', transition: 'all 0.2s ease' }}>
                    <Upload size={42} style={{ color: 'var(--primary-500)' }} />
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--gray-800)', display: 'block', marginBottom: '4px' }}>
                        Seleccionar o Arrastrar Archivo Excel / CSV
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>
                        Formatos soportados: <b>.xlsx, .xls, .csv</b>
                      </span>
                    </div>

                    <label className="btn btn-primary btn-sm" style={{ cursor: 'pointer', display: 'inline-flex', gap: '8px', fontWeight: 700, padding: '8px 18px', borderRadius: '8px' }}>
                      <FileText size={16} /> Seleccionar Archivo
                      <input
                        type="file"
                        accept=".xlsx, .xls, .csv"
                        onChange={handleSmartExcelFileUpload}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Import Preview Table */}
              {previewList.length > 0 && (
                <div style={{ borderTop: '1px solid var(--primary-200)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h5 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: 'var(--primary-900)' }}>
                      Vista Previa de Importación ({previewList.length} detectados)
                    </h5>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        className="btn btn-success btn-sm"
                        onClick={handleSavePreviewList}
                        disabled={importingBatch}
                      >
                        {importingBatch ? (
                          <>
                            <Loader2 size={12} className="spin" /> Guardando...
                          </>
                        ) : (
                          <>
                            <Check size={14} /> Confirmar e Inscribir Lote
                          </>
                        )}
                      </button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPreviewList([])} disabled={importingBatch}>
                        Limpiar Vista Previa
                      </button>
                    </div>
                  </div>

                  {/* Preview Table */}
                  <div style={{ overflowX: 'auto', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-sm)', background: 'var(--white)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: 'var(--gray-100)', borderBottom: '1px solid var(--gray-200)' }}>
                          <th style={{ padding: '6px 10px', width: '40px', textAlign: 'center' }}>#</th>
                          <th style={{ padding: '6px 10px', width: '100px' }}>C.I.</th>
                          <th style={{ padding: '6px 10px', width: '150px' }}>Nombres</th>
                          <th style={{ padding: '6px 10px', width: '150px' }}>Apellidos</th>
                          <th style={{ padding: '6px 10px', width: '80px' }}>RDA</th>
                          <th style={{ padding: '6px 10px', width: '90px' }}>Celular</th>
                          <th style={{ padding: '6px 10px', width: '85px' }}>SIE</th>
                          <th style={{ padding: '6px 10px' }}>Unidad Educativa</th>
                          <th style={{ padding: '6px 10px', width: '50px', textAlign: 'center' }}>Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewList.map((p, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                            <td style={{ padding: '4px 8px', textAlign: 'center', color: 'var(--gray-400)' }}>{idx + 1}</td>

                            {/* C.I. */}
                            <td style={{ padding: '4px 8px' }}>
                              <input
                                type="text"
                                value={p.ci}
                                onChange={(e) => {
                                  const updated = [...previewList];
                                  updated[idx].ci = e.target.value;
                                  setPreviewList(updated);
                                }}
                                style={{ width: '100%', padding: '3px 6px', fontSize: '0.78rem', border: '1px solid var(--gray-200)', borderRadius: '3px' }}
                              />
                            </td>

                            {/* Nombres */}
                            <td style={{ padding: '4px 8px' }}>
                              <input
                                type="text"
                                value={p.nombres}
                                onChange={(e) => {
                                  const updated = [...previewList];
                                  updated[idx].nombres = e.target.value.toUpperCase();
                                  setPreviewList(updated);
                                }}
                                style={{ width: '100%', padding: '3px 6px', fontSize: '0.78rem', border: '1px solid var(--gray-200)', borderRadius: '3px', textTransform: 'uppercase' }}
                              />
                            </td>

                            {/* Apellidos */}
                            <td style={{ padding: '4px 8px' }}>
                              <input
                                type="text"
                                value={p.apellidos}
                                onChange={(e) => {
                                  const updated = [...previewList];
                                  updated[idx].apellidos = e.target.value.toUpperCase();
                                  setPreviewList(updated);
                                }}
                                style={{ width: '100%', padding: '3px 6px', fontSize: '0.78rem', border: '1px solid var(--gray-200)', borderRadius: '3px', textTransform: 'uppercase' }}
                              />
                            </td>

                            {/* RDA */}
                            <td style={{ padding: '4px 8px' }}>
                              <input
                                type="text"
                                value={p.rda || ''}
                                onChange={(e) => {
                                  const updated = [...previewList];
                                  updated[idx].rda = e.target.value;
                                  setPreviewList(updated);
                                }}
                                style={{ width: '100%', padding: '3px 6px', fontSize: '0.78rem', border: '1px solid var(--gray-200)', borderRadius: '3px' }}
                              />
                            </td>

                            {/* Celular */}
                            <td style={{ padding: '4px 8px' }}>
                              <input
                                type="text"
                                value={p.celular || ''}
                                onChange={(e) => {
                                  const updated = [...previewList];
                                  updated[idx].celular = e.target.value;
                                  setPreviewList(updated);
                                }}
                                style={{ width: '100%', padding: '3px 6px', fontSize: '0.78rem', border: '1px solid var(--gray-200)', borderRadius: '3px' }}
                              />
                            </td>

                            {/* SIE */}
                            <td style={{ padding: '4px 8px' }}>
                              <input
                                type="text"
                                value={p.sie || ''}
                                onChange={(e) => {
                                  const updated = [...previewList];
                                  updated[idx].sie = e.target.value;
                                  setPreviewList(updated);
                                }}
                                style={{ width: '100%', padding: '3px 6px', fontSize: '0.78rem', border: '1px solid var(--gray-200)', borderRadius: '3px' }}
                              />
                            </td>

                            {/* Unidad Educativa */}
                            <td style={{ padding: '4px 8px' }}>
                              <input
                                type="text"
                                value={p.unidad_educativa || ''}
                                onChange={(e) => {
                                  const updated = [...previewList];
                                  updated[idx].unidad_educativa = e.target.value.toUpperCase();
                                  setPreviewList(updated);
                                }}
                                style={{ width: '100%', padding: '3px 6px', fontSize: '0.78rem', border: '1px solid var(--gray-200)', borderRadius: '3px', textTransform: 'uppercase' }}
                              />
                            </td>

                            {/* Actions (delete row from preview) */}
                            <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs"
                                onClick={() => {
                                  setPreviewList(previewList.filter((_, i) => i !== idx));
                                }}
                                style={{ padding: '3px', color: 'var(--red-500)' }}
                              >
                                <Trash2 size={12} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Migration Panel (Collapsible) */}
          {showMigrator && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: '#f0f4ff', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid #c7d2fe', animation: 'slideDown 0.2s ease' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ArrowRight size={18} style={{ color: '#6366f1' }} />
                <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 900, color: '#3730a3' }}>Migrar Participantes de otro Curso</h4>
              </div>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#6b7280' }}>
                Ingresa el ID del curso origen para ver y migrar sus participantes a este curso.
              </p>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1, maxWidth: '250px' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '3px' }}>ID Curso Origen</label>
                  <input
                    type="text"
                    value={migrSourceId}
                    onChange={(e) => setMigrSourceId(e.target.value)}
                    placeholder="Ej: 10052"
                    style={{ padding: '6px 10px', fontSize: '0.82rem', width: '100%', border: '1px solid #c7d2fe', borderRadius: 'var(--radius-sm)' }}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={handleFetchMigrationPreview}
                  disabled={migrLoading || !migrSourceId.trim()}
                  style={{ background: '#6366f1', color: '#fff', border: 'none', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px' }}
                >
                  {migrLoading ? <Loader2 size={14} className="spin" /> : <Search size={14} />}
                  Buscar
                </button>
              </div>

              {/* Preview table */}
              {migrPreview.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>
                    Vista previa: <b>{migrPreview.length}</b> participante{migrPreview.length !== 1 ? 's' : ''} del curso <b>{migrSourceId}</b>
                  </div>
                  <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #c7d2fe', borderRadius: '6px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                      <thead>
                        <tr style={{ background: '#e0e7ff', position: 'sticky', top: 0 }}>
                          <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 800, color: '#3730a3', fontSize: '0.7rem' }}>C.I.</th>
                          <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 800, color: '#3730a3', fontSize: '0.7rem' }}>Nombres</th>
                          <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 800, color: '#3730a3', fontSize: '0.7rem' }}>Apellidos</th>
                          <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 800, color: '#3730a3', fontSize: '0.7rem' }}>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {migrPreview.map((ins, idx) => {
                          const p = ins.participantes;
                          const alreadyExists = inscripciones.some(i => i.participantes?.ci === (ins.participantes?.ci || p?.ci));
                          return (
                            <tr key={idx} style={{ background: alreadyExists ? '#fef2f2' : idx % 2 === 0 ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                              <td style={{ padding: '4px 8px' }}>{p?.ci || '-'}</td>
                              <td style={{ padding: '4px 8px' }}>{p?.nombres || '-'}</td>
                              <td style={{ padding: '4px 8px' }}>{p?.apellidos || '-'}</td>
                              <td style={{ padding: '4px 8px' }}>
                                {alreadyExists ? (
                                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#dc2626', background: '#fee2e2', padding: '1px 6px', borderRadius: '3px' }}>Ya existe</span>
                                ) : (
                                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#059669', background: '#ecfdf5', padding: '1px 6px', borderRadius: '3px' }}>Nuevo</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => { setMigrPreview([]); setMigrSourceId(''); }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={handleConfirmMigration}
                      disabled={migrating}
                      style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', color: '#fff', border: 'none', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}
                    >
                      {migrating ? <Loader2 size={14} className="spin" /> : <ArrowRight size={14} />}
                      {migrating ? 'Migrando...' : `Migrar ${migrPreview.filter(ins => !inscripciones.some(i => i.participantes?.ci === (ins.participantes?.ci))).length} Participantes`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Enrolled Participants Table */}
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', gap: '16px' }}>
              <Loader2 className="spin" size={36} style={{ color: 'var(--primary-500)' }} />
              <span style={{ fontSize: '0.88rem', color: 'var(--gray-500)', fontWeight: 600 }}>Cargando lista de participantes inscritos...</span>
            </div>
          ) : filteredInscripciones.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', background: 'var(--gray-50)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--gray-300)' }}>
              <span style={{ fontSize: '2rem', display: 'block', marginBottom: '10px' }}>📋</span>
              <p style={{ margin: 0, fontWeight: 700, color: 'var(--gray-600)' }}>No se encontraron participantes en este ciclo.</p>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--gray-400)' }}>Inscribe participantes con el formulario público o con el botón "Importar Lote".</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--primary-900)', color: 'var(--white)' }}>
                    <th style={{ padding: '12px 16px', fontSize: '0.9rem', textTransform: 'uppercase', width: '50px', textAlign: 'center' }}>Nro</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.9rem', textTransform: 'uppercase', width: '130px' }}>C.I.</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.9rem', textTransform: 'uppercase', width: '110px' }}>RDA</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.9rem', textTransform: 'uppercase' }}>Apellidos y Nombres</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.9rem', textTransform: 'uppercase', width: '140px' }}>Celular</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.9rem', textTransform: 'uppercase', width: '180px' }}>SIE / Unidad Educativa</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.9rem', textTransform: 'uppercase', width: '140px', textAlign: 'center' }}>Validación SIE</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.9rem', textTransform: 'uppercase', width: '130px' }}>Estado Pago</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.9rem', textTransform: 'uppercase', width: '130px', textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInscripciones.map((ins, index) => {
                    const p = ins.participantes;
                    if (!p) return null;

                    return (
                      <RowComponent
                        key={ins.id}
                        ins={ins}
                        p={p}
                        visualIndex={index + 1}
                        cursoId={curso.id}
                        onSave={handleUpdateEnrollment}
                        onDelete={handleDeleteEnrollment}
                        onEditCore={setEditingPart}
                        onValidate={handleValidateParticipant}
                        validating={validatingPartId === ins.id}
                        sieConnected={!!sieSession}
                        onRefresh={fetchParticipantes}
                        onPrintFicha={handlePrintFichaForParticipant}
                        onViewDocument={handleViewDocument}
                        onViewComprobante={handleViewComprobante}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ padding: '16px 24px', borderTop: '1px solid var(--gray-200)', background: 'var(--gray-50)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cerrar Ventana
          </button>
        </div>

      </div>
    </div>

    {editingPart && (
      <div className="modal-overlay" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(11,21,32,0.6)', backdropFilter: 'blur(8px)', zIndex: 1100, padding: '20px' }}>
        <div className="modal-container" style={{ background: 'var(--white)', borderRadius: '16px', width: '100%', maxWidth: '520px', boxShadow: 'var(--shadow-xl)', display: 'flex', flexDirection: 'column', animation: 'slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)', overflow: 'hidden', border: '1px solid var(--gray-200)' }}>
          
          {/* Header */}
          <div className="modal-header" style={{ padding: '18px 24px', background: 'linear-gradient(135deg, var(--primary-900), var(--primary-800))', color: 'var(--white)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3px solid var(--primary-500)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Edit size={18} style={{ color: 'var(--primary-400)' }} />
              <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--white)', letterSpacing: '0.02em' }}>Editar Datos del Participante</h4>
            </div>
            <button type="button" className="btn btn-icon btn-ghost" onClick={() => setEditingPart(null)} style={{ color: 'rgba(255,255,255,0.8)', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer' }} onMouseOver={(e) => e.currentTarget.style.color = '#fff'} onMouseOut={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.8)'}>
              <X size={16} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSaveCoreParticipant} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* CI (Disabled) */}
            <div className="premium-form-group">
              <label className="premium-form-label">
                <IdCard size={13} /> C.I. (No editable)
              </label>
              <div className="premium-input-wrapper">
                <input 
                  type="text" 
                  disabled 
                  value={editingPart.ci} 
                  className="premium-form-input"
                />
                <IdCard className="premium-input-icon" size={16} style={{ color: 'var(--gray-400)' }} />
              </div>
            </div>

            {/* NOMBRES */}
            <div className="premium-form-group">
              <label className="premium-form-label">
                <User size={13} /> Nombres *
              </label>
              <div className="premium-input-wrapper">
                <input 
                  type="text" 
                  required 
                  value={editingPart.nombres} 
                  onChange={(e) => setEditingPart({ ...editingPart, nombres: e.target.value.toUpperCase() })} 
                  className="premium-form-input"
                  placeholder="EJ: CARLOS ALBERTO"
                />
                <User className="premium-input-icon" size={16} />
              </div>
            </div>

            {/* APELLIDOS */}
            <div className="premium-form-group">
              <label className="premium-form-label">
                <User size={13} /> Apellidos *
              </label>
              <div className="premium-input-wrapper">
                <input 
                  type="text" 
                  required 
                  value={editingPart.apellidos} 
                  onChange={(e) => setEditingPart({ ...editingPart, apellidos: e.target.value.toUpperCase() })} 
                  className="premium-form-input"
                  placeholder="EJ: GÓMEZ PÉREZ"
                />
                <User className="premium-input-icon" size={16} />
              </div>
            </div>

            {/* RDA and Celular */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="premium-form-group">
                <label className="premium-form-label">
                  <Award size={13} /> RDA (Opcional)
                </label>
                <div className="premium-input-wrapper">
                  <input 
                    type="text" 
                    value={editingPart.rda || ''} 
                    onChange={(e) => setEditingPart({ ...editingPart, rda: e.target.value })} 
                    className="premium-form-input"
                    placeholder="Ej: 83921"
                  />
                  <Award className="premium-input-icon" size={16} />
                </div>
              </div>

              <div className="premium-form-group">
                <label className="premium-form-label">
                  <Phone size={13} /> Celular (Opcional)
                </label>
                <div className="premium-input-wrapper">
                  <input 
                    type="text" 
                    value={editingPart.celular || ''} 
                    onChange={(e) => setEditingPart({ ...editingPart, celular: e.target.value })} 
                    className="premium-form-input"
                    placeholder="Ej: 78901234"
                  />
                  <Phone className="premium-input-icon" size={16} />
                </div>
              </div>
            </div>

            {/* SIE and UE */}
            <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '16px' }}>
              <div className="premium-form-group">
                <label className="premium-form-label">
                  <Hash size={13} /> CÓDIGO SIE
                </label>
                <div className="premium-input-wrapper">
                  <input 
                    type="text" 
                    value={editingPart.sie || ''} 
                    onChange={(e) => setEditingPart({ ...editingPart, sie: e.target.value })} 
                    className="premium-form-input"
                    placeholder="Ej: 807300"
                  />
                  <Hash className="premium-input-icon" size={16} />
                </div>
              </div>

              <div className="premium-form-group">
                <label className="premium-form-label">
                  <School size={13} /> Unidad Educativa
                </label>
                <div className="premium-input-wrapper">
                  <input 
                    type="text" 
                    value={editingPart.unidad_educativa || ''} 
                    onChange={(e) => setEditingPart({ ...editingPart, unidad_educativa: e.target.value.toUpperCase() })} 
                    className="premium-form-input"
                    placeholder="Nombre de la Institución"
                  />
                  <School className="premium-input-icon" size={16} />
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '14px', borderTop: '1px solid var(--gray-100)', paddingTop: '18px' }}>
              <button 
                type="button" 
                onClick={() => setEditingPart(null)} 
                style={{ 
                  background: 'var(--white)', 
                  color: 'var(--gray-600)', 
                  border: '1px solid var(--gray-300)', 
                  padding: '10px 20px', 
                  borderRadius: '8px', 
                  fontWeight: 600, 
                  cursor: 'pointer', 
                  transition: 'all 0.2s',
                  fontSize: '0.85rem'
                }}
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                style={{ 
                  background: 'linear-gradient(135deg, var(--primary-900), var(--primary-800))', 
                  color: 'var(--white)', 
                  border: 'none', 
                  padding: '10px 24px', 
                  borderRadius: '8px', 
                  fontWeight: 700, 
                  cursor: 'pointer', 
                  transition: 'all 0.2s',
                  boxShadow: 'var(--shadow-md)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.85rem'
                }}
              >
                <Check size={14} /> Guardar Cambios
              </button>
            </div>
          </form>

        </div>
      </div>
    )}
  </>
);
}

// Inner helper component to manage individual row state easily without re-rendering the whole table
interface RowComponentProps {
  ins: Inscripcion;
  p: Participante;
  visualIndex: number;
  cursoId: string;
  onSave: (id: number, pagos: string, observaciones: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onEditCore: (p: Participante) => void;
  onValidate: (ins: Inscripcion) => Promise<void>;
  validating: boolean;
  sieConnected: boolean;
  onRefresh: () => void;
  onPrintFicha: (p: Participante) => void;
  onViewDocument: (url: string, name: string) => void;
  onViewComprobante: (url: string, name: string) => void;
}

function RowComponent({
  ins,
  p,
  visualIndex,
  cursoId,
  onSave,
  onDelete,
  onEditCore,
  onValidate,
  validating,
  sieConnected,
  onRefresh,
  onPrintFicha,
  onViewDocument,
  onViewComprobante
}: RowComponentProps) {
  const [pagos, setPagos] = useState(ins.pagos || 'Pendiente');
  const [observaciones, setObservaciones] = useState(ins.observaciones || '');
  const [ci, setCi] = useState(p.ci || '');
  const [rda, setRda] = useState(p.rda || '');
  const [celular, setCelular] = useState(p.celular || '');
  const [saving, setSaving] = useState(false);

  const docUrl = ins.documento_url || p.documento_url || null;

  // Synchronize internal state with changes to props from parent
  useEffect(() => {
    setPagos(ins.pagos || 'Pendiente');
  }, [ins.pagos]);

  useEffect(() => {
    setObservaciones(ins.observaciones || '');
  }, [ins.observaciones]);

  useEffect(() => {
    setCi(p.ci || '');
  }, [p.ci]);

  useEffect(() => {
    setRda(p.rda || '');
  }, [p.rda]);

  useEffect(() => {
    setCelular(p.celular || '');
  }, [p.celular]);

  // Auto-save handlers
  const handlePagosChange = async (newVal: string) => {
    setPagos(newVal);
    setSaving(true);
    try {
      await onSave(ins.id, newVal, observaciones);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleObservacionesBlur = async () => {
    const trimmedVal = observaciones.trim();
    const originalVal = ins.observaciones || '';
    if (trimmedVal !== originalVal) {
      setSaving(true);
      try {
        await onSave(ins.id, pagos, trimmedVal);
      } catch (err) {
        console.error(err);
      } finally {
        setSaving(false);
      }
    }
  };

  const handleObservacionesKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  const handleCiKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  const handleRdaKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  const handleRdaBlur = async () => {
    const trimmedVal = rda.trim();
    const originalVal = p.rda || '';
    if (trimmedVal !== originalVal) {
      setSaving(true);
      try {
        const { error } = await supabase
          .from('participantes')
          .update({ rda: trimmedVal || null })
          .eq('ci', p.ci);

        if (error) throw error;
        p.rda = trimmedVal || null;

        Swal.fire({
          icon: 'success',
          title: 'RDA Actualizado',
          text: `RDA cambiado a ${trimmedVal || 'vacío'}`,
          timer: 1500,
          showConfirmButton: false,
          toast: true,
          position: 'top-end'
        });
      } catch (err: any) {
        console.error('Error updating RDA:', err);
        Swal.fire('Error', err.message || 'No se pudo actualizar el RDA', 'error');
        setRda(originalVal);
      } finally {
        setSaving(false);
      }
    }
  };

  const handleCelularBlur = async () => {
    const trimmedVal = celular.trim();
    const originalVal = p.celular || '';
    if (trimmedVal !== originalVal) {
      setSaving(true);
      try {
        const { error } = await supabase
          .from('participantes')
          .update({ celular: trimmedVal || null })
          .eq('ci', p.ci);

        if (error) throw error;
        p.celular = trimmedVal || null;
      } catch (err: any) {
        console.error('Error updating celular:', err);
        setCelular(originalVal);
      } finally {
        setSaving(false);
      }
    }
  };

  const handleCiBlur = async () => {
    const trimmedCi = ci.trim();
    const originalCi = p.ci.trim();
    
    if (!trimmedCi) {
      Swal.fire('Error', 'El Carnet de Identidad (C.I.) no puede estar vacío.', 'warning');
      setCi(originalCi);
      return;
    }

    if (trimmedCi !== originalCi) {
      setSaving(true);
      try {
        const { data: existingPart, error: checkErr } = await supabase
          .from('participantes')
          .select('*')
          .eq('ci', trimmedCi)
          .maybeSingle();

        if (checkErr) throw checkErr;

        if (existingPart) {
          const { data: existingEnroll, error: enrollErr } = await supabase
            .from('inscripcion_ciclo')
            .select('*')
            .eq('curso_id', cursoId)
            .eq('participante_ci', trimmedCi)
            .maybeSingle();

          if (enrollErr) throw enrollErr;

          if (existingEnroll) {
            Swal.fire('Ya registrado', `El participante con C.I. ${trimmedCi} ya está inscrito en este ciclo.`, 'warning');
            setCi(originalCi);
            setSaving(false);
            return;
          }

          const confirmResult = await Swal.fire({
            title: 'Participante existente',
            text: `El C.I. ${trimmedCi} ya existe en el sistema a nombre de ${existingPart.apellidos} ${existingPart.nombres}. ¿Deseas vincular esta inscripción a ese participante?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, vincular',
            cancelButtonText: 'Cancelar'
          });

          if (!confirmResult.isConfirmed) {
            setCi(originalCi);
            setSaving(false);
            return;
          }

          const { error: updateEnrollErr } = await supabase
            .from('inscripcion_ciclo')
            .update({ participante_ci: trimmedCi })
            .eq('id', ins.id);

          if (updateEnrollErr) throw updateEnrollErr;
        } else {
          const { error: insertErr } = await supabase
            .from('participantes')
            .insert({
              ci: trimmedCi,
              nombres: p.nombres,
              apellidos: p.apellidos,
              rda: p.rda,
              celular: p.celular,
              sie: p.sie,
              unidad_educativa: p.unidad_educativa,
              validado: p.validado,
              observaciones_sie: p.observaciones_sie
            });

          if (insertErr) throw insertErr;

          const { error: updateEnrollErr } = await supabase
            .from('inscripcion_ciclo')
            .update({ participante_ci: trimmedCi })
            .eq('id', ins.id);

          if (updateEnrollErr) {
            await supabase.from('participantes').delete().eq('ci', trimmedCi);
            throw updateEnrollErr;
          }
        }

        const { count, error: countErr } = await supabase
          .from('inscripcion_ciclo')
          .select('*', { count: 'exact', head: true })
          .eq('participante_ci', originalCi);

        if (countErr) throw countErr;

        if (count === 0) {
          await supabase
            .from('participantes')
            .delete()
            .eq('ci', originalCi);
        }

        Swal.fire({
          icon: 'success',
          title: 'Carnet Actualizado',
          text: `C.I. cambiado de ${originalCi} a ${trimmedCi}`,
          timer: 1500,
          showConfirmButton: false,
          toast: true,
          position: 'top-end'
        });

        onRefresh();
      } catch (err: any) {
        console.error('Error updating C.I.:', err);
        Swal.fire('Error', err.message || 'No se pudo actualizar el Carnet de Identidad', 'error');
        setCi(originalCi);
      } finally {
        setSaving(false);
      }
    }
  };

  return (
    <tr style={{ borderBottom: '1px solid #000000', transition: 'background var(--transition-fast)' }} className="hover-row">

      {/* Nro */}
      <td style={{ padding: '12px 16px', fontSize: '0.9rem', color: 'var(--gray-600)', fontWeight: 600, textAlign: 'center' }}>
        {visualIndex}
      </td>

      {/* CI */}
      <td style={{ padding: '8px 12px', width: '130px' }}>
        <input
          type="text"
          value={ci}
          onChange={(e) => setCi(e.target.value)}
          onBlur={handleCiBlur}
          onKeyDown={handleCiKeyDown}
          disabled={saving}
          style={{ width: '100%', padding: '6px 8px', fontSize: '0.9rem', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius-sm)', fontWeight: 600, background: 'var(--white)' }}
        />
      </td>

      {/* RDA */}
      <td style={{ padding: '8px 12px', width: '110px' }}>
        <input
          type="text"
          value={rda}
          onChange={(e) => setRda(e.target.value)}
          onBlur={handleRdaBlur}
          onKeyDown={handleRdaKeyDown}
          disabled={saving}
          placeholder="RDA"
          style={{ width: '100%', padding: '6px 8px', fontSize: '0.9rem', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius-sm)', background: 'var(--white)' }}
        />
      </td>

      {/* Apellidos y Nombres */}
      <td style={{ padding: '12px 16px', fontSize: '0.95rem', color: 'var(--gray-900)' }}>
        <div>
          <b>{p.apellidos}</b><br />
          <span>{p.nombres}</span>
        </div>
      </td>

      {/* Celular - editable inline */}
      <td style={{ padding: '8px 12px', width: '140px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <input
            type="text"
            value={celular}
            onChange={(e) => setCelular(e.target.value)}
            onBlur={handleCelularBlur}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            disabled={saving}
            placeholder="Celular"
            style={{ width: '100%', padding: '4px 6px', fontSize: '0.85rem', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius-sm)', background: 'var(--white)' }}
          />
          {celular && (
            <a
              href={`https://wa.me/${celular.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#25d366', display: 'inline-flex', flexShrink: 0 }}
              title="Escribir por WhatsApp"
            >
              <Phone size={13} />
            </a>
          )}
        </div>
      </td>

      {/* SIE / UE */}
      <td style={{ padding: '12px 16px', fontSize: '0.9rem', color: 'var(--gray-600)', lineHeight: 1.3 }}>
        {p.unidad_educativa ? (
          <div>
            <b>{p.unidad_educativa}</b><br />
            {p.sie && <span style={{ opacity: 0.8 }}>SIE: {p.sie}</span>}
          </div>
        ) : (
          <span style={{ color: 'var(--gray-400)' }}>—</span>
        )}
      </td>

      {/* Validación SIE */}
      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
        {p.validado ? (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--green-100)', color: 'var(--green-600)', padding: '4px 8px', borderRadius: 'var(--radius-full)', fontSize: '0.78rem', fontWeight: 800 }}>
            <Check size={11} /> VALIDADO
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
            <span style={{ background: p.observaciones_sie ? 'var(--red-100)' : 'var(--gray-100)', color: p.observaciones_sie ? 'var(--red-600)' : 'var(--gray-500)', padding: '2px 6px', borderRadius: 'var(--radius-full)', fontSize: '0.78rem', fontWeight: 800 }}>
              {p.observaciones_sie ? 'CON DISCREPANCIA' : 'PENDIENTE'}
            </span>
            {sieConnected && (
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => onValidate(ins)}
                disabled={validating}
                style={{ padding: '2px 6px', fontSize: '0.78rem', border: '1px solid var(--primary-200)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
              >
                {validating ? <Loader2 size={10} className="spin" /> : <RefreshCw size={10} />}
                Validar
              </button>
            )}
          </div>
        )}
      </td>

      {/* Pago (Auto-save) */}
      <td style={{ padding: '12px 16px' }}>
        <select
          value={pagos}
          onChange={(e) => handlePagosChange(e.target.value)}
          disabled={saving}
          style={{ width: '100%', padding: '6px 8px', fontSize: '0.9rem', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius-sm)', background: 'var(--white)', cursor: 'pointer' }}
        >
          <option value="Pendiente">Pendiente</option>
          <option value="Pagado">Pagado</option>
        </select>
      </td>

      {/* Acciones */}
      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
        <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', alignItems: 'center' }}>
          {saving && (
            <span style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--green-600)', marginRight: '2px' }} title="Guardando automáticamente...">
              <Loader2 size={12} className="spin" />
            </span>
          )}

          {/* 1. Imprimir / Ver Ficha Oficial de Inscripción */}
          <button
            type="button"
            className="btn btn-xs"
            onClick={() => onPrintFicha(p)}
            title="📄 1. Imprimir / Ver Ficha Oficial de Inscripción (2 copias en hoja carta)"
            style={{ padding: '6px', background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <FileText size={12} />
          </button>

          {/* 2. Ver / Imprimir RDA o Certificado de Trabajo */}
          {docUrl ? (
            <button
              type="button"
              className="btn btn-xs"
              onClick={() => onViewDocument(docUrl, `${p.apellidos} ${p.nombres}`)}
              title="🪪 2. Ver / Imprimir Fotocopia RDA o Certificado de Trabajo"
              style={{ padding: '6px', background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <IdCard size={12} />
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-xs"
              onClick={() => onViewDocument('', `${p.apellidos} ${p.nombres}`)}
              title="Sin RDA o Certificado de Trabajo subido"
              style={{ padding: '6px', background: '#f1f5f9', color: '#94a3b8', border: '1px solid #cbd5e1', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <IdCard size={12} />
            </button>
          )}

          {/* 3. Ver / Imprimir Comprobante de Depósito */}
          {ins.comprobante_url ? (
            <button
              type="button"
              className="btn btn-xs"
              onClick={() => onViewComprobante(ins.comprobante_url!, `${p.apellidos} ${p.nombres}`)}
              title="💳 3. Ver / Imprimir Comprobante de Depósito Bancario"
              style={{ padding: '6px', background: '#6366f1', color: '#ffffff', border: 'none', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <CreditCard size={12} />
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-xs"
              onClick={() => onViewComprobante('', `${p.apellidos} ${p.nombres}`)}
              title="Sin comprobante de depósito subido para este ciclo"
              style={{ padding: '6px', background: '#f1f5f9', color: '#94a3b8', border: '1px solid #cbd5e1', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <CreditCard size={12} />
            </button>
          )}

          <button
            type="button"
            className="btn btn-warning btn-xs"
            onClick={() => onEditCore(p)}
            title="Corregir datos de participante ( spelling / RDA )"
            style={{ padding: '6px', color: 'var(--gray-900)' }}
          >
            <Edit size={12} />
          </button>
          <button
            type="button"
            className="btn btn-danger btn-xs"
            onClick={() => onDelete(ins.id)}
            title="Dar de baja de este ciclo"
            style={{ padding: '6px' }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </td>

    </tr>
  );
}
