// ============================================================
// Types: Agenda de Contactos
// ============================================================

export interface AgendaContacto {
  id_contacto: string;
  tecnico_carnet: string | null;
  nombre: string;
  telefono: string;
  lugar: string;
  link_maps: string;
  descripcion: string;
  fecha_interaccion?: string | null;
  estado_semaforo: string;
  color: string;
  created_at?: string;
  updated_at?: string;
}

export interface AgendaFormData {
  nombre: string;
  telefono: string;
  lugar: string;
  link_maps: string;
  descripcion: string;
  estado_semaforo: string;
  color: string;
  tecnico_carnet: string;
}
