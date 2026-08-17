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

function formatDtShort(d: Date | null): string {
  if (!d) return '';
  const abbr = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${d.getDate()}/${abbr[d.getMonth() + 1] || d.getMonth() + 1}`;
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

    // 3. Obtain CSRF token for programming
    const progRes = await fetch(`${BASE_URL}/events/programming`, {
      headers: {
        'Cookie': cookieHeader,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    const progHtml = await progRes.text();
    const progCsrfMatches = [...progHtml.matchAll(/name=["']csrfmiddlewaretoken["']\s+value=["']([^"']+)["']/g)];
    const progCsrf = progCsrfMatches.length > 0 ? progCsrfMatches[progCsrfMatches.length - 1][1] : csrfToken;

    // 4. Months to fetch: 5 (Mayo), 6 (Junio), 7 (Julio), + current month
    const months = [5, 6, 7];
    const currentMonth = new Date().getMonth() + 1;
    if (!months.includes(currentMonth)) months.push(currentMonth);

    const monthsDisplay = months.map(m => MONTH_NAMES[m] || m).join(' - ');
    console.log(`Extrayendo meses: ${monthsDisplay}`);

    const allEvents: any[] = [];

    for (const monthVal of months) {
      const monthName = MONTH_NAMES[monthVal] || `${monthVal}`;
      console.log(`Procesando mes ${monthName}...`);

      const indexUrl = `${BASE_URL}/events/programming/index?csrfmiddlewaretoken=${progCsrf}&phase_filter=15&departament=9&profile=0&month=${monthVal}&modality=0`;
      const idxRes = await fetch(indexUrl, {
        headers: {
          'Cookie': cookieHeader,
          'Referer': `${BASE_URL}/events/programming`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      const idxHtml = await idxRes.text();
      const tableMatch = idxHtml.match(/<table[^>]*>[\s\S]*?<\/table>/i);
      if (!tableMatch) continue;

      const rowMatches = tableMatch[0].match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
      const courses: any[] = [];

      for (const rowHtml of rowMatches) {
        const celdas = rowHtml.match(/<td[^>]*>[\s\S]*?<\/td>/gi) || [];
        if (celdas.length < 11) continue;

        const txt = celdas.map(c => c.replace(/<[^>]+>/g, '').trim());
        if (!/^\d+$/.test(txt[0])) continue;

        const detailMatch = rowHtml.match(/href=["'](\/events\/\d+\/detail)["']/i);
        courses.push({
          num: txt[0],
          curso: txt[1],
          lugar: txt[2],
          inicio: txt[4],
          socializacion: txt[5],
          facilitador: txt[8],
          prev: txt[9],
          parts: txt[10],
          url_detalle: detailMatch ? detailMatch[1] : '',
        });
      }

      console.log(`Encontrados ${courses.length} eventos en ${monthName}`);

      for (const c of courses) {
        if (!c.url_detalle) continue;

        // Detail page fetch
        const detailUrl = c.url_detalle.startsWith('http') ? c.url_detalle : BASE_URL + c.url_detalle;
        const detRes = await fetch(detailUrl, {
          headers: {
            'Cookie': cookieHeader,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });

        const detHtml = await detRes.text();

        // Parse Cycle
        const cicloMatch = detHtml.match(/CICLO:\s*(.*?)<\/span>/i);
        const ciclo = cicloMatch ? cicloMatch[1].replace(/<[^>]+>/g, '').trim() : '';

        // Parse course cards & date update IDs
        const courseCards = [...detHtml.matchAll(/<span[^>]*class=["']badge[^"]*badge-primary[^"']*["'][^>]*>([\s\S]*?)<\/span>\s*<h6[^>]*class=["']mb-0[^>]*>([\s\S]*?)<\/h6>/gi)];
        const courseIds = [...detHtml.matchAll(/id=["']date-course-update-(\d+)["']/gi)].map(m => m[1]);

        const courseDates: Record<string, string> = {};
        for (const cid of courseIds) {
          const dm = detHtml.match(new RegExp(`id=["']date-course-update-${cid}["']>(.*?)<\/strong>`, 'i'));
          courseDates[cid] = dm ? dm[1].replace(/<[^>]+>/g, '').trim() : '';
        }

        const courseNamesList = courseCards.map(m => m[2].replace(/<[^>]+>/g, '').trim());

        const evCourses: any[] = [];
        let fechaStr = '';

        for (let idx = 0; idx < courseIds.length; idx++) {
          const cid = courseIds[idx];
          const cursoName = courseNamesList[idx] || '';
          const fstr = courseDates[cid] || '';
          if (idx === 0) fechaStr = fstr;

          let cInicio = '', cFin = '';
          if (fstr.includes(' - ')) {
            const parts = fstr.split(' - ');
            cInicio = parts[0];
            cFin = parts[1] || '';
          }

          const endDate = parseCourseDates(fstr);
          const deadline = endDate ? new Date(endDate.getTime() + 5 * 24 * 3600 * 1000) : null;
          const afterDeadline = deadline ? new Date() > deadline : false;

          // Check grades
          let totalStd = 0, failed = 0;
          try {
            const gRes = await fetch(`${BASE_URL}/inscription/${cid}`, { headers: { 'Cookie': cookieHeader } });
            const gHtml = await gRes.text();
            const gTableMatch = gHtml.match(/<table[^>]*>[\s\S]*?<\/table>/i);
            if (gTableMatch) {
              const gRows = gTableMatch[0].match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
              const scores: number[] = [];
              for (const r of gRows) {
                const c = (r.match(/<td[^>]*>[\s\S]*?<\/td>/gi) || []).map(td => td.replace(/<[^>]+>/g, '').trim());
                if (c.length >= 12 && /^\d+$/.test(c[0])) {
                  const val = parseFloat(c[c.length - 1]);
                  if (!isNaN(val)) scores.push(val);
                }
              }
              totalStd = scores.length;
              failed = scores.filter(s => s < 70).length;
            }
          } catch (e) {}

          // Check Valoracion
          let responded = 0, totalVal = 0, valPct = 0;
          try {
            const vRes = await fetch(`${BASE_URL}/events/ficha-valoracion/${cid}`, { headers: { 'Cookie': cookieHeader } });
            const vHtml = await vRes.text();
            const pCards = (vHtml.match(/class=["']participant-card["']/gi) || []).length;
            const sinVal = (vHtml.match(/Sin valoraci/gi) || []).length;
            totalVal = pCards;
            responded = totalVal > 0 ? totalVal - sinVal : 0;
            valPct = totalVal > 0 ? Math.round((responded / totalVal) * 1000) / 10 : 0;
          } catch (e) {}

          // Check Plan & Report Docs
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

          // Check Document details
          let planifDateStr = '', informeDateStr = '', conform = false;
          if (docid) {
            try {
              const docRes = await fetch(`${BASE_URL}/events/reportes/documentos-sede/${docid}`, { headers: { 'Cookie': cookieHeader } });
              const docHtml = await docRes.text();
              const mInf = docHtml.match(/Fecha de Cierre:\s*([^<]+)/i);
              informeDateStr = mInf ? mInf[1].trim() : '';
              const mPlan = docHtml.match(/Fecha de Planificaci[oó]n:\s*([^<]+)/i);
              planifDateStr = mPlan ? mPlan[1].trim() : '';
              conform = docHtml.includes('/facilitador/informe-conformidad/');
            } catch (e) {}
          }

          const planifDate = parseSpanishDate(planifDateStr);
          const cierreDate = parseSpanishDate(informeDateStr);
          const inicioDt = parseStartDate(fstr);
          const finDt = parseCourseDates(fstr);

          const planifOk = validPlanif(planifDate, inicioDt);
          const informeOk = validInforme(cierreDate, finDt);
          const conformOk = conform;
          const conformPend = !conformOk && !!informeDateStr;

          const todoOk = hasPlan && responded >= 1 && hasReport && planifOk && informeOk && conformOk;

          evCourses.push({
            cid,
            name: cursoName,
            dates: fstr,
            fecha_inicio: cInicio,
            fecha_fin: cFin,
            deadline: deadline ? `${deadline.getDate().toString().padStart(2, '0')}/${(deadline.getMonth() + 1).toString().padStart(2, '0')}/${deadline.getFullYear()}` : '',
            plan: hasPlan ? 'SI' : 'NO',
            val_pct: valPct,
            val_resp: responded,
            val_total: totalVal,
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
          });
        }

        if (evCourses.length === 0) continue;

        let fInicio = '', fFin = '';
        if (fechaStr.includes(' - ')) {
          const parts = fechaStr.split(' - ');
          fInicio = parts[0];
          fFin = parts[1] || '';
        }
        const eDate = parseCourseDates(fechaStr);
        const dl = eDate ? new Date(eDate.getTime() + 5 * 24 * 3600 * 1000) : null;
        const allOk = evCourses.every((cr: any) => cr.todo_ok);
        const anyVencido = evCourses.some((cr: any) => cr.vencido === 'SI');

        allEvents.push({
          mes: monthName,
          ciclo,
          sede: c.lugar,
          facilitador: c.facilitador,
          url_evento: c.url_detalle.startsWith('http') ? c.url_detalle : BASE_URL + c.url_detalle,
          fecha_rango: fechaStr,
          fecha_inicio: fInicio,
          fecha_fin: fFin,
          deadline: dl ? `${dl.getDate().toString().padStart(2, '0')}/${(dl.getMonth() + 1).toString().padStart(2, '0')}/${dl.getFullYear()}` : '',
          after_deadline: anyVencido ? 'SI' : 'NO',
          courses: evCourses,
          all_ok: allOk,
        });
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
    const deduplicatedEvents = Object.values(eventsById);

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
      const inicioDate = parseStartDate(cr.dates);
      const finDate = parseCourseDates(cr.dates);
      const deadlineDate = finDate ? new Date(finDate.getTime() + 5 * 24 * 3600 * 1000) : null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const future = [inicioDate, finDate, deadlineDate].filter((d): d is Date => d !== null && d >= today);
      if (future.length === 0) return 'cell-red';
      const closest = new Date(Math.min(...future.map(d => d.getTime())));
      const diffDays = Math.ceil((closest.getTime() - today.getTime()) / (1000 * 3600 * 24));
      return diffDays <= 5 ? 'cell-yellow' : 'cell-blue';
    }

    function courseCellHtml(cr: any): string {
      function paso(ok: boolean, label: string, value: string, title = '', info = false): string {
        const ico = info ? '📅' : (ok ? '✓' : '✗');
        const cls = info ? 'info' : (ok ? 'ok' : 'bad');
        const titleAttr = title ? ` title="${title}"` : '';
        return `<div class="paso ${cls}"${titleAttr}><span class="ico">${ico}</span><span class="lbl">${label}</span><span class="val">${value}</span></div>`;
      }

      const inicioShort = cr.fecha_inicio;
      const finParts = cr.fecha_fin ? cr.fecha_fin.split('/') : [];
      const finShort = finParts.length >= 2 ? `${finParts[0]}/${finParts[1]}` : (cr.fecha_fin || '—');
      const dp = cr.deadline ? cr.deadline.split('/') : [];
      const limiteShort = dp.length >= 2 ? `${dp[0]}/${dp[1]}` : cr.deadline;

      const pasos = [
        paso(cr.plan === 'SI', 'Planificación', cr.plan, 'Planificación (plan de trabajo): SI = existe'),
        paso(cr.planif_ok, 'Planificación Fecha', cr.planif_date || '—', 'Fecha de planificación: válida entre inicio−5d y el día de inicio'),
        paso(true, 'Fecha de inicio', inicioShort || '—', '', true),
        paso(true, 'Socialización', finShort, 'Última fecha de socialización', true),
        paso(cr.val_resp >= 1, 'Informe Evaluación', `${cr.val_resp}/${cr.val_total}`, 'Estudiantes que respondieron la valoración / total'),
        paso(cr.val_resp >= 1, 'Valoración', `${cr.val_pct}%`, 'Porcentaje de valoraciones completadas'),
        paso(cr.informe_ok, 'Informe Final', cr.informe_date || '—', 'Informe Final: fecha de cierre entre socialización y +5d'),
        paso(cr.todo_ok, 'Fecha límite', limiteShort, 'Socialización + 5 días. Verde solo si todos los pasos están OK')
      ];

      const conformAlert = cr.conform_pend ? '<span class="badge conform-alert">⚠️ Generar Conformidad</span>' : '';
      const safeName = cr.name ? cr.name.substring(0, 70) : '';

      return `<div class="curso">
        <span class="nombre" title="${cr.name}">${safeName}</span>
        <div class="bateria">${pasos.join('')}</div>
        ${conformAlert}
    </div>`;
    }

    const facilitatorColors = [
      '#e3f2fd', '#fff3e0', '#e8f5e9', '#fce4ec', '#f3e5f5',
      '#e0f7fa', '#fff8e1', '#efebe9', '#e8eaf6', '#fbe9e7',
      '#e0f2f1', '#f1f8e9', '#fce4ec', '#e3f2fd', '#fff3e0'
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

    let htmlRows = '';
    for (const ev of deduplicatedEvents) {
      const bgColor = facilitatorColorMap[ev.facilitador] || '#ffffff';

      let tec = '8639300';
      for (const cr of ev.courses) {
        if (courseMap[cr.cid]) {
          tec = courseMap[cr.cid];
          break;
        }
      }

      if (tec === '8639300' && ev.facilitador) {
        const facNorm = normalizeText(ev.facilitador);
        for (const f of (facsDb || [])) {
          const dbNorm = normalizeText(f.nombre);
          if (dbNorm && dbNorm !== 'por confirmar') {
            const facWords = facNorm.split(/\s+/).filter(w => w.length >= 2);
            const dbWords = dbNorm.split(/\s+/).filter(w => w.length >= 2);
            const overlap = facWords.filter(w => dbWords.includes(w)).length;
            if (overlap >= 2 && facToTecnico[f.carnet]) {
              tec = facToTecnico[f.carnet];
              break;
            }
          }
        }
      }

      let courseCells = '';
      for (const cr of ev.courses) {
        const status = cellTemp(cr);
        courseCells += `<td class="${status}">${courseCellHtml(cr)}</td>`;
      }
      for (let i = ev.courses.length; i < 4; i++) {
        courseCells += '<td></td>';
      }

      const dataOk = ev.all_ok ? '1' : '0';
      htmlRows += `<tr style="background:${bgColor}" data-ok="${dataOk}" data-tecnico="${tec}">
        <td class="toggle-ciclo" title="${ev.ciclo}">${ev.ciclo ? ev.ciclo.substring(0, 60) : ''}</td>
        <td title="${ev.sede}">${ev.sede ? ev.sede.substring(0, 40) : ''}</td>
        <td title="${ev.facilitador}">${ev.facilitador ? ev.facilitador.substring(0, 40) : ''}</td>
        ${courseCells}
        <td style="text-align:center"><a href="${ev.url_evento}" target="_blank" title="Ver evento en SIE">👁️</a></td>
    </tr>`;
    }

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
.cell-red { background: #fee2e2 !important; }
.curso { min-width: 170px; max-width: 300px; }
.curso.curso-prioritario {
    border: 2.5px solid #e11d48 !important;
    box-shadow: 0 4px 12px rgba(225, 29, 72, 0.25) !important;
    border-radius: 10px !important;
    padding: 6px !important;
    background: #ffffff !important;
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
.curso .nombre { font-weight: 600; font-size: 12px; display: block; margin-bottom: 6px; line-height: 1.35; }
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
    <input type="search" id="buscar" placeholder="Buscar por ciclo, sede, facilitador o curso..." oninput="buscar()">
    <div class="filter-group" style="display: flex; gap: 6px; flex-wrap: wrap;">
        <button id="btnFiltroTodos" class="btn-filter active" onclick="setFiltroEstado('todos')">Todos</button>
        <button id="btnFiltroPrioritarios" class="btn-filter" onclick="setFiltroEstado('prioritarios')" style="color:#e11d48; font-weight:700;">⚡ Prioritarios</button>
        <button id="btnFiltroPendientes" class="btn-filter" onclick="setFiltroEstado('pendientes')">⚠️ Con Pendientes</button>
        <button id="btnFiltroOk" class="btn-filter" onclick="setFiltroEstado('ok')">✓ Todo OK</button>
    </div>
</div>

<div class="table-wrap">
<table id="reportTable">
<thead>
<tr>
    <th class="toggle-ciclo">Ciclo Formativo</th><th>Sede</th><th>Facilitador</th>
    <th>Curso 1</th><th>Curso 2</th><th>Curso 3</th><th>Curso 4</th>
    <th style="width:40px;text-align:center">🔗</th>
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
    <p>Batería por curso, en orden: <strong>Planificación</strong> (SI/NO), <strong>Planif. Fecha</strong> (válida entre inicio−5d y el día de inicio), <strong>Fecha de inicio</strong>, <strong>Socialización</strong>, <strong>Inf. Evaluación</strong> (respondidos/total), <strong>Valoración</strong> (%), <strong>Inf. Final</strong> (fecha de cierre entre socialización y +5d), <strong>Fecha límite</strong> (socialización + 5 días) | ✓ verde = paso OK, ✗ rojo = pendiente/incorrecto | <strong>⚡ Prioritario</strong> = Planificación pendiente 5d antes de inicio o Informe Final pendiente tras socialización</p>
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

function parseFechaStr(dateStr, defaultYear) {
    if (!dateStr || dateStr === '—' || dateStr === 'OK' || dateStr === 'SI' || dateStr === 'NO') return null;
    var year = defaultYear || 2026;
    var str = dateStr.trim();
    var parts = str.split('/');
    if (parts.length === 3) {
        var d = parseInt(parts[0], 10);
        var m = parseInt(parts[1], 10) - 1;
        var y = parseInt(parts[2], 10);
        if (!isNaN(d) && !isNaN(m) && !isNaN(y)) return new Date(y, m, d);
    }
    if (parts.length === 2) {
        var d = parseInt(parts[0], 10);
        var mNum = parseInt(parts[1], 10);
        if (!isNaN(mNum)) return new Date(year, mNum - 1, d);
        var monthsMap = { ene:0, feb:1, mar:2, abr:3, may:4, jun:5, jul:6, ago:7, sep:8, oct:9, nov:10, dic:11 };
        var mKey = parts[1].toLowerCase().substring(0, 3);
        if (monthsMap[mKey] !== undefined) return new Date(year, monthsMap[mKey], d);
    }
    return null;
}

function marcarPrioritarios() {
    var cursos = document.querySelectorAll('.curso');
    var today = new Date();
    today.setHours(0, 0, 0, 0);

    cursos.forEach(function(curso) {
        var pasos = curso.querySelectorAll('.paso');
        if (!pasos || pasos.length === 0) return;

        var pasoPlan = null, pasoPlanFecha = null, pasoInicio = null;
        var pasoSoc = null, pasoInforme = null, pasoLimite = null;

        pasos.forEach(function(p) {
            var lblEl = p.querySelector('.lbl');
            if (!lblEl) return;
            var txt = lblEl.textContent.trim().toLowerCase();
            if (txt === 'planificación') pasoPlan = p;
            else if (txt === 'planificación fecha') pasoPlanFecha = p;
            else if (txt === 'fecha de inicio') pasoInicio = p;
            else if (txt === 'socialización') pasoSoc = p;
            else if (txt === 'informe final') pasoInforme = p;
            else if (txt === 'fecha límite') pasoLimite = p;
        });

        var isPlanOk = pasoPlan && pasoPlan.classList.contains('ok');
        var isInformeOk = pasoInforme && pasoInforme.classList.contains('ok');

        var inicioVal = pasoInicio ? pasoInicio.querySelector('.val').textContent.trim() : '';
        var socVal = pasoSoc ? pasoSoc.querySelector('.val').textContent.trim() : '';

        var inicioDate = parseFechaStr(inicioVal, 2026);
        var socDate = parseFechaStr(socVal, 2026);

        var isPrioPlan = false;
        if (!isPlanOk && inicioDate) {
            var diffDaysPlan = Math.ceil((inicioDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
            if (diffDaysPlan <= 5) {
                isPrioPlan = true;
                if (pasoPlan) pasoPlan.classList.add('paso-prioritario-plan');
                if (pasoPlanFecha) pasoPlanFecha.classList.add('paso-prioritario-plan');
            }
        }

        var isPrioInforme = false;
        if (!isInformeOk && socDate) {
            var diffDaysSoc = Math.ceil((today.getTime() - socDate.getTime()) / (1000 * 3600 * 24));
            if (diffDaysSoc >= 0) {
                isPrioInforme = true;
                if (pasoInforme) pasoInforme.classList.add('paso-prioritario-informe');
                if (pasoLimite) pasoLimite.classList.add('paso-prioritario-informe');
            }
        }

        if (isPrioPlan || isPrioInforme) {
            curso.classList.add('curso-prioritario');
            var tr = curso.closest('tr');
            if (tr) tr.setAttribute('data-prioritario', '1');

            if (!curso.querySelector('.badge-prioridad')) {
                var badge = document.createElement('span');
                badge.className = 'badge badge-prioridad';
                if (isPrioPlan && isPrioInforme) {
                    badge.innerHTML = '⚡ Planificación & Final Pendiente';
                } else if (isPrioPlan) {
                    badge.innerHTML = '⚡ Planificación URGENTE (≤5d)';
                } else {
                    badge.innerHTML = '🚨 Informe Final URGENTE';
                }
                curso.insertBefore(badge, curso.firstChild);
            }
        }
    });
}

function buscar() {
    marcarPrioritarios();

    var input = document.getElementById('buscar');
    var filter = input ? input.value.toLowerCase().trim() : '';
    var tecSelect = document.getElementById('filtroTecnico');
    var selectedTec = tecSelect ? tecSelect.value : 'todos';

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
        var text = tr.textContent.toLowerCase();
        var rowTec = tr.getAttribute('data-tecnico') || '8639300';
        var isOk = tr.getAttribute('data-ok') === '1';
        var isPrio = tr.getAttribute('data-prioritario') === '1';

        var matchesText = !filter || text.includes(filter);
        var matchesTec = (selectedTec === 'todos') || (rowTec === selectedTec);

        var matchesEstado = true;
        if (currentFiltroEstado === 'prioritarios') {
            matchesEstado = isPrio;
        } else if (currentFiltroEstado === 'pendientes') {
            matchesEstado = !isOk;
        } else if (currentFiltroEstado === 'ok') {
            matchesEstado = isOk;
        }

        if (matchesText && matchesTec && matchesEstado) {
            tr.style.display = '';
            totalProg++;
            var cursosInRow = tr.querySelectorAll('.curso').length;
            totalCursos += cursosInRow;
            if (isOk) okCount++; else pendCount++;
        } else {
            tr.style.display = 'none';
        }
    }

    var cardValues = document.querySelectorAll('.card .value');
    if (cardValues.length >= 4) {
        cardValues[0].innerHTML = totalProg;
        cardValues[1].innerHTML = totalCursos;
        cardValues[2].innerHTML = okCount + '<span style="font-size:14px;color:var(--muted);font-weight:400"> / ' + totalProg + '</span>';
        cardValues[3].innerHTML = pendCount + '<span style="font-size:14px;color:var(--muted);font-weight:400"> / ' + totalProg + '</span>';
    }
}

function initReporte() {
    var params = new URLSearchParams(window.location.search);
    var tecParam = params.get('tecnico');
    if (tecParam) {
        var tecSelect = document.getElementById('filtroTecnico');
        if (tecSelect) {
            tecSelect.value = tecParam;
        }
    }
    buscar();
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
