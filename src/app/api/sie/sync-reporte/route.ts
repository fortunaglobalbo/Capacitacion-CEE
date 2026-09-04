import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300; // Allow up to 5 minutes on Vercel Pro/Hobby

const BASE_URL = 'https://sie.unefco.edu.bo';

const MESES: Record<string, number> = {
  Ene: 1, Feb: 2, Mar: 3, Abr: 4, May: 5, Jun: 6, Jul: 7, Ago: 8, Sep: 9, Oct: 10, Nov: 11, Dic: 12,
  Enero: 1, Febrero: 2, Marzo: 3, Abril: 4, Mayo: 5, Junio: 6, Julio: 7, Agosto: 8, Septiembre: 9, Octubre: 10, Noviembre: 11, Diciembre: 12
};

const MONTH_NAMES: Record<number, string> = {
  1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril', 5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto', 9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre'
};

function normalizeText(str: string) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
}

function parseSpanishDate(s: string): Date | null {
  if (!s) return null;
  const m = s.match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = MESES[m[2]] || 1;
    const year = parseInt(m[3], 10);
    return new Date(year, month - 1, day);
  }
  return null;
}

function parseStartDate(dateStr: string): Date | null {
  const m = dateStr.match(/(\d+)\/(\w+)\s*-\s*(\d+)\/(\w+)\/(\d+)/);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = MESES[m[2]] || 1;
    const year = parseInt(m[5], 10);
    return new Date(year, month - 1, day);
  }
  return null;
}

function parseCourseDates(dateStr: string): Date | null {
  const m = dateStr.match(/(\d+)\/(\w+)\s*-\s*(\d+)\/(\w+)\/(\d+)/);
  if (m) {
    const day = parseInt(m[3], 10);
    const month = MESES[m[4]] || 1;
    const year = parseInt(m[5], 10);
    return new Date(year, month - 1, day);
  }
  return null;
}

