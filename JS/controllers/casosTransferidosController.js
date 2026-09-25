
document.addEventListener('DOMContentLoaded', () => {

    const estado = {
        transferencias: [],
        estudiantes: [],
        psicologos: [],
        apiDisponible: false,
        filtroActual: 'todos',
        enEdicion: null,
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

    const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const ESTADOS_VALIDOS = ['PENDIENTE', 'APROBADA', 'RECHAZADA'];

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

    function obtenerIniciales(nombreCompleto) {
        if (!nombreCompleto) return 'CT';
        const partes = nombreCompleto.trim().split(' ');
        if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
        return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
    }

    function nombrePsicologo(psi) {
        if (!psi) return '';
        return `${psi.nombresCompletos ?? psi.nombres ?? ''} ${psi.apellidosCompletos ?? psi.apellidos ?? ''}`.trim() || 'Sin asignar';
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

    function adaptarTransferenciaApi(t) {
        // La API devuelve: expediente, psicologoOrigen, psicologoDestino, motivoJustificacion, estadoAprobacion
        const expediente = t.expediente || {};
        const est = expediente.estudiante || t.estudiante || {};
        const emisor = t.psicologoOrigen || t.psicologoEmisor || {};
        const destino = t.psicologoDestino || null;
        const nombreEst = `${est.nombres ?? ''} ${est.apellidos ?? ''}`.trim() || est.nombreCompleto || 'Sin estudiante';

        return {
            id: t.idTransferencia ?? t.id,
            // Para el formulario de edición necesitamos estos ids
            idExpediente: expediente.idExpediente ?? t.idExpediente,
            idEstudiante: est.idEstudiante ?? expediente.idEstudiante ?? t.idEstudiante,
            estudianteNombre: nombreEst,
            carnet: est.codigoCarnet ?? t.carnet ?? '',
            grado: est.grado?.nombreGrado ?? t.grado ?? '',
            seccion: est.seccion?.nombreSeccion ?? t.seccion ?? '',
            especialidad: est.especialidad?.nombreEspecialidad ?? t.especialidad ?? '',
            estadoClinico: est.estadoClinico ?? t.estadoClinico ?? 'Seguimiento',
            idPsicologoEmisor: emisor.idPsicologo ?? t.idPsicologoEmisor,
            psicologoEmisor: nombrePsicologo(emisor) || 'Sin asignar',
            idPsicologoDestino: destino?.idPsicologo ?? t.idPsicologoDestino,
            psicologoDestinoCorreo: destino?.usuario?.correo ?? destino?.correo,
            psicologoDestino: nombrePsicologo(destino) || '',
            institucionDestino: t.institucionDestino ?? '',
            fechaTransferencia: String(t.fechaTransferencia ?? '').slice(0, 10),
            // motivoJustificacion en el DTO del backend
            motivoTransferencia: t.motivoJustificacion ?? t.motivoTransferencia ?? '',
            notasTransferencia: t.notasTransferencia ?? t.situacionEstudiante ?? '',
            // estadoAprobacion en el DTO del backend
            estadoTransferencia: String(t.estadoAprobacion ?? t.estadoTransferencia ?? 'PENDIENTE').toUpperCase()
        };
    }

    function mensajeErrorAmigable(error) {
        const texto = String(error?.message ?? '').toUpperCase();

        if (texto.includes('ORA-00001') || /ya (existe|registrad)|duplicad|unique constraint/i.test(texto)) {
            return 'Ya existe un registro con esos datos. Verifique el estudiante o los valores ingresados.';
        }
        if (texto.includes('ORA-02291')) {
            return 'El estudiante o psicólogo seleccionado no existe en el sistema. Recargue la página e intente de nuevo.';
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

    function destinoLegible(c) {
        if (c.psicologoDestino) return `Psicólogo: ${c.psicologoDestino}`;
        if (c.institucionDestino) return `Institución: ${c.institucionDestino}`;
        return 'Por definir';
    }

    function renderBadgeClinico(estadoClinico) {
        const est = String(estadoClinico ?? '').toLowerCase();
        if (est === 'prioritario') {
            return `<span class="badge-estado prioritario"><i class="bi bi-star-fill"></i> Prioritario</span>`;
        }
        if (est === 'estable') {
            return `<span class="badge-estado estable"><i class="bi bi-circle-fill"></i> Estable</span>`;
        }
        return `<span class="badge-estado seguimiento"><i class="bi bi-triangle-fill"></i> Seguimiento</span>`;
    }

    function datosBadgeTransferencia(estadoTransferencia) {
        if (estadoTransferencia === 'APROBADA') {
            return { clase: 'aceptado', texto: 'Caso Aprobado' };
        }
        if (estadoTransferencia === 'RECHAZADA') {
            return { clase: 'rechazado', texto: 'Transferencia Rechazada' };
        }
        return { clase: 'pendiente', texto: 'Pendiente de aceptación' };
    }

    function actualizarMetricas() {
        const total = estado.transferencias.length;
        const pendientes = estado.transferencias.filter(c => c.estadoTransferencia === 'PENDIENTE').length;
        const aceptados = estado.transferencias.filter(c => c.estadoTransferencia === 'APROBADA').length;

        if (el('metricTotalRecibidos')) el('metricTotalRecibidos').textContent = total;
        if (el('metricPendientes')) el('metricPendientes').textContent = pendientes;
        if (el('metricAceptados')) el('metricAceptados').textContent = aceptados;
    }

    function renderCasos() {
        const contenedor = el('contenedorCasosTransferidos');
        const noResults = el('noResultsTransferidos');
        const buscador = el('buscarTransferidoInput');

        if (!contenedor) return;
        contenedor.innerHTML = '';

        const texto = buscador ? buscador.value.toLowerCase().trim() : '';

        let lista = estado.transferencias.slice();

        if (estado.usuarioSesion?.tipoUsuario === 'PSICOLOGO') {
            const psiLog = estado.psicologoLogueado;
            lista = lista.filter(c => {
                let esDestino = false;
                if (psiLog && c.idPsicologoDestino) {
                    esDestino = Number(c.idPsicologoDestino) === Number(psiLog.idPsicologo ?? psiLog.id);
                }
                if (!esDestino && c.psicologoDestinoCorreo && estado.usuarioSesion?.correo) {
                    esDestino = c.psicologoDestinoCorreo.toLowerCase() === estado.usuarioSesion.correo.toLowerCase();
                }
                return esDestino;
            });
        }

        if (estado.filtroActual === 'pendientes') {
            lista = lista.filter(c => c.estadoTransferencia === 'PENDIENTE');
        } else if (estado.filtroActual === 'aceptados') {
            lista = lista.filter(c => c.estadoTransferencia === 'APROBADA');
        } else if (estado.filtroActual === 'rechazados') {
            lista = lista.filter(c => c.estadoTransferencia === 'RECHAZADA');
        }

        if (texto) {
            lista = lista.filter(c =>
                (c.estudianteNombre || '').toLowerCase().includes(texto) ||
                (c.carnet || '').toLowerCase().includes(texto) ||
                (c.psicologoEmisor || '').toLowerCase().includes(texto) ||
                (c.grado || '').toLowerCase().includes(texto) ||
                (c.motivoTransferencia || '').toLowerCase().includes(texto)
            );
        }

        if (lista.length === 0) {
            if (noResults) noResults.classList.remove('d-none');
            actualizarMetricas();
            return;
        }
        if (noResults) noResults.classList.add('d-none');

        lista.forEach(c => {
            const col = document.createElement('div');
            col.className = 'col-12 col-lg-6';

            const iniciales = obtenerIniciales(c.estudianteNombre);
            const badgeClinicoHTML = renderBadgeClinico(c.estadoClinico);
            const badgeTransfer = datosBadgeTransferencia(c.estadoTransferencia);

            let botonesHTML = '';
            if (c.estadoTransferencia === 'PENDIENTE') {
                botonesHTML = `
                    <div class="d-flex align-items-center justify-content-end gap-2 mt-3 pt-3 border-top w-100">
                        <button class="btn-rechazar" onclick="abrirConfirmarRechazo(${c.id})">
                            <i class="bi bi-x-circle"></i> Rechazar
                        </button>
                        <button class="btn-aceptar" onclick="aceptarCaso(${c.id})">
                            <i class="bi bi-check-circle-fill"></i> Aceptar Caso
                        </button>
                    </div>
                `;
            } else if (c.estadoTransferencia === 'APROBADA') {
                botonesHTML = `
                    <div class="d-flex align-items-center justify-content-between mt-3 pt-3 border-top w-100 flex-wrap gap-2">
                        <span class="text-success small fw-bold d-flex align-items-center gap-1">
                            <i class="bi bi-check2-all fs-5"></i> Caso en seguimiento activo
                        </span>
                        <button class="btn-ver-caso" onclick="verDetalleCaso(${c.id})">
                            <i class="bi bi-journal-text"></i> Ver Caso
                        </button>
                    </div>
                `;
            } else {
                botonesHTML = `
                    <div class="d-flex align-items-center justify-content-between mt-3 pt-3 border-top w-100">
                        <span class="text-danger small fw-bold d-flex align-items-center gap-1">
                            <i class="bi bi-slash-circle"></i> Transferencia declinada
                        </span>
                        <button class="btn btn-sm btn-outline-secondary" onclick="verDetalleCaso(${c.id})">
                            <i class="bi bi-info-circle"></i> Ver Detalles
                        </button>
                    </div>
                `;
            }

            const cardClass = c.estadoTransferencia === 'APROBADA' ? 'aceptado'
                : c.estadoTransferencia === 'RECHAZADA' ? 'rechazado' : 'pendiente';

            col.innerHTML = `
                <div class="card card-transferido ${cardClass} h-100">
                    <div>
                        <div class="d-flex justify-content-between align-items-start gap-2 mb-3">
                            <div class="d-flex align-items-center gap-3">
                                <div class="transfer-avatar">${iniciales}</div>
                                <div>
                                    <h5 class="fw-bold mb-0 text-dark">${escapeHTML(c.estudianteNombre)}</h5>
                                    <div class="small text-muted">
                                        <span>${escapeHTML(c.grado)} "${escapeHTML(c.seccion)}"</span> &bull;
                                        <span>Carnet: <strong>${escapeHTML(c.carnet)}</strong></span>
                                    </div>
                                </div>
                            </div>
                            <div class="d-flex flex-column align-items-end gap-2">
                                <span class="badge-transfer-status ${badgeTransfer.clase}">${badgeTransfer.texto}</span>
                                <div class="d-flex gap-1">
                                    <button class="btn btn-sm btn-outline-primary" title="Editar caso" onclick="abrirFormulario(${c.id})">
                                        <i class="bi bi-pencil"></i>
                                    </button>
                                    <button class="btn btn-sm btn-outline-danger" title="Eliminar caso" onclick="abrirConfirmarEliminar(${c.id})">
                                        <i class="bi bi-trash3"></i>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div class="d-flex align-items-center gap-2 mb-3 flex-wrap">
                            <span class="badge bg-light text-secondary border">${escapeHTML(c.especialidad)}</span>
                            ${badgeClinicoHTML}
                        </div>

                        <div class="motivo-box mb-3">
                            <div class="d-flex justify-content-between align-items-center mb-1">
                                <strong class="text-primary small">
                                    <i class="bi bi-person-badge me-1"></i>Derivado por: ${escapeHTML(c.psicologoEmisor)}
                                </strong>
                                <small class="text-muted"><i class="bi bi-calendar3 me-1"></i>${escapeHTML(formatearFechaDisplay(c.fechaTransferencia))}</small>
                            </div>
                            <div class="small">
                                <strong>Destino:</strong> ${escapeHTML(destinoLegible(c))}
                            </div>
                            <div class="small mt-2">
                                <strong>Motivo de derivación:</strong> ${escapeHTML(c.motivoTransferencia)}
                            </div>
                        </div>

                        <div class="small text-muted mb-2">
                            <strong>Situación actual:</strong> ${escapeHTML(c.notasTransferencia)}
                        </div>
                    </div>

                    ${botonesHTML}
                </div>
            `;
            contenedor.appendChild(col);
        });

        actualizarMetricas();
    }


    async function obtenerOCrearExpediente(idEstudiante) {
        try {
            const expedientes = await CasosTransferidosService.listarExpedientes();
            const existente = Array.isArray(expedientes)
                ? expedientes.find(exp => Number(exp.estudiante?.idEstudiante ?? exp.idEstudiante) === Number(idEstudiante))
                : null;
            if (existente) return existente.idExpediente;
        } catch (_) { /* continúa para crear */ }
        // Crear expediente si no existe
        const nuevo = await CasosTransferidosService.crearExpediente({
            estudiante: { idEstudiante: Number(idEstudiante) }
        });
        return nuevo.idExpediente;
    }

    async function construirPayloadDesdeFormulario(datos) {
        // Obtener o crear el expediente del estudiante (requisito del FK en BD)
        const idExpediente = await obtenerOCrearExpediente(datos.idEstudiante);

        // Construir payload alineado con TranferenciaCasoDTO
        const payload = {
            expediente: { idExpediente: Number(idExpediente) },
            psicologoOrigen: { idPsicologo: Number(datos.idPsicologoEmisor) },
            motivoJustificacion: datos.motivoTransferencia,
            estadoAprobacion: datos.estadoTransferencia
        };

        if (CasosTransferidosValidaciones.esIdValido(datos.idPsicologoDestino)) {
            payload.psicologoDestino = { idPsicologo: Number(datos.idPsicologoDestino) };
        }
        if (estado.enEdicion) {
            payload.idTransferencia = Number(estado.enEdicion);
        }
        return payload;
    }

    function construirPayloadDesdeRegistro(c) {
        // Payload alineado con TranferenciaCasoDTO del backend
        const payload = {
            idTransferencia: Number(c.id),
            expediente: { idExpediente: Number(c.idExpediente) },
            psicologoOrigen: { idPsicologo: Number(c.idPsicologoEmisor) },
            motivoJustificacion: c.motivoTransferencia,
            estadoAprobacion: c.estadoTransferencia
        };
        if (c.idPsicologoDestino) {
            payload.psicologoDestino = { idPsicologo: Number(c.idPsicologoDestino) };
        }
        return payload;
    }


    function cargarSelectoresFormulario() {
        const selEstudiante = el('selEstudianteTransferencia');
        const selEmisor = el('selPsicologoEmisorTransferencia');
        const selDestino = el('selPsicologoDestinoTransferencia');

        if (selEstudiante) {
            selEstudiante.innerHTML = '<option value="">Seleccionar estudiante</option>';
            estado.estudiantes.forEach(est => {
                const opt = document.createElement('option');
                opt.value = est.idEstudiante;
                opt.textContent = `${est.nombres ?? ''} ${est.apellidos ?? ''}`.trim()
                    + (est.codigoCarnet ? ` — ${est.codigoCarnet}` : '');
                selEstudiante.appendChild(opt);
            });
        }

        if (selEmisor) {
            selEmisor.innerHTML = '<option value="">Seleccionar psicólogo</option>';
            estado.psicologos.forEach(psi => {
                const opt = document.createElement('option');
                opt.value = psi.idPsicologo;
                opt.textContent = nombrePsicologo(psi);
                selEmisor.appendChild(opt);
            });
        }

        if (selDestino) {
            selDestino.innerHTML = '<option value="">No aplica (destino externo)</option>';
            estado.psicologos.forEach(psi => {
                const opt = document.createElement('option');
                opt.value = psi.idPsicologo;
                opt.textContent = nombrePsicologo(psi);
                selDestino.appendChild(opt);
            });
        }
    }


    function crearModalFormulario() {
        const modalEl = document.createElement('div');
        modalEl.className = 'modal fade';
        modalEl.id = 'modalFormTransferencia';
        modalEl.setAttribute('tabindex', '-1');
        modalEl.setAttribute('aria-labelledby', 'modalTransferenciaLabel');
        modalEl.setAttribute('aria-hidden', 'true');
        modalEl.innerHTML = `
            <div class="modal-dialog modal-lg modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title fw-bold d-flex align-items-center gap-2" id="modalTransferenciaLabel">
                            <i class="bi bi-arrow-left-right text-primary"></i>
                            <span>Registrar Transferencia de Caso</span>
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
                    </div>
                    <form id="formTransferencia" novalidate>
                        <div class="modal-body">
                            <div class="row g-3">
                                <div class="col-12 col-md-6">
                                    <label class="custom-form-label">Estudiante *</label>
                                    <select class="form-select" id="selEstudianteTransferencia"></select>
                                </div>
                                <div class="col-12 col-md-6">
                                    <label class="custom-form-label">Fecha de transferencia *</label>
                                    <input type="date" class="form-control" id="inputFechaTransferencia">
                                </div>
                                <div class="col-12 col-md-6">
                                    <label class="custom-form-label">Psicólogo que transfiere *</label>
                                    <select class="form-select" id="selPsicologoEmisorTransferencia"></select>
                                </div>
                                <div class="col-12 col-md-6">
                                    <label class="custom-form-label">Estado *</label>
                                    <select class="form-select" id="selectEstadoTransferencia">
                                        <option value="PENDIENTE">Pendiente</option>
                                        <option value="APROBADA">Aprobada</option>
                                        <option value="RECHAZADA">Rechazada</option>
                                    </select>
                                </div>
                                <div class="col-12 col-md-6">
                                    <label class="custom-form-label">Psicólogo de destino (interno)</label>
                                    <select class="form-select" id="selPsicologoDestinoTransferencia"></select>
                                </div>
                                <div class="col-12 col-md-6">
                                    <label class="custom-form-label">Institución / entidad externa de destino</label>
                                    <input type="text" class="form-control" id="inputInstitucionDestino"
                                        placeholder="Ej. Hospital San Rafael, Clínica Integral...">
                                </div>
                                <div class="col-12">
                                    <label class="custom-form-label">Motivo de la transferencia *</label>
                                    <textarea class="form-control" rows="3" id="textareaMotivoTransferencia"
                                        placeholder="Detalle la razón clínica por la que se transfiere el caso..."></textarea>
                                </div>
                                <div class="col-12">
                                    <label class="custom-form-label">Notas / situación del estudiante *</label>
                                    <textarea class="form-control" rows="3" id="textareaNotasTransferencia"
                                        placeholder="Diagnóstico y situación actual del estudiante..."></textarea>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-light" id="btnLimpiarFormTransferencia">Limpiar</button>
                            <button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancelar</button>
                            <button type="submit" class="btn btn-primary-custom" id="btnGuardarTransferencia">
                                <i class="bi bi-check2-circle"></i> Guardar Transferencia
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.appendChild(modalEl);
    }

    function limpiarErrores() {
        document.querySelectorAll('#formTransferencia .is-invalid')
            .forEach(c => c.classList.remove('is-invalid'));
        document.querySelectorAll('#formTransferencia .invalid-feedback')
            .forEach(fb => fb.remove());
    }

    function mostrarErrores(errores) {
        const mapa = {
            estudiante: 'selEstudianteTransferencia',
            psicologoEmisor: 'selPsicologoEmisorTransferencia',
            destino: 'inputInstitucionDestino',
            fecha: 'inputFechaTransferencia',
            motivo: 'textareaMotivoTransferencia',
            notas: 'textareaNotasTransferencia',
            estado: 'selectEstadoTransferencia'
        };

        Object.entries(errores).forEach(([campo, mensaje]) => {
            const id = mapa[campo];
            if (!id) return;
            const campoEl = el(id);
            if (!campoEl) return;

            campoEl.classList.add('is-invalid');
            let fb = campoEl.nextElementSibling;
            if (!fb || !fb.classList.contains('invalid-feedback')) {
                fb = document.createElement('div');
                fb.className = 'invalid-feedback';
                campoEl.parentNode.insertBefore(fb, campoEl.nextSibling);
            }
            fb.textContent = mensaje;
        });
    }

    function resetearFormulario() {
        const form = el('formTransferencia');
        if (form) form.reset();
        const estadoSelect = el('selectEstadoTransferencia');
        if (estadoSelect) estadoSelect.value = 'PENDIENTE';
        limpiarErrores();
        estado.enEdicion = null;
        const titulo = document.querySelector('#modalTransferenciaLabel span');
        if (titulo) titulo.textContent = 'Registrar Transferencia de Caso';
    }

    window.abrirFormulario = function (id) {
        estado.enEdicion = id || null;

        const c = id ? estado.transferencias.find(item => Number(item.id) === Number(id)) : null;

        const titulo = document.querySelector('#modalTransferenciaLabel span');
        if (titulo) titulo.textContent = c ? 'Editar Transferencia de Caso' : 'Registrar Transferencia de Caso';

        if (el('selEstudianteTransferencia')) el('selEstudianteTransferencia').value = c?.idEstudiante ?? '';
        if (el('selPsicologoEmisorTransferencia')) el('selPsicologoEmisorTransferencia').value = c?.idPsicologoEmisor ?? '';
        if (el('selPsicologoDestinoTransferencia')) el('selPsicologoDestinoTransferencia').value = c?.idPsicologoDestino ?? '';
        if (el('inputInstitucionDestino')) el('inputInstitucionDestino').value = c?.institucionDestino ?? '';
        if (el('inputFechaTransferencia')) el('inputFechaTransferencia').value = formatearFechaISO(c?.fechaTransferencia) || '';
        if (el('textareaMotivoTransferencia')) el('textareaMotivoTransferencia').value = c?.motivoTransferencia ?? '';
        if (el('textareaNotasTransferencia')) el('textareaNotasTransferencia').value = c?.notasTransferencia ?? '';
        if (el('selectEstadoTransferencia')) el('selectEstadoTransferencia').value = c?.estadoTransferencia ?? 'PENDIENTE';

        limpiarErrores();

        const modal = bootstrap.Modal.getOrCreateInstance(el('modalFormTransferencia'));
        modal.show();
    };

    async function recargarTransferencias() {
        try {
            const lista = await CasosTransferidosService.listar();
            estado.transferencias = Array.isArray(lista) ? lista.map(adaptarTransferenciaApi) : [];
        } catch (error) {
            Notif.error(mensajeErrorAmigable(error), 'No se pudo actualizar la lista de casos');
        }
        renderCasos();
    }

    async function manejarSubmit(e) {
        e.preventDefault();
        limpiarErrores();

        const datos = {
            idEstudiante: el('selEstudianteTransferencia')?.value,
            idPsicologoEmisor: el('selPsicologoEmisorTransferencia')?.value,
            idPsicologoDestino: el('selPsicologoDestinoTransferencia')?.value,
            institucionDestino: el('inputInstitucionDestino')?.value.trim(),
            fechaTransferencia: el('inputFechaTransferencia')?.value,
            motivoTransferencia: el('textareaMotivoTransferencia')?.value.trim(),
            notasTransferencia: el('textareaNotasTransferencia')?.value.trim(),
            estadoTransferencia: el('selectEstadoTransferencia')?.value || 'PENDIENTE'
        };

        const validacion = CasosTransferidosValidaciones.validarTransferencia(datos);
        if (!validacion.valido) {
            mostrarErrores(validacion.errores);
            return;
        }

        const btnGuardar = el('btnGuardarTransferencia');
        if (btnGuardar) { btnGuardar.disabled = true; btnGuardar.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Guardando...'; }

        try {
            // construirPayloadDesdeFormulario es async: obtiene/crea el expediente
            const payload = await construirPayloadDesdeFormulario(datos);

            if (estado.enEdicion) {
                await CasosTransferidosService.actualizar(estado.enEdicion, payload);
            } else {
                await CasosTransferidosService.crear(payload);
            }

            await recargarTransferencias();
            resetearFormulario();

            const modal = bootstrap.Modal.getInstance(el('modalFormTransferencia'));
            if (modal) modal.hide();

            Notif.exito('¡Transferencia de caso guardada exitosamente!');
        } catch (error) {
            Notif.error(mensajeErrorAmigable(error), 'No se pudo guardar la transferencia');
        } finally {
            if (btnGuardar) { btnGuardar.disabled = false; btnGuardar.innerHTML = '<i class="bi bi-check2-circle"></i> Guardar Transferencia'; }
        }
    }


    window.abrirConfirmarEliminar = function (id) {
        const c = estado.transferencias.find(item => Number(item.id) === Number(id));
        if (!c) return;

        Notif.confirmarEliminar(
            'Eliminar Caso Transferido',
            `¿Desea eliminar la transferencia del caso de ${c.estudianteNombre}? Esta acción no se puede deshacer.`
        ).then(confirmado => {
            if (!confirmado) return;

            CasosTransferidosService.eliminar(id)
                .then(async () => {
                    await recargarTransferencias();
                    Notif.exito('¡Transferencia eliminada exitosamente!');
                })
                .catch(error => {
                    Notif.error(mensajeErrorAmigable(error), 'No se pudo completar la acción');
                });
        });
    };

    window.abrirConfirmarRechazo = function (id) {
        const c = estado.transferencias.find(item => Number(item.id) === Number(id));
        if (!c) return;

        Notif.confirmar(
            'Rechazar Transferencia',
            `¿Desea declinar la transferencia del caso de ${c.estudianteNombre}? El estado cambiará a RECHAZADA.`,
            'Sí, rechazar'
        ).then(confirmado => {
            if (!confirmado) return;

            const payload = construirPayloadDesdeRegistro({ ...c, estadoTransferencia: 'RECHAZADA' });
            CasosTransferidosService.actualizar(id, payload)
                .then(async () => {
                    await recargarTransferencias();
                    Notif.exito('¡Transferencia rechazada exitosamente!');
                })
                .catch(error => {
                    Notif.error(mensajeErrorAmigable(error), 'No se pudo completar la acción');
                });
        });
    };


    window.aceptarCaso = async function (id) {
        const c = estado.transferencias.find(item => Number(item.id) === Number(id));
        if (!c) return;

        const payload = construirPayloadDesdeRegistro({ ...c, estadoTransferencia: 'APROBADA' });

        try {
            await CasosTransferidosService.actualizar(id, payload);
            await recargarTransferencias();
            Notif.exito(`¡Caso de ${c.estudianteNombre} aprobado con éxito! Ahora puedes gestionarlo como caso activo.`);
        } catch (error) {
            Notif.error(mensajeErrorAmigable(error), 'No se pudo aprobar el caso');
        }
    };


    window.verDetalleCaso = function (id) {
        const c = estado.transferencias.find(item => Number(item.id) === Number(id));
        if (!c) return;

        const modalTitle = el('modalCasoTitle');
        if (modalTitle) modalTitle.textContent = `Expediente: ${c.estudianteNombre}`;

        const modalBody = el('modalCasoBody');
        if (modalBody) {
            modalBody.innerHTML = `
                <div class="row g-3">
                    <div class="col-12 col-md-4 text-center border-end">
                        <div class="transfer-avatar mx-auto mb-2" style="width:70px; height:70px; font-size:1.6rem;">${obtenerIniciales(c.estudianteNombre)}</div>
                        <h5 class="fw-bold mb-1 text-dark">${escapeHTML(c.estudianteNombre)}</h5>
                        <p class="text-muted small mb-2">${escapeHTML(c.grado)} "${escapeHTML(c.seccion)}"</p>
                        <div class="mb-2">${renderBadgeClinico(c.estadoClinico)}</div>
                        <span class="badge bg-light text-dark border">Carnet: ${escapeHTML(c.carnet)}</span>
                    </div>
                    <div class="col-12 col-md-8">
                        <h6 class="fw-bold text-primary mb-2"><i class="bi bi-info-circle me-1"></i>Información del Caso Transferido</h6>
                        <div class="p-3 bg-light rounded-3 mb-3 border">
                            <p class="mb-1 small"><strong>Psicólogo que transfiere:</strong> ${escapeHTML(c.psicologoEmisor)}</p>
                            <p class="mb-1 small"><strong>Destino:</strong> ${escapeHTML(destinoLegible(c))}</p>
                            <p class="mb-1 small"><strong>Fecha de derivación:</strong> ${escapeHTML(formatearFechaDisplay(c.fechaTransferencia))}</p>
                            <p class="mb-1 small"><strong>Estado:</strong>
                                <span class="badge-transfer-status ${datosBadgeTransferencia(c.estadoTransferencia).clase}">${datosBadgeTransferencia(c.estadoTransferencia).texto}</span>
                            </p>
                            <hr class="my-2">
                            <p class="mb-1 small"><strong>Motivo clínico:</strong> ${escapeHTML(c.motivoTransferencia)}</p>
                            <p class="mb-0 small"><strong>Diagnóstico y situación:</strong> ${escapeHTML(c.notasTransferencia)}</p>
                        </div>
                        <div class="d-flex justify-content-end gap-2 flex-wrap">
                            <button class="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1" onclick="abrirFormulario(${c.id})">
                                <i class="bi bi-pencil"></i> Editar Caso
                            </button>
                            <a href="seguimientos.html" class="btn btn-primary btn-sm d-inline-flex align-items-center gap-1">
                                <i class="bi bi-graph-up-arrow"></i> Ir a Seguimiento de Casos
                            </a>
                            <a href="citas.html" class="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1">
                                <i class="bi bi-calendar3-event"></i> Programar Cita
                            </a>
                        </div>
                    </div>
                </div>
            `;
        }

        const modal = bootstrap.Modal.getOrCreateInstance(el('modalDetalleCaso'));
        modal.show();
    };


    async function cargarDatos() {
        estado.usuarioSesion = await obtenerUsuarioSesion();

        try {
            const [transferencias, estudiantes, psicologos] = await Promise.all([
                CasosTransferidosService.listar(),
                CasosTransferidosService.listarEstudiantes(),
                CasosTransferidosService.listarPsicologos()
            ]);
            estado.transferencias = Array.isArray(transferencias) ? transferencias.map(adaptarTransferenciaApi) : [];
            estado.estudiantes = Array.isArray(estudiantes) ? estudiantes : [];
            estado.psicologos = Array.isArray(psicologos) ? psicologos : [];
            estado.apiDisponible = true;

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
        } catch (error) {
            const status = error?.status;
            if (status === 401) {
                throw error;
            }
            estado.apiDisponible = false;
            let mensaje;
            if (status === 403) {
                mensaje = 'Acceso denegado: Permisos insuficientes para ver los casos transferidos.';
            } else if (status >= 500) {
                mensaje = 'Error interno del servidor al cargar los casos transferidos. Intente nuevamente más tarde.';
            } else {
                mensaje = 'No se pudo conectar con el servidor';
            }
            Notif.error(mensaje);
        }
        cargarSelectoresFormulario();
        renderCasos();
    }

    function iniciar() {
        crearModalFormulario();

        cargarDatos();

        const tabs = document.querySelectorAll('.citas-filter-nav .nav-link-custom');
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                estado.filtroActual = tab.dataset.filtro || 'todos';
                renderCasos();
            });
        });

        const buscador = el('buscarTransferidoInput');
        if (buscador) {
            buscador.addEventListener('input', renderCasos);
        }

        el('formTransferencia')?.addEventListener('submit', manejarSubmit);
        el('btnLimpiarFormTransferencia')?.addEventListener('click', resetearFormulario);

        document.querySelectorAll('#formTransferencia input, #formTransferencia select, #formTransferencia textarea')
            .forEach(campo => {
                campo.addEventListener('input', () => {
                    if (campo.classList.contains('is-invalid')) {
                        campo.classList.remove('is-invalid');
                        const fb = campo.nextElementSibling;
                        if (fb && fb.classList.contains('invalid-feedback')) fb.remove();
                    }
                });
            });

        const modalForm = el('modalFormTransferencia');
        if (modalForm) {
            modalForm.addEventListener('hidden.bs.modal', () => {
                resetearFormulario();
            });
        }

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
    }

    iniciar();
});