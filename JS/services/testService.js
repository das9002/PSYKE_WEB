/**
 * Normaliza los tipos de respuesta provistos desde la interfaz de usuario
 * hacia las constantes permitidas por el DTO y la base de datos Oracle.
 */
function normalizarTipoRespuesta(tipo) {
    if (!tipo) return tipo;
    const mapaTipos = {
        'Pregunta abierta': 'TEXTO_LIBRE',
        'Escala Likert': 'ESCALA',
        'Opción múltiple': 'OPCION_MULTIPLE',
        'texto_libre': 'TEXTO_LIBRE',
        'escala': 'ESCALA',
        'opcion_multiple': 'OPCION_MULTIPLE'
    };
    return mapaTipos[tipo.trim()] || tipo;
}

/**
 * Helper interno para extraer arreglos de respuestas paginadas o directas.
 */
function procesarListado(res) {
    if (typeof normalizarListado === 'function') {
        return normalizarListado(res);
    }
    return Array.isArray(res) ? res : (res?.content || []);
}

const TestService = {
    // ==========================================
    // CUESTIONARIOS
    // ==========================================
    async listarCuestionarios() {
        try {
            const lista = await listarTodo('/cuestionarios');
            return procesarListado(lista);
        } catch (error) {
            const mensaje = error?.status === 500
                ? 'Ocurrió un error interno en el servidor al cargar los cuestionarios. Inténtelo de nuevo más tarde.'
                : (error?.message || 'No se pudo conectar con el servidor.');
            if (typeof Notif !== 'undefined') {
                Notif.error(mensaje, 'No se pudo cargar el catálogo');
            }
            return [];
        }
    },

    async obtenerCuestionarioPorId(id) {
        return await peticionApi(`/cuestionarios/${id}`);
    },

    async buscarCuestionarios(termino) {
        const res = await listarTodo(`/cuestionarios?search=${encodeURIComponent(termino)}`);
        return procesarListado(res);
    },

    async crearCuestionario(cuestionario) {
        return await peticionApi('/cuestionarios', {
            method: 'POST',
            body: JSON.stringify(cuestionario)
        });
    },

    async actualizarCuestionario(id, cuestionario) {
        return await peticionApi(`/cuestionarios/${id}`, {
            method: 'PUT',
            body: JSON.stringify(cuestionario)
        });
    },

    async eliminarCuestionario(id) {
        return await peticionApi(`/cuestionarios/${id}`, { method: 'DELETE' });
    },

    // ==========================================
    // PREGUNTAS
    // ==========================================
    async listarPreguntas() {
        const res = await listarTodo('/preguntas');
        return procesarListado(res);
    },

    async crearPregunta(pregunta) {
        const tipoOriginal = pregunta.tipoRespuesta || pregunta.tipo;
        
        const cuestionarioObj = (typeof pregunta.cuestionario === 'number' || typeof pregunta.cuestionario === 'string')
            ? { idCuestionario: Number(pregunta.cuestionario) }
            : pregunta.cuestionario;

        const payload = {
            ...pregunta,
            cuestionario: cuestionarioObj,
            tipoRespuesta: normalizarTipoRespuesta(tipoOriginal)
        };

        return await peticionApi('/preguntas', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    },

    async eliminarPregunta(id) {
        return await peticionApi(`/preguntas/${id}`, { method: 'DELETE' });
    },

    // ==========================================
    // TESTS RESPONDIDOS
    // ==========================================
    async listarTestsRespondidos() {
        const res = await listarTodo('/tests-respondidos');
        return procesarListado(res);
    },

    async obtenerTestRespondidoPorId(id) {
        return await peticionApi(`/tests-respondidos/${id}`);
    },

    async listarPorCuestionario(idCuestionario) {
        const res = await listarTodo(`/tests-respondidos?cuestionarioId=${idCuestionario}`);
        return procesarListado(res);
    },

    async crearTestRespondido(testRespondido) {
        return await peticionApi('/tests-respondidos', {
            method: 'POST',
            body: JSON.stringify(testRespondido)
        });
    },

    async actualizarTestRespondido(id, testRespondido) {
        return await peticionApi(`/tests-respondidos/${id}`, {
            method: 'PUT',
            body: JSON.stringify(testRespondido)
        });
    },

    async eliminarTestRespondido(id) {
        return await peticionApi(`/tests-respondidos/${id}`, { method: 'DELETE' });
    },

    // ==========================================
    // DETALLES DE RESPUESTAS
    // ==========================================
    async listarDetallesPorTest(idTestRespondido) {
        const res = await peticionApi(`/detalles-respuestas?idTestRespondido=${idTestRespondido}`);
        return procesarListado(res);
    },

    async crearDetalleRespuesta(detalle) {
        return await peticionApi('/detalles-respuestas', {
            method: 'POST',
            body: JSON.stringify(detalle)
        });
    },

    // ==========================================
    // ESTUDIANTES
    // ==========================================
    async listarEstudiantes() {
        const res = await peticionApi('/estudiantes');
        return procesarListado(res);
    }
};
