

const RUTA_TRANSFERENCIAS = '/transferencias';

const CasosTransferidosService = {
    listar() {
        return peticionApi(RUTA_TRANSFERENCIAS);
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
        return peticionApi('/estudiantes');
    },

    listarPsicologos() {
        return peticionApi('/psicologos');
    },

    listarExpedientes() {
        return peticionApi('/expedientes');
    },

    crearExpediente(expediente) {
        return peticionApi('/expedientes', {
            method: 'POST',
            body: JSON.stringify(expediente)
        });
    }
};