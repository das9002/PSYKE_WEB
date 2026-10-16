
document.addEventListener('DOMContentLoaded', () => {

    const estado = {
        expedientes: [],
        sesiones: [],
        psicologos: [],
        apiDisponible: false,
        expedienteSeleccionado: null,
        sesionEnEdicion: null,
        sesionesCargadas: false,
        filtroCaso: '',
        ordenCasos: 'actividad',
        historial: { texto: '', tipo: '', estado: '', orden: 'recientes' },
        citas: [],
        usuarioSesion: null
    };

    function idPsicologoDeSesion() {
        const usuario = estado.usuarioSesion;
        if (!usuario) return null;
        const psicologo = estado.psicologos.find(p => Number(p.usuario?.idUsuario) === Number(usuario.idUsuario));
        return psicologo ? psicologo.idPsicologo : null;
    }

    function fechaDeCita(cita) {
        return String(cita.fechaHoraCita ?? cita.fecha ?? '').split('T')[0];
    }

    function horaDeCita(cita) {
        const hora = String(cita.fechaHoraCita ?? '').split('T')[1] || '';
        return hora.slice(0, 5);
    }

    function describirFecha(fechaISO) {
        if (!fechaISO) return '';
        const hoy = SeguimientosValidaciones.hoyLocal();
        const ayer = new Date();
        ayer.setDate(ayer.getDate() - 1);
        const ayerISO = `${ayer.getFullYear()}-${String(ayer.getMonth() + 1).padStart(2, '0')}-${String(ayer.getDate()).padStart(2, '0')}`;
        if (fechaISO === hoy) return 'Hoy';
        if (fechaISO === ayerISO) return 'Ayer';
        return formatearFechaDisplay(fechaISO);
    }

    const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

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

    function obtenerIniciales(nombres, apellidos) {
        const n = (nombres || '').trim();
        const a = (apellidos || '').trim();
        if (!n && !a) return 'ES';
        return ((n ? n[0] : '') + (a ? a[0] : '')).toUpperCase();
    }

    function nombreEstudiante(est) {
        return `${est.nombres ?? ''} ${est.apellidos ?? ''}`.trim() || 'Sin estudiante';
    }

    function nombrePsicologo(psi) {
        return `${psi.nombresCompletos ?? ''} ${psi.apellidosCompletos ?? ''}`.trim();
    }

    function formatearFechaDisplay(fechaISO) {
        const partes = String(fechaISO ?? '').split('-');
        if (partes.length !== 3) return fechaISO || 'Sin fecha';
        return `${partes[2]} ${MESES[parseInt(partes[1], 10) - 1] || ''} ${partes[0]}`;
    }

    function formatearFechaISO(fecha) {
        const f = String(fecha ?? '').trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(f)) return f;
        const d = new Date(f);
        if (isNaN(d.getTime())) return '';
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function generarBadgeEstado(estadoVal) {
        const est = (estadoVal || '').toLowerCase();
        if (est === 'prioritario') {
            return `<span class="badge-estado prioritario"><i class="bi bi-star-fill"></i> Prioritario</span>`;
        }
        if (est === 'estable') {
            return `<span class="badge-estado estable"><i class="bi bi-circle-fill"></i> Estable</span>`;
        }
        return `<span class="badge-estado seguimiento"><i class="bi bi-triangle-fill"></i> Seguimiento</span>`;
    }

    function estadoDeTarjeta(expediente) {
        const sesiones = estado.sesiones
            .filter(s => Number(s.expediente?.idExpediente) === Number(expediente.idExpediente))
            .slice()
            .sort((a, b) => String(b.fechaAtencion ?? '').localeCompare(String(a.fechaAtencion ?? '')) || (b.idSesion - a.idSesion));
        if (sesiones.length > 0 && sesiones[0].estadoEstudiante) return sesiones[0].estadoEstudiante;

        const clinico = expediente.estudiante?.estadoClinico || 'En Seguimiento';
        if (clinico === 'Prioritario') return 'Prioritario';
        if (clinico === 'Estable') return 'Estable';
        return 'Seguimiento';
    }

    function obtenerUltimaSesion(idExpediente) {
        return estado.sesiones
            .filter(s => Number(s.expediente?.idExpediente) === Number(idExpediente))
            .slice()
            .sort((a, b) => String(b.fechaAtencion ?? '').localeCompare(String(a.fechaAtencion ?? '')) || (b.idSesion - a.idSesion))[0] || null;
    }

    function mensajeErrorAmigable(error) {
        const texto = String(error?.message ?? '').toUpperCase();

        if (texto.includes('ORA-00001') || /ya (existe|registrad)|duplicad|unique constraint|integridad/i.test(texto) || error?.status === 409) {
            return 'La operación viola una restricción de integridad. Verifique que la Cita Vinculada exista o que no esté duplicando el registro.';
        }
        if (texto.includes('ORA-02291')) {
            return 'El expediente, psicólogo o cita seleccionado no existe en el sistema. Recargue la página e intente de nuevo.';
        }
        if (texto.includes('ORA-02292')) {
            return 'No se puede eliminar el registro porque está relacionado con otros datos del sistema.';
        }
        if (texto.includes('ORA-01400') || texto.includes('ORA-01401') || texto.includes('ORA-12899')) {
            return 'Faltan campos obligatorios o algún valor excede la longitud permitida. Revise el formulario.';
        }
        if (error?.status === 400) {
            return `Revise los datos del formulario:\n${error.message}`;
        }
        if (error?.status === 404) {
            return 'El registro solicitado no fue encontrado. Puede que ya haya sido eliminado.';
        }
        if (error?.status === 500) {
            return 'Ocurrió un error interno en el servidor. Inténtelo de nuevo más tarde.';
        }
        if (error instanceof TypeError || !error?.status) {
            return `No se pudo conectar con el servidor. Verifique que el backend esté activo en ${API_BASE_URL}.`;
        }
        return error.message || 'Ocurrió un error inesperado.';
    }

    function esMiEstudiante(est) {
        if (!estado.misEstudiantes) return true;
        return estado.misEstudiantes.has(Number(est.idEstudiante));
    }

    async function cargarMisEstudiantes(usuario) {
        estado.misEstudiantes = null;
        if (usuario?.tipoUsuario !== 'PSICOLOGO') return;
        try {
            const respuesta = await SeguimientosService.misEstudiantes();
            if (respuesta && !respuesta.todos) {
                estado.misEstudiantes = new Set((respuesta.ids || []).map(Number));
            }
        } catch (error) {
            estado.misEstudiantes = null;
        }
    }

    const COLORES_CASO = ['#2F6DF6', '#059669', '#7C3AED', '#DB2777', '#D97706', '#0891B2', '#4F46E5', '#DC2626'];

    function sesionesDe(idExpediente) {
        return estado.sesiones
            .filter(s => Number(s.expediente?.idExpediente) === Number(idExpediente))
            .slice()
            .sort((a, b) => String(a.fechaAtencion ?? '').localeCompare(String(b.fechaAtencion ?? '')) || (a.idSesion - b.idSesion));
    }

    function proximaCitaDe(idEstudiante) {
        const ahora = new Date();
        return estado.citas
            .filter(c => Number(c.estudiante?.idEstudiante) === Number(idEstudiante))
            .filter(c => ['PENDIENTE', 'CONFIRMADA'].includes(String(c.estadoConfirmacion ?? '').toUpperCase()))
            .filter(c => new Date(c.fechaHoraCita) >= ahora)
            .sort((a, b) => String(a.fechaHoraCita).localeCompare(String(b.fechaHoraCita)))[0] || null;
    }

    function haceCuanto(fechaISO) {
        if (!fechaISO) return '';
        const dias = Math.round((new Date(SeguimientosValidaciones.hoyLocal() + 'T00:00:00') - new Date(String(fechaISO).split('T')[0] + 'T00:00:00')) / 86400000);
        if (dias <= 0) return 'hoy';
        if (dias === 1) return 'ayer';
        if (dias < 30) return `hace ${dias} días`;
        const meses = Math.round(dias / 30);
        return meses === 1 ? 'hace 1 mes' : `hace ${meses} meses`;
    }

    function resumenCaso(exp) {
        const sesiones = sesionesDe(exp.idExpediente);
        const ultima = sesiones[sesiones.length - 1] || null;
        return {
            exp,
            est: exp.estudiante || {},
            total: sesiones.length,
            ultima,
            critico: ultima?.marcadorCritico === 'SI',
            estadoCaso: estadoDeTarjeta(exp),
            proxima: proximaCitaDe(exp.estudiante?.idEstudiante)
        };
    }

    function coincideCaso(caso, texto) {
        if (!texto) return true;
        const est = caso.est;
        return [est.nombres, est.apellidos, `${est.nombres || ''} ${est.apellidos || ''}`, est.codigoCarnet,
            est.grado?.nombreGrado, est.seccion?.nombreSeccion, est.especialidad?.nombreEspecialidad]
            .some(v => String(v || '').toLowerCase().includes(texto));
    }

    function renderListaEstudiantes() {
        const contenedor = el('listaEstudiantesSeguimiento');
        const noResults = el('noResultsSeguimiento');
        const buscador = el('buscarSeguimientoInput');
        if (!contenedor) return;
        contenedor.innerHTML = '';

        const texto = buscador ? buscador.value.toLowerCase().trim() : '';
        const exps = typeof normalizarListado === 'function' ? normalizarListado(estado.expedientes) : (Array.isArray(estado.expedientes) ? estado.expedientes : (estado.expedientes?.content || []));
        const casos = exps.filter(exp => exp.estudiante && esMiEstudiante(exp.estudiante)).map(resumenCaso);

        const contar = (fn) => casos.filter(fn).length;
        const contadores = {
            Todos: casos.length,
            Prioritario: contar(c => c.estadoCaso === 'Prioritario'),
            Seguimiento: contar(c => c.estadoCaso === 'Seguimiento'),
            Estable: contar(c => c.estadoCaso === 'Estable'),
            Critico: contar(c => c.critico)
        };
        Object.entries(contadores).forEach(([clave, valor]) => {
            const span = el(`contadorCasos${clave}`);
            if (span) span.textContent = valor;
        });

        const filtro = estado.filtroCaso;
        let lista = casos
            .filter(c => coincideCaso(c, texto))
            .filter(c => !filtro || (filtro === 'critico' ? c.critico : c.estadoCaso === filtro));

        const peso = { Prioritario: 0, Seguimiento: 1, Estable: 2 };
        const criterios = {
            actividad: (a, b) => String(b.ultima?.fechaAtencion ?? '').localeCompare(String(a.ultima?.fechaAtencion ?? '')) || (b.ultima?.idSesion ?? 0) - (a.ultima?.idSesion ?? 0),
            prioridad: (a, b) => (b.critico - a.critico) || (peso[a.estadoCaso] ?? 3) - (peso[b.estadoCaso] ?? 3),
            nombre: (a, b) => `${a.est.apellidos} ${a.est.nombres}`.localeCompare(`${b.est.apellidos} ${b.est.nombres}`, 'es'),
            cita: (a, b) => String(a.proxima?.fechaHoraCita ?? '9999').localeCompare(String(b.proxima?.fechaHoraCita ?? '9999'))
        };
        lista.sort(criterios[estado.ordenCasos] || criterios.actividad);

        if (lista.length === 0) {
            if (noResults) {
                const mensaje = noResults.querySelector('p');
                if (mensaje) {
                    mensaje.textContent = texto || filtro
                        ? 'No hay casos que coincidan con la búsqueda o el filtro.'
                        : estado.misEstudiantes
                            ? 'Aún no tienes estudiantes a tu cargo. Cuando agendes una cita a un estudiante, su caso aparecerá aquí.'
                            : 'Todavía no hay casos en seguimiento.';
                }
                noResults.classList.remove('d-none');
            }
            return;
        }
        if (noResults) noResults.classList.add('d-none');

        lista.forEach((caso) => {
            const { est, total, ultima, critico, estadoCaso, proxima } = caso;
            const col = document.createElement('div');
            col.className = 'col-12 col-lg-6 col-xxl-4';
            const color = COLORES_CASO[Number(est.idEstudiante || 0) % COLORES_CASO.length];
            const [fechaProxima, horaProxima = ''] = proxima ? String(proxima.fechaHoraCita).split('T') : [];
            const proximaTexto = proxima ? formatearFechaDisplay(fechaProxima).replace(/\s\d{4}$/, '') : '';

            col.innerHTML = `
                <div class="caso-card estado-${estadoCaso.toLowerCase()}${critico ? ' critico' : ''}" role="button" tabindex="0"
                     onclick="abrirDetalleEstudiante(${est.idEstudiante})"
                     onkeydown="if(event.key==='Enter'){abrirDetalleEstudiante(${est.idEstudiante})}"
                     aria-label="Abrir el seguimiento de ${escapeHTML(nombreEstudiante(est))}">
                    <div class="caso-card-cabecera">
                        <div class="caso-avatar" style="background:${color}">${obtenerIniciales(est.nombres, est.apellidos)}</div>
                        <div class="caso-identidad">
                            <h5 class="caso-nombre">${escapeHTML(nombreEstudiante(est))}</h5>
                            <span class="caso-sub">${escapeHTML(est.grado?.nombreGrado ?? 'Sin grado')} "${escapeHTML(est.seccion?.nombreSeccion ?? '—')}" · Carnet ${escapeHTML(est.codigoCarnet ?? '')}</span>
                        </div>
                        ${generarBadgeEstado(estadoCaso)}
                    </div>
                    <div class="caso-etiquetas">
                        <span class="caso-especialidad">${escapeHTML(est.especialidad?.nombreEspecialidad ?? 'General')}</span>
                        ${critico ? '<span class="caso-alerta"><i class="bi bi-exclamation-triangle-fill"></i> Caso crítico</span>' : ''}
                    </div>
                    <div class="caso-datos">
                        <div><i class="bi bi-journal-text"></i><strong>${total}</strong><span>${total === 1 ? 'sesión' : 'sesiones'}</span></div>
                        <div><i class="bi bi-clock-history"></i><strong>${ultima ? escapeHTML(haceCuanto(ultima.fechaAtencion)) : '—'}</strong><span>última sesión</span></div>
                        <div class="${proxima ? 'con-cita' : ''}"><i class="bi bi-calendar-event"></i><strong>${proxima ? escapeHTML(proximaTexto) : 'Sin cita'}</strong><span>${proxima ? `cita · ${escapeHTML(horaProxima.slice(0, 5))}` : 'próxima cita'}</span></div>
                    </div>
                    ${ultima ? `<p class="caso-ultima-nota"><i class="bi bi-chat-left-quote"></i> ${escapeHTML(RegistroSesion.resumenNotas(ultima.notasAnotaciones, 110))}</p>` : '<p class="caso-ultima-nota vacia">Todavía no hay sesiones registradas.</p>'}
                    <div class="caso-pie">
                        <span>Ver seguimiento</span>
                        <i class="bi bi-arrow-right"></i>
                    </div>
                </div>
            `;
            contenedor.appendChild(col);
        });
    }


    async function cargarSesionesExpediente() {
        try {
            const sesiones = await SeguimientosService.listar();
            estado.sesiones = Array.isArray(sesiones) ? sesiones : [];
            estado.sesionesCargadas = true;
        } catch (error) {
            estado.sesiones = [];
            Notif.error(mensajeErrorAmigable(error), 'No se pudo cargar el historial de sesiones');
        }
    }

    window.abrirDetalleEstudiante = async function (idEstudiante) {
        const expediente = estado.expedientes.find(exp => Number(exp.estudiante?.idEstudiante) === Number(idEstudiante));
        if (!expediente) {
            Notif.informar('El estudiante seleccionado no tiene un expediente psicológico abierto.');
            return;
        }

        estado.expedienteSeleccionado = expediente;
        const est = expediente.estudiante || {};

        const elNombre = el('detNombre');
        const elGrado = el('detGrado');
        const elCarnet = el('detCarnet');
        const elEspecialidad = el('detEspecialidad');
        const elPsicologo = el('detPsicologo');
        const elAvatar = el('detAvatar');
        const elBadge = el('detBadgeEstado');
        const elResumen = el('resumenCasoTextarea');

        mostrarVista('cargando');
        if (!estado.sesionesCargadas) await cargarSesionesExpediente();
        const ultimaSesion = obtenerUltimaSesion(expediente.idExpediente);

        if (elNombre) elNombre.textContent = nombreEstudiante(est);
        if (elGrado) elGrado.textContent = `${est.grado?.nombreGrado ?? 'Sin grado'} - Sección "${est.seccion?.nombreSeccion ?? '—'}"`;
        if (elCarnet) elCarnet.textContent = est.codigoCarnet ?? '';
        if (elEspecialidad) elEspecialidad.textContent = est.especialidad?.nombreEspecialidad ?? 'General';
        if (elPsicologo) {
            const idPropio = idPsicologoDeSesion();
            const psiCuenta = idPropio ? estado.psicologos.find(p => Number(p.idPsicologo) === Number(idPropio)) : null;
            const psiACargo = psiCuenta || ultimaSesion?.psicologo;
            elPsicologo.textContent = psiACargo ? (nombrePsicologo(psiACargo) || 'Sin asignar') : 'Sin asignar';
        }
        if (elAvatar) elAvatar.textContent = obtenerIniciales(est.nombres, est.apellidos);
        if (elResumen) elResumen.value = expediente.resumenCaso ?? '';

        if (elBadge) {
            elBadge.className = '';
            elBadge.innerHTML = generarBadgeEstado(estadoDeTarjeta(expediente));
        }

        estado.historial = { texto: '', tipo: '', estado: '', orden: 'recientes' };
        [['buscarHistorialInput', ''], ['filtroHistorialTipo', ''], ['filtroHistorialEstado', ''], ['ordenHistorial', 'recientes']]
            .forEach(([id, valor]) => { if (el(id)) el(id).value = valor; });
        renderTablaHistorial();
        mostrarVista('detalle');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    function mostrarVista(nombre) {
        el('vista-lista-estudiantes')?.classList.toggle('d-none', nombre !== 'lista');
        el('vista-cargando-caso')?.classList.toggle('d-none', nombre !== 'cargando');
        el('vista-detalle-estudiante')?.classList.toggle('d-none', nombre !== 'detalle');
    }

    function volverALista() {
        mostrarVista('lista');
        estado.expedienteSeleccionado = null;
        renderListaEstudiantes();
    }

    function renderTablaHistorial() {
        const tbody = el('tablaHistorialBody');
        if (!tbody || !estado.expedienteSeleccionado) return;
        tbody.innerHTML = '';

        const cronologicas = sesionesDe(estado.expedienteSeleccionado.idExpediente);
        const numero = new Map(cronologicas.map((s, i) => [s.idSesion, i + 1]));
        const { texto, tipo, estado: estadoFiltro, orden } = estado.historial;
        const busqueda = texto.toLowerCase().trim();

        const sesiones = cronologicas
            .filter(s => !busqueda || `${s.tipoProceso || ''} ${RegistroSesion.resumenNotas(s.notasAnotaciones, 5000)}`.toLowerCase().includes(busqueda))
            .filter(s => !tipo
                || (tipo === 'con_cita' && s.cita?.idCita)
                || (tipo === 'sin_cita' && !s.cita?.idCita)
                || (tipo === 'critico' && s.marcadorCritico === 'SI'))
            .filter(s => !estadoFiltro || s.estadoEstudiante === estadoFiltro);
        if (orden !== 'antiguas') sesiones.reverse();

        const contador = el('contadorHistorial');
        if (contador) {
            contador.textContent = sesiones.length === cronologicas.length
                ? `${cronologicas.length} ${cronologicas.length === 1 ? 'sesión' : 'sesiones'}`
                : `${sesiones.length} de ${cronologicas.length} sesiones`;
        }

        if (sesiones.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td colspan="6" class="text-center text-muted py-4">
                    <i class="bi bi-clock-history fs-3 d-block mb-2 opacity-50"></i>
                    ${cronologicas.length ? 'No hay sesiones que coincidan con el filtro.' : 'Sin sesiones registradas para este estudiante.'}
                </td>
            `;
            tbody.appendChild(tr);
            return;
        }

        sesiones.forEach(s => {
            const tr = document.createElement('tr');
            if (s.marcadorCritico === 'SI') tr.classList.add('sesion-critica');
            const criticoHTML = s.marcadorCritico === 'SI'
                ? '<span class="badge bg-danger text-white"><i class="bi bi-exclamation-triangle-fill me-1"></i>Crítico</span>'
                : '<span class="badge bg-light text-muted border">Regular</span>';

            tr.innerHTML = `
                <td class="text-nowrap">
                    <span class="sesion-numero">Sesión ${numero.get(s.idSesion)}</span>
                    <div class="fw-semibold text-muted small"><i class="bi bi-calendar3 me-1"></i>${escapeHTML(formatearFechaDisplay(s.fechaAtencion))}</div>
                </td>
                <td>
                    <div class="fw-bold text-dark">${escapeHTML(s.tipoProceso ?? '')}</div>
                    ${s.cita?.idCita ? `<small class="text-primary fw-semibold d-block">Cita #${escapeHTML(s.cita.idCita)}</small>` : '<small class="text-muted fw-semibold d-block">Sin cita previa</small>'}
                    <small class="text-muted"><i class="bi bi-person me-1"></i>${escapeHTML(nombrePsicologo(s.psicologo))}</small>
                </td>
                <td>
                    <span class="d-inline-block text-truncate" style="max-width: 280px;" title="${escapeHTML(RegistroSesion.resumenNotas(s.notasAnotaciones, 400))}">
                        ${escapeHTML(RegistroSesion.resumenNotas(s.notasAnotaciones))}
                    </span>
                </td>
                <td>${generarBadgeEstado(s.estadoEstudiante)}</td>
                <td class="text-center">${criticoHTML}</td>
                <td class="text-center">
                    <div class="acciones">
                        <button class="btn-accion btn-ver" title="Ver detalle de la sesión" onclick="verDetalleSesion(${s.idSesion})">
                            <i class="bi bi-eye"></i>
                        </button>
                        <button class="btn-accion btn-editar" title="Editar la sesión" onclick="abrirEditarSesion(${s.idSesion})">
                            <i class="bi bi-pencil-square"></i>
                        </button>
                        <button class="btn-accion btn-eliminar" title="Eliminar la sesión" onclick="eliminarSesion(${s.idSesion})">
                            <i class="bi bi-trash3"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }


    window.verDetalleSesion = function (idSesion) {
        const s = estado.sesiones.find(item => Number(item.idSesion) === Number(idSesion));
        if (!s) return;

        const est = s.expediente?.estudiante || {};
        const cita = s.cita?.idCita ? `Cita #${s.cita.idCita}` : 'Atención sin cita previa';
        const marcador = s.marcadorCritico === 'SI' ? 'SÍ - Requiere intervención urgente' : 'NO - Caso regular';

        const modalEl = document.createElement('div');
        modalEl.className = 'modal fade';
        modalEl.setAttribute('tabindex', '-1');
        modalEl.setAttribute('aria-hidden', 'true');
        modalEl.innerHTML = `
            <div class="modal-dialog modal-lg modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h4 class="modal-title fw-bold d-flex align-items-center gap-2">
                            <i class="bi bi-eye text-primary"></i>
                            <span>Detalle de la Sesión</span>
                        </h4>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
                    </div>
                    <div class="modal-body">
                        <div class="d-flex align-items-center gap-3 mb-4">
                            <div class="student-avatar-badge" style="width: 50px; height: 50px; font-size: 1.2rem;">${obtenerIniciales(est.nombres, est.apellidos)}</div>
                            <div>
                                <h5 class="mb-0 fw-bold text-dark">${escapeHTML(nombreEstudiante(est))}</h5>
                                <small class="text-muted">Carnet: ${escapeHTML(est.codigoCarnet ?? '')}</small>
                            </div>
                        </div>
                        <div class="row g-3 small">
                            <div class="col-md-4"><strong>Fecha de atención:</strong><br>${escapeHTML(formatearFechaDisplay(s.fechaAtencion))}</div>
                            <div class="col-md-4"><strong>Psicólogo:</strong><br>${escapeHTML(nombrePsicologo(s.psicologo))}</div>
                            <div class="col-md-4"><strong>Cita vinculada:</strong><br>${escapeHTML(cita)}</div>
                            <div class="col-md-4"><strong>Estado:</strong><br>${generarBadgeEstado(s.estadoEstudiante)}</div>
                            <div class="col-md-4"><strong>Marcador crítico:</strong><br>${escapeHTML(marcador)}</div>
                            <div class="col-md-4"><strong>Tipo de proceso:</strong><br>${escapeHTML(s.tipoProceso ?? '')}</div>
                            <div class="col-12">
                                <strong>Notas de la sesión:</strong>
                                <div class="mt-2">${RegistroSesion.htmlNotas(s.notasAnotaciones)}</div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-light" data-bs-dismiss="modal">Cerrar</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalEl);
        const modal = new bootstrap.Modal(modalEl);
        modalEl.addEventListener('hidden.bs.modal', () => {
            modal.dispose();
            modalEl.remove();
        });
        modal.show();
    };


    function psicologoDeLaCuenta() {
        const id = idPsicologoDeSesion();
        const psi = id ? estado.psicologos.find(p => Number(p.idPsicologo) === Number(id)) : null;
        return psi ? { id: psi.idPsicologo, nombre: nombrePsicologo(psi) } : null;
    }

    function opcionesPsicologoParaRegistro(idActual) {
        const propio = psicologoDeLaCuenta();
        if (propio) return { psicologo: propio, psicologos: null };
        // El administrador no tiene psicólogo propio: elige a quién atribuir la sesión
        const lista = estado.psicologos.map(p => ({ id: p.idPsicologo, nombre: nombrePsicologo(p) }));
        const actual = lista.find(p => Number(p.id) === Number(idActual)) || lista[0] || null;
        return { psicologo: actual, psicologos: lista };
    }

    function citasParaVincular(idEstudiante) {
        const ahora = new Date();
        return estado.citas
            .filter(c => Number(c.estudiante?.idEstudiante) === Number(idEstudiante))
            .filter(c => String(c.estadoConfirmacion ?? '').toUpperCase() !== 'CANCELADA')
            .filter(c => new Date(c.fechaHoraCita) <= ahora)
            .sort((a, b) => String(b.fechaHoraCita).localeCompare(String(a.fechaHoraCita)))
            .map(c => {
                const fecha = fechaDeCita(c);
                return { id: c.idCita, fecha, texto: `Cita #${c.idCita} · ${formatearFechaDisplay(fecha)} · ${horaDeCita(c)}` };
            });
    }

    async function trasGuardarSesion(mensaje) {
        const expediente = estado.expedienteSeleccionado;
        await cargarSesionesExpediente();
        renderTablaHistorial();
        renderListaEstudiantes();
        const badge = el('detBadgeEstado');
        if (badge && expediente) {
            badge.className = '';
            badge.innerHTML = generarBadgeEstado(estadoDeTarjeta(expediente));
        }
        Notif.exito(mensaje, 'Seguimiento actualizado');
    }

    function abrirRegistroManual(sesionExistente) {
        const expediente = estado.expedienteSeleccionado;
        if (!expediente) {
            Notif.informar('Selecciona primero un estudiante.');
            return;
        }
        const est = expediente.estudiante || {};
        const editando = Boolean(sesionExistente);
        const { psicologo, psicologos } = opcionesPsicologoParaRegistro(sesionExistente?.psicologo?.idPsicologo);
        if (!psicologo) {
            Notif.advertencia('No se encontró el psicólogo de tu cuenta para registrar la sesión.', 'Falta el psicólogo');
            return;
        }
        const citas = citasParaVincular(est.idEstudiante);
        const citaActual = sesionExistente?.cita?.idCita;
        if (citaActual && !citas.some(c => Number(c.id) === Number(citaActual))) {
            citas.unshift({ id: citaActual, fecha: formatearFechaISO(sesionExistente.fechaAtencion), texto: `Cita #${citaActual}` });
        }

        RegistroSesion.abrir({
            modo: 'manual',
            estudiante: { nombre: nombreEstudiante(est), carnet: est.codigoCarnet, iniciales: obtenerIniciales(est.nombres, est.apellidos) },
            psicologo,
            psicologos,
            citasDisponibles: citas,
            estadoInicial: estadoDeTarjeta(expediente) || 'Seguimiento',
            claveBorrador: editando ? null : `manual_${expediente.idExpediente}`,
            inicial: editando ? {
                fecha: formatearFechaISO(sesionExistente.fechaAtencion),
                idCita: citaActual || '',
                tipo: sesionExistente.tipoProceso,
                estado: sesionExistente.estadoEstudiante,
                critico: sesionExistente.marcadorCritico === 'SI',
                notas: sesionExistente.notasAnotaciones || '',
                idPsicologo: sesionExistente.psicologo?.idPsicologo
            } : {},
            guardar: async (datos) => {
                const payload = {
                    expediente: { idExpediente: Number(expediente.idExpediente) },
                    psicologo: { idPsicologo: Number(datos.idPsicologo || psicologo.id) },
                    fechaAtencion: datos.fechaAtencion,
                    tipoProceso: datos.tipoProceso,
                    estadoEstudiante: datos.estadoEstudiante,
                    marcadorCritico: datos.marcadorCritico,
                    notasAnotaciones: datos.notasAnotaciones
                };
                if (datos.idCita) payload.cita = { idCita: Number(datos.idCita) };
                if (editando) {
                    await SeguimientosService.actualizar(sesionExistente.idSesion, payload);
                } else {
                    await SeguimientosService.crear(payload);
                }
                await trasGuardarSesion(editando ? 'Los cambios de la sesión se guardaron.' : 'La sesión quedó registrada en el seguimiento del caso.');
            }
        });
    }

    window.abrirEditarSesion = function (idSesion) {
        const sesion = estado.sesiones.find(item => Number(item.idSesion) === Number(idSesion));
        if (sesion) abrirRegistroManual(sesion);
    };

    window.eliminarSesion = async function (idSesion) {
        const confirmado = await Notif.confirmarEliminar(
            'Eliminar registro de sesión',
            '¿Desea eliminar este registro de sesión?'
        );
        if (!confirmado) return;

        try {
            await SeguimientosService.eliminar(idSesion);
            estado.sesiones = estado.sesiones.filter(item => Number(item.idSesion) !== Number(idSesion));
            renderTablaHistorial();
            renderListaEstudiantes();
            const badge = el('detBadgeEstado');
            if (badge && estado.expedienteSeleccionado) {
                badge.className = '';
                badge.innerHTML = generarBadgeEstado(estadoDeTarjeta(estado.expedienteSeleccionado));
            }
            Notif.exito('¡Registro de sesión eliminado exitosamente!');
        } catch (error) {
            Notif.error(mensajeErrorAmigable(error), 'No se pudo eliminar el registro');
        }
    };


    async function generarResumenConIA() {
        if (!estado.expedienteSeleccionado) {
            Notif.informar('Seleccione primero un estudiante para generar el resumen asistido con IA.');
            return;
        }

        const exp = estado.expedienteSeleccionado;
        const est = exp.estudiante || {};
        const nombre = nombreEstudiante(est) || 'Estudiante';
        const carnet = est.codigoCarnet || 'Sin carnet';
        const grado = `${est.grado?.nombreGrado ?? 'Sin grado'} "${est.seccion?.nombreSeccion ?? '—'}"`;
        const especialidad = est.especialidad?.nombreEspecialidad ?? 'General';
        const estadoActual = estadoDeTarjeta(exp) || 'Seguimiento';

        const textarea = el('resumenCasoTextarea');
        const valorActual = textarea ? textarea.value.trim() : '';

        let modoInsercion = 'reemplazar';
        if (valorActual) {
            if (typeof Swal !== 'undefined') {
                const decision = await Swal.fire({
                    title: '¿Cómo deseas aplicar el resumen?',
                    text: 'Ya existe un resumen en este expediente. ¿Deseas reemplazar el texto actual o agregarlo al final?',
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: '<i class="bi bi-arrow-repeat me-1"></i> Reemplazar',
                    denyButtonText: '<i class="bi bi-plus-circle me-1"></i> Agregar al final',
                    cancelButtonText: 'Cancelar',
                    showDenyButton: true,
                    confirmButtonColor: '#2F6DF6',
                    denyButtonColor: '#10b981',
                    cancelButtonColor: '#6b7280'
                });

                if (decision.isDismissed) return;
                modoInsercion = decision.isConfirmed ? 'reemplazar' : 'agregar';
            }
        }

        const btnIA = el('btnGenerarResumenIA');
        if (btnIA) {
            btnIA.disabled = true;
            btnIA.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span> Analizando caso...';
        }

        // Obtener sesiones cronológicas de este expediente
        const sesiones = estado.sesiones
            .filter(s => Number(s.expediente?.idExpediente) === Number(exp.idExpediente))
            .slice()
            .sort((a, b) => String(a.fechaAtencion ?? '').localeCompare(String(b.fechaAtencion ?? '')));

        // Resumen previo acotado (máximo 250 caracteres para no agotar el cupo de la API)
        const resumenPrevio = exp.resumenCaso
            ? (exp.resumenCaso.trim().length > 250 
                ? exp.resumenCaso.trim().slice(0, 247) + '...' 
                : exp.resumenCaso.trim())
            : '';

        // Construir detalle de sesiones optimizado (sin importar cuántas sesiones existan)
        let detalleSesiones = '';
        if (sesiones.length > 0) {
            const totalSesiones = sesiones.length;
            // Si hay muchas sesiones, incluimos la primera (caso base) y las últimas más recientes (hasta 6)
            let sesionesSeleccionadas = sesiones;
            let avisoCondensado = '';

            if (totalSesiones > 7) {
                const primera = sesiones[0];
                const ultimas = sesiones.slice(-6);
                sesionesSeleccionadas = [primera, ...ultimas];
                avisoCondensado = `\n(Nota: Hay un total de ${totalSesiones} sesiones registradas. Se presentan la sesión base y las últimas 6 más recientes para análisis).`;
            }

            detalleSesiones = sesionesSeleccionadas.map((s) => {
                const num = sesiones.indexOf(s) + 1;
                const fecha = formatearFechaDisplay(s.fechaAtencion);
                const tipo = s.tipoProceso || 'Sesión regular';
                const estSesion = s.estadoEstudiante || 'Regular';
                const critico = s.marcadorCritico === 'SI' ? 'SÍ (Crítico)' : 'NO';
                // Limitar notas por sesión a un tamaño seguro (máx. 140 caracteres)
                let notas = s.notasAnotaciones ? RegistroSesion.resumenNotas(s.notasAnotaciones, 140) : 'Sin notas registradas';
                return `Sesión ${num} (${fecha}): ${tipo} | Est: ${estSesion} | Crítico: ${critico}\nNotas: ${notas}`;
            }).join('\n\n') + avisoCondensado;
        } else {
            detalleSesiones = 'No se registran sesiones previas en el expediente aún. Este es el inicio del seguimiento del estudiante.';
        }

        let prompt = `Actúa como un psicólogo institucional y psicopedagógico experto en la plataforma Psyke.
Analiza la información del expediente clínico del estudiante y redacta un Resumen Asistido del Caso BREVE, OBJETIVO y SINTÉTICO (máximo 1200 caracteres en total, 2 a 3 párrafos cortos) para su ficha de seguimiento.

DATOS DEL ALUMNO:
- Nombre: ${nombre} | Carnet: ${carnet}
- Grado y Sección: ${grado} | Especialidad: ${especialidad}
- Estado Clínico Actual: ${estadoActual}
${resumenPrevio ? `- Antecedentes o notas previas resumidas: ${resumenPrevio}` : ''}

HISTORIAL DE INTERVENCIONES (${sesiones.length} sesiones en total):
${detalleSesiones}

INSTRUCCIONES CLÍNICAS DE REDACCIÓN:
Redacta una síntesis clínica compacta y profesional estructurada exactamente con estos 3 apartados:

SÍNTESIS CLÍNICA Y EVOLUCIÓN:
(1 párrafo breve con el motivo central, estado observado y evolución del estudiante a lo largo de las intervenciones).

FACTORES DE RIESGO O ATENCIÓN PRIORITARIA:
(2 a 3 líneas con puntos clave de vigilancia o si el caso está estable).

RECOMENDACIONES Y PLAN DE ACCIÓN:
(2 a 3 pautas psicopedagógicas concisas para el seguimiento).

REGLAS ESTRICTAS DE FORMATO Y EXTENSIÓN:
- La respuesta DEBE ser un resumen pequeño y sintético (máximo 1200 caracteres). No redactes textos extensos ni repetitivos.
- NO uses asteriscos (*), ni negritas (**), ni títulos con hashtag (#). Usa mayúsculas limpias para los títulos y texto en párrafos naturales sin viñetas de asterisco, ya que va directo a un textarea clínico.`;

        // Garantía estricta contra el límite de 4000 caracteres del backend
        if (prompt.length > 3700) {
            prompt = prompt.slice(0, 3700);
        }

        try {
            if (!window.aiService || typeof window.aiService.enviarPrompt !== 'function') {
                throw new Error('El servicio de IA no está disponible en este momento. Verifique la conexión.');
            }

            const respuesta = await window.aiService.enviarPrompt(prompt, []);

            let textoGenerado = '';
            if (respuesta && typeof respuesta === 'object') {
                if (respuesta.respuesta) textoGenerado = respuesta.respuesta;
                else if (respuesta.mensaje) textoGenerado = respuesta.mensaje;
                else if (respuesta.data) textoGenerado = respuesta.data;
            } else if (typeof respuesta === 'string') {
                textoGenerado = respuesta;
            }

            textoGenerado = (textoGenerado || '').trim();
            // Limpieza preventiva de caracteres markdown
            textoGenerado = textoGenerado
                .replace(/\*\*(.*?)\*\*/g, '$1')
                .replace(/\*(.*?)\*/g, '$1')
                .replace(/^#{1,6}\s+/gm, '')
                .trim();

            if (!textoGenerado) {
                throw new Error('La IA no devolvió un resumen para este caso.');
            }

            if (textarea) {
                if (modoInsercion === 'agregar' && valorActual) {
                    const fechaHoy = new Date().toLocaleDateString('es-ES');
                    const textoCombinado = valorActual + `\n\n--- ACTUALIZACIÓN CON IA (${fechaHoy}) ---\n` + textoGenerado;
                    if (textoCombinado.length > 4000) {
                        textarea.value = textoCombinado.slice(0, 4000);
                        Notif.alerta('El resumen acumulado superaba 4000 caracteres y fue ajustado al límite permitido.', 'Texto Ajustado');
                    } else {
                        textarea.value = textoCombinado;
                    }
                } else {
                    textarea.value = textoGenerado.slice(0, 4000);
                }

                textarea.classList.remove('ia-destello-actualizado');
                void textarea.offsetWidth;
                textarea.classList.add('ia-destello-actualizado');
                textarea.focus();
            }

            Notif.exito('¡Resumen clínico generado con IA! Revisa el texto y haz clic en "Guardar Resumen" para almacenarlo en el expediente.');
        } catch (error) {
            console.error('Error al generar resumen asistido con IA:', error);
            Notif.error(error.message || 'No se pudo generar el resumen asistido con IA.', 'Error de IA');
        } finally {
            if (btnIA) {
                btnIA.disabled = false;
                btnIA.innerHTML = '<i class="bi bi-stars"></i> Generar con IA';
            }
        }
    }

    async function guardarResumen() {
        if (!estado.expedienteSeleccionado) {
            Notif.informar('Seleccione primero un estudiante para guardar su resumen.');
            return;
        }

        const textarea = el('resumenCasoTextarea');
        const resumen = textarea ? textarea.value.trim() : '';
        const exp = estado.expedienteSeleccionado;
        const est = exp.estudiante || {};

        try {
            const actualizado = await SeguimientosService.actualizarExpediente(exp.idExpediente, {
                estudiante: { idEstudiante: est.idEstudiante },
                resumenCaso: resumen
            });
            exp.resumenCaso = actualizado?.resumenCaso ?? resumen;
            Notif.exito('¡Resumen clínico del caso guardado exitosamente!');
        } catch (error) {
            Notif.error(mensajeErrorAmigable(error), 'No se pudo guardar el resumen');
        }
    }


    async function recargarSesiones() {
        try {
            estado.sesiones = (await SeguimientosService.listar()) ?? [];
        } catch (error) {
            Notif.error(mensajeErrorAmigable(error), 'No se pudo actualizar el historial');
        }
    }

    async function cargarDatos() {
        const idEstudianteUrl = Number(new URLSearchParams(window.location.search).get('estudiante')) || null;
        // Si vienen desde Citas o Estudiantes se muestra de una vez que se está abriendo el caso, no la lista general
        if (idEstudianteUrl) mostrarVista('cargando');

        // Todo se pide a la vez; psicólogos y citas pueden terminar después sin bloquear la apertura del caso
        const pendientesSecundarios = Promise.all([
            SeguimientosService.listarPsicologos().catch(() => []),
            SeguimientosService.listarCitas().catch(() => [])
        ]);
        const sesionesListas = cargarSesionesExpediente();

        try {
            const [expedientes, usuario] = await Promise.all([
                SeguimientosService.listarExpedientes(),
                typeof verificarSesion === 'function' ? verificarSesion() : Promise.resolve(null)
            ]);
            estado.expedientes = expedientes ?? [];
            estado.usuarioSesion = usuario;
            await Promise.all([cargarMisEstudiantes(usuario), sesionesListas]);
            estado.apiDisponible = true;
        } catch (error) {
            const status = error?.status;
            if (status === 401) {
                throw error;
            }
            estado.apiDisponible = false;
            let mensaje;
            if (status === 403) {
                mensaje = 'Acceso denegado: Permisos insuficientes para ver los seguimientos.';
            } else if (status >= 500) {
                mensaje = 'Error interno del servidor al cargar los seguimientos. Intente nuevamente más tarde.';
            } else {
                mensaje = 'No se pudo conectar con el servidor';
            }
            Notif.error(mensaje);
        }

        if (idEstudianteUrl) {
            history.replaceState(null, document.title, window.location.pathname);
            let existe = estado.expedientes.some(exp => Number(exp.estudiante?.idEstudiante) === idEstudianteUrl);
            if (!existe && estado.apiDisponible) {
                try {
                    await SeguimientosService.abrirExpediente(idEstudianteUrl);
                    // Se vuelve a pedir la lista para tener los datos completos del estudiante
                    estado.expedientes = (await SeguimientosService.listarExpedientes()) ?? [];
                    existe = estado.expedientes.some(exp => Number(exp.estudiante?.idEstudiante) === idEstudianteUrl);
                } catch (error) {
                    Notif.error(mensajeErrorAmigable(error), 'No se pudo abrir el seguimiento');
                }
            }
            if (existe) {
                const [psicologos, citas] = await Promise.race([
                    pendientesSecundarios,
                    new Promise(resolve => setTimeout(() => resolve([null, null]), 1500))
                ]);
                if (psicologos) estado.psicologos = psicologos;
                if (citas) estado.citas = citas;
                await window.abrirDetalleEstudiante(idEstudianteUrl);
            } else {
                mostrarVista('lista');
            }
        }

        const [psicologos, citas] = await pendientesSecundarios;
        estado.psicologos = psicologos ?? [];
        estado.citas = citas ?? [];
        renderListaEstudiantes();
        if (estado.expedienteSeleccionado) {
            const elPsicologo = el('detPsicologo');
            const propio = psicologoDeLaCuenta();
            if (elPsicologo && propio) elPsicologo.textContent = propio.nombre;
        }
    }

    function abrirSesionSinCita() {
        const expediente = estado.expedienteSeleccionado;
        if (!expediente) {
            Notif.informar('Selecciona primero un estudiante.');
            return;
        }
        const idPsicologo = idPsicologoDeSesion() ?? obtenerUltimaSesion(expediente.idExpediente)?.psicologo?.idPsicologo;
        if (!idPsicologo) {
            Notif.advertencia('No se encontró el psicólogo de tu cuenta para registrar la sesión.', 'Falta el psicólogo');
            return;
        }
        const est = expediente.estudiante || {};
        RegistroSesion.abrir({
            estudiante: { nombre: nombreEstudiante(est), carnet: est.codigoCarnet, iniciales: obtenerIniciales(est.nombres, est.apellidos) },
            estadoInicial: estadoDeTarjeta(expediente) || 'Seguimiento',
            claveBorrador: `expediente_${expediente.idExpediente}`,
            guardar: async (datos) => {
                await SeguimientosService.crear({
                    expediente: { idExpediente: Number(expediente.idExpediente) },
                    psicologo: { idPsicologo: Number(idPsicologo) },
                    fechaAtencion: SeguimientosValidaciones.hoyLocal(),
                    tipoProceso: datos.tipoProceso,
                    estadoEstudiante: datos.estadoEstudiante,
                    marcadorCritico: datos.marcadorCritico,
                    notasAnotaciones: datos.notasAnotaciones
                });
                await trasGuardarSesion('La sesión quedó guardada en el seguimiento del caso.');
            }
        });
    }

    function iniciar() {
        cargarDatos();
        el('btnAbrirSesion')?.addEventListener('click', abrirSesionSinCita);
        el('btnRegistroManual')?.addEventListener('click', () => abrirRegistroManual(null));
        el('ordenCasos')?.addEventListener('change', (e) => {
            estado.ordenCasos = e.target.value;
            renderListaEstudiantes();
        });
        document.querySelectorAll('.casos-chips .caso-chip').forEach((chip) => {
            chip.addEventListener('click', () => {
                estado.filtroCaso = chip.dataset.filtro;
                document.querySelectorAll('.casos-chips .caso-chip').forEach(c => c.classList.toggle('activo', c === chip));
                renderListaEstudiantes();
            });
        });
        [['buscarHistorialInput', 'texto', 'input'], ['filtroHistorialTipo', 'tipo', 'change'], ['filtroHistorialEstado', 'estado', 'change'], ['ordenHistorial', 'orden', 'change']]
            .forEach(([id, clave, evento]) => {
                el(id)?.addEventListener(evento, (e) => {
                    estado.historial[clave] = e.target.value;
                    renderTablaHistorial();
                });
            });

        el('buscarSeguimientoInput')?.addEventListener('input', renderListaEstudiantes);
        el('btnVolverLista')?.addEventListener('click', volverALista);
        el('btnGenerarResumenIA')?.addEventListener('click', generarResumenConIA);
        el('btnGuardarResumen')?.addEventListener('click', guardarResumen);
        const hamburgerBtn = el('hamburgerBtn');
        const sidebar = document.querySelector('.sidebar');
        const overlay = el('sidebarOverlay');

        if (hamburgerBtn && sidebar && overlay) {
            hamburgerBtn.addEventListener('click', () => {
                sidebar.classList.toggle('open');
                overlay.classList.toggle('active');
            });

            overlay.addEventListener('click', () => {
                sidebar.classList.remove('open');
                overlay.classList.remove('active');
            });
        }
    }

    iniciar();
});
