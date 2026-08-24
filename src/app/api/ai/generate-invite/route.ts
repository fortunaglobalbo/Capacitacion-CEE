import { NextResponse } from 'next/server';
import { callAI } from '@/lib/ai/opencode';

export async function POST(request: Request) {
  try {
    const { curso, linkInscripcion } = await request.json();

    if (!curso) {
      return NextResponse.json(
        { success: false, message: 'Faltan los datos del curso' },
        { status: 400 }
      );
    }

    const systemPrompt = `
Eres un asistente de comunicación de la UNEFCO (Unidad de Especialización de Formación Continua).
Genera un mensaje de invitación altamente atractivo y profesional para compartir por WhatsApp.
Usa emojis de forma llamativa, negritas (formato WhatsApp con asteriscos, ej: *texto*) para destacar los puntos clave, y espaciado limpio.
Devuelve ÚNICAMENTE el texto listo para enviar por WhatsApp, sin formatos markdown adicionales, sin bloques de código, sin preámbulos.
`;

    const prompt = `
Convoca a los maestros al siguiente ciclo formativo con los siguientes detalles:

- Ciclo Formativo: ${curso.ciclo_nombre || 'Sin nombre'}
- Área Formativa: ${curso.area_formativa || curso.ciclo_grupo || 'Sin área'}
- Cursos temáticos incluidos en el ciclo:
  ${curso.tema1 ? `* Curso 1: ${curso.tema1}` : ''}
  ${curso.tema2 ? `* Curso 2: ${curso.tema2}` : ''}
  ${curso.tema3 ? `* Curso 3: ${curso.tema3}` : ''}
  ${curso.tema4 ? `* Curso 4: ${curso.tema4}` : ''}
- Facilitador(a): ${curso.facilitador_nombre || 'POR CONFIRMAR'}
- Técnico de seguimiento: ${curso.tecnico_nombre || 'POR CONFIRMAR'}
- Fecha y Hora de Inicio: ${curso.fecha_inicio || 'POR CONFIRMAR'}
- Distrito Educativo: ${curso.distrito || 'Sin distrito'}
- Lugar de realización: ${curso.lugar || 'POR CONFIRMAR'}
- Costo de inversión: ${curso.costo || 150} Bs.
- Enlace de Inscripción en Línea: ${linkInscripcion}

Asegúrate de estructurar el mensaje con:
1. Un título emocionante con emojis.
2. Los detalles de los cursos, ciclo, distrito y área formativa ordenados y fáciles de leer.
3. El enlace destacado de inscripción en línea.
4. Un breve llamado a la acción motivador para el desarrollo profesional docente.
`;

    const inviteText = await callAI({
      prompt,
      systemPrompt,
      temperature: 0.7
    });

    if (!inviteText) {
      throw new Error('La IA no retornó ninguna respuesta');
    }

    return NextResponse.json({
      success: true,
      inviteText: inviteText.trim()
    });

  } catch (error: any) {
    console.error('AI Generate Invite Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Error al generar la invitación con Inteligencia Artificial' },
      { status: 500 }
    );
  }
}
