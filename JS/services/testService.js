

const TestService = {
    async listarCuestionarios() {
        try {
            const lista = await peticionApi('/cuestionarios');
            return typeof normalizarListado === 'function' ? normalizarListado(lista) : (Array.isArray(lista) ? lista : (lista?.content || []));
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

    obtenerCuestionarioPorId(id) {
        return peticionApi(`/cuestionarios/${id}`);
    },

    buscarCuestionarios(termino) {
        return peticionApi(`/cuestionarios?search=${encodeURIComponent(termino)}`).then(res => typeof normalizarListado === 'function' ? normalizarListado(res) : (Array.isArray(res) ? res : (res?.content || [])));
    },

    crearCuestionario(cuestionario) {
        return peticionApi('/cuestionarios', {
            method: 'POST',
            body: JSON.stringify(cuestionario)
        });
    },

    actualizarCuestionario(id, cuestionario) {
        return peticionApi(`/cuestionarios/${id}`, {
            method: 'PUT',
            body: JSON.stringify(cuestionario)
        });
    },

    eliminarCuestionario(id) {
        return peticionApi(`/cuestionarios/${id}`, { method: 'DELETE' });
    },

    listarPreguntas() {
        return peticionApi('/preguntas').then(res => typeof normalizarListado === 'function' ? normalizarListado(res) : (Array.isArray(res) ? res : (res?.content || [])));
    },

    crearPregunta(pregunta) {
        return peticionApi('/preguntas', {
            method: 'POST',
            body: JSON.stringify(pregunta)
        });
    },

    eliminarPregunta(id) {
        return peticionApi(`/preguntas/${id}`, { method: 'DELETE' });
    },

    listarTestsRespondidos() {
        return peticionApi('/tests-respondidos').then(res => typeof normalizarListado === 'function' ? normalizarListado(res) : (Array.isArray(res) ? res : (res?.content || [])));
    },

    obtenerTestRespondidoPorId(id) {
        return peticionApi(`/tests-respondidos/${id}`);
    },

    listarPorCuestionario(idCuestionario) {
        return peticionApi(`/tests-respondidos?cuestionarioId=${idCuestionario}`).then(res => typeof normalizarListado === 'function' ? normalizarListado(res) : (Array.isArray(res) ? res : (res?.content || [])));
    },

    crearTestRespondido(testRespondido) {
        return peticionApi('/tests-respondidos', {
            method: 'POST',
            body: JSON.stringify(testRespondido)
        });
    },

    actualizarTestRespondido(id, testRespondido) {
        return peticionApi(`/tests-respondidos/${id}`, {
            method: 'PUT',
            body: JSON.stringify(testRespondido)
        });
    },

    eliminarTestRespondido(id) {
        return peticionApi(`/tests-respondidos/${id}`, { method: 'DELETE' });
    },

    listarEstudiantes() {
        return peticionApi('/estudiantes').then(res => typeof normalizarListado === 'function' ? normalizarListado(res) : (Array.isArray(res) ? res : (res?.content || [])));
    }
};