
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
        const partes = String(fechaVal ?? '').split('T')[0].split('-');
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
        return nombreDe(est.especialidad) || nombreDe(est.grado);
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

    function renderResumenIA(texto) {
        const parrafo = el('aiSummaryText');
        if (!parrafo) return;
        if (texto) {
            parrafo.textContent = texto;
        } else {
            parrafo.innerHTML = `Consulta el panel para obtener el resumen del estado actual de los estudiantes.`;
        }
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

    function mostrarAlerta(mensaje, esErrorServidor) {
        if (esErrorServidor) {
            Notif.error(mensaje, 'Error del servidor');
        } else {
            Notif.error(mensaje, 'No se pudo cargar el panel');
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

    function esMismoDia(fechaVal) {
        if (!fechaVal) return false;
        const fecha = new Date(fechaVal);
        if (isNaN(fecha.getTime())) return false;
        const hoy = new Date();
        return fecha.getFullYear() === hoy.getFullYear() &&
            fecha.getMonth() === hoy.getMonth() &&
            fecha.getDate() === hoy.getDate();
    }

    function normalizarEstudiantes(lista) {
        return (Array.isArray(lista) ? lista : []).map((est) => ({
            ...est,
            riesgo: (est.estadoClinico || '').toLowerCase() === 'prioritario'
                ? 'Alto'
                : (est.estadoClinico || '').toLowerCase() === 'en seguimiento'
                    ? 'Moderado'
                    : 'Bajo',
            estado: est.estadoClinico || est.estado || 'Sin estado'
        }));
    }

    async function cargarConteosIndividuales() {
        const [estudiantesRes, citasRes, sesionesRes] = await DashboardService.obtenerConteosParalelos();

        const estudiantes = normalizarEstudiantes(estudiantesRes.status === 'fulfilled' ? estudiantesRes.value : []);
        const citas = citasRes.status === 'fulfilled' && Array.isArray(citasRes.value) ? citasRes.value : [];
        const sesiones = sesionesRes.status === 'fulfilled' && Array.isArray(sesionesRes.value) ? sesionesRes.value : [];

        const resumen = {
            totalEstudiantes: estudiantes.length,
            citasHoy: citas.filter((cita) => esMismoDia(cita.fechaHoraCita)).length,
            riesgoAlto: estudiantes.filter((est) => est.riesgo === 'Alto').length,
            seguimientosPendientes: sesiones.filter((sesion) => (sesion.estadoEstudiante || '').toLowerCase() === 'seguimiento').length,
            sesionesTotales: sesiones.length,
            citasRecientes: citas.slice(0, 5),
            estudiantesRecientes: estudiantes.slice(0, 5),
            resumenIA: ''
        };

        estado.resumen = resumen;
        estado.apiDisponible = true;

        renderMetricas(resumen);
        renderCitasRecientes(resumen.citasRecientes);
        renderEstudiantesRecientes(resumen.estudiantesRecientes);
        renderResumenIA(resumen.resumenIA);
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
            renderCitasRecientes(resumen.citasRecientes);
            renderEstudiantesRecientes(resumen.estudiantesRecientes);
            renderResumenIA(resumen.resumenIA || resumen.resumen || '');
        } catch (error) {
            const status = error?.status;
            const esErrorAutenticacion = status === 401;
            const esErrorPermisos = status === 403;
            const esErrorServidor = status >= 500;

            if (esErrorAutenticacion) {
                throw error;
            }

            try {
                await cargarConteosIndividuales();
                if (esErrorPermisos) {
                    mostrarAlerta('Acceso denegado: Permisos insuficientes para ver el panel completo.', false);
                } else if (esErrorServidor) {
                    mostrarAlerta('Error interno del servidor. Mostrando datos parciales.', true);
                }
            } catch (errorSecundario) {
                estado.apiDisponible = false;
                let mensaje;
                if (esErrorPermisos) {
                    mensaje = 'Acceso denegado: Permisos insuficientes.';
                } else if (esErrorServidor) {
                    mensaje = `Error interno del servidor (${status}). Mostrando valores en cero.`;
                } else {
                    mensaje = `No se pudo conectar con el servidor en ${API_BASE_URL}. Mostrando valores en cero.`;
                }
                aplicarEstadoError(mensaje);
            }
        }
    }

    function iniciar() {
        const activarToast = sessionStorage.getItem('mostrarBienvenidaToast');
        if (activarToast === 'true') {
            Notif.exito('Bienvenido al sistema');
            sessionStorage.removeItem('mostrarBienvenidaToast');
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