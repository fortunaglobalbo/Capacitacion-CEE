'use client';

import React, { useState, useRef } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase/client';
import Swal from 'sweetalert2';
import {
  QrCode,
  UploadCloud,
  FileCheck2,
  UserCheck,
  CreditCard,
  Camera,
  CheckCircle2,
  AlertCircle,
  Copy,
  Download,
  Search,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Eye,
  FileText,
  Phone,
  User,
  BadgeAlert,
  Sparkles
} from 'lucide-react';
import { Participante } from '@/types';

export function InscripcionesPublicComponent() {
  // Tab activo: Formulario de Registro o Consulta de Estado por CI
  const [activeTab, setActiveTab] = useState<'formulario' | 'consulta'>('formulario');

  // Datos del formulario
  const [ci, setCi] = useState('');
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [telefono, setTelefono] = useState('');

  // Tipo de subida de carnet: 'fotos' (anverso y reverso) o 'escaneado' (un archivo/pdf)
  const [carnetMode, setCarnetMode] = useState<'fotos' | 'escaneado'>('fotos');
  const [carnetAnverso, setCarnetAnverso] = useState<File | null>(null);
  const [carnetAnversoPreview, setCarnetAnversoPreview] = useState<string | null>(null);
  const [carnetReverso, setCarnetReverso] = useState<File | null>(null);
  const [carnetReversoPreview, setCarnetReversoPreview] = useState<string | null>(null);
  const [carnetEscaneado, setCarnetEscaneado] = useState<File | null>(null);
  const [carnetEscaneadoName, setCarnetEscaneadoName] = useState<string | null>(null);

  // Comprobante de Pago
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [comprobantePreview, setComprobantePreview] = useState<string | null>(null);

  // Estados de carga y envío
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<Participante | null>(null);

  // Estado de consulta
  const [searchCi, setSearchCi] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<Participante | null>(null);
  const [searchPerformed, setSearchPerformed] = useState(false);

  // Refs de archivos
  const anversoInputRef = useRef<HTMLInputElement>(null);
  const reversoInputRef = useRef<HTMLInputElement>(null);
  const escaneadoInputRef = useRef<HTMLInputElement>(null);
  const comprobanteInputRef = useRef<HTMLInputElement>(null);

  // Copiar datos bancarios
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

  // Manejo de archivo a preview y base64
  const fileToPreview = (file: File, callback: (url: string) => void) => {
    const reader = new FileReader();
    reader.onload = () => {
      callback(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Función auxiliar para subir a Supabase Storage con fallback
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
      // Fallback a base64 si el bucket no tiene permisos o no existe
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    } catch (e) {
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    }
  };

  // Envío del formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanCi = ci.trim().toUpperCase();
    const cleanNombres = nombres.trim().toUpperCase();
    const cleanApellidos = apellidos.trim().toUpperCase();
    const cleanTelefono = telefono.trim();

    if (!cleanCi || !cleanNombres || !cleanApellidos) {
      Swal.fire({
        icon: 'warning',
        title: 'Campos obligatorios',
        text: 'Por favor complete su CI, Nombres y Apellidos.',
        confirmButtonColor: '#2563eb'
      });
      return;
    }

    // Validar Carnet
    if (carnetMode === 'fotos') {
      if (!carnetAnverso || !carnetReverso) {
        Swal.fire({
          icon: 'warning',
          title: 'Fotos de Carnet requeridas',
          text: 'Por favor suba tanto la foto de anverso (frontal) como la de reverso de su cédula de identidad.',
          confirmButtonColor: '#2563eb'
        });
        return;
      }
    } else {
      if (!carnetEscaneado) {
        Swal.fire({
          icon: 'warning',
          title: 'Carnet escaneado requerido',
          text: 'Por favor adjunte el archivo escaneado de su cédula de identidad.',
          confirmButtonColor: '#2563eb'
        });
        return;
      }
    }

    // Validar comprobante
    if (!comprobante) {
      Swal.fire({
        icon: 'warning',
        title: 'Comprobante requerido',
        text: 'Por favor adjunte el comprobante del depósito o transferencia bancaria por Bs. 150.',
        confirmButtonColor: '#2563eb'
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Subir carnet y comprobante
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

      // 2. Guardar en tabla participantes
      const newParticipant: any = {
        ci: cleanCi,
        nombres: cleanNombres,
        apellidos: cleanApellidos,
        telefono: cleanTelefono || null,
        carnet_anverso_url: anversoUrl || null,
        carnet_reverso_url: reversoUrl || null,
        carnet_escaneado_url: escaneadoUrl || null,
        comprobante_url: comprobanteUrl || null,
        monto_pago: 150.00,
        estado_pago: 'PENDIENTE',
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('participantes')
        .upsert(newParticipant, { onConflict: 'ci' })
        .select()
        .single();

      if (error) {
        console.error('Error supabase:', error);
        throw new Error(error.message || 'Error al registrar en la base de datos');
      }

      setSubmitSuccess(data as Participante);

      Swal.fire({
        icon: 'success',
        title: '¡Inscripción Registrada!',
        text: `Estimado(a) ${cleanNombres}, su inscripción al Curso de Capacitación se ha recibido exitosamente.`,
        confirmButtonColor: '#16a34a'
      });

    } catch (err: any) {
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: 'Error de registro',
        text: err.message || 'Ocurrió un inconveniente al registrar sus datos. Verifique su conexión y vuelva a intentar.',
        confirmButtonColor: '#dc2626'
      });
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
    setSearchResult(null);

    try {
      const { data, error } = await supabase
        .from('participantes')
        .select('*')
        .eq('ci', cleanCi)
        .maybeSingle();

      if (error) throw error;
      setSearchResult(data as Participante);
    } catch (err: any) {
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: 'Error al consultar',
        text: err.message || 'No se pudo consultar el estado.',
        confirmButtonColor: '#dc2626'
      });
    } finally {
      setIsSearching(false);
    }
  };

  // Resetear formulario para nueva inscripción
  const handleResetForm = () => {
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
    setSubmitSuccess(null);
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Encabezado Institucional */}
      <header style={{
        background: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)',
        borderRadius: '20px',
        padding: '24px 20px',
        color: '#ffffff',
        boxShadow: '0 12px 30px rgba(0, 0, 0, 0.15)',
        marginBottom: '24px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '20px',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '50%',
            padding: '4px',
            width: '80px',
            height: '80px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            flexShrink: 0
          }}>
            <Image
              src="/logo-cee.png"
              alt="Logo Martha Mendoza"
              width={72}
              height={72}
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
              letterSpacing: '1px',
              textTransform: 'uppercase',
              padding: '4px 10px',
              borderRadius: '9999px',
              marginBottom: '4px',
              border: '1px solid rgba(147, 197, 253, 0.3)'
            }}>
              C.E.A. Martha Mendoza • Sucre - Bolivia
            </span>
            <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800, letterSpacing: '-0.5px' }}>
              Curso de Capacitación
            </h1>
            <p style={{ margin: '4px 0 0 0', color: '#cbd5e1', fontSize: '13px' }}>
              Formulario de Inscripción y Validación de Pago Oficial
            </p>
          </div>
        </div>

        {/* Pestañas / Acciones Rápidas */}
        <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.08)', padding: '6px', borderRadius: '12px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('formulario')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
              background: activeTab === 'formulario' ? '#3b82f6' : 'transparent',
              color: activeTab === 'formulario' ? '#ffffff' : '#94a3b8'
            }}
          >
            <Sparkles size={16} /> Inscribirme
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('consulta')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
              background: activeTab === 'consulta' ? '#3b82f6' : 'transparent',
              color: activeTab === 'consulta' ? '#ffffff' : '#94a3b8'
            }}
          >
            <Search size={16} /> Consultar Estado
          </button>
        </div>
      </header>

      {/* PESTAÑA 1: FORMULARIO DE INSCRIPCIÓN */}
      {activeTab === 'formulario' && (
        <>
          {submitSuccess ? (
            /* Pantalla de Éxito */
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
                ¡Inscripción Registrada Correctamente!
              </h2>
              <p style={{ color: '#64748b', fontSize: '15px', maxWidth: '560px', margin: '0 auto 24px auto' }}>
                Hemos recibido tus datos, el comprobante del pago de <strong>Bs. 150</strong> y la documentación de identidad.
              </p>

              {/* Tarjeta Resumen */}
              <div style={{
                background: '#f8fafc',
                borderRadius: '16px',
                padding: '20px',
                maxWidth: '480px',
                margin: '0 auto 24px auto',
                border: '1px solid #e2e8f0',
                textAlign: 'left'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '8px' }}>
                  <span style={{ color: '#64748b', fontSize: '13px' }}>Participante:</span>
                  <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '13px' }}>{submitSuccess.nombres} {submitSuccess.apellidos}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '8px' }}>
                  <span style={{ color: '#64748b', fontSize: '13px' }}>Cédula de Identidad (CI):</span>
                  <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '13px' }}>{submitSuccess.ci}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '8px' }}>
                  <span style={{ color: '#64748b', fontSize: '13px' }}>Monto de Pago:</span>
                  <span style={{ fontWeight: 800, color: '#16a34a', fontSize: '14px' }}>BOB 150.00</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#64748b', fontSize: '13px' }}>Estado Actual:</span>
                  <span style={{
                    background: '#fef3c7',
                    color: '#92400e',
                    padding: '3px 10px',
                    borderRadius: '9999px',
                    fontSize: '12px',
                    fontWeight: 700
                  }}>
                    PENDIENTE DE VALIDACIÓN
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleResetForm}
                  style={{
                    padding: '12px 24px',
                    background: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: 700,
                    fontSize: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)'
                  }}
                >
                  <RefreshCw size={16} /> Realizar Otra Inscripción
                </button>
              </div>
            </div>
          ) : (
            /* Formulario Principal */
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                
                {/* COLUMNA 1: Datos Personales + Carnet */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* SECCIÓN: DATOS PERSONALES */}
                  <div style={{
                    background: '#ffffff',
                    borderRadius: '16px',
                    padding: '24px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.03)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
                      <div style={{ background: '#dbeafe', color: '#1d4ed8', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <User size={18} />
                      </div>
                      <div>
                        <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0f172a' }}>
                          1. Datos del Participante
                        </h2>
                        <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                          Ingrese sus datos tal como figuran en su documento
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
                            color: '#0f172a',
                            outline: 'none',
                            transition: 'border 0.2s',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
                              color: '#0f172a',
                              outline: 'none',
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
                              color: '#0f172a',
                              outline: 'none',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                          Celular / WhatsApp <span style={{ color: '#64748b', fontSize: '12px' }}>(Opcional para contacto)</span>
                        </label>
                        <div style={{ position: 'relative' }}>
                          <Phone size={16} style={{ position: 'absolute', left: '14px', top: '13px', color: '#94a3b8' }} />
                          <input
                            type="tel"
                            value={telefono}
                            onChange={(e) => setTelefono(e.target.value)}
                            placeholder="Ej: 71234567"
                            style={{
                              width: '100%',
                              padding: '11px 14px 11px 38px',
                              borderRadius: '10px',
                              border: '1px solid #cbd5e1',
                              fontSize: '14px',
                              color: '#0f172a',
                              outline: 'none',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SECCIÓN: CARNET DE IDENTIDAD (ANVERSO Y REVERSO O ESCANEADO) */}
                  <div style={{
                    background: '#ffffff',
                    borderRadius: '16px',
                    padding: '24px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.03)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ background: '#fef3c7', color: '#d97706', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CreditCard size={18} />
                        </div>
                        <div>
                          <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0f172a' }}>
                            2. Cédula de Identidad
                          </h2>
                          <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                            Suba fotos legibles o escaneado
                          </p>
                        </div>
                      </div>

                      {/* Selector de modo */}
                      <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
                        <button
                          type="button"
                          onClick={() => setCarnetMode('fotos')}
                          style={{
                            padding: '4px 10px',
                            fontSize: '11px',
                            fontWeight: 700,
                            borderRadius: '6px',
                            border: 'none',
                            cursor: 'pointer',
                            background: carnetMode === 'fotos' ? '#ffffff' : 'transparent',
                            color: carnetMode === 'fotos' ? '#1e293b' : '#64748b',
                            boxShadow: carnetMode === 'fotos' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                          }}
                        >
                          Fotos (Anverso / Reverso)
                        </button>
                        <button
                          type="button"
                          onClick={() => setCarnetMode('escaneado')}
                          style={{
                            padding: '4px 10px',
                            fontSize: '11px',
                            fontWeight: 700,
                            borderRadius: '6px',
                            border: 'none',
                            cursor: 'pointer',
                            background: carnetMode === 'escaneado' ? '#ffffff' : 'transparent',
                            color: carnetMode === 'escaneado' ? '#1e293b' : '#64748b',
                            boxShadow: carnetMode === 'escaneado' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                          }}
                        >
                          Escaneado (PDF/Doc)
                        </button>
                      </div>
                    </div>

                    {carnetMode === 'fotos' ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                        {/* Foto Anverso */}
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                            Carnet Anverso (Frente) <span style={{ color: '#ef4444' }}>*</span>
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
                              padding: '16px 10px',
                              textAlign: 'center',
                              cursor: 'pointer',
                              background: carnetAnversoPreview ? '#f8fafc' : '#fcfcfd',
                              transition: 'all 0.2s ease',
                              minHeight: '130px',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px'
                            }}
                          >
                            {carnetAnversoPreview ? (
                              <div style={{ position: 'relative', width: '100%', height: '110px' }}>
                                <img
                                  src={carnetAnversoPreview}
                                  alt="Carnet Anverso"
                                  style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '8px' }}
                                />
                                <span style={{
                                  position: 'absolute',
                                  bottom: '4px',
                                  right: '4px',
                                  background: 'rgba(0,0,0,0.6)',
                                  color: '#fff',
                                  fontSize: '10px',
                                  padding: '2px 6px',
                                  borderRadius: '4px'
                                }}>
                                  Cambiar
                                </span>
                              </div>
                            ) : (
                              <>
                                <Camera size={26} color="#3b82f6" />
                                <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Subir o Tomar Foto</span>
                                <span style={{ fontSize: '11px', color: '#94a3b8' }}>Anverso / Frontal</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Foto Reverso */}
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                            Carnet Reverso (Atrás) <span style={{ color: '#ef4444' }}>*</span>
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
                              padding: '16px 10px',
                              textAlign: 'center',
                              cursor: 'pointer',
                              background: carnetReversoPreview ? '#f8fafc' : '#fcfcfd',
                              transition: 'all 0.2s ease',
                              minHeight: '130px',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px'
                            }}
                          >
                            {carnetReversoPreview ? (
                              <div style={{ position: 'relative', width: '100%', height: '110px' }}>
                                <img
                                  src={carnetReversoPreview}
                                  alt="Carnet Reverso"
                                  style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '8px' }}
                                />
                                <span style={{
                                  position: 'absolute',
                                  bottom: '4px',
                                  right: '4px',
                                  background: 'rgba(0,0,0,0.6)',
                                  color: '#fff',
                                  fontSize: '10px',
                                  padding: '2px 6px',
                                  borderRadius: '4px'
                                }}>
                                  Cambiar
                                </span>
                              </div>
                            ) : (
                              <>
                                <Camera size={26} color="#3b82f6" />
                                <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Subir o Tomar Foto</span>
                                <span style={{ fontSize: '11px', color: '#94a3b8' }}>Reverso / Posterior</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Carnet Escaneado único */
                      <div>
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
                            padding: '24px 16px',
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
                              <span style={{ fontSize: '13px', fontWeight: 700, color: '#15803d' }}>
                                {carnetEscaneadoName}
                              </span>
                              <span style={{ fontSize: '11px', color: '#64748b' }}>Clic para cambiar archivo</span>
                            </>
                          ) : (
                            <>
                              <UploadCloud size={32} color="#64748b" />
                              <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                                Adjuntar carnet escaneado (PDF o Imagen)
                              </span>
                              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                Máximo 15 MB
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* COLUMNA 2: PAGO QR BANCO BISA + SUBIDA DE COMPROBANTE */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{
                    background: '#ffffff',
                    borderRadius: '16px',
                    padding: '24px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                      <div style={{ background: '#dcfce7', color: '#15803d', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <QrCode size={18} />
                      </div>
                      <div>
                        <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0f172a' }}>
                          3. Pago Oficial con QR
                        </h2>
                        <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                          Banco BISA • Monto oficial: Bs. 150.00
                        </p>
                      </div>
                    </div>

                    {/* Tarjeta del QR Banco BISA */}
                    <div style={{
                      background: 'linear-gradient(145deg, #f8fafc 0%, #edf2f7 100%)',
                      borderRadius: '16px',
                      padding: '16px',
                      border: '1px solid #cbd5e1',
                      textAlign: 'center',
                      marginBottom: '18px',
                      boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
                    }}>
                      <div style={{
                        width: '200px',
                        height: '200px',
                        margin: '0 auto 12px auto',
                        background: '#ffffff',
                        padding: '8px',
                        borderRadius: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <img
                          src="/qr-pago-bisa.png"
                          alt="QR Pago Banco BISA"
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                      </div>

                      {/* Detalles del Pago */}
                      <div style={{ fontSize: '12px', color: '#334155', textAlign: 'left', background: '#ffffff', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ color: '#64748b' }}>Banco:</span>
                          <span style={{ fontWeight: 700, color: '#0f172a' }}>Banco BISA</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ color: '#64748b' }}>Cuenta:</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: 700, color: '#0f172a' }}>4983644011</span>
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ color: '#64748b' }}>Beneficiario:</span>
                          <span style={{ fontWeight: 700, color: '#0f172a' }}>TORREZ SANCHEZ MISAEL</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ color: '#64748b' }}>Motivo:</span>
                          <span style={{ fontWeight: 600, color: '#0f172a' }}>CURSOS DE FORMACIÓN CONTINUA</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #cbd5e1', paddingTop: '6px', marginTop: '6px' }}>
                          <span style={{ fontWeight: 700, color: '#16a34a' }}>Monto a Transferir:</span>
                          <span style={{ fontWeight: 800, fontSize: '15px', color: '#16a34a' }}>BOB 150.00</span>
                        </div>
                      </div>

                      {/* Botones de acción del QR */}
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '10px' }}>
                        <a
                          href="/qr-pago-bisa.png"
                          download="QR_Pago_Banco_BISA_150Bs.png"
                          style={{
                            padding: '6px 12px',
                            background: '#334155',
                            color: '#ffffff',
                            borderRadius: '8px',
                            fontSize: '11px',
                            fontWeight: 600,
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                        >
                          <Download size={13} /> Descargar QR
                        </a>
                      </div>
                    </div>

                    {/* Subida del Comprobante */}
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>
                        Subir Comprobante de Pago <span style={{ color: '#ef4444' }}>*</span>
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
                          padding: '18px 12px',
                          textAlign: 'center',
                          cursor: 'pointer',
                          background: comprobantePreview ? '#f0fdf4' : '#eff6ff',
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          minHeight: '130px'
                        }}
                      >
                        {comprobantePreview ? (
                          <div style={{ position: 'relative', width: '100%', height: '110px' }}>
                            <img
                              src={comprobantePreview}
                              alt="Comprobante"
                              style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '8px' }}
                            />
                            <span style={{
                              position: 'absolute',
                              bottom: '4px',
                              right: '4px',
                              background: 'rgba(0,0,0,0.6)',
                              color: '#fff',
                              fontSize: '10px',
                              padding: '2px 6px',
                              borderRadius: '4px'
                            }}>
                              Cambiar Comprobante
                            </span>
                          </div>
                        ) : (
                          <>
                            <UploadCloud size={28} color="#2563eb" />
                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#1d4ed8' }}>
                              Adjuntar Comprobante o Captura
                            </span>
                            <span style={{ fontSize: '11px', color: '#64748b' }}>
                              Captura de pantalla de la transferencia o foto del recibo
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Botón de Enviar Inscripción */}
              <div style={{
                background: '#ffffff',
                borderRadius: '16px',
                padding: '20px 24px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#64748b', fontSize: '12px' }}>
                  <ShieldCheck size={20} color="#16a34a" />
                  <span>Sus datos y comprobantes se almacenarán de forma segura en el sistema oficial.</span>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: '14px 32px',
                    borderRadius: '12px',
                    border: 'none',
                    background: isSubmitting ? '#94a3b8' : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    color: '#ffffff',
                    fontSize: '15px',
                    fontWeight: 700,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '10px',
                    boxShadow: isSubmitting ? 'none' : '0 8px 20px rgba(37, 99, 235, 0.35)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={18} className="animate-spin" /> Guardando Inscripción...
                    </>
                  ) : (
                    <>
                      Confirmar y Enviar Inscripción <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </>
      )}

      {/* PESTAÑA 2: CONSULTA DE ESTADO POR CI */}
      {activeTab === 'consulta' && (
        <div style={{
          background: '#ffffff',
          borderRadius: '20px',
          padding: '32px 24px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.05)',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ maxWidth: '540px', margin: '0 auto', textAlign: 'center' }}>
            <div style={{ width: '56px', height: '56px', background: '#dbeafe', color: '#1d4ed8', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
              <Search size={28} />
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0' }}>
              Consultar Estado de Inscripción
            </h2>
            <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 24px 0' }}>
              Ingrese su número de Cédula de Identidad (CI) para verificar si su pago y documentos fueron aprobados.
            </p>

            <form onSubmit={handleSearchCi} style={{ display: 'flex', gap: '8px', marginBottom: '28px' }}>
              <input
                type="text"
                required
                value={searchCi}
                onChange={(e) => setSearchCi(e.target.value)}
                placeholder="Número de CI (Ej: 8934521)"
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  fontSize: '15px',
                  color: '#0f172a',
                  outline: 'none'
                }}
              />
              <button
                type="submit"
                disabled={isSearching}
                style={{
                  padding: '12px 24px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#2563eb',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: isSearching ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {isSearching ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />} Consultar
              </button>
            </form>

            {/* Resultado de Búsqueda */}
            {searchPerformed && (
              <>
                {searchResult ? (
                  <div style={{
                    background: '#f8fafc',
                    borderRadius: '16px',
                    padding: '24px',
                    border: '1px solid #cbd5e1',
                    textAlign: 'left'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Registro Encontrado
                      </span>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '9999px',
                        fontSize: '12px',
                        fontWeight: 700,
                        background: searchResult.estado_pago === 'VERIFICADO' ? '#dcfce7' : searchResult.estado_pago === 'OBSERVADO' ? '#fee2e2' : '#fef3c7',
                        color: searchResult.estado_pago === 'VERIFICADO' ? '#15803d' : searchResult.estado_pago === 'OBSERVADO' ? '#b91c1c' : '#92400e'
                      }}>
                        {searchResult.estado_pago === 'VERIFICADO' ? '✓ PAGO VERIFICADO' : searchResult.estado_pago === 'OBSERVADO' ? '⚠ OBSERVADO' : '⏳ PAGO EN REVISIÓN'}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                      <div>
                        <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Participante</span>
                        <strong style={{ fontSize: '15px', color: '#0f172a' }}>{searchResult.nombres} {searchResult.apellidos}</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>CI</span>
                        <strong style={{ fontSize: '15px', color: '#0f172a' }}>{searchResult.ci}</strong>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                      <div>
                        <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Monto</span>
                        <strong style={{ fontSize: '14px', color: '#16a34a' }}>BOB 150.00</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Fecha de Registro</span>
                        <span style={{ fontSize: '13px', color: '#334155' }}>
                          {searchResult.created_at ? new Date(searchResult.created_at).toLocaleDateString() : 'Reciente'}
                        </span>
                      </div>
                    </div>

                    {searchResult.observaciones && (
                      <div style={{ background: '#fffbeb', padding: '10px', borderRadius: '8px', border: '1px solid #fde68a', marginTop: '12px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#b45309', display: 'block' }}>Observaciones del Administrador:</span>
                        <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#78350f' }}>{searchResult.observaciones}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{
                    background: '#fff1f2',
                    borderRadius: '16px',
                    padding: '24px',
                    border: '1px solid #fecdd3',
                    textAlign: 'center',
                    color: '#9f1239'
                  }}>
                    <BadgeAlert size={32} style={{ margin: '0 auto 8px auto', display: 'block' }} />
                    <strong style={{ fontSize: '15px', display: 'block', marginBottom: '4px' }}>No se encontró ninguna inscripción</strong>
                    <p style={{ margin: 0, fontSize: '13px' }}>
                      El CI <strong>{searchCi}</strong> no figura en la lista de inscritos. Asegúrese de haber enviado el formulario de inscripción.
                    </p>
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
