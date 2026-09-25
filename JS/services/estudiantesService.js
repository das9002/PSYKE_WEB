

const EstudiantesService = {
    listar() {
        return peticionApi('/estudiantes').then(res => typeof normalizarListado === 'function' ? normalizarListado(res) : (Array.isArray(res) ? res : (res?.content || [])));
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
        return peticionApi('/grados').then(res => typeof normalizarListado === 'function' ? normalizarListado(res) : (Array.isArray(res) ? res : (res?.content || [])));
    },

    listarSecciones() {
        return peticionApi('/secciones').then(res => typeof normalizarListado === 'function' ? normalizarListado(res) : (Array.isArray(res) ? res : (res?.content || [])));
    },

    listarEspecialidades() {
        return peticionApi('/especialidades').then(res => typeof normalizarListado === 'function' ? normalizarListado(res) : (Array.isArray(res) ? res : (res?.content || [])));
    },

    actualizarUsuario(idUsuario, datos) {
        return peticionApi(`/usuarios/${idUsuario}`, {
            method: 'PUT',
            body: JSON.stringify(datos)
        });
    }
};
