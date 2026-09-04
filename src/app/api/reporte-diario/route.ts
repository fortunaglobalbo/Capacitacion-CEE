import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

function normalizeText(str: string) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
}

// Helper para transformar HTML con select de técnicos, botones de filtros y script de prioridades
async function processHtmlForResponse(htmlStr: string): Promise<string> {
  let finalHtml = htmlStr;
  try {
    const { data: tecnicosDB } = await supabase.from('tecnicos').select('carnet, nombre');
    let tecOptions = `<option value="todos">Todos los técnicos</option>`;
    if (tecnicosDB && tecnicosDB.length > 0) {
      tecOptions += tecnicosDB.map((t: any) => `<option value="${t.carnet}">${t.nombre}</option>`).join('');
    } else {
      tecOptions += `<option value="GARAY001">GARAY FLORES VIOLETA ANGELA</option>`;
    }

    const dynamicSelectHtml = `<select id="filtroTecnico" onchange="buscar()" style="padding: 10px 14px; border: 1px solid var(--border); border-radius: 8px; font-size: 13px; background: #fff; font-weight: 600; color: var(--primary);">
    ${tecOptions}
</select>`;

    const selectMesHtml = `<select id="filtroMes" onchange="buscar()" style="padding: 10px 14px; border: 1px solid var(--border); border-radius: 8px; font-size: 13px; background: #fff; font-weight: 600; color: #0284c7;">
    <option value="todos">Todos los meses</option>
    <option value="mayo">Mayo</option>
    <option value="junio">Junio</option>
    <option value="julio">Julio</option>
    <option value="agosto">Agosto</option>
    <option value="septiembre">Septiembre</option>
    <option value="octubre">Octubre</option>
    <option value="noviembre">Noviembre</option>
    <option value="diciembre">Diciembre</option>
</select>`;

    if (finalHtml.includes('id="filtroTecnico"')) {
      finalHtml = finalHtml.replace(/<select id="filtroTecnico"[\s\S]*?<\/select>/gi, `${dynamicSelectHtml}\n    ${selectMesHtml}`);
    } else if (!finalHtml.includes('id="filtroMes"') && finalHtml.includes('class="toolbar"')) {
      finalHtml = finalHtml.replace(/(<div[^>]*class="toolbar"[^>]*>)/gi, `$1\n    ${selectMesHtml}`);
    }

    const filterButtonsHtml = `<div class="filter-group" style="display: flex; gap: 6px; flex-wrap: wrap;">
    <button id="btnFiltroTodos" class="btn-filter active" onclick="setFiltroEstado('todos')">Todos</button>
    <button id="btnFiltroPrioritarios" class="btn-filter" onclick="setFiltroEstado('prioritarios')" style="color:#e11d48; font-weight:700;">⚡ Prioritarios</button>
    <button id="btnFiltroPendientes" class="btn-filter" onclick="setFiltroEstado('pendientes')">⚠️ Con Pendientes</button>
    <button id="btnFiltroOk" class="btn-filter" onclick="setFiltroEstado('ok')">✓ Todo OK</button>
    <button id="btnLimpiarSubsanados" class="btn-limpiar-subsanados" onclick="limpiarTodosSubsanados()" title="Desmarcar todos los cursos provisionalmente subsanados">🧹 Limpiar Subsanados</button>
</div>`;

    finalHtml = finalHtml.replace(/<button[^>]*>[\s\S]*?Ocultar\s+Ciclo[\s\S]*?<\/button>/gi, '');
    finalHtml = finalHtml.replace(/<button[^>]*>[\s\S]*?Ocultar\s+verdes[\s\S]*?<\/button>/gi, '');
    finalHtml = finalHtml.replace(/<button[^>]*\bid=["']?btnCiclo["']?[^>]*>[\s\S]*?<\/button>/gi, '');
    finalHtml = finalHtml.replace(/<button[^>]*\bid=["']?btnVerdes["']?[^>]*>[\s\S]*?<\/button>/gi, '');
    finalHtml = finalHtml.replace(/<button[^>]*toggleCol\(['"]ciclo['"]\)[\s\S]*?<\/button>/gi, '');
    finalHtml = finalHtml.replace(/<button[^>]*toggleVerdes\(\)[\s\S]*?<\/button>/gi, '');

    if (!finalHtml.includes('btnFiltroPrioritarios')) {
      if (finalHtml.includes('id="buscar"')) {
        finalHtml = finalHtml.replace(/(<input[^>]*id="buscar"[^>]*>)/gi, `$1\n    ${filterButtonsHtml}`);
      } else if (finalHtml.includes('class="toolbar"')) {
        finalHtml = finalHtml.replace(/(<div[^>]*class="toolbar"[^>]*>)/gi, `$1\n    ${filterButtonsHtml}`);
      }
    }

    if (!finalHtml.includes('.curso-subsanado')) {
      const subsanarAndPrioCss = `<style>
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
.btn-filter:hover { background: #f1f5f9; }
.btn-filter.active { background: var(--primary); color: #fff; border-color: var(--primary); }
.btn-filter.active-prio { background: #e11d48 !important; color: #fff !important; border-color: #e11d48 !important; box-shadow: 0 2px 8px rgba(225, 29, 72, 0.3); }

/* Subsanación provisional */
.subsanar-check-container {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: rgba(241, 245, 249, 0.95);
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 2px 7px;
    font-size: 10px;
    font-weight: 700;
    color: #334155;
    cursor: pointer;
    user-select: none;
    margin-bottom: 5px;
    transition: all 0.15s ease;
}
.subsanar-check-container:hover {
    background: #e2e8f0;
    border-color: #94a3b8;
}
.subsanar-check-container input[type="checkbox"] {
    cursor: pointer;
    margin: 0;
    width: 13px;
    height: 13px;
    accent-color: #059669;
}
.curso.curso-subsanado {
    border: 2.5px solid #10b981 !important;
    background: #f0fdf4 !important;
    box-shadow: 0 4px 14px rgba(16, 185, 129, 0.25) !important;
    border-radius: 10px !important;
}
.curso.curso-subsanado .badge-prioridad {
    display: none !important;
}
.badge-subsanado {
    background: #d1fae5 !important;
    color: #065f46 !important;
    border: 1px solid #34d399 !important;
    font-size: 10px !important;
    font-weight: 800 !important;
    margin-bottom: 4px;
    display: inline-block;
    width: 100%;
    text-align: center;
    border-radius: 6px;
    padding: 2px 4px;
}
.curso.curso-subsanado .paso.bad {
    background: #f1f5f9 !important;
    color: #475569 !important;
    border-color: #cbd5e1 !important;
    opacity: 0.75;
}
.curso.curso-subsanado .paso.bad .ico {
    color: #64748b !important;
}
.curso.curso-subsanado .paso-prioritario-plan,
.curso.curso-subsanado .paso-prioritario-informe {
    border: 1.5px dashed #94a3b8 !important;
    background: #f8fafc !important;
    color: #64748b !important;
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
</style></head>`;
      finalHtml = finalHtml.replace('</head>', subsanarAndPrioCss);
    }

    if (!finalHtml.includes('marcarPrioritarios')) {
      const scriptBlock = `<script>
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
        var limiteVal = pasoLimite ? pasoLimite.querySelector('.val').textContent.replace(/\(Mes\)|\(Global\)/gi, '').trim() : '';
        var limiteDate = parseFechaStr(limiteVal, 2026);

        if (!isInformeOk && limiteDate) {
            var diffDaysLimite = Math.ceil((today.getTime() - limiteDate.getTime()) / (1000 * 3600 * 24));
            if (diffDaysLimite >= 0) {
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
</script></body>`;
      finalHtml = finalHtml.replace('</body>', scriptBlock);
    }

    if (!finalHtml.includes('initSubsanaciones')) {
      const subsanarScriptBlock = `<script>
function getCursoKey(cursoEl) {
    var tr = cursoEl.closest('tr');
    var facTd = tr ? tr.querySelector('td:nth-child(3)') : null;
    var cicloTd = tr ? tr.querySelector('td:nth-child(1)') : null;
    var nombreEl = cursoEl.querySelector('.nombre');
    
    var fac = facTd ? facTd.textContent.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '';
    var ciclo = cicloTd ? cicloTd.textContent.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 25) : '';
    var nom = nombreEl ? nombreEl.textContent.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 35) : '';

    var cursoCards = tr ? Array.from(tr.querySelectorAll('.curso')) : [];
    var cIdx = cursoCards.indexOf(cursoEl);

    return 'sub_' + fac.substring(0, 20) + '_' + ciclo + '_' + nom + '_' + cIdx;
}

function getSubsanadosMap() {
    try {
        var raw = localStorage.getItem('reporte_cursos_subsanados');
        return raw ? JSON.parse(raw) : {};
    } catch(e) {
        return {};
    }
}

function saveSubsanadosMap(map) {
    try {
        localStorage.setItem('reporte_cursos_subsanados', JSON.stringify(map));
    } catch(e) {}
}

function aplicarEstadoSubsanado(cursoEl, isSubsanado) {
    var badge = cursoEl.querySelector('.badge-subsanado');
    if (isSubsanado) {
        cursoEl.classList.add('curso-subsanado');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'badge badge-subsanado';
            badge.innerHTML = '✓ Subsanado (Provisional)';
            var ref = cursoEl.querySelector('.bateria') || cursoEl.firstChild;
            cursoEl.insertBefore(badge, ref);
        } else {
            badge.style.display = 'inline-block';
        }
    } else {
        cursoEl.classList.remove('curso-subsanado');
        if (badge) {
            badge.style.display = 'none';
        }
    }
}

function initSubsanaciones() {
    var subsMap = getSubsanadosMap();
    var cursos = document.querySelectorAll('.curso');

    cursos.forEach(function(curso) {
        var key = getCursoKey(curso);
        var isChecked = !!subsMap[key];

        aplicarEstadoSubsanado(curso, isChecked);

        var container = curso.querySelector('.subsanar-check-container');
        if (!container) {
            container = document.createElement('label');
            container.className = 'subsanar-check-container';
            container.title = 'Marcar como subsanado provisionalmente hasta el próximo análisis';
            container.innerHTML = '<input type="checkbox" ' + (isChecked ? 'checked' : '') + ' data-key="' + key + '"><span>Subsanado</span>';
            
            var cb = container.querySelector('input');
            cb.addEventListener('change', function(e) {
                e.stopPropagation();
                var curMap = getSubsanadosMap();
                if (this.checked) {
                    curMap[key] = true;
                } else {
                    delete curMap[key];
                }
                saveSubsanadosMap(curMap);
                aplicarEstadoSubsanado(curso, this.checked);
            });

            var nombreEl = curso.querySelector('.nombre');
            if (nombreEl) {
                curso.insertBefore(container, nombreEl);
            } else {
                curso.insertBefore(container, curso.firstChild);
            }
        } else {
            var cb = container.querySelector('input');
            if (cb) cb.checked = isChecked;
        }
    });
}

function limpiarTodosSubsanados() {
    if (confirm('¿Deseas desmarcar todos los cursos subsanados provisionalmente?')) {
        localStorage.removeItem('reporte_cursos_subsanados');
        initSubsanaciones();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSubsanaciones);
} else {
    setTimeout(initSubsanaciones, 100);
}
</script></body>`;
      finalHtml = finalHtml.replace('</body>', subsanarScriptBlock);
    }

    // Asegurar que buscar() filtre por mes si existe en el HTML
    if (finalHtml.includes('function buscar(') && !finalHtml.includes('selectedMes')) {
      finalHtml = finalHtml.replace(
        "var selectedTec = tecSelect ? tecSelect.value : 'todos';",
        "var selectedTec = tecSelect ? tecSelect.value : 'todos';\n    var mesSelect = document.getElementById('filtroMes');\n    var selectedMes = mesSelect ? mesSelect.value.toLowerCase().trim() : 'todos';"
      );
      finalHtml = finalHtml.replace(
        "var matchesTec = (selectedTec === 'todos') || (rowTec === selectedTec);",
        "var matchesTec = (selectedTec === 'todos') || (rowTec === selectedTec);\n        var rowMes = (tr.getAttribute('data-mes') || '').toLowerCase();\n        var matchesMes = (selectedMes === 'todos') || rowMes.includes(selectedMes);"
      );
      finalHtml = finalHtml.replace(
        "if (matchesText && matchesTec && matchesEstado)",
        "if (matchesText && matchesTec && matchesMes && matchesEstado)"
      );
    }
  } catch (e) {
    console.warn('Error al procesar HTML de reporte:', e);
  }
  return finalHtml;
}

// Helper para obtener HTML del reporte desde Supabase (utiliza reportes_html)
async function getReportHtmlFromDb(): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('reportes_html')
      .select('contenido')
      .eq('id', 'REPORTE_DIARIO_ACTUAL')
      .maybeSingle();

    if (!error && data?.contenido && data.contenido.trim().length > 0) {
      return data.contenido;
    }
  } catch (e) {}

  return null;
}

// Helper para guardar HTML en Supabase DB
async function saveReportHtmlToDb(html: string): Promise<boolean> {
  try {
    const { error: err1 } = await supabase.from('reportes_html').upsert({
      id: 'REPORTE_DIARIO_ACTUAL',
      contenido: html,
      tecnico_carnet: '8639300',
      updated_at: new Date().toISOString(),
    });
    if (!err1) return true;
  } catch (e) {}

  return false;
}

export async function GET(request: Request) {
  try {
    const hideHeaderCss = '<style>.header, .cards { display: none !important; } body { padding: 12px 16px !important; } .table-wrap { max-height: 88vh !important; }</style></head>';

    const dbHtml = await getReportHtmlFromDb();

    if (dbHtml && dbHtml.trim().length > 0) {
      let outputHtml = await processHtmlForResponse(dbHtml);
      if (outputHtml.includes('</head>')) {
        outputHtml = outputHtml.replace('</head>', hideHeaderCss);
      }
      return new NextResponse(outputHtml, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0, s-maxage=0',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });
    }

    // Sin backups locales ni plantillas estáticas de respaldo por mandato explícito del usuario
    return new NextResponse(
      '<div style="font-family:sans-serif;padding:40px;text-align:center;color:#64748b;"><h2>No hay ningún reporte almacenado en la base de datos</h2><p>Conecta al SIE o sube un reporte para almacenar y visualizar la información.</p></div>',
      {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.html || typeof body.html !== 'string') {
      return NextResponse.json({ error: 'Contenido HTML no válido' }, { status: 400 });
    }

    let inputHtml = body.html;

    try {
      const [{ data: cursos }, { data: facs }, { data: tecnicosDB }] = await Promise.all([
        supabase.from('cursos').select('id, tecnico_carnet, facilitador_carnet'),
        supabase.from('facilitadores').select('carnet, nombre'),
        supabase.from('tecnicos').select('carnet, nombre'),
      ]);

      const courseMap: { [id: string]: string } = {};
      (cursos || []).forEach((c: any) => {
        if (c.id && c.tecnico_carnet) courseMap[c.id] = c.tecnico_carnet;
      });

      const facToTecnico: { [carnet: string]: string } = {};
      (cursos || []).forEach((c: any) => {
        if (c.facilitador_carnet && c.facilitador_carnet !== '9999999' && c.tecnico_carnet) {
          facToTecnico[c.facilitador_carnet] = c.tecnico_carnet;
        }
      });

      if (inputHtml.includes('<!-- INJECTED_REPORTE_SCRIPT -->')) {
        inputHtml = inputHtml.split('<!-- INJECTED_REPORTE_SCRIPT -->')[0] + '</body></html>';
      }

      const trs = inputHtml.split('<tr');
      for (let i = 1; i < trs.length; i++) {
        const block = trs[i];
        if (block.includes('<th')) continue;

        let cleanBlock = block.replace(/\s*data-tecnico="[^"]*"/gi, '');
        const rowTextClean = normalizeText(cleanBlock.replace(/<[^>]+>/g, ' '));

        let tec: string | null = null;

        for (const t of (tecnicosDB || [])) {
          const tNorm = normalizeText(t.nombre);
          if (!tNorm) continue;
          const tWords = tNorm.split(/\s+/).filter((w) => w.length >= 3);
          if (tWords.length > 0 && tWords.some((w) => rowTextClean.includes(w))) {
            tec = t.carnet;
            break;
          }
        }

        if (!tec) {
          const idMatch = cleanBlock.match(/ID\s*[:\-]?\s*(\d+)/i);
          const id = idMatch ? idMatch[1] : null;
          tec = id && courseMap[id] ? courseMap[id] : null;
        }

        if (!tec) {
          for (const f of (facs || [])) {
            const dbNorm = normalizeText(f.nombre);
            if (!dbNorm || dbNorm === 'por confirmar') continue;
            const dbWords = dbNorm.split(/\s+/).filter((w) => w.length >= 2);
            const allWordsMatch = dbWords.length > 0 && dbWords.every((w) => rowTextClean.includes(w));
            if (allWordsMatch && facToTecnico[f.carnet]) {
              tec = facToTecnico[f.carnet];
              break;
            }
          }
        }

        if (!tec) {
          tec = tecnicosDB && tecnicosDB.length > 0 ? tecnicosDB[0].carnet : 'GARAY001';
        }

        trs[i] = ` data-tecnico="${tec}"${cleanBlock}`;
      }

      inputHtml = trs.join('<tr');
    } catch (enrichError) {
      console.warn('Error durante el enriquecimiento del HTML:', enrichError);
    }

    await saveReportHtmlToDb(inputHtml);

    return NextResponse.json({
      success: true,
      enrichedHtml: inputHtml,
      message: 'Plantilla de Reporte Diario guardada exitosamente en la base de datos Supabase',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    try {
      await supabase.from('reportes_html').delete().eq('id', 'REPORTE_DIARIO_ACTUAL');
    } catch (e) {}

    return NextResponse.json({
      success: true,
      message: 'Reporte eliminado de la base de datos en Supabase',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
