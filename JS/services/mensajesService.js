/* Llamadas a la API para el chat y las notificaciones del panel. La interfaz vive en controllers/chatController.js. */
(function (global) {
    'use strict';

    const MensajesService = {
        async contactos(idUsuario) {
            const pedir = () => peticionApi('/estudiantes/contactos-chat');
            return typeof conCacheDeSesion === 'function'
                ? await conCacheDeSesion(`contactos-chat:${idUsuario}`, 5 * 60 * 1000, pedir)
                : await pedir();
        },

        async misEstudiantes() {
            return await peticionApi('/estudiantes/mis-estudiantes');
        },

        async resumen() {
            return await peticionApi('/mensajes/resumen');
        },

        async conversacion(idUsuario, parametros) {
            const consulta = new URLSearchParams(parametros).toString();
            return await peticionApi(`/mensajes/conversacion/${idUsuario}?${consulta}`);
        },

        async enviar(idReceptor, contenido, idRespuestaA) {
            return await peticionApi('/mensajes', {
                method: 'POST',
                body: JSON.stringify({
                    receptor: { idUsuario: idReceptor },
                    contenido,
                    idRespuestaA: idRespuestaA || null
                })
            });
        },

        async marcarLeidos(idUsuario) {
            return await peticionApi(`/mensajes/leidos/${idUsuario}`, { method: 'PUT' });
        },

        async ticketTiempoReal() {
            const respuesta = await authFetch('/ws-ticket', { method: 'POST' });
            if (respuesta.status === 401 || respuesta.status === 403) {
                const error = new Error('El chat en tiempo real no está disponible para esta cuenta.');
                error.permanente = true;
                throw error;
            }
            if (!respuesta.ok) return null;
            const datos = desempaquetarApi(await leerCuerpoApi(respuesta));
            return datos && datos.ticket;
        },

        async presencia(idsUsuarios) {
            const ids = Array.from(new Set((idsUsuarios || []).filter(id => id !== null && id !== undefined)));
            if (!ids.length) return [];
            const lotes = [];
            for (let i = 0; i < ids.length; i += 150) lotes.push(ids.slice(i, i + 150));
            const respuestas = await Promise.all(lotes.map(lote => peticionApi(`/mensajes/presencia?ids=${lote.join(',')}`)));
            return respuestas.flat().filter(Boolean);
        },

        async notificaciones() {
            return await peticionApi('/notificaciones');
        },

        async marcarNotificacionLeida(idNotificacion) {
            return await peticionApi(`/notificaciones/${idNotificacion}/leida`, { method: 'PUT' });
        },

        async marcarTodasLeidas() {
            return await peticionApi('/notificaciones/leidas', { method: 'PUT' });
        }
    };

    global.MensajesService = MensajesService;
})(window);
