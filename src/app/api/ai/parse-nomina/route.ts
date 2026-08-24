import { NextResponse } from 'next/server';
import { callAI } from '@/lib/ai/opencode';

export async function POST(request: Request) {
  try {
    const { fileData, mimeType, extractedText, fileName } = await request.json();

    if (!fileData && !extractedText) {
      return NextResponse.json(
        { success: false, message: 'Faltan los datos del archivo, imagen, documento o texto extraído' },
        { status: 400 }
      );
    }

    const systemPrompt = `
Eres un asistente de Inteligencia Artificial experto en procesamiento y extracción estructurada de nóminas, listas de participantes, planillas docentes y registros de inscripción para la UNEFCO y el Ministerio de Educación de Bolivia.

Tu misión es analizar el documento, imagen, nómina o datos en bruto provistos y extraer a TODOS y cada uno de los participantes (maestros, directores, administrativos o estudiantes) detectados.

REGLAS DE EXTRACCIÓN:
1. Extrae un array JSON de objetos con exactamente la siguiente estructura:
   [
     {
       "ci": "1234567",
       "nombres": "JUAN CARLOS",
       "apellidos": "PEREZ ROCHA",
       "rda": "123456",
       "celular": "77123456",
       "sie": "80730001",
       "unidad_educativa": "COLEGIO NACIONAL FLORIDA"
     }
   ]
2. "ci": Extrae ÚNICAMENTE los dígitos numéricos de la Cédula de Identidad (elimina extensiones como SC, LP, CB, etc.).
3. "nombres": Nombres de pila de la persona en MAYÚSCULAS. Si en la lista están combinados con los apellidos, separa inteligentemente los nombres de los apellidos.
4. "apellidos": Apellidos (paterno y materno) de la persona en MAYÚSCULAS.
5. "rda": Número de RDA o Registro Docente si existe en el documento; si no existe, devuelve null o string vacío.
6. "celular": Número telefónico/celular/whatsapp si existe (solo números); si no existe, devuelve null o string vacío.
7. "sie": Código SIE de la Unidad Educativa si existe; si no existe, devuelve null o string vacío.
8. "unidad_educativa": Nombre de la Unidad Educativa / Colegio / Escuela en MAYÚSCULAS; si no existe, devuelve null o string vacío.
9. No inventes participantes. Extrae únicamente los que se encuentren en la información.
10. Si hay filas de encabezado, totales o firmas que no correspondan a participantes, omítelas.

IMPORTANTE: Devuelve ÚNICAMENTE el array JSON válido, sin explicaciones, sin texto antes ni después.
`;

    let userPrompt = `Por favor analiza esta nómina de participantes${fileName ? ` (Archivo: ${fileName})` : ''} y extrae a todos los participantes en formato JSON.`;

    if (extractedText) {
      userPrompt += `\n\n--- CONTENIDO DE LA PLANILLA / TEXTO EXTRAÍDO ---\n${extractedText}\n--- FIN CONTENIDO ---`;
    }

    // Call AI provider (OpenCode Go primary, Gemini fallback)
    const rawAiResponse = await callAI({
      prompt: userPrompt,
      systemPrompt,
      fileBase64: fileData,
      mimeType: mimeType || 'image/jpeg'
    });

    if (!rawAiResponse) {
      throw new Error('La IA no retornó ninguna respuesta');
    }

    // Clean JSON response (remove markdown fences, extra whitespace)
    let cleanedText = rawAiResponse.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '');
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```\s*/i, '').replace(/```\s*$/i, '');
    }

    cleanedText = cleanedText.trim();

    // Parse extracted JSON
    let participants: any[] = [];
    try {
      const parsed = JSON.parse(cleanedText);
      if (Array.isArray(parsed)) {
        participants = parsed;
      } else if (typeof parsed === 'object' && parsed !== null) {
        if (Array.isArray(parsed.participantes)) {
          participants = parsed.participantes;
        } else if (Array.isArray(parsed.data)) {
          participants = parsed.data;
        } else if (Array.isArray(parsed.participants)) {
          participants = parsed.participants;
        } else if (Array.isArray(parsed.nomina)) {
          participants = parsed.nomina;
        } else {
          participants = [parsed];
        }
      }
    } catch (parseErr) {
      // Try regex search for json array in response
      const arrayMatch = cleanedText.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (arrayMatch) {
        try {
          participants = JSON.parse(arrayMatch[0]);
        } catch (e2) {
          console.error('Failed fallback regex JSON parse:', cleanedText);
          throw new Error('No se pudo interpretar el JSON retornado por la IA');
        }
      } else {
        console.error('AI Raw response could not be parsed:', cleanedText);
        throw new Error('La respuesta de la IA no contiene un formato de participantes válido.');
      }
    }

    // Sanitize and normalize participants array
    const sanitized = participants.map((p: any) => {
      const rawCi = String(p.ci || p.carnet || p.cedula || p.documento || '').replace(/\D/g, '');
      const rawNombres = String(p.nombres || p.nombre || '').trim().toUpperCase();
      const rawApellidos = String(p.apellidos || p.apellido || '').trim().toUpperCase();
      const rawRda = p.rda ? String(p.rda).trim() : '';
      const rawCelular = p.celular || p.telefono ? String(p.celular || p.telefono).replace(/\D/g, '') : '';
      const rawSie = p.sie ? String(p.sie).replace(/\D/g, '') : '';
      const rawUnidad = String(p.unidad_educativa || p.colegio || p.escuela || '').trim().toUpperCase();

      return {
        ci: rawCi,
        nombres: rawNombres,
        apellidos: rawApellidos,
        rda: rawRda,
        celular: rawCelular,
        sie: rawSie,
        unidad_educativa: rawUnidad
      };
    }).filter(p => p.ci || p.nombres || p.apellidos);

    return NextResponse.json({
      success: true,
      data: sanitized,
      count: sanitized.length
    });

  } catch (error: any) {
    console.error('AI Parse Nomina Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Error al procesar el archivo con Inteligencia Artificial (OpenCode Go)' },
      { status: 500 }
    );
  }
}
