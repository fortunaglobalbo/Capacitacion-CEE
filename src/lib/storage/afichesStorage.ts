import { supabase } from '@/lib/supabase/client';

// Base de datos IndexedDB para afiches (sin límite estricto de 5MB)
const IDB_AFICHES_DB = 'cee_afiches_db';
const IDB_AFICHES_STORE = 'afiches';

function openAfichesDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB no está disponible'));
    }
    const request = indexedDB.open(IDB_AFICHES_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_AFICHES_STORE)) {
        db.createObjectStore(IDB_AFICHES_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Guarda el afiche en IndexedDB (soporta cientos de megabytes)
 */
export async function saveAficheToIDB(cursoId: string, urlOrBase64: string): Promise<void> {
  try {
    const db = await openAfichesDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_AFICHES_STORE, 'readwrite');
      const store = tx.objectStore(IDB_AFICHES_STORE);
      store.put(urlOrBase64, `afiche_curso_${cursoId}`);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('Error al guardar afiche en IndexedDB:', e);
  }
}

/**
 * Obtiene el afiche desde IndexedDB
 */
export async function getAficheFromIDB(cursoId: string): Promise<string | null> {
  try {
    const db = await openAfichesDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_AFICHES_STORE, 'readonly');
      const store = tx.objectStore(IDB_AFICHES_STORE);
      const req = store.get(`afiche_curso_${cursoId}`);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

/**
 * Guarda de forma segura en almacenamiento local (IndexedDB + localStorage con protección anti-cuota)
 */
export async function saveAficheLocallySafe(cursoId: string, urlOrBase64: string): Promise<void> {
  if (typeof window === 'undefined' || !cursoId) return;

  // 1. Guardar siempre en IndexedDB (no tiene el límite de 5MB)
  await saveAficheToIDB(cursoId, urlOrBase64);

  // 2. Intentar guardar en localStorage con protección contra QuotaExceededError
  try {
    localStorage.setItem(`afiche_curso_${cursoId}`, urlOrBase64);
  } catch (quotaErr) {
    console.warn(`LocalStorage quota excedida al guardar afiche_curso_${cursoId}. Se preserva en IndexedDB.`);
    // Si la cuota se llenó por cadenas base64 gigantes antiguas, limpiar elementos pesados viejos
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('afiche_curso_') && key !== `afiche_curso_${cursoId}`) {
          const val = localStorage.getItem(key);
          if (val && val.length > 500000) { // Si pesa más de 500KB
            localStorage.removeItem(key);
          }
        }
      }
      // Reintentar tras limpiar
      localStorage.setItem(`afiche_curso_${cursoId}`, urlOrBase64);
    } catch {
      // Si aún falla, se mantiene en IndexedDB sin interrumpir la app
    }
  }
}

/**
 * Genera la URL pública directa desde Supabase Storage para un curso (accesible en celulares y cualquier red)
 */
export function getAfichePublicUrl(cursoId: string): string {
  if (!cursoId) return '';
  const cleanId = cursoId.trim();
  const { data } = supabase.storage.from('comprobantes').getPublicUrl(`afiches/afiche_${cleanId}.jpg`);
  return data?.publicUrl || '';
}

/**
 * Obtiene el afiche combinando Supabase Storage (para celulares y cualquier dispositivo),
 * localStorage e IndexedDB.
 */
export async function getAficheLocallySafe(cursoId: string, fallbackUrl?: string | null): Promise<string> {
  if (fallbackUrl && !fallbackUrl.startsWith('data:') && fallbackUrl.length < 500) {
    return fallbackUrl;
  }

  const cleanId = cursoId ? cursoId.trim() : '';

  // 1. Primero intentar en Supabase Storage (accesible desde cualquier celular)
  if (cleanId) {
    try {
      const { data: listData } = await supabase.storage.from('comprobantes').list('afiches');
      if (listData && listData.length > 0) {
        const match = listData.find(f =>
          f.name === `afiche_${cleanId}.jpg` ||
          f.name.startsWith(`afiche_${cleanId}_`) ||
          f.name.includes(`_${cleanId}_`)
        );
        if (match) {
          const { data } = supabase.storage.from('comprobantes').getPublicUrl(`afiches/${match.name}`);
          if (data?.publicUrl) return data.publicUrl;
        }
      }
    } catch (storageErr) {
      console.warn('Verificación en Supabase Storage:', storageErr);
    }
  }

  // 2. Fallback a IndexedDB / LocalStorage del navegador
  if (typeof window !== 'undefined' && cleanId) {
    try {
      const stored = localStorage.getItem(`afiche_curso_${cleanId}`);
      if (stored) return stored;
    } catch {}

    const idbStored = await getAficheFromIDB(cleanId);
    if (idbStored) return idbStored;
  }

  return fallbackUrl || (cleanId ? getAfichePublicUrl(cleanId) : '');
}

/**
 * Comprime y escala cualquier imagen (JPG, PNG, WEBP, capturas de celular)
 * reduciéndola de 5-15MB a ~150-250KB con nitidez profesional.
 */
