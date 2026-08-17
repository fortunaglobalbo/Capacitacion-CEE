'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Curso } from '@/types';
import { Calendar, MapPin, User, FileText, CheckCircle2, Award, ClipboardCheck, ArrowRight, Loader2, Users, AlertTriangle, MessageCircle } from 'lucide-react';
import Swal from 'sweetalert2';

const formatOnlyDate = (fechaStr: string | null | undefined): string => {
  if (!fechaStr) return 'POR CONFIRMAR';
  const match = fechaStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }
  const matchES = fechaStr.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (matchES) {
    return `${matchES[1]}/${matchES[2]}/${matchES[3]}`;
  }
  return fechaStr.split(/[ T]/)[0];
};

const getWhatsAppUrl = (c: Curso | null): string | null => {
  if (!c) return null;
  // 1. Check link_inscripcion_externo
  if (c.link_inscripcion_externo && c.link_inscripcion_externo.trim()) {
    const raw = c.link_inscripcion_externo.trim();
    if (raw.includes('chat.whatsapp.com') || raw.includes('wa.me') || raw.includes('whatsapp')) {
      return raw.startsWith('http') ? raw : `https://${raw}`;
    }
  }
  // 2. Check observaciones for whatsapp link
  if (c.observaciones) {
    const match = c.observaciones.match(/https?:\/\/(chat\.whatsapp\.com|wa\.me)\/[^\s]+/i);
    if (match) return match[0];
  }
  // 3. Fallback to contact phone if available
  const phone = c.organizador_telefono || (c as any).tecnico_telefono;
  if (phone) {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length >= 7) {
      const p = cleanPhone.length === 8 ? `591${cleanPhone}` : cleanPhone;
      return `https://wa.me/${p}?text=${encodeURIComponent(`Hola, me inscribí al ciclo ${c.ciclo_nombre || c.id}. Quisiera unirme al grupo de WhatsApp.`)}`;
    }
  }
  return null;
};

