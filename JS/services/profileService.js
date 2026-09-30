const ProfileService = {
    /**
     * Obtiene el ID del usuario en sesión desde la caché local o helper global.
     */
    _obtenerIdUsuarioActual() {
        if (typeof window.obtenerUsuario === 'function') {
            const user = window.obtenerUsuario();
            if (user) {
                return user.id || user.idUsuario || user.usuarioId || user.sub;
            }
        }
        try {
            const raw = localStorage.getItem('psyke_user') || localStorage.getItem('user');
            if (raw) {
                const user = JSON.parse(raw);
                return user.id || user.idUsuario || user.usuarioId || user.sub;
            }
        } catch (e) {
            console.error('[ProfileService] Error al leer datos locales del usuario:', e);
        }
        return null;
    },

    /**
     * Obtiene la información del perfil del usuario.
     * @param {string|number} [idUsuario] - ID opcional. Si no se provee, usará el del usuario en sesión.
     * @returns {Promise<Object>}
     */
    async obtenerPerfil(idUsuario) {
        const id = idUsuario || this._obtenerIdUsuarioActual();

        if (!id) {
            return Promise.reject(new Error('No se pudo determinar el ID del usuario para obtener el perfil.'));
        }

        if (typeof window.peticionApi === 'function') {
            return window.peticionApi(`/usuarios/${id}`);
        } else if (typeof window.apiFetch === 'function') {
            return window.apiFetch(`/usuarios/${id}`);
        } else {
            return Promise.reject(new Error('No se encontró la función global peticionApi o apiFetch.'));
        }
    },

    /**
     * Actualiza la información del perfil del usuario.
     * Permite llamarlo de dos formas:
     *   1. actualizarPerfil(idUsuario, datos)
     *   2. actualizarPerfil(datos) -> Usará el ID del usuario en sesión automáticamente.
     *
     * @param {string|number|Object} idUsuarioODatos - ID del usuario O los datos si no se pasa ID.
     * @param {Object} [datos] - Objeto con la información a actualizar.
     * @returns {Promise<Object>}
     */
    async actualizarPerfil(idUsuarioODatos, datos) {
        let id;
        let payload;

        // Si el primer parámetro es un objeto, asumimos que se enviaron directamente los datos
        if (typeof idUsuarioODatos === 'object' && idUsuarioODatos !== null) {
            payload = idUsuarioODatos;
            id = this._obtenerIdUsuarioActual();
        } else {
            id = idUsuarioODatos || this._obtenerIdUsuarioActual();
            payload = datos;
        }

        if (!id) {
            return Promise.reject(new Error('No se pudo determinar el ID del usuario para actualizar el perfil.'));
        }

        if (!payload || typeof payload !== 'object') {
            return Promise.reject(new Error('Los datos a actualizar deben ser un objeto válido.'));
        }

        const bodyContent = typeof payload === 'string' ? payload : JSON.stringify(payload);

        if (typeof window.peticionApi === 'function') {
            return window.peticionApi(`/usuarios/${id}`, {
                method: 'PUT',
                body: bodyContent
            });
        } else if (typeof window.apiFetch === 'function') {
            return window.apiFetch(`/usuarios/${id}`, {
                method: 'PUT',
                body: bodyContent
            });
        } else {
            return Promise.reject(new Error('No se encontró la función global peticionApi o apiFetch.'));
        }
    }
};

// Exportar globalmente para que esté disponible en toda la aplicación
window.ProfileService = ProfileService;
