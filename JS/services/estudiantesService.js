

const EstudiantesService = {
    listar() {
        return peticionApi('/estudiantes');
    },

    obtenerPorId(id) {
        return peticionApi(`/estudiantes/${id}`);
    },

    crear(estudiante) {
        return peticionApi('/estudiantes', {
            method: 'POST',
            body: JSON.stringify(estudiante)
        });
    },

    actualizar(id, estudiante) {
        return peticionApi(`/estudiantes/${id}`, {
            method: 'PUT',
            body: JSON.stringify(estudiante)
        });
    },

    eliminar(id) {
        return peticionApi(`/estudiantes/${id}`, { method: 'DELETE' });
    },

    listarGrados() {
        return peticionApi('/grados');
    },

    listarSecciones() {
        return peticionApi('/secciones');
    },

    listarEspecialidades() {
        return peticionApi('/especialidades');
    },

    actualizarUsuario(idUsuario, datos) {
        return peticionApi(`/usuarios/${idUsuario}`, {
            method: 'PUT',
            body: JSON.stringify(datos)
        });
    }
};
