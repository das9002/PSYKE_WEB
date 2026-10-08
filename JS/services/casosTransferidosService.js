

const RUTA_TRANSFERENCIAS = '/transferencias';

const CasosTransferidosService = {
    listar() {
        return listarTodo(RUTA_TRANSFERENCIAS);
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
        return listarTodo('/estudiantes');
    },

    listarPsicologos() {
        return listarTodo('/psicologos');
    },

    listarExpedientes() {
        return listarTodo('/expedientes');
    },

    crearExpediente(expediente) {
        return peticionApi('/expedientes', {
            method: 'POST',
            body: JSON.stringify(expediente)
        });
    }
};