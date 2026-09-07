'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import Swal from 'sweetalert2';
import {
  Users,
  Search,
  Filter,
  Download,
  Plus,
  RefreshCw,
  CheckCircle,
  Clock,
  ExternalLink,
  Trash2,
  FileText,
  Phone,
  BookOpen,
  X
} from 'lucide-react';
import { Participante, CursoCapacitacion } from '@/types';

export default function GestionParticipantes() {
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [cursos, setCursos] = useState<CursoCapacitacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState<'TODOS' | 'PENDIENTE' | 'VERIFICADO' | 'OBSERVADO'>('TODOS');
  const [filterCurso, setFilterCurso] = useState<string>('TODOS');

  // Modal para ver imagen/documento en grande
  const [modalImage, setModalImage] = useState<{ url: string; title: string } | null>(null);

  // Modal para registrar nuevo participante manual
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCi, setNewCi] = useState('');
  const [newNombres, setNewNombres] = useState('');
  const [newApellidos, setNewApellidos] = useState('');
  const [newTelefono, setNewTelefono] = useState('');
  const [newCursoId, setNewCursoId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Cargar datos desde Supabase
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Cursos
      const { data: cursosData } = await supabase
        .from('cursos')
        .select('*')
        .order('nombre', { ascending: true });

      setCursos(cursosData || []);
      if (cursosData && cursosData.length > 0 && !newCursoId) {
        setNewCursoId(cursosData[0].id);
      }

      // 2. Participantes con datos del curso
      const { data: partData, error } = await supabase
        .from('participantes')
        .select('*, curso:cursos(*)')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error cargando participantes:', error);
      } else {
        setParticipantes(partData || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Cambiar estado de pago
  const handleUpdateEstado = async (ci: string, nuevoEstado: 'PENDIENTE' | 'VERIFICADO' | 'OBSERVADO') => {
    try {
      const { error } = await supabase
        .from('participantes')
        .update({ estado_pago: nuevoEstado, updated_at: new Date().toISOString() })
        .eq('ci', ci);

      if (error) throw error;

      setParticipantes(prev =>
        prev.map(p => (p.ci === ci ? { ...p, estado_pago: nuevoEstado } : p))
      );

      Swal.fire({
        icon: 'success',
        title: 'Estado actualizado',
        text: `Participante con CI ${ci} cambiado a ${nuevoEstado}`,
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000
      });
    } catch (err: any) {
      Swal.fire('Error', err.message || 'No se pudo actualizar el estado', 'error');
    }
  };

  // Eliminar participante
  const handleDeleteParticipante = async (ci: string, nombreCompleto: string) => {
    const result = await Swal.fire({
      title: '¿Eliminar participante?',
      text: `Se eliminará el registro de ${nombreCompleto} (CI: ${ci}).`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        const { error } = await supabase
          .from('participantes')
          .delete()
          .eq('ci', ci);

        if (error) throw error;

        setParticipantes(prev => prev.filter(p => p.ci !== ci));
        Swal.fire('Eliminado', 'El participante fue eliminado.', 'success');
      } catch (err: any) {
        Swal.fire('Error', err.message || 'No se pudo eliminar', 'error');
      }
    }
  };

  // Guardar nuevo participante manual
  const handleAddParticipante = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCi.trim() || !newNombres.trim() || !newApellidos.trim()) {
      Swal.fire('Campos requeridos', 'Por favor complete CI, Nombres y Apellidos', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      const nuevo: any = {
        ci: newCi.trim().toUpperCase(),
        nombres: newNombres.trim().toUpperCase(),
        apellidos: newApellidos.trim().toUpperCase(),
        telefono: newTelefono.trim() || null,
        curso_id: newCursoId || null,
        monto_pago: 150.00,
        estado_pago: 'VERIFICADO',
        created_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('participantes')
        .upsert(nuevo, { onConflict: 'ci' });

      if (error) throw error;

      setShowAddModal(false);
      setNewCi('');
      setNewNombres('');
      setNewApellidos('');
      setNewTelefono('');
      fetchData();

      Swal.fire('Registrado', 'Participante añadido con éxito.', 'success');
    } catch (err: any) {
      Swal.fire('Error', err.message || 'No se pudo registrar', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Exportar a Excel
  const handleExportExcel = () => {
    if (participantes.length === 0) {
      Swal.fire('Sin datos', 'No hay participantes para exportar.', 'info');
      return;
    }

    const headers = ['NRO', 'CI', 'NOMBRES', 'APELLIDOS', 'CURSO', 'TELEFONO', 'ESTADO_PAGO', 'MONTO_BS', 'TIENE_COMPROBANTE', 'TIENE_CARNET', 'FECHA_REGISTRO'];
    const rows = filteredParticipantes.map((p, index) => [
      index + 1,
      `"${p.ci}"`,
      `"${p.nombres}"`,
      `"${p.apellidos}"`,
      `"${p.curso?.nombre || p.curso_id || 'General'}"`,
      `"${p.telefono || ''}"`,
      `"${p.estado_pago || 'PENDIENTE'}"`,
      p.monto_pago || 150,
      p.comprobante_url ? 'SI' : 'NO',
      (p.carnet_anverso_url || p.carnet_escaneado_url) ? 'SI' : 'NO',
      p.created_at ? new Date(p.created_at).toLocaleDateString() : ''
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Participantes_Capacitacion_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtrado de participantes
  const filteredParticipantes = useMemo(() => {
    return participantes.filter(p => {
      const matchSearch =
        p.ci?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.nombres?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.apellidos?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.telefono?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchEstado = filterEstado === 'TODOS' || p.estado_pago === filterEstado;
      const matchCurso = filterCurso === 'TODOS' || p.curso_id === filterCurso;

      return matchSearch && matchEstado && matchCurso;
    });
  }, [participantes, searchTerm, filterEstado, filterCurso]);

  // Estadísticas
  const stats = useMemo(() => {
    const total = filteredParticipantes.length;
    const verificados = filteredParticipantes.filter(p => p.estado_pago === 'VERIFICADO').length;
    const pendientes = filteredParticipantes.filter(p => p.estado_pago === 'PENDIENTE').length;
    const recaudado = verificados * 150;
    return { total, verificados, pendientes, recaudado };
  }, [filteredParticipantes]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Tarjetas de Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div style={{ background: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.03)', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={24} />
          </div>
          <div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Inscritos Mostrados</span>
            <h3 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>{stats.total}</h3>
          </div>
        </div>

        <div style={{ background: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.03)', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle size={24} />
          </div>
          <div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Pagos Verificados</span>
            <h3 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#16a34a' }}>{stats.verificados}</h3>
            <span style={{ fontSize: '11px', color: '#15803d', fontWeight: 600 }}>Bs. {stats.recaudado.toLocaleString()}</span>
          </div>
        </div>

        <div style={{ background: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.03)', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={24} />
          </div>
          <div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Pendientes de Revisión</span>
            <h3 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#d97706' }}>{stats.pendientes}</h3>
          </div>
        </div>
      </div>

      {/* Barra de Control, Búsqueda y Filtros */}
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        padding: '16px 20px',
        border: '1px solid #e2e8f0',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
      }}>
        {/* Buscador */}
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: '340px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '11px', color: '#94a3b8' }} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por CI o Nombre..."
            style={{ width: '100%', padding: '9px 12px 9px 38px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {/* Filtro por Curso */}
        {cursos.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <BookOpen size={16} color="#64748b" />
            <select
              value={filterCurso}
              onChange={(e) => setFilterCurso(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 600, color: '#334155', background: '#fff' }}
            >
              <option value="TODOS">Todos los Cursos ({cursos.length})</option>
              {cursos.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
        )}

        {/* Filtro por Estado */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          {(['TODOS', 'PENDIENTE', 'VERIFICADO', 'OBSERVADO'] as const).map(estado => (
            <button
              key={estado}
              type="button"
              onClick={() => setFilterEstado(estado)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                background: filterEstado === estado ? '#2563eb' : '#f1f5f9',
                color: filterEstado === estado ? '#ffffff' : '#475569'
              }}
            >
              {estado === 'TODOS' ? 'Todos' : estado === 'PENDIENTE' ? 'Pendientes' : estado === 'VERIFICADO' ? 'Verificados' : 'Observados'}
            </button>
          ))}
        </div>

        {/* Botones de acción */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={fetchData}
            title="Recargar datos"
            style={{ padding: '8px 12px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#475569' }}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            style={{ padding: '8px 14px', background: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={15} /> Exportar Excel
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            style={{ padding: '8px 16px', background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={15} /> Nuevo Participante
          </button>
        </div>
      </div>

      {/* Tabla de Participantes */}
      <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                <th style={{ padding: '14px 16px', fontWeight: 700 }}>CI</th>
                <th style={{ padding: '14px 16px', fontWeight: 700 }}>Participante</th>
                <th style={{ padding: '14px 16px', fontWeight: 700 }}>Curso</th>
                <th style={{ padding: '14px 16px', fontWeight: 700 }}>Teléfono / WhatsApp</th>
                <th style={{ padding: '14px 16px', fontWeight: 700 }}>Carnet Escaneado / Fotos</th>
                <th style={{ padding: '14px 16px', fontWeight: 700 }}>Comprobante Pago</th>
                <th style={{ padding: '14px 16px', fontWeight: 700 }}>Estado de Pago</th>
                <th style={{ padding: '14px 16px', fontWeight: 700, textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                    Cargando lista de participantes...
                  </td>
                </tr>
              ) : filteredParticipantes.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                    No se encontraron participantes con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredParticipantes.map((p) => (
                  <tr key={p.ci + (p.curso_id || '')} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    {/* CI */}
                    <td style={{ padding: '14px 16px', fontWeight: 700, color: '#0f172a' }}>
                      {p.ci}
                    </td>

                    {/* Nombres y Apellidos */}
                    <td style={{ padding: '14px 16px' }}>
                      <strong style={{ color: '#1e293b', display: 'block' }}>{p.nombres} {p.apellidos}</strong>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                        {p.created_at ? new Date(p.created_at).toLocaleDateString() : 'Manual'}
                      </span>
                    </td>

                    {/* Curso */}
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        display: 'inline-block'
                      }}>
                        {p.curso?.nombre || p.curso_id || 'Capacitación General'}
                      </span>
                    </td>

                    {/* Teléfono */}
                    <td style={{ padding: '14px 16px', color: '#334155' }}>
                      {p.telefono ? (
                        <a
                          href={`https://wa.me/591${p.telefono.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: '#16a34a', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}
                        >
                          <Phone size={13} /> {p.telefono}
                        </a>
                      ) : (
                        <span style={{ color: '#cbd5e1' }}>—</span>
                      )}
                    </td>

                    {/* Carnet */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {p.carnet_anverso_url && (
                          <button
                            type="button"
                            onClick={() => setModalImage({ url: p.carnet_anverso_url!, title: `Carnet Anverso - ${p.nombres} ${p.apellidos}` })}
                            style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '2px', cursor: 'pointer', background: '#fff', display: 'flex' }}
                            title="Ver Anverso"
                          >
                            <img src={p.carnet_anverso_url} alt="Anverso" style={{ width: '32px', height: '24px', objectFit: 'cover', borderRadius: '4px' }} />
                          </button>
                        )}
                        {p.carnet_reverso_url && (
                          <button
                            type="button"
                            onClick={() => setModalImage({ url: p.carnet_reverso_url!, title: `Carnet Reverso - ${p.nombres} ${p.apellidos}` })}
                            style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '2px', cursor: 'pointer', background: '#fff', display: 'flex' }}
                            title="Ver Reverso"
                          >
                            <img src={p.carnet_reverso_url} alt="Reverso" style={{ width: '32px', height: '24px', objectFit: 'cover', borderRadius: '4px' }} />
                          </button>
                        )}
                        {p.carnet_escaneado_url && (
                          <a
                            href={p.carnet_escaneado_url}
                            target="_blank"
                            rel="noreferrer"
                            style={{ padding: '4px 8px', background: '#f1f5f9', borderRadius: '6px', color: '#334155', fontSize: '11px', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <FileText size={12} /> Doc
                          </a>
                        )}
                        {!p.carnet_anverso_url && !p.carnet_escaneado_url && (
                          <span style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 600 }}>Sin carnet</span>
                        )}
                      </div>
                    </td>

                    {/* Comprobante */}
                    <td style={{ padding: '14px 16px' }}>
                      {p.comprobante_url ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => setModalImage({ url: p.comprobante_url!, title: `Comprobante - ${p.nombres} ${p.apellidos} (CI: ${p.ci})` })}
                            style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '2px', cursor: 'pointer', background: '#fff', display: 'flex' }}
                            title="Ver Comprobante"
                          >
                            <img src={p.comprobante_url} alt="Comprobante" style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '4px' }} />
                          </button>
                          <div>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a', display: 'block' }}>Bs. {p.monto_pago || 150}</span>
                            <button
                              type="button"
                              onClick={() => setModalImage({ url: p.comprobante_url!, title: `Comprobante - ${p.nombres} ${p.apellidos}` })}
                              style={{ background: 'none', border: 'none', padding: 0, color: '#2563eb', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline' }}
                            >
                              Ver recibo
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600 }}>Sin comprobante</span>
                      )}
                    </td>

                    {/* Estado de Pago */}
                    <td style={{ padding: '14px 16px' }}>
                      <select
                        value={p.estado_pago || 'PENDIENTE'}
                        onChange={(e) => handleUpdateEstado(p.ci, e.target.value as any)}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          border: '1px solid transparent',
                          background: p.estado_pago === 'VERIFICADO' ? '#dcfce7' : p.estado_pago === 'OBSERVADO' ? '#fee2e2' : '#fef3c7',
                          color: p.estado_pago === 'VERIFICADO' ? '#15803d' : p.estado_pago === 'OBSERVADO' ? '#b91c1c' : '#92400e',
                          outline: 'none'
                        }}
                      >
                        <option value="PENDIENTE">⏳ PENDIENTE</option>
                        <option value="VERIFICADO">✓ VERIFICADO</option>
                        <option value="OBSERVADO">⚠ OBSERVADO</option>
                      </select>
                    </td>

                    {/* Acciones */}
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleDeleteParticipante(p.ci, `${p.nombres} ${p.apellidos}`)}
                        title="Eliminar participante"
                        style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', padding: '6px', cursor: 'pointer' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL VISOR DE IMÁGENES / COMPROBANTES / CARNETS */}
      {modalImage && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            maxWidth: '850px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0f172a', color: '#ffffff' }}>
              <span style={{ fontWeight: 700, fontSize: '14px' }}>{modalImage.title}</span>
              <button
                type="button"
                onClick={() => setModalImage(null)}
                style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '16px', background: '#1e293b', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto' }}>
              <img src={modalImage.url} alt="Vista previa" style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: '8px' }} />
            </div>
            <div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'flex-end', gap: '8px', background: '#f8fafc' }}>
              <a
                href={modalImage.url}
                target="_blank"
                rel="noreferrer"
                style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', borderRadius: '8px', fontSize: '12px', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <ExternalLink size={14} /> Abrir Original
              </a>
              <button
                type="button"
                onClick={() => setModalImage(null)}
                style={{ padding: '8px 16px', background: '#e2e8f0', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REGISTRAR NUEVO PARTICIPANTE MANUAL */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', maxWidth: '500px', width: '100%', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Registrar Nuevo Participante</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddParticipante} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {cursos.length > 0 && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Curso *
                  </label>
                  <select
                    value={newCursoId}
                    onChange={(e) => setNewCursoId(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box', background: '#fff' }}
                  >
                    {cursos.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Cédula de Identidad (CI) *
                </label>
                <input
                  type="text"
                  required
                  value={newCi}
                  onChange={(e) => setNewCi(e.target.value)}
                  placeholder="Ej: 8934521"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Nombres *
                </label>
                <input
                  type="text"
                  required
                  value={newNombres}
                  onChange={(e) => setNewNombres(e.target.value)}
                  placeholder="Ej: Laura"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Apellidos *
                </label>
                <input
                  type="text"
                  required
                  value={newApellidos}
                  onChange={(e) => setNewApellidos(e.target.value)}
                  placeholder="Ej: Flores Gutierrez"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Teléfono / Celular
                </label>
                <input
                  type="tel"
                  value={newTelefono}
                  onChange={(e) => setNewTelefono(e.target.value)}
                  placeholder="Ej: 71234567"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{ padding: '9px 16px', background: '#f1f5f9', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  style={{ padding: '9px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: isSaving ? 'not-allowed' : 'pointer' }}
                >
                  {isSaving ? 'Guardando...' : 'Guardar Participante'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
