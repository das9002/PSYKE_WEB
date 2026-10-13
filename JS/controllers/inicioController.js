document.addEventListener('DOMContentLoaded', () => {

    const estado = {
        resumen: null,
        apiDisponible: false
    };

    function el(id) {
        return document.getElementById(id);
    }

    function escapeHTML(str) {
        return String(str ?? '').replace(/[&<>"']/g, (c) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[c]));
    }

    function iniciales(nombreCompleto) {
        const partes = (nombreCompleto || '').trim().split(/\s+/);
        if (!partes.length || !partes[0]) return 'ES';
        return ((partes[0][0] || '') + (partes[1] ? partes[1][0] : (partes[0][1] || ''))).toUpperCase();
    }

    function formatearFechaLegible(fechaVal) {
        if (!fechaVal) return 'Sin fecha';
        const partes = String(fechaVal).split('T')[0].split('-');
        if (partes.length !== 3) return fechaVal;
        const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        return `${partes[2]} ${meses[parseInt(partes[1], 10) - 1] || ''} ${partes[0]}`;
    }

    function formatearRangoCita(cita) {
        let inicio = cita.horaInicio || cita.hora || '';
        let fin = cita.horaFin || '';

        if (!inicio && cita.fechaHoraCita) {
            const partes = String(cita.fechaHoraCita).split('T');
            inicio = partes[1] ? partes[1].substring(0, 5) : '';
            if (inicio) {
                const [hh, mm] = inicio.split(':').map(Number);
                fin = `${String((hh + 1) % 24).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
            }
        }

        if (!inicio) return 'Horario por confirmar';
        return fin ? `${inicio} - ${fin}` : inicio;
    }

    function nombreCita(cita) {
        const estudiante = cita.estudiante;
        if (estudiante && typeof estudiante === 'object') {
            return `${estudiante.nombres ?? ''} ${estudiante.apellidos ?? ''}`.trim() || 'Sin estudiante';
        }
        return estudiante || `${cita.nombres ?? ''} ${cita.apellidos ?? ''}`.trim() || 'Sin estudiante';
    }

    function textoSubestudiante(est) {
        if (est.carrera) return est.carrera;
        if (est.codigoCarnet) return est.codigoCarnet;
        const nombreDe = (obj) => {
            if (!obj) return '';
            if (typeof obj !== 'object') return String(obj);
            return obj.nombreEspecialidad || obj.nombreGrado || obj.nombre || '';
        };
        return nombreDe(est.especialidad) || nombreDe(est.grado) || 'Estudiante';
    }

    function renderMetricas(resumen) {
        const kpis = [
            ['totalEstudiantes', resumen?.totalEstudiantes],
            ['citasHoy', resumen?.citasHoy],
            ['riesgoAlto', resumen?.riesgoAlto ?? resumen?.casosPrioritarios],
            ['seguimientosPendientes', resumen?.seguimientosPendientes]
        ];

        kpis.forEach(([id, valor]) => {
            const kpiEl = el(id);
            if (kpiEl) kpiEl.textContent = Number(valor) || 0;
        });
    }

    const TEMAS_RESUMEN = [
        { patron: /estr[eé]s(?:\s+acad[eé]mico)?/gi, clase: 'ia-tema-rojo' },
        { patron: /ansiedad(?:\s+por\s+evaluaciones)?/gi, clase: 'ia-tema-ambar' },
        { patron: /depresi[oó]n|tristeza|duelo/gi, clase: 'ia-tema-morado' },
        { patron: /acoso(?:\s+escolar)?|bullying|violencia/gi, clase: 'ia-tema-rojo' },
        { patron: /autoestima|conducta|problemas familiares/gi, clase: 'ia-tema-azul' }
    ];

    function escaparResumen(texto) {
        const div = document.createElement('div');
        div.textContent = texto;
        return div.innerHTML;
    }

    function resaltarOracion(oracion) {
        let html = escaparResumen(oracion)
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^*]+)\*/g, '$1');

        html = html.replace(/\b(\d+)(\s+(?:estudiantes?|casos?)\s+(?:en|con|presentan?)\s+riesgo\s+alto)/gi,
            '<mark class="ia-marca ia-riesgo">$1$2</mark>');
        html = html.replace(/\b(\d+)(\s+presentan?\s+riesgo\s+alto)/gi, '<mark class="ia-marca ia-riesgo">$1$2</mark>');
        html = html.replace(/(ninguno\s+presenta\s+riesgo\s+alto)/gi, '<mark class="ia-marca ia-ok">$1</mark>');
        html = html.replace(/(\b\d+\s+(?:casos?|estudiantes?)\s+requieren?\s+seguimiento\s+prioritario)/gi,
            '<mark class="ia-marca ia-prioridad">$1</mark>');
        html = html.replace(/(?<![\w>])(\d+)(\s+(?:estudiantes?|citas?|casos?|sesiones?)(?:\s+(?:asignados?|programadas?|activos?|nuevos?|pendientes?))?)(?![^<]*<\/(?:strong|mark)>)/gi,
            '<strong>$1$2</strong>');
        html = html.replace(/(no hay citas programadas)/gi, '<strong>$1</strong>');
        html = html.replace(/<strong>(<mark class="[^"]+">[^<]*<\/mark>)<\/strong>/g, '$1');

        TEMAS_RESUMEN.forEach(({ patron, clase }) => {
            html = html.replace(patron, (coincidencia) => `<span class="ia-tema ${clase}">${coincidencia}</span>`);
        });
        return html;
    }

    function saludoDelMomento() {
        const hora = new Date().getHours();
        if (hora < 12) return 'Buenos días';
        if (hora < 19) return 'Buenas tardes';
        return 'Buenas noches';
    }

    function renderEncabezadoResumen(resumen) {
        const saludo = el('iaSaludo');
        const fecha = el('iaFecha');
        if (saludo) saludo.textContent = `${saludoDelMomento()}, este es tu resumen`;
        if (fecha) {
            const texto = new Date().toLocaleDateString('es-SV', { weekday: 'long', day: 'numeric', month: 'long' });
            fecha.textContent = texto.charAt(0).toUpperCase() + texto.slice(1);
        }

        const chips = el('iaChips');
        if (!chips) return;
        if (!resumen) {
            chips.innerHTML = '';
            return;
        }
        const n = (valor) => Number(valor) || 0;
        const citas = n(resumen.citasHoy);
        const riesgo = n(resumen.riesgoAlto ?? resumen.casosPrioritarios);
        const seguimiento = n(resumen.seguimientosPendientes);
        const estudiantes = n(resumen.totalEstudiantes);
        const items = [
            { icono: 'bi-calendar-event', texto: citas === 1 ? '1 cita hoy' : `${citas} citas hoy`, clase: 'azul' },
            { icono: 'bi-exclamation-triangle', texto: riesgo === 1 ? '1 en riesgo alto' : `${riesgo} en riesgo alto`, clase: riesgo > 0 ? 'rojo activo' : 'verde' },
            { icono: 'bi-activity', texto: seguimiento === 1 ? '1 en seguimiento' : `${seguimiento} en seguimiento`, clase: 'ambar' },
            { icono: 'bi-people', texto: estudiantes === 1 ? '1 estudiante' : `${estudiantes} estudiantes`, clase: 'gris' }
        ];
        chips.innerHTML = items.map((item) =>
            `<span class="ia-chip ${item.clase}"><i class="bi ${item.icono}"></i>${escaparResumen(item.texto)}</span>`).join('');
    }

    function renderResumenIA(texto, resumen) {
        const parrafo = el('aiSummaryText');
        if (!parrafo) return;
        renderEncabezadoResumen(resumen);

        const limpio = String(texto || '').replace(/\s+/g, ' ').trim();
        if (!limpio) {
            parrafo.innerHTML = '<p class="ia-cuerpo ia-vacio">Aún no hay datos suficientes para generar el resumen. Vuelve a intentarlo en unos minutos.</p>';
            return;
        }

        const indice = limpio.search(/(?:se recomienda|recomendaci[oó]n:)/i);
        const cuerpo = indice > 0 ? limpio.slice(0, indice).trim() : limpio;
        const recomendacion = indice > 0 ? limpio.slice(indice).replace(/^recomendaci[oó]n:\s*/i, '').trim() : '';

        parrafo.innerHTML = `
            <p class="ia-cuerpo">${resaltarOracion(cuerpo)}</p>
            ${recomendacion ? `
            <div class="ia-recomendacion">
                <div class="ia-recomendacion-icono"><i class="bi bi-lightbulb-fill"></i></div>
                <div>
                    <span class="ia-recomendacion-titulo">Sugerencia</span>
                    <p>${resaltarOracion(recomendacion)}</p>
                </div>
            </div>` : ''}`;
        parrafo.classList.remove('ia-aparecer');
        void parrafo.offsetWidth;
        parrafo.classList.add('ia-aparecer');
    }

    function renderCitasRecientes(lista = []) {
        const contenedor = el('appointmentsList');
        if (!contenedor) return;

        contenedor.innerHTML = '';

        if (!Array.isArray(lista) || lista.length === 0) {
            contenedor.innerHTML = `
                <div class="text-center py-4 text-muted">
                    <i class="bi bi-calendar-x fs-3 mb-2 d-block opacity-50"></i>
                    <p class="mb-0">No hay citas programadas para mostrar.</p>
                </div>`;
            return;
        }

        lista.forEach((cita) => {
            const item = document.createElement('div');
            item.className = 'appointment d-flex align-items-center justify-content-between';
            item.innerHTML = `
                <div class="d-flex align-items-center gap-2">
                    <div class="appointment-avatar">
                        <i class="bi bi-person-fill text-secondary"></i>
                    </div>
                    <div>
                        <strong class="d-block">${escapeHTML(nombreCita(cita))}</strong>
                        <span class="text-muted small"><i class="bi bi-tag me-1"></i>${escapeHTML(cita.motivo || cita.tipoSesion || 'Sesión programada')}</span>
                    </div>
                </div>
                <span class="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 d-flex align-items-center gap-1 px-3 py-2">
                    <i class="bi bi-clock"></i> ${escapeHTML(formatearRangoCita(cita))}
                </span>`;
            contenedor.appendChild(item);
        });
    }

    function badgeRiesgo(riesgo) {
        const r = (riesgo || '').toLowerCase();
        if (r === 'alto' || r === 'alta' || r === 'critico' || r === 'crítico' || r === 'urgente') {
            return `<span class="risk-high d-inline-flex align-items-center gap-1"><i class="bi bi-exclamation-triangle-fill"></i> Alto</span>`;
        }
        if (r === 'bajo') {
            return `<span class="risk-low d-inline-flex align-items-center gap-1"><i class="bi bi-check-circle-fill"></i> Bajo</span>`;
        }
        return `<span class="risk-medium d-inline-flex align-items-center gap-1"><i class="bi bi-exclamation-circle-fill"></i> Moderado</span>`;
    }

    function badgeEstado(estadoVal) {
        const e = (estadoVal || '').toLowerCase();
        if (e === 'urgente' || e === 'prioritario') {
            return `<span class="badge bg-danger text-white d-inline-flex align-items-center gap-1 px-4 py-2"><i class="bi bi-exclamation-octagon"></i> Prioritario</span>`;
        }
        if (e === 'seguimiento' || e === 'en seguimiento') {
            return `<span class="badge bg-warning text-white d-inline-flex align-items-center gap-1 px-4 py-2"><i class="bi bi-hourglass"></i> Seguimiento</span>`;
        }
        if (e === 'controlado' || e === 'estable' || e === 'normal') {
            return `<span class="badge bg-success text-white d-inline-flex align-items-center gap-1 px-4 py-2"><i class="bi bi-shield-check"></i> Controlado</span>`;
        }
        return `<span class="badge bg-secondary text-white d-inline-flex align-items-center gap-1 px-4 py-2">${escapeHTML(estadoVal || 'Sin estado')}</span>`;
    }

    function renderEstudiantesRecientes(lista = estado.resumen?.estudiantesRecientes || []) {
        const tbody = el('recentStudentsBody');
        const noResults = el('noResultsMessage');
        if (!tbody) return;

        tbody.innerHTML = '';

        const textoBusqueda = (el('searchRecentStudents')?.value || '').toLowerCase().trim();

        const filtrados = (Array.isArray(lista) ? lista : []).filter((est) => {
            const texto = `${est.nombres ?? ''} ${est.apellidos ?? ''} ${est.riesgo ?? ''} ${est.estado ?? ''}`.toLowerCase();
            return texto.includes(textoBusqueda);
        });

        if (filtrados.length === 0) {
            if (noResults) {
                const parrafo = noResults.querySelector('p');
                if (parrafo) {
                    parrafo.textContent = textoBusqueda
                        ? 'No se encontraron estudiantes que coincidan con la búsqueda.'
                        : 'No hay estudiantes para mostrar.';
                }
                noResults.classList.remove('d-none');
            }
            return;
        }
        if (noResults) noResults.classList.add('d-none');

        filtrados.forEach((est) => {
            const nombre = `${est.nombres ?? ''} ${est.apellidos ?? ''}`.trim() || 'Sin nombre';
            const subtexto = textoSubestudiante(est);

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div class="d-flex align-items-center gap-2">
                        <div class="student-avatar-badge">${escapeHTML(iniciales(nombre))}</div>
                        <div>
                            <strong class="student-name">${escapeHTML(nombre)}</strong>
                            <div class="text-muted small">${escapeHTML(subtexto)}</div>
                        </div>
                    </div>
                </td>
                <td>${badgeRiesgo(est.riesgo)}</td>
                <td>
                    <span class="d-inline-flex align-items-center gap-1">
                        <i class="bi bi-calendar3 text-muted"></i> ${escapeHTML(est.proximaCita ? formatearFechaLegible(est.proximaCita) : 'Sin cita')}
                    </span>
                </td>
                <td>${badgeEstado(est.estado)}</td>
                <td class="text-end">
                    <a href="seguimientos.html" class="btn btn-sm btn-outline-secondary" title="Ver expediente">
                        <i class="bi bi-eye"></i>
                    </a>
                </td>`;
            tbody.appendChild(tr);
        });
    }

    function mostrarAlerta(mensaje, esErrorServidor = false) {
        if (typeof Notif !== 'undefined' && Notif.error) {
            Notif.error(mensaje, esErrorServidor ? 'Error del servidor' : 'No se pudo cargar el panel');
        } else {
            console.error('[Dashboard Error]:', mensaje);
        }
    }

    function mostrarEstadoCarga() {
        renderMetricas({});
        const contCitas = el('appointmentsList');
        if (contCitas) {
            contCitas.innerHTML = `
                <div class="text-center py-4 text-muted">
                    <div class="spinner-border spinner-border-sm text-primary mb-2" role="status">
                        <span class="visually-hidden">Cargando...</span>
                    </div>
                    <p class="mb-0">Cargando citas programadas...</p>
                </div>`;
        }
        const tbody = el('recentStudentsBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-4 text-muted">
                        <div class="spinner-border spinner-border-sm text-primary mb-2" role="status">
                            <span class="visually-hidden">Cargando...</span>
                        </div>
                        <p class="mb-0">Cargando estudiantes recientes...</p>
                    </td>
                </tr>`;
        }
        const noResults = el('noResultsMessage');
        if (noResults) noResults.classList.add('d-none');
    }

    function aplicarEstadoError(mensaje) {
        renderMetricas({});
        renderResumenIA('');

        const contCitas = el('appointmentsList');
        if (contCitas) {
            contCitas.innerHTML = `
                <div class="text-center py-4 text-muted">
                    <i class="bi bi-plug fs-3 mb-2 d-block opacity-50"></i>
                    <p class="mb-0">No se pudieron cargar las citas programadas.</p>
                </div>`;
        }

        const tbody = el('recentStudentsBody');
        if (tbody) tbody.innerHTML = '';
        const noResults = el('noResultsMessage');
        if (noResults) {
            const parrafo = noResults.querySelector('p');
            if (parrafo) parrafo.textContent = 'No se pudieron cargar los estudiantes.';
            noResults.classList.remove('d-none');
        }

        mostrarAlerta(mensaje);
    }

    async function cargarDashboard() {
        mostrarEstadoCarga();

        try {
            const resumen = await DashboardService.obtenerResumen();
            if (!resumen || typeof resumen !== 'object') {
                throw new Error('El servidor no devolvió datos del panel principal.');
            }

            estado.resumen = resumen;
            estado.apiDisponible = true;

            renderMetricas(resumen);
            renderCitasRecientes(resumen.citasRecientes || []);
            renderEstudiantesRecientes(resumen.estudiantesRecientes || []);
            renderResumenIA(resumen.resumenIA || resumen.resumen || '', resumen);
        } catch (error) {
            const status = error?.status;
            const esErrorAutenticacion = status === 401;
            const esErrorPermisos = status === 403;
            const esErrorServidor = status >= 500;

            if (esErrorAutenticacion) {
                throw error;
            }

            // Sin respaldo que descargue todas las tablas: si el servidor falla, cargarlo más lo empeora
            estado.apiDisponible = false;
            const baseUrl = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : (window.API_BASE_URL || 'servidor');
            let mensaje;

            if (esErrorPermisos) {
                mensaje = 'Acceso denegado: Permisos insuficientes.';
            } else if (esErrorServidor) {
                mensaje = `Error interno del servidor (${status}). Mostrando valores en cero.`;
            } else {
                mensaje = `No se pudo conectar con el servidor en ${baseUrl}. Mostrando valores en cero.`;
            }
            aplicarEstadoError(mensaje);
        }
    }

    function iniciar() {
        const parametros = new URLSearchParams(window.location.search);
        if (parametros.get('bienvenida') === '1') {
            if (typeof Notif !== 'undefined' && Notif.exito) {
                Notif.exito('Bienvenido al sistema');
            }
            parametros.delete('bienvenida');
            const consulta = parametros.toString();
            history.replaceState(null, document.title, window.location.pathname + (consulta ? `?${consulta}` : '') + window.location.hash);
        }

        cargarDashboard();

        const buscador = el('searchRecentStudents');
        if (buscador) {
            buscador.addEventListener('input', () => {
                renderEstudiantesRecientes();
            });
        }
    }

    iniciar();
});
