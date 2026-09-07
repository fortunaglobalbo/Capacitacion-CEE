export interface Participante {
  id?: string;
  ci: string;
  nombres: string;
  apellidos: string;
  telefono?: string;
  carnet_anverso_url?: string;
  carnet_reverso_url?: string;
  carnet_escaneado_url?: string;
  comprobante_url?: string;
  monto_pago?: number;
  estado_pago?: 'PENDIENTE' | 'VERIFICADO' | 'OBSERVADO';
  observaciones?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ParticipanteFormData {
  ci: string;
  nombres: string;
  apellidos: string;
  telefono: string;
  carnet_anverso_file?: File | null;
  carnet_reverso_file?: File | null;
  carnet_escaneado_file?: File | null;
  comprobante_file?: File | null;
}
