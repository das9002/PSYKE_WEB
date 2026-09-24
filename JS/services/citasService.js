
const ESTADOS_CITA = ['PENDIENTE', 'CONFIRMADA', 'REALIZADA', 'CANCELADA'];

const EXP_HORA_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

function esIdValido(id) {
    return Number.isInteger(Number(id)) && Number(id) > 0;
}

function fechaHoraValida(valor) {
    if (!valor) return false;
    const fecha = new Date(valor);
    return !isNaN(fecha.getTime());
}

function crearErrorValidacion(errores) {
    const error = new Error(Object.values(errores).join(' '));
    error.errores = errores;
    error.tipo = 'VALIDACION';
    return error;
}

function normalizarListado(respuesta) {
    if (respuesta === null || respuesta === undefined) return [];
    if (Array.isArray(respuesta)) return respuesta;

    const contenedores = ['content', 'data', 'citas', 'lista', 'listado', 'resultado', 'result', 'records'];
    for (const clave of contenedores) {
        if (Array.isArray(respuesta[clave])) return respuesta[clave];
    }

    if (Array.isArray(respuesta._embedded)) return respuesta._embedded;
    if (respuesta._embedded && typeof respuesta._embedded === 'object') {
        const claves = Object.keys(respuesta._embedded);
        if (claves.length > 0 && Array.isArray(respuesta._embedded[claves[0]])) {
            return respuesta._embedded[claves[0]];
        }
    }

    return [];
}

const CitasService = {

    listar() {
        return peticionApi('/citas').then(normalizarListado);
    },

    obtenerPorId(id) {
        if (!esIdValido(id)) {
            return Promise.reject(crearErrorValidacion({ id: 'Se requiere el identificador de la cita.' }));
        }
        return peticionApi(`/citas/${id}`);
    },

    crear(cita) {
        const validacion = CitasService.validarPayload(cita);
        if (!validacion.valido) {
            return Promise.reject(crearErrorValidacion(validacion.errores));
        }
        return peticionApi('/citas', {
            method: 'POST',
            body: JSON.stringify(cita)
        });
    },

    actualizar(id, cita) {
        if (!esIdValido(id)) {
            return Promise.reject(crearErrorValidacion({ id: 'Se requiere el identificador de la cita.' }));
        }
        const validacion = CitasService.validarPayload(cita);
        if (!validacion.valido) {
            return Promise.reject(crearErrorValidacion(validacion.errores));
        }
        return peticionApi(`/citas/${id}`, {
            method: 'PUT',
            body: JSON.stringify(cita)
        });
    },

    cambiarEstado(id, estado, citaCompleta) {
        if (!esIdValido(id)) {
            return Promise.reject(crearErrorValidacion({ id: 'Se requiere el identificador de la cita.' }));
        }
        const nuevoEstado = String(estado ?? '').toUpperCase();
        if (!ESTADOS_CITA.includes(nuevoEstado)) {
            return Promise.reject(crearErrorValidacion({
                estado: `El estado '${estado}' no es válido. Valores permitidos: ${ESTADOS_CITA.join(', ')}.`
            }));
        }

        const base = citaCompleta && typeof citaCompleta === 'object' ? citaCompleta : {};
        const estudiante = base.estudiante && typeof base.estudiante === 'object'
            ? { idEstudiante: base.estudiante.idEstudiante ?? base.estudiante.id }
            : { idEstudiante: base.idEstudiante };
        const psicologo = base.psicologo && typeof base.psicologo === 'object'
            ? { idPsicologo: base.psicologo.idPsicologo ?? base.psicologo.id }
            : { idPsicologo: base.idPsicologo };

        const payload = {
            estudiante,
            psicologo,
            fechaHoraCita: base.fechaHoraCita ?? base.fecha ?? base.fechaCita,
            estadoConfirmacion: nuevoEstado
        };

        return peticionApi(`/citas/${id}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        });
    },

    eliminar(id) {
        if (!esIdValido(id)) {
            return Promise.reject(crearErrorValidacion({ id: 'Se requiere el identificador de la cita.' }));
        }
        return peticionApi(`/citas/${id}`, { method: 'DELETE' });
    },

    validarPayload(cita) {
        if (!cita || typeof cita !== 'object') {
            return { valido: false, errores: { payload: 'La cita no es un objeto válido.' } };
        }

        const errores = {};

        const idEstudiante = cita.estudiante?.idEstudiante ?? cita.idEstudiante;
        if (!esIdValido(idEstudiante)) {
            errores.idEstudiante = 'La cita debe incluir un estudiante válido (idEstudiante).';
        }

        const idPsicologo = cita.psicologo?.idPsicologo ?? cita.idPsicologo;
        if (!esIdValido(idPsicologo)) {
            errores.idPsicologo = 'La cita debe incluir un psicólogo válido (idPsicologo).';
        }

        const fechaHora = cita.fechaHoraCita ?? cita.fecha;
        if (!fechaHoraValida(fechaHora)) {
            errores.fechaHoraCita = 'La fecha y hora de la cita son obligatorias y deben ser válidas.';
        } else if (!EXP_HORA_ISO.test(String(fechaHora))) {
            errores.fechaHoraCita = 'La fecha y hora deben enviarse en formato ISO (YYYY-MM-DDTHH:mm).';
        }

        const estado = String(cita.estado ?? '').toUpperCase();
        if (!ESTADOS_CITA.includes(estado)) {
            errores.estado = `El estado debe ser uno de: ${ESTADOS_CITA.join(', ')}.`;
        }

        if (cita.motivo !== undefined && cita.motivo !== null && String(cita.motivo).trim().length > 500) {
            errores.motivo = 'El motivo no puede superar los 500 caracteres.';
        }

        return {
            valido: Object.keys(errores).length === 0,
            errores
        };
    },

    estadosPermitidos() {
        return ESTADOS_CITA.slice();
    }
};