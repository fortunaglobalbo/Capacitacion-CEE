'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Curso, Grupo, AppFilters, DEFAULT_FILTERS, MESES, Tecnico, Facilitador, CicloFormativo, AgendaContacto } from '@/types';
import { getNoteCompliance, getReviewCount } from '@/lib/utils/compliance';
import { supabase } from '@/lib/supabase/client';
import { Sparkles, Search, Filter, RefreshCw, Plus, LayoutGrid, CalendarDays, ChevronDown, AlertTriangle, BookOpen, Contact, Users, ZoomIn, ZoomOut, LogOut, Shield, Eye, Hash, User, Download, X, FileText } from 'lucide-react';
import { exportAreaView } from '@/lib/utils/excelExport';
import GrupoCard from '@/components/cursos/GrupoCard';
import CursoForm from '@/components/cursos/CursoForm';
import AgendaCard from '@/components/agenda/AgendaCard';
import AgendaForm from '@/components/agenda/AgendaForm';
import ParticipantesModal from '@/components/participantes/ParticipantesModal';
import ReporteDiarioModal from '@/components/reporte/ReporteDiarioModal';
import { GuiaPasosSubtab } from '@/components/guia/GuiaPasosSubtab';
import { AuthProvider, useAuth } from '@/lib/auth/AuthContext';
import LoginPage from '@/components/auth/LoginPage';
import ChangePasswordPage from '@/components/auth/ChangePasswordPage';
import CiclosProximos from '@/components/supervisor/CiclosProximos';
import MonitoreoTecnicos from '@/components/supervisor/MonitoreoTecnicos';
import Swal from 'sweetalert2';

export default function PageWrapper() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

