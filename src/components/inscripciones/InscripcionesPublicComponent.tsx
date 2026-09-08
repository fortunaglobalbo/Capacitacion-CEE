'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import Swal from 'sweetalert2';
import {
  QrCode,
  UploadCloud,
  FileCheck2,
  User,
  CreditCard,
  Camera,
  CheckCircle2,
  Copy,
  Download,
  Search,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  RefreshCw,
  Phone,
  BookOpen,
  MessageCircle,
  ExternalLink,
  Sparkles,
  Check,
  BadgeAlert
} from 'lucide-react';
import { Participante, CursoCapacitacion } from '@/types';

export function InscripcionesPublicComponent() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Cargando formulario...</div>}>
      <InscripcionesPublicContent />
    </Suspense>
  );
}

function InscripcionesPublicContent() {
  const searchParams = useSearchParams();
  const urlCursoId = searchParams.get('curso') || '';

  // Tab activo: Formulario o Consulta
  const [activeTab, setActiveTab] = useState<'formulario' | 'consulta'>('formulario');

  // Cursos disponibles
  const [cursos, setCursos] = useState<CursoCapacitacion[]>([]);
  const [selectedCursoId, setSelectedCursoId] = useState<string>(urlCursoId);
  const [selectedCurso, setSelectedCurso] = useState<CursoCapacitacion | null>(null);
  const [loadingCursos, setLoadingCursos] = useState(true);

  // Paso actual del Wizard: 1 = Datos, 2 = Carnet, 3 = Pago QR
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Datos del participante (Paso 1)
  const [ci, setCi] = useState('');
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [telefono, setTelefono] = useState('');

  // Carnet (Paso 2)
  const [carnetMode, setCarnetMode] = useState<'fotos' | 'escaneado'>('fotos');
  const [carnetAnverso, setCarnetAnverso] = useState<File | null>(null);
  const [carnetAnversoPreview, setCarnetAnversoPreview] = useState<string | null>(null);
  const [carnetReverso, setCarnetReverso] = useState<File | null>(null);
  const [carnetReversoPreview, setCarnetReversoPreview] = useState<string | null>(null);
  const [carnetEscaneado, setCarnetEscaneado] = useState<File | null>(null);
  const [carnetEscaneadoName, setCarnetEscaneadoName] = useState<string | null>(null);

  // Comprobante de Pago (Paso 3)
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [comprobantePreview, setComprobantePreview] = useState<string | null>(null);

  // Estados de envío y éxito (Paso 4)
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registeredParticipant, setRegisteredParticipant] = useState<Participante | null>(null);

  // Estado de consulta
  const [searchCi, setSearchCi] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Participante[]>([]);
  const [searchPerformed, setSearchPerformed] = useState(false);

  // Refs para inputs file
  const anversoInputRef = useRef<HTMLInputElement>(null);
  const reversoInputRef = useRef<HTMLInputElement>(null);
  const escaneadoInputRef = useRef<HTMLInputElement>(null);
  const comprobanteInputRef = useRef<HTMLInputElement>(null);

  // 1. Cargar lista de cursos activos
  useEffect(() => {
    const loadCursos = async () => {
      setLoadingCursos(true);
      try {
        const { data, error } = await supabase
          .from('cursos')
          .select('*')
          .order('nombre', { ascending: true });

        if (!error && data) {
          setCursos(data);

          // Si vino urlCursoId, seleccionarlo
          if (urlCursoId) {
            const found = data.find(c => c.id === urlCursoId);
            if (found) {
              setSelectedCursoId(found.id);
              setSelectedCurso(found);
            } else if (data.length > 0) {
              setSelectedCursoId(data[0].id);
              setSelectedCurso(data[0]);
            }
          } else if (data.length > 0) {
            setSelectedCursoId(data[0].id);
            setSelectedCurso(data[0]);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingCursos(false);
      }
    };

    loadCursos();
  }, [urlCursoId]);

  // Actualizar objeto selectedCurso cuando cambie selectedCursoId
  const handleSelectCurso = (id: string) => {
    setSelectedCursoId(id);
    const found = cursos.find(c => c.id === id);
    setSelectedCurso(found || null);
  };

  // Copiar cuenta bancaria
  const handleCopyAccount = () => {
    navigator.clipboard.writeText('4983644011');
    Swal.fire({
      icon: 'success',
      title: '¡Copiado!',
      text: 'Número de cuenta 4983644011 copiado al portapapeles',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 2000
    });
  };

  // Previsualización de archivos
  const fileToPreview = (file: File, callback: (url: string) => void) => {
    const reader = new FileReader();
    reader.onload = () => callback(reader.result as string);
    reader.readAsDataURL(file);
  };

  // Subir archivo a Supabase Storage con fallback
  const uploadFile = async (bucket: string, folder: string, file: File, prefix: string): Promise<string> => {
    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const cleanCi = ci.replace(/\s+/g, '_');
      const fileName = `${prefix}_${cleanCi}_${Date.now()}.${fileExt}`;
      const filePath = `${folder}/${fileName}`;

      const { data, error } = await supabase.storage.from(bucket).upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

      if (!error && data) {
        const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
        return publicUrlData.publicUrl;
      }

      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    } catch {
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    }
  };

  // Validaciones y avance de pasos
  const handleNextStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCursoId) {
      Swal.fire('Seleccione un Curso', 'Por favor seleccione el curso en el que desea capacitarse.', 'warning');
      return;
    }
    if (!ci.trim() || !nombres.trim() || !apellidos.trim()) {
      Swal.fire('Campos requeridos', 'Por favor complete su Cédula de Identidad (CI), Nombres y Apellidos.', 'warning');
      return;
    }
    setCurrentStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNextStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    if (carnetMode === 'fotos') {
      if (!carnetAnverso || !carnetReverso) {
        Swal.fire('Cédula de Identidad', 'Por favor adjunte o tome la foto tanto del Anverso (frente) como del Reverso (atrás) de su carnet.', 'warning');
        return;
      }
    } else {
      if (!carnetEscaneado) {
        Swal.fire('Carnet escaneado', 'Por favor adjunte el archivo escaneado de su cédula de identidad.', 'warning');
        return;
      }
    }
    setCurrentStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Envío final (Paso 3 a Paso 4)
  const handleSubmitFinal = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!comprobante) {
      Swal.fire('Comprobante requerido', 'Por favor adjunte la captura o foto del comprobante de pago.', 'warning');
      return;
    }

    setIsSubmitting(true);

    try {
      const cleanCi = ci.trim().toUpperCase();
      const cleanNombres = nombres.trim().toUpperCase();
      const cleanApellidos = apellidos.trim().toUpperCase();
      const cleanTelefono = telefono.trim();

      // 1. Subir archivos
      let anversoUrl = '';
      let reversoUrl = '';
      let escaneadoUrl = '';
      let comprobanteUrl = '';

      if (carnetMode === 'fotos') {
        if (carnetAnverso) anversoUrl = await uploadFile('carnets', 'anversos', carnetAnverso, 'ci_anv');
        if (carnetReverso) reversoUrl = await uploadFile('carnets', 'reversos', carnetReverso, 'ci_rev');
      } else if (carnetEscaneado) {
        escaneadoUrl = await uploadFile('carnets', 'escaneados', carnetEscaneado, 'ci_esc');
      }

      comprobanteUrl = await uploadFile('comprobantes', 'pagos', comprobante, 'pago_150');

      // 2. Guardar participante
      const payload: any = {
        ci: cleanCi,
        nombres: cleanNombres,
        apellidos: cleanApellidos,
        telefono: cleanTelefono || null,
        curso_id: selectedCursoId,
        carnet_anverso_url: anversoUrl || null,
        carnet_reverso_url: reversoUrl || null,
        carnet_escaneado_url: escaneadoUrl || null,
        comprobante_url: comprobanteUrl || null,
        monto_pago: selectedCurso?.costo || 150.00,
        estado_pago: 'PENDIENTE',
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('participantes')
        .upsert(payload, { onConflict: 'ci,curso_id' })
        .select('*, curso:cursos(*)')
        .single();

      if (error) {
        // Si no tiene constraint compuesta aún, intentar por CI
        const { data: dataFallback, error: errFallback } = await supabase
          .from('participantes')
          .upsert(payload, { onConflict: 'ci' })
          .select('*, curso:cursos(*)')
          .single();

        if (errFallback) throw errFallback;
        setRegisteredParticipant((dataFallback as any) || payload);
      } else {
        setRegisteredParticipant((data as any) || payload);
      }

      setCurrentStep(4);
      window.scrollTo({ top: 0, behavior: 'smooth' });

      Swal.fire({
        icon: 'success',
        title: '¡Inscripción Exitosa!',
        text: 'Tus datos y comprobante fueron recibidos. Ahora puedes unirte al Grupo de WhatsApp del curso.',
        confirmButtonColor: '#16a34a'
      });
    } catch (err: any) {
      console.error(err);
      Swal.fire('Error al enviar', err.message || 'Ocurrió un error. Verifique su conexión y vuelva a intentar.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Buscar estado por CI
  const handleSearchCi = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCi = searchCi.trim().toUpperCase();
    if (!cleanCi) return;

    setIsSearching(true);
    setSearchPerformed(true);
    setSearchResults([]);

    try {
      const { data, error } = await supabase
        .from('participantes')
        .select('*, curso:cursos(*)')
        .eq('ci', cleanCi);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (err: any) {
      Swal.fire('Error', err.message || 'No se pudo consultar el estado.', 'error');
    } finally {
      setIsSearching(false);
    }
  };

  // Reiniciar formulario
  const handleReset = () => {
    setCi('');
    setNombres('');
    setApellidos('');
    setTelefono('');
    setCarnetAnverso(null);
    setCarnetAnversoPreview(null);
    setCarnetReverso(null);
    setCarnetReversoPreview(null);
    setCarnetEscaneado(null);
    setCarnetEscaneadoName(null);
    setComprobante(null);
    setComprobantePreview(null);
    setRegisteredParticipant(null);
    setCurrentStep(1);
  };

  return (
    <div style={{ maxWidth: '880px', margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* ENCABEZADO INSTITUCIONAL */}
      <header style={{
        background: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)',
        borderRadius: '20px',
        padding: '24px 20px',
        color: '#ffffff',
        boxShadow: '0 12px 30px rgba(0, 0, 0, 0.12)',
        marginBottom: '20px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '50%',
            padding: '3px',
            width: '70px',
            height: '70px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
            flexShrink: 0
          }}>
            <Image
              src="/logo-cee.png"
              alt="Logo Martha Mendoza"
              width={64}
              height={64}
              style={{ objectFit: 'contain' }}
              priority
            />
          </div>
          <div>
            <span style={{
              display: 'inline-block',
              background: 'rgba(59, 130, 246, 0.25)',
              color: '#93c5fd',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              padding: '3px 8px',
              borderRadius: '9999px',
              marginBottom: '3px',
              border: '1px solid rgba(147, 197, 253, 0.3)'
            }}>
              C.E.A. Martha Mendoza • Sucre - Bolivia
            </span>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, letterSpacing: '-0.5px', color: '#f1f5f9' }}>
              Curso de Capacitación
            </h1>
            <p style={{ margin: '2px 0 0 0', color: '#cbd5e1', fontSize: '13px' }}>
              Formulario de Inscripción y Validación de Pago
            </p>
          </div>
        </div>

        {/* Pestañas Formulario / Consulta */}
        <div style={{ display: 'flex', gap: '6px', background: 'rgba(255,255,255,0.1)', padding: '4px', borderRadius: '10px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('formulario')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: activeTab === 'formulario' ? '#3b82f6' : 'transparent',
              color: '#ffffff'
            }}
          >
            <Sparkles size={15} /> Inscribirme
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('consulta')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: activeTab === 'consulta' ? '#3b82f6' : 'transparent',
              color: '#ffffff'
            }}
          >
            <Search size={15} /> Consultar Estado
          </button>
        </div>
      </header>

      {/* PESTAÑA FORMULARIO */}
      {activeTab === 'formulario' && (
        <div>
          {/* CURSO SELECCIONADO (BANNER DESTACADO) */}
          {selectedCurso && currentStep !== 4 && (
            <div style={{
              background: '#eff6ff',
              borderRadius: '14px',
              border: '1px solid #bfdbfe',
              padding: '14px 18px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: '#2563eb', color: '#fff', width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <BookOpen size={20} />
                </div>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase' }}>
                    Curso Seleccionado:
                  </span>
                  <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                    {selectedCurso.nombre}
                  </h2>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ background: '#dcfce7', color: '#15803d', padding: '4px 10px', borderRadius: '8px', fontSize: '13px', fontWeight: 800 }}>
                  Matrícula: Bs. {selectedCurso.costo || 150}
                </span>

                {cursos.length > 1 && currentStep === 1 && (
                  <select
                    value={selectedCursoId}
                    onChange={(e) => handleSelectCurso(e.target.value)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12px',
                      background: '#fff',
                      fontWeight: 600,
                      color: '#334155'
                    }}
                  >
                    {cursos.map(c => (
                      <option key={c.id} value={c.id}>
                        Cambiar a: {c.nombre}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          )}

          {/* INDICADOR DE PASOS (WIZARD) */}
          {currentStep !== 4 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '24px',
              position: 'relative'
            }}>
              {[
                { step: 1, label: '1. Datos Personales', icon: User },
                { step: 2, label: '2. Carnet de Identidad', icon: CreditCard },
                { step: 3, label: '3. Pago QR Banco BISA', icon: QrCode },
              ].map((item, idx) => {
                const IconComponent = item.icon;
                const isCurrent = currentStep === item.step;
                const isPassed = currentStep > item.step;

                return (
                  <div
                    key={item.step}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      position: 'relative',
                      zIndex: 2
                    }}
                  >
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      background: isPassed ? '#16a34a' : isCurrent ? '#2563eb' : '#e2e8f0',
                      color: isPassed || isCurrent ? '#ffffff' : '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '14px',
                      boxShadow: isCurrent ? '0 0 0 4px rgba(37,99,235,0.2)' : 'none',
                      transition: 'all 0.2s ease',
                      marginBottom: '6px'
                    }}>
                      {isPassed ? <Check size={18} /> : <IconComponent size={18} />}
                    </div>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: isCurrent ? 800 : 600,
                      color: isCurrent ? '#1e293b' : '#64748b'
                    }}>
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* PASO 1: DATOS PERSONALES */}
          {currentStep === 1 && (
            <form onSubmit={handleNextStep1} style={{
              background: '#ffffff',
              borderRadius: '16px',
              padding: '24px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 16px rgba(0,0,0,0.03)'
            }}>
              <div style={{ marginBottom: '18px' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                  Paso 1: Datos Personales del Participante
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                  Complete su información tal como figura en su documento de identidad.
                </p>
              </div>

              {/* Selector de Curso si hay varios y no vino fijado */}
              {cursos.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                    Seleccione el Curso de Capacitación *
                  </label>
                  <select
                    required
                    value={selectedCursoId}
                    onChange={(e) => handleSelectCurso(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '11px 14px',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                      color: '#0f172a',
                      outline: 'none',
                      boxSizing: 'border-box',
                      background: '#f8fafc'
                    }}
                  >
                    {cursos.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.nombre} — (Matrícula: Bs. {c.costo || 150})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Cédula de Identidad (CI) <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={ci}
                    onChange={(e) => setCi(e.target.value)}
                    placeholder="Ej: 8934521 CH"
                    style={{
                      width: '100%',
                      padding: '11px 14px',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                      Nombres <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={nombres}
                      onChange={(e) => setNombres(e.target.value)}
                      placeholder="Ej: Juan Carlos"
                      style={{
                        width: '100%',
                        padding: '11px 14px',
                        borderRadius: '10px',
                        border: '1px solid #cbd5e1',
                        fontSize: '14px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                      Apellidos <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={apellidos}
                      onChange={(e) => setApellidos(e.target.value)}
                      placeholder="Ej: Perez Mamani"
                      style={{
                        width: '100%',
                        padding: '11px 14px',
                        borderRadius: '10px',
                        border: '1px solid #cbd5e1',
                        fontSize: '14px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Teléfono Celular / WhatsApp <span style={{ color: '#16a34a', fontSize: '12px' }}>(Muy importante para contacto)</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Phone size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: '#94a3b8' }} />
                    <input
                      type="tel"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      placeholder="Ej: 71234567"
                      style={{
                        width: '100%',
                        padding: '11px 14px 11px 36px',
                        borderRadius: '10px',
                        border: '1px solid #cbd5e1',
                        fontSize: '14px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  style={{
                    padding: '12px 24px',
                    borderRadius: '10px',
                    border: 'none',
                    background: '#2563eb',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(37,99,235,0.25)'
                  }}
                >
                  Siguiente: Subir Carnet <ArrowRight size={16} />
                </button>
              </div>
            </form>
          )}

          {/* PASO 2: CÉDULA DE IDENTIDAD */}
          {currentStep === 2 && (
            <form onSubmit={handleNextStep2} style={{
              background: '#ffffff',
              borderRadius: '16px',
              padding: '24px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 16px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                    Paso 2: Cédula de Identidad de {nombres || 'Participante'}
                  </h3>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                    Suba fotos legibles de su documento o un archivo escaneado.
                  </p>
                </div>

                {/* Alternar modo */}
                <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setCarnetMode('fotos')}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: 700,
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      background: carnetMode === 'fotos' ? '#ffffff' : 'transparent',
                      color: carnetMode === 'fotos' ? '#1e293b' : '#64748b',
                      boxShadow: carnetMode === 'fotos' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none'
                    }}
                  >
                    Fotos (Anverso y Reverso)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCarnetMode('escaneado')}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: 700,
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      background: carnetMode === 'escaneado' ? '#ffffff' : 'transparent',
                      color: carnetMode === 'escaneado' ? '#1e293b' : '#64748b',
                      boxShadow: carnetMode === 'escaneado' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none'
                    }}
                  >
                    Escaneado (PDF/Doc)
                  </button>
                </div>
              </div>

              {carnetMode === 'fotos' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                  {/* Foto Anverso */}
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      Foto Anverso (Frente) <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      ref={anversoInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          setCarnetAnverso(f);
                          fileToPreview(f, (url) => setCarnetAnversoPreview(url));
                        }
                      }}
                    />
                    <div
                      onClick={() => anversoInputRef.current?.click()}
                      style={{
                        border: '2px dashed #cbd5e1',
                        borderRadius: '12px',
                        padding: '16px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: carnetAnversoPreview ? '#f8fafc' : '#fcfcfd',
                        minHeight: '140px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                    >
                      {carnetAnversoPreview ? (
                        <div style={{ position: 'relative', width: '100%', height: '120px' }}>
                          <img src={carnetAnversoPreview} alt="Anverso" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '8px' }} />
                          <span style={{ position: 'absolute', bottom: '4px', right: '4px', background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: '10px', padding: '2px 8px', borderRadius: '4px' }}>
                            Cambiar
                          </span>
                        </div>
                      ) : (
                        <>
                          <Camera size={28} color="#3b82f6" />
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>Subir o Tomar Foto</span>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>Parte frontal de su carnet</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Foto Reverso */}
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      Foto Reverso (Atrás) <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      ref={reversoInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          setCarnetReverso(f);
                          fileToPreview(f, (url) => setCarnetReversoPreview(url));
                        }
                      }}
                    />
                    <div
                      onClick={() => reversoInputRef.current?.click()}
                      style={{
                        border: '2px dashed #cbd5e1',
                        borderRadius: '12px',
                        padding: '16px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: carnetReversoPreview ? '#f8fafc' : '#fcfcfd',
                        minHeight: '140px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                    >
                      {carnetReversoPreview ? (
                        <div style={{ position: 'relative', width: '100%', height: '120px' }}>
                          <img src={carnetReversoPreview} alt="Reverso" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '8px' }} />
                          <span style={{ position: 'absolute', bottom: '4px', right: '4px', background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: '10px', padding: '2px 8px', borderRadius: '4px' }}>
                            Cambiar
                          </span>
                        </div>
                      ) : (
                        <>
                          <Camera size={28} color="#3b82f6" />
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>Subir o Tomar Foto</span>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>Parte posterior de su carnet</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Modo Escaneado */
                <div style={{ marginBottom: '24px' }}>
                  <input
                    ref={escaneadoInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setCarnetEscaneado(f);
                        setCarnetEscaneadoName(f.name);
                      }
                    }}
                  />
                  <div
                    onClick={() => escaneadoInputRef.current?.click()}
                    style={{
                      border: '2px dashed #cbd5e1',
                      borderRadius: '12px',
                      padding: '28px 16px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: carnetEscaneadoName ? '#f0fdf4' : '#fcfcfd',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    {carnetEscaneadoName ? (
                      <>
                        <FileCheck2 size={36} color="#16a34a" />
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#15803d' }}>
                          {carnetEscaneadoName}
                        </span>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>Clic para cambiar archivo</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud size={32} color="#64748b" />
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                          Adjuntar Cédula Escaneada (PDF o Imagen)
                        </span>
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                          Documento completo anverso y reverso
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Botones de navegación */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#475569',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <ArrowLeft size={16} /> Volver a Datos
                </button>

                <button
                  type="submit"
                  style={{
                    padding: '12px 24px',
                    borderRadius: '10px',
                    border: 'none',
                    background: '#2563eb',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(37,99,235,0.25)'
                  }}
                >
                  Siguiente: Pago QR <ArrowRight size={16} />
                </button>
              </div>
            </form>
          )}

          {/* PASO 3: PAGO QR BANCO BISA Y COMPROBANTE */}
          {currentStep === 3 && (
            <form onSubmit={handleSubmitFinal} style={{
              background: '#ffffff',
              borderRadius: '16px',
              padding: '24px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 16px rgba(0,0,0,0.03)'
            }}>
              <div style={{ marginBottom: '18px' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                  Paso 3: Pago Oficial con QR Banco BISA
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                  Realice la transferencia bancaria por el monto oficial y suba su comprobante.
                </p>
              </div>

              {/* Tarjeta del QR Banco BISA */}
              <div style={{
                background: 'linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%)',
                borderRadius: '16px',
                padding: '18px',
                border: '1px solid #cbd5e1',
                marginBottom: '20px',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-around',
                gap: '16px'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    width: '180px',
                    height: '180px',
                    background: '#ffffff',
                    padding: '8px',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    margin: '0 auto 8px auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <img
                      src="/qr-pago-bisa.png"
                      alt="QR Banco BISA"
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  </div>
                  <a
                    href="/qr-pago-bisa.png"
                    download="QR_Pago_Banco_BISA_150Bs.png"
                    style={{
                      padding: '5px 10px',
                      background: '#334155',
                      color: '#ffffff',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 600,
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Download size={12} /> Descargar QR
                  </a>
                </div>

                <div style={{ flex: '1 1 260px', background: '#ffffff', borderRadius: '12px', padding: '16px', border: '1px solid #e2e8f0', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: '#64748b' }}>Entidad:</span>
                    <strong style={{ color: '#0f172a' }}>Banco BISA</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: '#64748b' }}>Cuenta:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <strong style={{ color: '#0f172a' }}>4983644011</strong>
                      <button
                        type="button"
                        onClick={handleCopyAccount}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', padding: 0 }}
                        title="Copiar cuenta"
                      >
                        <Copy size={13} />
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: '#64748b' }}>Beneficiario:</span>
                    <strong style={{ color: '#0f172a' }}>TORREZ SANCHEZ MISAEL</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: '#64748b' }}>Motivo:</span>
                    <strong style={{ color: '#0f172a' }}>CURSOS DE FORMACIÓN CONTINUA</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #cbd5e1', paddingTop: '6px', marginTop: '6px' }}>
                    <span style={{ fontWeight: 700, color: '#16a34a' }}>Monto a Pagar:</span>
                    <strong style={{ fontWeight: 800, fontSize: '15px', color: '#16a34a' }}>
                      BOB {selectedCurso?.costo || 150}.00
                    </strong>
                  </div>
                </div>
              </div>

              {/* Subida del comprobante */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>
                  Subir Comprobante de Depósito / Transferencia <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  ref={comprobanteInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setComprobante(f);
                      fileToPreview(f, (url) => setComprobantePreview(url));
                    }
                  }}
                />
                <div
                  onClick={() => comprobanteInputRef.current?.click()}
                  style={{
                    border: '2px dashed #93c5fd',
                    borderRadius: '12px',
                    padding: '20px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: comprobantePreview ? '#f0fdf4' : '#eff6ff',
                    minHeight: '130px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  {comprobantePreview ? (
                    <div style={{ position: 'relative', width: '100%', height: '120px' }}>
                      <img src={comprobantePreview} alt="Comprobante" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '8px' }} />
                      <span style={{ position: 'absolute', bottom: '4px', right: '4px', background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: '10px', padding: '2px 8px', borderRadius: '4px' }}>
                        Cambiar Comprobante
                      </span>
                    </div>
                  ) : (
                    <>
                      <UploadCloud size={30} color="#2563eb" />
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#1d4ed8' }}>
                        Adjuntar Comprobante o Captura de Pantalla
                      </span>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        Foto o imagen nítida del recibo de pago
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Botones de navegación */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#475569',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <ArrowLeft size={16} /> Volver a Carnet
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: '14px 28px',
                    borderRadius: '10px',
                    border: 'none',
                    background: isSubmitting ? '#94a3b8' : '#16a34a',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: '14px',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 14px rgba(22,163,74,0.3)'
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" /> Registrando Inscripción...
                    </>
                  ) : (
                    <>
                      Confirmar y Finalizar Inscripción 🚀
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* PASO 4: CONFIRMACIÓN EXITOSA + ENLACE GRUPO DE WHATSAPP */}
          {currentStep === 4 && registeredParticipant && (
            <div style={{
              background: '#ffffff',
              borderRadius: '20px',
              padding: '36px 24px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.06)',
              textAlign: 'center',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{
                width: '72px',
                height: '72px',
                background: '#dcfce7',
                color: '#15803d',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto'
              }}>
                <CheckCircle2 size={42} />
              </div>

              <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0' }}>
                ¡Inscripción Recibida Exitosamente!
              </h2>
              <p style={{ color: '#64748b', fontSize: '14px', maxWidth: '540px', margin: '0 auto 20px auto' }}>
                Estimado(a) <strong>{registeredParticipant.nombres} {registeredParticipant.apellidos}</strong>, su solicitud fue registrada.
              </p>

              {/* BOTÓN DESTACADO DE WHATSAPP */}
              {selectedCurso?.whatsapp_url && (
                <div style={{
                  background: 'linear-gradient(135deg, #25d366 0%, #128c7e 100%)',
                  borderRadius: '16px',
                  padding: '20px',
                  color: '#ffffff',
                  maxWidth: '520px',
                  margin: '0 auto 24px auto',
                  boxShadow: '0 8px 24px rgba(37, 211, 102, 0.35)',
                  textAlign: 'center'
                }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.9, display: 'block', marginBottom: '6px' }}>
                    Paso Importante para Clases
                  </span>
                  <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', fontWeight: 800 }}>
                    Únase al Grupo Oficial de WhatsApp
                  </h3>
                  <p style={{ margin: '0 0 16px 0', fontSize: '13px', opacity: 0.95 }}>
                    Por este medio se coordinarán los enlaces de clases, cronogramas y comunicados del curso <strong>"{selectedCurso.nombre}"</strong>.
                  </p>
                  <a
                    href={selectedCurso.whatsapp_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      padding: '12px 24px',
                      background: '#ffffff',
                      color: '#075e54',
                      borderRadius: '10px',
                      fontWeight: 800,
                      fontSize: '14px',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                    }}
                  >
                    <MessageCircle size={18} /> Ingresar al Grupo de WhatsApp <ExternalLink size={14} />
                  </a>
                </div>
              )}

              {/* Resumen del registro */}
              <div style={{
                background: '#f8fafc',
                borderRadius: '14px',
                padding: '16px',
                maxWidth: '460px',
                margin: '0 auto 24px auto',
                border: '1px solid #e2e8f0',
                textAlign: 'left',
                fontSize: '13px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: '#64748b' }}>Curso:</span>
                  <strong style={{ color: '#0f172a' }}>{selectedCurso?.nombre}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: '#64748b' }}>Cédula (CI):</span>
                  <strong style={{ color: '#0f172a' }}>{registeredParticipant.ci}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: '#64748b' }}>Monto Pagado:</span>
                  <strong style={{ color: '#16a34a' }}>BOB {registeredParticipant.monto_pago || 150}.00</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#64748b' }}>Estado:</span>
                  <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 700 }}>
                    PENDIENTE DE VALIDACIÓN
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleReset}
                style={{
                  padding: '10px 20px',
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Inscribir a Otra Persona
              </button>
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA CONSULTA DE ESTADO */}
      {activeTab === 'consulta' && (
        <div style={{
          background: '#ffffff',
          borderRadius: '20px',
          padding: '32px 24px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.05)',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ maxWidth: '520px', margin: '0 auto', textAlign: 'center' }}>
            <div style={{ width: '50px', height: '50px', background: '#dbeafe', color: '#1d4ed8', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
              <Search size={24} />
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0' }}>
              Consultar Estado de Inscripción
            </h2>
            <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 20px 0' }}>
              Ingrese su Cédula de Identidad (CI) para verificar sus cursos y pagos.
            </p>

            <form onSubmit={handleSearchCi} style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
              <input
                type="text"
                required
                value={searchCi}
                onChange={(e) => setSearchCi(e.target.value)}
                placeholder="Número de CI (Ej: 8934521)"
                style={{
                  flex: 1,
                  padding: '11px 14px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
              <button
                type="submit"
                disabled={isSearching}
                style={{
                  padding: '11px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#2563eb',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: isSearching ? 'not-allowed' : 'pointer'
                }}
              >
                {isSearching ? 'Buscando...' : 'Consultar'}
              </button>
            </form>

            {searchPerformed && (
              <>
                {searchResults.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
                    {searchResults.map((item, idx) => (
                      <div key={idx} style={{
                        background: '#f8fafc',
                        borderRadius: '14px',
                        padding: '16px',
                        border: '1px solid #cbd5e1'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <strong style={{ color: '#0f172a', fontSize: '15px' }}>
                            {item.curso?.nombre || 'Curso de Capacitación'}
                          </strong>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '9999px',
                            fontSize: '11px',
                            fontWeight: 700,
                            background: item.estado_pago === 'VERIFICADO' ? '#dcfce7' : item.estado_pago === 'OBSERVADO' ? '#fee2e2' : '#fef3c7',
                            color: item.estado_pago === 'VERIFICADO' ? '#15803d' : item.estado_pago === 'OBSERVADO' ? '#b91c1c' : '#92400e'
                          }}>
                            {item.estado_pago || 'PENDIENTE'}
                          </span>
                        </div>

                        <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#475569' }}>
                          Participante: <strong>{item.nombres} {item.apellidos}</strong> (CI: {item.ci})
                        </p>

                        {/* Botón WhatsApp si el curso tiene enlace */}
                        {item.curso?.whatsapp_url && (
                          <div style={{ marginTop: '10px' }}>
                            <a
                              href={item.curso.whatsapp_url}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                padding: '8px 14px',
                                background: '#25d366',
                                color: '#ffffff',
                                borderRadius: '8px',
                                fontSize: '12px',
                                fontWeight: 700,
                                textDecoration: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                            >
                              <MessageCircle size={14} /> Entrar al Grupo de WhatsApp
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{
                    background: '#fff1f2',
                    borderRadius: '14px',
                    padding: '20px',
                    border: '1px solid #fecdd3',
                    color: '#9f1239'
                  }}>
                    <BadgeAlert size={28} style={{ margin: '0 auto 6px auto', display: 'block' }} />
                    <strong style={{ display: 'block', fontSize: '14px' }}>No se encontró inscripción</strong>
                    <span style={{ fontSize: '12px' }}>El CI {searchCi} no tiene registros activos.</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
