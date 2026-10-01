document.addEventListener('DOMContentLoaded', () => {
    let patientsData = [];
    let notificationsData = [];
    let activeChatId = null;
    let pollingInterval = null; // Temporizador para actualización en tiempo real

    // Funciones auxiliares de seguridad
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // 1. CARGAR ESTUDIANTES DESDE LA API
    async function cargarPacientesDesdeAPI() {
        try {
            if (typeof peticionApi !== 'function') return;
            const res = await peticionApi('/estudiantes');
            const lista = typeof normalizarListado === 'function' 
                ? normalizarListado(res) 
                : (Array.isArray(res) ? res : (res?.content || []));
            
            if (lista && lista.length > 0) {
                patientsData = lista.map((est, idx) => {
                    const nombreComp = `${est.nombreCompleto || est.nombres || est.nombre || 'Estudiante'} ${est.apellidos || est.apellido || ''}`.trim();
                    const idVal = String(est.idEstudiante || est.idUsuario || est.id || idx + 1);
                    return {
                        id: idVal,
                        name: nombreComp,
                        avatar: '../img/Logo0.png',
                        status: 'online',
                        lastMsg: 'Sin mensajes previos',
                        time: '',
                        messages: []
                    };
                });
                if (patientsData.length > 0 && !activeChatId) {
                    activeChatId = patientsData[0].id;
                }
            }
        } catch (e) {
            console.warn('[chatService] No se pudieron cargar los estudiantes desde la API:', e.message);
        }
    }

    // 2. CONFIGURACIÓN DE BARRA SUPERIOR Y NOTIFICACIONES
    const bellIcon = document.querySelector('.bi-bell.fs-4');
    const chatIcon = document.querySelector('.bi-chat.fs-4');

    if (bellIcon) {
        bellIcon.classList.add('clickable-icon');
        const badge = document.createElement('span');
        badge.className = 'unread-badge';
        badge.id = 'bellUnreadBadge';
        bellIcon.parentNode.insertBefore(badge, bellIcon.nextSibling);
    }

    if (chatIcon) {
        chatIcon.classList.add('clickable-icon');
    }

    const topbarRight = bellIcon ? bellIcon.closest('div') : null;
    if (topbarRight) {
        topbarRight.style.position = 'relative';

        const dropdown = document.createElement('div');
        dropdown.className = 'notification-dropdown';
        dropdown.id = 'notificationDropdown';
        dropdown.innerHTML = `
            <div class="notification-header">
                <h5>Notificaciones</h5>
                <button id="markAllReadBtn">Marcar todo como leído</button>
            </div>
            <div class="notification-list" id="notificationList"></div>
        `;
        topbarRight.appendChild(dropdown);
        renderNotifications();
    }

    // 3. ESTRUCTURA HTML DEL OVERLAY Y PANEL DE CHAT
    const chatOverlay = document.createElement('div');
    chatOverlay.className = 'chat-overlay';
    chatOverlay.id = 'chatOverlay';
    document.body.appendChild(chatOverlay);

    const chatPanel = document.createElement('div');
    chatPanel.className = 'chat-app-panel';
    chatPanel.id = 'chatAppPanel';
    chatPanel.innerHTML = `
        <div class="chat-sidebar">
            <div class="chat-sidebar-header">
                <h4>Pacientes / Estudiantes</h4>
                <div class="chat-search-wrapper">
                    <i class="bi bi-search"></i>
                    <input type="text" class="chat-search-input" id="chatSearchInput" placeholder="Buscar estudiante...">
                </div>
            </div>
            <div class="chat-patient-list" id="chatPatientList"></div>
        </div>
        <div class="chat-main">
            <div class="chat-main-header">
                <div class="chat-active-user" id="chatActiveUser"></div>
                <button class="chat-close-btn" id="chatCloseBtn"><i class="bi bi-x-lg"></i></button>
            </div>
            <div class="chat-conversation-area" id="chatConversationArea"></div>
            <form class="chat-input-area" id="chatInputForm">
                <div class="chat-input-wrapper">
                    <input type="text" class="chat-input-field" id="chatInputField" placeholder="Escribe un mensaje aquí..." autocomplete="off">
                    <button type="button" class="chat-action-icon me-2"><i class="bi bi-paperclip"></i></button>
                    <button type="button" class="chat-action-icon"><i class="bi bi-emoji-smile"></i></button>
                </div>
                <button type="submit" class="chat-send-btn"><i class="bi bi-send-fill"></i></button>
            </form>
        </div>
    `;
    document.body.appendChild(chatPanel);

    // 4. EVENT LISTENERS Y NAVEGACIÓN
    if (bellIcon) {
        bellIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            const dropdown = document.getElementById('notificationDropdown');
            if (dropdown) {
                dropdown.classList.toggle('active');
            }
            closeChat();
        });
    }

    const openChatButtons = [];
    if (chatIcon) openChatButtons.push(chatIcon);
    const sidebarChatLink = document.getElementById('sidebarChatLink');
    if (sidebarChatLink) openChatButtons.push(sidebarChatLink);

    openChatButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openChat();
            const dropdown = document.getElementById('notificationDropdown');
            if (dropdown) dropdown.classList.remove('active');
        });
    });

    const chatCloseBtn = document.getElementById('chatCloseBtn');
    if (chatCloseBtn) {
        chatCloseBtn.addEventListener('click', closeChat);
    }

    if (chatOverlay) {
        chatOverlay.addEventListener('click', closeChat);
    }

    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('notificationDropdown');
        if (dropdown && dropdown.classList.contains('active') && !dropdown.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });

    const chatInputForm = document.getElementById('chatInputForm');
    if (chatInputForm) {
        chatInputForm.addEventListener('submit', handleSendMessage);
    }

    const chatSearchInput = document.getElementById('chatSearchInput');
    if (chatSearchInput) {
        chatSearchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            renderPatientList(query);
        });
    }

    const markAllReadBtn = document.getElementById('markAllReadBtn');
    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', () => {
            notificationsData.forEach(n => n.unread = false);
            renderNotifications();
            updateUnreadBadge();
        });
    }

    // 5. FUNCIONES PRINCIPALES DEL CHAT
    async function openChat() {
        if (patientsData.length === 0) {
            await cargarPacientesDesdeAPI();
        }
        chatOverlay.classList.add('active');
        chatPanel.classList.add('active');
        renderPatientList();
        if (activeChatId) {
            await loadConversation(activeChatId, true);
        }
        iniciarPolling();
    }

    function closeChat() {
        chatOverlay.classList.remove('active');
        chatPanel.classList.remove('active');
        detenerPolling();
    }

    function updateUnreadBadge() {
        const hasUnread = notificationsData.some(n => n.unread);
        const badge = document.getElementById('bellUnreadBadge');
        if (badge) {
            badge.style.display = hasUnread ? 'block' : 'none';
        }
    }

    function renderNotifications() {
        const listContainer = document.getElementById('notificationList');
        if (!listContainer) return;

        listContainer.innerHTML = '';
        
        if (notificationsData.length === 0) {
            listContainer.innerHTML = '<div class="p-4 text-center text-muted">No tienes notificaciones nuevas</div>';
            return;
        }

        notificationsData.forEach(n => {
            const item = document.createElement('div');
            item.className = `notification-item ${n.unread ? 'unread' : ''}`;
            item.innerHTML = `
                <div class="notification-item-icon ${escapeHtml(n.type)}">
                    <i class="bi ${escapeHtml(n.icon)}"></i>
                </div>
                <div class="notification-item-content">
                    <div class="notification-item-title">${escapeHtml(n.title)}</div>
                    <div class="notification-item-desc">${escapeHtml(n.desc)}</div>
                    <div class="notification-item-time">${escapeHtml(n.time)}</div>
                </div>
            `;
            item.addEventListener('click', () => {
                n.unread = false;
                renderNotifications();
                updateUnreadBadge();
                if (n.type === 'message') {
                    openChat();
                }
            });
            listContainer.appendChild(item);
        });
        updateUnreadBadge();
    }

    function renderPatientList(filterQuery = '') {
        const patientContainer = document.getElementById('chatPatientList');
        if (!patientContainer) return;

        patientContainer.innerHTML = '';
        
        const filteredPatients = patientsData.filter(p => 
            p.name.toLowerCase().includes(filterQuery)
        );

        if (filteredPatients.length === 0) {
            patientContainer.innerHTML = '<div class="p-4 text-center text-muted">No se encontraron estudiantes</div>';
            return;
        }

        filteredPatients.forEach(p => {
            const item = document.createElement('div');
            item.className = `chat-patient-item ${p.id === activeChatId ? 'active' : ''}`;
            item.innerHTML = `
                <div class="chat-avatar-wrapper">
                    <img src="${escapeHtml(p.avatar)}" class="chat-avatar" alt="${escapeHtml(p.name)}">
                    <span class="chat-status-dot ${escapeHtml(p.status)}"></span>
                </div>
                <div class="chat-patient-info">
                    <div class="chat-patient-header">
                        <span class="chat-patient-name">${escapeHtml(p.name)}</span>
                        <span class="chat-patient-time">${escapeHtml(p.time || '')}</span>
                    </div>
                    <div class="chat-last-msg">${escapeHtml(p.lastMsg)}</div>
                </div>
            `;
            item.addEventListener('click', () => {
                activeChatId = p.id;
                document.querySelectorAll('.chat-patient-item').forEach(el => el.classList.remove('active'));
                item.classList.add('active');
                loadConversation(p.id, true);
            });
            patientContainer.appendChild(item);
        });
    }

    // 6. CARGAR MENSAJES REALES DESDE EL BACKEND
    async function loadConversation(patientId, forceScroll = false) {
        const patient = patientsData.find(p => p.id === String(patientId));
        if (!patient) return;

        const activeUserContainer = document.getElementById('chatActiveUser');
        if (activeUserContainer) {
            activeUserContainer.innerHTML = `
                <img src="${escapeHtml(patient.avatar)}" class="chat-avatar" alt="${escapeHtml(patient.name)}">
                <div>
                    <h5 class="chat-active-name">${escapeHtml(patient.name)}</h5>
                    <span class="chat-active-status ${patient.status === 'offline' ? 'offline' : ''}">
                        <i class="bi bi-circle-fill fs-8 me-1"></i> ${patient.status === 'online' ? 'En línea' : 'Desconectado'}
                    </span>
                </div>
            `;
        }

        await obtenerMensajesDelServidor(patientId, forceScroll);
    }

    async function obtenerMensajesDelServidor(studentId, forceScroll = false) {
        try {
            if (typeof peticionApi !== 'function') return;

            const res = await peticionApi(`/mensajes/${studentId}`);
            const listaMensajes = typeof normalizarListado === 'function' 
                ? normalizarListado(res) 
                : (Array.isArray(res) ? res : (res?.content || []));

            const patient = patientsData.find(p => p.id === String(studentId));
            if (!patient) return;

            // Obtener ID del usuario activo para comparar el emisor de los mensajes
            const usuarioSesion = JSON.parse(
                localStorage.getItem('usuario') || 
                sessionStorage.getItem('usuario') || 
                '{}'
            );
            const myId = usuarioSesion.idUsuario || usuarioSesion.id || usuarioSesion.USU_idUsuario;

            const nuevosMensajes = listaMensajes.map(m => {
                // Mapear emisor desde el objeto MensajesPrivadosDTO (m.emisor.idUsuario o fallback)
                const emisorObj = m.emisor;
                const emisorId = (typeof emisorObj === 'object' && emisorObj !== null) 
                    ? (emisorObj.idUsuario || emisorObj.id) 
                    : (m.idEmisor || m.emisorId || m.emisor);

                const esMio = (myId && String(emisorId) === String(myId)) || 
                             m.esDoctor || m.emisor === 'doctor' || m.remitente === 'doctor' || m.sender === 'doctor';
                
                const fechaMsg = m.fechaEnvio || m.fecha;
                const horaFormat = fechaMsg 
                    ? new Date(fechaMsg).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                    : (m.time || 'Hoy');

                return {
                    id: m.idMensaje || m.id || null,
                    sender: esMio ? 'doctor' : 'patient',
                    text: m.contenido || m.mensaje || m.text || '',
                    time: horaFormat
                };
            });

            const numMensajesAnteriores = patient.messages.length;
            patient.messages = nuevosMensajes;

            if (patient.messages.length > 0) {
                const ultimo = patient.messages[patient.messages.length - 1];
                patient.lastMsg = (ultimo.sender === 'doctor' ? 'Tú: ' : '') + ultimo.text;
                patient.time = ultimo.time;
            }

            if (forceScroll || numMensajesAnteriores !== patient.messages.length) {
                renderMessages(patient, forceScroll);
                
                const activeSearch = document.getElementById('chatSearchInput')?.value.trim();
                if (!activeSearch) {
                    renderPatientList();
                }
            }
        } catch (e) {
            console.error('[chatService] Error al obtener mensajes del servidor:', e);
        }
    }

    function renderMessages(patient, forceScroll = false) {
        const conversationArea = document.getElementById('chatConversationArea');
        if (!conversationArea) return;

        const isAtBottom = conversationArea.scrollHeight - conversationArea.scrollTop <= conversationArea.clientHeight + 100;

        conversationArea.innerHTML = '';
        
        patient.messages.forEach(msg => {
            const bubble = document.createElement('div');
            bubble.className = `chat-msg-bubble ${msg.sender === 'doctor' ? 'sent' : 'received'}`;
            bubble.innerHTML = `
                ${escapeHtml(msg.text)}
                <span class="chat-msg-time">${escapeHtml(msg.time)}</span>
            `;
            conversationArea.appendChild(bubble);
        });

        if (forceScroll || isAtBottom) {
            setTimeout(() => {
                conversationArea.scrollTop = conversationArea.scrollHeight;
            }, 50);
        }
    }

    // 7. ENVIAR MENSAJE AL SERVIDOR (CORREGIDO PARA MensajesPrivadosDTO)
    async function handleSendMessage(e) {
        e.preventDefault();
        const inputField = document.getElementById('chatInputField');
        if (!inputField) return;

        const text = inputField.value.trim();
        if (!text || !activeChatId) return;

        // 1. Obtener ID del usuario activo (Emisor)
        const usuarioSesion = JSON.parse(
            localStorage.getItem('usuario') || 
            sessionStorage.getItem('usuario') || 
            '{}'
        );
        const rawEmisorId = usuarioSesion.idUsuario || usuarioSesion.id || usuarioSesion.USU_idUsuario;

        if (!rawEmisorId) {
            console.error('[chatService] No se encontró el ID del usuario logueado en la sesión.');
            alert('Sesión no válida: No se pudo identificar al emisor del mensaje.');
            return;
        }

        inputField.value = '';

        try {
            if (typeof peticionApi === 'function') {
                const idEmisor = parseInt(rawEmisorId, 10);
                const idReceptor = parseInt(activeChatId, 10);

                // Payload ajustado a MensajesPrivadosDTO: emisor y receptor como objetos Usuario
                const payload = {
                    emisor: { 
                        idUsuario: idEmisor,
                        id: idEmisor 
                    },
                    receptor: { 
                        idUsuario: idReceptor,
                        id: idReceptor 
                    },
                    contenido: text
                };

                await peticionApi('/mensajes', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
            }

            // Recargar la lista de mensajes y forzar scroll al final
            await obtenerMensajesDelServidor(activeChatId, true);

        } catch (err) {
            console.error('[chatService] Error al enviar mensaje:', err);
            if (err.response) {
                console.error('[chatService] Detalle del error de validación backend:', err.response);
            }
            alert('No se pudo enviar el mensaje. Revisa la consola para más detalles.');
        }
    }

    // 8. CONSULTA PERIÓDICA EN TIEMPO REAL (POLLING CADA 3 SEGUNDOS)
    function iniciarPolling() {
        detenerPolling();
        pollingInterval = setInterval(() => {
            if (activeChatId && chatPanel.classList.contains('active')) {
                obtenerMensajesDelServidor(activeChatId, false);
            }
        }, 3000);
    }

    function detenerPolling() {
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
        }
    }

    // NAVEGACIÓN DESDE HASH (#openChat)
    if (window.location.hash === '#openChat') {
        history.replaceState("", document.title, window.location.pathname + window.location.search);
        openChat();
    }
});
