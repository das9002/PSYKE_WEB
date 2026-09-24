
document.addEventListener('DOMContentLoaded', () => {

    const estado = {
        grados: [],
        secciones: [],
        especialidades: []
    };

    const CATALOGO_NIVELES = {
        'Bachillerato': {
            grados: ['1° Año', '2° Año', '3° Año'],
            secciones: ['A-1', 'A-2', 'A-3', 'A-4', 'A-5', 'B-1', 'B-2', 'B-3', 'B-4']
        },
        'Tercer Ciclo': {
            grados: ['7° Grado', '8° Grado', '9° Grado'],
            secciones: ['A', 'B', 'C', 'D', 'E', 'F']
        }
    };

    const NIVEL_ID = { 'Bachillerato': 2, 'Tercer Ciclo': 1 };

    function el(id) {
        return document.getElementById(id);
    }

    function crearOpcion(valor, lista, campoNombre, campoId) {
        const opt = document.createElement('option');
        opt.value = valor;
        opt.textContent = valor;
        const coincide = (lista ?? []).find(item =>
            String(item[campoNombre] ?? '').trim().toLowerCase() === valor.toLowerCase()
        );
        if (coincide && coincide[campoId] != null) {
            opt.dataset.id = coincide[campoId];
        }
        return opt;
    }

    function llenarSelect(select, valores, lista, campoNombre, campoId, textoPlaceholder) {
        if (!select) return;
        select.innerHTML = '';

        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = textoPlaceholder ?? 'Seleccione una opción';
        placeholder.selected = true;
        placeholder.disabled = true;
        select.appendChild(placeholder);

        valores.forEach(valor => {
            select.appendChild(crearOpcion(valor, lista, campoNombre, campoId));
        });
    }

    function actualizarCamposNivel() {
        const nivel = el('standaloneNivel')?.value;
        const gradoSelect = el('standaloneGrado');
        const seccionSelect = el('standaloneSeccion');
        const especialidadSelect = el('standaloneEspecialidad');

        if (!gradoSelect || !seccionSelect || !especialidadSelect) return;

        const catalogo = CATALOGO_NIVELES[nivel] ?? CATALOGO_NIVELES['Bachillerato'];
        const gradosDelNivel = estado.grados.filter(g => g.idNivel === NIVEL_ID[nivel]);

        llenarSelect(gradoSelect, catalogo.grados, gradosDelNivel, 'nombreGrado', 'idGrado', 'Seleccione el grado');
        llenarSelect(seccionSelect, catalogo.secciones, estado.secciones, 'nombreSeccion', 'idSeccion', 'Seleccione la sección');

        if (nivel === 'Tercer Ciclo') {
            especialidadSelect.value = '';
            especialidadSelect.disabled = true;
        } else {
            especialidadSelect.disabled = false;
            if (!especialidadSelect.value && estado.especialidades.length > 0) {
                especialidadSelect.value = estado.especialidades[0].idEspecialidad;
            }
        }
    }

    function limpiarErrores() {
        document.querySelectorAll('#formAgregarEstudianteStandalone .is-invalid')
            .forEach(c => c.classList.remove('is-invalid'));
        document.querySelectorAll('#formAgregarEstudianteStandalone .invalid-feedback')
            .forEach(fb => fb.remove());
    }

    function mostrarErrores(errores) {
        const mapa = {
            codigoCarnet: 'standaloneCarnet',
            nombres: 'standaloneNombres',
            apellidos: 'standaloneApellidos',
            correo: 'standaloneUsuario',
            usuario: 'standaloneUsuario',
            grado: 'standaloneGrado',
            seccion: 'standaloneSeccion',
            informacionFamiliar: 'standaloneInfoFamiliar'
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

    function estadoFormularioAClinico(valor) {
        if (valor === 'Estable') return 'Normal';
        if (valor === 'Seguimiento') return 'En Seguimiento';
        return valor ?? 'Normal';
    }

    async function guardar(e) {
        e.preventDefault();
        limpiarErrores();

        const carnet = el('standaloneCarnet').value.trim();
        const correo = el('standaloneUsuario').value.trim() || `${carnet}@ricaldone.edu.sv`;

        const datos = {
            codigoCarnet: carnet,
            nombres: el('standaloneNombres').value.trim(),
            apellidos: el('standaloneApellidos').value.trim(),
            correo,
            grado: el('standaloneGrado').value,
            seccion: el('standaloneSeccion').value,
            informacionFamiliar: el('standaloneInfoFamiliar').value.trim()
        };

        const validacion = EstudiantesValidaciones.validarEstudiante(datos);
        if (!validacion.valido) {
            mostrarErrores(validacion.errores);
            return;
        }

        const payload = {
            codigoCarnet: carnet,
            nombres: datos.nombres,
            apellidos: datos.apellidos,
            usuario: {
                correo,
                contrasena: 'Estudiante2026*',
                tipoUsuario: 'ESTUDIANTE',
                estadoCuenta: 'ACTIVO'
            },
            estadoClinico: estadoFormularioAClinico(el('standaloneEstado').value),
            informacionFamiliar: datos.informacionFamiliar
        };

        const gradoOpt = el('standaloneGrado').selectedOptions[0];
        const gradoId = Number(gradoOpt?.dataset?.id);
        payload.grado = gradoId ? { idGrado: gradoId } : { nombreGrado: el('standaloneGrado').value };

        const seccionOpt = el('standaloneSeccion').selectedOptions[0];
        const seccionId = Number(seccionOpt?.dataset?.id);
        payload.seccion = seccionId ? { idSeccion: seccionId } : { nombreSeccion: el('standaloneSeccion').value };

        const especialidadId = Number(el('standaloneEspecialidad').value);
        if (especialidadId && !el('standaloneEspecialidad').disabled) payload.especialidad = { idEspecialidad: especialidadId };

        try {
            await EstudiantesService.crear(payload);
            Notif.credenciales(
                '¡Estudiante registrado con éxito!',
                `Se generaron las credenciales de acceso:<br><br><strong>Usuario:</strong> ${correo}<br><strong>Contraseña:</strong> <code>Estudiante2026*</code>`
            ).then(() => {
                window.location.href = '../HTML/estudiante.html';
            });
        } catch (error) {
            Notif.error(mensajeErrorAmigable(error), 'No se pudo guardar el estudiante');
        }
    }

    async function inicializar() {
        try {
            const [grados, secciones, especialidades] = await Promise.all([
                EstudiantesService.listarGrados(),
                EstudiantesService.listarSecciones(),
                EstudiantesService.listarEspecialidades()
            ]);

            estado.grados = grados ?? [];
            estado.secciones = secciones ?? [];
            estado.especialidades = especialidades ?? [];
        } catch (error) {
            Notif.error(`No se pudo conectar con el servidor. Verifique que el backend esté activo en ${API_BASE_URL}. ${error.message}`);
        }

        el('formAgregarEstudianteStandalone')?.addEventListener('submit', guardar);
        el('standaloneNivel')?.addEventListener('change', actualizarCamposNivel);

        actualizarCamposNivel();

        document.querySelectorAll('#formAgregarEstudianteStandalone input, #formAgregarEstudianteStandalone select, #formAgregarEstudianteStandalone textarea').forEach(campo => {
            campo.addEventListener('input', () => {
                if (campo.classList.contains('is-invalid')) {
                    campo.classList.remove('is-invalid');
                    campo.nextElementSibling?.classList.contains('invalid-feedback') && campo.nextElementSibling.remove();
                }
            });
        });
    }

    inicializar();
});