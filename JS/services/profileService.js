const ProfileService = {
    /**
     * Obtiene el token JWT guardado en el almacenamiento local.
     * @returns {string|null}
     */
    _obtenerToken() {
        return localStorage.getItem('psyke_token') || 
               localStorage.getItem('token') || 
               localStorage.getItem('jwt');
    },

    /**
     * Obtiene el ID del usuario en sesión desde la caché local o helper global.
     * @returns {string|number|null}
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
     * Realiza peticiones HTTP asegurando que se incluyan las cabeceras de autenticación.
     * @param {string} endpoint - Ruta relativa del endpoint.
     * @param {Object} [options={}] - Opciones adicionales de fetch.
     * @returns {Promise<any>}
     */
    async _hacerPeticion(endpoint, options = {}) {
        const token = this._obtenerToken();
        
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };

        // Incluye la cabecera Authorization si existe un token
        if (token && !headers['Authorization'] && !headers['authorization']) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const config = {
            ...options,
            headers,
            credentials: 'include' // Para peticiones CORS entre Vercel y Heroku
        };

        // Usa helpers globales si existen
        if (typeof window.peticionApi === 'function') {
            return window.peticionApi(endpoint, config);
        } else if (typeof window.apiFetch === 'function') {
            return window.apiFetch(endpoint, config);
        } else {
            // Fallback directo a la API
            const baseUrl = window.ENV?.API_URL || window.API_URL || 'https://api-auth-1b19165bcf87.herokuapp.com/api';
            const res = await fetch(`${baseUrl}${endpoint}`, config);
            
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || `Error ${res.status}: ${res.statusText}`);
            }
            return res.json();
        }
    },

    /**
     * Obtiene la información del perfil del usuario.
     * @param {string|number} [idUsuario] - ID opcional. Si no se provee, consulta /auth/me o usará el del usuario en sesión.
     * @returns {Promise<Object>}
     */
    async obtenerPerfil(idUsuario) {
        const id = idUsuario || this._obtenerIdUsuarioActual();

        // Si tenemos un ID específico consultamos /usuarios/{id}, de lo contrario /auth/me
        const endpoint = id ? `/usuarios/${id}` : '/auth/me';

        return this._hacerPeticion(endpoint);
    },
    async obtenerMiPerfil() {
        return this._hacerPeticion('/auth/me');
    },
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

        if (!payload || typeof payload !== 'object') {
            return Promise.reject(new Error('Los datos a actualizar deben ser un objeto válido.'));
        }

        const endpoint = id ? `/usuarios/${id}` : '/auth/me';
        const bodyContent = typeof payload === 'string' ? payload : JSON.stringify(payload);

        return this._hacerPeticion(endpoint, {
            method: 'PUT',
            body: bodyContent
        });
    }
};

// Exportar globalmente para que esté disponible en toda la aplicación
window.ProfileService = ProfileService;