export default function ParticipanteRegistroPage() {
  const params = useParams();
  const id = params?.id as string;

  const [curso, setCurso] = useState<Curso | null>(null);
  const [loadingCurso, setLoadingCurso] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  // Form fields
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [ci, setCi] = useState('');
  const [rda, setRda] = useState('');
  const [celular, setCelular] = useState('');
  const [sie, setSie] = useState('');
  const [unidadEducativa, setUnidadEducativa] = useState('');

  // Fetch course details
  useEffect(() => {
    if (!id) return;
    
    async function fetchCurso() {
      setLoadingCurso(true);
      try {
        let rawData: any = null;

        const viewRes = await supabase
          .from('cursos_enriquecidos')
          .select('*')
          .eq('id', id)
          .single();

        if (viewRes.data && !viewRes.error) {
          rawData = viewRes.data;
        } else {
          // Fallback to table 'cursos'
          const baseRes = await supabase
            .from('cursos')
            .select('*')
            .eq('id', id)
            .single();

          if (baseRes.error || !baseRes.data) {
            throw baseRes.error || new Error('Curso no encontrado');
          }

          rawData = baseRes.data;

          // Enrich details if needed
          const [tecRes, facRes, cicRes] = await Promise.all([
            rawData.tecnico_carnet ? supabase.from('tecnicos').select('nombre').eq('carnet', rawData.tecnico_carnet).maybeSingle() : Promise.resolve({ data: null }),
            rawData.facilitador_carnet ? supabase.from('facilitadores').select('nombre').eq('carnet', rawData.facilitador_carnet).maybeSingle() : Promise.resolve({ data: null }),
            rawData.ciclo_id ? supabase.from('ciclos_formativos').select('*').eq('id', rawData.ciclo_id).maybeSingle() : Promise.resolve({ data: null }),
          ]);

          if (tecRes.data?.nombre) rawData.tecnico_nombre = tecRes.data.nombre;
          if (facRes.data?.nombre) rawData.facilitador_nombre = facRes.data.nombre;
          if (cicRes.data) {
            rawData.ciclo_nombre = cicRes.data.nombre;
            rawData.ciclo_grupo = cicRes.data.grupo;
            rawData.area_formativa = cicRes.data.area_formativa;
            rawData.tema1 = cicRes.data.tema1;
            rawData.tema2 = cicRes.data.tema2;
            rawData.tema3 = cicRes.data.tema3;
            rawData.tema4 = cicRes.data.tema4;
          }
        }

        // Fetch exact real-time count of participants registered for this course
        const { count, error: countErr } = await supabase
          .from('inscripcion_ciclo')
          .select('*', { count: 'exact', head: true })
          .eq('curso_id', id);

        const cursoData = rawData as Curso;
        if (!countErr && count !== null) {
          cursoData.inscritos_formulario = count;
        }

        setCurso(cursoData);
      } catch (err) {
        console.error('Error fetching course:', err);
        Swal.fire({
          icon: 'error',
          title: 'Curso no encontrado',
          text: `El identificador de inscripción ${id} no es válido o el curso ha sido cerrado.`,
          confirmButtonColor: '#2f80ed'
        });
      } finally {
        setLoadingCurso(false);
      }
    }

    fetchCurso();
  }, [id]);

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !nombres.trim() || !apellidos.trim() || !ci.trim()) return;

    setSubmitting(true);
    setAlreadyRegistered(false);
    try {
      // 1. Get next serial number (Nro) for this course
      const { data: countData, error: countError } = await supabase
        .from('inscripcion_ciclo')
        .select('nro')
        .eq('curso_id', id)
        .order('nro', { ascending: false })
        .limit(1);

      if (countError) throw countError;
      const nextNro = countData && countData.length > 0 ? (countData[0].nro + 1) : 1;

      // Fetch existing participant record to merge and prevent nulling out existing fields
      const { data: dbPart, error: fetchPartErr } = await supabase
        .from('participantes')
        .select('*')
        .eq('ci', ci.trim())
        .maybeSingle();

      if (fetchPartErr) throw fetchPartErr;

      // 2. Upsert participant core info
      const { error: partError } = await supabase
        .from('participantes')
        .upsert({
          ci: ci.trim(),
          apellidos: apellidos.trim().toUpperCase() || dbPart?.apellidos,
          nombres: nombres.trim().toUpperCase() || dbPart?.nombres,
          rda: rda.trim() || dbPart?.rda || null,
          celular: celular.trim() || dbPart?.celular || null,
          sie: sie.trim() || dbPart?.sie || null,
          unidad_educativa: unidadEducativa.trim().toUpperCase() || dbPart?.unidad_educativa || null,
          validado: dbPart?.validado ?? false,
          observaciones_sie: dbPart?.observaciones_sie || null
        }, { onConflict: 'ci' });

      if (partError) throw partError;

      // 3. Insert relationship into intermediate table
      const { error: relationError } = await supabase
        .from('inscripcion_ciclo')
        .insert({
          curso_id: id,
          participante_ci: ci.trim(),
          nro: nextNro,
          pagos: 'Pendiente',
        });

      if (relationError) {
        if (relationError.code === '23505') {
          // Already registered! Show success screen with WhatsApp group button
          setAlreadyRegistered(true);
          setSuccess(true);
          Swal.fire({
            icon: 'info',
            title: 'Ya estás registrado',
            text: 'Tus datos ya figuran en la lista de inscritos de este ciclo. Puedes unirte al grupo de WhatsApp a continuación.',
            confirmButtonColor: '#25D366'
          });
          return;
        }
        throw relationError;
      }

      // 4. Update count to exact value from database
      const { count } = await supabase
        .from('inscripcion_ciclo')
        .select('*', { count: 'exact', head: true })
        .eq('curso_id', id);
      await supabase
        .from('cursos')
        .update({ inscritos_formulario: count || 0 })
        .eq('id', id);

      if (count !== null && curso) {
        setCurso({ ...curso, inscritos_formulario: count });
      }

      setSuccess(true);
      Swal.fire({
        icon: 'success',
        title: '¡Inscripción Registrada!',
        text: 'Tus datos fueron cargados exitosamente al sistema. Únete al grupo de WhatsApp para continuar.',
        timer: 3500,
        showConfirmButton: false
      });
    } catch (err: any) {
      console.error('Error registering participant:', err);
      Swal.fire({
        icon: 'error',
        title: 'Error en registro',
        text: err.message || 'Ocurrió un error al guardar tus datos de inscripción. Inténtalo de nuevo.',
        confirmButtonColor: '#d93025'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const whatsappUrl = getWhatsAppUrl(curso);

  if (loadingCurso) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '16px' }}>
        <Loader2 className="spin" size={48} style={{ color: 'var(--primary-500)' }} />
        <p style={{ fontWeight: 600, color: 'var(--gray-600)' }}>Cargando formulario de inscripción...</p>
      </div>
    );
  }

  if (!curso) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '24px', textAlign: 'center' }}>
        <div style={{ fontSize: '4rem', marginBottom: '16px' }}>⚠️</div>
        <h2 style={{ fontWeight: 800, color: 'var(--primary-900)' }}>Enlace de Inscripción Inválido</h2>
        <p style={{ color: 'var(--gray-500)', marginTop: '8px', maxWidth: '450px' }}>
          Este enlace de inscripción no corresponde a ningún ciclo activo o ha expirado. Por favor, solicita un enlace correcto al técnico responsable.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '16px', background: 'linear-gradient(135deg, #f7f6f2 0%, #eae8e1 100%)' }}>
      <style>{`
        @media (max-width: 600px) {
          .form-grid-responsive {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }
          .form-grid-responsive > div {
            grid-column: span 1 !important;
          }
          .info-grid-responsive {
            grid-template-columns: 1fr !important;
            gap: 8px !important;
          }
          .nota-card {
            border-radius: 8px !important;
          }
        }
      `}</style>
      <div className="nota-card" style={{ maxWidth: '640px', width: '100%', '--nota-color': '#bfa05e' } as React.CSSProperties}>
        
        {/* Banner de Cabecera */}
        <div style={{ width: '100%', overflow: 'hidden', borderTopLeftRadius: '12px', borderTopRightRadius: '12px', borderBottom: '4px solid #bfa05e' }}>
          <img 
            src="/header-banner.jpg" 
            alt="UNEFCO Banner" 
            style={{ width: '100%', height: 'auto', display: 'block' }} 
          />
        </div>

        {/* Título Principal */}
        <div style={{ padding: '24px 20px 12px 20px', backgroundColor: 'var(--white)', textAlign: 'center' }}>
          <h2 style={{ color: 'var(--primary-900)', fontSize: '1.4rem', fontWeight: 900, margin: 0, lineHeight: 1.3 }}>
            {curso.ciclo_nombre || 'Inscripción a Ciclo Formativo'}
          </h2>
        </div>

        {/* Datos del Ciclo Formativo */}
        <div style={{ background: 'var(--primary-50)', padding: '16px 20px', borderBottom: '1px solid var(--primary-100)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 800, color: 'var(--primary-900)', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileText size={14} /> Información del Ciclo
          </h4>

          <div className="info-grid-responsive" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', color: 'var(--primary-700)' }}>
              <span style={{ fontWeight: 800, whiteSpace: 'nowrap', minWidth: '100px' }}>Área Formativa:</span>
              <span style={{ fontWeight: 600 }}>{curso.area_formativa || curso.ciclo_grupo || 'Sin área'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', color: 'var(--primary-700)' }}>
              <span style={{ fontWeight: 800, whiteSpace: 'nowrap', minWidth: '100px' }}>Segmento:</span>
              <span style={{ fontWeight: 600 }}>{curso.segmento || 'General'}</span>
            </div>
          </div>

          {/* Cursos del ciclo */}
          <div style={{ background: 'rgba(255,255,255,0.7)', borderRadius: '8px', padding: '10px 14px', border: '1px solid var(--primary-100)' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--primary-800)', marginBottom: '6px', textTransform: 'uppercase' }}>Cursos incluidos:</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.78rem', color: 'var(--primary-700)' }}>
              {curso.tema1 && <div style={{ display: 'flex', gap: '6px' }}><span style={{ fontWeight: 800, color: 'var(--primary-500)' }}>1.</span> {curso.tema1}</div>}
              {curso.tema2 && <div style={{ display: 'flex', gap: '6px' }}><span style={{ fontWeight: 800, color: 'var(--primary-500)' }}>2.</span> {curso.tema2}</div>}
              {curso.tema3 && <div style={{ display: 'flex', gap: '6px' }}><span style={{ fontWeight: 800, color: 'var(--primary-500)' }}>3.</span> {curso.tema3}</div>}
              {curso.tema4 && <div style={{ display: 'flex', gap: '6px' }}><span style={{ fontWeight: 800, color: 'var(--primary-500)' }}>4.</span> {curso.tema4}</div>}
            </div>
          </div>



          <div className="info-grid-responsive" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary-700)' }}>
              <Calendar size={13} style={{ flexShrink: 0 }} />
              <span style={{ fontWeight: 800 }}>Inicio:</span>
              <span style={{ fontWeight: 600 }}>{formatOnlyDate(curso.fecha_inicio)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary-700)' }}>
              <User size={13} style={{ flexShrink: 0 }} />
              <span style={{ fontWeight: 800 }}>Facilitador:</span>
              <span style={{ fontWeight: 600 }}>{curso.facilitador_nombre || 'Sin asignar'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary-700)' }}>
              <MapPin size={13} style={{ flexShrink: 0 }} />
              <span style={{ fontWeight: 800 }}>Lugar:</span>
              <span style={{ fontWeight: 600 }}>{curso.lugar || 'POR CONFIRMAR'} ({curso.distrito || ''})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary-700)' }}>
              <User size={13} style={{ flexShrink: 0 }} />
              <span style={{ fontWeight: 800 }}>Técnico:</span>
              <span style={{ fontWeight: 600 }}>{curso.tecnico_nombre || 'Sin asignar'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary-700)', gridColumn: 'span 2', justifyContent: 'center', background: 'rgba(191, 160, 94, 0.1)', padding: '6px 12px', borderRadius: '6px', border: '1px dashed #bfa05e', marginTop: '4px' }}>
              <Users size={14} style={{ flexShrink: 0, color: '#bfa05e' }} />
              <span style={{ fontWeight: 800 }}>Participantes Pre-Inscritos:</span>
              <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--primary-900)' }}>{curso.inscritos_formulario ?? 0}</span>
            </div>
          </div>

          {/* Advertencia Importante de Depósito y Grupo de WhatsApp */}
          <div style={{
            background: 'linear-gradient(135deg, #fffbe6 0%, #fef3c7 100%)',
            border: '1.5px solid #f59e0b',
            borderRadius: '10px',
            padding: '12px 16px',
            marginTop: '8px',
            color: '#92400e',
            fontSize: '0.83rem',
            lineHeight: '1.5',
            boxShadow: '0 2px 8px rgba(245, 158, 11, 0.12)',
            display: 'flex',
            gap: '10px',
            alignItems: 'flex-start'
          }}>
            <AlertTriangle size={22} style={{ color: '#d97706', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ color: '#b45309', display: 'block', fontSize: '0.88rem', marginBottom: '2px' }}>
                ⚠️ ADVERTENCIA IMPORTANTE:
              </strong>
              Por favor <strong>NO REALIZAR NINGÚN DEPÓSITO</strong> hasta confirmar la apertura del grupo. Toda la información y avisos oficiales se comunicarán a través del <strong>grupo de WhatsApp</strong> al cual te podrás unir al finalizar tu registro.
            </div>
          </div>
        </div>

        {curso.form_habilitado === false ? (
          /* Formulario deshabilitado */
          <div style={{ padding: '40px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <div style={{ fontSize: '4rem', marginBottom: '8px' }}>🚫</div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--red-600)' }}>Inscripción Cerrada</h3>
            <p style={{ color: 'var(--gray-600)', maxWidth: '400px', lineHeight: 1.5 }}>
              Ya no se pueden recibir inscripciones. El ciclo formativo se encuentra lleno o cerrado administrativamente.
            </p>
            <p style={{ fontSize: '0.82rem', color: 'var(--gray-400)' }}>
              Si crees que esto es un error, por favor contacta al técnico responsable: <b>{curso.tecnico_nombre || 'UNEFCO'}</b>.
            </p>
          </div>
        ) : success ? (
          /* Pantalla de éxito con botón seguro a WhatsApp */
          <div style={{ padding: '40px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <CheckCircle2 size={64} style={{ color: alreadyRegistered ? '#2563eb' : 'var(--green-500)', filter: 'drop-shadow(0 4px 6px rgba(46,159,94,0.25))' }} />
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary-900)', margin: 0 }}>
              {alreadyRegistered ? '¡Ya estás Registrado!' : '¡Inscripción Exitosa!'}
            </h3>
            <p style={{ color: 'var(--gray-600)', maxWidth: '440px', lineHeight: 1.5, margin: 0 }}>
              {alreadyRegistered 
                ? `Tus datos ya se encuentran registrados en el ciclo formativo de ${curso.ciclo_nombre}.`
                : `Tus datos han sido registrados exitosamente en el ciclo de ${curso.ciclo_nombre}. El facilitador y el técnico a cargo confirmarán la apertura del grupo.`}
            </p>
            
            <div style={{ background: 'var(--gray-50)', padding: '12px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--gray-200)', fontSize: '0.85rem', color: 'var(--gray-700)', width: '100%', maxWidth: '380px' }}>
              <b>Registrado a nombre de:</b> {nombres || 'Participante'} {apellidos}<br />
              <b>CI:</b> {ci}
            </div>

            {/* Aviso de no realizar depósitos */}
            <div style={{ background: '#fffbe6', border: '1px solid #f59e0b', borderRadius: '8px', padding: '10px 14px', fontSize: '0.8rem', color: '#92400e', maxWidth: '440px' }}>
              <b>Recordatorio:</b> No realices ningún depósito hasta que se confirme la apertura del grupo en WhatsApp.
            </div>

            {/* Botón de acceso directo al grupo de WhatsApp (sin exponer URL directa en texto) */}
            {whatsappUrl ? (
              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => window.open(whatsappUrl, '_blank')}
                  style={{
                    background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '14px 28px',
                    fontSize: '1.05rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '10px',
                    boxShadow: '0 4px 14px rgba(37, 211, 102, 0.4)',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.transform = 'scale(1.03)')}
                  onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  <MessageCircle size={24} />
                  Unirme al Grupo de WhatsApp
                </button>
                <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>
                  Haz clic arriba para unirte al grupo de comunicación oficial
                </span>
              </div>
            ) : (
              <p style={{ fontSize: '0.82rem', color: 'var(--gray-500)', marginTop: '8px', fontStyle: 'italic' }}>
                (El técnico responsable compartirá el enlace del grupo de WhatsApp próximamente)
              </p>
            )}
          </div>
        ) : (
          /* Formulario de registro */
          <form style={{ padding: '24px' }} onSubmit={handleSubmit}>
            <p style={{ fontSize: '0.88rem', color: 'var(--gray-500)', marginBottom: '20px' }}>
              Por favor, rellena todos tus datos correspondientes de manera correcta para asegurar tu registro en este ciclo formativo.
            </p>

            <div className="form-grid-responsive" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {/* Nombres */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', gridColumn: 'span 2' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--gray-600)' }}>Nombres *</label>
                <input
                  type="text"
                  required
                  value={nombres}
                  onChange={(e) => setNombres(e.target.value.toUpperCase())}
                  placeholder="INTRODUCE TUS NOMBRES"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--gray-200)', font: 'inherit', fontSize: '0.88rem', textTransform: 'uppercase' }}
                />
              </div>

              {/* Apellidos */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', gridColumn: 'span 2' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--gray-600)' }}>Apellidos *</label>
                <input
                  type="text"
                  required
                  value={apellidos}
                  onChange={(e) => setApellidos(e.target.value.toUpperCase())}
                  placeholder="INTRODUCE TUS APELLIDOS"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--gray-200)', font: 'inherit', fontSize: '0.88rem', textTransform: 'uppercase' }}
                />
              </div>

              {/* CI */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--gray-600)' }}>Cédula de Identidad (CI) *</label>
                <input
                  type="text"
                  required
                  value={ci}
                  onChange={(e) => setCi(e.target.value)}
                  placeholder="Ej: 1234567"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--gray-200)', font: 'inherit', fontSize: '0.88rem' }}
                />
              </div>

              {/* RDA */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--gray-600)' }}>RDA</label>
                <input
                  type="text"
                  value={rda}
                  onChange={(e) => setRda(e.target.value)}
                  placeholder="Ej: 987654"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--gray-200)', font: 'inherit', fontSize: '0.88rem' }}
                />
              </div>

              {/* Celular */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--gray-600)' }}>Número de Celular</label>
                <input
                  type="text"
                  value={celular}
                  onChange={(e) => setCelular(e.target.value)}
                  placeholder="Ej: 71234567"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--gray-200)', font: 'inherit', fontSize: '0.88rem' }}
                />
              </div>

              {/* Código SIE */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--gray-600)' }}>Código SIE (Colegio)</label>
                <input
                  type="text"
                  value={sie}
                  onChange={(e) => setSie(e.target.value)}
                  placeholder="Ej: 80730001"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--gray-200)', font: 'inherit', fontSize: '0.88rem' }}
                />
              </div>

              {/* Unidad Educativa */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', gridColumn: 'span 2' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--gray-600)' }}>Nombre de Unidad Educativa</label>
                <input
                  type="text"
                  value={unidadEducativa}
                  onChange={(e) => setUnidadEducativa(e.target.value.toUpperCase())}
                  placeholder="EJ: COLEGIO SIMÓN BOLÍVAR"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--gray-200)', font: 'inherit', fontSize: '0.88rem', textTransform: 'uppercase' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px', borderTop: '1px solid var(--gray-100)', paddingTop: '16px' }}>
              <button
                type="submit"
                disabled={submitting}
                className="btn btn-success"
                style={{ padding: '12px 24px', fontSize: '0.92rem', borderRadius: 'var(--radius-md)', display: 'flex', gap: '8px', alignItems: 'center' }}
              >
                {submitting ? (
                  <>
                    <Loader2 className="spin" size={16} />
                    Guardando registro...
                  </>
                ) : (
                  <>
                    <ClipboardCheck size={16} />
                    Confirmar Inscripción
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
