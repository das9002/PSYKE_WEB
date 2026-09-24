document.addEventListener('DOMContentLoaded', () => {
    const patientsData = [
        {
            id: 'sofia_torres',
            name: 'Sofía Torres',
            avatar: '../img/Logo0.png',
            status: 'online',
            lastMsg: '¡Sí, excelente! Muchas gracias.',
            time: '15:20',
            messages: [
                { sender: 'patient', text: 'Hola Dr., ¿podríamos cambiar la hora de la cita de hoy?', time: '15:15' },
                { sender: 'doctor', text: 'Hola Sofía. Sí, tengo disponible a las 5:00 PM. ¿Te queda bien?', time: '15:18' },
                { sender: 'patient', text: '¡Sí, excelente! Muchas gracias.', time: '15:20' }
            ],
            replies: [
                "Perfecto doctor, estaré puntual a las 5:00 PM.",
                "¿Tengo que llevar la bitácora impresa hoy?",
                "Muchas gracias por su flexibilidad, nos vemos más tarde."
            ],
            replyIndex: 0
        },
        {
            id: 'carlos_flores',
            name: 'Carlos Flores',
            avatar: '../img/Logo0.png',
            status: 'offline',
            lastMsg: 'Gracias por la sesión de ayer',
            time: 'Ayer',
            messages: [
                { sender: 'doctor', text: 'Hola Carlos, ¿cómo te has sentido hoy después de la terapia?', time: 'Ayer 10:10' },
                { sender: 'patient', text: 'Me he sentido con menos ansiedad, gracias por la sesión de ayer', time: 'Ayer 11:30' }
            ],
            replies: [
                "He estado practicando los ejercicios de respiración que acordamos.",
                "Me gustaría agendar una cita extra para la próxima semana.",
                "De acuerdo doctor, nos vemos el próximo martes."
            ],
            replyIndex: 0
        },
        {
            id: 'alejandro_ruiz',
            name: 'Alejandro Ruiz',
            avatar: '../img/Logo0.png',
            status: 'online',
            lastMsg: 'Ya completé el test semanal',
            time: 'Ayer',
            messages: [
                { sender: 'doctor', text: 'Hola Alejandro, recuerda completar el test de ansiedad antes de mañana.', time: 'Ayer 14:00' },
                { sender: 'patient', text: 'Hola Dr., ya completé el test semanal. Quedo al tanto de sus comentarios.', time: 'Ayer 15:45' }
            ],
            replies: [
                "¿Pudo revisar mis resultados del test?",
                "Me sentí un poco abrumado respondiendo las últimas preguntas.",
                "Entendido doctor, gracias por el seguimiento."
            ],
            replyIndex: 0
        },
        {
            id: 'maria_gomez',
            name: 'María Gómez',
            avatar: '../img/Logo0.png',
            status: 'offline',
            lastMsg: 'Confirmado, nos vemos pronto',
            time: '2 días',
            messages: [
                { sender: 'patient', text: 'Hola Dr., confirmando la sesión de terapia para el jueves.', time: '2 días' },
                { sender: 'doctor', text: 'Hola María. Sí, está confirmada en agenda. Nos vemos a las 3:00 PM.', time: '2 días' },
                { sender: 'patient', text: 'Confirmado, nos vemos pronto.', time: '2 días' }
            ],
            replies: [
                "Perfecto, nos vemos pronto en el consultorio.",
                "¿La sesión será presencial o mantendremos el formato en línea?",
                "Gracias por recordarme, doctor."
            ],
            replyIndex: 0
        }
    ];

    const notificationsData = [
        {
            id: 1,
            type: 'message',
            unread: true,
            title: 'Nuevo Mensaje',
            desc: 'Sofía Torres: "Hola Dr., ¿podríamos cambiar la hora de la..."',
            time: 'Hace 5 min',
            icon: 'bi-chat-left-text-fill'
        },
        {
            id: 2,
            type: 'appointment',
            unread: true,
            title: 'Recordatorio de Cita',
            desc: 'Cita programada hoy con Alejandro Ruiz a las 4:00 PM.',
            time: 'Hace 20 min',
            icon: 'bi-calendar-check-fill'
        },
        {
            id: 3,
            type: 'message',
            unread: false,
            title: 'Mensaje de Paciente',
            desc: 'Carlos Flores: "Me he sentido con menos ansiedad, gracias..."',
            time: 'Ayer',
            icon: 'bi-chat-left-text-fill'
        },
        {
            id: 4,
            type: 'appointment',
            unread: false,
            title: 'Recordatorio de Cita',
            desc: 'Próxima sesión grupal programada mañana a las 9:00 AM.',
            time: 'Ayer',
            icon: 'bi-people-fill'
        }
    ];

    let activeChatId = 'sofia_torres';

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
                <h4>Pacientes</h4>
                <div class="chat-search-wrapper">
                    <i class="bi bi-search"></i>
                    <input type="text" class="chat-search-input" id="chatSearchInput" placeholder="Buscar paciente...">
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

    function openChat() {
        chatOverlay.classList.add('active');
        chatPanel.classList.add('active');
        renderPatientList();
        loadConversation(activeChatId);
    }

    function closeChat() {
        chatOverlay.classList.remove('active');
        chatPanel.classList.remove('active');
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
                <div class="notification-item-icon ${n.type}">
                    <i class="bi ${n.icon}"></i>
                </div>
                <div class="notification-item-content">
                    <div class="notification-item-title">${n.title}</div>
                    <div class="notification-item-desc">${n.desc}</div>
                    <div class="notification-item-time">${n.time}</div>
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
            patientContainer.innerHTML = '<div class="p-4 text-center text-muted">No se encontraron pacientes</div>';
            return;
        }

        filteredPatients.forEach(p => {
            const item = document.createElement('div');
            item.className = `chat-patient-item ${p.id === activeChatId ? 'active' : ''}`;
            item.innerHTML = `
                <div class="chat-avatar-wrapper">
                    <img src="${p.avatar}" class="chat-avatar" alt="${p.name}">
                    <span class="chat-status-dot ${p.status}"></span>
                </div>
                <div class="chat-patient-info">
                    <div class="chat-patient-header">
                        <span class="chat-patient-name">${p.name}</span>
                        <span class="chat-patient-time">${p.time}</span>
                    </div>
                    <div class="chat-last-msg">${p.lastMsg}</div>
                </div>
            `;
            item.addEventListener('click', () => {
                activeChatId = p.id;
                document.querySelectorAll('.chat-patient-item').forEach(el => el.classList.remove('active'));
                item.classList.add('active');
                loadConversation(p.id);
            });
            patientContainer.appendChild(item);
        });
    }

    function loadConversation(patientId) {
        const patient = patientsData.find(p => p.id === patientId);
        if (!patient) return;

        const activeUserContainer = document.getElementById('chatActiveUser');
        if (activeUserContainer) {
            activeUserContainer.innerHTML = `
                <img src="${patient.avatar}" class="chat-avatar" alt="${patient.name}">
                <div>
                    <h5 class="chat-active-name">${patient.name}</h5>
                    <span class="chat-active-status ${patient.status === 'offline' ? 'offline' : ''}">
                        <i class="bi bi-circle-fill fs-8 me-1"></i> ${patient.status === 'online' ? 'En línea' : 'Desconectado'}
                    </span>
                </div>
            `;
        }

        renderMessages(patient);
    }

    function renderMessages(patient) {
        const conversationArea = document.getElementById('chatConversationArea');
        if (!conversationArea) return;

        conversationArea.innerHTML = '';
        
        patient.messages.forEach(msg => {
            const bubble = document.createElement('div');
            bubble.className = `chat-msg-bubble ${msg.sender === 'doctor' ? 'sent' : 'received'}`;
            bubble.innerHTML = `
                ${msg.text}
                <span class="chat-msg-time">${msg.time}</span>
            `;
            conversationArea.appendChild(bubble);
        });

        setTimeout(() => {
            conversationArea.scrollTop = conversationArea.scrollHeight;
        }, 50);
    }

    function handleSendMessage(e) {
        e.preventDefault();
        const inputField = document.getElementById('chatInputField');
        if (!inputField) return;

        const text = inputField.value.trim();
        if (!text) return;

        const patient = patientsData.find(p => p.id === activeChatId);
        if (!patient) return;

        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        patient.messages.push({
            sender: 'doctor',
            text: text,
            time: timeStr
        });

        patient.lastMsg = `Tú: ${text}`;
        patient.time = 'Ahora';

        inputField.value = '';
        renderMessages(patient);
        renderPatientList();

        setTimeout(() => {
            const currentReplyText = patient.replies[patient.replyIndex];
            patient.replyIndex = (patient.replyIndex + 1) % patient.replies.length;

            const replyTime = new Date();
            const replyTimeStr = `${String(replyTime.getHours()).padStart(2, '0')}:${String(replyTime.getMinutes()).padStart(2, '0')}`;

            patient.messages.push({
                sender: 'patient',
                text: currentReplyText,
                time: replyTimeStr
            });

            patient.lastMsg = currentReplyText;
            patient.time = 'Ahora';

            renderMessages(patient);
            renderPatientList();

            notificationsData.unshift({
                id: Date.now(),
                type: 'message',
                unread: true,
                title: 'Mensaje de Paciente',
                desc: `${patient.name}: "${currentReplyText.substring(0, 30)}..."`,
                time: 'Ahora',
                icon: 'bi-chat-left-text-fill'
            });
            renderNotifications();
            updateUnreadBadge();

        }, 1500);
    }

    if (window.location.hash === '#openChat') {
        history.replaceState("", document.title, window.location.pathname + window.location.search);
        openChat();
    }
});
