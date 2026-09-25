
document.addEventListener('DOMContentLoaded', () => {

    const estado = {
        expedientes: [],
        sesiones: [],
        psicologos: [],
        apiDisponible: false,
        expedienteSeleccionado: null,
        sesionEnEdicion: null
    };

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

    function limpiarErrores() {
        document.querySelectorAll('#formNuevoRegistro .is-invalid')
            .forEach(c => c.classList.remove('is-invalid'));
        document.querySelectorAll('#formNuevoRegistro .invalid-feedback')
            .forEach(fb => fb.remove());
    }

    function mostrarErrores(errores) {
        const mapa = {
            fecha: 'fechaCitaSeg',
            proceso: 'procesoCitaSeg',
            observaciones: 'observacionCitaSeg',
            estado: 'estadoCitaSeg',
            psicologo: 'psicologoCitaSeg',
            cita: 'citaVinculadaSeg'
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


    function renderListaEstudiantes() {
        const contenedor = el('listaEstudiantesSeguimiento');
        const noResults = el('noResultsSeguimiento');
        const buscador = el('buscarSeguimientoInput');

        if (!contenedor) return;
        contenedor.innerHTML = '';

        const texto = buscador ? buscador.value.toLowerCase().trim() : '';

        const exps = typeof normalizarListado === 'function' ? normalizarListado(estado.expedientes) : (Array.isArray(estado.expedientes) ? estado.expedientes : (estado.expedientes?.content || []));
        let lista = exps.filter(exp => exp.estudiante);

        if (texto) {
            lista = lista.filter(exp => {
                const est = exp.estudiante || {};
                return (est.nombres || '').toLowerCase().includes(texto) ||
                    (est.apellidos || '').toLowerCase().includes(texto) ||
                    (est.codigoCarnet || '').toLowerCase().includes(texto) ||
                    (est.grado?.nombreGrado || '').toLowerCase().includes(texto) ||
                    (est.especialidad?.nombreEspecialidad || '').toLowerCase().includes(texto);
            });
        }

        if (lista.length === 0) {
            if (noResults) noResults.classList.remove('d-none');
            return;
        }
        if (noResults) noResults.classList.add('d-none');

        lista.forEach((exp) => {
            const est = exp.estudiante || {};
            const col = document.createElement('div');
            col.className = 'col-12 col-lg-6';

            const iniciales = obtenerIniciales(est.nombres, est.apellidos);
            const badgeHTML = generarBadgeEstado(estadoDeTarjeta(exp));

            col.innerHTML = `
                <div class="card p-3 card-estudiante-item h-100 d-flex flex-column justify-content-between">
                    <div class="d-flex align-items-start gap-3 mb-3">
                        <div class="student-avatar-large">${iniciales}</div>
                        <div class="flex-grow-1 min-w-0">
                            <h5 class="mb-1 fw-bold text-dark text-truncate">${escapeHTML(nombreEstudiante(est))}</h5>
                            <div class="small text-muted mb-2">
                                <span>${escapeHTML(est.grado?.nombreGrado ?? 'Sin grado')} "${escapeHTML(est.seccion?.nombreSeccion ?? '—')}"</span> &bull;
                                <span>Carnet: <strong class="text-dark">${escapeHTML(est.codigoCarnet ?? '')}</strong></span>
                            </div>
                            <div class="d-flex align-items-center gap-2 flex-wrap">
                                <span class="badge bg-light text-secondary border">${escapeHTML(est.especialidad?.nombreEspecialidad ?? 'General')}</span>
                                ${badgeHTML}
                            </div>
                        </div>
                    </div>
                    <div class="pt-2 border-top">
                        <button class="btn-ver-seguimiento w-100 justify-content-center" onclick="abrirDetalleEstudiante(${est.idEstudiante})">
                            <i class="bi bi-journal-text"></i> Ver seguimiento
                        </button>
                    </div>
                </div>
            `;
            contenedor.appendChild(col);
        });
    }


    async function cargarSesionesExpediente(idExpediente) {
        try {
            const sesiones = await SeguimientosService.listar();
            estado.sesiones = Array.isArray(sesiones) ? sesiones : [];
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
        const elAvatar = el('detAvatar');
        const elBadge = el('detBadgeEstado');
        const elResumen = el('resumenCasoTextarea');

        if (elNombre) elNombre.textContent = nombreEstudiante(est);
        if (elGrado) elGrado.textContent = `${est.grado?.nombreGrado ?? 'Sin grado'} - Sección "${est.seccion?.nombreSeccion ?? '—'}"`;
        if (elCarnet) elCarnet.textContent = est.codigoCarnet ?? '';
        if (elEspecialidad) elEspecialidad.textContent = est.especialidad?.nombreEspecialidad ?? 'General';
        if (elAvatar) elAvatar.textContent = obtenerIniciales(est.nombres, est.apellidos);
        if (elResumen) elResumen.value = expediente.resumenCaso ?? '';

        if (elBadge) {
            elBadge.className = '';
            elBadge.innerHTML = generarBadgeEstado(estadoDeTarjeta(expediente));
        }

        await cargarSesionesExpediente(expediente.idExpediente);

        const ultimaSesion = obtenerUltimaSesion(expediente.idExpediente);
        cargarSelectorPsicologo(ultimaSesion?.psicologo?.idPsicologo);
        renderTablaHistorial();

        const vistaLista = el('vista-lista-estudiantes');
        const vistaDetalle = el('vista-detalle-estudiante');
        if (vistaLista && vistaDetalle) {
            vistaLista.classList.add('d-none');
            vistaDetalle.classList.remove('d-none');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    function volverALista() {
        const vistaLista = el('vista-lista-estudiantes');
        const vistaDetalle = el('vista-detalle-estudiante');
        if (vistaLista && vistaDetalle) {
            vistaDetalle.classList.add('d-none');
            vistaLista.classList.remove('d-none');
        }
        estado.expedienteSeleccionado = null;
    }

    function cargarSelectorPsicologo(idSeleccionado = '') {
        const select = el('psicologoCitaSeg');
        if (!select) return;

        select.innerHTML = '<option value="">Seleccionar psicólogo</option>';
        estado.psicologos.forEach(psi => {
            const opt = document.createElement('option');
            opt.value = psi.idPsicologo;
            opt.textContent = nombrePsicologo(psi);
            if (String(idSeleccionado) === String(psi.idPsicologo)) opt.selected = true;
            select.appendChild(opt);
        });
    }

    function renderTablaHistorial() {
        const tbody = el('tablaHistorialBody');
        if (!tbody || !estado.expedienteSeleccionado) return;
        tbody.innerHTML = '';

        const sesiones = estado.sesiones
            .filter(s => Number(s.expediente?.idExpediente) === Number(estado.expedienteSeleccionado.idExpediente))
            .slice()
            .sort((a, b) => String(b.fechaAtencion ?? '').localeCompare(String(a.fechaAtencion ?? '')) || (b.idSesion - a.idSesion));

        if (sesiones.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td colspan="6" class="text-center text-muted py-4">
                    <i class="bi bi-clock-history fs-3 d-block mb-2 opacity-50"></i>
                    Sin sesiones registradas para este estudiante.
                </td>
            `;
            tbody.appendChild(tr);
            return;
        }

        sesiones.forEach(s => {
            const tr = document.createElement('tr');
            const badgeHTML = generarBadgeEstado(s.estadoEstudiante);
            const criticoHTML = s.marcadorCritico === 'SI'
                ? '<span class="badge bg-danger text-white"><i class="bi bi-exclamation-triangle-fill me-1"></i>Crítico</span>'
                : '<span class="badge bg-light text-muted border">Regular</span>';

            tr.innerHTML = `
                <td class="text-nowrap fw-semibold text-muted">
                    <i class="bi bi-calendar3 me-1"></i>${escapeHTML(formatearFechaDisplay(s.fechaAtencion))}
                </td>
                <td>
                    <div class="fw-bold text-dark">${escapeHTML(s.tipoProceso ?? '')}</div>
                    <small class="text-muted"><i class="bi bi-person me-1"></i>${escapeHTML(nombrePsicologo(s.psicologo))}</small>
                </td>
                <td>
                    <span class="d-inline-block text-truncate" style="max-width: 250px;" title="${escapeHTML(s.notasAnotaciones)}">
                        ${escapeHTML(s.notasAnotaciones)}
                    </span>
                </td>
                <td>${badgeHTML}</td>
                <td class="text-center">${criticoHTML}</td>
                <td class="text-center">
                    <div class="acciones">
                        <button class="btn-accion btn-ver" title="Ver Detalle" onclick="verDetalleSesion(${s.idSesion})">
                            <i class="bi bi-eye"></i>
                        </button>
                        <button class="btn-accion" title="Editar Registro" onclick="abrirEditarSesion(${s.idSesion})">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn-accion btn-eliminar" title="Eliminar Registro" onclick="eliminarSesion(${s.idSesion})">
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
        const cita = s.cita?.idCita ? `CIT-${s.cita.idCita}` : 'Sin cita vinculada';
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
                                <strong>Observaciones y notas clínicas:</strong>
                                <p class="text-muted mb-0 mt-1" style="white-space: pre-line;">${escapeHTML(s.notasAnotaciones ?? '')}</p>
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


    window.abrirEditarSesion = function (idSesion) {
        const s = estado.sesiones.find(item => Number(item.idSesion) === Number(idSesion));
        if (!s) return;

        estado.sesionEnEdicion = s.idSesion;

        const titulo = document.querySelector('#modalNuevoRegistroLabel span');
        if (titulo) titulo.textContent = 'Editar Registro de Sesión';

        const fechaInput = el('fechaCitaSeg');
        if (fechaInput) fechaInput.value = formatearFechaISO(s.fechaAtencion);
        if (el('estadoCitaSeg')) el('estadoCitaSeg').value = s.estadoEstudiante || 'Seguimiento';
        if (el('psicologoCitaSeg')) el('psicologoCitaSeg').value = s.psicologo?.idPsicologo ?? '';
        if (el('marcadorCriticoSeg')) el('marcadorCriticoSeg').value = s.marcadorCritico || 'NO';
        if (el('citaVinculadaSeg')) el('citaVinculadaSeg').value = s.cita?.idCita ? `CIT-${s.cita.idCita}` : '';
        if (el('procesoCitaSeg')) el('procesoCitaSeg').value = s.tipoProceso || '';
        if (el('observacionCitaSeg')) el('observacionCitaSeg').value = s.notasAnotaciones || '';

        const modal = bootstrap.Modal.getOrCreateInstance(el('modalNuevoRegistro'));
        modal.show();
    };


    window.eliminarSesion = function (idSesion) {
        Notif.confirmarEliminar(
            'Eliminar registro de sesión',
            '¿Desea eliminar este registro de sesión?'
        ).then(confirmado => {
            if (!confirmado) return;

            SeguimientosService.eliminar(idSesion)
                .then(() => {
                    estado.sesiones = estado.sesiones.filter(item => Number(item.idSesion) !== Number(idSesion));
                    renderTablaHistorial();
                    renderListaEstudiantes();
                    const badge = el('detBadgeEstado');
                    if (badge && estado.expedienteSeleccionado) {
                        badge.className = '';
                        badge.innerHTML = generarBadgeEstado(estadoDeTarjeta(estado.expedienteSeleccionado));
                    }
                    Notif.exito('¡Registro de sesión eliminado exitosamente!');
                })
                .catch(error => {
                    Notif.error(mensajeErrorAmigable(error), 'No se pudo eliminar el registro');
                });
        });
    };


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


    function extraerIdCita(textoCita) {
        const match = String(textoCita ?? '').match(/\d+/);
        return match ? parseInt(match[0], 10) : null;
    }

    function restaurarTituloModal() {
        const titulo = document.querySelector('#modalNuevoRegistroLabel span');
        if (titulo) titulo.textContent = 'Agregar Registro de Sesión';
    }

    function resetearFormulario() {
        const form = el('formNuevoRegistro');
        if (form) form.reset();
        const fechaInput = el('fechaCitaSeg');
        if (fechaInput) fechaInput.value = SeguimientosValidaciones.hoyLocal();
        limpiarErrores();
        estado.sesionEnEdicion = null;
        restaurarTituloModal();
    }

    async function recargarSesiones() {
        try {
            estado.sesiones = (await SeguimientosService.listar()) ?? [];
        } catch (error) {
            Notif.error(mensajeErrorAmigable(error), 'No se pudo actualizar el historial');
        }
    }

    async function manejarSubmitRegistro(e) {
        e.preventDefault();
        limpiarErrores();

        if (!estado.expedienteSeleccionado) {
            Notif.informar('Seleccione primero un estudiante para registrar su seguimiento.');
            return;
        }

        const datos = {
            idExpediente: estado.expedienteSeleccionado.idExpediente,
            fecha: el('fechaCitaSeg').value,
            estado: el('estadoCitaSeg').value,
            idPsicologo: el('psicologoCitaSeg').value,
            marcadorCritico: el('marcadorCriticoSeg').value,
            citaTexto: el('citaVinculadaSeg').value,
            proceso: el('procesoCitaSeg').value.trim(),
            observaciones: el('observacionCitaSeg').value.trim()
        };

        const validacion = SeguimientosValidaciones.validarSeguimiento(datos);
        if (!validacion.valido) {
            mostrarErrores(validacion.errores);
            return;
        }
        
        const btnSubmit = e.target.querySelector('button[type="submit"]');
        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Guardando...';
        }

        const idCita = extraerIdCita(datos.citaTexto);
        const payload = {
            expediente: { idExpediente: Number(datos.idExpediente) },
            psicologo: { idPsicologo: Number(datos.idPsicologo) },
            fechaAtencion: formatearFechaISO(datos.fecha),
            tipoProceso: datos.proceso,
            estadoEstudiante: datos.estado,
            notasAnotaciones: datos.observaciones,
            marcadorCritico: datos.marcadorCritico
        };
        
        if (idCita) {
            payload.cita = { idCita: idCita };
        }

        try {
            if (estado.sesionEnEdicion) {
                await SeguimientosService.actualizar(estado.sesionEnEdicion, payload);
            } else {
                await SeguimientosService.crear(payload);
            }

            if (estado.expedienteSeleccionado) {
                await cargarSesionesExpediente(estado.expedienteSeleccionado.idExpediente);
            }

            resetearFormulario();

            if (document.activeElement) {
                document.activeElement.blur();
            }
            const modal = bootstrap.Modal.getInstance(el('modalNuevoRegistro'));
            if (modal) modal.hide();

            renderTablaHistorial();
            renderListaEstudiantes();

            const badge = el('detBadgeEstado');
            if (badge && estado.expedienteSeleccionado) {
                badge.className = '';
                badge.innerHTML = generarBadgeEstado(estadoDeTarjeta(estado.expedienteSeleccionado));
            }

            Notif.exito('¡Registro de sesión guardado exitosamente!');
        } catch (error) {
            Notif.error(mensajeErrorAmigable(error), 'No se pudo guardar el registro');
        } finally {
            if (btnSubmit) {
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = '<i class="bi bi-check-lg"></i> Guardar Registro';
            }
        }
    }


    async function cargarDatos() {
        try {
            const [expedientes, psicologos] = await Promise.all([
                SeguimientosService.listarExpedientes(),
                SeguimientosService.listarPsicologos()
            ]);
            estado.expedientes = expedientes ?? [];
            estado.psicologos = psicologos ?? [];
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
        renderListaEstudiantes();
    }

    function iniciar() {
        cargarDatos();

        el('buscarSeguimientoInput')?.addEventListener('input', renderListaEstudiantes);
        el('btnVolverLista')?.addEventListener('click', volverALista);
        el('btnGuardarResumen')?.addEventListener('click', guardarResumen);
        el('formNuevoRegistro')?.addEventListener('submit', manejarSubmitRegistro);

        const btnLimpiarModal = el('btnLimpiarModal');
        if (btnLimpiarModal) {
            btnLimpiarModal.addEventListener('click', () => {
                resetearFormulario();
            });
        }

        document.querySelectorAll('#formNuevoRegistro input, #formNuevoRegistro select, #formNuevoRegistro textarea')
            .forEach(campo => {
                campo.addEventListener('input', () => {
                    if (campo.classList.contains('is-invalid')) {
                        campo.classList.remove('is-invalid');
                        const fb = campo.nextElementSibling;
                        if (fb && fb.classList.contains('invalid-feedback')) fb.remove();
                    }
                });
            });

        const modalRegistro = el('modalNuevoRegistro');
        if (modalRegistro) {
            modalRegistro.addEventListener('show.bs.modal', () => {
                const fechaInput = el('fechaCitaSeg');
                if (fechaInput && !fechaInput.value && !estado.sesionEnEdicion) {
                    fechaInput.value = SeguimientosValidaciones.hoyLocal();
                }
            });
            modalRegistro.addEventListener('hidden.bs.modal', () => {
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
            });

            overlay.addEventListener('click', () => {
                sidebar.classList.remove('open');
                overlay.classList.remove('active');
            });
        }
    }

    iniciar();
});
