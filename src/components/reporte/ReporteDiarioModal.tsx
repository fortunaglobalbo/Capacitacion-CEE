'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { X, Upload, ExternalLink, Save, RefreshCw, FileText, CheckCircle2, Eraser } from 'lucide-react';
import { AuthUser } from '@/lib/auth/AuthContext';
import Swal from 'sweetalert2';

interface ReporteDiarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser | null;
}

export default function ReporteDiarioModal({
  isOpen,
  onClose,
  currentUser,
}: ReporteDiarioModalProps) {
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const [syncingSie, setSyncingSie] = useState<boolean>(false);
  const [isSieConnected, setIsSieConnected] = useState<boolean>(false);
  const [sieUser, setSieUser] = useState<string>('');
  const [siePass, setSiePass] = useState<string>('');
  const [iframeKey, setIframeKey] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Comprobar si el usuario actual es el técnico Gilmar Felix Chavarria Choque
  const isGilmar = useMemo(() => {
    if (!currentUser) return false;
    const name = (currentUser.nombre_completo || '').toUpperCase();
    const username = (currentUser.username || '').toUpperCase();
    return (
      name.includes('GILMAR') ||
      name.includes('CHAVARRIA') ||
      username.includes('GILMAR') ||
      username === '8639300'
    );
  }, [currentUser]);

  // Determinar el carnet del técnico actual para filtrar por defecto
  const defaultTecnicoCarnet = useMemo(() => {
    // Por defecto mostrar 'todos' para ver el panorama completo y permitir filtrar libremente por mes
    return 'todos';
  }, []);
  // Inyectar el filtro por defecto del usuario y garantizar limpieza absoluta de elementos duplicados
  const processedHtml = useMemo(() => {
    if (!htmlContent) return '';
    let finalHtml = htmlContent;

    // 1. Garantizar que NO haya selectores de mes duplicados bajo ninguna circunstancia
    const mesMatches = finalHtml.match(/<select[^>]*id="filtroMes"[^>]*>[\s\S]*?<\/select>/gi);
    if (mesMatches && mesMatches.length > 1) {
      let first = true;
      finalHtml = finalHtml.replace(/<select[^>]*id="filtroMes"[^>]*>[\s\S]*?<\/select>/gi, (match) => {
        if (first) {
          first = false;
          return match;
        }
        return '';
      });
    }

    // 2. Garantizar que NO haya selectores de técnico duplicados
    const tecMatches = finalHtml.match(/<select[^>]*id="filtroTecnico"[^>]*>[\s\S]*?<\/select>/gi);
    if (tecMatches && tecMatches.length > 1) {
      let first = true;
      finalHtml = finalHtml.replace(/<select[^>]*id="filtroTecnico"[^>]*>[\s\S]*?<\/select>/gi, (match) => {
        if (first) {
          first = false;
          return match;
        }
        return '';
      });
    }

    // 3. Garantizar que NO haya grupos de botones de filtro duplicados
    const filterGroupMatches = finalHtml.match(/<div class="filter-group"[\s\S]*?<\/div>/gi);
    if (filterGroupMatches && filterGroupMatches.length > 1) {
      let first = true;
      finalHtml = finalHtml.replace(/<div class="filter-group"[\s\S]*?<\/div>/gi, (match) => {
        if (first) {
          first = false;
          return match;
        }
        return '';
      });
    }

    if (defaultTecnicoCarnet !== 'todos') {
      finalHtml = finalHtml.replace(
        "var tecParam = params.get('tecnico');",
        `var tecParam = params.get('tecnico') || '${defaultTecnicoCarnet}';`
      );
    }
    return finalHtml;
  }, [htmlContent, defaultTecnicoCarnet]);

  // Cargar contenido HTML exclusivamente desde la base de datos de Supabase (sin localStorage/cookies)
  const loadHtmlReport = async () => {
    setLoading(true);

    // Mandato explícito: Limpiar cualquier rastro de localStorage anterior
    if (typeof window !== 'undefined') {
      localStorage.removeItem('reporte_diario_custom_html');
      localStorage.removeItem('reporte_diario_user_uploaded');
    }

    try {
      const res = await fetch(`/api/reporte-diario?t=${Date.now()}`);
      if (res.ok) {
        const text = await res.text();
        setHtmlContent(text || '');
      } else {
        setHtmlContent('');
      }
    } catch (e) {
      console.warn('Error al obtener reporte desde API Supabase:', e);
      setHtmlContent('');
    } finally {
      setLoading(false);
    }
  };

  // Limpiar el reporte COMPLETAMENTE de la base de datos de Supabase
  const handleClearReport = async () => {
    const result = await Swal.fire({
      title: '¿Vaciar Reporte de la Base de Datos?',
      text: 'Se eliminará el contenido del reporte guardado en la tabla reportes_html en Supabase.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, Vaciar Todo',
      cancelButtonText: 'Cancelar',
    });

    if (result.isConfirmed) {
      setLoading(true);
      try {
        await fetch('/api/reporte-diario', { method: 'DELETE' });

        if (typeof window !== 'undefined') {
          localStorage.removeItem('reporte_diario_custom_html');
          localStorage.removeItem('reporte_diario_user_uploaded');
          localStorage.removeItem('reporte_cursos_subsanados');
        }

        setHtmlContent('');
        setSieUser('');
        setSiePass('');
        setIsSieConnected(false);

        Swal.fire({
          icon: 'success',
          title: '¡Reporte Vaciado!',
          text: 'Se ha eliminado el reporte de la base de datos en Supabase.',
          timer: 2500,
          showConfirmButton: false,
        });
      } catch (err) {
        console.error('Error al vaciar reporte en servidor:', err);
        Swal.fire('Error', 'No se pudo vaciar la tabla de la base de datos', 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadHtmlReport();
    }
  }, [isOpen]);

  // Paso 1: ÚNICAMENTE conectar al SIE y verificar credenciales
  const handleConnectSie = async (userToUse?: string, passToUse?: string) => {
    const username = (userToUse || sieUser || '').trim();
    const password = passToUse || siePass;

    if (!username || !password) {
      Swal.fire({
        title: 'Credenciales Requeridas',
        text: 'Ingresa tu usuario y contraseña del SIE UNEFCO.',
        icon: 'warning',
        confirmButtonColor: '#0d3b66',
      });
      return;
    }

    setSyncingSie(true);

    Swal.fire({
      title: '🔌 Conectando al SIE UNEFCO...',
      html: `
        <div style="font-size:0.9rem;color:#334155;margin-top:6px;">
          <p style="color:#0284c7;font-weight:600;margin-bottom:4px;">Verificando credenciales con el portal SIE (${username})...</p>
          <p style="font-size:0.8rem;color:#64748b;">Por favor espera unos segundos mientras se valida el acceso.</p>
        </div>
      `,
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    try {
      const res = await fetch('/api/sie/sync-reporte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, action: 'verify' }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        setIsSieConnected(true);
        Swal.fire({
          icon: 'success',
          title: '🟢 Conexión Exitosa',
          html: `<b>¡Te has conectado correctamente al portal SIE UNEFCO!</b><br><br>Credenciales verificadas para <b>${username}</b>.<br>Ahora puedes hacer clic en <b>"🚀 Analizar y Sincronizar"</b> para procesar la información en tiempo real.`,
          confirmButtonColor: '#0d3b66',
        });
      } else {
        setIsSieConnected(false);
        Swal.fire({
          icon: 'error',
          title: 'Fallo de Conexión',
          text: data.error || 'No se pudo conectar al SIE. Revisa tu usuario y contraseña.',
          confirmButtonColor: '#0d3b66',
        });
      }
    } catch (e: any) {
      setIsSieConnected(false);
      Swal.fire({
        icon: 'error',
        title: 'Error de Servidor',
        text: 'Ocurrió un error al verificar la conexión con el SIE.',
        confirmButtonColor: '#0d3b66',
      });
    } finally {
      setSyncingSie(false);
    }
  };

  // Paso 2: Analizar y sincronizar todos los datos del SIE en tiempo real (requiere estar conectado)
  const handleSyncSieData = async (userToUse?: string, passToUse?: string) => {
    const username = (userToUse || sieUser || '').trim();
    const password = passToUse || siePass;

    if (!username || !password) {
      Swal.fire({
        title: 'Credenciales Requeridas',
        text: 'Ingresa tu usuario y contraseña del SIE UNEFCO.',
        icon: 'warning',
        confirmButtonColor: '#0d3b66',
      });
      return;
    }

    if (!isSieConnected) {
      Swal.fire({
        title: '⚠️ Conexión Requerida',
        html: 'Por favor haz clic primero en <b>"🔌 Conectar SIE"</b> para verificar tus credenciales antes de iniciar el análisis y la sincronización.',
        icon: 'warning',
        confirmButtonColor: '#0d3b66',
      });
      return;
    }

    setSyncingSie(true);

    Swal.fire({
      title: '📊 Analizando Datos del SIE en Tiempo Real...',
      html: `
        <div style="font-size:0.9rem;color:#334155;margin-top:6px;">
          <p style="margin-bottom:8px;">🟢 <b>Sesión Activa en el SIE UNEFCO</b> (${username})</p>
          <p style="color:#0284c7;font-weight:600;margin-bottom:4px;">Procesando participantes, eventos, planificaciones e informes finales en tiempo real...</p>
          <p style="font-size:0.8rem;color:#64748b;">Por favor espera unos momentos mientras se genera y guarda el nuevo reporte.</p>
        </div>
      `,
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    try {
      const res = await fetch('/api/sie/sync-reporte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, action: 'sync' }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        setIsSieConnected(true);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('reporte_cursos_subsanados');
        }
        await loadHtmlReport();
        setIframeKey((prev) => prev + 1);
        Swal.fire({
          icon: 'success',
          title: '✅ Monitoreo Realizado',
          html: '<b>¡Análisis y Sincronización completados con éxito!</b><br>Los datos del SIE se actualizaron en tiempo real y el nuevo reporte fue guardado en Supabase.',
          confirmButtonColor: '#0d3b66',
          timer: 3500,
          timerProgressBar: true,
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error durante el Análisis',
          text: data.error || 'No se pudo completar el análisis del SIE. Verifica la conexión o credenciales.',
          confirmButtonColor: '#0d3b66',
        });
      }
    } catch (e: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error de Servidor',
        text: 'Ocurrió un error al procesar el servicio de monitoreo.',
        confirmButtonColor: '#0d3b66',
      });
    } finally {
      setSyncingSie(false);
    }
  };

  // Manejar la subida de un nuevo archivo HTML (exclusivo para Gilmar Felix Chavarria Choque)
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.html') && !file.name.endsWith('.htm')) {
      Swal.fire('Formato no válido', 'Por favor selecciona un archivo con extensión .html o .htm', 'warning');
      return;
    }

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target?.result as string;
        if (!content) {
          Swal.fire('Error', 'El archivo seleccionado está vacío', 'error');
          setUploading(false);
          return;
        }

        // Guardar en servidor y base de datos Supabase mediante API POST
        const res = await fetch('/api/reporte-diario', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ html: content }),
        });

        const data = await res.json().catch(() => ({}));
        const finalHtml = data.enrichedHtml || content;

        setHtmlContent(finalHtml);
        if (typeof window !== 'undefined') {
          localStorage.setItem('reporte_diario_custom_html', finalHtml);
          localStorage.setItem('reporte_diario_user_uploaded', 'true');
        }

        if (res.ok) {
          Swal.fire({
            icon: 'success',
            title: '¡Plantilla Guardada Exitosamente!',
            html: `La plantilla del <b>Reporte Diario</b> fue guardada permanentemente en la base de datos de Supabase y estará activa en <b>todas las pestañas, recargas y dispositivos</b>.`,
            confirmButtonColor: '#0d3b66',
            timer: 4000,
            timerProgressBar: true,
          });
        } else {
          Swal.fire({
            icon: 'success',
            title: '¡Plantilla Guardada!',
            html: `La plantilla se ha activado correctamente en tu navegador.`,
            confirmButtonColor: '#0d3b66',
            timer: 3000,
          });
        }
        setUploading(false);
      };
      reader.readAsText(file, 'UTF-8');
    } catch (err: any) {
      console.error('Error al subir plantilla HTML:', err);
      Swal.fire('Error', 'Ocurrió un error al procesar el archivo HTML', 'error');
      setUploading(false);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <style>{`.swal2-container { z-index: 999999 !important; }`}</style>
      <div
        style={{
          backgroundColor: '#ffffff',
          width: '96vw',
          height: '92vh',
          maxWidth: '1850px',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0d3b66 0%, #1a5276 50%, #2e86c1 100%)',
            color: '#ffffff',
            padding: '12px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            boxShadow: '0 4px 12px rgba(13, 59, 102, 0.2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FileText size={22} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, letterSpacing: '0.3px', color: '#ffffff' }}>
                  REPORTE DIARIO DE MONITOREO ACADÉMICO
                </h2>
                {isSieConnected && (
                  <span
                    style={{
                      background: '#dcfce7',
                      color: '#15803d',
                      border: '1px solid #86efac',
                      padding: '3px 10px',
                      borderRadius: '20px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      boxShadow: '0 2px 6px rgba(22, 163, 74, 0.2)',
                    }}
                    title="Conexión en tiempo real con el portal SIE UNEFCO activa"
                  >
                    🟢 Conectado al SIE UNEFCO
                  </span>
                )}
              </div>
              <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                Visualización e informe actualizado en tiempo real
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Panel de Conexión al SIE disponible para todos los técnicos */}
            {currentUser && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(255, 255, 255, 0.12)',
                  padding: '6px 12px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.2)',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <input
                    type="text"
                    value={sieUser}
                    onChange={(e) => {
                      setSieUser(e.target.value);
                      setIsSieConnected(false);
                    }}
                    placeholder="Usuario / Correo SIE"
                    autoComplete="off"
                    style={{
                      background: 'rgba(255, 255, 255, 0.2)',
                      border: '1px solid rgba(255, 255, 255, 0.35)',
                      borderRadius: '5px',
                      color: '#ffffff',
                      fontSize: '0.75rem',
                      padding: '2px 8px',
                      width: '185px',
                      outline: 'none',
                      fontWeight: 600,
                    }}
                    title="Usuario del SIE UNEFCO"
                  />
                  <input
                    type="password"
                    value={siePass}
                    onChange={(e) => {
                      setSiePass(e.target.value);
                      setIsSieConnected(false);
                    }}
                    placeholder="Contraseña SIE"
                    autoComplete="new-password"
                    style={{
                      background: 'rgba(255, 255, 255, 0.2)',
                      border: '1px solid rgba(255, 255, 255, 0.35)',
                      borderRadius: '5px',
                      color: '#ffffff',
                      fontSize: '0.75rem',
                      padding: '2px 8px',
                      width: '185px',
                      outline: 'none',
                      fontWeight: 600,
                    }}
                    title="Contraseña del SIE UNEFCO"
                  />
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => handleConnectSie(sieUser, siePass)}
                    disabled={syncingSie}
                    style={{
                      background: isSieConnected
                        ? '#059669'
                        : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: syncingSie ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)',
                      height: '38px',
                    }}
                    title="Paso 1: Verificar credenciales y Conectar con el SIE UNEFCO"
                  >
                    <RefreshCw size={14} className={syncingSie ? 'spin' : ''} />
                    {syncingSie ? 'Verificando...' : isSieConnected ? '🟢 Conectado' : '🔌 Conectar SIE'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSyncSieData(sieUser, siePass)}
                    disabled={syncingSie}
                    style={{
                      background: syncingSie
                        ? '#64748b'
                        : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 14px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: syncingSie ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      boxShadow: '0 2px 8px rgba(22, 163, 74, 0.3)',
                      height: '38px',
                    }}
                    title="Paso 2: Procesar eventos, planificaciones e informes en tiempo real"
                  >
                    🚀 Analizar y Sincronizar
                  </button>

                  <button
                    type="button"
                    onClick={handleClearReport}
                    style={{
                      background: 'rgba(255, 255, 255, 0.15)',
                      color: '#ffffff',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      height: '38px',
                      transition: 'all 0.2s ease',
                    }}
                    title="Limpiar datos locales y restablecer plantilla del reporte"
                  >
                    <Eraser size={14} /> Limpiar Reporte
                  </button>
                </div>
              </div>
            )}

            <a
              href={`/api/reporte-diario?standalone=true&tecnico=${defaultTecnicoCarnet}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                borderRadius: '10px',
                padding: '10px 18px',
                fontSize: '0.95rem',
                fontWeight: 800,
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.4)',
                transition: 'all 0.2s ease',
              }}
              title="Abrir reporte directo a la tabla en nueva pestaña completa"
            >
              <ExternalLink size={18} /> 🚀 Abrir Pestaña Nueva
            </a>

            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                marginLeft: '6px',
              }}
              title="Cerrar"
            >
              <X size={20} />
            </button>
          </div>
        </div>



        {/* Creador/Visor Iframe */}
        <div style={{ flex: 1, backgroundColor: '#eef2f7', position: 'relative' }}>
          {loading ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                flexDirection: 'column',
                gap: '12px',
                color: '#64748b',
              }}
            >
              <RefreshCw size={32} className="spin" />
              <span>Cargando Reporte Diario...</span>
            </div>
          ) : !htmlContent || htmlContent.trim().length === 0 ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                flexDirection: 'column',
                gap: '16px',
                color: '#64748b',
                textAlign: 'center',
                padding: '20px',
                background: '#f8fafc',
              }}
            >
              <FileText size={52} style={{ opacity: 0.35, color: '#0d3b66' }} />
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#1e293b' }}>Reporte Vacío</h3>
                <p style={{ margin: '6px 0 0', fontSize: '0.88rem', color: '#64748b', maxWidth: '480px', lineHeight: '1.4' }}>
                  No hay ningún reporte cargado. Ingresa tu usuario y contraseña del SIE a un lado de la cabecera y presiona <b>"Conectar SIE"</b> para generar la información.
                </p>
              </div>
            </div>
          ) : (
            <iframe
              key={iframeKey}
              srcDoc={processedHtml}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                backgroundColor: '#ffffff',
              }}
              title="Reporte Diario"
            />
          )}
        </div>
      </div>
    </div>
  );
}
