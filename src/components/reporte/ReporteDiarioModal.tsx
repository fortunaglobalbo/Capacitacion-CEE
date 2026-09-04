'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { X, Upload, ExternalLink, Save, RefreshCw, FileText, CheckCircle2, Eraser } from 'lucide-react';
import { AuthUser } from '@/lib/auth/AuthContext';
import Swal from 'sweetalert2';

interface ReporteDiarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser | null;
}

export default function ReporteDiarioModal({
  isOpen,
  onClose,
  currentUser,
}: ReporteDiarioModalProps) {
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const [syncingSie, setSyncingSie] = useState<boolean>(false);
  const [isSieConnected, setIsSieConnected] = useState<boolean>(false);
  const [sieUser, setSieUser] = useState<string>('');
  const [siePass, setSiePass] = useState<string>('');
  const [iframeKey, setIframeKey] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Comprobar si el usuario actual es el técnico Gilmar Felix Chavarria Choque
  const isGilmar = useMemo(() => {
    if (!currentUser) return false;
    const name = (currentUser.nombre_completo || '').toUpperCase();
    const username = (currentUser.username || '').toUpperCase();
    return (
      name.includes('GILMAR') ||
      name.includes('CHAVARRIA') ||
      username.includes('GILMAR') ||
      username === '8639300'
    );
  }, [currentUser]);

  // Determinar el carnet del técnico actual para filtrar por defecto
  const defaultTecnicoCarnet = useMemo(() => {
    // Por defecto mostrar 'todos' para ver el panorama completo y permitir filtrar libremente por mes
    return 'todos';
  }, []);

  // Inyectar el filtro por defecto del usuario y transformar el HTML con la lógica de prioridades y nuevos filtros
  const processedHtml = useMemo(() => {
    if (!htmlContent) return '';
    let finalHtml = htmlContent;

    // Reemplazar botones antiguos por grupo de filtros (sin importar el orden de atributos)
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

    if (finalHtml.includes('id="filtroTecnico"') && !finalHtml.includes('id="filtroMes"')) {
      finalHtml = finalHtml.replace(/(<select id="filtroTecnico"[\s\S]*?<\/select>)/gi, `$1\n    ${selectMesHtml}`);
    } else if (!finalHtml.includes('id="filtroMes"') && finalHtml.includes('id="buscar"')) {
      finalHtml = finalHtml.replace(/(<input[^>]*id="buscar"[^>]*>)/gi, `${selectMesHtml}\n    $1`);
    }

    // Inyectar CSS de prioridades y de subsanación provisional siempre actualizado
    const subsanarAndPrioCss = `<style id="custom-subsanar-prio-css">
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
.btn-filter:hover { background: #f1f5f9; }
.btn-filter.active { background: var(--primary); color: #fff; border-color: var(--primary); }
.btn-filter.active-prio { background: #e11d48 !important; color: #fff !important; border-color: #e11d48 !important; box-shadow: 0 2px 8px rgba(225, 29, 72, 0.3); }

/* Subsanación provisional - Badge pill posicionado perfectamente en esquina superior derecha */
.subsanar-check-container {
    position: absolute;
    top: 7px;
    right: 7px;
    margin: 0 !important;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: #ffffff;
    border: 1.5px solid #cbd5e1;
    border-radius: 9999px;
    padding: 2px 8px;
    font-size: 10px;
    font-weight: 700;
    color: #475569;
    cursor: pointer;
    user-select: none;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    transition: all 0.2s ease;
    z-index: 10;
}
.subsanar-check-container:hover {
    background: #f1f5f9;
    border-color: #94a3b8;
    color: #1e293b;
}
.subsanar-check-container input[type="checkbox"] {
    cursor: pointer;
    margin: 0;
    width: 12px;
    height: 12px;
    accent-color: #10b981;
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
    if (finalHtml.includes('id="custom-subsanar-prio-css"')) {
      finalHtml = finalHtml.replace(/<style id="custom-subsanar-prio-css">[\s\S]*?<\/style>/i, subsanarAndPrioCss);
    } else {
      finalHtml = finalHtml.replace('</head>', `${subsanarAndPrioCss}\n</head>`);
    }

    // Inyectar script de prioridades si falta
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

    // Inyectar script de subsanación provisional individual si falta
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

function aplicarEstadoSubsanado(cursoEl, isChecked) {
    if (isChecked) {
        cursoEl.classList.add('curso-subsanado');
    } else {
        cursoEl.classList.remove('curso-subsanado');
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
            });

            curso.appendChild(container);
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

// Inicialización automática y después de filtros
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSubsanaciones);
} else {
    setTimeout(initSubsanaciones, 100);
}
</script></body>`;
      finalHtml = finalHtml.replace('</body>', subsanarScriptBlock);
    } else {
      // Si ya existía initSubsanaciones en el HTML almacenado, actualizar la lógica de check y aplicar
      finalHtml = finalHtml.replace(
        /function aplicarEstadoSubsanado[\s\S]*?function limpiarTodosSubsanados\(\) \{[\s\S]*?\}/,
        `function aplicarEstadoSubsanado(cursoEl, isChecked) {
    if (isChecked) {
        cursoEl.classList.add('curso-subsanado');
    } else {
        cursoEl.classList.remove('curso-subsanado');
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
            });

            curso.appendChild(container);
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
}`
      );
    }

    // Reemplazar o actualizar buscar() para soportar filtro robusto por meses con alias, destacados y feedback si queda vacío
    const newBuscarBody = `function buscar() {
    marcarPrioritarios();
    initSubsanaciones();

    var input = document.getElementById('buscar');
    var filter = input ? input.value.toLowerCase().trim() : '';
    var tecSelect = document.getElementById('filtroTecnico');
    var selectedTec = tecSelect ? tecSelect.value : 'todos';

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

    var monthAliases = {
        'mayo': ['mayo', 'may'],
        'junio': ['junio', 'jun'],
        'julio': ['julio', 'jul'],
        'agosto': ['agosto', 'ago'],
        'septiembre': ['septiembre', 'sep', 'set'],
        'octubre': ['octubre', 'oct'],
        'noviembre': ['noviembre', 'nov'],
        'diciembre': ['diciembre', 'dic']
    };
    var aliases = monthAliases[selectedMes] || [selectedMes];

    for (var i = 0; i < trs.length; i++) {
        var tr = trs[i];
        if (tr.id === 'noRowsMsg') continue;

        var text = tr.textContent.toLowerCase();
        var rowTec = tr.getAttribute('data-tecnico') || '8639300';
        var rowMes = (tr.getAttribute('data-mes') || '').toLowerCase();
        var isOk = tr.getAttribute('data-ok') === '1';
        var isPrio = tr.getAttribute('data-prioritario') === '1';

        var matchesText = !filter || text.includes(filter);
        var matchesTec = (selectedTec === 'todos') || (rowTec === selectedTec);
        var matchesMes = (selectedMes === 'todos') || aliases.some(function(a) {
            return rowMes.includes(a) || text.includes(a);
        });

        var matchesEstado = true;
        if (typeof currentFiltroEstado !== 'undefined') {
            if (currentFiltroEstado === 'prioritarios') {
                matchesEstado = isPrio;
            } else if (currentFiltroEstado === 'pendientes') {
                matchesEstado = !isOk;
            } else if (currentFiltroEstado === 'ok') {
                matchesEstado = isOk;
            }
        }

        var cursosInRow = tr.querySelectorAll('.curso');
        var matchingCursosInRow = 0;

        if (matchesText && matchesTec && matchesEstado) {
            cursosInRow.forEach(function(c) {
                var cMes = (c.getAttribute('data-curso-mes') || '').toLowerCase();
                if (!cMes) {
                    var cText = c.textContent.toLowerCase();
                    for (var mKey in monthAliases) {
                        if (monthAliases[mKey].some(function(a) { return cText.includes(a); })) {
                            cMes = mKey;
                            break;
                        }
                    }
                }
                var cMatch = (selectedMes === 'todos') || (cMes === selectedMes) || (aliases.indexOf(cMes) !== -1);
                if (cMatch) {
                    c.style.display = '';
                    matchingCursosInRow++;
                } else {
                    c.style.display = 'none';
                }
            });

            if (selectedMes !== 'todos' && matchingCursosInRow === 0) {
                tr.style.display = 'none';
            } else {
                tr.style.display = '';
                totalProg++;
                totalCursos += matchingCursosInRow;
                if (isOk) okCount++; else pendCount++;
            }
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
}`;

    if (finalHtml.includes('function buscar()')) {
      finalHtml = finalHtml.replace(/function buscar\(\)[\s\S]*?function initReporte\(\)/, `${newBuscarBody}\n\nfunction initReporte()`);
    }

    if (defaultTecnicoCarnet !== 'todos') {
      finalHtml = finalHtml.replace(
        "var tecParam = params.get('tecnico');",
        `var tecParam = params.get('tecnico') || '${defaultTecnicoCarnet}';`
      );
    }
    return finalHtml;
  }, [htmlContent, defaultTecnicoCarnet]);

  // Cargar contenido HTML exclusivamente desde la base de datos de Supabase (sin localStorage/cookies)
  const loadHtmlReport = async () => {
    setLoading(true);

    // Mandato explícito: Limpiar cualquier rastro de localStorage anterior
    if (typeof window !== 'undefined') {
      localStorage.removeItem('reporte_diario_custom_html');
      localStorage.removeItem('reporte_diario_user_uploaded');
    }

    try {
      const res = await fetch(`/api/reporte-diario?t=${Date.now()}`);
      if (res.ok) {
        const text = await res.text();
        setHtmlContent(text || '');
      } else {
        setHtmlContent('');
      }
    } catch (e) {
      console.warn('Error al obtener reporte desde API Supabase:', e);
      setHtmlContent('');
    } finally {
      setLoading(false);
    }
  };

  // Limpiar el reporte COMPLETAMENTE de la base de datos de Supabase
  const handleClearReport = async () => {
    const result = await Swal.fire({
      title: '¿Vaciar Reporte de la Base de Datos?',
      text: 'Se eliminará el contenido del reporte guardado en la tabla reportes_html en Supabase.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, Vaciar Todo',
      cancelButtonText: 'Cancelar',
    });

    if (result.isConfirmed) {
      setLoading(true);
      try {
        await fetch('/api/reporte-diario', { method: 'DELETE' });

        if (typeof window !== 'undefined') {
          localStorage.removeItem('reporte_diario_custom_html');
          localStorage.removeItem('reporte_diario_user_uploaded');
          localStorage.removeItem('reporte_cursos_subsanados');
        }

        setHtmlContent('');
        setSieUser('');
        setSiePass('');
        setIsSieConnected(false);

        Swal.fire({
          icon: 'success',
          title: '¡Reporte Vaciado!',
          text: 'Se ha eliminado el reporte de la base de datos en Supabase.',
          timer: 2500,
          showConfirmButton: false,
        });
      } catch (err) {
        console.error('Error al vaciar reporte en servidor:', err);
        Swal.fire('Error', 'No se pudo vaciar la tabla de la base de datos', 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadHtmlReport();
    }
  }, [isOpen]);

  // Paso 1: ÚNICAMENTE conectar al SIE y verificar credenciales
  const handleConnectSie = async (userToUse?: string, passToUse?: string) => {
    const username = (userToUse || sieUser || '').trim();
    const password = passToUse || siePass;

    if (!username || !password) {
      Swal.fire({
        title: 'Credenciales Requeridas',
        text: 'Ingresa tu usuario y contraseña del SIE UNEFCO.',
        icon: 'warning',
        confirmButtonColor: '#0d3b66',
      });
      return;
    }

    setSyncingSie(true);

    Swal.fire({
      title: '🔌 Conectando al SIE UNEFCO...',
      html: `
        <div style="font-size:0.9rem;color:#334155;margin-top:6px;">
          <p style="color:#0284c7;font-weight:600;margin-bottom:4px;">Verificando credenciales con el portal SIE (${username})...</p>
          <p style="font-size:0.8rem;color:#64748b;">Por favor espera unos segundos mientras se valida el acceso.</p>
        </div>
      `,
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    try {
      const res = await fetch('/api/sie/sync-reporte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, action: 'verify' }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        setIsSieConnected(true);
        Swal.fire({
          icon: 'success',
          title: '🟢 Conexión Exitosa',
          html: `<b>¡Te has conectado correctamente al portal SIE UNEFCO!</b><br><br>Credenciales verificadas para <b>${username}</b>.<br>Ahora puedes hacer clic en <b>"🚀 Analizar y Sincronizar"</b> para procesar la información en tiempo real.`,
          confirmButtonColor: '#0d3b66',
        });
      } else {
        setIsSieConnected(false);
        Swal.fire({
          icon: 'error',
          title: 'Fallo de Conexión',
          text: data.error || 'No se pudo conectar al SIE. Revisa tu usuario y contraseña.',
          confirmButtonColor: '#0d3b66',
        });
      }
    } catch (e: any) {
      setIsSieConnected(false);
      Swal.fire({
        icon: 'error',
        title: 'Error de Servidor',
        text: 'Ocurrió un error al verificar la conexión con el SIE.',
        confirmButtonColor: '#0d3b66',
      });
    } finally {
      setSyncingSie(false);
    }
  };

  // Paso 2: Analizar y sincronizar todos los datos del SIE en tiempo real (requiere estar conectado)
  const handleSyncSieData = async (userToUse?: string, passToUse?: string) => {
    const username = (userToUse || sieUser || '').trim();
    const password = passToUse || siePass;

    if (!username || !password) {
      Swal.fire({
        title: 'Credenciales Requeridas',
        text: 'Ingresa tu usuario y contraseña del SIE UNEFCO.',
        icon: 'warning',
        confirmButtonColor: '#0d3b66',
      });
      return;
    }

    if (!isSieConnected) {
      Swal.fire({
        title: '⚠️ Conexión Requerida',
        html: 'Por favor haz clic primero en <b>"🔌 Conectar SIE"</b> para verificar tus credenciales antes de iniciar el análisis y la sincronización.',
        icon: 'warning',
        confirmButtonColor: '#0d3b66',
      });
      return;
    }

    setSyncingSie(true);

    Swal.fire({
      title: '📊 Analizando Datos del SIE en Tiempo Real...',
      html: `
        <div style="font-size:0.9rem;color:#334155;margin-top:6px;">
          <p style="margin-bottom:8px;">🟢 <b>Sesión Activa en el SIE UNEFCO</b> (${username})</p>
          <p style="color:#0284c7;font-weight:600;margin-bottom:4px;">Procesando participantes, eventos, planificaciones e informes finales en tiempo real...</p>
          <p style="font-size:0.8rem;color:#64748b;">Por favor espera unos momentos mientras se genera y guarda el nuevo reporte.</p>
        </div>
      `,
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    try {
      const res = await fetch('/api/sie/sync-reporte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, action: 'sync' }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        setIsSieConnected(true);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('reporte_cursos_subsanados');
        }
        await loadHtmlReport();
        setIframeKey((prev) => prev + 1);
        Swal.fire({
          icon: 'success',
          title: '✅ Monitoreo Realizado',
          html: '<b>¡Análisis y Sincronización completados con éxito!</b><br>Los datos del SIE se actualizaron en tiempo real y el nuevo reporte fue guardado en Supabase.',
          confirmButtonColor: '#0d3b66',
          timer: 3500,
          timerProgressBar: true,
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error durante el Análisis',
          text: data.error || 'No se pudo completar el análisis del SIE. Verifica la conexión o credenciales.',
          confirmButtonColor: '#0d3b66',
        });
      }
    } catch (e: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error de Servidor',
        text: 'Ocurrió un error al procesar el servicio de monitoreo.',
        confirmButtonColor: '#0d3b66',
      });
    } finally {
      setSyncingSie(false);
    }
  };

  // Manejar la subida de un nuevo archivo HTML (exclusivo para Gilmar Felix Chavarria Choque)
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.html') && !file.name.endsWith('.htm')) {
      Swal.fire('Formato no válido', 'Por favor selecciona un archivo con extensión .html o .htm', 'warning');
      return;
    }

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target?.result as string;
        if (!content) {
          Swal.fire('Error', 'El archivo seleccionado está vacío', 'error');
          setUploading(false);
          return;
        }

        // Guardar en servidor y base de datos Supabase mediante API POST
        const res = await fetch('/api/reporte-diario', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ html: content }),
        });

        const data = await res.json().catch(() => ({}));
        const finalHtml = data.enrichedHtml || content;

        setHtmlContent(finalHtml);
        if (typeof window !== 'undefined') {
          localStorage.setItem('reporte_diario_custom_html', finalHtml);
          localStorage.setItem('reporte_diario_user_uploaded', 'true');
        }

        if (res.ok) {
          Swal.fire({
            icon: 'success',
            title: '¡Plantilla Guardada Exitosamente!',
            html: `La plantilla del <b>Reporte Diario</b> fue guardada permanentemente en la base de datos de Supabase y estará activa en <b>todas las pestañas, recargas y dispositivos</b>.`,
            confirmButtonColor: '#0d3b66',
            timer: 4000,
            timerProgressBar: true,
          });
        } else {
          Swal.fire({
            icon: 'success',
            title: '¡Plantilla Guardada!',
            html: `La plantilla se ha activado correctamente en tu navegador.`,
            confirmButtonColor: '#0d3b66',
            timer: 3000,
          });
        }
        setUploading(false);
      };
      reader.readAsText(file, 'UTF-8');
    } catch (err: any) {
      console.error('Error al subir plantilla HTML:', err);
      Swal.fire('Error', 'Ocurrió un error al procesar el archivo HTML', 'error');
      setUploading(false);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <style>{`.swal2-container { z-index: 999999 !important; }`}</style>
      <div
        style={{
          backgroundColor: '#ffffff',
          width: '96vw',
          height: '92vh',
          maxWidth: '1850px',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0d3b66 0%, #1a5276 50%, #2e86c1 100%)',
            color: '#ffffff',
            padding: '12px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            boxShadow: '0 4px 12px rgba(13, 59, 102, 0.2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FileText size={22} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, letterSpacing: '0.3px', color: '#ffffff' }}>
                  REPORTE DIARIO DE MONITOREO ACADÉMICO
                </h2>
                {isSieConnected && (
                  <span
                    style={{
                      background: '#dcfce7',
                      color: '#15803d',
                      border: '1px solid #86efac',
                      padding: '3px 10px',
                      borderRadius: '20px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      boxShadow: '0 2px 6px rgba(22, 163, 74, 0.2)',
                    }}
                    title="Conexión en tiempo real con el portal SIE UNEFCO activa"
                  >
                    🟢 Conectado al SIE UNEFCO
                  </span>
                )}
              </div>
              <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                Visualización e informe actualizado en tiempo real
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Panel de Conexión al SIE disponible para todos los técnicos */}
            {currentUser && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(255, 255, 255, 0.12)',
                  padding: '6px 12px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.2)',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <input
                    type="text"
                    value={sieUser}
                    onChange={(e) => {
                      setSieUser(e.target.value);
                      setIsSieConnected(false);
                    }}
                    placeholder="Usuario / Correo SIE"
                    autoComplete="off"
                    style={{
                      background: 'rgba(255, 255, 255, 0.2)',
                      border: '1px solid rgba(255, 255, 255, 0.35)',
                      borderRadius: '5px',
                      color: '#ffffff',
                      fontSize: '0.75rem',
                      padding: '2px 8px',
                      width: '185px',
                      outline: 'none',
                      fontWeight: 600,
                    }}
                    title="Usuario del SIE UNEFCO"
                  />
                  <input
                    type="password"
                    value={siePass}
                    onChange={(e) => {
                      setSiePass(e.target.value);
                      setIsSieConnected(false);
                    }}
                    placeholder="Contraseña SIE"
                    autoComplete="new-password"
                    style={{
                      background: 'rgba(255, 255, 255, 0.2)',
                      border: '1px solid rgba(255, 255, 255, 0.35)',
                      borderRadius: '5px',
                      color: '#ffffff',
                      fontSize: '0.75rem',
                      padding: '2px 8px',
                      width: '185px',
                      outline: 'none',
                      fontWeight: 600,
                    }}
                    title="Contraseña del SIE UNEFCO"
                  />
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => handleConnectSie(sieUser, siePass)}
                    disabled={syncingSie}
                    style={{
                      background: isSieConnected
                        ? '#059669'
                        : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: syncingSie ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)',
                      height: '38px',
                    }}
                    title="Paso 1: Verificar credenciales y Conectar con el SIE UNEFCO"
                  >
                    <RefreshCw size={14} className={syncingSie ? 'spin' : ''} />
                    {syncingSie ? 'Verificando...' : isSieConnected ? '🟢 Conectado' : '🔌 Conectar SIE'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSyncSieData(sieUser, siePass)}
                    disabled={syncingSie}
                    style={{
                      background: syncingSie
                        ? '#64748b'
                        : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 14px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: syncingSie ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      boxShadow: '0 2px 8px rgba(22, 163, 74, 0.3)',
                      height: '38px',
                    }}
                    title="Paso 2: Procesar eventos, planificaciones e informes en tiempo real"
                  >
                    🚀 Analizar y Sincronizar
                  </button>

                  <button
                    type="button"
                    onClick={handleClearReport}
                    style={{
                      background: 'rgba(255, 255, 255, 0.15)',
                      color: '#ffffff',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      height: '38px',
                      transition: 'all 0.2s ease',
                    }}
                    title="Limpiar datos locales y restablecer plantilla del reporte"
                  >
                    <Eraser size={14} /> Limpiar Reporte
                  </button>
                </div>
              </div>
            )}

            <a
              href={`/api/reporte-diario?standalone=true&tecnico=${defaultTecnicoCarnet}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                borderRadius: '10px',
                padding: '10px 18px',
                fontSize: '0.95rem',
                fontWeight: 800,
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.4)',
                transition: 'all 0.2s ease',
              }}
              title="Abrir reporte directo a la tabla en nueva pestaña completa"
            >
              <ExternalLink size={18} /> 🚀 Abrir Pestaña Nueva
            </a>

            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                marginLeft: '6px',
              }}
              title="Cerrar"
            >
              <X size={20} />
            </button>
          </div>
        </div>



        {/* Creador/Visor Iframe */}
        <div style={{ flex: 1, backgroundColor: '#eef2f7', position: 'relative' }}>
          {loading ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                flexDirection: 'column',
                gap: '12px',
                color: '#64748b',
              }}
            >
              <RefreshCw size={32} className="spin" />
              <span>Cargando Reporte Diario...</span>
            </div>
          ) : !htmlContent || htmlContent.trim().length === 0 ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                flexDirection: 'column',
                gap: '16px',
                color: '#64748b',
                textAlign: 'center',
                padding: '20px',
                background: '#f8fafc',
              }}
            >
              <FileText size={52} style={{ opacity: 0.35, color: '#0d3b66' }} />
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#1e293b' }}>Reporte Vacío</h3>
                <p style={{ margin: '6px 0 0', fontSize: '0.88rem', color: '#64748b', maxWidth: '480px', lineHeight: '1.4' }}>
                  No hay ningún reporte cargado. Ingresa tu usuario y contraseña del SIE a un lado de la cabecera y presiona <b>"Conectar SIE"</b> para generar la información.
                </p>
              </div>
            </div>
          ) : (
            <iframe
              key={iframeKey}
              srcDoc={processedHtml}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                backgroundColor: '#ffffff',
              }}
              title="Reporte Diario"
            />
          )}
        </div>
      </div>
    </div>
  );
}
