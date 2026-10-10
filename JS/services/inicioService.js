/**
 * DashboardService
 * Servicio encargado de gestionar la obtención de datos e métricas del panel de inicio.
 */
const DashboardService = {
    /**
     * Obtiene el resumen consolidado del dashboard.
     *
     * Ya no hay respaldo que descargue todos los estudiantes, citas y sesiones cuando este endpoint
     * falla: el fallo casi siempre significa que el servidor está saturado, y esas descargas masivas
     * lo empeoraban. El error se propaga y la pantalla muestra el aviso correspondiente.
     *
     * @returns {Promise<Object>} Datos del resumen del dashboard
     */
    async obtenerResumen() {
        return await peticionApi('/dashboard/resumen');
    }
};

// Compatibilidad para entornos de navegador (global) y módulos ES/CommonJS
if (typeof window !== 'undefined') {
    window.DashboardService = DashboardService;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DashboardService;
}
