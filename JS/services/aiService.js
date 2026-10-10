(function () {
    'use strict';

    /**
     * Envía un mensaje al asistente de IA.
     * @param {string} prompt  Mensaje actual del usuario
     * @param {Array<{rol: 'usuario'|'asistente', contenido: string}>} historial  Mensajes anteriores (opcional)
     */
    async function enviarPrompt(prompt, historial) {
        const respuesta = await apiFetch('/v1/ai/chat', {
            method: 'POST',
            body: JSON.stringify({ prompt: prompt, historial: Array.isArray(historial) ? historial : [] })
        });
        return respuesta;
    }

    window.aiService = {
        enviarPrompt: enviarPrompt
    };
})();
