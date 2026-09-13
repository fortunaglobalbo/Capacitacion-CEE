import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';

    let cursoId = 'general';
    let fileBuffer: Buffer | null = null;
    let fileExtension = 'jpg';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const formCursoId = formData.get('cursoId') as string | null;

      if (formCursoId) {
        cursoId = formCursoId.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '');
      }

      if (!file) {
        return NextResponse.json({ success: false, message: 'No se recibió ningún archivo' }, { status: 400 });
      }

      const originalName = file.name || 'afiche.jpg';
      const parts = originalName.split('.');
      if (parts.length > 1) {
        fileExtension = parts.pop()?.toLowerCase() || 'jpg';
      }

      const arrayBuffer = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);

    } else {
      // JSON body (base64)
      const body = await request.json();
      if (body.cursoId) {
        cursoId = String(body.cursoId).trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '');
      }

      const base64Data = body.image || body.base64;
      if (!base64Data) {
        return NextResponse.json({ success: false, message: 'No se recibieron datos de imagen' }, { status: 400 });
      }

      const matches = base64Data.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
      if (matches) {
        fileExtension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
        fileBuffer = Buffer.from(matches[2], 'base64');
      } else {
        fileBuffer = Buffer.from(base64Data, 'base64');
      }
    }

    if (!fileBuffer) {
      return NextResponse.json({ success: false, message: 'Error al procesar el archivo' }, { status: 400 });
    }

    // Asegurar directorio public/afiches
    const publicDir = path.join(process.cwd(), 'public', 'afiches');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    const timestamp = Date.now();
    const fileName = `afiche-${cursoId}-${timestamp}.${fileExtension}`;
    const filePath = path.join(publicDir, fileName);

    fs.writeFileSync(filePath, fileBuffer);

    const relativeUrl = `/afiches/${fileName}`;

    return NextResponse.json({
      success: true,
      url: relativeUrl,
      fileName,
      cursoId
    });

  } catch (error: any) {
    console.error('Error en /api/afiche/upload:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'Error al guardar el afiche'
    }, { status: 500 });
  }
}
