(function (global) {
    'use strict';

    async function miPerfil() {
        try {
            return await global.peticionApi('/psicologos/mi-perfil');
        } catch (error) {
            if (error && error.status === 404) return null;
            throw error;
        }
    }

    async function cerrarSesion() {
        try {
            await global.authFetch('/logout', { method: 'POST' });
        } catch (e) { }
    }

    global.SesionService = { miPerfil, cerrarSesion };
})(window);
