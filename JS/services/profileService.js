

const ProfileService = {

    obtenerPerfil(idUsuario) {
        return peticionApi(`/usuarios/${idUsuario}`);
    },

    actualizarPerfil(idUsuario, datos) {
        return peticionApi(`/usuarios/${idUsuario}`, {
            method: 'PUT',
            body: JSON.stringify(datos)
        });
    }
};