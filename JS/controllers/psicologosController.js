
document.addEventListener('DOMContentLoaded', () => {

    const estado = {
        psicologos: [],
        citas: [],
        modoEdicion: false,
        idEnEdicion: null,
        usuarioSesion: null,
        paginaActual: 1,
        limitePorPagina: 10,
        listaFiltradaActual: []
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

    function iniciales(nombres, apellidos) {
        const n = (nombres || '').trim();
        const a = (apellidos || '').trim();
        if (!n && !a) return 'PS';
        return ((n ? n[0] : '') + (a ? a[0] : '')).toUpperCase();
    }

    function idPsicologo(psi) {
        return psi.idPsicologo ?? psi.id;
    }

    function correoPsicologo(psi) {
        return psi.usuario?.correo ?? psi.correo ?? '';
    }

    function idUsuarioPsicologo(psi) {
        return psi.usuario?.idUsuario ?? null;
    }

    function generarContrasenaTemporal() {
        return ContrasenaValidaciones.generarTemporal();
    }

    function mostrarCredenciales(titulo, correo, contrasena, nota) {
        return Notif.credencialesTemporales(titulo, correo, contrasena, nota);
    }

    function estadoCuentaPsicologo(psi) {
        return psi.usuario?.estadoCuenta ?? psi.estadoCuenta ?? 'ACTIVO';
    }

    function estadoLegible(psi) {
        return estadoCuentaPsicologo(psi) === 'ACTIVO' ? 'Activo' : 'Inactivo';
    }

    function telefonoPsicologo(psi) {
        return psi.telefono ?? '';
    }

    function casosDe(psi) {
        const id = idPsicologo(psi);
        return estado.citas.filter(c => c.psicologo?.idPsicologo === id).length;
    }

    function renderBadgeEstado(psi) {
        const activo = estadoCuentaPsicologo(psi) === 'ACTIVO';
        const clase = activo ? 'badge-estado activo' : 'badge-estado inactivo';
        const icono = activo ? 'bi bi-circle-fill' : 'bi bi-circle';
        return `<span class="${clase}"><i class="${icono}" style="font-size: 0.55rem;"></i> ${escapeHTML(estadoLegible(psi))}</span>`;
    }

    function actualizarMetricas() {
        const total = estado.psicologos.length;
        const activos = estado.psicologos.filter(p => estadoCuentaPsicologo(p) === 'ACTIVO').length;
        const casos = estado.citas.length;

        if (el('totalPsicologos')) el('totalPsicologos').textContent = total;
        if (el('activosPsicologos')) el('activosPsicologos').textContent = activos;
        if (el('casosAsignados')) el('casosAsignados').textContent = casos;
    }

    function actualizarPaginacionUI(inicio, fin, total, paginaActual, totalPaginas) {
        const info = el('infoPaginacionPsicologos');
        const ind = el('indicadorPaginaPsicologos');
        const btnPrev = el('btnPrevPsicologos');
        const btnNext = el('btnNextPsicologos');

        if (info) {
            info.innerHTML = total === 0
                ? 'Mostrando <strong>0</strong> - <strong>0</strong> de <strong>0</strong> psicólogos'
                : `Mostrando <strong>${inicio}</strong> - <strong>${fin}</strong> de <strong>${total}</strong> psicólogos`;
        }
        if (ind) ind.textContent = `Página ${paginaActual} de ${totalPaginas}`;
        if (btnPrev) btnPrev.disabled = paginaActual <= 1;
        if (btnNext) btnNext.disabled = paginaActual >= totalPaginas;
    }

    function renderTabla(lista = estado.psicologos) {
        const tbody = el('tablaPsicologosCuerpo');
        if (!tbody) return;

        const psicologos = typeof normalizarListado === 'function' ? normalizarListado(lista) : (Array.isArray(lista) ? lista : (lista?.content || []));
        estado.listaFiltradaActual = psicologos;

        const totalItems = psicologos.length;
        const totalPaginas = Math.ceil(totalItems / estado.limitePorPagina) || 1;

        if (estado.paginaActual > totalPaginas) {
            estado.paginaActual = totalPaginas;
        }
        if (estado.paginaActual < 1) {
            estado.paginaActual = 1;
        }

        const inicio = (estado.paginaActual - 1) * estado.limitePorPagina;
        const fin = Math.min(inicio + estado.limitePorPagina, totalItems);
        const psicologosPagina = psicologos.slice(inicio, fin);

        tbody.innerHTML = '';

        if (totalItems === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-5 text-muted">
                        <i class="bi bi-person-x fs-1 mb-2 d-block opacity-50"></i>
                        No se encontraron psicólogos registrados.
                    </td>
                </tr>
            `;
            actualizarPaginacionUI(0, 0, 0, 1, 1);
            actualizarMetricas();
            return;
        }

        psicologosPagina.forEach((psi) => {
            const id = idPsicologo(psi);
            const tr = document.createElement('tr');
            const casos = casosDe(psi);

            tr.innerHTML = `
                <td class="fw-bold text-muted">#${id}</td>
                <td>
                    <div class="d-flex align-items-center gap-3">
                        <div class="psicologo-avatar-badge">${iniciales(psi.nombresCompletos, psi.apellidosCompletos)}</div>
                        <div>
                            <div class="psicologo-name">${escapeHTML(psi.nombresCompletos)} ${escapeHTML(psi.apellidosCompletos)}</div>
                            <small class="text-muted"><i class="bi bi-envelope me-1"></i>${escapeHTML(correoPsicologo(psi)) || 'Sin correo'}</small>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="text-primary fw-semibold">${escapeHTML(correoPsicologo(psi))}</span>
                </td>
                <td>
                    <span class="badge bg-light text-dark border fw-bold px-3 py-2">
                        <i class="bi bi-folder-check me-1 text-primary"></i>${casos} Casos
                    </span>
                </td>
                <td>${renderBadgeEstado(psi)}</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1" onclick="verCredencialesPsicologo(${id})" title="Ver credenciales del psicólogo">
                        <i class="bi bi-key-fill"></i> <span>Credenciales</span>
                    </button>
                </td>
                <td class="text-center">
                    <div class="acciones">
                        <button class="btn-accion btn-ver" onclick="abrirModalVer(${id})" title="Ver Ficha">
                            <i class="bi bi-eye"></i>
                        </button>
                        ${estado.usuarioSesion?.tipoUsuario !== 'PSICOLOGO' ? `
                        <button class="btn-accion btn-editar" onclick="abrirModalEditar(${id})" title="Editar Psicólogo">
                            <i class="bi bi-pencil-square"></i>
                        </button>
                        <button class="btn-accion btn-eliminar" onclick="eliminarPsicologo(${id})" title="Eliminar Psicólogo">
                            <i class="bi bi-trash3"></i>
                        </button>
                        ` : ''}
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        actualizarPaginacionUI(inicio + 1, fin, totalItems, estado.paginaActual, totalPaginas);
        actualizarMetricas();
    }

    function rellenarFormulario(psi) {
        el('psiId').value = idPsicologo(psi) ?? '';
        el('psiNombres').value = psi.nombresCompletos ?? '';
        el('psiApellidos').value = psi.apellidosCompletos ?? '';
        el('psiUsuario').value = correoPsicologo(psi);
        el('psiTelefono').value = telefonoPsicologo(psi);
        el('psiEstado').value = estadoLegible(psi);
    }

    function setFormularioSoloLectura(soloLectura) {
        ['psiNombres', 'psiApellidos', 'psiUsuario', 'psiTelefono', 'psiEstado'].forEach(id => {
            const campo = el(id);
            if (campo) campo.disabled = soloLectura;
        });

        if (soloLectura) {
            el('modalSubmitBtn')?.classList.add('d-none');
        } else {
            el('modalSubmitBtn')?.classList.remove('d-none');
        }
    }

    function limpiarErrores() {
        document.querySelectorAll('#formPsicologo .is-invalid')
            .forEach(c => c.classList.remove('is-invalid'));
        document.querySelectorAll('#formPsicologo .invalid-feedback')
            .forEach(fb => fb.remove());
    }

    function mostrarErrores(errores) {
        const mapa = {
            nombresCompletos: 'psiNombres',
            apellidosCompletos: 'psiApellidos',
            correo: 'psiUsuario',
            usuario: 'psiUsuario',
            telefono: 'psiTelefono'
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

    function abrirModal() {
        const modal = new bootstrap.Modal(el('modalPsicologo'));
        modal.show();
    }

    window.abrirModalAgregar = function () {
        estado.modoEdicion = false;
        estado.idEnEdicion = null;

        const form = el('formPsicologo');
        if (form) form.reset();
        limpiarErrores();

        el('psiId').value = '';
        el('modalPsicologoTitle').innerHTML = '<i class="bi bi-person-plus-fill text-primary"></i> <span>Registrar Psicólogo</span>';
        el('modalAvatarPreview').textContent = 'PSI';
        el('modalSubmitBtn').innerHTML = '<i class="bi bi-person-plus-fill me-1"></i> Guardar Psicólogo';
        el('psiEstado').value = 'Activo';

        setFormularioSoloLectura(false);
        abrirModal();
    };

    window.abrirModalEditar = function (id) {
        const psi = estado.psicologos.find(p => idPsicologo(p) === id);
        if (!psi) return;

        estado.modoEdicion = true;
        estado.idEnEdicion = id;
        limpiarErrores();

        rellenarFormulario(psi);
        el('modalPsicologoTitle').innerHTML = '<i class="bi bi-pencil-square text-primary"></i> <span>Editar Psicólogo</span>';
        el('modalAvatarPreview').textContent = iniciales(psi.nombresCompletos, psi.apellidosCompletos);
        el('modalSubmitBtn').innerHTML = '<i class="bi bi-check2-circle me-1"></i> Actualizar Cambios';

        setFormularioSoloLectura(false);
        abrirModal();
    };

    window.abrirModalVer = function (id) {
        const psi = estado.psicologos.find(p => idPsicologo(p) === id);
        if (!psi) return;

        estado.modoEdicion = false;
        estado.idEnEdicion = id;
        limpiarErrores();

        rellenarFormulario(psi);
        el('modalPsicologoTitle').innerHTML = '<i class="bi bi-person-lines-fill text-primary"></i> <span>Ficha del Profesional</span>';
        el('modalAvatarPreview').textContent = iniciales(psi.nombresCompletos, psi.apellidosCompletos);

        setFormularioSoloLectura(true);
        abrirModal();
    };

    function construirPayload() {
        const psi = estado.idEnEdicion !== null
            ? estado.psicologos.find(p => idPsicologo(p) === estado.idEnEdicion)
            : null;

        const payload = {
            nombresCompletos: el('psiNombres').value.trim(),
            apellidosCompletos: el('psiApellidos').value.trim(),
            telefono: el('psiTelefono').value.trim(),
            usuario: {
                idUsuario: psi?.usuario?.idUsuario ?? null,
                correo: el('psiUsuario').value.trim(),
                tipoUsuario: 'PSICOLOGO',
                estadoCuenta: (el('psiEstado').value === 'Activo' ? 'ACTIVO' : 'INACTIVO') || 'ACTIVO'
            }
        };

        return payload;
    }

    async function recargarPsicologos() {
        estado.psicologos = await PsicologosService.listar();
        renderTabla();
    }

    async function guardarFormulario() {
        limpiarErrores();

        if (estado.usuarioSesion?.tipoUsuario === 'PSICOLOGO') {
            Notif.error('Los psicólogos no tienen permiso para modificar la información de psicólogos.', 'Acceso denegado');
            return;
        }

        const datos = {
            nombresCompletos: el('psiNombres').value.trim(),
            apellidosCompletos: el('psiApellidos').value.trim(),
            correo: el('psiUsuario').value.trim(),
            telefono: el('psiTelefono').value.trim()
        };

        const validacion = PsicologosValidaciones.validarPsicologo(datos, estado.modoEdicion);
        if (!validacion.valido) {
            mostrarErrores(validacion.errores);
            return;
        }

        try {
            if (estado.modoEdicion && estado.idEnEdicion !== null) {
                await guardarEdicion(datos);
            } else {
                await guardarNuevo(datos);
            }

            await recargarPsicologos();

            const modal = bootstrap.Modal.getInstance(el('modalPsicologo'));
            if (modal) modal.hide();
        } catch (error) {
            Notif.error(`No se pudo guardar el psicólogo: ${error.message}`);
        }
    }

    async function guardarNuevo(datos) {
        const passAuto = generarContrasenaTemporal();

        const usuarioCreado = await PsicologosService.crearUsuario({
            correo: datos.correo,
            contrasena: passAuto,
            tipoUsuario: 'PSICOLOGO',
            estadoCuenta: el('psiEstado').value === 'Activo' ? 'ACTIVO' : 'INACTIVO'
        });

        await PsicologosService.crear({
            nombresCompletos: datos.nombresCompletos,
            apellidosCompletos: datos.apellidosCompletos,
            telefono: datos.telefono,
            usuario: {
                idUsuario: usuarioCreado.idUsuario,
                correo: datos.correo,
                tipoUsuario: 'PSICOLOGO',
                estadoCuenta: el('psiEstado').value === 'Activo' ? 'ACTIVO' : 'INACTIVO'
            }
        });

        mostrarCredenciales(
            'Psicólogo registrado',
            datos.correo,
            passAuto,
            'Copia y entrega estas credenciales. Por seguridad no se volverán a mostrar; el psicólogo debe cambiar su contraseña al ingresar.'
        );
    }

    async function guardarEdicion(datos) {
        const payload = construirPayload();

        await PsicologosService.actualizar(estado.idEnEdicion, payload);

        Notif.exito('¡Psicólogo actualizado correctamente!');
    }

    window.eliminarPsicologo = async function (id) {
        if (estado.usuarioSesion?.tipoUsuario === 'PSICOLOGO') {
            Notif.error('Los psicólogos no tienen permiso para eliminar psicólogos.', 'Acceso denegado');
            return;
        }

        const psi = estado.psicologos.find(p => idPsicologo(p) === id);
        if (!psi) return;

        const confirmado = await Notif.confirmarEliminar(
            'Eliminar psicólogo',
            `¿Está seguro de que desea eliminar al psicólogo Lic. ${psi.nombresCompletos} ${psi.apellidosCompletos} del sistema?`
        );
        if (!confirmado) return;

        try {
            await PsicologosService.eliminar(id);
            await recargarPsicologos();
            Notif.exito('¡Psicólogo eliminado del sistema!');
        } catch (error) {
            Notif.error(`No se pudo eliminar el psicólogo: ${error.message}`);
        }
    };

    window.verCredencialesPsicologo = function (id) {
        const psi = estado.psicologos.find(p => idPsicologo(p) === id);
        if (!psi) return;

        const correo = correoPsicologo(psi);

        el('credPsiNombre').textContent = `Lic. ${psi.nombresCompletos} ${psi.apellidosCompletos}`;
        el('credPsiUsuario').value = correo;
        el('credPsiPass').value = '';
        el('credPsiPass').placeholder = 'Protegida por seguridad';
        el('credPsiPass').type = 'password';
        el('iconEyePsi').className = 'bi bi-eye';

        const btnRestablecer = el('btnRestablecerPassPsi');
        if (btnRestablecer) {
            btnRestablecer.classList.toggle('d-none', estado.usuarioSesion?.tipoUsuario !== 'ADMIN');
            btnRestablecer.dataset.idPsicologo = id;
        }

        bootstrap.Modal.getOrCreateInstance(el('modalCredencialesPsicologo')).show();
    };

    async function restablecerContrasenaPsicologo() {
        const id = Number(el('btnRestablecerPassPsi')?.dataset.idPsicologo);
        const psi = estado.psicologos.find(p => idPsicologo(p) === id);
        if (!psi || estado.usuarioSesion?.tipoUsuario !== 'ADMIN') return;

        const idUsuario = idUsuarioPsicologo(psi);
        const correo = correoPsicologo(psi);
        if (!idUsuario || !correo) {
            Notif.error('Este psicólogo no tiene un usuario asociado.', 'No se pudo restablecer');
            return;
        }

        const confirmado = await Notif.confirmar(
            '¿Restablecer contraseña?',
            `Se generará una nueva contraseña para ${psi.nombresCompletos} ${psi.apellidosCompletos}. La contraseña anterior dejará de funcionar.`,
            'Sí, restablecer',
            { icono: 'warning', peligro: true }
        );
        if (!confirmado) return;

        const contrasena = generarContrasenaTemporal();
        try {
            await PsicologosService.actualizarUsuario(idUsuario, {
                correo,
                contrasena,
                tipoUsuario: psi.usuario?.tipoUsuario || 'PSICOLOGO',
                estadoCuenta: estadoCuentaPsicologo(psi)
            });

            el('credPsiPass').value = contrasena;
            await mostrarCredenciales(
                'Contraseña restablecida',
                correo,
                contrasena,
                'Entrega esta contraseña al psicólogo y pídele que la cambie desde Configuración > Cambiar contraseña.'
            );
        } catch (error) {
            Notif.error(error.message || 'No se pudo restablecer la contraseña.', 'No se pudo restablecer');
        }
    }

    function togglePassPsi() {
        const pass = el('credPsiPass');
        if (!pass) return;

        if (pass.type === 'password') {
            pass.type = 'text';
            el('iconEyePsi').className = 'bi bi-eye-slash';
        } else {
            pass.type = 'password';
            el('iconEyePsi').className = 'bi bi-eye';
        }
    }

    async function inicializar() {
        estado.usuarioSesion = await obtenerUsuarioSesion();

        if (estado.usuarioSesion?.tipoUsuario === 'PSICOLOGO') {
            const btnAgregar = el('btnAbrirModalPsicologo');
            if (btnAgregar) btnAgregar.style.display = 'none';
        }

        const buscar = el('buscarPsicologo');

        try {
            estado.psicologos = await PsicologosService.listar();
        } catch (error) {
            const status = error?.status;
            if (status === 401) throw error;
            const tbody = el('tablaPsicologosCuerpo');
            if (tbody) {
                let mensaje;
                let icono = 'bi bi-plug';
                if (status === 403) {
                    mensaje = 'Acceso denegado: Permisos insuficientes para ver la lista de psicólogos.';
                    icono = 'bi bi-lock-fill';
                } else if (status >= 500) {
                    mensaje = `Error interno del servidor (${status}). Intente nuevamente más tarde.`;
                    icono = 'bi bi-exclamation-triangle-fill';
                } else {
                    mensaje = `No se pudo conectar con el servidor. Verifique que el backend esté activo en ${API_BASE_URL}.`;
                }
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" class="text-center py-5 text-muted">
                            <i class="${icono} fs-2 d-block mb-2 opacity-50"></i>
                            ${escapeHTML(mensaje)}
                            ${error.message ? `<div class="small mt-1">${escapeHTML(error.message)}</div>` : ''}
                        </td>
                    </tr>
                `;
            }
            return;
        }

        try {
            const citas = await PsicologosService.listarCitas();
            estado.citas = Array.isArray(citas) ? citas : [];
        } catch (error) {
            const status = error?.status;
            if (status === 401) throw error;
            estado.citas = [];
        }

        renderTabla();

        if (buscar) {
            buscar.addEventListener('input', (e) => {
                estado.paginaActual = 1;
                const texto = e.target.value.toLowerCase().trim();
                const filtrados = estado.psicologos.filter(psi =>
                    (psi.nombresCompletos || '').toLowerCase().includes(texto) ||
                    (psi.apellidosCompletos || '').toLowerCase().includes(texto) ||
                    (correoPsicologo(psi) || '').toLowerCase().includes(texto) ||
                    (telefonoPsicologo(psi) || '').toLowerCase().includes(texto)
                );
                renderTabla(filtrados);
            });
        }

        el('btnPrevPsicologos')?.addEventListener('click', () => {
            if (estado.paginaActual > 1) {
                estado.paginaActual--;
                renderTabla(estado.listaFiltradaActual);
            }
        });

        el('btnNextPsicologos')?.addEventListener('click', () => {
            const totalPaginas = Math.ceil(estado.listaFiltradaActual.length / estado.limitePorPagina) || 1;
            if (estado.paginaActual < totalPaginas) {
                estado.paginaActual++;
                renderTabla(estado.listaFiltradaActual);
            }
        });
    }

    el('btnAbrirModalPsicologo')?.addEventListener('click', window.abrirModalAgregar);
    el('formPsicologo')?.addEventListener('submit', (e) => {
        e.preventDefault();
        guardarFormulario();
    });
    el('btnTogglePassPsi')?.addEventListener('click', togglePassPsi);
    el('btnRestablecerPassPsi')?.addEventListener('click', restablecerContrasenaPsicologo);

    document.querySelectorAll('#formPsicologo input, #formPsicologo select').forEach(campo => {
        campo.addEventListener('input', () => {
            if (campo.classList.contains('is-invalid')) {
                campo.classList.remove('is-invalid');
                campo.nextElementSibling?.classList.contains('invalid-feedback') && campo.nextElementSibling.remove();
            }
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