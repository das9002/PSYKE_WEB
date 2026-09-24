

const PsicologosService = {
    listar() {
        return peticionApi('/psicologos');
    },

    obtenerPorId(id) {
        return peticionApi(`/psicologos/${id}`);
    },

    crear(psicologo) {
        return peticionApi('/psicologos', {
            method: 'POST',
            body: JSON.stringify(psicologo)
        });
    },

    actualizar(id, psicologo) {
        return peticionApi(`/psicologos/${id}`, {
            method: 'PUT',
            body: JSON.stringify(psicologo)
        });
    },

    eliminar(id) {
        return peticionApi(`/psicologos/${id}`, { method: 'DELETE' });
    },

    crearUsuario(usuario) {
        return peticionApi('/usuarios', {
            method: 'POST',
            body: JSON.stringify(usuario)
        });
    },

    actualizarUsuario(idUsuario, datos) {
        return peticionApi(`/usuarios/${idUsuario}`, {
            method: 'PUT',
            body: JSON.stringify(datos)
        });
    },

    listarCitas() {
        return peticionApi('/citas');
    }
};