function AuthGate() {
  const { isLoggedIn, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div suppressHydrationWarning style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f172a' }}>
        <div className="login-spinner" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  if (!isLoggedIn) {
    return <LoginPage />;
  }

  if (user?.requiere_cambio_clave) {
    return <ChangePasswordPage />;
  }

  return <HomePage />;
}

function HomePage() {
  const { user, isSupervisor, logout } = useAuth();
  const readOnly = isSupervisor;
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [facilitadores, setFacilitadores] = useState<Facilitador[]>([]);
  const [ciclos, setCiclos] = useState<CicloFormativo[]>([]);
  const agenda = useMemo<AgendaContacto[]>(() => {
    const map = new Map<string, AgendaContacto>();
    cursos.forEach((c) => {
      if (c.organizador_nombre && c.organizador_nombre.trim().length > 0) {
        const key = c.organizador_nombre.trim().toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            id_contacto: `ORG-${c.id}`,
            nombre: c.organizador_nombre,
            telefono: c.organizador_telefono || '',
            lugar: c.organizador_lugar || c.lugar || '',
            link_maps: c.organizador_maps || '',
            descripcion: c.organizador_descripcion || '',
            estado_semaforo: c.organizador_semaforo || 'Atendido',
            color: c.organizador_color || '#3b82f6',
            tecnico_carnet: c.tecnico_carnet || '',
          });
        }
      }
    });
    return Array.from(map.values());
  }, [cursos]);
  const [matchingCursoIds, setMatchingCursoIds] = useState<Set<string>>(new Set());
  const [matchedParticipantsMap, setMatchedParticipantsMap] = useState<{[cursoId: string]: string[]}>({});
  const [searchLoading, setSearchLoading] = useState(false);
  const [cursoReviewData, setCursoReviewData] = useState<{[cursoId: string]: { validados: number; pendientesSie: number; pagados: number; pendientesPago: number; total: number }}>({});
  const [filters, setFilters] = useState<AppFilters>(DEFAULT_FILTERS);
  const [viewMode, setViewMode] = useState<'cursos' | 'agenda' | 'guia'>('cursos');
  const [loading, setLoading] = useState(true);
  const [selectedView, setSelectedView] = useState<'grupal' | 'area' | 'estados'>('grupal');

  // --- Dynamic Participant Search ---
  useEffect(() => {
    let active = true;
    
    const doSearch = async () => {
      const q = (filters.busqueda || '').trim().toLowerCase();
      if (!q || q.length < 2) {
        setMatchingCursoIds(new Set());
        setMatchedParticipantsMap({});
        return;
      }

      setSearchLoading(true);
      try {
        const words = q.split(/\s+/).filter(w => w.length >= 2);
        if (words.length === 0) {
          words.push(q);
        }

        const firstWord = words[0];
        const { data: parts, error: partErr } = await supabase
          .from('participantes')
          .select('ci, nombres, apellidos, rda')
          .or(`nombres.ilike.%${firstWord}%,apellidos.ilike.%${firstWord}%,ci.ilike.%${firstWord}%,rda.ilike.%${firstWord}%`)
          .limit(300);

        if (partErr) throw partErr;
        if (!parts || parts.length === 0) {
          if (active) {
            setMatchingCursoIds(new Set());
            setMatchedParticipantsMap({});
          }
          return;
        }

        const matchedParts = parts.filter(p => {
          const fullName = `${p.nombres || ''} ${p.apellidos || ''}`.toLowerCase();
          const ci = (p.ci || '').toLowerCase();
          const rda = (p.rda || '').toLowerCase();
          return words.every(word => fullName.includes(word) || ci.includes(word) || rda.includes(word));
        });

        if (matchedParts.length === 0) {
          if (active) {
            setMatchingCursoIds(new Set());
            setMatchedParticipantsMap({});
          }
          return;
        }

        const matchedCis = matchedParts.map(p => p.ci);
        const { data: enrolls, error: enrollErr } = await supabase
          .from('inscripcion_ciclo')
          .select('curso_id, participante_ci, participantes(nombres, apellidos, rda)')
          .in('participante_ci', matchedCis);

        if (enrollErr) throw enrollErr;

        if (active) {
          const ids = new Set<string>();
          const pMap: {[cursoId: string]: string[]} = {};

          (enrolls || []).forEach((e: any) => {
            if (!e.participantes) return;
            ids.add(e.curso_id);
            
            const fullName = `${e.participantes.nombres} ${e.participantes.apellidos}`.trim();
            const ci = e.participante_ci || '';
            const rda = e.participantes.rda || '';
            
            if (!pMap[e.curso_id]) {
              pMap[e.curso_id] = [];
            }
            pMap[e.curso_id].push(`${fullName} (C.I. ${ci}${rda ? `, RDA ${rda}` : ''})`);
          });

          setMatchingCursoIds(ids);
          setMatchedParticipantsMap(pMap);
        }
      } catch (err) {
        console.error('Error during participant search:', err);
      } finally {
        if (active) {
          setSearchLoading(false);
        }
      }
    };

    const timer = setTimeout(() => {
      doSearch();
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [filters.busqueda]);


  const [fontSize, setFontSize] = useState<number>(13);

  // Initialize and apply font size adjustment
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('font-size');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 10 && parsed <= 20) {
          setFontSize(parsed);
          document.documentElement.style.setProperty('--base-font-size', parsed + 'px');
        }
      }
    }
  }, []);

  // Establecer el mes actual como filtro por defecto al ingresar
  useEffect(() => {
    const currentMonthIdx = new Date().getMonth();
    const currentMonthName = MESES[currentMonthIdx] || '';
    setFilters(prev => ({
      ...prev,
      mes: currentMonthName
    }));
  }, []);

  const handleClearFilters = useCallback(() => {
    const currentMonthIdx = new Date().getMonth();
    const currentMonthName = MESES[currentMonthIdx] || '';
    setFilters({
      ...DEFAULT_FILTERS,
      mes: currentMonthName
    });
  }, []);

  const handleFontSizeChange = (newSize: number) => {
    if (newSize >= 10 && newSize <= 20) {
      setFontSize(newSize);
      document.documentElement.style.setProperty('--base-font-size', newSize + 'px');
      localStorage.setItem('font-size', newSize.toString());
    }
  };
  
  const [showForm, setShowForm] = useState(false);
  const [editingCurso, setEditingCurso] = useState<Curso | null>(null);

  const [showAgendaForm, setShowAgendaForm] = useState(false);
  const [editingContacto, setEditingContacto] = useState<AgendaContacto | null>(null);

  const [activeCursoParticipantes, setActiveCursoParticipantes] = useState<Curso | null>(null);
  const [showReporteDiarioModal, setShowReporteDiarioModal] = useState(false);
  const [customGrupoOrder, setCustomGrupoOrder] = useState<string[]>([]);
  const [expandedGrupo, setExpandedGrupo] = useState<string | null>(null);
  const [expandedArea, setExpandedArea] = useState<string | null>(null);
  const [expandedStatus, setExpandedStatus] = useState<string | null>(null);
  const [expandedCycleId, setExpandedCycleId] = useState<string | null>(null);

  // Collapse inner cycle when view, active area, or active status changes
  useEffect(() => {
    setExpandedCycleId(null);
  }, [selectedView, expandedArea, expandedStatus]);

  // Collapse all groups when grouping or technician filter changes
  useEffect(() => {
    setExpandedGrupo(null);
  }, [filters.agruparPor, filters.tecnico]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('grupo_orden');
      if (stored) {
        try {
          setCustomGrupoOrder(JSON.parse(stored));
        } catch (e) {
          console.error('Failed to parse group_orden from localStorage', e);
        }
      }
    }
  }, []);

  const currentModalCurso = useMemo(() => {
    if (!activeCursoParticipantes) return null;
    return cursos.find((c) => c.id === activeCursoParticipantes.id) || activeCursoParticipantes;
  }, [cursos, activeCursoParticipantes]);

  // ─── Load data ──────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const safeFetch = async (fn: () => PromiseLike<any>) => {
        try {
          return await fn();
        } catch {
          return { data: null };
        }
      };

      const [tecRes, facRes, cicRes] = await Promise.all([
        safeFetch(() => supabase.from('tecnicos').select('*').order('nombre')),
        safeFetch(() => supabase.from('facilitadores').select('*').order('nombre')),
        safeFetch(() => supabase.from('ciclos_formativos').select('*').order('grupo, nombre')),
      ]);

      const tecnicosData = (tecRes.data as Tecnico[]) || [];
      const facilitadoresData = (facRes.data as Facilitador[]) || [];
      const ciclosData = (cicRes.data as CicloFormativo[]) || [];

      if (tecRes.data) setTecnicos(tecnicosData);
      if (facRes.data) setFacilitadores(facilitadoresData);
      if (cicRes.data) setCiclos(ciclosData);

      // Map lookup helpers for fallback enrichment
      const tecMap = new Map(tecnicosData.map((t) => [t.carnet, t.nombre]));
      const facMap = new Map(facilitadoresData.map((f) => [f.carnet, f.nombre]));
      const cicMap = new Map(ciclosData.map((c) => [c.id, c]));

      let cursosRaw: any[] | null = null;
      
      // Try querying view first
      const cursosViewRes = await supabase
        .from('cursos_enriquecidos')
        .select('*, inscripcion_ciclo(count)')
        .order('created_at', { ascending: false })
        .order('id', { ascending: true });

      if (cursosViewRes.data && !cursosViewRes.error) {
        cursosRaw = cursosViewRes.data;
      } else {
        // Fallback to table 'cursos' if view doesn't exist
        const cursosBaseRes = await supabase
          .from('cursos')
          .select('*, inscripcion_ciclo(count)')
          .order('created_at', { ascending: false })
          .order('id', { ascending: true });

        if (cursosBaseRes.data) {
          cursosRaw = cursosBaseRes.data.map((c: any) => {
            const cf = cicMap.get(c.ciclo_id) || ({} as any);
            return {
              ...c,
              tecnico_nombre: c.tecnico_nombre || tecMap.get(c.tecnico_carnet) || null,
              facilitador_nombre: c.facilitador_nombre || facMap.get(c.facilitador_carnet) || null,
              ciclo_nombre: c.ciclo_nombre || cf.nombre || null,
              ciclo_grupo: c.ciclo_grupo || cf.grupo || null,
              area_formativa: c.area_formativa || cf.area_formativa || null,
              tema1: c.tema1 || cf.tema1 || null,
              tema2: c.tema2 || cf.tema2 || null,
              tema3: c.tema3 || cf.tema3 || null,
              tema4: c.tema4 || cf.tema4 || null,
            };
          });
        }
      }

      if (cursosRaw) {
        const mapped = cursosRaw.map((c) => {
          const countVal = c.inscripcion_ciclo?.[0]?.count ?? 0;
          return {
            ...c,
            inscritos_formulario: countVal,
          };
        });
        setCursos(mapped as Curso[]);
      }

      // Load review data (validation + payment stats per course)
      try {
        const { data: reviewRaw, error: reviewErr } = await supabase
          .from('inscripcion_ciclo')
          .select('curso_id, pagos, participantes(validado)');
        if (!reviewErr && reviewRaw) {
          const reviewMap: {[cursoId: string]: { validados: number; pendientesSie: number; pagados: number; pendientesPago: number; total: number }} = {};
          (reviewRaw as any[]).forEach((row) => {
            const cid = row.curso_id;
            if (!reviewMap[cid]) {
              reviewMap[cid] = { validados: 0, pendientesSie: 0, pagados: 0, pendientesPago: 0, total: 0 };
            }
            reviewMap[cid].total++;
            const isValidado = row.participantes?.validado === true;
            if (isValidado) {
              reviewMap[cid].validados++;
            } else {
              reviewMap[cid].pendientesSie++;
            }
            if (row.pagos === 'Pagado') {
              reviewMap[cid].pagados++;
            } else {
              reviewMap[cid].pendientesPago++;
            }
          });
          setCursoReviewData(reviewMap);
        }
      } catch (reviewLoadErr) {
        console.error('Error loading review data:', reviewLoadErr);
      }
    } catch (err) {
      console.error('Error loading data:', err);
      Swal.fire('Error', 'No se pudieron cargar los datos', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Set técnico filter for técnico users ────────────────
  useEffect(() => {
    if (user && user.rol === 'tecnico' && tecnicos.length > 0 && filters.tecnico === '') {
      const match = tecnicos.find((t) => t.carnet === user.username);
      if (match) {
        setFilters((prev) => ({ ...prev, tecnico: match.carnet }));
      }
    }
  }, [user, tecnicos]);

  // ─── Filter Logic ───────────────────────────────────────────
  const filteredCursos = useMemo(() => {
    let result = [...cursos];

    // Búsqueda
    if (filters.busqueda) {
      const q = filters.busqueda.toLowerCase();

      result = result.filter((c) =>
        c.id.toLowerCase().includes(q) ||
        (c.grupo_nombre || '').toLowerCase().includes(q) ||
        (c.lugar || '').toLowerCase().includes(q) ||
        (c.distrito || '').toLowerCase().includes(q) ||
        (c.facilitador_nombre || '').toLowerCase().includes(q) ||
        (c.tecnico_nombre || '').toLowerCase().includes(q) ||
        (c.ciclo_nombre || '').toLowerCase().includes(q) ||
        (c.prev || '').toLowerCase().includes(q) ||
        (c.organizador_nombre || '').toLowerCase().includes(q) ||
        matchingCursoIds.has(c.id)
      );
    }

    // Preventivo
    if (filters.preventivo) {
      result = result.filter((c) => (c.prev || '').includes(filters.preventivo));
    }

    // Mes
    if (filters.mes) {
      result = result.filter((c) => (c.mes || '').toUpperCase() === filters.mes.toUpperCase());
    }

    // Técnico
    if (filters.tecnico) {
      result = result.filter((c) => c.tecnico_carnet === filters.tecnico);
    }

    // Grupo
    if (filters.grupo !== 'todos') {
      result = result.filter((c) => c.grupo_nombre === filters.grupo);
    }

    // Alerta
    if (filters.alerta !== 'todas') {
      result = result.filter((c) => {
        const alerts = getNoteCompliance(c);
        return alerts.some((a) => a.type === filters.alerta);
      });
    }

    // Notas Revisadas filter
    if (filters.notasRevisadas !== 'todos') {
      result = result.filter((c) => {
        const rd = cursoReviewData[c.id];
        if (!rd || rd.total === 0) {
          // Courses with no participants: hide for specific filters
          return false;
        }
        switch (filters.notasRevisadas) {
          case 'sie-validado':
            return rd.validados > 0;
          case 'sie-pendiente':
            return rd.pendientesSie > 0;
          case 'pago-pendiente':
            return rd.pendientesPago > 0;
          case 'pago-pagado':
            return rd.pagados > 0;
          case 'validados-pagados':
            return rd.validados > 0 && rd.pagados > 0 && rd.pendientesSie === 0 && rd.pendientesPago === 0;
          default:
            return true;
        }
      });
    }

    // Default sort: most recently created first
    result.sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));

    return result;
  }, [cursos, filters, matchingCursoIds, cursoReviewData]);

  const selectedTecnicoObj = useMemo(() => {
    return tecnicos.find((t) => t.carnet === filters.tecnico);
  }, [tecnicos, filters.tecnico]);



  interface TecnicoGroup {
    tecnicoNombre: string;
    tecnicoCarnet: string;
    distritos: Grupo[];
  }

  const tecnicoGroups = useMemo<TecnicoGroup[]>(() => {
    if (filters.agruparPor !== 'distrito' || filters.tecnico !== "") {
      return [];
    }

    const techMap = new Map<string, { nombre: string; courses: Curso[] }>();
    filteredCursos.forEach((c) => {
      const tKey = c.tecnico_carnet || 'sin-tecnico';
      const tNombre = c.tecnico_nombre || 'Sin técnico asignado';
      if (!techMap.has(tKey)) {
        techMap.set(tKey, { nombre: tNombre, courses: [] });
      }
      techMap.get(tKey)!.courses.push(c);
    });

    const result: TecnicoGroup[] = [];
    techMap.forEach((val, key) => {
      // Group their courses by district
      const distMap = new Map<string, Grupo>();
      val.courses.forEach((c) => {
        const dKey = c.distrito || 'Sin distrito';
        if (!distMap.has(dKey)) {
          distMap.set(dKey, { nombre: dKey, color: '#2e9f5e', cursos: [] });
        }
        distMap.get(dKey)!.cursos.push(c);
      });

      result.push({
        tecnicoCarnet: key,
        tecnicoNombre: val.nombre,
        distritos: Array.from(distMap.values()).sort((a, b) => a.nombre.localeCompare(b.nombre))
      });
    });

    return result.sort((a, b) => a.tecnicoNombre.localeCompare(b.tecnicoNombre));
  }, [filteredCursos, filters.agruparPor, filters.tecnico]);
 
  const areaGroups = useMemo<Grupo[]>(() => {
    if (selectedView !== 'area') return [];
    const map = new Map<string, Grupo>();

    filteredCursos.forEach((c) => {
      const key = c.area_formativa || 'Sin Área';
      let color = '#bfa05e';
      if (key === 'TACFI') color = '#dc2626';
      else if (key === 'TIC') color = '#eab308';
      else if (key === 'GENERAL') color = '#2563eb';
      else if (key === 'INCLUSIVA') color = '#10b981';
      else if (key === 'LENGUAS') color = '#8b5cf6';
      
      if (!map.has(key)) {
        map.set(key, { nombre: key, color, cursos: [] });
      }
      map.get(key)!.cursos.push(c);
    });

    const getAreaPriority = (areaName: string): number => {
      const normalized = areaName
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .trim()
        .replace(/\s+/g, ' ');

      const priorityOrder = [
        "PARA TODOS LOS ACTORES DEL SEP",
        "EDUCACION REGULAR",
        "EDUCACION INICIAL EN FAMILIA COMUNITARIA",
        "EDUCACION PRIMARIA COMUNITARIA VOCACIONAL",
        "EDUCACION SECUNDARIA COMUNITARIA PRODUCTIVA",
        "EDUCACION ALTERNATIVA Y ESPECIAL",
        "EDUCACION ALTERNATIVA",
        "EDUCACION ESPECIAL",
        "EDUCACION SUPERIOR DE FORMACION PROFESIONAL",
        "DOCENTES DE INSTITUTOS TECNICOS TECNOLOGICOS",
        "TACFI"
      ];

      const idx = priorityOrder.indexOf(normalized);
      return idx !== -1 ? idx : 999;
    };

    const getCyclePriority = (cycleName: string): number => {
      const normalized = (cycleName || '')
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .trim()
        .replace(/\s+/g, ' ');

      const priorityOrder = [
        // PARA TODOS LOS ACTORES DEL SEP
        "OFIMATICA BASICA PARA LA GESTION Y PLANIFICACION EDUCATIVA",
        "GAMIFICACION E INNOVACION CON INTELIGENCIA ARTIFICIAL",
        "PREVENCION, DETECCION, ACTUACION Y DERIVACION DE LA VIOLENCIA EN EL AMBITO EDUCATIVO",
        "EDUCACION INTEGRAL EN SEXUALIDAD",
        "ADAPTACIONES CURRICULARES E INCLUSION EDUCATIVA DESDE EL DISENO UNIVERSAL PARA EL APRENDIZAJE",
        "LENGUA DE SENAS BOLIVIANA PARA MAESTRAS, MAESTROS Y OTROS ACTORES DEL SEP",
        // EDUCACION INICIAL EN FAMILIA COMUNITARIA
        "ESTIMULACION OPORTUNA Y DETECCION DEL DESARROLLO EN EDUCACION INICIAL",
        "DESARROLLO DE HABILIDADES PREVIAS A LA LECTURA Y ESCRITURA EN EDUCACION INICIAL",
        "DINAMIZANDO LA EDUCACION INICIAL EN FAMILIA COMUNITARIA NO ESCOLARIZADA",
        // EDUCACION PRIMARIA COMUNITARIA VOCACIONAL
        "ESTRATEGIAS DIDACTICAS PARA EL DESARROLLO DE LA COMPRENSION LECTORA Y ESCRITURA CREATIVA EN EDUCACION PRIMARIA",
        "DIDACTICA DEL PENSAMIENTO LOGICO MATEMATICO Y EVALUACION PARA EL APRENDIZAJE SIGNIFICATIVO",
        // EDUCACION SECUNDARIA COMUNITARIA PRODUCTIVA
        "DESARROLLO DE COMPETENCIAS EN LECTURA COMPRENSIVA Y PRODUCCION TEXTUAL EN EDUCACION SECUNDARIA",
        // EDUCACION ALTERNATIVA
        "APRENDIZAJE BASADO EN PROYECTOS CON ENFOQUE EN EDUCACION PRODUCTIVA",
        "GESTION DE EMPRENDIMIENTOS Y EMPLEABILIDAD EN EDUCACION TECNICA TECNOLOGICA Y PRODUCTIVA",
        // EDUCACION ESPECIAL
        "ESTRATEGIAS INNOVADORAS PARA LA ATENCION A ESTUDIANTES CON DIFICULTAD DE APRENDIZAJE EN EDUCACION ESPECIAL",
        // EDUCACION SUPERIOR DE FORMACION PROFESIONAL / DOCENTES DE INSTITUTOS TECNICOS TECNOLOGICOS
        "ASESORIA Y TUTORIA EN MODALIDADES DE GRADUACION EN FORMACION TECNICA - TECNOLOGICA",
        // TACFI
        "HERRAMIENTAS TECNOLOGICAS DIGITALES APLICADAS EN LA ENSENANZA DE LA LENGUA EXTRANJERA INGLES",
        "FORTALECIMIENTO DE HABILIDADES COMUNICATIVAS Y LIDERAZGO A TRAVES DEL ARTE ESCENICO",
        "FORTALECIMIENTO DE HABILIBADES COMUNICATIVAS Y LIDERAZGO A TRAVES DEL ARTE ESCENICO",
        "CREACION DE TEXTOS DIDACTICOS CON INTELIGENCIA ARTIFICIAL",
        "PRODUCCION ACADEMICA ASISTIDA CON INTELIGENCIA ARTIFICIAL"
      ];

      const idx = priorityOrder.indexOf(normalized);
      return idx !== -1 ? idx : 999;
    };

    map.forEach((grupo) => {
      grupo.cursos.sort((a, b) => {
        const pA = getCyclePriority(a.ciclo_nombre || '');
        const pB = getCyclePriority(b.ciclo_nombre || '');
        if (pA !== pB) return pA - pB;
        return a.id.localeCompare(b.id);
      });
    });

    return Array.from(map.values()).sort((a, b) => {
      const pA = getAreaPriority(a.nombre);
      const pB = getAreaPriority(b.nombre);
      if (pA !== pB) return pA - pB;
      return a.nombre.localeCompare(b.nombre);
    });
  }, [filteredCursos, selectedView]);

  const estadoGroups = useMemo<Grupo[]>(() => {
    if (selectedView !== 'estados') return [];
    
    const confirmados: Curso[] = [];
    const proyectados: Curso[] = [];
    
    filteredCursos.forEach((c) => {
      const isConfirmado = !!c.facilitador_nombre && 
        c.facilitador_nombre.trim() !== '' && 
        !/por confirmar/i.test(c.facilitador_nombre);
        
      if (isConfirmado) {
        confirmados.push(c);
      } else {
        proyectados.push(c);
      }
    });
    
    const list: Grupo[] = [];
    
    if (confirmados.length > 0) {
      list.push({
        nombre: 'Confirmado',
        color: '#10b981',
        cursos: confirmados
      });
    }
    
    if (proyectados.length > 0) {
      list.push({
        nombre: 'Proyectado',
        color: '#f59e0b',
        cursos: proyectados
      });
    }
    
    return list;
  }, [filteredCursos, selectedView]);

  // ─── Filter Logic for Agenda ────────────────────────────────
  const filteredAgenda = useMemo(() => {
    let result = [...agenda];

    // Búsqueda
    if (filters.busqueda) {
      const q = filters.busqueda.toLowerCase();
      result = result.filter((c) =>
        (c.nombre || '').toLowerCase().includes(q) ||
        (c.telefono || '').toLowerCase().includes(q) ||
        (c.lugar || '').toLowerCase().includes(q) ||
        (c.descripcion || '').toLowerCase().includes(q)
      );
    }

    // Técnico
    if (filters.tecnico) {
      result = result.filter((c) => c.tecnico_carnet === filters.tecnico);
    }

    return result;
  }, [agenda, filters.busqueda, filters.tecnico]);

  // ─── Group cursos ───────────────────────────────────────────
  const grupos = useMemo<Grupo[]>(() => {
    const map = new Map<string, Grupo>();

    filteredCursos.forEach((c) => {
      let key = 'Sin agrupar';
      let color = '#2f80ed';

      if (filters.agruparPor === 'grupo') {
        key = c.grupo_nombre || 'Sin grupo';
        color = c.grupo_color || '#2f80ed';
      } else if (filters.agruparPor === 'tecnico') {
        key = c.tecnico_nombre || 'Sin técnico';
        color = c.grupo_color || '#1a4a73';
      } else if (filters.agruparPor === 'facilitador') {
        key = c.facilitador_nombre || 'Sin facilitador';
        color = '#8b5cf6';
      } else if (filters.agruparPor === 'distrito') {
        key = c.distrito || 'Sin distrito';
        color = '#2e9f5e';
      } else if (filters.agruparPor === 'ninguno') {
        key = 'Todos los cursos';
        color = '#1a4a73';
      }

      if (!map.has(key)) {
        map.set(key, { nombre: key, color, cursos: [] });
      }
      map.get(key)!.cursos.push(c);
    });

    const list = Array.from(map.values());

    if (filters.agruparPor === 'grupo') {
      const getGroupMinCreatedAt = (g: Grupo) => {
        const times = g.cursos.map((c) => c.created_at).filter(Boolean);
        if (times.length === 0) return '';
        times.sort();
        return times[0];
      };

      list.sort((a, b) => {
        const indexA = customGrupoOrder.indexOf(a.nombre);
        const indexB = customGrupoOrder.indexOf(b.nombre);

        if (indexA !== -1 && indexB !== -1) {
          return indexA - indexB;
        }
        if (indexA !== -1) return 1;
        if (indexB !== -1) return -1;

        // Default: newest groups at the top (highest minimum created_at first)
        const timeA = getGroupMinCreatedAt(a);
        const timeB = getGroupMinCreatedAt(b);
        return timeB.localeCompare(timeA);
      });
    }

    return list;
  }, [filteredCursos, filters.agruparPor, customGrupoOrder]);

  // ─── Available group names for filter ───────────────────────
  const grupoNames = useMemo(() => {
    const names = new Set<string>();
    cursos.forEach((c) => { if (c.grupo_nombre) names.add(c.grupo_nombre); });
    return Array.from(names).sort();
  }, [cursos]);

  const reviewCount = useMemo(() => getReviewCount(filteredCursos), [filteredCursos]);

  // ─── CRUD callbacks ────────────────────────────────────────
  const handleSaveCurso = async (data: Partial<Curso>) => {
    try {
      if (editingCurso) {
        const { error } = await supabase.from('cursos').update(data).eq('id', editingCurso.id);
        if (error) throw error;
        Swal.fire({
          icon: 'success',
          title: '¡Actualizado con éxito!',
          text: `El curso ${editingCurso.id} se ha actualizado correctamente.`,
          confirmButtonText: 'Aceptar',
          confirmButtonColor: '#bfa05e',
          timer: 2500,
          timerProgressBar: true,
          showConfirmButton: true
        });
      } else {
        const { error } = await supabase.from('cursos').insert(data);
        if (error) throw error;
        Swal.fire({
          icon: 'success',
          title: '¡Creado con éxito!',
          text: `El curso ${data.id} se ha registrado correctamente.`,
          confirmButtonText: 'Aceptar',
          confirmButtonColor: '#bfa05e',
          timer: 2500,
          timerProgressBar: true,
          showConfirmButton: true
        });
      }
      setShowForm(false);
      setEditingCurso(null);
      loadData();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      Swal.fire('Error', errorMsg, 'error');
    }
  };

  const handleDeleteCurso = async (id: string) => {
    const result = await Swal.fire({
      title: '¿Eliminar curso?',
      text: `Se eliminará el curso ${id}. Esta acción no se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d93025',
      cancelButtonText: 'Cancelar',
      confirmButtonText: 'Sí, eliminar',
    });
    if (result.isConfirmed) {
      const { error } = await supabase.from('cursos').delete().eq('id', id);
      if (error) {
        Swal.fire('Error', error.message, 'error');
      } else {
        Swal.fire({ icon: 'success', title: 'Eliminado', timer: 1200, showConfirmButton: false });
        loadData();
      }
    }
  };

  const handleDuplicateCurso = async (curso: Curso) => {
    try {
      const { data: allCursos } = await supabase
        .from('cursos')
        .select('id');

      // Find the highest numeric ID across all cursos
      let maxNum = 0;
      (allCursos || []).forEach((c) => {
        const n = parseInt(c.id, 10);
        if (!isNaN(n) && n > maxNum) maxNum = n;
      });
      const newId = String(maxNum + 1);

      const { error } = await supabase.from('cursos').insert({
        id: newId,
        tecnico_carnet: curso.tecnico_carnet,
        ciclo_id: curso.ciclo_id,
        facilitador_carnet: curso.facilitador_carnet,
        distrito: curso.distrito,
        lugar: curso.lugar,
        area_urbano_rural: curso.area_urbano_rural,
        segmento: curso.segmento,
        fecha_inicio: curso.fecha_inicio,
        estado: curso.estado,
        observaciones: curso.observaciones,
        mostrar: curso.mostrar,
        costo: curso.costo,
        total_bs: curso.total_bs,
        mes: curso.mes,
        prev: curso.prev,
        grupo_nombre: curso.grupo_nombre,
        grupo_color: curso.grupo_color,
        grupo_tipo: curso.grupo_tipo,
        link_inscripcion_externo: curso.link_inscripcion_externo,
        planificacion_recibida: curso.planificacion_recibida,
        evaluacion_realizada: curso.evaluacion_realizada,
        informe_final_recibido: curso.informe_final_recibido,
        form_habilitado: curso.form_habilitado,
      });
      if (error) throw error;

      Swal.fire({
        icon: 'success',
        title: 'Curso duplicado',
        text: `Se creó ${newId} con los mismos datos de ${curso.id}.`,
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#bfa05e',
        timer: 2500,
        timerProgressBar: true,
      });
      loadData();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      Swal.fire('Error', errorMsg, 'error');
    }
  };

  const handleEditCurso = (curso: Curso) => {
    setEditingCurso(curso);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdateCurso = async (id: string, data: Partial<Curso>) => {
    try {
      const { error } = await supabase.from('cursos').update(data).eq('id', id);

      if (error) {
        // Fallback if organizer columns are not yet added to 'cursos' table in Supabase
        if (error.message && error.message.includes('organizador_')) {
          const cleanData = { ...data };
          delete cleanData.organizador_nombre;
          delete cleanData.organizador_telefono;
          delete cleanData.organizador_lugar;
          delete cleanData.organizador_maps;
          delete cleanData.organizador_descripcion;
          delete cleanData.organizador_semaforo;
          delete cleanData.organizador_color;

          const { error: retryErr } = await supabase.from('cursos').update(cleanData).eq('id', id);
          if (retryErr) throw retryErr;

          Swal.fire({
            icon: 'info',
            title: 'Actualizado parcialmente',
            text: 'Para guardar los datos del organizador directamente en la tabla cursos, por favor ejecuta la sentencia SQL provista en Supabase.',
            confirmButtonColor: '#bfa05e',
          });
          loadData();
          return;
        }
        throw error;
      }

      loadData();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      Swal.fire('Error', errorMsg, 'error');
    }
  };

  const handleRenameGrupo = async (oldName: string, newName: string) => {
    try {
      const { error } = await supabase
        .from('cursos')
        .update({ grupo_nombre: newName })
        .eq('grupo_nombre', oldName);
      if (error) throw error;
      Swal.fire({
        icon: 'success',
        title: '¡Grupo renombrado!',
        text: 'El nombre del grupo se ha actualizado correctamente.',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#bfa05e',
        timer: 2500,
        timerProgressBar: true,
        showConfirmButton: true
      });
      loadData();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      Swal.fire('Error', errorMsg, 'error');
    }
  };

  const handleMoveGrupo = useCallback((nombre: string, direction: 'up' | 'down') => {
    const currentGroupNames = grupos.map((g) => g.nombre);
    const index = currentGroupNames.indexOf(nombre);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= currentGroupNames.length) return;

    const newOrder = [...currentGroupNames];
    newOrder[index] = currentGroupNames[newIndex];
    newOrder[newIndex] = currentGroupNames[index];

    setCustomGrupoOrder(newOrder);
    localStorage.setItem('grupo_orden', JSON.stringify(newOrder));
  }, [grupos]);

  // ─── Agenda Callbacks ──────────────────────────────────────
  const handleSaveContacto = async (_data: Partial<AgendaContacto>) => {
    Swal.fire({
      icon: 'info',
      title: 'Organizador integrado',
      text: 'Los datos del organizador se gestionan y guardan directamente en cada curso.',
      confirmButtonColor: '#bfa05e',
    });
    setShowAgendaForm(false);
    setEditingContacto(null);
  };

  const handleDeleteContacto = async (_id: string) => {
    Swal.fire({
      icon: 'info',
      title: 'Organizador integrado',
      text: 'Los datos del organizador pertenecen directamente a sus respectivos cursos.',
      confirmButtonColor: '#bfa05e',
    });
  };

  const handleEditContacto = (contacto: AgendaContacto) => {
    setEditingContacto(contacto);
    setShowAgendaForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ─── Render ─────────────────────────────────────────────────
  return (
    <div className={`page-container ${readOnly ? 'supervisor-mode' : ''}`}>
      {/* Header */}
      <header className="app-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--gray-200)' }}>
        <h1 style={{ margin: 0, padding: 0 }}>
          <CalendarDays className="header-icon" size={32} />
          Sistema de Control de Maestros
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Role indicator */}
          {user && (
            <div className="role-indicator">
              {isSupervisor ? <Eye size={14} /> : <Shield size={14} />}
              <span className="role-name">{user.nombre_completo}</span>
              <span className={`role-badge ${isSupervisor ? 'supervisor' : 'tecnico'}`}>
                {isSupervisor ? 'Técnico Pedagógico' : 'Técnico'}
              </span>
            </div>
          )}

          {/* Logout */}
          <button
            type="button"
            className="btn btn-sm"
            style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: '0.78rem', fontWeight: 600 }}
            onClick={logout}
            title="Cerrar sesión"
          >
            <LogOut size={13} /> Salir
          </button>

          {/* Zoom / Lupa Controls */}
          <div className="magnifier-container">
            <span className="magnifier-label">
              <ZoomOut size={12} style={{ opacity: 0.7 }} /> Lupa
            </span>
            <button
              type="button"
              className="magnifier-btn"
              onClick={() => handleFontSizeChange(fontSize - 1)}
              disabled={fontSize <= 10}
              title="Reducir tamaño de letra"
            >
              -
            </button>
            <span
              className="magnifier-value"
              onClick={() => handleFontSizeChange(13)}
              title="Restablecer tamaño predeterminado (100%)"
            >
              {Math.round((fontSize / 13) * 100)}%
            </span>
            <button
              type="button"
              className="magnifier-btn"
              onClick={() => handleFontSizeChange(fontSize + 1)}
              disabled={fontSize >= 20}
              title="Aumentar tamaño de letra"
            >
              +
            </button>
          </div>

          <div style={{ display: 'flex', gap: '4px', background: 'rgba(255, 255, 255, 0.75)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--gray-200)', backdropFilter: 'blur(8px)' }}>
            <button 
              type="button"
              className="btn btn-sm" 
              style={{ 
                background: viewMode === 'cursos' ? 'var(--primary-500)' : 'transparent',
                color: viewMode === 'cursos' ? 'var(--white)' : 'var(--gray-700)',
                borderRadius: 'var(--radius-sm)',
                boxShadow: viewMode === 'cursos' ? 'var(--shadow-sm)' : 'none'
              }} 
              onClick={() => { setViewMode('cursos'); setShowForm(false); setShowAgendaForm(false); }}
            >
              <CalendarDays size={14} /> Cursos
            </button>
            <a 
              href="/grupos"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm" 
              style={{ 
                background: 'linear-gradient(135deg, #bfa05e 0%, #9a7b38 100%)',
                color: 'var(--white)',
                borderRadius: 'var(--radius-sm)',
                boxShadow: '0 2px 8px rgba(191, 160, 94, 0.4)',
                fontWeight: 700,
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }} 
              title="Abrir página pública de guía para grupos (/grupos)"
            >
              <Sparkles size={14} /> /grupos (Pública)
            </a>
            <a 
              href="/inscripciones"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm" 
              style={{ 
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                color: 'var(--white)',
                borderRadius: 'var(--radius-sm)',
                boxShadow: '0 2px 8px rgba(15, 23, 42, 0.4)',
                fontWeight: 700,
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }} 
              title="Abrir página pública de ficha de inscripción y requisitos (/inscripciones)"
            >
              <FileText size={14} /> /inscripciones (Pública)
            </a>
            {isSupervisor && (
              <button 
                type="button"
                className="btn btn-sm" 
                style={{ 
                  background: viewMode === 'agenda' ? 'var(--primary-500)' : 'transparent',
                  color: viewMode === 'agenda' ? 'var(--white)' : 'var(--gray-700)',
                  borderRadius: 'var(--radius-sm)',
                  boxShadow: viewMode === 'agenda' ? 'var(--shadow-sm)' : 'none'
                }} 
                onClick={() => { setViewMode('agenda'); setShowForm(false); setShowAgendaForm(false); }}
              >
                <Contact size={14} /> Agenda
              </button>
            )}
          </div>
        </div>
      </header>

      {/* View Switcher Bar */}
      {viewMode === 'cursos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '24px' }}>
          <div className="view-switcher-bar" style={{ display: 'flex', width: '100%', gap: '8px', height: '10px' }}>
            <button 
              type="button"
              onClick={() => setSelectedView('grupal')} 
              title="Vista Grupal"
              style={{
                flex: 1,
                height: '100%',
                backgroundColor: '#dc2626',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                opacity: selectedView === 'grupal' ? 1 : 0.3,
                transform: selectedView === 'grupal' ? 'scaleY(1.4)' : 'none',
                boxShadow: selectedView === 'grupal' ? '0 0 8px rgba(220, 38, 38, 0.5)' : 'none',
                transition: 'all 0.25s ease'
              }}
            />
            <button 
              type="button"
              onClick={() => setSelectedView('area')} 
              title="Vista por Área"
              style={{
                flex: 1,
                height: '100%',
                backgroundColor: '#f59e0b',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                opacity: selectedView === 'area' ? 1 : 0.3,
                transform: selectedView === 'area' ? 'scaleY(1.4)' : 'none',
                boxShadow: selectedView === 'area' ? '0 0 8px rgba(245, 158, 11, 0.5)' : 'none',
                transition: 'all 0.25s ease'
              }}
            />
            <button 
              type="button"
              onClick={() => setSelectedView('estados')} 
              title="Vista Estados"
              style={{
                flex: 1,
                height: '100%',
                backgroundColor: '#10b981',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                opacity: selectedView === 'estados' ? 1 : 0.3,
                transform: selectedView === 'estados' ? 'scaleY(1.4)' : 'none',
                boxShadow: selectedView === 'estados' ? '0 0 8px rgba(16, 185, 129, 0.5)' : 'none',
                transition: 'all 0.25s ease'
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray-600)' }}>
            <span style={{ color: selectedView === 'grupal' ? '#dc2626' : 'inherit', transition: 'color 0.2s' }}>Vista Grupal (Por Defecto)</span>
            <span style={{ color: selectedView === 'area' ? '#d97706' : 'inherit', transition: 'color 0.2s' }}>Vista por Área</span>
            <span style={{ color: selectedView === 'estados' ? '#10b981' : 'inherit', transition: 'color 0.2s' }}>Vista Estados</span>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="filter-group">
          <label className="filter-label"><Search size={12} /> Buscar</label>
          <input
            className="filter-input"
            type="text"
            placeholder={viewMode === 'cursos' ? "ID, ciclo, distrito, facilitador, grupo..." : "Nombre, teléfono, lugar, descripción..."}
            value={filters.busqueda}
            onChange={(e) => setFilters({ ...filters, busqueda: e.target.value })}
          />
        </div>

        {viewMode === 'cursos' && (
          <div className="filter-group">
            <label className="filter-label"><Filter size={12} /> Preventivo</label>
            <input
              className="filter-input"
              type="text"
              placeholder="Número de preventivo"
              value={filters.preventivo}
              onChange={(e) => setFilters({ ...filters, preventivo: e.target.value })}
            />
          </div>
        )}

        {viewMode === 'cursos' && (
          <div className="filter-group">
            <label className="filter-label"><CalendarDays size={12} /> Mes</label>
            <select
              className="filter-select"
              value={filters.mes}
              onChange={(e) => setFilters({ ...filters, mes: e.target.value })}
            >
              <option value="">Todos los meses</option>
              {['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        )}

        <div className="filter-group">
          <label className="filter-label">Técnico</label>
          <select
            className="filter-select"
            value={filters.tecnico}
            onChange={(e) => setFilters({ ...filters, tecnico: e.target.value })}
          >
            <option value="">Todos los técnicos</option>
            {tecnicos.map((t) => (
              <option key={t.carnet} value={t.carnet}>{t.nombre}</option>
            ))}
          </select>
        </div>

        {viewMode === 'cursos' && (
          <div className="filter-group">
            <label className="filter-label"><Filter size={14} /> Notas Revisadas</label>
            <select
              className="filter-select"
              value={filters.notasRevisadas}
              onChange={(e) => setFilters({ ...filters, notasRevisadas: e.target.value as AppFilters['notasRevisadas'] })}
            >
              <option value="todos">Todos</option>
              <option value="sie-validado">Validación SIE (Validado)</option>
              <option value="sie-pendiente">Validación SIE (Pendiente)</option>
              <option value="pago-pendiente">Estados de Pago (Pendiente)</option>
              <option value="pago-pagado">Estados de Pago (Pagado)</option>
              <option value="validados-pagados">Validados y Pagados</option>
            </select>
          </div>
        )}

        {viewMode === 'cursos' && (
          <div className="filter-group">
            <label className="filter-label">Agrupar por</label>
            <select
              className="filter-select"
              value={filters.agruparPor}
              onChange={(e) => setFilters({ ...filters, agruparPor: e.target.value as AppFilters['agruparPor'] })}
            >
              <option value="grupo">Grupo de color</option>
              <option value="tecnico">Técnico</option>
              <option value="facilitador">Facilitador</option>
              <option value="distrito">Distrito</option>
              <option value="ninguno">Sin agrupar</option>
            </select>
          </div>
        )}

        <div className="filter-group" style={{ alignSelf: 'end' }}>
          <button
            type="button"
            className="filter-clear-btn"
            style={{
              height: '42px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontWeight: 700,
              fontSize: '0.85rem',
              color: '#d93025',
              borderColor: 'rgba(217, 48, 37, 0.2)',
              background: 'rgba(217, 48, 37, 0.06)',
              border: '1.5px solid rgba(217, 48, 37, 0.2)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
              width: '100%'
            }}
            onClick={handleClearFilters}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(217, 48, 37, 0.12)';
              e.currentTarget.style.borderColor = '#d93025';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(217, 48, 37, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(217, 48, 37, 0.06)';
              e.currentTarget.style.borderColor = 'rgba(217, 48, 37, 0.2)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <X size={15} /> Borrar Filtros
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <button className="btn btn-secondary" onClick={loadData} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Actualizar
          </button>

          {viewMode === 'cursos' && (
            <>
              <div className="toolbar-filter-group">
                <label><LayoutGrid size={12} /> Grupos</label>
                <select
                  value={filters.grupo}
                  onChange={(e) => setFilters({ ...filters, grupo: e.target.value })}
                >
                  <option value="todos">Todos los grupos</option>
                  {grupoNames.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <button
                className="btn btn-primary"
                style={{
                  background: 'linear-gradient(135deg, #0d3b66 0%, #1a5276 100%)',
                  color: '#ffffff',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-sm)',
                  boxShadow: '0 2px 8px rgba(13, 59, 102, 0.25)',
                  cursor: 'pointer',
                  border: 'none',
                  fontSize: '0.85rem',
                }}
                onClick={() => setShowReporteDiarioModal(true)}
              >
                <FileText size={16} /> REPORTE DIARIO
              </button>

              {reviewCount > 0 && (
                <div className="alert-chip">
                  <AlertTriangle size={14} />
                  {reviewCount} curso{reviewCount > 1 ? 's' : ''} por revisar
                </div>
              )}
            </>
          )}
        </div>

        <div className="toolbar-right" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {viewMode === 'cursos' && selectedView === 'area' && (
            <button
              className="btn"
              style={{
                background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                color: '#fff',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.82rem',
                padding: '8px 14px',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(16,185,129,0.3)',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onClick={() => {
                exportAreaView(areaGroups, ciclos);
              }}
              title="Descargar reporte Excel de la vista por áreas"
            >
              <Download size={14} /> Exportar Excel
            </button>
          )}
          {viewMode === 'cursos' ? (
            !readOnly && (
              <button
                className="btn btn-success"
                onClick={() => { setEditingCurso(null); setShowForm(!showForm); }}
              >
                <Plus size={14} /> Nuevo curso
              </button>
            )
          ) : (
            !readOnly && (
              <button
                className="btn btn-success"
                onClick={() => { setEditingContacto(null); setShowAgendaForm(!showAgendaForm); }}
              >
                <Plus size={14} /> Nuevo contacto
              </button>
            )
          )}
        </div>
      </div>

      {/* Curso Form (hidden for supervisor) */}
      {!readOnly && viewMode === 'cursos' && showForm && (
        <CursoForm
          curso={editingCurso}
          tecnicos={tecnicos}
          facilitadores={facilitadores}
          ciclos={ciclos}
          grupoNames={grupoNames}
          onSave={handleSaveCurso}
          onCancel={() => { setShowForm(false); setEditingCurso(null); }}
          cursos={cursos}
        />
      )}

      {/* Agenda Form (hidden for supervisor) */}
      {!readOnly && viewMode === 'agenda' && showAgendaForm && (
        <AgendaForm
          contacto={editingContacto}
          tecnicos={tecnicos}
          onSave={handleSaveContacto}
          onCancel={() => { setShowAgendaForm(false); setEditingContacto(null); }}
        />
      )}

      {/* Content */}
      {loading && (viewMode === 'cursos' ? cursos.length === 0 : agenda.length === 0) ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', padding: '20px 0' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton skeleton-card" />
          ))}
        </div>
      ) : viewMode === 'cursos' ? (
        <>
          {/* Dashboard Panels (supervisor only) */}
          {readOnly && (
            <>
              <MonitoreoTecnicos cursos={cursos} tecnicos={tecnicos} />
            </>
          )}

          {selectedTecnicoObj && (
            <div style={{
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              color: '#ffffff',
              padding: '16px 20px',
              borderRadius: '12px',
              marginBottom: '20px',
              boxShadow: 'var(--shadow-md)',
              borderLeft: '5px solid #bfa05e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              overflow: 'hidden'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#ffffff' }}>
                  👨‍💻 Técnico: <span style={{ color: '#f59e0b' }}>{selectedTecnicoObj.nombre}</span>
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
                  Carnet: {selectedTecnicoObj.carnet} | Mostrando grupos y distritos asignados
                </p>
              </div>
              <span style={{
                background: 'rgba(191, 160, 94, 0.15)',
                border: '1px solid rgba(191, 160, 94, 0.3)',
                borderRadius: '20px',
                padding: '4px 12px',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: '#f59e0b'
              }}>
                {filteredCursos.length} curso{filteredCursos.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          {cursos.length === 0 || (
            selectedView === 'grupal' ? (
              filters.agruparPor === 'distrito' && filters.tecnico === "" ? tecnicoGroups.length === 0 : grupos.length === 0
            ) : selectedView === 'area' ? (
              areaGroups.length === 0
            ) : (
              estadoGroups.length === 0
            )
          ) ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <p>No se encontraron cursos</p>
              <p style={{ fontSize: '0.88rem', marginTop: '8px', color: '#9ca3af' }}>
                {cursos.length === 0
                  ? 'Crea tu primer curso con el botón "Nuevo curso"'
                  : 'Intenta cambiar los filtros de búsqueda'}
              </p>
            </div>
          ) : selectedView === 'grupal' ? (
            filters.agruparPor === 'distrito' && filters.tecnico === "" ? (
              tecnicoGroups.map((tg) => (
                <div key={tg.tecnicoCarnet} className="tecnico-section-wrapper" style={{ marginBottom: '30px' }}>
                  <div className="tecnico-section-header" style={{
                    background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                    color: '#ffffff',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    marginBottom: '12px',
                    fontSize: '0.95rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    borderLeft: '4px solid #bfa05e',
                    boxShadow: 'var(--shadow-sm)'
                  }}>
                    👨‍💻 Técnico: <span style={{ color: '#f59e0b' }}>{tg.tecnicoNombre}</span>
                    <span style={{
                      fontSize: '0.72rem',
                      background: 'rgba(191, 160, 94, 0.15)',
                      border: '1px solid rgba(191, 160, 94, 0.3)',
                      color: '#f59e0b',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontWeight: 700,
                      marginLeft: 'auto'
                    }}>
                      {tg.distritos.length} distrito{tg.distritos.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="tecnico-distritos-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingLeft: '8px' }}>
                    {tg.distritos.map((distrito, idx) => (
                      <GrupoCard
                        key={`${tg.tecnicoCarnet}-${distrito.nombre}`}
                        grupo={distrito}
                        activeGroup={filters.grupo}
                        tecnicos={tecnicos}
                        facilitadores={facilitadores}
                        ciclos={ciclos}
                        grupoNames={grupoNames}
                        onEditCurso={handleEditCurso}
                        onDeleteCurso={handleDeleteCurso}
                        onDuplicateCurso={handleDuplicateCurso}
                        onUpdateCurso={handleUpdateCurso}
                        onRenameGrupo={handleRenameGrupo}
                        isFirst={idx === 0}
                        isLast={idx === tg.distritos.length - 1}
                        onManageParticipantes={setActiveCursoParticipantes}
                        collapsed={expandedGrupo !== `${tg.tecnicoCarnet}-${distrito.nombre}`}
                        onToggleCollapse={() => {
                          const key = `${tg.tecnicoCarnet}-${distrito.nombre}`;
                          setExpandedGrupo(expandedGrupo === key ? null : key);
                        }}
                        readOnly={readOnly}
                        matchedParticipants={matchedParticipantsMap}
                      />
                    ))}
                  </div>
                </div>
              ))
            ) : (
              grupos.map((grupo, idx) => (
                <GrupoCard
                  key={grupo.nombre}
                  grupo={grupo}
                  activeGroup={filters.grupo}
                  tecnicos={tecnicos}
                  facilitadores={facilitadores}
                  ciclos={ciclos}
                  grupoNames={grupoNames}
                  onEditCurso={handleEditCurso}
                  onDeleteCurso={handleDeleteCurso}
                  onDuplicateCurso={handleDuplicateCurso}
                  onUpdateCurso={handleUpdateCurso}
                  onRenameGrupo={handleRenameGrupo}
                  onMoveGrupo={filters.agruparPor === 'grupo' ? handleMoveGrupo : undefined}
                  isFirst={idx === 0}
                  isLast={idx === grupos.length - 1}
                  onManageParticipantes={setActiveCursoParticipantes}
                  collapsed={expandedGrupo !== grupo.nombre}
                  onToggleCollapse={() => setExpandedGrupo(expandedGrupo === grupo.nombre ? null : grupo.nombre)}
                  readOnly={readOnly}
                  matchedParticipants={matchedParticipantsMap}
                />
              ))
            )
          ) : selectedView === 'area' ? (
            areaGroups.map((grupo) => {
              const isAreaExpanded = expandedArea === grupo.nombre;
              const uniqueTecnicosInArea = Array.from(new Set(grupo.cursos.map((c) => c.tecnico_nombre).filter(Boolean)));
              return (
                <div 
                  key={grupo.nombre} 
                  className={`accordion-group-card ${isAreaExpanded ? 'active' : 'collapsed'}`}
                  style={{ '--accordion-color': grupo.color } as React.CSSProperties}
                >
                  <div 
                    className="accordion-header-bar" 
                    onClick={() => setExpandedArea(isAreaExpanded ? null : grupo.nombre)}
                  >
                    <div className="accordion-header-left">
                      <h2 className="accordion-title">
                        <LayoutGrid size={20} style={{ flexShrink: 0, color: grupo.color }} />
                        <span className="accordion-title-text" title={grupo.nombre}>
                          {grupo.nombre}
                        </span>
                      </h2>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span className="accordion-count-badge">
                          <Hash size={12} />
                          {grupo.cursos.length} grupo{grupo.cursos.length !== 1 ? 's' : ''}
                        </span>
                        {uniqueTecnicosInArea.map((name) => (
                          <span key={name} className="accordion-tecnico-badge">
                            <User size={12} />
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                    <ChevronDown size={18} className="accordion-toggle-arrow" />
                  </div>

                  {isAreaExpanded && (
                    <div className="accordion-body-grid">
                      {grupo.cursos.map((curso, idx) => {
                        const cycleGrupo = { nombre: curso.ciclo_nombre || curso.grupo_nombre || 'Sin ciclo', color: curso.grupo_color || '#bfa05e', cursos: [curso] };
                        return (
                          <GrupoCard
                            key={curso.id}
                            grupo={cycleGrupo}
                            activeGroup={filters.grupo}
                            tecnicos={tecnicos}
                            facilitadores={facilitadores}
                            ciclos={ciclos}
                            grupoNames={grupoNames}
                            onEditCurso={handleEditCurso}
                            onDeleteCurso={handleDeleteCurso}
                            onDuplicateCurso={handleDuplicateCurso}
                            onUpdateCurso={handleUpdateCurso}
                            onRenameGrupo={handleRenameGrupo}
                            isFirst={idx === 0}
                            isLast={idx === grupo.cursos.length - 1}
                            onManageParticipantes={setActiveCursoParticipantes}
                            collapsed={expandedCycleId !== curso.id}
                            onToggleCollapse={() => setExpandedCycleId(expandedCycleId === curso.id ? null : curso.id)}
                            readOnly={readOnly}
                            showInscritosInsteadOfNews={true}
                            matchedParticipants={matchedParticipantsMap}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            estadoGroups.map((grupo) => {
              const isStatusExpanded = expandedStatus === grupo.nombre;
              const uniqueTecnicosInStatus = Array.from(new Set(grupo.cursos.map((c) => c.tecnico_nombre).filter(Boolean)));
              return (
                <div
                  key={grupo.nombre}
                  className={`accordion-group-card ${isStatusExpanded ? 'active' : 'collapsed'}`}
                  style={{ '--accordion-color': grupo.color } as React.CSSProperties}
                >
                  <div
                    className="accordion-header-bar"
                    onClick={() => setExpandedStatus(isStatusExpanded ? null : grupo.nombre)}
                  >
                    <div className="accordion-header-left">
                      <h2 className="accordion-title">
                        <LayoutGrid size={20} style={{ flexShrink: 0, color: grupo.color }} />
                        <span className="accordion-title-text" title={grupo.nombre}>
                          {grupo.nombre}
                        </span>
                      </h2>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span className="accordion-count-badge">
                          <Hash size={12} />
                          {grupo.cursos.length} grupo{grupo.cursos.length !== 1 ? 's' : ''}
                        </span>
                        {uniqueTecnicosInStatus.map((name) => (
                          <span key={name} className="accordion-tecnico-badge">
                            <User size={12} />
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                    <ChevronDown size={18} className="accordion-toggle-arrow" />
                  </div>

                  {isStatusExpanded && (
                    <div className="accordion-body-grid">
                      {grupo.cursos.map((curso, idx) => {
                        const cycleGrupo = { nombre: curso.ciclo_nombre || curso.grupo_nombre || 'Sin ciclo', color: curso.grupo_color || '#bfa05e', cursos: [curso] };
                        return (
                          <GrupoCard
                            key={curso.id}
                            grupo={cycleGrupo}
                            activeGroup={filters.grupo}
                            tecnicos={tecnicos}
                            facilitadores={facilitadores}
                            ciclos={ciclos}
                            grupoNames={grupoNames}
                            onEditCurso={handleEditCurso}
                            onDeleteCurso={handleDeleteCurso}
                            onDuplicateCurso={handleDuplicateCurso}
                            onUpdateCurso={handleUpdateCurso}
                            onRenameGrupo={handleRenameGrupo}
                            isFirst={idx === 0}
                            isLast={idx === grupo.cursos.length - 1}
                            onManageParticipantes={setActiveCursoParticipantes}
                            collapsed={expandedCycleId !== curso.id}
                            onToggleCollapse={() => setExpandedCycleId(expandedCycleId === curso.id ? null : curso.id)}
                            readOnly={readOnly}
                            showInscritosInsteadOfNews={true}
                            matchedParticipants={matchedParticipantsMap}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </>
      ) : (
        /* Agenda View */
        filteredAgenda.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👤</div>
            <p>No se encontraron contactos</p>
            <p style={{ fontSize: '0.88rem', marginTop: '8px', color: '#9ca3af' }}>
              {agenda.length === 0
                ? 'Crea tu primer contacto con el botón "Nuevo contacto"'
                : 'Intenta cambiar los filtros de búsqueda'}
            </p>
          </div>
        ) : (
          <div className="agenda-grid">
            {filteredAgenda.map((contacto) => (
              <AgendaCard
                key={contacto.id_contacto}
                contacto={contacto}
                tecnicos={tecnicos}
                onEdit={() => handleEditContacto(contacto)}
                onDelete={() => handleDeleteContacto(contacto.id_contacto)}
                readOnly={readOnly}
              />
            ))}
          </div>
        )
      )}

      {currentModalCurso && (
        <ParticipantesModal
          curso={currentModalCurso}
          onClose={() => setActiveCursoParticipantes(null)}
          onRefresh={loadData}
        />
      )}

      <ReporteDiarioModal
        isOpen={showReporteDiarioModal}
        onClose={() => setShowReporteDiarioModal(false)}
        currentUser={user}
      />
    </div>
  );
}
