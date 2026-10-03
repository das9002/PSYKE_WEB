

const EstudiantesService = {
    listar() {
        return listarTodo('/estudiantes');
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
        return listarTodo('/grados');
    },

    crearGrado(grado) {
        return peticionApi('/grados', { method: 'POST', body: JSON.stringify(grado) });
    },

    eliminarGrado(id) {
        return peticionApi(`/grados/${id}`, { method: 'DELETE' });
    },

    listarSecciones() {
        return listarTodo('/secciones');
    },

    crearSeccion(seccion) {
        return peticionApi('/secciones', { method: 'POST', body: JSON.stringify(seccion) });
    },

    eliminarSeccion(id) {
        return peticionApi(`/secciones/${id}`, { method: 'DELETE' });
    },

    listarEspecialidades() {
        return listarTodo('/especialidades');
    },

    crearEspecialidad(esp) {
        return peticionApi('/especialidades', { method: 'POST', body: JSON.stringify(esp) });
    },

    eliminarEspecialidad(id) {
        return peticionApi(`/especialidades/${id}`, { method: 'DELETE' });
    },

    actualizarUsuario(idUsuario, datos) {
        return peticionApi(`/usuarios/${idUsuario}`, {
            method: 'PUT',
            body: JSON.stringify(datos)
        });
    }
};
