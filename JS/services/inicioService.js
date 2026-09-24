

const DashboardService = {
    obtenerResumen() {
        return peticionApi('/dashboard/resumen');
    },

    obtenerConteosParalelos() {
        return Promise.allSettled([
            peticionApi('/estudiantes'),
            peticionApi('/citas'),
            peticionApi('/sesiones')
        ]);
    }
};