// ============================================================
// Types: Curso / Nota
// Equivalente a los datos de la hoja CONEXION enriquecidos
// ============================================================

export interface HorarioSlot {
  date: string;
  startTime: string;
  endTime: string;
  hours: number;
  course: number | string; // 1,2,3,4 | "soc1"-"soc4" | "eval1"-"eval4"
  hour?: number;
  minute?: number;
  endHour?: number;
  endMinute?: number;
}

export interface Curso {
  id: string;
  tecnico_carnet: string | null;
  ciclo_id: string | null;
  facilitador_carnet: string | null;
  distrito: string;
  lugar: string;
  area_urbano_rural: string;
  segmento: string;
  fecha_inicio: string;
  estado: string;
  observaciones: string;
  mostrar: string;
  inscritos: number;
  costo: number;
  total_bs: number;
  contacto_agenda: string | null;
  link_archivo: string;
  link_sheet_participantes: string;
  mes: string;
  part: string;
  prev: string;
  form_url: string;
  grupo_nombre: string;
  grupo_color: string;
  grupo_tipo: string;
  horarios_tentativos: HorarioSlot[];
  inscritos_formulario: number;
  inscritos_id: number;
  link_inscripcion_externo: string;
  planificacion_recibida: boolean;
  evaluacion_realizada: boolean;
  informe_final_recibido: boolean;
  created_at: string;
  updated_at: string;
  form_habilitado?: boolean;
  mostrar_whatsapp?: boolean;

  // Campos enriquecidos (del JOIN / vista)
  tecnico_nombre?: string;
  facilitador_nombre?: string;
  ciclo_nombre?: string;
  ciclo_grupo?: string;
  area_formativa?: string;
  tema1?: string;
  tema2?: string;
  tema3?: string;
  tema4?: string;
  organizador_nombre?: string;
  organizador_telefono?: string;
  organizador_lugar?: string;
  organizador_maps?: string;
  organizador_descripcion?: string;
  organizador_semaforo?: string;
  organizador_color?: string;
}

export interface CursoFormData {
  id: string;
  tecnico_carnet: string;
  ciclo_id: string;
  facilitador_carnet: string;
  distrito: string;
  lugar: string;
  area_urbano_rural: string;
  segmento: string;
  fecha_inicio: string;
  estado: string;
  observaciones: string;
  mostrar: string;
  inscritos: number;
  costo: number;
  total_bs: number;
  mes: string;
  prev: string;
  grupo_nombre: string;
  grupo_color: string;
  mostrar_whatsapp?: boolean;
}

export interface Grupo {
  nombre: string;
  color: string;
  cursos: Curso[];
  collapsed?: boolean;
}
