(function () {
    'use strict';

    /**
     * Envía un mensaje al asistente de IA.
     * @param {string} prompt  Mensaje actual del usuario
     * @param {Array<{rol: 'usuario'|'asistente', contenido: string}>} historial  Mensajes anteriores (opcional)
     */
    async function enviarPrompt(prompt, historial) {
        var promptFinal = typeof prompt === 'string' ? prompt : String(prompt ?? '');
        // El backend tiene un límite estricto de 4000 caracteres por mensaje
        if (promptFinal.length > 3900) {
            console.warn('[aiService] El prompt supera 3900 caracteres; se recortó preventivamente para cumplir con el límite del servidor.');
            promptFinal = promptFinal.slice(0, 3900);
        }

        const respuesta = await apiFetch('/v1/ai/chat', {
            method: 'POST',
            body: JSON.stringify({ prompt: promptFinal, historial: Array.isArray(historial) ? historial : [] })
        });
        return respuesta;
    }

    window.aiService = {
        enviarPrompt: enviarPrompt
    };
})();
