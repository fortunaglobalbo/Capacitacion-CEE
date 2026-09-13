'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import Swal from 'sweetalert2';
import {
  BookOpen,
  Plus,
  Copy,
  ExternalLink,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  RefreshCw,
  MessageCircle,
  DollarSign,
  Users,
  X,
  Sparkles,
  UploadCloud,
  Image as ImageIcon,
  QrCode,
  Eye,
  Check
} from 'lucide-react';
import { CursoCapacitacion } from '@/types';
import PromptIAModal from '@/components/cursos/PromptIAModal';

export default function GestionCursos() {
  const [cursos, setCursos] = useState<CursoCapacitacion[]>([]);
  const [countsByCurso, setCountsByCurso] = useState<{ [cursoId: string]: number }>({});
  const [aficheUrls, setAficheUrls] = useState<{ [cursoId: string]: string }>({});
  const [loading, setLoading] = useState(true);

  // Modal para Crear / Editar Curso
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [cursoId, setCursoId] = useState('');
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [costo, setCosto] = useState<number>(150);
  const [whatsappUrl, setWhatsappUrl] = useState('');
  const [activo, setActivo] = useState(true);
  const [formAficheUrl, setFormAficheUrl] = useState('');
  const [formAficheFile, setFormAficheFile] = useState<File | null>(null);
  const [formAfichePreview, setFormAfichePreview] = useState('');
  const [saving, setSaving] = useState(false);

  // Modal Prompt IA
  const [promptModalCurso, setPromptModalCurso] = useState<CursoCapacitacion | null>(null);

  const fileInputModalRef = useRef<HTMLInputElement>(null);

  // Cargar cursos
  const fetchCursos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cursos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error al cargar cursos:', error);
      } else {
        const cursosList: CursoCapacitacion[] = data || [];
        setCursos(cursosList);

        // Mapear afiches de Supabase y localStorage
        const mapAfiches: { [id: string]: string } = {};
        if (typeof window !== 'undefined') {
          cursosList.forEach(c => {
            const stored = localStorage.getItem(`afiche_curso_${c.id}`);
            if (c.afiche_url || stored) {
              mapAfiches[c.id] = c.afiche_url || stored || '';
            }
          });
        }
        setAficheUrls(mapAfiches);
      }

      // Cargar conteo de participantes por curso
      const { data: partData } = await supabase
        .from('participantes')
        .select('curso_id');

      if (partData) {
        const counts: { [cursoId: string]: number } = {};
        partData.forEach((p) => {
          if (p.curso_id) {
            counts[p.curso_id] = (counts[p.curso_id] || 0) + 1;
          }
        });
        setCountsByCurso(counts);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCursos();
  }, []);

  // Abrir modal para crear
  const handleOpenNew = () => {
    setIsEditing(false);
    setCursoId('');
    setNombre('');
    setDescripcion('');
    setCosto(150);
    setWhatsappUrl('');
    setActivo(true);
    setFormAficheUrl('');
    setFormAficheFile(null);
    setFormAfichePreview('');
    setShowModal(true);
  };

  // Abrir modal para editar
  const handleOpenEdit = (c: CursoCapacitacion) => {
    setIsEditing(true);
    setCursoId(c.id);
    setNombre(c.nombre);
    setDescripcion(c.descripcion || '');
    setCosto(c.costo || 150);
    setWhatsappUrl(c.whatsapp_url || '');
    setActivo(c.activo !== false);
    const existingAfiche = c.afiche_url || aficheUrls[c.id] || '';
    setFormAficheUrl(existingAfiche);
    setFormAfichePreview(existingAfiche);
    setFormAficheFile(null);
    setShowModal(true);
  };

  // Subir afiche desde el formulario
  const handleFormFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) {
        Swal.fire('Archivo inválido', 'Por favor selecciona una imagen (JPG, PNG, WEBP).', 'warning');
        return;
      }
      setFormAficheFile(file);
      setFormAfichePreview(URL.createObjectURL(file));
    }
  };

  // Guardar curso (crear o editar)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanId = cursoId.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '');
    const cleanNombre = nombre.trim();

    if (!cleanId || !cleanNombre) {
      Swal.fire('Campos requeridos', 'Por favor ingrese el identificador (ID) y el nombre del curso.', 'warning');
      return;
    }

    setSaving(true);
    try {
      let finalAficheUrl = formAficheUrl;

      // Si subió un archivo nuevo de afiche
      if (formAficheFile) {
        const formData = new FormData();
        formData.append('file', formAficheFile);
        formData.append('cursoId', cleanId);

        const res = await fetch('/api/afiche/upload', {
          method: 'POST',
          body: formData
        });

        const resData = await res.json();
        if (res.ok && resData.success) {
          finalAficheUrl = resData.url;
        }
      }

      if (finalAficheUrl && typeof window !== 'undefined') {
        localStorage.setItem(`afiche_curso_${cleanId}`, finalAficheUrl);
      }

      const payload: any = {
        id: cleanId,
        nombre: cleanNombre,
        descripcion: descripcion.trim() || null,
        costo: Number(costo) || 150.00,
        whatsapp_url: whatsappUrl.trim() || null,
        activo: activo,
        afiche_url: finalAficheUrl || null,
        updated_at: new Date().toISOString()
      };

      // Intentar guardar en Supabase con fallback si la columna afiche_url no está en el schema de Supabase
      try {
        const { error } = await supabase
          .from('cursos')
          .upsert(payload, { onConflict: 'id' });

        if (error) {
          // Si falló por columna inexistente, intentar sin afiche_url
          delete payload.afiche_url;
          const { error: err2 } = await supabase
            .from('cursos')
            .upsert(payload, { onConflict: 'id' });
          if (err2) throw err2;
        }
      } catch (dbErr: any) {
        delete payload.afiche_url;
        const { error: err2 } = await supabase
          .from('cursos')
          .upsert(payload, { onConflict: 'id' });
        if (err2) throw err2;
      }

      setShowModal(false);
      fetchCursos();

      Swal.fire({
        icon: 'success',
        title: isEditing ? 'Curso actualizado' : 'Curso creado con éxito',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000
      });
    } catch (err: any) {
      Swal.fire('Error', err.message || 'No se pudo guardar el curso.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Eliminar curso
  const handleDelete = async (c: CursoCapacitacion) => {
    const result = await Swal.fire({
      title: `¿Eliminar "${c.nombre}"?`,
      text: 'Los participantes asociados a este curso no se borrarán, pero quedarán sin curso asignado.',
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
          .from('cursos')
          .delete()
          .eq('id', c.id);

        if (error) throw error;

        setCursos(prev => prev.filter(item => item.id !== c.id));
        Swal.fire('Eliminado', 'El curso fue eliminado.', 'success');
      } catch (err: any) {
        Swal.fire('Error', err.message || 'No se pudo eliminar el curso.', 'error');
      }
    }
  };

  // Copiar link directo de inscripción
  const handleCopyLink = (c: CursoCapacitacion) => {
    const url = `${window.location.origin}/inscripciones?curso=${c.id}`;
    navigator.clipboard.writeText(url);
    Swal.fire({
      icon: 'success',
      title: '¡Enlace Copiado!',
      text: `Enlace directo para "${c.nombre}":\n${url}`,
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000
    });
  };

  // Subir afiche rápido desde la tarjeta
  const handleQuickUploadAfiche = async (cursoItem: CursoCapacitacion, file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('cursoId', cursoItem.id);

      const res = await fetch('/api/afiche/upload', {
        method: 'POST',
        body: formData
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.message || 'Error al guardar el afiche');
      }

      const newUrl = resData.url;
      localStorage.setItem(`afiche_curso_${cursoItem.id}`, newUrl);
      setAficheUrls(prev => ({ ...prev, [cursoItem.id]: newUrl }));

      try {
        await supabase
          .from('cursos')
          .update({ afiche_url: newUrl, updated_at: new Date().toISOString() })
          .eq('id', cursoItem.id);
      } catch (e) {
        // Fallback silencioso
      }

      Swal.fire({
        icon: 'success',
        title: '¡Afiche Cargado!',
        text: 'El afiche se ha vinculado correctamente a este curso.',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2500
      });
    } catch (err: any) {
      Swal.fire('Error', err.message || 'No se pudo subir el afiche.', 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Barra de Encabezado y Acción */}
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        padding: '18px 24px',
        border: '1px solid #e2e8f0',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#1e293b' }}>
              Catálogo de Cursos de Capacitación
            </h2>
            <span style={{
              background: '#eff6ff',
              color: '#2563eb',
              fontSize: '11px',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '999px',
              border: '1px solid #bfdbfe'
            }}>
              {cursos.length} Cursos
            </span>
          </div>
          <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748b' }}>
            Cree y gestione cursos, genere afiches y prompts con IA, descargue códigos QR y comparta links directos.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={fetchCursos}
            title="Recargar cursos"
            style={{
              padding: '8px 12px',
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              color: '#475569'
            }}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            type="button"
            onClick={handleOpenNew}
            style={{
              padding: '10px 18px',
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(37,99,235,0.25)'
            }}
          >
            <Plus size={16} /> Crear Nuevo Curso
          </button>
        </div>
      </div>

      {/* Grid de Cursos */}
      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
          <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 10px auto', display: 'block' }} />
          Cargando cursos disponibles...
        </div>
      ) : cursos.length === 0 ? (
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '48px 24px',
          textAlign: 'center',
          border: '1px dashed #cbd5e1'
        }}>
          <BookOpen size={40} color="#94a3b8" style={{ margin: '0 auto 12px auto' }} />
          <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0' }}>
            No hay cursos creados aún
          </h3>
          <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 16px 0' }}>
            Comience creando el primer curso para generar su afiche con IA, código QR y enlace de inscripción.
          </p>
          <button
            type="button"
            onClick={handleOpenNew}
            style={{
              padding: '10px 20px',
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            + Crear Mi Primer Curso
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
          gap: '20px'
        }}>
          {cursos.map(c => {
            const count = countsByCurso[c.id] || 0;
            const aficheUrl = aficheUrls[c.id] || c.afiche_url;

            return (
              <div
                key={c.id}
                style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  border: '1px solid #e2e8f0',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.03)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <div>
                  {/* Encabezado de la Tarjeta */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <span style={{
                      background: '#f1f5f9',
                      color: '#475569',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontFamily: 'monospace'
                    }}>
                      ID: {c.id}
                    </span>

                    <span style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: c.activo !== false ? '#15803d' : '#94a3b8',
                      background: c.activo !== false ? '#dcfce7' : '#f1f5f9',
                      padding: '2px 8px',
                      borderRadius: '9999px'
                    }}>
                      {c.activo !== false ? '● ACTIVO' : '○ INACTIVO'}
                    </span>
                  </div>

                  {/* MINIATURA / BANNER DEL AFICHE */}
                  {aficheUrl ? (
                    <div style={{
                      marginBottom: '14px',
                      borderRadius: '10px',
                      overflow: 'hidden',
                      position: 'relative',
                      height: '140px',
                      backgroundColor: '#0a192f',
                      border: '1px solid #cbd5e1'
                    }}>
                      <img
                        src={aficheUrl}
                        alt={`Afiche de ${c.nombre}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <div style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)',
                        padding: '8px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <span style={{
                          color: '#4ade80',
                          fontSize: '11px',
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <CheckCircle size={13} /> Afiche Oficial Cargado
                        </span>
                        <a
                          href={aficheUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            background: 'rgba(255,255,255,0.2)',
                            color: '#ffffff',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 700,
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                        >
                          <Eye size={11} /> Ver
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      marginBottom: '14px',
                      borderRadius: '10px',
                      border: '2px dashed #e2e8f0',
                      padding: '12px',
                      background: '#f8fafc',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ImageIcon size={18} color="#94a3b8" />
                        <span style={{ fontSize: '11px', color: '#64748b' }}>Sin afiche asignado aún</span>
                      </div>
                      <label style={{
                        padding: '4px 8px',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#2563eb',
                        cursor: 'pointer'
                      }}>
                        + Subir
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleQuickUploadAfiche(c, e.target.files[0]);
                            }
                          }}
                        />
                      </label>
                    </div>
                  )}

                  <h3 style={{ margin: '0 0 6px 0', fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                    {c.nombre}
                  </h3>

                  {c.descripcion && (
                    <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: '#64748b', lineHeight: '1.4' }}>
                      {c.descripcion}
                    </p>
                  )}

                  {/* Datos Clave: Costo, Inscritos, WhatsApp */}
                  <div style={{
                    background: '#f8fafc',
                    borderRadius: '10px',
                    padding: '12px',
                    border: '1px solid #f1f5f9',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    fontSize: '12px',
                    marginBottom: '16px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <DollarSign size={14} color="#16a34a" /> Costo Matrícula:
                      </span>
                      <strong style={{ color: '#16a34a', fontSize: '14px' }}>
                        Bs. {c.costo || 150}
                      </strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Users size={14} color="#2563eb" /> Inscritos registrados:
                      </span>
                      <strong style={{ color: '#0f172a', fontSize: '13px' }}>
                        {count} participantes
                      </strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed #cbd5e1', paddingTop: '6px' }}>
                      <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MessageCircle size={14} color="#16a34a" /> Grupo WhatsApp:
                      </span>
                      {c.whatsapp_url ? (
                        <a
                          href={c.whatsapp_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: '#16a34a', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}
                        >
                          Enlace Activo <ExternalLink size={11} />
                        </a>
                      ) : (
                        <span style={{ color: '#ef4444', fontWeight: 600 }}>Sin configurar</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Acciones de la Tarjeta */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
                  
                  {/* BOTÓN PROMPT IA DESTACADO */}
                  <button
                    type="button"
                    onClick={() => setPromptModalCurso(c)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'linear-gradient(135deg, #0d3b66 0%, #1e3a8a 100%)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 3px 10px rgba(13, 59, 102, 0.25)',
                      letterSpacing: '0.3px'
                    }}
                    title="Abrir generador oficial de afiche con IA, código QR y plantilla de referencia"
                  >
                    <Sparkles size={15} color="#fbbf24" /> PROMPT IA (Afiche & QR)
                  </button>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => handleCopyLink(c)}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        border: '1px solid #bfdbfe',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                      title="Copiar enlace de inscripción directo"
                    >
                      <Copy size={13} /> Copiar Link
                    </button>

                    <a
                      href={`/inscripciones?curso=${c.id}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        padding: '8px 12px',
                        background: '#f8fafc',
                        color: '#334155',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="Abrir formulario de este curso"
                    >
                      <ExternalLink size={14} />
                    </a>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(c)}
                      style={{
                        padding: '6px 12px',
                        background: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#334155',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Edit2 size={13} /> Editar
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(c)}
                      style={{
                        padding: '6px 10px',
                        background: '#fee2e2',
                        border: 'none',
                        borderRadius: '6px',
                        color: '#dc2626',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      title="Eliminar curso"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL CREAR / EDITAR CURSO */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '18px',
            maxWidth: '560px',
            width: '100%',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#f8fafc'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                  {isEditing ? 'Editar Curso' : 'Crear Nuevo Curso'}
                </h3>
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  Configura los detalles del curso, afiche y grupo de WhatsApp
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setPromptModalCurso({
                      id: cursoId || 'nuevo-curso',
                      nombre: nombre || 'Curso de Capacitación',
                      descripcion,
                      costo,
                      whatsapp_url: whatsappUrl,
                      afiche_url: formAficheUrl
                    });
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '6px 12px',
                    background: 'linear-gradient(135deg, #0d3b66 0%, #1e40af 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                  title="Abrir generador de Prompt IA para este curso"
                >
                  <Sparkles size={13} color="#fbbf24" /> PROMPT IA
                </button>

                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <form onSubmit={handleSave} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  ID / Código del Curso * <span style={{ color: '#64748b', fontSize: '11px' }}>(sin espacios, ej: operador-pc)</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={isEditing}
                  value={cursoId}
                  onChange={(e) => setCursoId(e.target.value)}
                  placeholder="Ej: operador-pc"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                    background: isEditing ? '#f8fafc' : '#ffffff'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Nombre del Curso *
                </label>
                <input
                  type="text"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Trabajo en Altura y Espacios Confinados en Electricidad"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Contenido / ¿Qué aprenderás?
                </label>
                <textarea
                  rows={2}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Temario clave para el afiche y descripción..."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Costo (BOB) *
                  </label>
                  <input
                    type="number"
                    required
                    step="1"
                    min="0"
                    value={costo}
                    onChange={(e) => setCosto(Number(e.target.value))}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Estado del Curso
                  </label>
                  <select
                    value={activo ? 'true' : 'false'}
                    onChange={(e) => setActivo(e.target.value === 'true')}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                  >
                    <option value="true">Activo (Acepta Inscripciones)</option>
                    <option value="false">Inactivo (Cerrado)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#15803d', marginBottom: '4px' }}>
                  Enlace al Grupo Oficial de WhatsApp
                </label>
                <div style={{ position: 'relative' }}>
                  <MessageCircle size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#16a34a' }} />
                  <input
                    type="url"
                    value={whatsappUrl}
                    onChange={(e) => setWhatsappUrl(e.target.value)}
                    placeholder="https://chat.whatsapp.com/..."
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 36px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* ZONA SUBIR O ARRASTRAR AFICHE EN EL FORMULARIO */}
              <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  <span>Afiche Publicitario (Opcional):</span>
                  <span style={{ color: '#2563eb', cursor: 'pointer' }} onClick={() => fileInputModalRef.current?.click()}>
                    Seleccionar imagen
                  </span>
                </label>

                <input
                  ref={fileInputModalRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFormFileChange}
                  style={{ display: 'none' }}
                />

                <div
                  onClick={() => fileInputModalRef.current?.click()}
                  style={{
                    border: '2px dashed #cbd5e1',
                    borderRadius: '10px',
                    padding: '16px',
                    textAlign: 'center',
                    background: '#f8fafc',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {formAfichePreview ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <img
                        src={formAfichePreview}
                        alt="Preview"
                        style={{ height: '70px', width: 'auto', borderRadius: '6px', objectFit: 'contain', border: '1px solid #cbd5e1' }}
                      />
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#15803d' }}>
                          Afiche listo para guardar
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          Haz clic para cambiar imagen
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <UploadCloud size={24} color="#64748b" />
                      <span style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>
                        Haz clic o arrastra aquí el afiche del curso
                      </span>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                        JPG, PNG o WEBP
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ padding: '9px 16px', background: '#f1f5f9', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '9px 20px',
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: saving ? 'not-allowed' : 'pointer'
                  }}
                >
                  {saving ? 'Guardando...' : (isEditing ? 'Actualizar Curso' : 'Crear Curso')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PROMPT IA */}
      {promptModalCurso && (
        <PromptIAModal
          curso={promptModalCurso}
          onClose={() => setPromptModalCurso(null)}
          onAficheSaved={(newAficheUrl) => {
            setAficheUrls(prev => ({ ...prev, [promptModalCurso.id]: newAficheUrl }));
            fetchCursos();
          }}
        />
      )}

    </div>
  );
}
