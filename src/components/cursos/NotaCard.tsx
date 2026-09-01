'use client';

import { useState, useCallback, useEffect } from 'react';
import { Curso, HorarioSlot, Tecnico, Facilitador, CicloFormativo } from '@/types';
import Swal from 'sweetalert2';
import { getNoteCompliance } from '@/lib/utils/compliance';
import { buildMapEmbedSrc, buildMapOpenLink } from '@/lib/utils/maps';
import { GROUP_COLORS } from '@/lib/utils/colors';
import { formatFechaDisplay, getTotalHours, getHoursByCourse } from '@/lib/utils/calendar';
import MiniMonthCalendar from '@/components/calendario/MiniMonthCalendar';
import { distritosData } from '@/lib/utils/distritos';
import {
  Edit3, Trash2, Users, Wrench, Globe, FileText, BookOpen,
  ClipboardEdit, ToggleLeft, Link2, MapPin, ExternalLink,
  Phone, Eye, CheckCircle2, Copy, MessageCircle,
  Calendar, Clock, Save, User
} from 'lucide-react';
import InscripcionOnlineModal from '@/components/cursos/InscripcionOnlineModal';

const getInitialFechaInicio = (c: Curso | null): string => {
  if (!c) return '';
  if (c.fecha_inicio) {
    let cleanStr = c.fecha_inicio.trim().replace(/\s+/g, 'T');
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
      cleanStr += 'T08:00';
    }
    const match = cleanStr.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
    if (match) {
      return match[1];
    }
    return cleanStr;
  }
  if (c.horarios_tentativos && c.horarios_tentativos.length > 0) {
    const first = c.horarios_tentativos.reduce((a, b) => (a.date < b.date ? a : b));
    return `${first.date}T${first.startTime || '08:00'}`;
  }
  return '';
};

const AREAS_FORMATIVAS = [
  'EDUCACION ALTERNATIVA',
  'DOCENTES DE INSTITUTOS TECNICOS TECNOLOGICOS',
  'EDUCACION INICIAL EN FAMILIA COMUNITARIA',
  'PARA TODOS LOS ACTORES DEL SEP',
  'TACFI',
  'EDUCACION ESPECIAL',
  'EDUCACION SECUNDARIA COMUNITARIA PRODUCTIVA',
  'EDUCACION PRIMARIA COMUNITARIA VOCACIONAL'
];

const SEGMENTO_OPTIONS = [
  'Maestros(as), P. Admin.',
  'Egresados',
  'Estudiantes ESFM/UA',
  'Otros'
];

interface NotaCardProps {
  curso: Curso;
  tecnicos: Tecnico[];
  facilitadores: Facilitador[];
  ciclos: CicloFormativo[];
  grupoNames: string[];
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onUpdate: (data: Partial<Curso>) => void;
  onManageParticipantes: (curso: Curso) => void;
  animationDelay?: number;
  readOnly?: boolean;
  matchedParticipants?: string[];
}

