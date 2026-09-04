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
</div>`;

    finalHtml = finalHtml.replace(/<div class="filter-group"[\s\S]*?<\/div>/gi, '');
    finalHtml = finalHtml.replace(/<button[^>]*>[\s\S]*?Ocultar\s+Ciclo[\s\S]*?<\/button>/gi, '');
    finalHtml = finalHtml.replace(/<button[^>]*>[\s\S]*?Ocultar\s+verdes[\s\S]*?<\/button>/gi, '');
    finalHtml = finalHtml.replace(/<button[^>]*\bid=["']?btnCiclo["']?[^>]*>[\s\S]*?<\/button>/gi, '');
    finalHtml = finalHtml.replace(/<button[^>]*\bid=["']?btnVerdes["']?[^>]*>[\s\S]*?<\/button>/gi, '');
    finalHtml = finalHtml.replace(/<button[^>]*toggleCol\(['"]ciclo['"]\)[\s\S]*?<\/button>/gi, '');
    finalHtml = finalHtml.replace(/<button[^>]*toggleVerdes\(\)[\s\S]*?<\/button>/gi, '');
    finalHtml = finalHtml.replace(/<button[^>]*\bid=["']?btnLimpiarSubsanados["']?[^>]*>[\s\S]*?<\/button>/gi, '');
    finalHtml = finalHtml.replace(/<label class="subsanar-check-container"[\s\S]*?<\/label>/gi, '');
    finalHtml = finalHtml.replace(/\bcurso-subsanado\b/gi, '');

    if (finalHtml.includes('id="buscar"')) {
      finalHtml = finalHtml.replace(/(<input[^>]*id="buscar"[^>]*>)/i, `$1\n    ${filterButtonsHtml}`);
    }

    // Inyectar botón "Validar" en cada celda de facilitador si no lo tiene
    finalHtml = finalHtml.replace(/(<td title="[^"]*" style="vertical-align:middle;">[\s\S]*?)(<\/td>)/gi, (match, inner, close) => {
      if (inner.includes('btn-validar-fac')) return match;
      const btnHtml = `<div style="margin-top: 6px;">
        <button type="button" class="btn-validar-fac" onclick="validarFacilitadorFila(this)" title="Revalidar datos de este facilitador en SIE UNEFCO">
          <span class="btn-val-icon">🔄</span> <span class="btn-val-text">Validar</span>
        </button>
      </div>`;
      return `${inner}${btnHtml}${close}`;
    });

    // 3. CSS de prioridades y de validación directa
    const subsanarAndPrioCss = `<style id="custom-subsanar-prio-css">
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
.curso .nombre {
    font-weight: 700 !important;
    font-size: 11px !important;
    color: #1e293b !important;
    margin-bottom: 6px !important;
    line-height: 1.35 !important;
    min-height: 28px !important;
}
.empty-course-cell {
    background: rgba(241, 245, 249, 0.45) !important;
    border-bottom: 1px solid var(--border);
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
        var customKey = cursoEl.getAttribute('data-curso-key');
        if (customKey) return customKey;

        var tr = cursoEl.closest('tr');
        var facTd = tr ? tr.querySelector('td:nth-child(2)') : null;
        var nombreEl = cursoEl.querySelector('.nombre');
        
        var fac = facTd ? facTd.textContent.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '';
        var nom = nombreEl ? nombreEl.textContent.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 30) : '';

        var cursoCards = tr ? Array.from(tr.querySelectorAll('.curso')) : [];
        var cIdx = cursoCards.indexOf(cursoEl);

        return 'sub_' + fac.substring(0, 15) + '_' + nom + '_' + cIdx;
    } catch(e) {
        return 'sub_item_' + Math.random().toString(36).substr(2, 9);
    }
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

                initSubsanaciones();
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

function limpiarTodosSubsanados() {
    if (confirm('¿Deseas desmarcar todos los cursos subsanados provisionalmente?')) {
        localStorage.removeItem('reporte_cursos_subsanados');
        initSubsanaciones();
        buscar();
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
