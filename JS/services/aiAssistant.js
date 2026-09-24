(function () {
    'use strict';

    let mensajesHistorial = [];

    function crearPanelAsistente() {
        const overlay = document.createElement('div');
        overlay.className = 'ai-assistant-overlay';
        overlay.id = 'aiAssistantOverlay';
        document.body.appendChild(overlay);

        const panel = document.createElement('div');
        panel.className = 'ai-assistant-panel';
        panel.id = 'aiAssistantPanel';
        panel.innerHTML = `
            <div class="ai-assistant-header">
                <div class="ai-assistant-title">
                    <div class="ai-avatar">
                        <i class="bi bi-robot"></i>
                    </div>
                    <div>
                        <h5 class="mb-0 fw-bold">Asistente PSYKE</h5>
                        <small class="text-muted">Potenciado por IA Generativa</small>
                    </div>
                </div>
                <button type="button" class="ai-close-btn" id="aiCloseBtn" aria-label="Cerrar asistente">
                    <i class="bi bi-x-lg"></i>
                </button>
            </div>
            <div class="ai-conversation-area" id="aiConversationArea">
                <div class="ai-welcome-message">
                    <div class="ai-msg-bubble received">
                        <i class="bi bi-robot me-2"></i>¡Hola! Soy tu Asistente PSYKE. ¿En qué puedo ayudarte hoy?
                    </div>
                </div>
            </div>
            <form class="ai-input-area" id="aiInputForm">
                <div class="ai-input-wrapper">
                    <input type="text" class="ai-input-field" id="aiInputField" placeholder="Escribe tu pregunta..." autocomplete="off" aria-label="Tu mensaje">
                </div>
                <button type="submit" class="ai-send-btn" id="aiSendBtn" aria-label="Enviar mensaje">
                    <i class="bi bi-send-fill"></i>
                </button>
            </form>
        `;
        document.body.appendChild(panel);
    }

    function obtenerOverlay() {
        return document.getElementById('aiAssistantOverlay');
    }

    function obtenerPanel() {
        return document.getElementById('aiAssistantPanel');
    }

    function abrirAsistente() {
        const overlay = obtenerOverlay();
        const panel = obtenerPanel();
        if (overlay) overlay.classList.add('active');
        if (panel) panel.classList.add('active');
        const input = document.getElementById('aiInputField');
        if (input) setTimeout(() => input.focus(), 300);
    }

    function cerrarAsistente() {
        const overlay = obtenerOverlay();
        const panel = obtenerPanel();
        if (overlay) overlay.classList.remove('active');
        if (panel) panel.classList.remove('active');
    }

    function agregarMensaje(texto, tipo) {
        const area = document.getElementById('aiConversationArea');
        if (!area) return;

        const welcomeMsg = area.querySelector('.ai-welcome-message');
        if (welcomeMsg) welcomeMsg.remove();

        const bubble = document.createElement('div');
        bubble.className = `ai-msg-bubble ${tipo}`;
        bubble.innerHTML = texto;
        area.appendChild(bubble);

        setTimeout(() => {
            area.scrollTop = area.scrollHeight;
        }, 50);
    }

    function mostrarCargando() {
        const area = document.getElementById('aiConversationArea');
        if (!area) return;

        const loading = document.createElement('div');
        loading.className = 'ai-msg-bubble received ai-loading';
        loading.id = 'aiLoadingMsg';
        loading.innerHTML = `
            <div class="d-flex align-items-center gap-2">
                <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
                <span>Generando respuesta...</span>
            </div>
        `;
        area.appendChild(loading);
        area.scrollTop = area.scrollHeight;
    }

    function ocultarCargando() {
        const loading = document.getElementById('aiLoadingMsg');
        if (loading) loading.remove();
    }

    async function manejarEnvio(e) {
        e.preventDefault();
        const input = document.getElementById('aiInputField');
        if (!input) return;

        const texto = input.value.trim();
        if (!texto) return;

        agregarMensaje(texto, 'sent');
        input.value = '';

        mostrarCargando();

        try {
            const respuesta = await aiService.enviarPrompt(texto);
            ocultarCargando();
            
            if (respuesta && respuesta.respuesta) {
                agregarMensaje(respuesta.respuesta, 'received');
            } else {
                agregarMensaje('No se pudo obtener una respuesta. Inténtalo de nuevo.', 'received error');
            }
        } catch (error) {
            ocultarCargando();
            let mensaje = 'Error al conectar con el asistente.';
            if (error.message) mensaje = error.message;
            agregarMensaje(mensaje, 'received error');
        }
    }

    function inicializarEventos() {
        const btnAbrir = document.getElementById('btnAIAssistant');
        if (btnAbrir) {
            btnAbrir.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                abrirAsistente();
            });
        }

        const btnCerrar = document.getElementById('aiCloseBtn');
        if (btnCerrar) {
            btnCerrar.addEventListener('click', cerrarAsistente);
        }

        const overlay = obtenerOverlay();
        if (overlay) {
            overlay.addEventListener('click', cerrarAsistente);
        }

        const form = document.getElementById('aiInputForm');
        if (form) {
            form.addEventListener('submit', manejarEnvio);
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                cerrarAsistente();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            crearPanelAsistente();
            inicializarEventos();
        });
    } else {
        crearPanelAsistente();
        inicializarEventos();
    }
})();