export default function NotaCard({
  curso,
  tecnicos,
  facilitadores,
  ciclos,
  grupoNames,
  onEdit,
  onDelete,
  onDuplicate,
  onUpdate,
  onManageParticipantes,
  animationDelay = 0,
  readOnly = false,
  matchedParticipants,
}: NotaCardProps) {
  const [orgNombre, setOrgNombre] = useState(curso.organizador_nombre || '');
  const [orgTelefono, setOrgTelefono] = useState(curso.organizador_telefono || '');
  const [orgMaps, setOrgMaps] = useState(curso.organizador_maps || '');
  const [observaciones, setObservaciones] = useState(curso.observaciones || '');
  const [linkExterno, setLinkExterno] = useState(curso.link_inscripcion_externo || '');
  const [noteColor, setNoteColor] = useState(curso.grupo_color || '#2f80ed');
  const [prev, setPrev] = useState(curso.prev || '');
  const [showInscripcionModal, setShowInscripcionModal] = useState(false);
  const [resolvedMapSrc, setResolvedMapSrc] = useState('');

  // Estados locales para la edición directa del curso
  const [lastCursoId, setLastCursoId] = useState(curso.id);
  const [editTecnico, setEditTecnico] = useState(curso.tecnico_carnet || '');
  const [editCiclo, setEditCiclo] = useState(curso.ciclo_id || '');
  const [editAreaFormativa, setEditAreaFormativa] = useState(() => {
    const currentCiclo = ciclos.find((c) => c.id === curso.ciclo_id);
    return currentCiclo?.area_formativa || '';
  });
  const [editFacilitador, setEditFacilitador] = useState(curso.facilitador_carnet || '');
  const [editDistrito, setEditDistrito] = useState(curso.distrito || '');
  const [editLugar, setEditLugar] = useState(curso.lugar || '');
  const [editArea, setEditArea] = useState(curso.area_urbano_rural || 'Urbano');
  const [editSegmento, setEditSegmento] = useState(curso.segmento || '');
  const [editFechaInicio, setEditFechaInicio] = useState(getInitialFechaInicio(curso));
  const [editMes, setEditMes] = useState(curso.mes || '');
  const [editCosto, setEditCosto] = useState(curso.costo || 50);
  const [editGrupoNombre, setEditGrupoNombre] = useState(curso.grupo_nombre || '');
  const [editNewGrupoNombre, setEditNewGrupoNombre] = useState('');

  // Sincronizar estados locales con las props del curso
  useEffect(() => {
    const isDifferentCurso = curso.id !== lastCursoId;
    if (isDifferentCurso) {
      setLastCursoId(curso.id);
    }

    const hasOrgChanges = !isDifferentCurso && (
      orgNombre !== (curso.organizador_nombre || '') ||
      orgTelefono !== (curso.organizador_telefono || '') ||
      orgMaps !== (curso.organizador_maps || '') ||
      observaciones !== (curso.observaciones || '') ||
      linkExterno !== (curso.link_inscripcion_externo || '') ||
      noteColor !== (curso.grupo_color || '#2f80ed')
    );

    const cleanEditFecha = (editFechaInicio || '').replace('T', ' ').trim().substring(0, 16);
    const cleanCursoFecha = (curso.fecha_inicio || '').replace('T', ' ').trim().replace(/\s+/g, ' ').substring(0, 16);
    const hasCurChanges = !isDifferentCurso && (
      editTecnico !== (curso.tecnico_carnet || '') ||
      editCiclo !== (curso.ciclo_id || '') ||
      editFacilitador !== (curso.facilitador_carnet || '') ||
      editDistrito !== (curso.distrito || '') ||
      editLugar !== (curso.lugar || '') ||
      editArea !== (curso.area_urbano_rural || 'Urbano') ||
      editSegmento !== (curso.segmento || '') ||
      cleanEditFecha !== cleanCursoFecha ||
      editMes !== (curso.mes || '') ||
      editCosto !== (curso.costo || 50) ||
      editGrupoNombre !== (curso.grupo_nombre || '') ||
      editNewGrupoNombre.trim() !== ''
    );

    if (!hasOrgChanges) {
      setOrgNombre(curso.organizador_nombre || '');
      setOrgTelefono(curso.organizador_telefono || '');
      setOrgMaps(curso.organizador_maps || '');
      setObservaciones(curso.observaciones || '');
      setLinkExterno(curso.link_inscripcion_externo || '');
      setNoteColor(curso.grupo_color || '#2f80ed');
    }

    setPrev(curso.prev || '');

    if (!hasCurChanges) {
      setEditTecnico(curso.tecnico_carnet || '');
      setEditCiclo(curso.ciclo_id || '');
      const currentCiclo = ciclos.find((c) => c.id === curso.ciclo_id);
      setEditAreaFormativa(currentCiclo?.area_formativa || '');
      setEditFacilitador(curso.facilitador_carnet || '');
      setEditDistrito(curso.distrito || '');
      setEditLugar(curso.lugar || '');
      setEditArea(curso.area_urbano_rural || 'Urbano');
      setEditSegmento(curso.segmento || '');
      setEditFechaInicio(getInitialFechaInicio(curso));
      setEditMes(curso.mes || '');
      setEditCosto(curso.costo || 50);
      setEditGrupoNombre(curso.grupo_nombre || '');
      setEditNewGrupoNombre('');
    }
  }, [
    curso.id,
    curso.organizador_nombre,
    curso.organizador_telefono,
    curso.organizador_maps,
    curso.observaciones,
    curso.link_inscripcion_externo,
    curso.grupo_color,
    curso.prev,
    curso.tecnico_carnet,
    curso.ciclo_id,
    curso.facilitador_carnet,
    curso.distrito,
    curso.lugar,
    curso.area_urbano_rural,
    curso.segmento,
    curso.fecha_inicio,
    curso.mes,
    curso.costo,
    curso.grupo_nombre,
    ciclos,
    lastCursoId
  ]);

  useEffect(() => {
    const rawLocation = orgMaps || curso.lugar || '';
    if (!rawLocation.trim()) {
      setResolvedMapSrc('');
      return;
    }

    if (rawLocation.includes('maps.app.goo.gl') || rawLocation.includes('goo.gl/maps') || rawLocation.includes('goo.gl')) {
      fetch(`/api/maps/resolve?url=${encodeURIComponent(rawLocation)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.embedSrc) {
            setResolvedMapSrc(data.embedSrc);
          } else {
            setResolvedMapSrc(buildMapEmbedSrc(rawLocation));
          }
        })
        .catch((err) => {
          console.error('Error resolving map:', err);
          setResolvedMapSrc(buildMapEmbedSrc(rawLocation));
        });
    } else {
      setResolvedMapSrc(buildMapEmbedSrc(rawLocation));
    }
  }, [orgMaps, curso.lugar]);

  const hasOrganizerChanges =
    orgNombre !== (curso.organizador_nombre || '') ||
    orgTelefono !== (curso.organizador_telefono || '') ||
    orgMaps !== (curso.organizador_maps || '') ||
    observaciones !== (curso.observaciones || '') ||
    linkExterno !== (curso.link_inscripcion_externo || '') ||
    noteColor !== (curso.grupo_color || '#2f80ed');

  const cleanEditFecha = (editFechaInicio || '').replace('T', ' ').trim().substring(0, 16);
  const cleanCursoFecha = (curso.fecha_inicio || '').replace('T', ' ').trim().replace(/\s+/g, ' ').substring(0, 16);
  const hasCursoChanges =
    editTecnico !== (curso.tecnico_carnet || '') ||
    editCiclo !== (curso.ciclo_id || '') ||
    editFacilitador !== (curso.facilitador_carnet || '') ||
    editDistrito !== (curso.distrito || '') ||
    editLugar !== (curso.lugar || '') ||
    editArea !== (curso.area_urbano_rural || 'Urbano') ||
    editSegmento !== (curso.segmento || '') ||
    cleanEditFecha !== cleanCursoFecha ||
    editMes !== (curso.mes || '') ||
    editCosto !== (curso.costo || 50) ||
    editGrupoNombre !== (curso.grupo_nombre || '') ||
    editNewGrupoNombre.trim() !== '';

  const compliance = getNoteCompliance(curso);
  const isConfirmado = !!curso.facilitador_nombre && 
    curso.facilitador_nombre.trim() !== '' && 
    !/por confirmar/i.test(curso.facilitador_nombre);
  const count = curso.inscritos_formulario;
  const slots = curso.horarios_tentativos || [];
  const totalHours = getTotalHours(slots);
  const hoursByCourse = getHoursByCourse(slots);

  const mapLink = buildMapOpenLink(orgMaps || curso.lugar);

  // ─── First course date for calendar display ─────────────────
  const firstSlot = slots.length > 0
    ? slots.reduce((a, b) => (a.date < b.date ? a : b))
    : null;

  const handleAreaFormativaChange = (newArea: string) => {
    setEditAreaFormativa(newArea);
    const currentCicloObj = ciclos.find((c) => c.id === editCiclo);
    if (!newArea || currentCicloObj?.area_formativa !== newArea) {
      setEditCiclo('');
    }
  };

  const filteredCiclos = ciclos.filter((c) => c.area_formativa === editAreaFormativa);

  // ─── Save organizador ──────────────────────────────────────
  const handleSaveOrganizador = () => {
    onUpdate({
      observaciones,
      link_inscripcion_externo: linkExterno,
      grupo_color: noteColor,
      prev,
      organizador_nombre: orgNombre,
      organizador_telefono: orgTelefono,
      organizador_maps: orgMaps,
    });

    Swal.fire({
      icon: 'success',
      title: '¡Guardado con éxito!',
      text: 'Los datos del organizador se han actualizado correctamente.',
      confirmButtonText: 'Aceptar',
      confirmButtonColor: '#bfa05e',
      timer: 2500,
      timerProgressBar: true,
      showConfirmButton: true
    });
  };

  // ─── Save all course & organizer info in a single click ────
  const handleSaveAll = () => {
    const finalGrupoNombre = editNewGrupoNombre.trim() ? editNewGrupoNombre.trim() : editGrupoNombre;
    const finalTotalBs = curso.inscritos_formulario * editCosto;

    onUpdate({
      tecnico_carnet: editTecnico || null,
      ciclo_id: editCiclo || null,
      facilitador_carnet: editFacilitador || null,
      distrito: editDistrito,
      lugar: editLugar,
      area_urbano_rural: editArea,
      segmento: editSegmento,
      fecha_inicio: editFechaInicio ? editFechaInicio.replace('T', ' ') : '',
      mes: editMes,
      costo: editCosto,
      grupo_nombre: finalGrupoNombre,
      total_bs: finalTotalBs,
      observaciones,
      link_inscripcion_externo: linkExterno,
      grupo_color: noteColor,
      prev,
      organizador_nombre: orgNombre,
      organizador_telefono: orgTelefono,
      organizador_maps: orgMaps,
    });

    setEditNewGrupoNombre('');
    setEditGrupoNombre(finalGrupoNombre);

    Swal.fire({
      icon: 'success',
      title: '¡Guardado con éxito!',
      text: 'Los datos del curso y organizador se han actualizado correctamente.',
      confirmButtonText: 'Aceptar',
      confirmButtonColor: '#0284c7',
      timer: 2200,
      timerProgressBar: true,
      showConfirmButton: true
    });
  };

  // ─── Save curso info ───────────────────────────────────────
  const handleSaveCursoInfo = () => {
    const finalGrupoNombre = editNewGrupoNombre.trim() ? editNewGrupoNombre.trim() : editGrupoNombre;
    const finalTotalBs = curso.inscritos_formulario * editCosto;

    onUpdate({
      tecnico_carnet: editTecnico || null,
      ciclo_id: editCiclo || null,
      facilitador_carnet: editFacilitador || null,
      distrito: editDistrito,
      lugar: editLugar,
      area_urbano_rural: editArea,
      segmento: editSegmento,
      fecha_inicio: editFechaInicio ? editFechaInicio.replace('T', ' ') : '',
      mes: editMes,
      costo: editCosto,
      grupo_nombre: finalGrupoNombre,
      total_bs: finalTotalBs,
    });

    // Clear new group name state input and select final group name to prevent comparison lock
    setEditNewGrupoNombre('');
    setEditGrupoNombre(finalGrupoNombre);

    Swal.fire({
      icon: 'success',
      title: '¡Guardado con éxito!',
      text: 'Los datos del curso se han actualizado correctamente.',
      confirmButtonText: 'Aceptar',
      confirmButtonColor: '#0284c7',
      timer: 2500,
      timerProgressBar: true,
      showConfirmButton: true
    });
  };

  // ─── Save calendar slots ───────────────────────────────────
  const handleSaveSlots = useCallback((newSlots: HorarioSlot[]) => {
    onUpdate({ horarios_tentativos: newSlots });
  }, [onUpdate]);

  // ─── Save checks ───────────────────────────────────────────
  const handleToggleCheck = (field: 'planificacion_recibida' | 'evaluacion_realizada' | 'informe_final_recibido') => {
    onUpdate({ [field]: !curso[field] });
  };

  // ─── Print Ficha de Inscripción 2-up Letter (Blank template with official logos) ───
  const handlePrintFichaInscripcion = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      Swal.fire('Bloqueador', 'Habilita las ventanas flotantes para imprimir la ficha.', 'warning');
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

          <!-- 1. Table for Course Details -->
          <table class="data-table">
            <tr>
              <td class="lbl" width="18%">Area</td>
              <td class="val">${curso.area_formativa || curso.ciclo_grupo || ''}</td>
            </tr>
            <tr>
              <td class="lbl">Ciclo Formativo</td>
              <td class="val"><b>${curso.ciclo_nombre || ''}</b></td>
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

          <!-- 2. Personal Info Section -->
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

          <!-- 3. Form Selection Options (Checkboxes) -->
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

            <table class="check-table" style="margin-top: 4px;">
              <tr>
                <td width="55%">
                  <div class="field-line">
                    <span class="lbl-line">Especialidad:</span>
                    <span class="val-line"></span>
                  </div>
                </td>
                <td width="45%">
                  <div class="field-line">
                    <span class="lbl-line">Año de Formación:</span>
                    <span class="val-line"></span>
                  </div>
                </td>
              </tr>
            </table>

            <div class="check-row" style="margin-top: 4px;">
              <span class="lbl-check">Discapacidad:</span>
              <span class="chk-box-label">Auditiva <span class="chk"></span></span>
              <span class="chk-box-label">Visual <span class="chk"></span></span>
              <span class="chk-box-label">Otros <span class="chk"></span></span>
              <span style="border-bottom: 1px solid #444; width: 140px; display: inline-block; height: 12px; margin-left: 5px;"></span>
            </div>
          </div>

          <!-- 4. Footer & Signature -->
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
        <title>Ficha de Inscripción - ID ${curso.id}</title>
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
          
          /* Custom divider to guide cutting the sheet */
          .divider-line {
            border-top: 1.5px dashed #777;
            width: 100%;
            text-align: center;
            padding: 6px 0;
            font-size: 8pt;
            color: #555;
            box-sizing: border-box;
          }
          
          /* Table structures */
          table {
            width: 100%;
            border-collapse: collapse;
          }
          
          /* Header Logos styling */
          .header-table {
            margin-bottom: 6px;
            border-bottom: 1.5px solid #000;
            padding-bottom: 4px;
          }
          .logo-img {
            height: 44px;
            max-width: 100%;
            object-fit: contain;
            display: block;
          }
          .title-main {
            font-size: 13pt;
            font-weight: bold;
            letter-spacing: 0.5px;
            color: #000;
            line-height: 1.1;
          }
          .title-sub {
            font-size: 7.2pt;
            font-weight: bold;
            color: #333;
          }

          /* General Label / Values */
          .lbl {
            font-size: 7.8pt;
            font-weight: bold;
            color: #000;
          }
          .val {
            font-size: 8.2pt;
            color: #111;
          }

          /* Courses data table */
          .data-table {
            margin-bottom: 6px;
          }
          .data-table td {
            border: 1px solid #000;
            padding: 3px 5px;
            vertical-align: middle;
          }
          .data-table .lbl {
            background-color: #f2f2f2;
            text-align: right;
            padding-right: 8px;
          }
          
          /* Personal table */
          .personal-table {
            margin-bottom: 6px;
          }
          .personal-table td {
            border: 1px solid #000;
            padding: 3px 5px;
            vertical-align: middle;
          }
          .personal-table .lbl {
            background-color: #f2f2f2;
            text-align: right;
            padding-right: 6px;
          }

          /* Checkboxes */
          .checks-section {
            font-size: 7pt;
            line-height: 1.15;
            margin-bottom: 6px;
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
          }
          .check-row {
            margin-bottom: 4px;
            display: flex;
            flex-wrap: wrap;
            align-items: center;
          }
          .lbl-check {
            font-weight: bold;
            margin-right: 8px;
            width: 100px;
            display: inline-block;
          }
          .chk-box-label {
            margin-right: 10px;
            display: inline-flex;
            align-items: center;
            gap: 4px;
          }
          .chk {
            display: inline-block;
            width: 11px;
            height: 11px;
            border: 1.5px solid #000;
            text-align: center;
            font-size: 7pt;
            line-height: 11px;
            font-weight: bold;
            background: #fff;
          }

          .check-table {
            width: 100%;
          }
          .check-table td {
            padding: 0;
            vertical-align: middle;
          }
          .field-line {
            display: flex;
            align-items: flex-end;
            margin-bottom: 3px;
            width: 98%;
          }
          .lbl-line {
            font-weight: bold;
            margin-right: 6px;
            white-space: nowrap;
          }
          .val-line {
            border-bottom: 1px solid #444;
            flex: 1;
            padding-left: 5px;
            font-size: 8pt;
            font-weight: bold;
            height: 13px;
            line-height: 13px;
          }
          .check-vertical {
            display: flex;
            flex-direction: column;
            gap: 3px;
            align-items: flex-end;
          }

          /* Footer / Signatures */
          .footer-table {
            margin-top: auto;
            padding-top: 6px;
          }
          .signature-line {
            border-top: 1px solid #000;
            width: 80%;
            margin: 0 auto;
          }
          .signature-lbl {
            font-size: 8pt;
            font-weight: bold;
            margin-top: 2px;
          }
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

  // ─── Dates summary ─────────────────────────────────────────
  const courseDatesStr = slots
    .filter((s) => typeof s.course === 'number' || ['1', '2', '3', '4'].includes(String(s.course)))
    .map((s) => s.date)
    .sort();
  const dateRangeLabel = courseDatesStr.length > 0
    ? `${formatFechaDisplay(courseDatesStr[0])} - ${formatFechaDisplay(courseDatesStr[courseDatesStr.length - 1])}`
    : 'Sin fechas';

  return (
    <div
      className={`nota-card ${readOnly ? 'read-only-card' : ''}`}
      style={{
        '--nota-color': noteColor,
        animationDelay: `${animationDelay}s`,
      } as React.CSSProperties}
    >
      {/* ─── Head ────────────────────────────────────────── */}
      <div className="nota-head" style={{ background: noteColor }}>
        <div className="nota-head-left">
          <h3>{curso.grupo_nombre || 'Sin grupo'}</h3>
          <span className="nota-head-pill">
            <Calendar size={11} /> {curso.ciclo_nombre ? curso.ciclo_nombre.substring(0, 30) : curso.segmento || ''}
          </span>
        </div>
        <div className="nota-head-right">
          <div className="nota-count-wrapper" onClick={(e) => e.stopPropagation()}>
            <div className="nota-count-value">{count}</div>
            <div className="nota-count-label">INSCRITOS</div>
          </div>
          {!readOnly && (
            <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); onDuplicate(); }} title="Duplicar curso">
              <Copy size={13} />
            </button>
          )}
        </div>
      </div>

      {/* ─── Subbar ──────────────────────────────────────── */}
      <div className="nota-subbar">
        <span><Calendar size={13} /> Calendario y control del grupo</span>
        <span>{dateRangeLabel}</span>
      </div>

      {matchedParticipants && matchedParticipants.length > 0 && (
        <div style={{
          background: '#f0fdf4',
          borderLeft: '4px solid #22c55e',
          borderBottom: '1px solid #bbf7d0',
          padding: '8px 12px',
          fontSize: '0.82rem',
          color: '#166534',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <span style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Users size={12} /> Coincidencia de participante:
          </span>
          <ul style={{ margin: 0, paddingLeft: '16px', listStyleType: 'disc' }}>
            {matchedParticipants.map((name, i) => (
              <li key={i}>{name}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="nota-main-content">
        {/* ─── Columna 1: Datos del Curso, Ubicación y Organizador ─────────────────────────── */}
        <div className="nota-col-academic-and-org" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* Tarjeta 1: Datos Académicos y del Curso */}
          <div style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
            
            {/* Header del Bloque con ID y Estado */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px' }}>
                  ID: #{curso.id}
                </span>
                {curso.tecnico_nombre && (
                  <span style={{ fontSize: '0.80rem', fontWeight: 700, color: '#1e40af', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '3px 10px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <User size={13} /> {curso.tecnico_nombre}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  padding: '4px 10px',
                  borderRadius: '6px',
                  backgroundColor: isConfirmado ? '#ecfdf5' : '#fff7ed',
                  color: isConfirmado ? '#047857' : '#c2410c',
                  border: `1px solid ${isConfirmado ? '#a7f3d0' : '#ffedd5'}`,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  {isConfirmado ? '✓ Confirmado' : '⚡ Proyectado'}
                </span>
              </div>
            </div>

            {/* N° Preventivo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#475569', minWidth: '55px' }}>PREV:</span>
              {readOnly ? (
                <span style={{ fontSize: '0.90rem', fontWeight: 700, color: '#0f172a' }}>{prev || '—'}</span>
              ) : (
                <div style={{ display: 'flex', gap: '6px', flex: 1 }}>
                  <input
                    type="text"
                    value={prev}
                    onChange={(e) => setPrev(e.target.value)}
                    placeholder="N° preventivo..."
                    style={{ flex: 1, padding: '6px 10px', fontSize: '0.90rem', fontWeight: 600, border: '1px solid #cbd5e1', borderRadius: '6px', background: '#ffffff' }}
                  />
                  <button className="btn btn-success btn-xs" onClick={() => onUpdate({ prev })} title="Guardar Preventivo" style={{ padding: '6px 12px', fontWeight: 700 }}>
                    <Save size={13} />
                  </button>
                </div>
              )}
            </div>

            {/* Formulario de Campos Académicos en Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              
              {/* Grupo */}
              <div className="organizador-field">
                <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#334155' }}>Grupo</label>
                {readOnly ? (
                  <span style={{ fontSize: '0.90rem', fontWeight: 600 }}>{editGrupoNombre || '—'}</span>
                ) : (
                  <>
                    <select
                      value={editGrupoNombre}
                      onChange={(e) => setEditGrupoNombre(e.target.value)}
                      style={{ padding: '7px 10px', fontSize: '0.88rem', fontWeight: 600 }}
                    >
                      <option value="">Sin grupo</option>
                      {grupoNames.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={editNewGrupoNombre}
                      onChange={(e) => setEditNewGrupoNombre(e.target.value)}
                      placeholder="O nuevo grupo..."
                      style={{ marginTop: '4px', padding: '6px 10px', fontSize: '0.84rem' }}
                    />
                  </>
                )}
              </div>

              {/* Técnico */}
              <div className="organizador-field">
                <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#334155' }}>Técnico Asignado</label>
                {readOnly ? (
                  <span style={{ fontSize: '0.90rem', fontWeight: 600 }}>{curso.tecnico_nombre || '—'}</span>
                ) : (
                  <select
                    value={editTecnico}
                    onChange={(e) => setEditTecnico(e.target.value)}
                    style={{ padding: '7px 10px', fontSize: '0.88rem', fontWeight: 600 }}
                  >
                    <option value="">Seleccionar técnico</option>
                    {tecnicos.map((t) => (
                      <option key={t.carnet} value={t.carnet}>{t.nombre}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Área Formativa */}
              <div className="organizador-field" style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#334155' }}>Área Formativa</label>
                {readOnly ? (
                  <span style={{ fontSize: '0.90rem', fontWeight: 600 }}>{editAreaFormativa || '—'}</span>
                ) : (
                  <select
                    value={editAreaFormativa}
                    onChange={(e) => handleAreaFormativaChange(e.target.value)}
                    style={{ padding: '7px 10px', fontSize: '0.88rem', fontWeight: 600 }}
                  >
                    <option value="">Seleccionar área formativa</option>
                    {AREAS_FORMATIVAS.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Ciclo Formativo */}
              <div className="organizador-field" style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#334155' }}>Ciclo Formativo</label>
                {readOnly ? (
                  <span style={{ fontSize: '0.90rem', fontWeight: 700, color: '#1e40af' }}>{curso.ciclo_nombre || '—'}</span>
                ) : (
                  <select
                    value={editCiclo}
                    onChange={(e) => setEditCiclo(e.target.value)}
                    disabled={!editAreaFormativa}
                    style={{ padding: '7px 10px', fontSize: '0.88rem', fontWeight: 600 }}
                  >
                    <option value="">
                      {!editAreaFormativa ? 'Selecciona área formativa primero' : 'Seleccionar ciclo formativo'}
                    </option>
                    {filteredCiclos.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Facilitador */}
              <div className="organizador-field">
                <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#334155' }}>Facilitador</label>
                {readOnly ? (
                  <span style={{ fontSize: '0.90rem', fontWeight: 600 }}>{curso.facilitador_nombre || '—'}</span>
                ) : (
                  <select
                    value={editFacilitador}
                    onChange={(e) => setEditFacilitador(e.target.value)}
                    style={{ padding: '7px 10px', fontSize: '0.88rem', fontWeight: 600 }}
                  >
                    <option value="">Seleccionar facilitador</option>
                    {facilitadores.map((f) => (
                      <option key={f.carnet} value={f.carnet}>{f.nombre}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Segmento */}
              <div className="organizador-field">
                <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#334155' }}>Segmento</label>
                {readOnly ? (
                  <span style={{ fontSize: '0.90rem', fontWeight: 600 }}>{editSegmento || '—'}</span>
                ) : (
                  <select
                    value={editSegmento}
                    onChange={(e) => setEditSegmento(e.target.value)}
                    style={{ padding: '7px 10px', fontSize: '0.88rem', fontWeight: 600 }}
                  >
                    <option value="">Selecciona segmento</option>
                    {SEGMENTO_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                    {editSegmento && !SEGMENTO_OPTIONS.includes(editSegmento) && (
                      <option value={editSegmento}>{editSegmento}</option>
                    )}
                  </select>
                )}
              </div>

              {/* Fecha Inicio */}
              <div className="organizador-field" style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#334155' }}>Fecha y Hora de Inicio</label>
                {readOnly ? (
                  <span style={{ fontSize: '0.90rem', fontWeight: 600 }}>{editFechaInicio ? editFechaInicio.replace('T', ' ') : '—'}</span>
                ) : (
                  <input
                    type="datetime-local"
                    value={editFechaInicio}
                    onChange={(e) => setEditFechaInicio(e.target.value)}
                    style={{ padding: '7px 10px', fontSize: '0.88rem', fontWeight: 600 }}
                  />
                )}
              </div>

            </div>
          </div>

          {/* Tarjeta 2: Ubicación, Costos y Datos del Organizador */}
          <div style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
            
            {/* Ubicación y Costo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.92rem', fontWeight: 900, color: '#0f172a', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
              <MapPin size={16} style={{ color: '#0284c7' }} /> Ubicación, Distrito y Costo
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <div className="organizador-field">
                <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#334155' }}>Distrito</label>
                {readOnly ? (
                  <span style={{ fontSize: '0.90rem', fontWeight: 600 }}>{editDistrito || '—'}</span>
                ) : (
                  <select
                    value={editDistrito}
                    onChange={(e) => setEditDistrito(e.target.value)}
                    style={{ padding: '7px 10px', fontSize: '0.88rem', fontWeight: 600 }}
                  >
                    {distritosData.map((d, index) => {
                      const val = index === 0 ? "" : d[1];
                      return <option key={index} value={val}>{d[1]}</option>;
                    })}
                    {editDistrito && !distritosData.some((d) => d[1] === editDistrito) && (
                      <option value={editDistrito}>{editDistrito}</option>
                    )}
                  </select>
                )}
              </div>

              <div className="organizador-field">
                <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#334155' }}>Área</label>
                {readOnly ? (
                  <span style={{ fontSize: '0.90rem', fontWeight: 600 }}>{editArea}</span>
                ) : (
                  <select
                    value={editArea}
                    onChange={(e) => setEditArea(e.target.value)}
                    style={{ padding: '7px 10px', fontSize: '0.88rem', fontWeight: 600 }}
                  >
                    <option value="Urbano">Urbano</option>
                    <option value="Rural">Rural</option>
                  </select>
                )}
              </div>

              <div className="organizador-field" style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#334155' }}>Lugar / Sede</label>
                {readOnly ? (
                  <span style={{ fontSize: '0.90rem', fontWeight: 600 }}>{editLugar || '—'}</span>
                ) : (
                  <input
                    type="text"
                    value={editLugar}
                    onChange={(e) => setEditLugar(e.target.value)}
                    placeholder="U.E. o lugar de ejecución..."
                    style={{ padding: '7px 10px', fontSize: '0.88rem', fontWeight: 600 }}
                  />
                )}
              </div>

              <div className="organizador-field">
                <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#334155' }}>Mes</label>
                {readOnly ? (
                  <span style={{ fontSize: '0.90rem', fontWeight: 600 }}>{editMes || '—'}</span>
                ) : (
                  <select
                    value={editMes ? editMes.toUpperCase() : ''}
                    onChange={(e) => setEditMes(e.target.value)}
                    style={{ padding: '7px 10px', fontSize: '0.88rem', fontWeight: 600 }}
                  >
                    <option value="">Seleccionar mes</option>
                    {['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'].map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="organizador-field">
                <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#334155' }}>Costo x Maestro (Bs)</label>
                {readOnly ? (
                  <span style={{ fontSize: '0.90rem', fontWeight: 700 }}>{editCosto} Bs</span>
                ) : (
                  <input
                    type="number"
                    value={editCosto}
                    onChange={(e) => setEditCosto(parseFloat(e.target.value) || 0)}
                    style={{ padding: '7px 10px', fontSize: '0.88rem', fontWeight: 700 }}
                  />
                )}
              </div>
            </div>

            {/* Datos del Organizador */}
            {!readOnly && (
              <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.90rem', fontWeight: 900, color: '#0f172a' }}>
                  <Users size={16} style={{ color: '#059669' }} /> Datos del Organizador
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                  <div className="organizador-field">
                    <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#334155' }}>Organizador</label>
                    <input
                      type="text"
                      value={orgNombre}
                      onChange={(e) => setOrgNombre(e.target.value)}
                      placeholder="Nombre del organizador..."
                      style={{ padding: '7px 10px', fontSize: '0.88rem', fontWeight: 600 }}
                    />
                  </div>

                  <div className="organizador-field">
                    <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#334155' }}>Celular / WhatsApp</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        type="text"
                        value={orgTelefono}
                        onChange={(e) => setOrgTelefono(e.target.value)}
                        placeholder="Número de celular..."
                        style={{ flex: 1, padding: '7px 10px', fontSize: '0.88rem', fontWeight: 600 }}
                      />
                      {orgTelefono && (
                        <a
                          href={`https://wa.me/591${orgTelefono.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-success btn-xs"
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0 10px', fontWeight: 700 }}
                        >
                          <MessageCircle size={13} /> WA
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="organizador-field" style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#334155' }}>Grupo de WhatsApp</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        type="text"
                        value={orgMaps}
                        onChange={(e) => {
                          setOrgMaps(e.target.value);
                          if (!linkExterno) setLinkExterno(e.target.value);
                        }}
                        placeholder="https://chat.whatsapp.com/..."
                        style={{ flex: 1, padding: '7px 10px', fontSize: '0.88rem' }}
                      />
                      {orgMaps && (
                        <a
                          href={orgMaps.startsWith('http') ? orgMaps : `https://${orgMaps}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-success btn-xs"
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0 10px', fontWeight: 700 }}
                        >
                          <ExternalLink size={13} /> Abrir
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="organizador-field" style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#334155' }}>Observaciones</label>
                    <textarea
                      value={observaciones}
                      onChange={(e) => setObservaciones(e.target.value)}
                      placeholder="Detalles importantes, pendientes o acuerdos..."
                      rows={2}
                      style={{ padding: '7px 10px', fontSize: '0.88rem' }}
                    />
                  </div>

                  <div className="organizador-field" style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#334155' }}>Color del Grupo</label>
                    <div className="color-swatches">
                      {GROUP_COLORS.map((c) => (
                        <button
                          key={c}
                          className={`color-swatch ${noteColor === c ? 'active' : ''}`}
                          style={{ background: c, width: '26px', height: '26px', borderRadius: '50%' }}
                          onClick={() => setNoteColor(c)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Botón de Guardado Completo del Bloque Izquierdo */}
            {!readOnly && (
              <div style={{ marginTop: '8px' }}>
                <button
                  type="button"
                  className={`btn ${hasCursoChanges || hasOrganizerChanges ? 'btn-danger pulse-danger-btn' : 'btn-success'}`}
                  style={{
                    width: '100%',
                    fontWeight: 900,
                    fontSize: '0.95rem',
                    padding: '12px 18px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: hasCursoChanges || hasOrganizerChanges ? '0 4px 14px rgba(220, 38, 38, 0.35)' : '0 2px 8px rgba(16, 185, 129, 0.25)',
                    cursor: 'pointer',
                    letterSpacing: '0.3px'
                  }}
                  onClick={handleSaveAll}
                >
                  <Save size={18} />
                  {hasCursoChanges || hasOrganizerChanges ? '⚠️ GUARDAR TODOS LOS CAMBIOS' : 'GUARDAR DATOS DEL CURSO'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ─── Columna 2: Cronograma de Sesiones & Centro de Acciones ─────────────────────────── */}
        <div className="nota-col-schedule-and-actions" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* Tarjeta 1: Calendario y Sesiones de Horarios */}
          <div style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.92rem', fontWeight: 900, color: '#0f172a' }}>
                <Clock size={16} style={{ color: '#0284c7' }} /> Programación de Sesiones
              </div>
              <span style={{ fontSize: '0.80rem', fontWeight: 800, background: '#e0f2fe', color: '#0369a1', padding: '3px 10px', borderRadius: '12px' }}>
                {totalHours}h acumuladas
              </span>
            </div>

            <MiniMonthCalendar
              slots={slots}
              onSaveSlots={handleSaveSlots}
              noteColor={noteColor}
              initialDate={firstSlot ? new Date(firstSlot.date) : undefined}
              compliance={compliance}
              planificacionRecibida={curso.planificacion_recibida}
              evaluacionRealizada={curso.evaluacion_realizada}
              informeFinalRecibido={curso.informe_final_recibido}
              onToggleCheck={handleToggleCheck}
              readOnly={readOnly}
            />
          </div>

          {/* Tarjeta 2: Centro de Control y Acciones */}
          {!readOnly && (
            <div style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.92rem', fontWeight: 900, color: '#0f172a', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                <Wrench size={16} style={{ color: '#0284c7' }} /> Centro de Control del Curso
              </div>

              {/* Botón Héroe Primario: PARTICIPANTES */}
              <button
                type="button"
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '14px 20px',
                  fontSize: '1.05rem',
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
                  cursor: 'pointer',
                  letterSpacing: '0.5px'
                }}
                onClick={() => onManageParticipantes(curso)}
              >
                <Users size={22} /> PARTICIPANTES ({count})
              </button>

              {/* Grid 2x2 de Acciones Secundarias */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                
                {/* Inscripción Online */}
                <button
                  type="button"
                  className="btn btn-whatsapp"
                  style={{ padding: '10px 14px', fontSize: '0.88rem', fontWeight: 800, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  onClick={() => setShowInscripcionModal(true)}
                >
                  <Globe size={15} /> Insc. Online
                </button>

                {/* Copiar Link Público */}
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ padding: '10px 14px', fontSize: '0.88rem', fontWeight: 800, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  onClick={() => {
                    const link = `${window.location.origin}/participantes/${curso.id}`;
                    navigator.clipboard.writeText(link);
                    Swal.fire({
                      icon: 'success',
                      title: 'Enlace copiado',
                      text: 'El enlace de inscripción para los participantes fue copiado al portapapeles.',
                      timer: 2200,
                      showConfirmButton: false,
                      toast: true,
                      position: 'top-end'
                    });
                  }}
                >
                  <Link2 size={15} /> Link Público
                </button>

                {/* Ficha Inscripción */}
                <button
                  type="button"
                  className="btn btn-purple"
                  style={{ padding: '10px 14px', fontSize: '0.88rem', fontWeight: 800, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  onClick={handlePrintFichaInscripcion}
                >
                  <FileText size={15} /> Ficha Inscripción
                </button>

                {/* Registro Pedagógico */}
                <button
                  type="button"
                  className="btn btn-orange"
                  style={{ padding: '10px 14px', fontSize: '0.88rem', fontWeight: 800, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <BookOpen size={15} /> Registro Pedg
                </button>
              </div>

              {/* Barra Inferior: Estado del Formulario y Eliminar */}
              <div style={{ display: 'flex', gap: '10px', paddingTop: '6px' }}>
                <button
                  type="button"
                  className={`btn ${curso.form_habilitado !== false ? 'btn-dark' : 'btn-secondary'}`}
                  style={{ flex: 1, padding: '9px 12px', fontSize: '0.84rem', fontWeight: 700, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  onClick={() => onUpdate({ form_habilitado: !(curso.form_habilitado !== false) })}
                >
                  <ToggleLeft size={16} style={{ transform: curso.form_habilitado !== false ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} /> Formulario: {curso.form_habilitado !== false ? 'HABILITADO' : 'CERRADO'}
                </button>

                <button
                  type="button"
                  className="btn btn-danger"
                  style={{ padding: '9px 16px', fontSize: '0.84rem', fontWeight: 800, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  onClick={onDelete}
                  title="Eliminar este curso"
                >
                  <Trash2 size={15} /> Eliminar
                </button>
              </div>

            </div>
          )}

        </div>
      </div> {/* Closing nota-main-content */}

      {showInscripcionModal && (
        <InscripcionOnlineModal
          curso={curso}
          onClose={() => setShowInscripcionModal(false)}
        />
      )}
    </div>
  );
}
