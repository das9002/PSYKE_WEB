
document.addEventListener('DOMContentLoaded', () => {

    const estado = {
        estudiantes: [],
        grados: [],
        secciones: [],
        especialidades: [],
        modoEdicion: false,
        idEnEdicion: null,
        credencial: null
    };

    const NIVEL_ID = { 'Bachillerato': 2, 'Tercer Ciclo': 1 };

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
        if (!n && !a) return 'ES';
        return ((n ? n[0] : '') + (a ? a[0] : '')).toUpperCase();
    }

    function idEstudiante(est) {
        return est.idEstudiante ?? est.id;
    }

    function estadoClinicoAFormulario(valor) {
        if (valor === 'Normal') return 'Estable';
        if (valor === 'En Seguimiento') return 'Seguimiento';
        return valor ?? 'Estable';
    }

    function estadoFormularioAClinico(valor) {
        if (valor === 'Estable') return 'Normal';
        if (valor === 'Seguimiento') return 'En Seguimiento';
        return valor ?? 'Normal';
    }

    function correoEstudiante(est) {
        return est.usuario?.correo ?? est.correo ?? '';
    }

    function nombreGrado(est) {
        if (est.grado?.nombreGrado) return est.grado.nombreGrado;
        const idG = est.grado?.idGrado ?? est.idGrado;
        if (idG) {
            const encontrado = estado.grados.find(g => g.idGrado === idG);
            if (encontrado) return encontrado.nombreGrado;
        }
        return est.grado ?? est.gradoNombre ?? '';
    }

    function nombreSeccion(est) {
        if (est.seccion?.nombreSeccion) return est.seccion.nombreSeccion;
        const idS = est.seccion?.idSeccion ?? est.idSeccion;
        if (idS) {
            const encontrado = estado.secciones.find(s => s.idSeccion === idS);
            if (encontrado) return encontrado.nombreSeccion;
        }
        return est.seccion ?? est.seccionNombre ?? '';
    }

    function nombreEspecialidad(est) {
        if (est.especialidad?.nombreEspecialidad) return est.especialidad.nombreEspecialidad;
        const idE = est.especialidad?.idEspecialidad ?? est.idEspecialidad;
        if (idE) {
            const encontrado = estado.especialidades.find(e => e.idEspecialidad === idE);
            if (encontrado) return encontrado.nombreEspecialidad;
        }
        return est.especialidad ?? est.especialidadNombre ?? 'Educación Básica';
    }

    function renderBadgeProgreso(estadoEst) {
        if (estadoEst === 'Prioritario') {
            return `<span class="badge-estado prioritario"><i class="bi bi-star-fill"></i> Prioritario</span>`;
        } else if (estadoEst === 'Seguimiento' || estadoEst === 'En Seguimiento') {
            return `<span class="badge-estado seguimiento"><i class="bi bi-triangle-fill"></i> Seguimiento</span>`;
        } else {
            return `<span class="badge-estado estable"><i class="bi bi-circle-fill"></i> Estable</span>`;
        }
    }

    function renderTabla(lista = estado.estudiantes) {
        const tbody = el('tablaEstudiantesBody');
        const noResults = el('noResultsEstudiantes');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (lista.length === 0) {
            if (noResults) noResults.classList.remove('d-none');
            return;
        }
        if (noResults) noResults.classList.add('d-none');

        lista.forEach((est) => {
            const id = idEstudiante(est);
            const tr = document.createElement('tr');

            tr.innerHTML = `
                <td>
                    <div class="d-flex align-items-center gap-3">
                        <div class="student-avatar-badge">${iniciales(est.nombres, est.apellidos)}</div>
                        <div>
                            <div class="student-name">${escapeHTML(est.nombres)} ${escapeHTML(est.apellidos)}</div>
                            <small class="text-muted">${escapeHTML(correoEstudiante(est)) || 'Sin correo'}</small>
                        </div>
                    </div>
                </td>
                <td class="fw-semibold text-muted">${escapeHTML(est.codigoCarnet ?? est.carnet)}</td>
                <td>
                    <span class="fw-semibold text-dark">${escapeHTML(nombreGrado(est))}</span>
                    <span class="text-muted">"${escapeHTML(nombreSeccion(est))}"</span>
                </td>
                <td>
                    <span class="badge bg-light text-secondary border">
                        ${escapeHTML(nombreEspecialidad(est))}
                    </span>
                </td>
                <td>${renderBadgeProgreso(est.estadoClinico ?? est.estado ?? 'Normal')}</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1" onclick="verCredencialesEstudiante(${id})" title="Ver credenciales del estudiante">
                        <i class="bi bi-key-fill"></i> <span>Credenciales</span>
                    </button>
                </td>
                <td class="text-center">
                    <div class="acciones">
                        <button class="btn-accion btn-ver" onclick="abrirModalVer(${id})" title="Ver Expediente">
                            <i class="bi bi-eye"></i>
                        </button>
                        <button class="btn-accion btn-editar" onclick="abrirModalEditar(${id})" title="Editar Estudiante">
                            <i class="bi bi-pencil-square"></i>
                        </button>
                        <button class="btn-accion btn-eliminar" onclick="eliminarEstudiante(${id})" title="Eliminar Estudiante">
                            <i class="bi bi-trash3"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    function llenarSelect(select, opciones, valorPredeterminado) {
        if (!select) return;
        select.innerHTML = '';
        opciones.forEach(({ value, texto }) => {
            const opt = document.createElement('option');
            opt.value = value;
            opt.textContent = texto;
            select.appendChild(opt);
        });
        if (valorPredeterminado !== undefined && select.querySelector(`option[value="${valorPredeterminado}"]`)) {
            select.value = valorPredeterminado;
        }
    }

    const SECCIONES_BACHILLERATO = [
        'A-1', 'A-2', 'A-3', 'A-4', 'A-5',
        'B-1', 'B-2', 'B-3', 'B-4'
    ];

    const SECCIONES_TERCER_CICLO = [
        'A', 'B', 'C', 'D', 'E', 'F', 'G'
    ];

    const GRADOS_BACHILLERATO = [
        { value: '1°', texto: '1.º Año Bachillerato' },
        { value: '2°', texto: '2.º Año Bachillerato' },
        { value: '3°', texto: '3.er Año Bachillerato' }
    ];

    const GRADOS_TERCER_CICLO = [
        { value: '7°', texto: '7.º Grado (Tercer Ciclo)' },
        { value: '8°', texto: '8.º Grado (Tercer Ciclo)' },
        { value: '9°', texto: '9.º Grado (Tercer Ciclo)' }
    ];

    const ESPECIALIDADES_BACHILLERATO = [
        { value: 'Desarrollo de Software', texto: 'Desarrollo de Software' },
        { value: 'Administrativo Contable', texto: 'Administrativo Contable' },
        { value: 'Electromecánica', texto: 'Electromecánica' },
        { value: 'Electrónica', texto: 'Electrónica' },
        { value: 'Mantenimiento Automotriz', texto: 'Mantenimiento Automotriz' },
        { value: 'Diseño Gráfico', texto: 'Diseño Gráfico' }
    ];

    function actualizarCamposNivel() {
        const nivel = el('estNivel')?.value;
        const gradoSelect = el('estGrado');
        const seccionSelect = el('estSeccion');
        const especialidadSelect = el('estEspecialidad');
        const reqEspSpan = el('reqEspecialidad');

        if (!gradoSelect || !seccionSelect || !especialidadSelect) return;

        const idNivel = NIVEL_ID[nivel];

        let opcionesGrado = [];
        if (estado.grados && estado.grados.length > 0) {
            const filtrados = estado.grados.filter(g => {
                if (idNivel && g.idNivel) return g.idNivel === idNivel;
                if (nivel === 'Tercer Ciclo') return /[789]/.test(String(g.nombreGrado || ''));
                return /[123]/.test(String(g.nombreGrado || ''));
            });
            if (filtrados.length > 0) {
                opcionesGrado = filtrados.map(g => ({ value: g.idGrado, texto: g.nombreGrado }));
            }
        }
        if (opcionesGrado.length === 0) {
            opcionesGrado = (nivel === 'Tercer Ciclo') ? GRADOS_TERCER_CICLO : GRADOS_BACHILLERATO;
        }
        llenarSelect(gradoSelect, opcionesGrado);

        let opcionesSeccion = [];
        if (estado.secciones && estado.secciones.length > 0) {
            const filtrados = estado.secciones.filter(s => {
                const nombre = String(s.nombreSeccion || '');
                if (nivel === 'Tercer Ciclo') {
                    return !nombre.includes('-') && /^[A-G]$/i.test(nombre.trim());
                } else {
                    return nombre.includes('-') || /^[AB]-[1-5]$/i.test(nombre.trim());
                }
            });
            if (filtrados.length > 0) {
                opcionesSeccion = filtrados.map(s => ({ value: s.idSeccion, texto: `Sección "${s.nombreSeccion}"` }));
            }
        }
        if (opcionesSeccion.length === 0) {
            const listaSecc = (nivel === 'Tercer Ciclo') ? SECCIONES_TERCER_CICLO : SECCIONES_BACHILLERATO;
            opcionesSeccion = listaSecc.map(sec => ({ value: sec, texto: `Sección "${sec}"` }));
        }
        llenarSelect(seccionSelect, opcionesSeccion);

        if (nivel === 'Tercer Ciclo') {
            llenarSelect(especialidadSelect, [{ value: '', texto: 'Sin especialidad (Tercer Ciclo)' }]);
            especialidadSelect.value = '';
            especialidadSelect.disabled = true;
            if (reqEspSpan) reqEspSpan.style.display = 'none';
        } else {
            especialidadSelect.disabled = false;
            if (reqEspSpan) reqEspSpan.style.display = 'inline';

            let opcionesEsp = [];
            if (estado.especialidades && estado.especialidades.length > 0) {
                opcionesEsp = estado.especialidades.map(e => ({ value: e.idEspecialidad, texto: e.nombreEspecialidad }));
            } else {
                opcionesEsp = ESPECIALIDADES_BACHILLERATO;
            }
            llenarSelect(especialidadSelect, opcionesEsp);
            if (!especialidadSelect.value && opcionesEsp.length > 0) {
                especialidadSelect.value = opcionesEsp[0].value;
            }
        }
    }

    function rellenarFormulario(est) {
        el('estIdHidden').value = idEstudiante(est) ?? '';
        el('estCarnet').value = est.codigoCarnet ?? est.carnet ?? '';
        el('estUsuario').value = correoEstudiante(est);
        el('estNombres').value = est.nombres ?? '';
        el('estApellidos').value = est.apellidos ?? '';
        el('estInfoFamiliar').value = est.infoFamiliar ?? est.informacionFamiliar ?? '';
        el('estEstado').value = estadoClinicoAFormulario(est.estadoClinico ?? est.estado);

        const idNivel = est.grado?.idNivel ?? NIVEL_ID[est.nivel];
        const nivel = idNivel === 1 ? 'Tercer Ciclo' : 'Bachillerato';
        el('estNivel').value = nivel;
        actualizarCamposNivel();

        const idGrado = est.grado?.idGrado ?? (estado.grados.find(g => (est.grado ?? '') === g.nombreGrado || (est.nivelGrado ?? '') === g.nombreGrado)?.idGrado);
        if (idGrado && el('estGrado').querySelector(`option[value="${idGrado}"]`)) {
            el('estGrado').value = idGrado;
        }

        const idSeccion = est.seccion?.idSeccion ?? (estado.secciones.find(s => (est.seccion ?? '') === s.nombreSeccion)?.idSeccion);
        if (idSeccion && el('estSeccion').querySelector(`option[value="${idSeccion}"]`)) {
            el('estSeccion').value = idSeccion;
        }

        const idEspecialidad = est.especialidad?.idEspecialidad ?? (estado.especialidades.find(e => (est.especialidad ?? '') === e.nombreEspecialidad)?.idEspecialidad);
        if (idEspecialidad && el('estEspecialidad').querySelector(`option[value="${idEspecialidad}"]`)) {
            el('estEspecialidad').value = idEspecialidad;
        }
    }

    function setFormularioSoloLectura(soloLectura) {
        const ids = [
            'estCarnet', 'estUsuario', 'estNombres', 'estApellidos',
            'estNivel', 'estGrado', 'estSeccion', 'estEspecialidad',
            'estInfoFamiliar', 'estEstado'
        ];
        ids.forEach((id) => {
            const campo = el(id);
            if (campo) campo.disabled = soloLectura;
        });

        el('btnRegistrar')?.classList.add('d-none');
        el('btnActualizar')?.classList.add('d-none');
        el('btnEliminarModal')?.classList.add('d-none');
        el('btnLimpiar')?.classList.add('d-none');

        if (!soloLectura) {
            if (estado.modoEdicion) {
                el('btnActualizar')?.classList.remove('d-none');
                el('btnEliminarModal')?.classList.remove('d-none');
            } else {
                el('btnRegistrar')?.classList.remove('d-none');
                el('btnLimpiar')?.classList.remove('d-none');
            }
        }
    }

    function limpiarErrores() {
        document.querySelectorAll('#formEstudiante .is-invalid, #modalCredencialesEstudiante .is-invalid')
            .forEach(c => c.classList.remove('is-invalid'));
        document.querySelectorAll('#formEstudiante .invalid-feedback, #modalCredencialesEstudiante .invalid-feedback')
            .forEach(fb => fb.remove());
    }

    function mostrarErrores(errores) {
        const mapa = {
            codigoCarnet: 'estCarnet',
            nombres: 'estNombres',
            apellidos: 'estApellidos',
            correo: 'estUsuario',
            usuario: 'estUsuario',
            grado: 'estGrado',
            seccion: 'estSeccion',
            contrasena: 'credEstPass'
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

    function mensajeErrorAmigable(error) {
        const texto = String(error?.message ?? '').toUpperCase();

        if (error?.status === 409 || texto.includes('ORA-00001') || /ya (existe|registrad)|duplicad|unique constraint/i.test(texto)) {
            return 'Ya existe un estudiante con ese carnet o correo. Verifique que los datos no estén duplicados.';
        }
        if (texto.includes('ORA-01400') || texto.includes('ORA-01401') || texto.includes('ORA-12899')) {
            return 'Faltan campos obligatorios o algún valor excede la longitud permitida. Revise el formulario.';
        }
        if (error?.status === 400) {
            return `Revise los datos del formulario:\n${error.message}`;
        }
        if (error?.status === 500) {
            return 'Ocurrió un error interno en el servidor. Inténtelo de nuevo más tarde.';
        }
        if (error instanceof TypeError || !error?.status) {
            return `No se pudo conectar con el servidor. Verifique que el backend esté activo en ${API_BASE_URL}.`;
        }
        return error.message || 'Ocurrió un error inesperado.';
    }

    function abrirModal() {
        const modal = new bootstrap.Modal(el('modalEstudiante'));
        modal.show();
    }

    window.abrirModalAgregar = function () {
        estado.modoEdicion = false;
        estado.idEnEdicion = null;

        const form = el('formEstudiante');
        if (form) form.reset();
        limpiarErrores();

        el('estIdHidden').value = '';
        el('modalEstudianteTitleText').textContent = 'Registrar Estudiante';
        el('modalAvatarPreview').textContent = 'ES';
        el('modalBadgeCarnet').textContent = 'Nuevo Registro';
        el('estNivel').value = 'Bachillerato';
        actualizarCamposNivel();
        el('estEstado').value = 'Estable';

        setFormularioSoloLectura(false);
        abrirModal();
    };

    window.abrirModalEditar = function (id) {
        const est = estado.estudiantes.find(e => idEstudiante(e) === id);
        if (!est) return;

        estado.modoEdicion = true;
        estado.idEnEdicion = id;
        limpiarErrores();

        rellenarFormulario(est);
        el('modalEstudianteTitleText').textContent = 'Editar Estudiante';
        el('modalAvatarPreview').textContent = iniciales(est.nombres, est.apellidos);
        el('modalBadgeCarnet').textContent = `Carnet: ${est.codigoCarnet ?? est.carnet}`;

        setFormularioSoloLectura(false);
        abrirModal();
    };

    window.abrirModalVer = function (id) {
        const est = estado.estudiantes.find(e => idEstudiante(e) === id);
        if (!est) return;

        estado.modoEdicion = false;
        estado.idEnEdicion = id;
        limpiarErrores();

        rellenarFormulario(est);
        el('modalEstudianteTitleText').textContent = 'Ficha del Estudiante';
        el('modalAvatarPreview').textContent = iniciales(est.nombres, est.apellidos);
        el('modalBadgeCarnet').textContent = `Carnet: ${est.codigoCarnet ?? est.carnet}`;

        setFormularioSoloLectura(true);
        abrirModal();
    };

    function construirPayload() {
        const carnet = el('estCarnet').value.trim();
        const correo = el('estUsuario').value.trim();
        const gradoVal = el('estGrado').value;
        const seccionVal = el('estSeccion').value;
        const especialidadVal = el('estEspecialidad').value;

        const gradoId = Number(gradoVal);
        const seccionId = Number(seccionVal);
        const especialidadId = Number(especialidadVal);

        const estudianteSeleccionado = estado.modoEdicion
            ? estado.estudiantes.find(e => idEstudiante(e) === estado.idEnEdicion)
            : null;

        const usuario = estudianteSeleccionado?.usuario?.idUsuario
            ? {
                idUsuario: estudianteSeleccionado.usuario.idUsuario,
                correo: correo || `${carnet}@ricaldone.edu.sv`,
                tipoUsuario: 'ESTUDIANTE',
                estadoCuenta: 'ACTIVO'
            }
            : {
                correo: correo || `${carnet}@ricaldone.edu.sv`,
                contrasena: 'Estudiante2026*',
                tipoUsuario: 'ESTUDIANTE',
                estadoCuenta: 'ACTIVO'
            };

        const payload = {
            codigoCarnet: carnet,
            nombres: el('estNombres').value.trim(),
            apellidos: el('estApellidos').value.trim(),
            usuario,
            nivel: el('estNivel').value,
            estadoClinico: estadoFormularioAClinico(el('estEstado').value),
            informacionFamiliar: el('estInfoFamiliar').value.trim()
        };

        if (!isNaN(gradoId) && gradoId > 0) {
            payload.grado = { idGrado: gradoId };
        } else if (gradoVal) {
            payload.grado = { nombreGrado: gradoVal };
        }

        if (!isNaN(seccionId) && seccionId > 0) {
            payload.seccion = { idSeccion: seccionId };
        } else if (seccionVal) {
            payload.seccion = { nombreSeccion: seccionVal };
        }

        if (!el('estEspecialidad').disabled && (especialidadId || especialidadVal)) {
            if (!isNaN(especialidadId) && especialidadId > 0) {
                payload.especialidad = { idEspecialidad: especialidadId };
            } else if (especialidadVal) {
                payload.especialidad = { nombreEspecialidad: especialidadVal };
            }
        }

        return payload;
    }

    async function recargarEstudiantes() {
        estado.estudiantes = await EstudiantesService.listar();
        renderTabla();
    }

    async function guardarFormulario() {
        limpiarErrores();

        const estudianteSeleccionado = estado.modoEdicion
            ? estado.estudiantes.find(e => idEstudiante(e) === estado.idEnEdicion)
            : null;

        const usuario = estudianteSeleccionado?.usuario?.idUsuario
            ? {
                idUsuario: estudianteSeleccionado.usuario.idUsuario,
                correo: el('estUsuario').value.trim(),
                tipoUsuario: 'ESTUDIANTE',
                estadoCuenta: 'ACTIVO'
            }
            : {
                correo: el('estUsuario').value.trim(),
                tipoUsuario: 'ESTUDIANTE',
                estadoCuenta: 'ACTIVO',
                contrasena: 'Estudiante2026*'
            };

        const datos = {
            codigoCarnet: el('estCarnet').value.trim(),
            nombres: el('estNombres').value.trim(),
            apellidos: el('estApellidos').value.trim(),
            usuario,
            nivel: el('estNivel').value,
            grado: el('estGrado').value,
            seccion: el('estSeccion').value,
            especialidad: el('estEspecialidad').value
        };

        const validacion = EstudiantesValidaciones.validarEstudiante(datos);
        if (!validacion.valido) {
            mostrarErrores(validacion.errores);
            return;
        }

        try {
            const payload = construirPayload();

            if (estado.modoEdicion && estado.idEnEdicion !== null) {
                await EstudiantesService.actualizar(estado.idEnEdicion, payload);
                Notif.exito('¡Estudiante actualizado correctamente!');
            } else {
                await EstudiantesService.crear(payload);
                Notif.exito('¡Estudiante registrado con éxito!');
            }

            await recargarEstudiantes();

            const modal = bootstrap.Modal.getInstance(el('modalEstudiante'));
            if (modal) modal.hide();
        } catch (error) {
            Notif.error(mensajeErrorAmigable(error), 'No se pudo guardar el estudiante');
        }
    }

    window.eliminarEstudiante = async function (id) {
        const est = estado.estudiantes.find(e => idEstudiante(e) === id);
        if (!est) return;

        const confirmado = await Notif.confirmarEliminar(
            'Eliminar estudiante',
            `¿Está seguro de que desea eliminar al estudiante ${est.nombres} ${est.apellidos} del sistema?`
        );
        if (!confirmado) return;

        try {
            await EstudiantesService.eliminar(id);
            const modal = bootstrap.Modal.getInstance(el('modalEstudiante'));
            if (modal) modal.hide();
            await recargarEstudiantes();
            Notif.exito('¡Estudiante eliminado del sistema!');
        } catch (error) {
            Notif.error(`No se pudo eliminar el estudiante: ${error.message}`);
        }
    };

    window.verCredencialesEstudiante = function (id) {
        const est = estado.estudiantes.find(e => idEstudiante(e) === id);
        if (!est) return;

        estado.credencial = {
            estudianteId: idEstudiante(est),
            usuarioId: est.usuario?.idUsuario ?? null,
            nombre: `${est.nombres} ${est.apellidos}`,
            carnet: est.codigoCarnet ?? est.carnet,
            grado: `${nombreGrado(est)} "${nombreSeccion(est)}"`,
            correo: correoEstudiante(est),
            usuario: est.usuario
        };

        el('credEstNombre').textContent = estado.credencial.nombre;
        el('credEstGrado').textContent = `${estado.credencial.grado} • ${nombreEspecialidad(est)}`;
        el('credEstCarnet').value = estado.credencial.carnet;
        el('credEstPass').value = '';
        el('credEstPass').type = 'password';
        el('iconEyeEst').className = 'bi bi-eye';

        const modal = new bootstrap.Modal(el('modalCredencialesEstudiante'));
        modal.show();
    };

    function togglePassEst() {
        const pass = el('credEstPass');
        if (!pass) return;

        if (pass.type === 'password') {
            pass.type = 'text';
            el('iconEyeEst').className = 'bi bi-eye-slash';
        } else {
            pass.type = 'password';
            el('iconEyeEst').className = 'bi bi-eye';
        }
    }

    async function guardarNuevaPassEst() {
        limpiarErrores();

        if (!estado.credencial) return;
        if (!estado.credencial.usuarioId) {
            Notif.informar('Este estudiante no tiene un usuario asociado en el sistema.');
            return;
        }

        const nuevaPass = el('credEstPass').value;
        const validacion = EstudiantesValidaciones.validarContrasena(nuevaPass);
        if (!validacion.valido) {
            mostrarErrores(validacion.errores);
            return;
        }

        try {
            const usuario = {
                correo: estado.credencial.correo,
                tipoUsuario: estado.credencial.usuario?.tipoUsuario ?? 'ESTUDIANTE',
                estadoCuenta: estado.credencial.usuario?.estadoCuenta ?? 'ACTIVO',
                contrasena: nuevaPass
            };

            await EstudiantesService.actualizarUsuario(estado.credencial.usuarioId, usuario);
            Notif.exito(`¡Contraseña de ${estado.credencial.nombre} actualizada exitosamente!`);

            const modal = bootstrap.Modal.getInstance(el('modalCredencialesEstudiante'));
            if (modal) modal.hide();
        } catch (error) {
            Notif.error(`No se pudo actualizar la contraseña: ${error.message}`);
        }
    }

    async function inicializar() {
        const buscar = el('buscarEstudianteInput');
        if (buscar) buscar.value = '';

        // Carga resiliente de catálogos - cada uno con try/catch independiente
        const [estudiantes, grados, secciones, especialidades] = await Promise.allSettled([
            EstudiantesService.listar(),
            EstudiantesService.listarGrados(),
            EstudiantesService.listarSecciones(),
            EstudiantesService.listarEspecialidades()
        ]);

        estado.estudiantes = estudiantes.status === 'fulfilled' ? (estudiantes.value ?? []) : [];
        estado.grados = grados.status === 'fulfilled' ? (grados.value ?? []) : [];
        estado.secciones = secciones.status === 'fulfilled' ? (secciones.value ?? []) : [];
        estado.especialidades = especialidades.status === 'fulfilled' ? (especialidades.value ?? []) : [];

        // Log de catálogos fallidos para debugging
        [grados, secciones, especialidades].forEach((result, i) => {
            const nombres = ['grados', 'secciones', 'especialidades'];
            if (result.status === 'rejected') {
                console.warn(`[Estudiantes] Fallo al cargar ${nombres[i]}:`, result.reason);
            }
        });

        actualizarCamposNivel();
        renderTabla();

        if (buscar) {
            buscar.addEventListener('input', (e) => {
                const texto = e.target.value.toLowerCase().trim();
                const filtrados = estado.estudiantes.filter(est =>
                    (est.nombres || '').toLowerCase().includes(texto) ||
                    (est.apellidos || '').toLowerCase().includes(texto) ||
                    (est.codigoCarnet || '').toLowerCase().includes(texto) ||
                    (nombreGrado(est) || '').toLowerCase().includes(texto) ||
                    (nombreEspecialidad(est) || '').toLowerCase().includes(texto)
                );
                renderTabla(filtrados);
            });
        }
    }

    el('btnAbrirModalAgregar')?.addEventListener('click', window.abrirModalAgregar);
    el('btnRegistrar')?.addEventListener('click', guardarFormulario);
    el('btnActualizar')?.addEventListener('click', guardarFormulario);
    el('btnLimpiar')?.addEventListener('click', () => {
        const form = el('formEstudiante');
        if (form) form.reset();
        limpiarErrores();
        el('estNivel').value = 'Bachillerato';
        actualizarCamposNivel();
        el('estEstado').value = 'Estable';
    });
    el('btnEliminarModal')?.addEventListener('click', () => {
        if (estado.idEnEdicion !== null) {
            window.eliminarEstudiante(estado.idEnEdicion);
        }
    });
    el('estCarnet')?.addEventListener('input', (e) => {
        const carnetVal = e.target.value.trim();
        const usuarioInput = el('estUsuario');
        if (usuarioInput) {
            if (carnetVal) {
                usuarioInput.value = `${carnetVal}@ricaldone.edu.sv`;
            } else {
                usuarioInput.value = '';
            }
            if (usuarioInput.classList.contains('is-invalid')) {
                usuarioInput.classList.remove('is-invalid');
                usuarioInput.nextElementSibling?.classList.contains('invalid-feedback') && usuarioInput.nextElementSibling.remove();
            }
        }
    });

    el('estNivel')?.addEventListener('change', actualizarCamposNivel);
    el('btnTogglePassEst')?.addEventListener('click', togglePassEst);
    el('btnGuardarPassEst')?.addEventListener('click', guardarNuevaPassEst);

    document.querySelectorAll('#formEstudiante input, #formEstudiante select, #formEstudiante textarea').forEach(campo => {
        campo.addEventListener('input', () => {
            if (campo.classList.contains('is-invalid')) {
                campo.classList.remove('is-invalid');
                campo.nextElementSibling?.classList.contains('invalid-feedback') && campo.nextElementSibling.remove();
            }
        });
    });
    el('credEstPass')?.addEventListener('input', () => {
        if (el('credEstPass').classList.contains('is-invalid')) {
            el('credEstPass').classList.remove('is-invalid');
            el('credEstPass').nextElementSibling?.classList.contains('invalid-feedback') && el('credEstPass').nextElementSibling.remove();
        }
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
