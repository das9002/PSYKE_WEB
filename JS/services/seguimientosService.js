

const SeguimientosService = {
    listar() {
        return peticionApi('/sesiones').then(res => typeof normalizarListado === 'function' ? normalizarListado(res) : (Array.isArray(res) ? res : (res?.content || [])));
    },

    obtenerPorId(id) {
        return peticionApi(`/sesiones/${id}`);
    },

    crear(seguimiento) {
        return peticionApi('/sesiones', {
            method: 'POST',
            body: JSON.stringify(seguimiento)
        });
    },

    actualizar(id, seguimiento) {
        return peticionApi(`/sesiones/${id}`, {
            method: 'PUT',
            body: JSON.stringify(seguimiento)
        });
    },

    eliminar(id) {
        return peticionApi(`/sesiones/${id}`, { method: 'DELETE' });
    },

    listarExpedientes() {
        return peticionApi('/expedientes').then(res => typeof normalizarListado === 'function' ? normalizarListado(res) : (Array.isArray(res) ? res : (res?.content || [])));
    },

    listarEstudiantes() {
        return peticionApi('/estudiantes').then(res => typeof normalizarListado === 'function' ? normalizarListado(res) : (Array.isArray(res) ? res : (res?.content || [])));
    },

    listarPsicologos() {
        return peticionApi('/psicologos').then(res => typeof normalizarListado === 'function' ? normalizarListado(res) : (Array.isArray(res) ? res : (res?.content || [])));
    },

    listarCitas() {
        return peticionApi('/citas').then(res => typeof normalizarListado === 'function' ? normalizarListado(res) : (Array.isArray(res) ? res : (res?.content || [])));
    },

    actualizarExpediente(id, expediente) {
        return peticionApi(`/expedientes/${id}`, {
            method: 'PUT',
            body: JSON.stringify(expediente)
        });
    }
};