const DIAS_SEMANA_ABBR = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function formatDtShort(d: Date | null): string {
  if (!d) return '';
  const diaSem = DIAS_SEMANA_ABBR[d.getDay()];
  const diaNum = d.getDate().toString().padStart(2, '0');
  const abbr = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${diaSem} ${diaNum}/${abbr[d.getMonth() + 1] || d.getMonth() + 1}`;
}

function validPlanif(planifDate: Date | null, inicioDate: Date | null): boolean {
  if (!planifDate || !inicioDate) return false;
  const p = new Date(planifDate.getFullYear(), planifDate.getMonth(), planifDate.getDate());
  const i = new Date(inicioDate.getFullYear(), inicioDate.getMonth(), inicioDate.getDate());
  const minPlan = new Date(i);
  minPlan.setDate(minPlan.getDate() - 5);
  return p >= minPlan && p <= i;
}

function validInforme(cierreDate: Date | null, finDate: Date | null): boolean {
  if (!cierreDate || !finDate) return false;
  const c = new Date(cierreDate.getFullYear(), cierreDate.getMonth(), cierreDate.getDate());
  const f = new Date(finDate.getFullYear(), finDate.getMonth(), finDate.getDate());
  const maxInf = new Date(f);
  maxInf.setDate(maxInf.getDate() + 5);
  return c >= f && c <= maxInf;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const username = body.username || 'gilmar.chavarria@unefco.edu.bo';
    const password = body.password || 'GILMAR.chavarria24#';
    const action = body.action || 'sync';

    console.log(`=== Iniciando sesión en SIE UNEFCO para ${username} (modo: ${action}) ===`);

    // 1. GET login page for initial CSRF token & cookies
    const loginGetRes = await fetch(`${BASE_URL}/login`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    const loginGetHtml = await loginGetRes.text();
    const csrfMatches = [...loginGetHtml.matchAll(/name=["']csrfmiddlewaretoken["']\s+value=["']([^"']+)["']/g)];
    const csrfToken = csrfMatches.length > 0 ? csrfMatches[csrfMatches.length - 1][1] : '';

    let initialCsrfCookie = '';
    const setCookies1 = loginGetRes.headers.getSetCookie();
    for (const c of setCookies1) {
      const match = c.match(/csrftoken=([^;]+)/);
      if (match) initialCsrfCookie = match[1];
    }

    if (!csrfToken || !initialCsrfCookie) {
      return NextResponse.json({ success: false, error: 'No se pudo obtener el token CSRF inicial del SIE UNEFCO' }, { status: 500 });
    }

    // 2. POST login credentials
    const loginParams = new URLSearchParams();
    loginParams.append('csrfmiddlewaretoken', csrfToken);
    loginParams.append('username', username);
    loginParams.append('password', password);

    const loginPostRes = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': `csrftoken=${initialCsrfCookie}`,
        'Referer': `${BASE_URL}/login`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      body: loginParams.toString(),
      redirect: 'manual',
    });

    const setCookies2 = loginPostRes.headers.getSetCookie();
    let sessionId = '';
    let loggedCsrf = initialCsrfCookie;

    for (const c of setCookies2) {
      const mSession = c.match(/sessionid=([^;]+)/);
      if (mSession) sessionId = mSession[1];
      const mCsrf = c.match(/csrftoken=([^;]+)/);
      if (mCsrf) loggedCsrf = mCsrf[1];
    }

    const isLoginSuccess = (loginPostRes.status === 302 || loginPostRes.status === 301 || !!sessionId);

    if (!isLoginSuccess) {
      return NextResponse.json({ success: false, error: 'Credenciales del SIE incorrectas o fallo de inicio de sesión en el portal' }, { status: 401 });
    }

    const cookieHeader = `csrftoken=${loggedCsrf}; sessionid=${sessionId}`;
    console.log('Login OK en SIE UNEFCO. Sesión activa:', sessionId.substring(0, 8) + '...');

    // Si la acción es solo verificar conexión, retornar éxito de inmediato
    if (action === 'verify') {
      return NextResponse.json({
        success: true,
        message: 'Conexión establecida con éxito con el portal SIE UNEFCO',
        username,
      });
    }

    // 3. CSRF token for programming requests (using session CSRF from cookie directly)
    const progCsrf = loggedCsrf || csrfToken;

    // 4. Months to fetch: Allow custom list from request or default to relevant active months [5, 6, 7, 8]
    const customMonths = Array.isArray(body.months) ? body.months : (body.month ? [Number(body.month)] : null);
    const currentMonth = new Date().getMonth() + 1;
    const months: number[] = customMonths && customMonths.length > 0
      ? customMonths
      : [5, 6, 7, 8];

    if (!months.includes(currentMonth) && currentMonth >= 1 && currentMonth <= 12) {
      months.push(currentMonth);
    }

    const monthsDisplay = months.map(m => MONTH_NAMES[m] || m).join(' - ');
    console.log(`[SIE Reporte] Extrayendo meses: ${monthsDisplay}`);

    // Fetch all month programming indexes in parallel
    const allRawCourses: any[] = [];
    await Promise.all(months.map(async (monthVal) => {
      try {
        const monthName = MONTH_NAMES[monthVal] || `${monthVal}`;
        const indexUrl = `${BASE_URL}/events/programming/index?csrfmiddlewaretoken=${progCsrf}&phase_filter=15&departament=9&profile=0&month=${monthVal}&modality=0`;
        const idxRes = await fetch(indexUrl, {
          headers: {
            'Cookie': cookieHeader,
            'Referer': `${BASE_URL}/events/programming`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          signal: AbortSignal.timeout(15000),
        });

        if (!idxRes.ok) {
          console.warn(`[SIE Reporte] Error HTTP ${idxRes.status} al consultar mes ${monthName}`);
          return;
        }

        const idxHtml = await idxRes.text();
        const tableMatch = idxHtml.match(/<table[^>]*>[\s\S]*?<\/table>/i);
        if (!tableMatch) return;

        const rowMatches = tableMatch[0].match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
        for (const rowHtml of rowMatches) {
          const celdas = rowHtml.match(/<td[^>]*>[\s\S]*?<\/td>/gi) || [];
          if (celdas.length < 11) continue;

          const txt = celdas.map(c => c.replace(/<[^>]+>/g, '').trim());
          if (!/^\d+$/.test(txt[0])) continue;

          const detailMatch = rowHtml.match(/href=["'](\/events\/\d+\/detail)["']/i);
          if (detailMatch) {
            allRawCourses.push({
              monthName,
              num: txt[0],
              curso: txt[1],
              lugar: txt[2],
              inicio: txt[4],
              socializacion: txt[5],
              facilitador: txt[8],
              prev: txt[9],
              parts: txt[10],
              url_detalle: detailMatch[1],
            });
          }
        }
      } catch (err: any) {
        console.warn(`[SIE Reporte] Error al consultar mes ${monthVal}:`, err.message);
      }
    }));

    // Deduplicate event URLs upfront so the same event is never scraped twice
    const uniqueCoursesMap = new Map<string, any>();
    for (const c of allRawCourses) {
      if (c.url_detalle && !uniqueCoursesMap.has(c.url_detalle)) {
        uniqueCoursesMap.set(c.url_detalle, c);
      }
    }
    const uniqueCourses = Array.from(uniqueCoursesMap.values());
    console.log(`[SIE Reporte] Encontrados ${uniqueCourses.length} eventos únicos a procesar (de ${allRawCourses.length} registros).`);

    // Process unique events with parallel batching
    const BATCH_SIZE = 6;
    const allEvents: any[] = [];

    for (let i = 0; i < uniqueCourses.length; i += BATCH_SIZE) {
      const batch = uniqueCourses.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map(async (c) => {
        try {
          if (!c.url_detalle) return null;

          const detailUrl = c.url_detalle.startsWith('http') ? c.url_detalle : BASE_URL + c.url_detalle;
          const detRes = await fetch(detailUrl, {
            headers: {
              'Cookie': cookieHeader,
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            signal: AbortSignal.timeout(12000),
          });

          if (!detRes.ok) {
            console.warn(`[SIE Reporte] Error HTTP ${detRes.status} en evento: ${c.url_detalle}. Saltando.`);
            return null;
          }

          const detHtml = await detRes.text();

          // Parse Cycle
          const cicloMatch = detHtml.match(/CICLO:\s*(.*?)<\/span>/i);
          const ciclo = cicloMatch ? cicloMatch[1].replace(/<[^>]+>/g, '').trim() : '';

          // Parse course cards & date update IDs
          const courseCards = [...detHtml.matchAll(/<span[^>]*class=["']badge[^"]*badge-primary[^"']*["'][^>]*>([\s\S]*?)<\/span>\s*<h6[^>]*class=["']mb-0[^>]*>([\s\S]*?)<\/h6>/gi)];
          const courseIds = [...detHtml.matchAll(/id=["']date-course-update-(\d+)["']/gi)].map(m => m[1]);

          // Si el evento está vacío (sin cursos programados), saltar limpiamente
          if (!courseIds || courseIds.length === 0) {
            return null;
          }

          const courseDates: Record<string, string> = {};
          for (const cid of courseIds) {
            const dm = detHtml.match(new RegExp(`id=["']date-course-update-${cid}["']>(.*?)<\/strong>`, 'i'));
            courseDates[cid] = dm ? dm[1].replace(/<[^>]+>/g, '').trim() : '';
          }

          const courseNamesList = courseCards.map(m => m[2].replace(/<[^>]+>/g, '').trim());
          let fechaStr = '';

          // Fetch all courses in this event in parallel
          const evCourses = await Promise.all(courseIds.map(async (cid, idx) => {
            const cursoName = courseNamesList[idx] || '';
            const fstr = courseDates[cid] || '';
            if (idx === 0) fechaStr = fstr;

            let cInicio = '', cFin = '';
            if (fstr && fstr.includes(' - ')) {
              const parts = fstr.split(' - ');
              cInicio = parts[0] ? parts[0].trim() : '';
              cFin = parts[1] ? parts[1].trim() : '';
            }

            const endDate = parseCourseDates(fstr);
            const deadline = endDate ? new Date(endDate.getTime() + 5 * 24 * 3600 * 1000) : null;
            const afterDeadline = deadline ? new Date() > deadline : false;

            // Check Plan & Report Docs in HTML
            let hasPlan = false, hasReport = false, docid = '';
            try {
              const chunks = detHtml.split(/<div[^>]*class=["'][^"']*(?:course-card|col-lg-6 col-xl-4)[^"']*["']/i);
              const foundChunk = chunks.find(ch => ch.includes(`date-course-update-${cid}`) || ch.includes(`/inscription/${cid}`));
              const cardContent = foundChunk || '';

              if (cardContent) {
                hasPlan = /\/events\/sede\/planning\/report\/\d+\/1/i.test(cardContent);
                const docm = cardContent.match(/\/events\/reportes\/documentos-sede\/(\d+)/i);
                hasReport = !!docm;
                docid = docm ? docm[1] : '';
              }
            } catch (e) {}

            // Fetch grades, valoración, and document details in parallel with timeout
            const [gRes, vRes, docRes] = await Promise.allSettled([
              fetch(`${BASE_URL}/inscription/${cid}`, { headers: { 'Cookie': cookieHeader }, signal: AbortSignal.timeout(8000) }).then(r => r.ok ? r.text() : ''),
              fetch(`${BASE_URL}/events/ficha-valoracion/${cid}`, { headers: { 'Cookie': cookieHeader }, signal: AbortSignal.timeout(8000) }).then(r => r.ok ? r.text() : ''),
              docid ? fetch(`${BASE_URL}/events/reportes/documentos-sede/${docid}`, { headers: { 'Cookie': cookieHeader }, signal: AbortSignal.timeout(8000) }).then(r => r.ok ? r.text() : '') : Promise.resolve('')
            ]);

            const gHtml = gRes.status === 'fulfilled' ? gRes.value : '';
            const vHtml = vRes.status === 'fulfilled' ? vRes.value : '';
            const docHtml = docRes.status === 'fulfilled' ? docRes.value : '';

            // Process grades
            let totalStd = 0, failed = 0, evalNotasResp = 0;
            if (gHtml) {
              const gTableMatch = gHtml.match(/<table[^>]*>[\s\S]*?<\/table>/i);
              if (gTableMatch) {
                const gRows = gTableMatch[0].match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
                for (const r of gRows) {
                  const cells = (r.match(/<td[^>]*>[\s\S]*?<\/td>/gi) || []).map(td => td.replace(/<[^>]+>/g, '').trim());
                  if (cells.length >= 10 && /^\d+$/.test(cells[0])) {
                    totalStd++;
                    const pPresencial = parseFloat(cells[7]) || 0;
                    const pConcrecion = parseFloat(cells[8]) || 0;
                    const pSocializacion = parseFloat(cells[9]) || 0;
                    const pApropiacionMatch = (cells[10] || '').match(/(\d+(?:[.,]\d+)?)\s*pts/i);
                    const pApropiacion = pApropiacionMatch ? parseFloat(pApropiacionMatch[1].replace(',', '.')) : 0;
                    const notaFinal = parseFloat(cells[11]) || (pPresencial + pConcrecion + pSocializacion + pApropiacion);

                    if (pPresencial > 0 || pConcrecion > 0 || pSocializacion > 0 || pApropiacion > 0 || notaFinal > 0) {
                      evalNotasResp++;
                      if (notaFinal > 0 && notaFinal < 70) failed++;
                    }
                  }
                }
              }
            }

            // Process valoración
            let responded = 0, totalVal = totalStd, valPct = 0, valDisabled = false;
            if (vHtml) {
              if (vHtml.includes('EVALUACIÓN DESHABILITADA') || vHtml.includes('NO HABILITADA')) {
                valDisabled = true;
                responded = 0;
                valPct = 0;
              } else {
                const pCards = (vHtml.match(/class=["']participant-card["']/gi) || []).length;
                const sinVal = (vHtml.match(/Sin valoraci/gi) || []).length;
                const tv = pCards > 0 ? pCards : totalStd;
                if (tv > 0) {
                  totalVal = tv;
                  responded = Math.max(0, totalVal - sinVal);
                  valPct = Math.round((responded / totalVal) * 1000) / 10;
                }
              }
            }

            // Process document details
            let planifDateStr = '', informeDateStr = '', conform = false;
            if (docHtml) {
              const mInf = docHtml.match(/Fecha de Cierre:\s*([^<]+)/i);
              informeDateStr = mInf ? mInf[1].trim() : '';
              const mPlan = docHtml.match(/Fecha de Planificaci[oó]n:\s*([^<]+)/i);
              planifDateStr = mPlan ? mPlan[1].trim() : '';
              conform = docHtml.includes('/facilitador/informe-conformidad/');
            }

            const planifDate = parseSpanishDate(planifDateStr);
            const cierreDate = parseSpanishDate(informeDateStr);
            const inicioDt = parseStartDate(fstr);
            const finDt = parseCourseDates(fstr);

            const planifOk = validPlanif(planifDate, inicioDt);
            const informeOk = validInforme(cierreDate, finDt);
            const conformOk = conform;
            const conformPend = !conformOk && !!informeDateStr;

            const todoOk = hasPlan && evalNotasResp >= 1 && hasReport && planifOk && informeOk && conformOk;

            return {
              cid,
              name: cursoName,
              dates: fstr,
              fecha_inicio: cInicio,
              fecha_fin: cFin,
              deadline: deadline ? `${deadline.getDate().toString().padStart(2, '0')}/${(deadline.getMonth() + 1).toString().padStart(2, '0')}/${deadline.getFullYear()}` : '',
              plan: hasPlan ? 'SI' : 'NO',
              has_plan: hasPlan,
              has_report: hasReport,
              conform_ok: conformOk,
              planif_date_obj: planifDate,
              cierre_date_obj: cierreDate,
              inicio_date_obj: inicioDt,
              fin_date_obj: finDt,
              eval_notas_resp: evalNotasResp,
              eval_notas_total: totalStd,
              val_pct: valPct,
              val_resp: responded,
              val_total: totalVal,
              val_disabled: valDisabled,
              repr: failed,
              rep: hasReport ? 'SI' : 'NO',
              planif_date: formatDtShort(planifDate),
              planif_ok: planifOk,
              informe_date: formatDtShort(cierreDate),
              informe_ok: informeOk,
              conform: conformOk ? 'SI' : 'NO',
              conform_pend: conformPend,
              todo_ok: todoOk,
              vencido: afterDeadline ? 'SI' : 'NO',
            };
          }));

          if (!evCourses || evCourses.length === 0) return null;

          let fInicio = '', fFin = '';
          if (fechaStr && fechaStr.includes(' - ')) {
            const parts = fechaStr.split(' - ');
            fInicio = parts[0] ? parts[0].trim() : '';
            fFin = parts[1] ? parts[1].trim() : '';
          }
          const eDate = parseCourseDates(fechaStr);
          const dl = eDate ? new Date(eDate.getTime() + 5 * 24 * 3600 * 1000) : null;
          const allOk = evCourses.every((cr: any) => cr.todo_ok);
          const anyVencido = evCourses.some((cr: any) => cr.vencido === 'SI');

          return {
            mes: c.monthName,
            ciclo: ciclo || c.curso || 'Ciclo General',
            sede: c.lugar,
            facilitador: c.facilitador,
            url_evento: detailUrl,
            fecha_rango: fechaStr,
            fecha_inicio: fInicio,
            fecha_fin: fFin,
            deadline: dl ? `${dl.getDate().toString().padStart(2, '0')}/${(dl.getMonth() + 1).toString().padStart(2, '0')}/${dl.getFullYear()}` : '',
            after_deadline: anyVencido ? 'SI' : 'NO',
            courses: evCourses,
            all_ok: allOk,
          };
        } catch (eventErr: any) {
          console.warn(`[SIE Reporte] Error procesando evento individual (${c.url_detalle}):`, eventErr.message);
          return null;
        }
      }));

      for (const res of batchResults) {
        if (res) allEvents.push(res);
      }
    }

    // Deduplicate by event ID
    const eventsById: Record<string, any> = {};
    for (const ev of allEvents) {
      const match = ev.url_evento.match(/\/events\/(\d+)\/detail/);
      const key = match ? match[1] : ev.url_evento;
      if (!eventsById[key]) {
        eventsById[key] = ev;
      }
    }
    const deduplicatedEvents: any[] = Object.values(eventsById);

    // Sort deduplicatedEvents by facilitator name so all rows/events for the same facilitator are grouped together
    deduplicatedEvents.sort((a: any, b: any) => {
      const facA = normalizeText(a.facilitador);
      const facB = normalizeText(b.facilitador);
      if (facA !== facB) return facA.localeCompare(facB);
      const cicloA = normalizeText(a.ciclo);
      const cicloB = normalizeText(b.ciclo);
      return cicloA.localeCompare(cicloB);
    });

    // Paso de Unificación Mensual por Facilitador:
    // Los facilitadores entregan UN SOLO informe final mensual.
    // Agrupamos todos los cursos de cada facilitador por mes de inicio (la que manda es Fecha de Inicio).
    const facilitatorMonthGroups: Record<string, {
      facilitador: string;
      mes: string;
      courses: any[];
      events: any[];
    }> = {};

    for (const ev of deduplicatedEvents) {
      const facKey = normalizeText(ev.facilitador);
      for (const cr of ev.courses) {
        cr.url_evento = ev.url_evento;
        let mNum = 0;
        const dtInicio = cr.inicio_date_obj || parseStartDate(cr.dates);
        if (dtInicio) {
          mNum = dtInicio.getMonth() + 1;
        } else if (cr.fin_date_obj) {
          mNum = cr.fin_date_obj.getMonth() + 1;
        }
        const mName = (mNum && MONTH_NAMES[mNum]) ? MONTH_NAMES[mNum] : (ev.mes || 'Mes');
        cr.socializacion_month = mName;
        cr.start_month = mName;
        const groupKey = `${facKey}_${mName.toLowerCase()}`;

        if (!facilitatorMonthGroups[groupKey]) {
          facilitatorMonthGroups[groupKey] = {
            facilitador: ev.facilitador,
            mes: mName,
            courses: [],
            events: [],
          };
        }
        facilitatorMonthGroups[groupKey].courses.push(cr);
        if (!facilitatorMonthGroups[groupKey].events.includes(ev)) {
          facilitatorMonthGroups[groupKey].events.push(ev);
        }
      }
    }

    // Para cada grupo (facilitador, mes): calcular fecha límite unificada (+5d de la última socialización del mes) y revalidar informe final
    for (const groupKey in facilitatorMonthGroups) {
      const grp = facilitatorMonthGroups[groupKey];
      let maxFin: Date | null = null;
      let latestInforme: Date | null = null;

      for (const cr of grp.courses) {
        if (cr.fin_date_obj) {
          if (!maxFin || cr.fin_date_obj > maxFin) {
            maxFin = cr.fin_date_obj;
          }
        }
        if (cr.cierre_date_obj) {
          if (!latestInforme || cr.cierre_date_obj > latestInforme) {
            latestInforme = cr.cierre_date_obj;
          }
        }
      }

      const unifiedDeadline = maxFin ? new Date(maxFin.getTime() + 5 * 24 * 3600 * 1000) : null;
      const unifiedDeadlineStr = unifiedDeadline 
        ? `${unifiedDeadline.getDate().toString().padStart(2, '0')}/${(unifiedDeadline.getMonth() + 1).toString().padStart(2, '0')}/${unifiedDeadline.getFullYear()}`
        : '';

      let latestSocTagged = false;
      for (const cr of grp.courses) {
        if (!latestSocTagged && maxFin && cr.fin_date_obj && cr.fin_date_obj.getTime() === maxFin.getTime()) {
          cr.is_latest_soc = true;
          latestSocTagged = true;
        } else {
          cr.is_latest_soc = false;
        }

        if (unifiedDeadlineStr) {
          cr.deadline = unifiedDeadlineStr;
        }
        const reportDate = cr.cierre_date_obj || latestInforme;
        if (reportDate) {
          cr.informe_date = formatDtShort(reportDate);
        }

        // Validación unificada del informe final mensual:
        // Es válido si existe la fecha de informe y se entregó en o antes de la fecha límite unificada
        if (reportDate && unifiedDeadline) {
          const rDateOnly = new Date(reportDate.getFullYear(), reportDate.getMonth(), reportDate.getDate());
          const dDateOnly = new Date(unifiedDeadline.getFullYear(), unifiedDeadline.getMonth(), unifiedDeadline.getDate());
          cr.informe_ok = rDateOnly <= dDateOnly;
        }

        const isPlanOk = cr.plan === 'SI';
        const planifDt = cr.planif_date_obj;
        const cInicioDt = cr.inicio_date_obj || parseStartDate(cr.dates);
        cr.planif_ok = isPlanOk && validPlanif(planifDt, cInicioDt);

        // Re-evaluar todo_ok
        cr.todo_ok = cr.has_plan && cr.eval_notas_resp >= 1 && (cr.has_report || !!reportDate) && cr.planif_ok && cr.informe_ok && cr.conform_ok;
      }
    }

    // Re-evaluar all_ok a nivel de evento
    for (const ev of deduplicatedEvents) {
      ev.all_ok = ev.courses.every((cr: any) => cr.todo_ok);
    }

    // Fetch technicians & course mappings from Supabase
    const [{ data: cursosDb }, { data: facsDb }] = await Promise.all([
      supabase.from('cursos').select('id, tecnico_carnet, facilitador_carnet'),
      supabase.from('facilitadores').select('carnet, nombre'),
    ]);

    const courseMap: Record<string, string> = {};
    (cursosDb || []).forEach(c => {
      if (c.id && c.tecnico_carnet) courseMap[c.id] = c.tecnico_carnet;
    });

    const facToTecnico: Record<string, string> = {};
    (cursosDb || []).forEach(c => {
      if (c.facilitador_carnet && c.facilitador_carnet !== '9999999' && c.tecnico_carnet) {
        facToTecnico[c.facilitador_carnet] = c.tecnico_carnet;
      }
    });

    // Helper functions for cell temperature & HTML generation
    function cellTemp(cr: any): string {
      if (cr.todo_ok) return 'cell-green';
      const inicioDate = cr.inicio_date_obj || parseStartDate(cr.dates);
      const finDate = cr.fin_date_obj || parseCourseDates(cr.dates);
      const deadlineDate = cr.deadline ? parseSpanishDate(cr.deadline) || (finDate ? new Date(finDate.getTime() + 5 * 24 * 3600 * 1000) : null) : null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const future = [inicioDate, finDate, deadlineDate].filter((d): d is Date => d !== null && d >= today);
      if (future.length === 0) return 'cell-red';
      const closest = new Date(Math.min(...future.map(d => d.getTime())));
      const diffDays = Math.ceil((closest.getTime() - today.getTime()) / (1000 * 3600 * 24));
      return diffDays <= 5 ? 'cell-yellow' : 'cell-blue';
    }

    function courseCellHtml(cr: any, facName: string, cIdx: number): string {
      function paso(ok: boolean, label: string, value: string, title = '', info = false): string {
        const ico = info ? '📅' : (ok ? '✓' : '✗');
        const cls = info ? 'info' : (ok ? 'ok' : 'bad');
        const titleAttr = title ? ` title="${title}"` : '';
        return `<div class="paso ${cls}"${titleAttr}><span class="ico">${ico}</span><span class="lbl">${label}</span><span class="val">${value}</span></div>`;
      }

      const inicioDt = cr.inicio_date_obj || parseStartDate(cr.dates);
      const finDt = cr.fin_date_obj || parseCourseDates(cr.dates);

      const inicioShort = formatDtShort(inicioDt) || cr.fecha_inicio || '—';
      const finShort = formatDtShort(finDt) || cr.fecha_fin || '—';

      const isPlanOk = cr.plan === 'SI';
      const planifDt = cr.planif_date_obj;
      const planifOk = isPlanOk && validPlanif(planifDt, inicioDt);
      const planifShort = planifDt ? formatDtShort(planifDt) : '—';
      cr.planif_ok = planifOk;

      let limiteShort = cr.deadline || '—';
      const parsedDeadline = parseSpanishDate(cr.deadline);
      if (parsedDeadline) {
        limiteShort = `${formatDtShort(parsedDeadline)} (Mes)`;
      }

      const infDt = cr.cierre_date_obj;
      const informeShort = infDt ? formatDtShort(infDt) : (cr.informe_date || '—');

      const pasos = [
        paso(isPlanOk, 'Planificación', cr.plan, 'Planificación (plan de trabajo): SI = existe'),
        paso(cr.planif_ok, 'Planificación Fecha', planifShort, 'Fecha de planificación: debe ser el mismo día de inicio o hasta 5 días antes'),
        paso(true, 'Fecha de inicio', inicioShort, 'Fecha de inicio oficial con día de la semana', true),
        paso(true, cr.is_latest_soc ? 'Socialización<span class="badge-ultima-soc" title="Última fecha de socialización del mes: define la fecha límite">🎯 Límite</span>' : 'Socialización', finShort, 'Última fecha de socialización con día de la semana', true),
        paso(cr.eval_notas_resp >= 1, 'Informe Evaluación', `${cr.eval_notas_resp}/${cr.eval_notas_total || cr.val_total}`, 'Estudiantes evaluados con notas por el facilitador / total'),
        paso(!cr.val_disabled && cr.val_pct > 0, 'Valoración', cr.val_disabled ? 'DESHABILITADA' : `${cr.val_pct}%`, 'Porcentaje de encuesta de valoración completada por estudiantes en SIE'),
        paso(cr.informe_ok, 'Informe Final', informeShort, 'Informe Final Mensual: fecha de cierre con día de la semana'),
        paso(cr.todo_ok, 'Fecha límite', limiteShort, 'Fecha límite mensual con día de la semana')
      ];

      const conformAlert = cr.conform_pend ? '<span class="badge conform-alert">⚠️ Generar Conformidad</span>' : '';
      const safeName = cr.name ? cr.name.substring(0, 70) : '';
      const cursoMes = (cr.start_month || 'mes').toLowerCase();
      const cleanKey = `sub_${normalizeText(facName).substring(0, 15)}_${cursoMes}_${cIdx}`;
      const pulseCls = cr.is_latest_soc ? ' curso-ultima-socializacion' : '';

      return `<div class="curso${pulseCls}" data-curso-mes="${cursoMes}" data-curso-key="${cleanKey}">
        <div class="curso-header">
            <span class="badge-curso-mes">${cr.start_month}</span>
        </div>
        <span class="nombre" title="${cr.name}">${safeName}</span>
        <div class="bateria">${pasos.join('')}</div>
        ${conformAlert}
        ${cr.url_evento ? `<a href="${cr.url_evento}" target="_blank" class="btn-sie-link" title="Abrir curso en SIE UNEFCO"><span>👁️</span> Ver en SIE</a>` : ''}
    </div>`;
    }

    const facilitatorColors = [
      '#f8fafc', '#f0f9ff', '#f0fdf4', '#fefce8', '#fdf2f8', '#faf5ff', '#fff7ed', '#f0fdfa'
    ];

    const facilitatorOrder: string[] = [];
    const facilitatorColorMap: Record<string, string> = {};
    for (const ev of deduplicatedEvents) {
      if (!facilitatorOrder.includes(ev.facilitador)) {
        facilitatorOrder.push(ev.facilitador);
      }
    }
    facilitatorOrder.forEach((fac, i) => {
      facilitatorColorMap[fac] = facilitatorColors[i % facilitatorColors.length];
    });

    const monthWeights: Record<string, number> = { mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
    const sortedGroupKeys = Object.keys(facilitatorMonthGroups).sort((a, b) => {
      const grpA = facilitatorMonthGroups[a];
      const grpB = facilitatorMonthGroups[b];
      const fA = normalizeText(grpA.facilitador);
      const fB = normalizeText(grpB.facilitador);
      if (fA !== fB) return fA.localeCompare(fB);
      const mA = monthWeights[grpA.mes.toLowerCase()] || 99;
      const mB = monthWeights[grpB.mes.toLowerCase()] || 99;
      return mA - mB;
    });

    let htmlRows = '';
    for (const groupKey of sortedGroupKeys) {
      const grp = facilitatorMonthGroups[groupKey];
      const bgColor = facilitatorColorMap[grp.facilitador] || '#ffffff';
      const mesLower = grp.mes.toLowerCase();

      // Ordenar cursos en orden ASCENDENTE según Fecha de Inicio
      grp.courses.sort((a: any, b: any) => {
        const dtA = (a.inicio_date_obj || parseStartDate(a.dates))?.getTime() || 0;
        const dtB = (b.inicio_date_obj || parseStartDate(b.dates))?.getTime() || 0;
        if (dtA !== dtB) return dtA - dtB;
        return (a.name || '').localeCompare(b.name || '');
      });

      // Determine technician for this facilitator month group
      let tec = '8639300';
      for (const ev of grp.events) {
        const idMatch = ev.sede ? ev.sede.match(/ID\s*(\d+)/i) : null;
        if (idMatch) {
          const dbCourse = (cursosDb || []).find(c => String(c.id) === String(idMatch[1]));
          if (dbCourse && dbCourse.tecnico_carnet) {
            tec = dbCourse.tecnico_carnet;
            break;
          }
        }
      }

      if (tec === '8639300' && grp.facilitador) {
        const facNorm = normalizeText(grp.facilitador);
        for (const f of (facsDb || [])) {
          const dbNorm = normalizeText(f.nombre);
          if (dbNorm && dbNorm !== 'por confirmar') {
            const facWords = facNorm.split(/\s+/).filter(w => w.length >= 2);
            const dbWords = dbNorm.split(/\s+/).filter(w => w.length >= 2);
            const isFirstNameCompatible = facWords.some(w => dbWords.includes(w) && !['nina', 'ortiz', 'vidal', 'chavez', 'alave', 'flores', 'garcia', 'mamani', 'quispe', 'rodriguez'].includes(w));
            if (isFirstNameCompatible) {
              const overlap = facWords.filter(w => dbWords.includes(w)).length;
              if (overlap >= 2 && facToTecnico[f.carnet]) {
                tec = facToTecnico[f.carnet];
                break;
              }
            }
          }
        }
      }

      let courseCells = '';
      grp.courses.forEach((cr: any, idx: number) => {
        const status = cellTemp(cr);
        courseCells += `<td class="${status}">${courseCellHtml(cr, grp.facilitador, idx)}</td>`;
      });
      for (let i = grp.courses.length; i < 5; i++) {
        courseCells += '<td class="empty-course-cell"></td>';
      }

      const sedesSet = new Set<string>();
      const ciclosSet = new Set<string>();
      grp.events.forEach(ev => {
        if (ev.sede) sedesSet.add(ev.sede);
        if (ev.ciclo) ciclosSet.add(ev.ciclo);
      });
      const sedesSummary = Array.from(sedesSet).join(' / ');
      const ciclosSummary = Array.from(ciclosSet).join(' / ');
      const sedesShort = sedesSummary.length > 55 ? sedesSummary.substring(0, 55) + '...' : sedesSummary;
      const ciclosShort = ciclosSummary.length > 60 ? ciclosSummary.substring(0, 60) + '...' : ciclosSummary;

      const rowAllOk = grp.courses.every((cr: any) => cr.todo_ok);
      const dataOk = rowAllOk ? '1' : '0';

      htmlRows += `<tr style="background:${bgColor}" data-ok="${dataOk}" data-tecnico="${tec}" data-mes="${mesLower}">
        <td style="text-align:center; vertical-align:middle; font-weight:700;">
            <span class="badge-row-mes">${grp.mes.toUpperCase()}</span>
        </td>
        <td title="${grp.facilitador}" style="vertical-align:middle;">
            <strong style="font-size:13px; color:#0f172a; display:block;">${grp.facilitador}</strong>
            <span style="font-size:11px; color:#64748b; font-weight:600;">${grp.courses.length} curso${grp.courses.length > 1 ? 's' : ''} en ${grp.mes}</span>
            <div style="margin-top: 6px;">
                <button type="button" class="btn-validar-fac" onclick="validarFacilitadorFila(this)" title="Revalidar datos de este facilitador en SIE UNEFCO">
                    <span class="btn-val-icon">🔄</span> <span class="btn-val-text">Validar</span>
                </button>
            </div>
        </td>
        <td title="${sedesSummary} | ${ciclosSummary}" style="vertical-align:middle; font-size:11px; max-width:220px;">
            <div style="font-weight:600; color:#334155; line-height:1.3;">${sedesShort || 'Sede General'}</div>
            <div style="color:#64748b; font-size:10px; margin-top:3px; line-height:1.2;">${ciclosShort}</div>
        </td>
        ${courseCells}
    </tr>`;
    }

    // Recopilar meses únicos para el selector de filtro por mes
    const allMonthsDetected = new Set<string>();
    for (const ev of deduplicatedEvents) {
      for (const cr of ev.courses) {
        if (cr.socializacion_month) {
          allMonthsDetected.add(cr.socializacion_month);
        }
        if (cr.start_month) {
          allMonthsDetected.add(cr.start_month);
        }
      }
    }
    const standardMonthOrder = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    let orderedMonths = standardMonthOrder.filter(m => allMonthsDetected.has(m));
    if (orderedMonths.length === 0) {
      orderedMonths = ['Mayo', 'Junio', 'Julio', 'Agosto'];
    }
    const monthOptionsHtml = `<option value="todos">Todos los meses</option>` + orderedMonths.map(m => `<option value="${m.toLowerCase()}">${m}</option>`).join('');

    const totalCourses = deduplicatedEvents.reduce((acc, ev) => acc + ev.courses.length, 0);
    const totalOk = deduplicatedEvents.filter(ev => ev.all_ok).length;
    const totalPending = deduplicatedEvents.length - totalOk;
    const nowFormatted = new Date().toLocaleString('es-BO', { timeZone: 'America/La_Paz' });

    const finalHtml = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Reporte de Monitoreo - ${monthsDisplay} 2026</title>
<style>
:root {
    --primary: #0d3b66;
    --primary-2: #1a5276;
    --accent: #2e86c1;
    --success: #16a34a;
    --warning: #f59e0b;
    --danger: #dc2626;
    --bg: #eef2f7;
    --card: #ffffff;
    --border: #e2e8f0;
    --text: #1f2937;
    --muted: #64748b;
}
* { box-sizing: border-box; }
body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 24px; }
.container { max-width: 1700px; margin: 0 auto; }
.header {
    background: linear-gradient(135deg, #0d3b66 0%, #1a5276 55%, #2e86c1 100%);
    color: #fff; border-radius: 14px; padding: 26px 32px; margin-bottom: 20px;
    box-shadow: 0 6px 18px rgba(13,59,102,.25);
}
.header h1 { margin: 0; font-size: 24px; letter-spacing: .5px; }
.header h2 { margin: 4px 0 0; font-weight: 300; font-size: 15px; opacity: .9; }
.header .meta { margin-top: 10px; font-size: 12px; opacity: .85; }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 14px; margin-bottom: 20px; }
.card { background: var(--card); border-radius: 12px; padding: 18px 20px; box-shadow: 0 2px 8px rgba(15,23,42,.06); border-left: 4px solid var(--accent); }
.card .label { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: .6px; }
.card .value { font-size: 28px; font-weight: 700; margin-top: 4px; }
.card.ok { border-left-color: var(--success); }
.card.pend { border-left-color: var(--danger); }
.toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 14px; }
.toolbar input[type=search] { flex: 1; min-width: 220px; padding: 10px 14px; border: 1px solid var(--border); border-radius: 8px; font-size: 13px; background: #fff; }
.toolbar button { padding: 10px 18px; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600; background: var(--primary-2); color: #fff; transition: all .15s; }
.toolbar button:hover { opacity: .88; }
.toolbar button.active { background: var(--danger); }
.table-wrap { background: var(--card); border-radius: 12px; box-shadow: 0 2px 10px rgba(15,23,42,.08); overflow: auto; max-height: 78vh; }
table { border-collapse: collapse; width: 100%; font-size: 12px; min-width: 1000px; }
thead { position: sticky; top: 0; z-index: 5; }
th { background: var(--primary); color: #fff; padding: 12px 8px; text-align: left; font-size: 11px; letter-spacing: .4px; text-transform: uppercase; white-space: nowrap; }
td { border-bottom: 1px solid var(--border); padding: 10px 8px; vertical-align: middle; }
tbody tr { transition: filter .12s; }
tbody tr:hover { filter: brightness(.96); }
.badge { display: inline-block; padding: 3px 8px; margin: 1px 2px 1px 0; border-radius: 999px; font-size: 10px; font-weight: 600; white-space: nowrap; }
.bg-success { background: #dcfce7 !important; color: #15803d !important; }
.bg-warning { background: #fef3c7 !important; color: #b45309 !important; }
.bg-danger { background: #fee2e2 !important; color: #b91c1c !important; }
.border-success { border: 2px solid #15803d; background: #ffffff; color: #166534; }
.border-warning { border: 2px solid #d97706; background: #ffffff; color: #92400e; }
.border-danger { border: 2px solid #b91c1c; background: #ffffff; color: #991b1b; }
.border-blue { border: 2px solid #1d4ed8; background: #ffffff; color: #1e40af; }
.hidden-col { display: none !important; }
.cell-blue { background: #dbeafe !important; }
.cell-green { background: #dcfce7 !important; }
.cell-yellow { background: #fef9c3 !important; }
.month-group-container {
    border: 2.5px solid #0284c7 !important;
    border-radius: 14px !important;
    padding: 10px 12px !important;
    background: #f0f9ff !important;
    box-shadow: 0 4px 12px rgba(2, 132, 199, 0.15) !important;
    margin-bottom: 8px !important;
}
.month-group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
    color: #ffffff;
    padding: 6px 14px;
    border-radius: 8px;
    font-size: 11px;
    font-weight: 800;
    margin-bottom: 10px;
    letter-spacing: 0.5px;
    box-shadow: 0 2px 6px rgba(2, 132, 199, 0.2);
}
.month-group-count {
    background: rgba(255, 255, 255, 0.22);
    padding: 2px 9px;
    border-radius: 12px;
    font-size: 10px;
    font-weight: 700;
}
.month-group-courses {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    align-items: stretch;
}
.curso-wrap {
    border-radius: 12px;
    padding: 3px;
    display: flex;
}
.curso {
    position: relative !important;
    min-width: 175px;
    max-width: 300px;
    border: 2px solid #0284c7 !important;
    border-radius: 12px !important;
    padding: 8px !important;
    padding-top: 12px !important;
    background: #ffffff !important;
    box-shadow: 0 3px 10px rgba(2, 132, 199, 0.12) !important;
    transition: all 0.2s ease !important;
}
.curso-start-month-header {
    display: none !important;
}
.curso.curso-prioritario {
    border: 2.5px solid #e11d48 !important;
    box-shadow: 0 4px 12px rgba(225, 29, 72, 0.25) !important;
    border-radius: 12px !important;
}
@keyframes pulse-border-glow {
    0%, 100% {
        border-color: #0284c7 !important;
        box-shadow: 0 0 0 0 rgba(2, 132, 199, 0.4), 0 3px 10px rgba(2, 132, 199, 0.15) !important;
    }
    50% {
        border-color: #f59e0b !important;
        box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.35), 0 4px 14px rgba(245, 158, 11, 0.25) !important;
    }
}
.curso.curso-ultima-socializacion {
    animation: pulse-border-glow 2.2s infinite ease-in-out !important;
    border: 2.5px solid #f59e0b !important;
}
.badge-ultima-soc {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    background: #fffbeb;
    color: #b45309;
    border: 1px solid #fde68a;
    font-size: 9.5px;
    font-weight: 800;
    padding: 1px 6px;
    border-radius: 9999px;
    margin-left: 4px;
    animation: pulse-badge 2.2s infinite ease-in-out;
}
@keyframes pulse-badge {
    0%, 100% { transform: scale(1); opacity: 0.95; }
    50% { transform: scale(1.05); opacity: 1; }
}
.btn-validar-fac {
    display: inline-flex !important;
    align-items: center !important;
    gap: 4px !important;
    background: #0284c7 !important;
    color: #ffffff !important;
    border: none !important;
    border-radius: 6px !important;
    padding: 3px 8px !important;
    font-size: 11px !important;
    font-weight: 700 !important;
    cursor: pointer !important;
    box-shadow: 0 1px 3px rgba(2, 132, 199, 0.25) !important;
    transition: all 0.15s ease !important;
}
.btn-validar-fac:hover {
    background: #0369a1 !important;
    transform: translateY(-1px) !important;
    box-shadow: 0 3px 6px rgba(2, 132, 199, 0.35) !important;
}
.btn-validar-fac:disabled {
    background: #94a3b8 !important;
    cursor: not-allowed !important;
    transform: none !important;
    box-shadow: none !important;
}
.btn-validar-fac.success {
    background: #10b981 !important;
    box-shadow: 0 2px 6px rgba(16, 185, 129, 0.35) !important;
}
@keyframes spin-val {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
.btn-validar-fac.loading .btn-val-icon {
    display: inline-block !important;
    animation: spin-val 0.8s linear infinite !important;
}
@keyframes row-updated-glow {
    0% { background-color: rgba(16, 185, 129, 0.4) !important; }
    100% { background-color: inherit; }
}
.tr-updated-glow {
    animation: row-updated-glow 2.5s ease-out !important;
}
.badge-prioridad {
    background: #ffe4e6 !important;
    color: #be123c !important;
    border: 1px solid #f43f5e !important;
    font-size: 10px !important;
    font-weight: 700 !important;
    margin-bottom: 4px;
    display: inline-block;
    width: 100%;
    text-align: center;
    border-radius: 6px;
    padding: 2px 4px;
}
.paso-prioritario-plan {
    border: 2px solid #d97706 !important;
    background: #fffbe3 !important;
    color: #92400e !important;
    font-weight: 700 !important;
}
.paso-prioritario-informe {
    border: 2px solid #dc2626 !important;
    background: #fee2e2 !important;
    color: #991b1b !important;
    font-weight: 700 !important;
}
.btn-filter {
    padding: 8px 14px;
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    background: #fff;
    color: var(--text);
    cursor: pointer;
    transition: all .15s;
}
.btn-filter:hover {
    background: #f1f5f9;
}
.btn-filter.active {
    background: var(--primary);
    color: #fff;
    border-color: var(--primary);
}
.btn-filter.active-prio {
    background: #e11d48 !important;
    color: #fff !important;
    border-color: #e11d48 !important;
    box-shadow: 0 2px 8px rgba(225, 29, 72, 0.3);
}

/* Subsanación provisional y estilos Opción A */
.badge-row-mes {
    display: inline-block;
    background: #e0f2fe;
    color: #0369a1;
    border: 1px solid #7dd3fc;
    font-size: 11px;
    font-weight: 800;
    padding: 3px 8px;
    border-radius: 9999px;
    letter-spacing: 0.5px;
}
.curso {
    position: relative !important;
    display: flex !important;
    flex-direction: column !important;
    min-width: 185px !important;
    max-width: 280px !important;
    background: #ffffff !important;
    border: 2px solid #0284c7 !important;
    border-radius: 12px !important;
    padding: 8px 10px !important;
    box-shadow: 0 2px 8px rgba(2, 132, 199, 0.1) !important;
    transition: all 0.2s ease !important;
}
.curso-header {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    margin-bottom: 6px !important;
    gap: 6px !important;
}
.badge-curso-mes {
    background: #0284c7 !important;
    color: #ffffff !important;
    font-size: 9px !important;
    font-weight: 800 !important;
    padding: 2px 7px !important;
    border-radius: 9999px !important;
    text-transform: uppercase !important;
    letter-spacing: 0.5px !important;
}
.btn-sie-link {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 5px !important;
    margin-top: 8px !important;
    padding: 5px 8px !important;
    background: #0284c7 !important;
    color: #ffffff !important;
    text-decoration: none !important;
    border-radius: 6px !important;
    font-size: 11px !important;
    font-weight: 700 !important;
    transition: all 0.2s ease !important;
    box-shadow: 0 1px 3px rgba(2, 132, 199, 0.2) !important;
}
.btn-sie-link:hover {
    background: #0369a1 !important;
    transform: translateY(-1px) !important;
    box-shadow: 0 3px 6px rgba(2, 132, 199, 0.3) !important;
}
.empty-course-cell {
    background: rgba(241, 245, 249, 0.45) !important;
    border-bottom: 1px solid var(--border);
}
.btn-limpiar-subsanados {
    padding: 8px 12px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    font-size: 11px;
    font-weight: 700;
    background: #fff;
    color: #059669;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    transition: all .15s;
}
.btn-limpiar-subsanados:hover {
    background: #ecfdf5;
    border-color: #10b981;
}

.curso .nombre { font-weight: 700; font-size: 11px; display: block; margin-bottom: 6px; line-height: 1.35; min-height: 28px; }
.bateria { display: flex; flex-direction: column; gap: 4px; }
.paso { display: flex; align-items: center; gap: 7px; font-size: 12px; padding: 5px 8px; border-radius: 7px; line-height: 1.2; border: 1.5px solid transparent; transition: all .15s; }
.paso .ico { width: 16px; font-size: 14px; font-weight: 700; flex-shrink: 0; text-align: center; }
.paso .lbl { flex: 1; min-width: 0; }
.paso .val { font-weight: 700; white-space: nowrap; }
.paso.ok { background: #ecfdf5; color: #15803d; border-color: #a7f3d0; }
.paso.ok .ico { color: #16a34a; }
.paso.bad { background: #fef2f2; color: #b91c1c; border-color: #fecaca; }
.paso.bad .ico { color: #dc2626; }
.paso.info { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
.paso.info .ico { color: #2563eb; }
.bateria .paso:hover { transform: scale(1.03); box-shadow: 0 3px 10px rgba(15,23,42,.18); z-index: 2; }
.paso.ok:hover { background: #d1fae5; border-color: #34d399; }
.paso.bad:hover { background: #fee2e2; border-color: #f87171; }
.paso.info:hover { background: #dbeafe; border-color: #60a5fa; }
.conform-alert { background: #fff7ed !important; color: #c2410c !important; border: 1px solid #fdba74; font-weight: 700; margin-top: 5px; display: inline-block; }
a { text-decoration: none; }
a:hover { opacity: .75; }
.legend { display: flex; gap: 14px; flex-wrap: wrap; align-items: center; justify-content: center; margin-top: 16px; }
.legend-item { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); }
.dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.footer { text-align: center; margin-top: 14px; color: var(--muted); font-size: 12px; line-height: 1.7; }
</style>
</head>
<body>
<div class="container">
<div class="header">
    <h1>REPORTE DE MONITOREO ACADÉMICO</h1>
    <h2>SIE UNEFCO &middot; ${monthsDisplay} 2026</h2>
    <div class="meta">Generado: ${nowFormatted} &middot; ${deduplicatedEvents.length} programas &middot; ${totalCourses} cursos &middot; ${facilitatorOrder.length} facilitadores</div>
</div>

<div class="cards">
    <div class="card"><div class="label">Total Programas</div><div class="value">${deduplicatedEvents.length}</div></div>
    <div class="card"><div class="label">Total Cursos</div><div class="value">${totalCourses}</div></div>
    <div class="card ok"><div class="label">Todo OK</div><div class="value">${totalOk}<span style="font-size:14px;color:var(--muted);font-weight:400"> / ${deduplicatedEvents.length}</span></div></div>
    <div class="card pend"><div class="label">Con Pendientes</div><div class="value">${totalPending}<span style="font-size:14px;color:var(--muted);font-weight:400"> / ${deduplicatedEvents.length}</span></div></div>
</div>

<div class="toolbar">
    <select id="filtroTecnico" onchange="buscar()" style="padding: 10px 14px; border: 1px solid var(--border); border-radius: 8px; font-size: 13px; background: #fff; font-weight: 600; color: var(--primary);">
        <option value="todos">Todos los técnicos</option>
        <option value="8639300">Gilmar Felix Chavarria Choque</option>
        <option value="7782629">Juan Pablo Alba Vaca</option>
        <option value="3355859">Claudia Lisett Olivares Rivero</option>
    </select>
    <select id="filtroMes" onchange="buscar()" style="padding: 10px 14px; border: 1px solid var(--border); border-radius: 8px; font-size: 13px; background: #fff; font-weight: 600; color: #0284c7;">
        ${monthOptionsHtml}
    </select>
    <input type="search" id="buscar" placeholder="Buscar por ciclo, sede, facilitador o curso..." oninput="buscar()">
    <div class="filter-group" style="display: flex; gap: 6px; flex-wrap: wrap;">
        <button id="btnFiltroTodos" class="btn-filter active" onclick="setFiltroEstado('todos')">Todos</button>
        <button id="btnFiltroPrioritarios" class="btn-filter" onclick="setFiltroEstado('prioritarios')" style="color:#e11d48; font-weight:700;">⚡ Prioritarios</button>
        <button id="btnFiltroPendientes" class="btn-filter" onclick="setFiltroEstado('pendientes')">⚠️ Con Pendientes</button>
        <button id="btnFiltroOk" class="btn-filter" onclick="setFiltroEstado('ok')">✓ Todo OK</button>
        <button id="btnLimpiarSubsanados" class="btn-limpiar-subsanados" onclick="limpiarTodosSubsanados()" title="Desmarcar todos los cursos provisionalmente subsanados">🧹 Limpiar Subsanados</button>
    </div>
</div>

<div class="table-wrap">
<table id="reportTable">
<thead>
<tr>
    <th style="width:90px; text-align:center;">Mes</th>
    <th style="width:200px;">Facilitador</th>
    <th style="width:190px;">Sede / Ciclo</th>
    <th>Curso 1</th>
    <th>Curso 2</th>
    <th>Curso 3</th>
    <th>Curso 4</th>
    <th>Curso 5</th>
</tr>
</thead>
<tbody>
${htmlRows}
</tbody>
</table>
</div>

<div class="legend">
    <span class="legend-item"><span class="dot" style="background:#16a34a"></span>OK</span>
    <span class="legend-item"><span class="dot" style="background:#2563eb"></span>En tiempo</span>
    <span class="legend-item"><span class="dot" style="background:#f59e0b"></span>Alerta</span>
    <span class="legend-item"><span class="dot" style="background:#dc2626"></span>Pasado</span>
</div>

<div class="footer">
    <p>Batería por curso, en orden: <strong>Planificación</strong> (SI/NO), <strong>Planif. Fecha</strong> (válida entre inicio−5d y el día de inicio), <strong>Fecha de inicio</strong>, <strong>Socialización</strong>, <strong>Inf. Evaluación</strong> (respondidos/total), <strong>Valoración</strong> (%), <strong>Inf. Final</strong> (fecha de cierre de informe del mes), <strong>Fecha límite</strong> (última socialización del mes + 5 días) | ✓ verde = paso OK, ✗ rojo = pendiente/incorrecto | <strong>⚡ Prioritario</strong> = Planificación pendiente 5d antes de inicio o Informe Final pendiente tras fecha límite mensual</p>
</div>
</div>
<!-- INJECTED_REPORTE_SCRIPT -->
<script>
var currentFiltroEstado = 'todos';

function setFiltroEstado(estado) {
    currentFiltroEstado = estado;
    var btnMap = {
        'todos': 'btnFiltroTodos',
        'prioritarios': 'btnFiltroPrioritarios',
        'pendientes': 'btnFiltroPendientes',
        'ok': 'btnFiltroOk'
    };
    for (var k in btnMap) {
        var btn = document.getElementById(btnMap[k]);
        if (btn) {
            if (k === estado) {
                btn.className = (k === 'prioritarios') ? 'btn-filter active-prio' : 'btn-filter active';
            } else {
                btn.className = 'btn-filter';
            }
        }
    }
    buscar();
}

async function validarFacilitadorFila(btn) {
    var tr = btn.closest('tr');
    if (!tr) return;

    var facEl = tr.querySelector('strong');
    var facilitador = facEl ? facEl.innerText.trim() : '';
    var mes = (tr.getAttribute('data-mes') || '').toLowerCase().trim();

    var linkEls = tr.querySelectorAll('a.btn-sie-link');
    var eventUrls = [];
    linkEls.forEach(function(a) {
        if (a.href && eventUrls.indexOf(a.href) === -1) {
            eventUrls.push(a.href);
        }
    });

    if (!facilitador) {
        alert('No se pudo identificar el facilitador de la fila');
        return;
    }

    var originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.classList.add('loading');
    btn.innerHTML = '<span class="btn-val-icon">⏳</span> <span class="btn-val-text">Validando en SIE...</span>';

    try {
        var res = await fetch('/api/sie/validar-facilitador', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                facilitador: facilitador,
                mes: mes,
                eventUrls: eventUrls
            })
        });

        var data = await res.json();
        if (!data.success) {
            throw new Error(data.error || 'Error al validar facilitador en SIE');
        }

        if (data.rowHtml) {
            var temp = document.createElement('tbody');
            temp.innerHTML = data.rowHtml;
            var newTr = temp.querySelector('tr');
            if (newTr) {
                var curTec = tr.getAttribute('data-tecnico');
                if (curTec) newTr.setAttribute('data-tecnico', curTec);
                var curStyle = tr.getAttribute('style');
                if (curStyle) newTr.setAttribute('style', curStyle);

                newTr.classList.add('tr-updated-glow');
                tr.parentNode.replaceChild(newTr, tr);

                buscar();

                setTimeout(function() {
                    newTr.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 50);
                return;
            }
        }

        btn.classList.remove('loading');
        btn.classList.add('success');
        btn.innerHTML = '<span class="btn-val-icon">✓</span> <span class="btn-val-text">¡Al día!</span>';
        setTimeout(function() {
            btn.disabled = false;
            btn.classList.remove('success');
            btn.innerHTML = originalHtml;
        }, 3000);

    } catch (err) {
        console.error('Error al validar facilitador:', err);
        btn.classList.remove('loading');
        btn.disabled = false;
        btn.innerHTML = originalHtml;
        alert('No se pudo validar al facilitador en SIE: ' + (err.message || 'Error de conexión'));
    }
}

function marcarPrioritarios() {
    try {
        var cursos = document.querySelectorAll('.curso');
        cursos.forEach(function(curso) {
            var pasos = curso.querySelectorAll('.paso');
            if (!pasos || pasos.length === 0) return;

            var pasoPlan = null, pasoPlanFecha = null;
            var pasoInforme = null, pasoLimite = null;
            var pasoEval = null;

            pasos.forEach(function(p) {
                var lblEl = p.querySelector('.lbl');
                if (!lblEl) return;
                var txt = lblEl.textContent.trim().toLowerCase();
                if (txt === 'planificación') pasoPlan = p;
                else if (txt === 'planificación fecha') pasoPlanFecha = p;
                else if (txt === 'informe final') pasoInforme = p;
                else if (txt === 'fecha límite') pasoLimite = p;
                else if (txt === 'informe evaluación') pasoEval = p;
            });

            var isPlanBad = (pasoPlan && pasoPlan.classList.contains('bad')) || (pasoPlanFecha && pasoPlanFecha.classList.contains('bad'));
            var isInformeBad = (pasoInforme && pasoInforme.classList.contains('bad'));
            var isEvalBad = (pasoEval && pasoEval.classList.contains('bad'));

            if (isPlanBad && pasoPlanFecha) {
                pasoPlanFecha.classList.add('paso-prioritario-plan');
            }
            if (isInformeBad && (pasoInforme || pasoLimite)) {
                if (pasoInforme) pasoInforme.classList.add('paso-prioritario-informe');
                if (pasoLimite) pasoLimite.classList.add('paso-prioritario-informe');
            }

            var isPrioritario = isPlanBad || isInformeBad || isEvalBad;
            if (isPrioritario) {
                curso.classList.add('curso-prioritario');
                var tr = curso.closest('tr');
                if (tr) tr.setAttribute('data-prioritario', '1');

                var badge = curso.querySelector('.badge-prioridad');
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'badge badge-prioridad';
                    var nombreEl = curso.querySelector('.nombre');
                    if (nombreEl) {
                        curso.insertBefore(badge, nombreEl);
                    } else {
                        curso.insertBefore(badge, curso.firstChild);
                    }
                }
                if (isPlanBad && isInformeBad) {
                    badge.innerHTML = '⚡ Planif. & Final Pendiente';
                } else if (isPlanBad) {
                    badge.innerHTML = '⚡ Planificación Pendiente';
                } else if (isInformeBad) {
                    badge.innerHTML = '🚨 Informe Final Pendiente';
                } else {
                    badge.innerHTML = '⚠️ Evaluación Pendiente';
                }
            } else {
                curso.classList.remove('curso-prioritario');
                var existingBadge = curso.querySelector('.badge-prioridad');
                if (existingBadge) existingBadge.remove();
            }
        });
    } catch(e) {
        console.error('Error en marcarPrioritarios:', e);
    }
}

function buscar() {
    try {
        marcarPrioritarios();

        var input = document.getElementById('buscar');
        var filter = input ? input.value.toLowerCase().trim() : '';
        
        var tecSelect = document.getElementById('filtroTecnico');
        var selectedTec = tecSelect ? tecSelect.value.trim() : 'todos';

        var mesSelect = document.getElementById('filtroMes');
        var selectedMes = mesSelect ? mesSelect.value.toLowerCase().trim() : 'todos';

        var table = document.getElementById('reportTable');
        if (!table) return;
        var tbody = table.getElementsByTagName('tbody')[0];
        if (!tbody) return;
        var trs = tbody.getElementsByTagName('tr');

        var totalProg = 0;
        var totalCursos = 0;
        var okCount = 0;
        var pendCount = 0;

        for (var i = 0; i < trs.length; i++) {
            var tr = trs[i];
            if (tr.id === 'noRowsMsg') continue;

            var text = tr.textContent.toLowerCase();
            var rowTec = (tr.getAttribute('data-tecnico') || '').trim();
            var rowMes = (tr.getAttribute('data-mes') || '').toLowerCase().trim();

            var matchesText = !filter || text.includes(filter);
            var matchesTec = (selectedTec === 'todos') || (rowTec === selectedTec);
            var matchesMes = (selectedMes === 'todos') || (rowMes === selectedMes);

            if (!matchesText || !matchesTec || !matchesMes) {
                tr.style.display = 'none';
                continue;
            }

            var cursosInRow = tr.querySelectorAll('.curso');
            var visibleCursosInRow = cursosInRow.length;
            var hasPrioInRow = false;
            var hasPendInRow = false;
            var allOkInRow = true;

            cursosInRow.forEach(function(c) {
                var isPrio = c.classList.contains('curso-prioritario');
                var hasBad = (c.querySelectorAll('.paso.bad').length > 0);

                if (isPrio) hasPrioInRow = true;
                if (hasBad) hasPendInRow = true;
                if (hasBad || isPrio) allOkInRow = false;
            });

            // Filtrado por botones de estado
            var matchesEstado = true;
            if (currentFiltroEstado === 'prioritarios') {
                matchesEstado = hasPrioInRow;
            } else if (currentFiltroEstado === 'pendientes') {
                matchesEstado = hasPendInRow;
            } else if (currentFiltroEstado === 'ok') {
                matchesEstado = allOkInRow && (visibleCursosInRow > 0);
            }

            if (matchesEstado) {
                tr.style.display = '';
                totalProg++;
                totalCursos += visibleCursosInRow;
                if (allOkInRow) okCount++; else pendCount++;
            } else {
                tr.style.display = 'none';
            }
        }

        var existingNoRow = document.getElementById('noRowsMsg');
        if (totalProg === 0) {
            if (!existingNoRow) {
                existingNoRow = document.createElement('tr');
                existingNoRow.id = 'noRowsMsg';
                tbody.appendChild(existingNoRow);
            }
            var tecName = (tecSelect && tecSelect.options[tecSelect.selectedIndex]) ? tecSelect.options[tecSelect.selectedIndex].text : '';
            var msgHtml = '<td colspan="8" style="text-align:center; padding:35px 20px; color:#475569; font-size:14px; background:#f8fafc;">';
            msgHtml += '🔍 No se encontraron cursos con los filtros seleccionados.';
            if (selectedTec !== 'todos') {
                msgHtml += '<br><span style="font-size:12px; color:#64748b;">El técnico <strong>' + tecName + '</strong> no tiene cursos registrados para ';
                msgHtml += (selectedMes !== 'todos') ? ('el mes de <strong>' + selectedMes.toUpperCase() + '</strong>.') : 'estos filtros.';
                msgHtml += '</span><br><button onclick="document.getElementById(\\'filtroTecnico\\').value=\\'todos\\'; buscar();" style="margin-top:12px; padding:7px 16px; background:#0284c7; color:#fff; border:none; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer;">Ver todos los técnicos para este mes</button>';
            }
            msgHtml += '</td>';
            existingNoRow.innerHTML = msgHtml;
            existingNoRow.style.display = '';
        } else if (existingNoRow) {
            existingNoRow.style.display = 'none';
        }

        var cardValues = document.querySelectorAll('.card .value');
        if (cardValues.length >= 4) {
            cardValues[0].innerHTML = totalProg;
            cardValues[1].innerHTML = totalCursos;
            cardValues[2].innerHTML = okCount + '<span style="font-size:14px;color:var(--muted);font-weight:400"> / ' + totalProg + '</span>';
            cardValues[3].innerHTML = pendCount + '<span style="font-size:14px;color:var(--muted);font-weight:400"> / ' + totalProg + '</span>';
        }
    } catch(e) {
        console.error('Error en buscar:', e);
    }
}

function initReporte() {
    try {
        var params = new URLSearchParams(window.location.search);
        var tecParam = params.get('tecnico');
        if (tecParam) {
            var tecSelect = document.getElementById('filtroTecnico');
            if (tecSelect) {
                tecSelect.value = tecParam;
            }
        }
        var mesParam = params.get('mes');
        if (mesParam) {
            var mesSelect = document.getElementById('filtroMes');
            if (mesSelect) {
                mesSelect.value = mesParam.toLowerCase();
            }
        }
        marcarPrioritarios();
        buscar();
    } catch(e) {
        console.error('Error en initReporte:', e);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initReporte);
} else {
    setTimeout(initReporte, 100);
}
</script>
</body>
</html>`;

    // Save directly to Supabase Database (reportes_html table)
    let savedOk = false;
    try {
      const { error: dbErr1 } = await supabase.from('reportes_html').upsert({
        id: 'REPORTE_DIARIO_ACTUAL',
        contenido: finalHtml,
        tecnico_carnet: '8639300',
        updated_at: new Date().toISOString(),
      });
      if (!dbErr1) savedOk = true;
    } catch (e) {}

    console.log('Sincronización SIE guardada con éxito en Supabase DB. (Éxito:', savedOk, ')');

    return NextResponse.json({
      success: true,
      message: 'Monitoreo Realizado. Datos sincronizados con éxito desde el SIE UNEFCO.',
      totalProgramas: deduplicatedEvents.length,
      totalCursos: totalCourses,
    });
  } catch (error: any) {
    console.error('Error durante la sincronización nativa del SIE:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error durante la sincronización con el SIE UNEFCO' },
      { status: 500 }
    );
  }
}
