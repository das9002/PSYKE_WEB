(function () {
    'use strict';

    let mensajesHistorial = [];

    const cloudeeConfig = {
        bodyColor: "#dcacdb",
        eyeColor: "#111316",
        primarySphere: { width: 159.78, height: 159.78 },
        nodes: [
            { pos: [-54.21, -19.98], size: [81.6, 81.6] },
            { pos: [-64.06, 18.35], size: [108.64, 87.1] },
            { pos: [61.23, 18.96], size: [97.79, 96.83] },
            { pos: [41.48, -37.63], size: [94.34, 94.34] },
            { pos: [-4.80, -55.01], size: [81.6, 81.6] },
            { pos: [-38.92, -48.27], size: [81.6, 81.6] },
            { pos: [-17.32, -7.52], size: [81.6, 81.6] },
            { pos: [51.50, -31.30], size: [81.6, 81.6] },
            { pos: [-36.62, 61.08], size: [81.6, 81.6] },
            { pos: [20.61, 58.92], size: [94.34, 94.34] }
        ],
        expressions: {
            neutral: { left: { w: 18.7, h: 41.8, x: -13, y: -10, angle: 0 }, right: { w: 18.7, h: 41.8, x: 13, y: -10, angle: 0 } },
            thinking: { left: { w: 19.3, h: 39.5, x: -15, y: -18, angle: 20 }, right: { w: 19.3, h: 39.5, x: 11, y: -18, angle: -20 } },
            happy: { left: { w: 32.9, h: 74.9, x: -16, y: -3, angle: 0 }, right: { w: 32.9, h: 74.9, x: 16, y: -3, angle: 0 } },
            error: { left: { w: 25.8, h: 54.8, x: -15, y: -3, angle: -36 }, right: { w: 25.8, h: 54.8, x: 15, y: -3, angle: 27 } }
        }
    };

    function renderCloudeeAvatar(expressionName = 'neutral') {
        const targets = [
            { body: document.getElementById('cloudeeBodyGroupHeader'), eyes: document.getElementById('cloudeeEyesGroupHeader') },
            { body: document.getElementById('cloudeeBodyGroupFloat'), eyes: document.getElementById('cloudeeEyesGroupFloat') }
        ];

        let bodyHtml = `<circle cx="0" cy="0" r="${cloudeeConfig.primarySphere.width / 2}" fill="${cloudeeConfig.bodyColor}" />`;
        cloudeeConfig.nodes.forEach(node => {
            bodyHtml += `<ellipse cx="${node.pos[0]}" cy="${node.pos[1]}" rx="${node.size[0] / 2}" ry="${node.size[1] / 2}" fill="${cloudeeConfig.bodyColor}" />`;
        });

        const expr = cloudeeConfig.expressions[expressionName] || cloudeeConfig.expressions.neutral;
        let eyesHtml = '';

        ['left', 'right'].forEach(side => {
            const eye = expr[side];
            eyesHtml += `<ellipse cx="${eye.x}" cy="${eye.y}" rx="${eye.w / 2}" ry="${eye.h / 2}" fill="${cloudeeConfig.eyeColor}" transform="rotate(${eye.angle} ${eye.x} ${eye.y})" />`;
        });

        targets.forEach(target => {
            if (target.body) target.body.innerHTML = bodyHtml;
            if (target.eyes) target.eyes.innerHTML = eyesHtml;
        });
    }

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
                    <div class="ai-avatar" id="cloudeeAvatarHeader" style="background:#241b6b; padding:2px; border-radius:50%; width:44px; height:44px; display:flex; align-items:center; justify-content:center;">
                        <svg id="cloudeeSvgHeader" viewBox="-120 -120 240 240" width="38" height="38">
                            <g id="cloudeeBodyGroupHeader"></g>
                            <g id="cloudeeEyesGroupHeader"></g>
                        </svg>
                    </div>
                    <div>
                        <h5 class="mb-0 fw-bold">Cloudee - PSYKE AI</h5>
                        <small class="text-muted">Asistente Inteligente</small>
                    </div>
                </div>
                <button type="button" class="ai-close-btn" id="aiCloseBtn" aria-label="Cerrar asistente">
                    <i class="bi bi-x-lg"></i>
                </button>
            </div>
            <div class="ai-conversation-area" id="aiConversationArea">
                <div class="ai-welcome-message">
                    <div class="ai-msg-bubble received">
                        ¡Hola! Soy Cloudee, tu Asistente PSYKE. ¿En qué puedo ayudarte hoy?
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

        const floatBtn = document.createElement('button');
        floatBtn.type = 'button';
        floatBtn.id = 'btnAIAssistant';
        floatBtn.title = 'Asistente IA - Cloudee';
        floatBtn.setAttribute('aria-label', 'Abrir Asistente PSYKE');
        floatBtn.style.cssText = `
            position: fixed;
            bottom: 30px;
            right: 30px;
            width: 75px;
            height: 75px;
            border-radius: 50%;
            background: radial-gradient(circle at 32% 28%, #8a3fd6, #241b6b 78%);
            border: 3px solid rgba(255, 255, 255, 0.3);
            box-shadow: 0 8px 25px rgba(138, 63, 214, 0.5);
            cursor: pointer;
            z-index: 9990;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.25s ease, box-shadow 0.25s ease;
            padding: 0;
            overflow: hidden;
        `;
        floatBtn.innerHTML = `
            <svg id="cloudeeSvgFloat" viewBox="-120 -120 240 240" width="65" height="65">
                <g id="cloudeeBodyGroupFloat"></g>
                <g id="cloudeeEyesGroupFloat"></g>
            </svg>
        `;
        floatBtn.addEventListener('mouseenter', () => {
            floatBtn.style.transform = 'scale(1.1)';
            floatBtn.style.boxShadow = '0 12px 30px rgba(138, 63, 214, 0.7)';
        });
        floatBtn.addEventListener('mouseleave', () => {
            floatBtn.style.transform = 'scale(1)';
            floatBtn.style.boxShadow = '0 8px 25px rgba(138, 63, 214, 0.5)';
        });
        document.body.appendChild(floatBtn);
    }

    function obtenerOverlay() {
        return document.getElementById('aiAssistantOverlay');
    }

    function obtenerPanel() {
        return document.getElementById('aiAssistantPanel');
    }

    function ocultarBotonCloudee() {
        const floatBtn = document.getElementById('btnAIAssistant');
        if (floatBtn) {
            floatBtn.classList.add('hidden');
            floatBtn.style.display = 'none';
        }
    }

    function mostrarBotonCloudee() {
        const floatBtn = document.getElementById('btnAIAssistant');
        const aiPanel = obtenerPanel();
        const chatPanel = document.getElementById('chatPanel');

        const aiActive = aiPanel && aiPanel.classList.contains('active');
        const chatActive = chatPanel && chatPanel.classList.contains('active');

        if (floatBtn && !aiActive && !chatActive) {
            floatBtn.classList.remove('hidden');
            floatBtn.style.display = 'flex';
        }
    }

    window.ocultarBotonCloudee = ocultarBotonCloudee;
    window.mostrarBotonCloudee = mostrarBotonCloudee;

    function abrirAsistente() {
        const overlay = obtenerOverlay();
        const panel = obtenerPanel();
        if (overlay) overlay.classList.add('active');
        if (panel) panel.classList.add('active');
        ocultarBotonCloudee();
        renderCloudeeAvatar('neutral');
        const input = document.getElementById('aiInputField');
        if (input) setTimeout(() => input.focus(), 300);
    }

    function cerrarAsistente() {
        const overlay = obtenerOverlay();
        const panel = obtenerPanel();
        if (overlay) overlay.classList.remove('active');
        if (panel) panel.classList.remove('active');
        mostrarBotonCloudee();
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
        renderCloudeeAvatar('thinking');
        const area = document.getElementById('aiConversationArea');
        if (!area) return;

        const loading = document.createElement('div');
        loading.className = 'ai-msg-bubble received ai-loading';
        loading.id = 'aiLoadingMsg';
        loading.innerHTML = `
            <div class="d-flex align-items-center gap-2">
                <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
                <span>Cloudee está pensando...</span>
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
                renderCloudeeAvatar('happy');
                agregarMensaje(respuesta.respuesta, 'received');
                setTimeout(() => renderCloudeeAvatar('neutral'), 3000);
            } else {
                renderCloudeeAvatar('error');
                agregarMensaje('No se pudo obtener una respuesta. Inténtalo de nuevo.', 'received error');
            }
        } catch (error) {
            ocultarCargando();
            renderCloudeeAvatar('error');
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

        document.addEventListener('show.bs.modal', () => {
            ocultarBotonCloudee();
        });

        document.addEventListener('hidden.bs.modal', () => {
            mostrarBotonCloudee();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            crearPanelAsistente();
            renderCloudeeAvatar('neutral');
            inicializarEventos();
        });
    } else {
        crearPanelAsistente();
        renderCloudeeAvatar('neutral');
        inicializarEventos();
    }
})();