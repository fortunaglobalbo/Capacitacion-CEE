'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Trash2, AlertTriangle, X, CalendarDays, CheckCircle, RefreshCw } from 'lucide-react';
import Swal from 'sweetalert2';

interface LimpiarComprobantesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LimpiarComprobantesModal({ isOpen, onClose }: LimpiarComprobantesModalProps) {
  const [mesSeleccionado, setMesSeleccionado] = useState<string>('TODOS');
  const [cleaning, setCleaning] = useState(false);

  if (!isOpen) return null;

  const MESES_LIST = [
    'TODOS',
    'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
    'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
  ];

  const handleCleanStorage = async () => {
    const res = await Swal.fire({
      title: '¿Confirmar eliminación?',
      text: `Se eliminarán los comprobantes adjuntos para el mes de ${mesSeleccionado}. Esta acción liberará espacio en el servidor.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d93025',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar comprobantes',
      cancelButtonText: 'Cancelar'
    });

    if (!res.isConfirmed) return;

    setCleaning(true);
    try {
      // 1. Fetch records with comprobante_url
      let query = supabase.from('inscripcion_ciclo').select('id, comprobante_url, created_at').not('comprobante_url', 'is', null);

      const { data: records, error } = await query;
      if (error) throw error;

      if (!records || records.length === 0) {
        Swal.fire({
          icon: 'info',
          title: 'Sin comprobantes',
          text: 'No se encontraron comprobantes registrados para eliminar.',
          confirmButtonColor: '#0f172a'
        });
        setCleaning(false);
        return;
      }

      // Filter by month if specific month selected
      const toDelete = records.filter(r => {
        if (mesSeleccionado === 'TODOS') return true;
        if (!r.created_at) return true;
        const d = new Date(r.created_at);
        const monthName = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'][d.getMonth()];
        return monthName === mesSeleccionado;
      });

      if (toDelete.length === 0) {
        Swal.fire({
          icon: 'info',
          title: 'Sin comprobantes',
          text: `No hay comprobantes para el mes de ${mesSeleccionado}.`,
          confirmButtonColor: '#0f172a'
        });
        setCleaning(false);
        return;
      }

      // Delete storage files & clear DB column
      const ids = toDelete.map(r => r.id);
      
      const { error: updateErr } = await supabase
        .from('inscripcion_ciclo')
        .update({ comprobante_url: null })
        .in('id', ids);

      if (updateErr) throw updateErr;

      Swal.fire({
        icon: 'success',
        title: '¡Espacio Liberado!',
        text: `Se eliminaron exitosamente ${toDelete.length} comprobantes de ${mesSeleccionado}.`,
        confirmButtonColor: '#16a34a'
      });

      onClose();
    } catch (err: any) {
      console.error('Error al limpiar comprobantes:', err);
      Swal.fire({
        icon: 'error',
        title: 'Error de limpieza',
        text: err.message || 'No se pudieron eliminar los comprobantes.',
        confirmButtonColor: '#d93025'
      });
    } finally {
      setCleaning(false);
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
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '16px'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '20px',
        maxWidth: '520px',
        width: '100%',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
        border: '2px solid #cbd5e1',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#ffffff',
          padding: '18px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Trash2 size={22} style={{ color: '#ef4444' }} />
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#ffffff' }}>
              Limpiar Comprobantes por Mes
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#cbd5e1',
              cursor: 'pointer'
            }}
          >
            <X size={22} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px' }}>
          <p style={{ margin: '0 0 16px 0', fontSize: '1rem', color: '#475569', lineHeight: 1.5, fontWeight: 600 }}>
            Selecciona el mes de los comprobantes que deseas eliminar para liberar espacio en el servidor de Supabase:
          </p>

          <label style={{ display: 'block', fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
            <CalendarDays size={16} style={{ display: 'inline', marginRight: '6px' }} />
            Selecciona Mes a Limpiar:
          </label>

          <select
            value={mesSeleccionado}
            onChange={(e) => setMesSeleccionado(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 14px',
              fontSize: '1.1rem',
              fontWeight: 800,
              borderRadius: '12px',
              border: '2px solid #cbd5e1',
              marginBottom: '20px',
              color: '#0f172a'
            }}
          >
            {MESES_LIST.map(m => (
              <option key={m} value={m}>{m === 'TODOS' ? ' Todos los meses' : ` Mes de ${m}`}</option>
            ))}
          </select>

          <div style={{
            background: '#fff1f2',
            border: '1.5px solid #fda4af',
            borderRadius: '12px',
            padding: '14px',
            color: '#9f1239',
            fontSize: '0.92rem',
            lineHeight: 1.5,
            fontWeight: 700,
            marginBottom: '24px'
          }}>
            ⚠️ <strong>Advertencia:</strong> Esta acción eliminará los comprobantes bancarios subidos por los participantes en el mes seleccionado. Se recomienda realizar esta limpieza mensualmente tras la verificación técnica.
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#f1f5f9',
                color: '#475569',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                padding: '10px 18px',
                fontWeight: 800,
                fontSize: '0.95rem',
                cursor: 'pointer'
              }}
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleCleanStorage}
              disabled={cleaning}
              style={{
                background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                padding: '10px 20px',
                fontWeight: 900,
                fontSize: '0.95rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)'
              }}
            >
              <Trash2 size={18} /> {cleaning ? 'Eliminando...' : 'Eliminar Comprobantes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
