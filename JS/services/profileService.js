const ProfileService = {
    async obtenerPsicologoPorUsuario(idUsuario) {
        const tamano = 50;
        for (let pagina = 0; pagina < 20; pagina++) {
            const respuesta = await apiFetch(`/psicologos?page=${pagina}&size=${tamano}`);
            const lista = normalizarListado(respuesta);
            const encontrado = lista.find(p => Number(p?.usuario?.idUsuario) === Number(idUsuario));
            if (encontrado) return encontrado;
            if (!respuesta || respuesta.last !== false || lista.length === 0) return null;
        }
        return null;
    }
};

window.ProfileService = ProfileService;
