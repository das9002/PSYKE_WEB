// Grados, secciones y especialidades casi no cambian: se guardan 10 minutos entre páginas
// (la caché se vacía sola al crear o eliminar uno)
function listarCatalogo(ruta) {
    if (typeof conCacheDeSesion !== 'function') return listarTodo(ruta);
    return conCacheDeSesion(`catalogo:${ruta}`, 10 * 60 * 1000, () => listarTodo(ruta));
}

const EstudiantesService = {
    listar() {
        return listarTodo('/estudiantes');
    },

    obtenerPorId(id) {
        return peticionApi(`/estudiantes/${id}`);
    },

    misEstudiantes() {
        return peticionApi('/estudiantes/mis-estudiantes');
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
        return listarCatalogo('/grados');
    },

    crearGrado(grado) {
        return peticionApi('/grados', { method: 'POST', body: JSON.stringify(grado) });
    },

    eliminarGrado(id) {
        return peticionApi(`/grados/${id}`, { method: 'DELETE' });
    },

    listarSecciones() {
        return listarCatalogo('/secciones');
    },

    crearSeccion(seccion) {
        return peticionApi('/secciones', { method: 'POST', body: JSON.stringify(seccion) });
    },

    eliminarSeccion(id) {
        return peticionApi(`/secciones/${id}`, { method: 'DELETE' });
    },

    listarEspecialidades() {
        return listarCatalogo('/especialidades');
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
