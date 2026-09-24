

const SeguimientosService = {
    listar() {
        return peticionApi('/sesiones');
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
        return peticionApi('/expedientes');
    },

    listarEstudiantes() {
        return peticionApi('/estudiantes');
    },

    listarPsicologos() {
        return peticionApi('/psicologos');
    },

    listarCitas() {
        return peticionApi('/citas');
    },

    actualizarExpediente(id, expediente) {
        return peticionApi(`/expedientes/${id}`, {
            method: 'PUT',
            body: JSON.stringify(expediente)
        });
    }
};
