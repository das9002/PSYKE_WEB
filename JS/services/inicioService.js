/**
 * DashboardService
 * Servicio encargado de gestionar la obtención de datos e métricas del panel de inicio.
 */
const DashboardService = {
    /**
     * Obtiene el resumen consolidado del dashboard.
     * Si el endpoint principal responde con error (p. ej. Error 503), ejecuta un fallback
     * automático calculando las métricas desde los endpoints individuales.
     * 
     * @returns {Promise<Object>} Datos del resumen del dashboard
     */
    async obtenerResumen() {
        try {
            return await peticionApi('/dashboard/resumen');
        } catch (error) {
            console.warn('[DashboardService] Fallo en /dashboard/resumen. Generando datos desde fallback paralelo:', error.message);
            return await this.obtenerResumenFallback();
        }
    },

    /**
     * Realiza peticiones en paralelo a los tres recursos base sin que la caída de uno bloquee a los demás.
     * Normaliza automáticamente las respuestas a arreglos de JavaScript.
     * 
     * @returns {Promise<{estudiantes: Array, citas: Array, sesiones: Array}>}
     */
    async obtenerConteosParalelos() {
        const resultados = await Promise.allSettled([
            peticionApi('/estudiantes'),
            peticionApi('/citas'),
            peticionApi('/sesiones')
        ]);

        const normalizar = typeof normalizarListado === 'function' 
            ? normalizarListado 
            : (res) => (Array.isArray(res) ? res : []);

        return {
            estudiantes: resultados[0].status === 'fulfilled' ? normalizar(resultados[0].value) : [],
            citas: resultados[1].status === 'fulfilled' ? normalizar(resultados[1].value) : [],
            sesiones: resultados[2].status === 'fulfilled' ? normalizar(resultados[2].value) : []
        };
    },

    /**
     * Estrategia de respaldo (Fallback) para reconstruir el objeto de métricas
     * cuando el endpoint /dashboard/resumen no esté disponible.
     * 
     * @returns {Promise<Object>} Resumen calculado localmente
     */
    async obtenerResumenFallback() {
        const { estudiantes, citas, sesiones } = await this.obtenerConteosParalelos();

        return {
            totalEstudiantes: estudiantes.length,
            totalCitas: citas.length,
            totalSesiones: sesiones.length,
            citasPendientes: citas.filter(c => (c.estado || c.estadoConfirmacion) === 'PENDIENTE').length,
            casosCriticos: sesiones.filter(s => s.marcadorCritico === true || s.esCritico === true).length,
            esFallback: true // Flag informativo para la interfaz si se requiere mostrar una advertencia
        };
    }
};

// Compatibilidad para entornos de navegador (global) y módulos ES/CommonJS
if (typeof window !== 'undefined') {
    window.DashboardService = DashboardService;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DashboardService;
}
