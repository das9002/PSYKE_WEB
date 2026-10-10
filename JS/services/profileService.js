const ProfileService = {
    // Pide solo el perfil del usuario con la sesión iniciada. Antes recorría página por página
    // la lista completa de psicólogos hasta encontrarlo.
    async obtenerPsicologoPorUsuario() {
        try {
            return await apiFetch('/psicologos/mi-perfil');
        } catch (error) {
            if (error && error.status === 404) return null;
            throw error;
        }
    }
};

window.ProfileService = ProfileService;
