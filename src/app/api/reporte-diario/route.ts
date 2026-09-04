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
      tecOptions += `<option value="8639300">Gilmar Felix Chavarria Choque</option>`;
      tecOptions += `<option value="7782629">Juan Pablo Alba Vaca</option>`;
      tecOptions += `<option value="3355859">Claudia Lisett Olivares Rivero</option>`;
    }

    // 1. Limpieza absoluta de selects anteriores para evitar duplicados
    finalHtml = finalHtml.replace(/<select[^>]*id="filtroMes"[^>]*>[\s\S]*?<\/select>/gi, '');
    finalHtml = finalHtml.replace(/<select[^>]*id="filtroTecnico"[^>]*>[\s\S]*?<\/select>/gi, '');

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

    // Insertar selects en la toolbar (exactamente uno de cada uno)
    if (finalHtml.includes('class="toolbar"')) {
      finalHtml = finalHtml.replace(/(<div[^>]*class="toolbar"[^>]*>)/i, `$1\n    ${dynamicSelectHtml}\n    ${selectMesHtml}`);
    }

    // 2. Limpieza e inyección de botones de filtro
    const filterButtonsHtml = `<div class="filter-group" style="display: flex; gap: 6px; flex-wrap: wrap;">
    <button id="btnFiltroTodos" class="btn-filter active" onclick="setFiltroEstado('todos')">Todos</button>
    <button id="btnFiltroPrioritarios" class="btn-filter" onclick="setFiltroEstado('prioritarios')" style="color:#e11d48; font-weight:700;">⚡ Prioritarios</button>
    <button id="btnFiltroPendientes" class="btn-filter" onclick="setFiltroEstado('pendientes')">⚠️ Con Pendientes</button>
    <button id="btnFiltroOk" class="btn-filter" onclick="setFiltroEstado('ok')">✓ Todo OK</button>
    <button id="btnLimpiarSubsanados" class="btn-limpiar-subsanados" onclick="limpiarTodosSubsanados()" title="Desmarcar todos los cursos provisionalmente subsanados">🧹 Limpiar Subsanados</button>
</div>`;

    finalHtml = finalHtml.replace(/<div class="filter-group"[\s\S]*?<\/div>/gi, '');
    finalHtml = finalHtml.replace(/<button[^>]*>[\s\S]*?Ocultar\s+Ciclo[\s\S]*?<\/button>/gi, '');
    finalHtml = finalHtml.replace(/<button[^>]*>[\s\S]*?Ocultar\s+verdes[\s\S]*?<\/button>/gi, '');
    finalHtml = finalHtml.replace(/<button[^>]*\bid=["']?btnCiclo["']?[^>]*>[\s\S]*?<\/button>/gi, '');
    finalHtml = finalHtml.replace(/<button[^>]*\bid=["']?btnVerdes["']?[^>]*>[\s\S]*?<\/button>/gi, '');
    finalHtml = finalHtml.replace(/<button[^>]*toggleCol\(['"]ciclo['"]\)[\s\S]*?<\/button>/gi, '');
    finalHtml = finalHtml.replace(/<button[^>]*toggleVerdes\(\)[\s\S]*?<\/button>/gi, '');

    if (finalHtml.includes('id="buscar"')) {
      finalHtml = finalHtml.replace(/(<input[^>]*id="buscar"[^>]*>)/i, `$1\n    ${filterButtonsHtml}`);
    }

    // 3. CSS de prioridades y de subsanación provisional
    const subsanarAndPrioCss = `<style id="custom-subsanar-prio-css">
.curso {
    position: relative !important;
    min-width: 175px;
    max-width: 300px;
    border: 2px solid #0284c7 !important;
    border-radius: 12px !important;
    padding: 8px !important;
    padding-top: 14px !important;
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
.badge-prioridad {
    background: #ffe4e6 !important;
    color: #be123c !important;
    border: 1px solid #f43f5e !important;
    font-size: 10px !important;
    font-weight: 700 !important;
    margin-bottom: 6px !important;
    display: block !important;
    width: 100% !important;
    text-align: center !important;
    border-radius: 6px !important;
    padding: 3px 6px !important;
    box-sizing: border-box !important;
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

/* Subsanación provisional - Badge pill posicionado perfectamente en esquina superior derecha */
.subsanar-check-container {
    position: absolute !important;
    top: 6px !important;
    right: 6px !important;
    margin: 0 !important;
    display: inline-flex !important;
    align-items: center !important;
    gap: 4px !important;
    background: #ffffff !important;
    border: 1.5px solid #cbd5e1 !important;
    border-radius: 9999px !important;
    padding: 2px 7px !important;
    font-size: 10px !important;
    font-weight: 700 !important;
    color: #475569 !important;
    cursor: pointer !important;
    user-select: none !important;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08) !important;
    transition: all 0.2s ease !important;
    z-index: 20 !important;
}
.subsanar-check-container:hover {
    background: #f1f5f9 !important;
    border-color: #94a3b8 !important;
    color: #1e293b !important;
}
.subsanar-check-container input[type="checkbox"] {
    cursor: pointer !important;
    margin: 0 !important;
    width: 12px !important;
    height: 12px !important;
    accent-color: #10b981 !important;
}
.curso.curso-subsanado {
    border: 2.5px solid #10b981 !important;
    background: #f0fdf4 !important;
    box-shadow: 0 4px 14px rgba(16, 185, 129, 0.25) !important;
    border-radius: 12px !important;
}
.curso.curso-subsanado .subsanar-check-container {
    background: #ecfdf5 !important;
    border-color: #10b981 !important;
    color: #065f46 !important;
    box-shadow: 0 1px 4px rgba(16, 185, 129, 0.2) !important;
}
.curso.curso-subsanado .badge-prioridad {
    display: none !important;
}
.badge-subsanado {
    display: none !important;
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
</style>`;

    finalHtml = finalHtml.replace(/<style id="custom-subsanar-prio-css">[\s\S]*?<\/style>/gi, '');
    if (finalHtml.includes('</head>')) {
      finalHtml = finalHtml.replace('</head>', `${subsanarAndPrioCss}\n</head>`);
    }

    // 4. Inyección completa y unificada del Script (sin duplicados)
    const fullScript = `<script>
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

function getCursoKey(cursoEl) {
    try {
        var tr = cursoEl.closest('tr');
        var facTd = tr ? tr.querySelector('td:nth-child(3)') : null;
        var cicloTd = tr ? tr.querySelector('td:nth-child(1)') : null;
        var nombreEl = cursoEl.querySelector('.nombre');
        
        var fac = facTd ? facTd.textContent.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '';
        var ciclo = cicloTd ? cicloTd.textContent.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 20) : '';
        var nom = nombreEl ? nombreEl.textContent.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 30) : '';

        var cursoCards = tr ? Array.from(tr.querySelectorAll('.curso')) : [];
        var cIdx = cursoCards.indexOf(cursoEl);

        return 'sub_' + fac.substring(0, 15) + '_' + ciclo + '_' + nom + '_' + cIdx;
    } catch(e) {
        return 'sub_item_' + Math.random().toString(36).substr(2, 9);
    }
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

function aplicarEstadoSubsanado(cursoEl, isChecked) {
    try {
        if (isChecked) {
            cursoEl.classList.add('curso-subsanado');
        } else {
            cursoEl.classList.remove('curso-subsanado');
        }
    } catch(e) {}
}

function initSubsanaciones() {
    try {
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
                container.title = 'Marcar como subsanado provisionalmente';
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
                    buscar();
                });

                curso.appendChild(container);
            } else {
                var cb = container.querySelector('input');
                if (cb) cb.checked = isChecked;
            }
        });
    } catch(e) {
        console.error('Error en initSubsanaciones:', e);
    }
}

function limpiarTodosSubsanados() {
    if (confirm('¿Deseas desmarcar todos los cursos subsanados provisionalmente?')) {
        localStorage.removeItem('reporte_cursos_subsanados');
        initSubsanaciones();
        buscar();
    }
}

function getCursoMesFromFechaInicio(cursoEl) {
    try {
        var pasos = cursoEl.querySelectorAll('.paso');
        var fStr = '';
        for (var i = 0; i < pasos.length; i++) {
            var lbl = pasos[i].querySelector('.lbl');
            if (lbl && lbl.textContent.toLowerCase().includes('fecha de inicio')) {
                var valEl = pasos[i].querySelector('.val');
                if (valEl) fStr = valEl.textContent.trim().toLowerCase();
                break;
            }
        }
        if (fStr.includes('may')) return 'mayo';
        if (fStr.includes('jun')) return 'junio';
        if (fStr.includes('jul')) return 'julio';
        if (fStr.includes('ago')) return 'agosto';
        if (fStr.includes('sep') || fStr.includes('set')) return 'septiembre';
        if (fStr.includes('oct')) return 'octubre';
        if (fStr.includes('nov')) return 'noviembre';
        if (fStr.includes('dic')) return 'diciembre';
        if (fStr.includes('ene')) return 'enero';
        if (fStr.includes('feb')) return 'febrero';
        if (fStr.includes('mar')) return 'marzo';
        if (fStr.includes('abr')) return 'abril';

        var attr = cursoEl.getAttribute('data-curso-mes');
        if (attr) return attr.toLowerCase().trim();
    } catch(e) {}
    return '';
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
            var isInformeBad = (pasoInforme && pasoInforme.classList.contains('bad')) || (pasoLimite && pasoLimite.classList.contains('bad'));
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
        initSubsanaciones();

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

            var matchesText = !filter || text.includes(filter);
            var matchesTec = (selectedTec === 'todos') || (rowTec === selectedTec);

            if (!matchesText || !matchesTec) {
                tr.style.display = 'none';
                continue;
            }

            var visibleCursosInRow = 0;
            var hasPrioInRow = false;
            var hasPendInRow = false;
            var allOkInRow = true;

            var cursosInRow = tr.querySelectorAll('.curso');
            cursosInRow.forEach(function(c) {
                var cMes = getCursoMesFromFechaInicio(c);
                var cMatchMes = (selectedMes === 'todos') || (cMes === selectedMes);

                if (cMatchMes) {
                    c.style.display = '';
                    visibleCursosInRow++;

                    var isSub = c.classList.contains('curso-subsanado');
                    var isPrio = c.classList.contains('curso-prioritario') && !isSub;
                    var hasBad = (c.querySelectorAll('.paso.bad').length > 0) && !isSub;

                    if (isPrio) hasPrioInRow = true;
                    if (hasBad) hasPendInRow = true;
                    if (hasBad || isPrio) allOkInRow = false;
                } else {
                    c.style.display = 'none';
                }
            });

            // Si se filtra por mes y el facilitador no tiene cursos en ese mes, se oculta la fila entera
            if (selectedMes !== 'todos' && visibleCursosInRow === 0) {
                tr.style.display = 'none';
                continue;
            }

            // Filtrado por botones de estado
            var matchesEstado = true;
            if (currentFiltroEstado === 'prioritarios') {
                matchesEstado = hasPrioInRow;
            } else if (currentFiltroEstado === 'pendientes') {
                matchesEstado = hasPendInRow;
            } else if (currentFiltroEstado === 'ok') {
                matchesEstado = allOkInRow && (visibleCursosInRow > 0);
            }

            if (matchesEstado && (selectedMes === 'todos' || visibleCursosInRow > 0)) {
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
        initSubsanaciones();
        buscar();
    } catch(e) {
        console.error('Error en initReporte:', e);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initReporte);
} else {
    setTimeout(initReporte, 50);
}
</script>`;

    finalHtml = finalHtml.replace(/<script[\s\S]*?<\/script>/gi, '');
    if (finalHtml.includes('</body>')) {
      finalHtml = finalHtml.replace('</body>', `${fullScript}\n</body>`);
    } else {
      finalHtml += `\n${fullScript}`;
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
