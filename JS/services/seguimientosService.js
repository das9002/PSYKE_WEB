

const SeguimientosService = {
    listar() {
        return listarTodo('/sesiones');
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
        return listarTodo('/expedientes');
    },

    listarEstudiantes() {
        return listarTodo('/estudiantes');
    },

    listarPsicologos() {
        return listarTodo('/psicologos');
    },

    listarCitas() {
        return listarTodo('/citas');
    },

    actualizarExpediente(id, expediente) {
        return peticionApi(`/expedientes/${id}`, {
            method: 'PUT',
            body: JSON.stringify(expediente)
        });
    }
};
