

const RUTA_TRANSFERENCIAS = '/transferencias';

const CasosTransferidosService = {
    listar() {
        return peticionApi(RUTA_TRANSFERENCIAS).then(res => typeof normalizarListado === 'function' ? normalizarListado(res) : (Array.isArray(res) ? res : (res?.content || [])));
    },

    obtenerPorId(id) {
        return peticionApi(`${RUTA_TRANSFERENCIAS}/${id}`);
    },

    crear(transferencia) {
        return peticionApi(RUTA_TRANSFERENCIAS, {
            method: 'POST',
            body: JSON.stringify(transferencia)
        });
    },

    actualizar(id, transferencia) {
        return peticionApi(`${RUTA_TRANSFERENCIAS}/${id}`, {
            method: 'PUT',
            body: JSON.stringify(transferencia)
        });
    },

    eliminar(id) {
        return peticionApi(`${RUTA_TRANSFERENCIAS}/${id}`, { method: 'DELETE' });
    },

    listarEstudiantes() {
        return peticionApi('/estudiantes').then(res => typeof normalizarListado === 'function' ? normalizarListado(res) : (Array.isArray(res) ? res : (res?.content || [])));
    },

    listarPsicologos() {
        return peticionApi('/psicologos').then(res => typeof normalizarListado === 'function' ? normalizarListado(res) : (Array.isArray(res) ? res : (res?.content || [])));
    },

    listarExpedientes() {
        return peticionApi('/expedientes').then(res => typeof normalizarListado === 'function' ? normalizarListado(res) : (Array.isArray(res) ? res : (res?.content || [])));
    },

    crearExpediente(expediente) {
        return peticionApi('/expedientes', {
            method: 'POST',
            body: JSON.stringify(expediente)
        });
    }
};