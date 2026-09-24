(function () {
    'use strict';

    async function enviarPrompt(prompt) {
        const respuesta = await apiFetch('/v1/ai/chat', {
            method: 'POST',
            body: JSON.stringify({ prompt: prompt })
        });
        return respuesta;
    }

    window.aiService = {
        enviarPrompt: enviarPrompt
    };
})();