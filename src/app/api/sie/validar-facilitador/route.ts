import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const BASE_URL = 'https://sie.unefco.edu.bo';

const MONTH_NAMES: Record<number, string> = {
  1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
  5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
  9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre'
};

const MESES: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12,
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12
};

const DIAS_SEMANA_ABBR = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES_ABBR = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

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
    const month = MESES[m[2].toLowerCase()] || 1;
    const year = parseInt(m[3], 10);
    return new Date(year, month - 1, day);
  }
  return null;
}

function parseStartDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const m = dateStr.match(/(\d+)\/(\w+)\s*-\s*(\d+)\/(\w+)\/(\d+)/);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = MESES[m[2].toLowerCase()] || 1;
    const year = parseInt(m[5], 10);
    return new Date(year, month - 1, day);
  }
  return null;
}

function parseCourseDates(dateStr: string): Date | null {
  if (!dateStr) return null;
  const m = dateStr.match(/(\d+)\/(\w+)\s*-\s*(\d+)\/(\w+)\/(\d+)/);
  if (m) {
    const day = parseInt(m[3], 10);
    const month = MESES[m[4].toLowerCase()] || 1;
    const year = parseInt(m[5], 10);
    return new Date(year, month - 1, day);
  }
  return null;
}

function formatDtShort(d: Date | null): string {
  if (!d) return '';
  const diaSem = DIAS_SEMANA_ABBR[d.getDay()];
  const diaNum = d.getDate().toString().padStart(2, '0');
  return `${diaSem} ${diaNum}/${MESES_ABBR[d.getMonth() + 1] || (d.getMonth() + 1)}`;
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

async function loginSie(username?: string, password?: string): Promise<{ cookieHeader: string; progCsrf: string } | null> {
  const user = username || 'gilmar.chavarria@unefco.edu.bo';
  const pass = password || 'GILMAR.chavarria24#';

  const loginGetRes = await fetch(`${BASE_URL}/login`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
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

  if (!csrfToken || !initialCsrfCookie) return null;

  const loginParams = new URLSearchParams();
  loginParams.append('csrfmiddlewaretoken', csrfToken);
  loginParams.append('username', user);
  loginParams.append('password', pass);

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

  if (!sessionId) return null;
  return {
    cookieHeader: `csrftoken=${loggedCsrf}; sessionid=${sessionId}`,
    progCsrf: loggedCsrf || csrfToken,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const facilitador = (body.facilitador || '').trim();
    const mes = (body.mes || '').toLowerCase().trim();
    let eventUrls: string[] = Array.isArray(body.eventUrls) ? body.eventUrls : [];

    if (!facilitador) {
      return NextResponse.json({ success: false, error: 'Nombre de facilitador requerido' }, { status: 400 });
    }

    console.log(`[Validar Facilitador] Iniciando validación rápida para: "${facilitador}", mes: "${mes}"`);

    // 1. Iniciar sesión en SIE
    const session = await loginSie(body.username, body.password);
    if (!session) {
      return NextResponse.json({ success: false, error: 'No se pudo iniciar sesión en el portal SIE' }, { status: 401 });
    }
    const { cookieHeader, progCsrf } = session;

    // 2. Si no se enviaron URLs de eventos, buscarlos en el índice de programación del mes
    if (eventUrls.length === 0 && mes) {
      const monthNum = MESES[mes] || (new Date().getMonth() + 1);
      const indexUrl = `${BASE_URL}/events/programming/index?csrfmiddlewaretoken=${progCsrf}&phase_filter=15&departament=9&profile=0&month=${monthNum}&modality=0`;
      const idxRes = await fetch(indexUrl, {
        headers: {
          'Cookie': cookieHeader,
          'Referer': `${BASE_URL}/events/programming`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (idxRes.ok) {
        const idxHtml = await idxRes.text();
        const tableMatch = idxHtml.match(/<table[^>]*>[\s\S]*?<\/table>/i);
        if (tableMatch) {
          const rowMatches = tableMatch[0].match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
          const facNorm = normalizeText(facilitador);
          for (const rowHtml of rowMatches) {
            const celdas = rowHtml.match(/<td[^>]*>[\s\S]*?<\/td>/gi) || [];
            if (celdas.length < 11) continue;
            const facCell = celdas[8].replace(/<[^>]+>/g, '').trim();
            if (normalizeText(facCell).includes(facNorm) || facNorm.includes(normalizeText(facCell))) {
              const detailMatch = rowHtml.match(/href=["'](\/events\/\d+\/detail)["']/i);
              if (detailMatch) {
                const fullUrl = `${BASE_URL}${detailMatch[1]}`;
                if (!eventUrls.includes(fullUrl)) {
                  eventUrls.push(fullUrl);
                }
              }
            }
          }
        }
      }
    }

    if (eventUrls.length === 0) {
      return NextResponse.json({
        success: false,
        error: `No se encontraron eventos activos en SIE para el facilitador ${facilitador} en el mes indicado.`,
      }, { status: 404 });
    }

    console.log(`[Validar Facilitador] Procesando ${eventUrls.length} eventos para ${facilitador}:`, eventUrls);

    // 3. Procesar eventos del facilitador en paralelo
    const scrapedCourses: any[] = [];
    let sedesSummary = '';
    let ciclosSummary = '';
    const sedesSet = new Set<string>();
    const ciclosSet = new Set<string>();

    await Promise.all(eventUrls.map(async (detailUrl) => {
      try {
        const detRes = await fetch(detailUrl, {
          headers: {
            'Cookie': cookieHeader,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          signal: AbortSignal.timeout(12000),
        });

        if (!detRes.ok) return;
        const detHtml = await detRes.text();

        const cicloMatch = detHtml.match(/CICLO:\s*(.*?)<\/span>/i);
        const ciclo = cicloMatch ? cicloMatch[1].replace(/<[^>]+>/g, '').trim() : '';
        if (ciclo) ciclosSet.add(ciclo);

        const sedeMatch = detHtml.match(/SEDE:\s*(.*?)<\/span>/i) || detHtml.match(/LUGAR:\s*(.*?)<\/span>/i);
        const sede = sedeMatch ? sedeMatch[1].replace(/<[^>]+>/g, '').trim() : '';
        if (sede) sedesSet.add(sede);

        const courseCards = [...detHtml.matchAll(/<span[^>]*class=["']badge[^"]*badge-primary[^"']*["'][^>]*>([\s\S]*?)<\/span>\s*<h6[^>]*class=["']mb-0[^>]*>([\s\S]*?)<\/h6>/gi)];
        const courseIds = [...detHtml.matchAll(/id=["']date-course-update-(\d+)["']/gi)].map(m => m[1]);

        if (!courseIds || courseIds.length === 0) return;

        const courseDates: Record<string, string> = {};
        for (const cid of courseIds) {
          const dm = detHtml.match(new RegExp(`id=["']date-course-update-${cid}["']>(.*?)<\/strong>`, 'i'));
          courseDates[cid] = dm ? dm[1].replace(/<[^>]+>/g, '').trim() : '';
        }

        const courseNamesList = courseCards.map(m => m[2].replace(/<[^>]+>/g, '').trim());

        await Promise.all(courseIds.map(async (cid, idx) => {
          const cursoName = courseNamesList[idx] || '';
          const fstr = courseDates[cid] || '';

          let cInicio = '', cFin = '';
          if (fstr && fstr.includes(' - ')) {
            const parts = fstr.split(' - ');
            cInicio = parts[0] ? parts[0].trim() : '';
            cFin = parts[1] ? parts[1].trim() : '';
          }

          let hasPlan = false, hasReport = false, docid = '';
          try {
            const cardRegex = new RegExp(`date-course-update-${cid}.*?card-footer.*?</div>`, 'is');
            const cardMatch = detHtml.match(cardRegex);
            const cardContent = cardMatch ? cardMatch[0] : detHtml;
            hasPlan = /\/events\/sede\/planning\/report\/\d+\/1/i.test(cardContent);
            const docm = cardContent.match(/\/events\/reportes\/documentos-sede\/(\d+)/i);
            hasReport = !!docm;
            docid = docm ? docm[1] : '';
          } catch (e) {}

          const [gRes, vRes, docRes] = await Promise.allSettled([
            fetch(`${BASE_URL}/inscription/${cid}`, { headers: { 'Cookie': cookieHeader }, signal: AbortSignal.timeout(8000) }).then(r => r.ok ? r.text() : ''),
            fetch(`${BASE_URL}/events/ficha-valoracion/${cid}`, { headers: { 'Cookie': cookieHeader }, signal: AbortSignal.timeout(8000) }).then(r => r.ok ? r.text() : ''),
            docid ? fetch(`${BASE_URL}/events/reportes/documentos-sede/${docid}`, { headers: { 'Cookie': cookieHeader }, signal: AbortSignal.timeout(8000) }).then(r => r.ok ? r.text() : '') : Promise.resolve('')
          ]);

          const gHtml = gRes.status === 'fulfilled' ? gRes.value : '';
          const vHtml = vRes.status === 'fulfilled' ? vRes.value : '';
          const docHtml = docRes.status === 'fulfilled' ? docRes.value : '';

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

          let mNum = 0;
          if (inicioDt) mNum = inicioDt.getMonth() + 1;
          else if (finDt) mNum = finDt.getMonth() + 1;
          const courseMes = (mNum && MONTH_NAMES[mNum]) ? MONTH_NAMES[mNum] : (mes || 'Mes');

          scrapedCourses.push({
            cid,
            name: cursoName,
            dates: fstr,
            fecha_inicio: cInicio,
            fecha_fin: cFin,
            plan: hasPlan ? 'SI' : 'NO',
            has_plan: hasPlan,
            has_report: hasReport,
            conform_ok: conform,
            conform_pend: !conform && !!informeDateStr,
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
            start_month: courseMes,
            url_evento: detailUrl,
          });
        }));
      } catch (err: any) {
        console.warn(`[Validar Facilitador] Error en detalle de ${detailUrl}:`, err.message);
      }
    }));

    if (scrapedCourses.length === 0) {
      return NextResponse.json({ success: false, error: 'No se pudieron recuperar cursos del facilitador en SIE' }, { status: 500 });
    }

    // Filtrar estrictamente los cursos que corresponden al mes de la fila seleccionada (la que manda es Fecha de Inicio)
    const targetMesLower = (mes || '').toLowerCase().trim();
    let coursesToRender = scrapedCourses;
    if (targetMesLower && targetMesLower !== 'todos') {
      const filtered = scrapedCourses.filter(cr => {
        const cMes = (cr.start_month || '').toLowerCase();
        return cMes === targetMesLower;
      });
      if (filtered.length > 0) {
        coursesToRender = filtered;
      }
    }

    // 4. Ordenar cursos en orden ASCENDENTE según Fecha de Inicio
    coursesToRender.sort((a, b) => {
      const dtA = (a.inicio_date_obj || parseStartDate(a.dates))?.getTime() || 0;
      const dtB = (b.inicio_date_obj || parseStartDate(b.dates))?.getTime() || 0;
      if (dtA !== dtB) return dtA - dtB;
      return (a.name || '').localeCompare(b.name || '');
    });

    // 5. Calcular unificación mensual (+5d de la última socialización)
    let maxFin: Date | null = null;
    let latestInforme: Date | null = null;

    for (const cr of coursesToRender) {
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
    for (const cr of coursesToRender) {
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

      const isPlanOk = cr.plan === 'SI';
      cr.planif_ok = isPlanOk;

      if (reportDate && unifiedDeadline) {
        const rDateOnly = new Date(reportDate.getFullYear(), reportDate.getMonth(), reportDate.getDate());
        const dDateOnly = new Date(unifiedDeadline.getFullYear(), unifiedDeadline.getMonth(), unifiedDeadline.getDate());
        cr.informe_ok = rDateOnly <= dDateOnly;
      } else {
        cr.informe_ok = false;
      }

      cr.todo_ok = cr.has_plan && cr.eval_notas_resp >= 1 && (cr.has_report || !!reportDate) && cr.planif_ok && cr.informe_ok && cr.conform_ok;
    }

    // 6. Generar HTML para las celdas de cursos
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
      const planifShort = isPlanOk ? (formatDtShort(cr.planif_date_obj || inicioDt) || '—') : '—';

      let limiteShort = cr.deadline || '—';
      const parsedDeadline = parseSpanishDate(cr.deadline);
      if (parsedDeadline) {
        limiteShort = `${formatDtShort(parsedDeadline)} (Mes)`;
      }

      const infDt = cr.cierre_date_obj;
      const informeShort = infDt ? formatDtShort(infDt) : (cr.informe_date || '—');

      const pasos = [
        paso(isPlanOk, 'Planificación', cr.plan, 'Planificación (plan de trabajo): SI = existe'),
        paso(cr.planif_ok, 'Planificación Fecha', planifShort, 'Fecha de planificación con día de la semana'),
        paso(true, 'Fecha de inicio', inicioShort, 'Fecha de inicio oficial con día de la semana', true),
        paso(true, cr.is_latest_soc ? 'Socialización<span class="badge-ultima-soc" title="Última fecha de socialización del mes: define la fecha límite">🎯 Límite</span>' : 'Socialización', finShort, 'Última fecha de socialización con día de la semana', true),
        paso(cr.eval_notas_resp >= 1, 'Informe Evaluación', `${cr.eval_notas_resp}/${cr.eval_notas_total || cr.val_total}`, 'Estudiantes evaluados con notas por el facilitador / total'),
        paso(!cr.val_disabled && cr.val_pct > 0, 'Valoración', cr.val_disabled ? 'DESHABILITADA' : `${cr.val_pct}%`, 'Porcentaje de encuesta de valoración completada por estudiantes en SIE'),
        paso(cr.informe_ok, 'Informe Final', informeShort, 'Informe Final Mensual: fecha de cierre con día de la semana'),
        paso(cr.todo_ok, 'Fecha límite', limiteShort, 'Fecha límite mensual con día de la semana')
      ];

      const conformAlert = cr.conform_pend ? '<span class="badge conform-alert">⚠️ Generar Conformidad</span>' : '';
      const safeName = cr.name ? cr.name.substring(0, 70) : '';
      const cMes = (cr.start_month || 'mes').toLowerCase();
      const cleanKey = `sub_${normalizeText(facName).substring(0, 15)}_${cMes}_${cIdx}`;
      const pulseCls = cr.is_latest_soc ? ' curso-ultima-socializacion' : '';

      return `<div class="curso${pulseCls}" data-curso-mes="${cMes}" data-curso-key="${cleanKey}">
        <div class="curso-header">
            <span class="badge-curso-mes">${cr.start_month}</span>
            <label class="subsanar-check-container" title="Marcar como subsanado provisionalmente">
                <input type="checkbox" data-key="${cleanKey}"><span>Subsanado</span>
            </label>
        </div>
        <span class="nombre" title="${cr.name}">${safeName}</span>
        <div class="bateria">${pasos.join('')}</div>
        ${conformAlert}
        ${cr.url_evento ? `<a href="${cr.url_evento}" target="_blank" class="btn-sie-link" title="Abrir curso en SIE UNEFCO"><span>👁️</span> Ver en SIE</a>` : ''}
    </div>`;
    }

    let courseCells = '';
    coursesToRender.slice(0, 5).forEach((cr, idx) => {
      const status = cr.todo_ok ? 'ok' : 'bad';
      courseCells += `<td class="${status}">${courseCellHtml(cr, facilitador, idx)}</td>`;
    });
    for (let i = coursesToRender.length; i < 5; i++) {
      courseCells += '<td class="empty-course-cell"></td>';
    }

    const rowAllOk = coursesToRender.every(cr => cr.todo_ok);
    const dataOk = rowAllOk ? '1' : '0';

    sedesSummary = Array.from(sedesSet).join(' / ') || 'Sede General';
    ciclosSummary = Array.from(ciclosSet).join(' / ') || 'Ciclo General';
    const sedesShort = sedesSummary.length > 55 ? sedesSummary.substring(0, 55) + '...' : sedesSummary;
    const ciclosShort = ciclosSummary.length > 60 ? ciclosSummary.substring(0, 60) + '...' : ciclosSummary;

    const displayMes = targetMesLower ? (targetMesLower.charAt(0).toUpperCase() + targetMesLower.slice(1)) : (coursesToRender[0]?.start_month || 'Mes');

    const newRowHtml = `<tr data-ok="${dataOk}" data-mes="${targetMesLower}">
        <td style="text-align:center; vertical-align:middle; font-weight:700;">
            <span class="badge-row-mes">${displayMes.toUpperCase()}</span>
        </td>
        <td title="${facilitador}" style="vertical-align:middle;">
            <strong style="font-size:13px; color:#0f172a; display:block;">${facilitador}</strong>
            <span style="font-size:11px; color:#64748b; font-weight:600;">${coursesToRender.length} curso${coursesToRender.length > 1 ? 's' : ''} en ${displayMes}</span>
            <div style="margin-top: 6px;">
                <button type="button" class="btn-validar-fac" onclick="validarFacilitadorFila(this)" title="Revalidar datos de este facilitador en SIE UNEFCO">
                    <span class="btn-val-icon">🔄</span> <span class="btn-val-text">Validar</span>
                </button>
            </div>
        </td>
        <td title="${sedesSummary} | ${ciclosSummary}" style="vertical-align:middle; font-size:11px; max-width:220px;">
            <div style="font-weight:600; color:#334155; line-height:1.3;">${sedesShort}</div>
            <div style="color:#64748b; font-size:10px; margin-top:3px; line-height:1.2;">${ciclosShort}</div>
        </td>
        ${courseCells}
    </tr>`;

    // 7. Actualizar el HTML almacenado en Supabase (REPORTE_DIARIO_ACTUAL) de forma segura
    try {
      const { data: dbReport } = await supabase.from('reportes_html').select('contenido').eq('id', 'REPORTE_DIARIO_ACTUAL').single();
      if (dbReport?.contenido) {
        let currentHtml = dbReport.contenido;
        // Buscar la fila existente por nombre de facilitador y mes
        const facNorm = normalizeText(facilitador);
        const rows = currentHtml.match(/<tr[\s\S]*?<\/tr>/gi) || [];
        let replaced = false;

        for (const oldRow of rows) {
          if (oldRow.includes('<th')) continue;
          const oldNorm = normalizeText(oldRow);
          const oldMes = oldRow.match(/data-mes=["']([^"']+)["']/i);
          const mesMatch = !mes || (oldMes && oldMes[1].toLowerCase() === mes);

          if (mesMatch && oldNorm.includes(facNorm)) {
            // Mantener el estilo de fondo original y el técnico original
            const bgMatch = oldRow.match(/style=["']([^"']*background:[^;"']+)["']/i);
            const tecMatch = oldRow.match(/data-tecnico=["']([^"']+)["']/i);
            let patchedRow = newRowHtml;
            if (bgMatch) {
              patchedRow = patchedRow.replace('<tr ', `<tr style="${bgMatch[1]}" `);
            }
            if (tecMatch) {
              patchedRow = patchedRow.replace('<tr ', `<tr data-tecnico="${tecMatch[1]}" `);
            }
            currentHtml = currentHtml.replace(oldRow, patchedRow);
            replaced = true;
            break;
          }
        }

        if (replaced) {
          await supabase.from('reportes_html').upsert({
            id: 'REPORTE_DIARIO_ACTUAL',
            contenido: currentHtml,
            updated_at: new Date().toISOString(),
          });
          console.log(`[Validar Facilitador] Fila actualizada exitosamente en Supabase para: ${facilitador}`);
        }
      }
    } catch (dbErr: any) {
      console.warn('[Validar Facilitador] Advertencia al persistir en Supabase:', dbErr.message);
    }

    return NextResponse.json({
      success: true,
      facilitador,
      mes,
      coursesCount: scrapedCourses.length,
      allOk: rowAllOk,
      rowHtml: newRowHtml,
    });

  } catch (error: any) {
    console.error('[Validar Facilitador] Error general:', error);
    return NextResponse.json({ success: false, error: error.message || 'Error interno al validar facilitador' }, { status: 500 });
  }
}
