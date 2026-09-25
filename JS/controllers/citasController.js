
document.addEventListener('DOMContentLoaded', () => {

    const estado = {
        citas: [],
        estudiantes: [],
        psicologos: [],
        expedientes: [],
        filtro: 'todas',
        textoBusqueda: '',
        modoEdicion: false,
        idEnEdicion: null,
        usuarioSesion: null,
        psicologoLogueado: null
    };

    async function obtenerUsuarioSesion() {
        if (typeof verificarSesion === 'function') {
            return await verificarSesion();
        }
        try {
            const respuesta = await fetch((window.AUTH_API_URL || 'http://localhost:8081/api/auth') + '/me', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
            if (respuesta.ok) return await respuesta.json();
        } catch (e) { }
        return null;
    }

    const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

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


    function idCita(cita) {
        return cita.idCita ?? cita.id;
    }

    function nombreEstudiante(cita) {
        const est = cita.estudiante;
        if (est && typeof est === 'object') {
            return `${est.nombre ?? est.nombres ?? ''} ${est.apellido ?? est.apellidos ?? ''}`.trim();
        }
        return est || cita.nombreEstudiante || 'Sin estudiante';
    }

    function carnetEstudiante(cita) {
        const est = cita.estudiante;
        const carnet = est && typeof est === 'object' ? (est.carnet ?? est.codigoCarnet) : null;
        return carnet ?? cita.carnetEstudiante ?? cita.carnet ?? '';
    }

    function nombrePsicologo(cita) {
        const psi = cita.psicologo;
        if (psi && typeof psi === 'object') {
            return psi.nombre ?? psi.nombresCompletos ?? `${psi.nombres ?? ''} ${psi.apellidos ?? ''}`.trim();
        }
        return psi || cita.nombrePsicologo || 'Sin psicólogo';
    }

    function fechaCita(cita) {
        return String(cita.fecha ?? cita.fechaHoraCita ?? '').split('T')[0];
    }

    function horaCita(cita) {
        if (cita.hora) return String(cita.hora).substring(0, 5);
        const texto = String(cita.fechaHoraCita ?? '');
        return texto.includes('T') ? texto.split('T')[1].substring(0, 5) : '';
    }

    function estadoCita(cita) {
        return String(cita.estado ?? cita.estadoConfirmacion ?? '').toUpperCase();
    }

    function motivoCita(cita) {
        return cita.motivo ?? cita.observaciones ?? '';
    }

    function formatearFechaLegible(fechaVal) {
        const partes = String(fechaVal ?? '').split('T')[0].split('-');
        if (partes.length !== 3) return fechaVal || 'Sin fecha';
        return `${partes[2]} ${MESES[parseInt(partes[1], 10) - 1] || ''} ${partes[0]}`;
    }

    function esProxima(cita) {
        const fecha = fechaCita(cita);
        if (!fecha) return false;
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const fechaInicio = new Date(fecha + 'T00:00:00');
        return !isNaN(fechaInicio.getTime()) && fechaInicio >= hoy;
    }

    function colorBarraEstado(estadoVal) {
        if (estadoVal === 'CONFIRMADA' || estadoVal === 'REALIZADA') return 'verde';
        if (estadoVal === 'PENDIENTE') return 'amarillo';
        return 'rojo';
    }

    function badgeEstado(estadoVal) {
        const e = String(estadoVal || '').toUpperCase();
        const mapa = {
            CONFIRMADA: ['confirmada', 'bi-check-circle-fill', 'Confirmada'],
            REALIZADA: ['realizada', 'bi-check2-all', 'Realizada'],
            PENDIENTE: ['pendiente', 'bi-clock-history', 'Pendiente'],
            CANCELADA: ['cancelada', 'bi-x-circle-fill', 'Cancelada']
        };
        const [clase, icono, texto] = mapa[e] || ['pendiente', 'bi-question-circle', e || 'Sin estado'];
        return `<span class="badge-cita-estado ${clase}"><i class="bi ${icono}"></i> ${escapeHTML(texto)}</span>`;
    }


    function actualizarMetricas() {
        const total = estado.citas.length;
        const confirmadas = estado.citas.filter(c => estadoCita(c) === 'CONFIRMADA').length;
        const pendientes = estado.citas.filter(c => estadoCita(c) === 'PENDIENTE').length;
        const canceladas = estado.citas.filter(c => estadoCita(c) === 'CANCELADA').length;

        if (el('totalCitas')) el('totalCitas').textContent = total;
        if (el('totalConfirmadas')) el('totalConfirmadas').textContent = confirmadas;
        if (el('totalPendientes')) el('totalPendientes').textContent = pendientes;
        if (el('totalCanceladas')) el('totalCanceladas').textContent = canceladas;
    }


    function aplicarFiltro(lista) {
        const texto = estado.textoBusqueda.toLowerCase();

        return (Array.isArray(lista) ? lista : []).filter(cita => {
            if (estado.usuarioSesion?.tipoUsuario === 'PSICOLOGO') {
                const psiLog = estado.psicologoLogueado;
                const idPsiCita = cita.psicologo?.idPsicologo ?? cita.psicologo?.id ?? cita.idPsicologo;
                const correoPsiCita = cita.psicologo?.usuario?.correo ?? cita.psicologo?.correo;

                let esPropietario = false;
                if (psiLog && idPsiCita) {
                    esPropietario = Number(idPsiCita) === Number(psiLog.idPsicologo ?? psiLog.id);
                }
                if (!esPropietario && correoPsiCita && estado.usuarioSesion?.correo) {
                    esPropietario = correoPsiCita.toLowerCase() === estado.usuarioSesion.correo.toLowerCase();
                }
                if (!esPropietario) return false;
            }

            const coincidePestana =
                estado.filtro === 'todas' ||
                (estado.filtro === 'pendientes' && estadoCita(cita) === 'PENDIENTE') ||
                (estado.filtro === 'canceladas' && estadoCita(cita) === 'CANCELADA') ||
                (estado.filtro === 'proximas' && esProxima(cita));
            if (!coincidePestana) return false;

            if (!texto) return true;
            const campos = `${nombreEstudiante(cita)} ${carnetEstudiante(cita)} ${nombrePsicologo(cita)}`.toLowerCase();
            return campos.includes(texto);
        });
    }

    function renderTabla(lista = estado.citas) {
        const tbody = el('tablaCitas');
        if (!tbody) return;

        const filtrados = aplicarFiltro(lista);

        tbody.innerHTML = '';
        if (el('contadorMostrados')) el('contadorMostrados').textContent = filtrados.length;

        if (filtrados.length === 0) {
            const mensaje = estado.citas.length > 0
                ? 'No se encontraron citas en esta categoría.'
                : 'No hay citas registradas en el sistema';
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-4 text-muted">
                        <i class="bi bi-calendar-x fs-1 mb-2 d-block opacity-50"></i>
                        ${mensaje}
                    </td>
                </tr>`;
            actualizarMetricas();
            return;
        }

        filtrados.forEach((cita, indice) => {
            const id = idCita(cita);
            const est = estadoCita(cita);
            const nombre = nombreEstudiante(cita);
            const hora = horaCita(cita);

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><div class="barra-estado ${colorBarraEstado(est)}"></div></td>
                <td class="fw-bold text-muted">#${indice + 1}</td>
                <td>
                    <div class="d-flex align-items-center gap-2">
                        <div class="student-avatar-badge">${escapeHTML(iniciales(nombre))}</div>
                        <span class="fw-semibold">${escapeHTML(nombre)}</span>
                    </div>
                </td>
                <td class="text-muted">${escapeHTML(carnetEstudiante(cita)) || '—'}</td>
                <td>${escapeHTML(nombrePsicologo(cita))}</td>
                <td>
                    <span class="d-inline-flex align-items-center gap-1">
                        <i class="bi bi-calendar3 text-muted"></i> ${escapeHTML(formatearFechaLegible(fechaCita(cita)))}
                        ${hora ? `&nbsp;·&nbsp;<i class="bi bi-clock text-muted"></i> ${escapeHTML(hora)}` : ''}
                    </span>
                </td>
                <td>${badgeEstado(est)}</td>
                <td class="text-center">
                    <div class="d-flex justify-content-center gap-1">
                        <button class="btn-accion-table btn-ver" onclick="verExpediente(${id})" title="Ver detalle de la cita">
                            <i class="bi bi-eye"></i>
                        </button>
                        <button class="btn-accion-table btn-editar" onclick="abrirModalEditarCita(${id})" title="Reprogramar / Editar cita">
                            <i class="bi bi-pencil-square"></i>
                        </button>
                        <button class="btn-accion-table btn-transferir" onclick="abrirModalTransferirCaso(${id})" title="Transferir caso del estudiante">
                            <i class="bi bi-arrow-left-right"></i>
                        </button>
                        ${est === 'PENDIENTE' ? `
                        <button class="btn-accion-table btn-confirmar" onclick="confirmarCita(${id})" title="Confirmar cita">
                            <i class="bi bi-check-circle-fill"></i>
                        </button>` : ''}
                        ${est !== 'CANCELADA' ? `
                        <button class="btn-accion-table btn-cancelar" onclick="cancelarCita(${id})" title="Cancelar cita">
                            <i class="bi bi-x-circle"></i>
                        </button>` : ''}
                        <button class="btn-accion-table btn-eliminar" onclick="eliminarCita(${id})" title="Eliminar cita del sistema">
                            <i class="bi bi-trash3"></i>
                        </button>
                    </div>
                </td>`;
            tbody.appendChild(tr);
        });

        actualizarMetricas();
    }


    function llenarSelect(select, lista, campoId, campoIdAlt, formateador) {
        if (!select) return;
        select.innerHTML = '<option value="" selected disabled>Seleccionar</option>';
        (Array.isArray(lista) ? lista : []).forEach(item => {
            const opt = document.createElement('option');
            opt.value = item[campoId] ?? item[campoIdAlt];
            opt.textContent = formateador(item);
            select.appendChild(opt);
        });
    }

    async function cargarSelectores() {
        try {
            const estudiantes = await EstudiantesService.listar();
            estado.estudiantes = Array.isArray(estudiantes) ? estudiantes : [];
            llenarSelect(el('estudianteSelect'), estado.estudiantes, 'idEstudiante', 'id', (est) => {
                const nombre = `${est.nombres ?? est.nombre ?? ''} ${est.apellidos ?? ''}`.trim();
                const carnet = est.codigoCarnet ?? est.carnet;
                return carnet ? `${nombre} (Carnet: ${carnet})` : nombre;
            });
        } catch (error) {
            const status = error?.status;
            if (status === 401) throw error;
            Notif.error(status === 403 ? 'Acceso denegado: Permisos insuficientes' : mensajeErrorAmigable(error), 'No se pudieron cargar los estudiantes');
        }

        try {
            const psicologos = await PsicologosService.listar();
            estado.psicologos = Array.isArray(psicologos) ? psicologos : [];
            llenarSelect(el('psicologoSelect'), estado.psicologos, 'idPsicologo', 'id', (psi) =>
                `${psi.nombresCompletos ?? psi.nombre ?? ''} ${psi.apellidosCompletos ?? ''}`.trim()
            );
        } catch (error) {
            const status = error?.status;
            if (status === 401) throw error;
            Notif.error(status === 403 ? 'Acceso denegado: Permisos insuficientes' : mensajeErrorAmigable(error), 'No se pudieron cargar los psicólogos');
        }

        try {
            if (typeof CasosTransferidosService !== 'undefined' && CasosTransferidosService.listarExpedientes) {
                const expedientes = await CasosTransferidosService.listarExpedientes();
                estado.expedientes = Array.isArray(expedientes) ? expedientes : [];
            }
        } catch (error) {
            console.warn('No se pudieron precargar los expedientes:', error);
        }
    }


    function limpiarErrores() {
        document.querySelectorAll('#formCrearCita .is-invalid')
            .forEach(c => c.classList.remove('is-invalid'));
        document.querySelectorAll('#formCrearCita .invalid-feedback')
            .forEach(fb => fb.remove());
    }

    function marcarError(id, mensaje) {
        const campo = el(id);
        if (!campo) return;
        campo.classList.add('is-invalid');
        let fb = campo.nextElementSibling;
        if (!fb || !fb.classList.contains('invalid-feedback')) {
            fb = document.createElement('div');
            fb.className = 'invalid-feedback';
            campo.parentNode.insertBefore(fb, campo.nextSibling);
        }
        fb.textContent = mensaje;
    }

    function validarFormulario() {
        let valido = true;

        if (!el('estudianteSelect').value) {
            marcarError('estudianteSelect', 'Seleccione el estudiante de la cita.');
            valido = false;
        }

        if (!el('psicologoSelect').value) {
            marcarError('psicologoSelect', 'Seleccione el psicólogo asignado.');
            valido = false;
        }

        const fecha = el('fechaCita').value;
        if (!fecha) {
            marcarError('fechaCita', 'La fecha de la cita es obligatoria.');
            valido = false;
        } else {
            const fechaObj = new Date(fecha + 'T00:00:00');
            if (isNaN(fechaObj.getTime())) {
                marcarError('fechaCita', 'Ingrese una fecha válida.');
                valido = false;
            } else {
                const estadoSel = el('estadoCita').value;
                if ((estadoSel === 'PENDIENTE' || estadoSel === 'CONFIRMADA') && fechaObj < new Date(new Date().toDateString())) {
                    marcarError('fechaCita', 'La fecha no puede ser anterior a hoy.');
                    valido = false;
                }
            }
        }

        const hora = el('horaCita').value;
        if (!hora) {
            marcarError('horaCita', 'La hora de la cita es obligatoria.');
            valido = false;
        } else if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) {
            marcarError('horaCita', 'Ingrese una hora válida en formato HH:MM.');
            valido = false;
        }

        if (!el('motivoCita').value.trim()) {
            marcarError('motivoCita', 'El motivo de consulta es obligatorio.');
            valido = false;
        }

        return valido;
    }

    function construirPayload() {
        return {
            estudiante: { idEstudiante: Number(el('estudianteSelect').value) },
            psicologo: { idPsicologo: Number(el('psicologoSelect').value) },
            fechaHoraCita: `${el('fechaCita').value}T${el('horaCita').value}:00`,
            estado: el('estadoCita').value,
            motivo: el('motivoCita').value.trim()
        };
    }


    function abrirModalCita() {
        const modal = new bootstrap.Modal(el('modalCrearCita'));
        modal.show();
    }

    function cerrarModalCita() {
        const modal = bootstrap.Modal.getInstance(el('modalCrearCita'));
        if (modal) modal.hide();
    }

    window.abrirModalAgregarCita = function () {
        estado.modoEdicion = false;
        estado.idEnEdicion = null;

        const form = el('formCrearCita');
        if (form) form.reset();
        limpiarErrores();

        el('citaId').value = '';
        el('estadoCita').value = 'PENDIENTE';

        const psiSel = el('psicologoSelect');
        if (psiSel) {
            if (estado.usuarioSesion?.tipoUsuario === 'PSICOLOGO' && estado.psicologoLogueado) {
                const idPsi = estado.psicologoLogueado.idPsicologo ?? estado.psicologoLogueado.id;
                psiSel.value = idPsi;
                psiSel.disabled = true;
            } else {
                psiSel.disabled = false;
            }
        }

        el('modalCrearCitaLabel').innerHTML =
            '<i class="bi bi-calendar-plus-fill text-primary"></i> <span>Programar Nueva Cita</span>';
        el('btnGuardarCita').innerHTML = '<i class="bi bi-check-lg"></i> Guardar Cita';

        abrirModalCita();
    };

    window.abrirModalEditarCita = function (id) {
        const cita = estado.citas.find(c => Number(idCita(c)) === Number(id));
        if (!cita) return;

        estado.modoEdicion = true;
        estado.idEnEdicion = id;
        limpiarErrores();

        el('citaId').value = id;
        el('estudianteSelect').value = cita.estudiante?.idEstudiante ?? '';
        el('psicologoSelect').value = cita.psicologo?.idPsicologo ?? '';
        el('fechaCita').value = fechaCita(cita);
        el('horaCita').value = horaCita(cita);
        el('estadoCita').value = estadoCita(cita) || 'PENDIENTE';
        el('motivoCita').value = motivoCita(cita);

        el('modalCrearCitaLabel').innerHTML =
            '<i class="bi bi-pencil-square text-primary"></i> <span>Reprogramar Cita</span>';
        el('btnGuardarCita').innerHTML = '<i class="bi bi-check2-circle"></i> Actualizar Cita';

        abrirModalCita();
    };

    window.verExpediente = function (id) {
        const cita = estado.citas.find(c => Number(idCita(c)) === Number(id));
        if (!cita) return;

        const nombre = nombreEstudiante(cita);
        const hora = horaCita(cita);

        el('expedienteModalTitulo').textContent = 'Detalle de la Cita';
        el('expedienteModalBody').innerHTML = `
            <div class="d-flex align-items-center gap-3 mb-4">
                <div class="student-avatar-badge" style="width: 50px; height: 50px; font-size: 1.2rem;">${escapeHTML(iniciales(nombre))}</div>
                <div>
                    <h4 class="mb-0 fw-bold text-dark">${escapeHTML(nombre)}</h4>
                    <p class="text-muted small mb-0">
                        Carnet: <span class="fw-semibold text-dark">${escapeHTML(carnetEstudiante(cita)) || '—'}</span>
                        &bull; Psicólogo: <span class="fw-semibold text-dark">${escapeHTML(nombrePsicologo(cita))}</span>
                    </p>
                </div>
            </div>
            <div class="card p-3 mb-3 border-0 bg-light">
                <h6 class="fw-bold mb-2 text-dark"><i class="bi bi-calendar-event me-2 text-primary"></i>Fecha y Hora Programada</h6>
                <p class="small text-muted mb-0">
                    <i class="bi bi-calendar3 me-1"></i>${escapeHTML(formatearFechaLegible(fechaCita(cita)))}
                    ${hora ? ` &nbsp;·&nbsp; <i class="bi bi-clock me-1"></i>${escapeHTML(hora)}` : ''}
                </p>
            </div>
            <div class="card p-3 mb-3 border-0 bg-light">
                <h6 class="fw-bold mb-2 text-dark"><i class="bi bi-flag-fill me-2 text-primary"></i>Estado de la Cita</h6>
                <div>${badgeEstado(estadoCita(cita))}</div>
            </div>
            <div class="card p-3 border-0 bg-light">
                <h6 class="fw-bold mb-2 text-dark"><i class="bi bi-chat-left-text me-2 text-primary"></i>Motivo de Consulta</h6>
                <p class="small text-muted mb-0" style="line-height: 1.6;">${escapeHTML(motivoCita(cita)) || 'Sin motivo registrado.'}</p>
            </div>`;

        const modal = new bootstrap.Modal(el('modalExpediente'));
        modal.show();
    };


    function mensajeErrorAmigable(error) {
        if (error?.errores) return Object.values(error.errores).join(' ');
        return error?.message || 'Ocurrió un error inesperado.';
    }

    async function recargarCitas() {
        try {
            const lista = await CitasService.listar();
            estado.citas = Array.isArray(lista) ? lista : [];
        } catch (error) {
            const status = error?.status;
            if (status === 401) {
                throw error;
            }
            estado.citas = [];
            let mensaje;
            if (status === 403) {
                mensaje = 'Acceso denegado: Permisos insuficientes para ver las citas.';
            } else if (status >= 500) {
                mensaje = 'Error interno del servidor al cargar las citas. Intente nuevamente más tarde.';
            } else {
                mensaje = 'No se pudieron cargar las citas en este momento';
            }
            Notif.error(mensaje);
        }
        renderTabla();
    }

    async function guardarFormulario() {
        limpiarErrores();
        if (!validarFormulario()) return;

        const payload = construirPayload();

        try {
            if (estado.modoEdicion && estado.idEnEdicion !== null) {
                await CitasService.actualizar(estado.idEnEdicion, payload);
                Notif.exito('¡Cita actualizada exitosamente!');
            } else {
                await CitasService.crear(payload);
                Notif.exito('¡Cita programada exitosamente!');
            }

            await recargarCitas();
            cerrarModalCita();
        } catch (error) {
            Notif.error(mensajeErrorAmigable(error), 'No se pudo guardar la cita');
        }
    }

    window.confirmarCita = async function (id) {
        const cita = estado.citas.find(c => Number(idCita(c)) === Number(id));
        if (!cita) return;

        const result = await Swal.fire({
            title: 'Confirmar Cita',
            text: `¿Desea confirmar la cita de ${nombreEstudiante(cita)} programada para el ${formatearFechaLegible(fechaCita(cita))}?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#0d6efd',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Sí, confirmar',
            cancelButtonText: 'Cancelar',
            allowOutsideClick: false,
            allowEscapeKey: false
        });

        if (!result.isConfirmed) return;

        try {
            await CitasService.cambiarEstado(id, 'CONFIRMADA', cita);
            await recargarCitas();
            Notif.exito('¡Cita confirmada exitosamente!');
        } catch (error) {
            Notif.error(mensajeErrorAmigable(error), 'No se pudo confirmar la cita');
        }
    };

    window.cargarCitas = recargarCitas;

    async function ejecutarCancelacionCita(idCitaTarget) {
        try {
            const citaObj = estado.citas.find(c => Number(idCita(c)) === Number(idCitaTarget));
            if (typeof CitasService !== 'undefined' && CitasService.cambiarEstado) {
                await CitasService.cambiarEstado(idCitaTarget, 'CANCELADA', citaObj);
            } else {
                await peticionApi(`/citas/${idCitaTarget}`, 'PUT', { estado: 'CANCELADA' });
            }

            if (typeof Swal !== 'undefined' && Swal.mixin) {
                const Toast = Swal.mixin({
                    toast: true,
                    position: 'top-start',
                    showConfirmButton: false,
                    timer: 3000,
                    timerProgressBar: true
                });
                Toast.fire({
                    icon: 'success',
                    title: 'Cita cancelada correctamente'
                });
            } else if (typeof Notif !== 'undefined' && Notif.exito) {
                Notif.exito('Cita cancelada correctamente');
            }

            await cargarCitas();
        } catch (error) {
            console.error('Error al ejecutar la cancelación de la cita:', error);
            if (typeof Notif !== 'undefined' && Notif.error) {
                Notif.error(mensajeErrorAmigable(error), 'No se pudo cancelar la cita');
            } else if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: error?.message || 'No se pudo cancelar la cita'
                });
            }
        }
    }

    window.ejecutarCancelacionCita = ejecutarCancelacionCita;

    window.cancelarCita = async function (idCita) {
        const result = await Swal.fire({
            title: 'Cancelar Cita',
            text: '¿Estás seguro de que deseas cancelar esta cita?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sí, cancelar',
            cancelButtonText: 'No, mantener',
            allowOutsideClick: false,
            allowEscapeKey: false
        });

        if (result.isConfirmed) {
            await ejecutarCancelacionCita(idCita);
        }
    };

    window.eliminarCita = async function (id) {
        const cita = estado.citas.find(c => Number(idCita(c)) === Number(id));
        if (!cita) return;

        const result = await Swal.fire({
            title: 'Eliminar Cita',
            text: `¿Está seguro de que desea eliminar la cita de ${nombreEstudiante(cita)} del sistema? Esta acción no se puede deshacer.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc3545',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
            allowOutsideClick: false,
            allowEscapeKey: false
        });

        if (!result.isConfirmed) return;

        try {
            await CitasService.eliminar(id);
            await recargarCitas();
            Notif.exito('¡Cita eliminada del sistema!');
        } catch (error) {
            Notif.error(mensajeErrorAmigable(error), 'No se pudo eliminar la cita');
        }
    };

    window.abrirModalTransferirCaso = async function (id) {
        const cita = estado.citas.find(c => Number(idCita(c)) === Number(id));
        if (!cita) return;

        const idEst = cita.estudiante?.idEstudiante ?? cita.estudiante?.id ?? cita.idEstudiante;
        const idPsiEmisor = cita.psicologo?.idPsicologo ?? cita.psicologo?.id ?? cita.idPsicologo;
        const nombreEst = nombreEstudiante(cita);
        const carnetEst = carnetEstudiante(cita);
        const psiActual = nombrePsicologo(cita);

        // Aseguramos tener los expedientes actualizados
        if (!estado.expedientes || estado.expedientes.length === 0) {
            try {
                if (typeof CasosTransferidosService !== 'undefined' && CasosTransferidosService.listarExpedientes) {
                    const exps = await CasosTransferidosService.listarExpedientes();
                    estado.expedientes = Array.isArray(exps) ? exps : [];
                }
            } catch (err) {
                console.warn('Error al obtener expedientes:', err);
            }
        }

        if (el('transferirCitaId')) el('transferirCitaId').value = id;
        if (el('transferirNombreEstudiante')) el('transferirNombreEstudiante').textContent = nombreEst;
        if (el('transferirCarnetEstudiante')) {
            el('transferirCarnetEstudiante').textContent = carnetEst ? `Carnet: ${carnetEst}` : 'Sin carnet';
        }
        if (el('transferirPsicologoActual')) el('transferirPsicologoActual').textContent = psiActual;

        const selDestino = el('selectPsicologoDestino');
        if (selDestino) {
            selDestino.innerHTML = '<option value="" selected disabled>Seleccionar psicólogo destino</option>';
            estado.psicologos.forEach(psi => {
                const psiId = psi.idPsicologo ?? psi.id;
                // Excluir al psicólogo emisor si es el mismo
                if (Number(psiId) !== Number(idPsiEmisor)) {
                    const opt = document.createElement('option');
                    opt.value = psiId;
                    opt.textContent = `${psi.nombresCompletos ?? psi.nombre ?? ''} ${psi.apellidosCompletos ?? ''}`.trim();
                    selDestino.appendChild(opt);
                }
            });
            selDestino.classList.remove('is-invalid');
        }

        const motivoInput = el('motivoTransferenciaCita');
        if (motivoInput) {
            motivoInput.value = '';
            motivoInput.classList.remove('is-invalid');
        }

        const modalEl = el('modalTransferir');
        if (modalEl) {
            const modal = new bootstrap.Modal(modalEl);
            modal.show();
        }
    };

    async function guardarTransferenciaCaso(e) {
        if (e) e.preventDefault();

        const citaId = el('transferirCitaId')?.value;
        const cita = estado.citas.find(c => Number(idCita(c)) === Number(citaId));
        if (!cita) {
            Notif.error('No se encontró la información de la cita para transferir.');
            return;
        }

        const idEstudiante = cita.estudiante?.idEstudiante ?? cita.estudiante?.id ?? cita.idEstudiante;
        const idPsicologoEmisor = cita.psicologo?.idPsicologo ?? cita.psicologo?.id ?? cita.idPsicologo;
        const idPsicologoDestino = el('selectPsicologoDestino')?.value;
        const motivo = el('motivoTransferenciaCita')?.value.trim();

        let valido = true;

        if (!idPsicologoDestino) {
            el('selectPsicologoDestino')?.classList.add('is-invalid');
            valido = false;
        } else {
            el('selectPsicologoDestino')?.classList.remove('is-invalid');
        }

        if (!motivo) {
            el('motivoTransferenciaCita')?.classList.add('is-invalid');
            valido = false;
        } else if (motivo.length > 500) {
            el('motivoTransferenciaCita')?.classList.add('is-invalid');
            Notif.error('El motivo de justificación no puede superar los 500 caracteres.');
            valido = false;
        } else {
            el('motivoTransferenciaCita')?.classList.remove('is-invalid');
        }

        if (!valido) return;

        // Validar que la cita tenga psicólogo asignado (psicologoOrigen es obligatorio en el DTO)
        if (!idPsicologoEmisor) {
            Notif.error('La cita no tiene un psicólogo asignado. No se puede transferir el caso.');
            return;
        }

        // Buscar el expediente asociado al estudiante
        let idExpediente = null;
        try {
            if (typeof CasosTransferidosService !== 'undefined' && CasosTransferidosService.listarExpedientes) {
                const exps = await CasosTransferidosService.listarExpedientes();
                estado.expedientes = Array.isArray(exps) ? exps : [];
            }
        } catch (err) {
            console.warn('Error al verificar expedientes:', err);
        }

        let expedienteEncontrado = estado.expedientes.find(exp => {
            const idEstExp = exp.estudiante?.idEstudiante ?? exp.estudiante?.id ?? exp.idEstudiante;
            return Number(idEstExp) === Number(idEstudiante);
        });

        if (expedienteEncontrado) {
            idExpediente = expedienteEncontrado.idExpediente ?? expedienteEncontrado.id;
        } else {
            // Si el estudiante no tiene expediente psicológico, se crea automáticamente para cumplir con la FK
            try {
                const nuevoExpediente = await CasosTransferidosService.crearExpediente({
                    estudiante: { idEstudiante: Number(idEstudiante) }
                });
                if (nuevoExpediente) {
                    idExpediente = nuevoExpediente.idExpediente ?? nuevoExpediente.id;
                    estado.expedientes.push(nuevoExpediente);
                }
            } catch (errExp) {
                console.error('No se pudo obtener o crear el expediente:', errExp);
                // No usar idEstudiante como fallback — son IDs diferentes en la base de datos
                Notif.error('El estudiante no tiene un expediente psicológico en el sistema y no se pudo crear uno automáticamente. Contacte al administrador.');
                return;
            }
        }

        if (!idExpediente) {
            Notif.error('El estudiante seleccionado no posee un expediente psicológico activo en el sistema.');
            return;
        }

        // DTO correspondiente a TranferenciaCasoDTO en Backend (/api/transferencias)
        const payload = {
            expediente: { idExpediente: Number(idExpediente) },
            psicologoOrigen: { idPsicologo: Number(idPsicologoEmisor) },
            motivoJustificacion: motivo,
            estadoAprobacion: 'PENDIENTE'
        };

        // psicologoDestino es opcional — solo se incluye si fue seleccionado
        if (idPsicologoDestino && Number(idPsicologoDestino) > 0) {
            payload.psicologoDestino = { idPsicologo: Number(idPsicologoDestino) };
        }

        const btnSubmit = el('btnConfirmarTransferencia');
        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Transferir Caso';
        }

        try {
            if (typeof CasosTransferidosService !== 'undefined' && CasosTransferidosService.crear) {
                await CasosTransferidosService.crear(payload);
            } else {
                await peticionApi('/transferencias', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
            }

            const modalInstance = bootstrap.Modal.getInstance(el('modalTransferir'));
            if (modalInstance) modalInstance.hide();

            Notif.exito('¡El caso ha sido transferido exitosamente a Casos Transferidos!');
        } catch (error) {
            console.error('Error al transferir caso:', error);
            Notif.error(mensajeErrorAmigable(error), 'No se pudo completar la transferencia del caso');
        } finally {
            if (btnSubmit) {
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = '<i class="bi bi-arrow-left-right"></i> Transferir Caso';
            }
        }
    }


    async function inicializar() {
        estado.usuarioSesion = await obtenerUsuarioSesion();
        await cargarSelectores();

        if (estado.usuarioSesion) {
            const u = estado.usuarioSesion;
            estado.psicologoLogueado = estado.psicologos.find(p => {
                const correoP = p.usuario?.correo ?? p.correo;
                const idU = p.usuario?.idUsuario;
                if (u.correo && correoP && correoP.toLowerCase() === u.correo.toLowerCase()) return true;
                if (u.idUsuario && idU && Number(idU) === Number(u.idUsuario)) return true;
                return false;
            });
        }

        await recargarCitas();
    }

    el('btnFlotanteCita')?.addEventListener('click', window.abrirModalAgregarCita);

    el('formCrearCita')?.addEventListener('submit', (e) => {
        e.preventDefault();
        guardarFormulario();
    });

    el('formTransferirCaso')?.addEventListener('submit', (e) => {
        e.preventDefault();
        guardarTransferenciaCaso(e);
    });

    document.querySelectorAll('#formCrearCita input, #formCrearCita select, #formTransferirCaso input, #formTransferirCaso select, #formTransferirCaso textarea').forEach(campo => {
        campo.addEventListener('input', () => {
            if (campo.classList.contains('is-invalid')) {
                campo.classList.remove('is-invalid');
                const fb = campo.nextElementSibling;
                if (fb && fb.classList.contains('invalid-feedback')) fb.remove();
            }
        });
    });

    el('buscarEstudiante')?.addEventListener('input', (e) => {
        estado.textoBusqueda = e.target.value.trim();
        renderTabla();
    });

    document.querySelectorAll('.citas-filter-nav .nav-link-custom').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.citas-filter-nav .nav-link-custom')
                .forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            estado.filtro = btn.dataset.filter;
            renderTabla();
        });
    });

    const hamburgerBtn = el('hamburgerBtn');
    const sidebar = document.querySelector('.sidebar');
    const overlay = el('sidebarOverlay');

    if (hamburgerBtn && sidebar && overlay) {
        hamburgerBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            overlay.classList.toggle('active');
            hamburgerBtn.innerHTML = sidebar.classList.contains('open') ? '<i class="bi bi-x"></i>' : '<i class="bi bi-list"></i>';
        });

        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
            hamburgerBtn.innerHTML = '<i class="bi bi-list"></i>';
        });
    }

    inicializar();
});