export function compressImageFile(file: File, maxDim = 1400, quality = 0.85): Promise<{ base64: string; file: File }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo de imagen.'));
    reader.onload = (event) => {
      const rawDataUrl = event.target?.result as string;
      if (!rawDataUrl) return reject(new Error('Archivo vacío.'));

      const img = new Image();
      img.onerror = () => reject(new Error('Formato de imagen no compatible.'));
      img.onload = () => {
        try {
          let width = img.naturalWidth || img.width || 800;
          let height = img.naturalHeight || img.height || 1000;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return resolve({ base64: rawDataUrl, file });
          }

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          const compressedBase64 = canvas.toDataURL('image/jpeg', quality);

          canvas.toBlob((blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              resolve({ base64: compressedBase64, file: compressedFile });
            } else {
              resolve({ base64: compressedBase64, file });
            }
          }, 'image/jpeg', quality);

        } catch (err) {
          console.warn('Fallo en compresión canvas, usando original:', err);
          resolve({ base64: rawDataUrl, file });
        }
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Función principal para subir y vincular afiches:
 * 1. Comprime la imagen (evita cuota de memoria).
 * 2. Intenta subir a Supabase Storage (URL corta y pública).
 * 3. Si no, intenta endpoint local `/api/afiche/upload`.
 * 4. Fallback al base64 comprimido.
 * 5. Guarda en IndexedDB y localStorage con protección anti-cuota.
 * 6. Actualiza Supabase en la tabla `cursos`.
 */
export async function uploadAndSaveAfiche(cursoId: string, rawFile: File): Promise<string> {
  const cleanId = cursoId.trim();

  // 1. Comprimir imagen
  const { base64: compressedBase64, file: compressedFile } = await compressImageFile(rawFile, 1400, 0.85);

  let finalUrl = compressedBase64;

  // 2. Intentar subir a Supabase Storage (bucket 'comprobantes' o 'afiches')
  let uploadedToStorage = false;
  try {
    const fileName = `afiche_${cleanId}_${Date.now()}.jpg`;
    const filePath = `afiches/${fileName}`;
    const fixedPath = `afiches/afiche_${cleanId}.jpg`;

    const { data, error } = await supabase.storage
      .from('comprobantes')
      .upload(filePath, compressedFile, {
        cacheControl: '3600',
        upsert: true
      });

    // Subir también con nombre fijo para acceso directo universal desde cualquier celular
    await supabase.storage
      .from('comprobantes')
      .upload(fixedPath, compressedFile, {
        cacheControl: '3600',
        upsert: true
      });

    if (!error && data) {
      const { data: publicUrlData } = supabase.storage.from('comprobantes').getPublicUrl(fixedPath);
      if (publicUrlData?.publicUrl) {
        finalUrl = publicUrlData.publicUrl;
        uploadedToStorage = true;
      }
    }
  } catch (storageErr) {
    console.warn('Supabase Storage intento omitido:', storageErr);
  }

  // 3. Si no se pudo en Supabase Storage, probar la API Next.js `/api/afiche/upload`
  if (!uploadedToStorage) {
    try {
      const formData = new FormData();
      formData.append('file', compressedFile);
      formData.append('cursoId', cleanId);

      const res = await fetch('/api/afiche/upload', {
        method: 'POST',
        body: formData
      });

      const resData = await res.json();
      if (res.ok && resData.success && resData.url) {
        finalUrl = resData.url;
      }
    } catch (apiErr) {
      console.warn('API /api/afiche/upload omitida, usando base64 comprimido:', apiErr);
    }
  }

  // 4. Guardar localmente de forma segura (IndexedDB + localStorage anti-cuota)
  await saveAficheLocallySafe(cleanId, finalUrl);

  // 5. Actualizar Supabase en tabla cursos
  try {
    await supabase
      .from('cursos')
      .update({
        afiche_url: finalUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', cleanId);
  } catch (dbErr) {
    console.warn('Actualización de columna afiche_url en tabla cursos:', dbErr);
  }

  return finalUrl;
}

/**
 * Guarda metadatos dinámicos del curso (como Modalidad: MOOC) en Supabase Storage
 * para que se sincronicen y respeten en cualquier dispositivo y celular.
 */
export async function saveCursoMetadata(cursoId: string, metaData: { modalidad?: string; costo?: number }): Promise<void> {
  try {
    const cleanId = cursoId.trim();
    let currentMeta: Record<string, any> = {};
    try {
      const res = await fetch(`https://qcsbxjovrhxrafbxaiqd.supabase.co/storage/v1/object/public/comprobantes/cursos_metadata.json?v=${Date.now()}`);
      if (res.ok) {
        currentMeta = await res.json();
      }
    } catch {}

    currentMeta[cleanId] = {
      ...currentMeta[cleanId],
      ...metaData,
      updated_at: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(currentMeta, null, 2)], { type: 'application/json' });
    await supabase.storage.from('comprobantes').upload('cursos_metadata.json', blob, { upsert: true });
  } catch (e) {
    console.warn('Error al guardar metadata de cursos:', e);
  }
}

/**
 * Carga metadatos dinámicos de los cursos desde Supabase Storage
 */
export async function loadCursosMetadata(): Promise<Record<string, { modalidad?: string; costo?: number }>> {
  try {
    const res = await fetch(`https://qcsbxjovrhxrafbxaiqd.supabase.co/storage/v1/object/public/comprobantes/cursos_metadata.json?v=${Date.now()}`);
    if (res.ok) {
      return await res.json();
    }
  } catch {}
  return {};
}

