document.addEventListener('DOMContentLoaded', () => {
    const INTERVALO_CHAT_ABIERTO = 3000;
    const INTERVALO_CHAT_CERRADO = 10000;
    const LIMITE_ESPERA = 20000;
    const TAMANO_PAGINA = 50;

    let patientsData = [];
    let notificationsData = [];
    let activeChatId = null;
    let miUsuarioId = null;
    let ultimoIdProcesado = 0;
    let cargaInicialLista = false;
    let sincronizando = false;
    let inicioSincronizacion = 0;
    let sincronizacionActiva = false;
    let temporizador = null;

    function escapeHTML(texto) {
        const div = document.createElement('div');
        div.textContent = texto === null || texto === undefined ? '' : String(texto);
        return div.innerHTML.replace(/"/g, '&quot;');
    }

    const COLORES_AVATAR = ['#2563EB', '#059669', '#7C3AED', '#DB2777', '#D97706', '#0891B2'];

    function inicialesDe(nombres, apellidos) {
        const primera = (texto) => String(texto || '').trim().charAt(0).toUpperCase();
        return `${primera(nombres)}${primera(apellidos)}` || 'ES';
    }

    function colorAvatar(id) {
        return COLORES_AVATAR[Math.abs(Number(id) || 0) % COLORES_AVATAR.length];
    }

    function avatarHTML(paciente) {
        return `<div class="chat-avatar chat-avatar-iniciales" style="background-color: ${paciente.color}" aria-hidden="true">${escapeHTML(paciente.iniciales)}</div>`;
    }

    function recortar(texto, limite) {
        const limpio = String(texto || '').replace(/\s+/g, ' ').trim();
        return limpio.length > limite ? `${limpio.slice(0, limite)}…` : limpio;
    }

    function formatearHora(fecha) {
        const d = new Date(fecha);
        if (isNaN(d.getTime())) return '';
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }

    function etiquetaFecha(fecha) {
        const d = new Date(fecha);
        if (isNaN(d.getTime())) return '';
        if (d.toDateString() === new Date().toDateString()) return formatearHora(fecha);
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    function ahoraLocalISO() {
        const d = new Date();
        const dos = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}`;
    }

    async function listarTodo(ruta, parametros = '') {
        const acumulado = [];
        for (let pagina = 0; ; pagina++) {
            const res = await peticionApi(`${ruta}?page=${pagina}&size=${TAMANO_PAGINA}${parametros}`);
            if (Array.isArray(res)) return res;

            const contenido = (res && res.content) || [];
            acumulado.push(...contenido);
            if (!res || res.last !== false || contenido.length === 0) return acumulado;
        }
    }

    async function obtenerMiUsuarioId() {
        if (miUsuarioId) return miUsuarioId;
        const usuario = await verificarSesion();
        const id = usuario && (usuario.idUsuario || usuario.id);
        miUsuarioId = id ? Number(id) : null;
        return miUsuarioId;
    }

    async function cargarPacientes() {
        const estudiantes = await listarTodo('/estudiantes');
        patientsData = estudiantes
            .filter(est => est.usuario && est.usuario.idUsuario !== null && est.usuario.idUsuario !== undefined)
            .map(est => ({
                id: String(est.idEstudiante),
                userId: Number(est.usuario.idUsuario),
                name: `${est.nombres || ''} ${est.apellidos || ''}`.trim() || 'Estudiante',
                carnet: est.codigoCarnet || '',
                iniciales: inicialesDe(est.nombres, est.apellidos),
                color: colorAvatar(est.idEstudiante),
                lastMsg: 'Sin mensajes',
                time: '',
                lastDate: null,
                unread: 0,
                messages: []
            }));
    }

    function agregarNotificacion(paciente, titulo, descripcion, hora, idUnico) {
        notificationsData.unshift({
            id: idUnico,
            type: 'message',
            unread: true,
            title: titulo,
            desc: descripcion,
            time: hora,
            icon: 'bi-chat-left-text-fill',
            pacienteId: paciente.id
        });
    }

    function procesarMensajes(mensajes, anunciar) {
        let agregados = 0;
        mensajes
            .filter(m => m.idMensaje > ultimoIdProcesado)
            .sort((a, b) => a.idMensaje - b.idMensaje)
            .forEach(m => {
                ultimoIdProcesado = Math.max(ultimoIdProcesado, m.idMensaje);

                const emisor = m.emisor ? Number(m.emisor.idUsuario) : null;
                const receptor = m.receptor ? Number(m.receptor.idUsuario) : null;
                const esMio = emisor === miUsuarioId;
                if (!esMio && receptor !== miUsuarioId) return;

                const paciente = patientsData.find(p => p.userId === (esMio ? receptor : emisor));
                if (!paciente || paciente.messages.some(x => x.id === m.idMensaje)) return;
                agregados++;

                paciente.messages.push({
                    id: m.idMensaje,
                    sender: esMio ? 'doctor' : 'patient',
                    text: m.contenido,
                    time: formatearHora(m.fechaEnvio),
                    leido: m.leido === 1,
                    emisorId: emisor,
                    receptorId: receptor
                });
                paciente.lastMsg = `${esMio ? 'Tú: ' : ''}${m.contenido}`;
                paciente.lastDate = m.fechaEnvio;
                paciente.time = etiquetaFecha(m.fechaEnvio);

                if (!esMio && m.leido !== 1) {
                    paciente.unread++;
                    if (anunciar) {
                        agregarNotificacion(paciente, `Mensaje de ${paciente.name}`, recortar(m.contenido, 60), formatearHora(m.fechaEnvio), m.idMensaje);
                        const conversacionAbierta = chatPanel.classList.contains('active') && activeChatId === paciente.id;
                        if (!conversacionAbierta && typeof Notif !== 'undefined') {
                            Notif.info(recortar(m.contenido, 80), `Nuevo mensaje de ${paciente.name}`);
                        }
                    }
                }
            });
        return agregados;
    }

    function resumirNoLeidos() {
        patientsData.filter(p => p.unread > 0).forEach(p => {
            const plural = p.unread === 1 ? 'mensaje sin leer' : 'mensajes sin leer';
            agregarNotificacion(p, `Mensaje de ${p.name}`, `${p.unread} ${plural}`, p.time, `resumen-${p.id}`);
        });
    }

    async function sincronizar() {
        if (sincronizando && Date.now() - inicioSincronizacion < LIMITE_ESPERA) return;
        sincronizando = true;
        inicioSincronizacion = Date.now();

        try {
            if (!(await obtenerMiUsuarioId())) return;

            if (!cargaInicialLista) {
                await cargarPacientes();
                const todos = await listarTodo('/mensajes', '&sortBy=idMensaje&direction=asc');
                procesarMensajes(todos, false);
                resumirNoLeidos();
                cargaInicialLista = true;
                refrescarVistas();
                return;
            }

            const res = await peticionApi(`/mensajes?page=0&size=${TAMANO_PAGINA}&sortBy=idMensaje&direction=desc`);
            const recientes = Array.isArray(res) ? res : ((res && res.content) || []);
            if (procesarMensajes(recientes, true) > 0) refrescarVistas();
        } catch (error) {
            if (error && error.status === 403) detenerSincronizacion();
        } finally {
            sincronizando = false;
        }
    }

    function programarSincronizacion() {
        clearTimeout(temporizador);
        if (!sincronizacionActiva) return;

        const espera = chatPanel.classList.contains('active') ? INTERVALO_CHAT_ABIERTO : INTERVALO_CHAT_CERRADO;
        temporizador = setTimeout(async () => {
            await sincronizar();
            programarSincronizacion();
        }, espera);
    }

    function iniciarSincronizacion() {
        if (sincronizacionActiva) return;
        sincronizacionActiva = true;
        programarSincronizacion();
    }

    function detenerSincronizacion() {
        sincronizacionActiva = false;
        clearTimeout(temporizador);
        temporizador = null;
    }

    window.addEventListener('focus', sincronizar);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') sincronizar();
    });

    function refrescarVistas() {
        const buscador = document.getElementById('chatSearchInput');
        renderPatientList(buscador ? buscador.value.toLowerCase() : '');
        renderNotifications();

        const paciente = patientsData.find(p => p.id === activeChatId);
        if (paciente && chatPanel.classList.contains('active')) {
            renderMessages(paciente);
            marcarComoLeidos(paciente);
        }
    }

    async function marcarComoLeidos(paciente) {
        const pendientes = paciente.messages.filter(m => m.sender === 'patient' && !m.leido);
        if (pendientes.length === 0) return;

        pendientes.forEach(m => { m.leido = true; });
        paciente.unread = 0;
        notificationsData.forEach(n => {
            if (n.pacienteId === paciente.id) n.unread = false;
        });
        renderNotifications();
        renderPatientList();

        await Promise.all(pendientes.map(m =>
            peticionApi(`/mensajes/${m.id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    emisor: { idUsuario: m.emisorId },
                    receptor: { idUsuario: m.receptorId },
                    contenido: m.text,
                    leido: 1
                })
            }).catch(() => { })
        ));
    }

    const bellIcon = document.querySelector('.bi-bell.fs-4');
    const chatIcon = document.querySelector('.bi-chat.fs-4');

    function envolverIconoConBadge(icono, idBadge, claseBadge) {
        const contenedor = document.createElement('span');
        contenedor.className = 'icono-con-badge';
        if (icono.classList.contains('me-3')) {
            icono.classList.remove('me-3');
            contenedor.classList.add('me-3');
        }
        icono.parentNode.insertBefore(contenedor, icono);
        contenedor.appendChild(icono);

        const badge = document.createElement('span');
        badge.className = claseBadge;
        badge.id = idBadge;
        badge.style.display = 'none';
        contenedor.appendChild(badge);
    }

    if (bellIcon) {
        bellIcon.classList.add('clickable-icon');
        envolverIconoConBadge(bellIcon, 'bellUnreadBadge', 'unread-badge');
    }

    if (chatIcon) {
        chatIcon.classList.add('clickable-icon');
        envolverIconoConBadge(chatIcon, 'chatUnreadBadge', 'unread-count-badge');
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
                    <input type="text" class="chat-input-field" id="chatInputField" placeholder="Escribe un mensaje aquí..." maxlength="4000" autocomplete="off">
                </div>
                <button type="submit" class="chat-send-btn"><i class="bi bi-send-fill"></i></button>
            </form>
        </div>
    `;
    document.body.appendChild(chatPanel);

    if (bellIcon) {
        (bellIcon.closest('button') || bellIcon).addEventListener('click', (e) => {
            e.stopPropagation();
            const dropdown = document.getElementById('notificationDropdown');
            if (dropdown) {
                dropdown.classList.toggle('active');
            }
            closeChat();
        });
    }

    const openChatButtons = [];
    if (chatIcon) openChatButtons.push(chatIcon.closest('button') || chatIcon);
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
            renderPatientList(e.target.value.toLowerCase());
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

    async function openChat() {
        chatOverlay.classList.add('active');
        chatPanel.classList.add('active');

        if (typeof window.ocultarBotonCloudee === 'function') {
            window.ocultarBotonCloudee();
        } else {
            const btnAI = document.getElementById('btnAIAssistant');
            if (btnAI) btnAI.style.display = 'none';
        }

        await sincronizar();
        iniciarSincronizacion();
        programarSincronizacion();

        if (!activeChatId || !patientsData.some(p => p.id === activeChatId)) {
            const conMensajes = patientsData.find(p => p.messages.length > 0);
            activeChatId = conMensajes ? conMensajes.id : (patientsData[0] ? patientsData[0].id : null);
        }

        renderPatientList();
        if (activeChatId) {
            loadConversation(activeChatId);
        }
    }

    function closeChat() {
        chatOverlay.classList.remove('active');
        chatPanel.classList.remove('active');

        if (typeof window.mostrarBotonCloudee === 'function') {
            window.mostrarBotonCloudee();
        } else {
            const btnAI = document.getElementById('btnAIAssistant');
            const aiPanel = document.getElementById('aiAssistantPanel');
            if (btnAI && (!aiPanel || !aiPanel.classList.contains('active'))) {
                btnAI.style.display = 'flex';
            }
        }
    }

    function updateUnreadBadge() {
        const hasUnread = notificationsData.some(n => n.unread);
        const badge = document.getElementById('bellUnreadBadge');
        if (badge) {
            badge.style.display = hasUnread ? 'block' : 'none';
        }

        const totalSinLeer = patientsData.reduce((suma, p) => suma + (p.unread || 0), 0);
        const badgeChat = document.getElementById('chatUnreadBadge');
        if (badgeChat) {
            badgeChat.textContent = totalSinLeer > 99 ? '99+' : String(totalSinLeer);
            badgeChat.style.display = totalSinLeer > 0 ? 'inline-flex' : 'none';
        }
        if (chatIcon) {
            chatIcon.title = totalSinLeer > 0
                ? `Mensajes (${totalSinLeer} sin leer)`
                : 'Mensajes';
        }
    }

    function renderNotifications() {
        const listContainer = document.getElementById('notificationList');
        if (!listContainer) return;

        listContainer.innerHTML = '';

        if (notificationsData.length === 0) {
            listContainer.innerHTML = '<div class="p-4 text-center text-muted">No tienes notificaciones nuevas</div>';
            updateUnreadBadge();
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
                    <div class="notification-item-title">${escapeHTML(n.title)}</div>
                    <div class="notification-item-desc">${escapeHTML(n.desc)}</div>
                    <div class="notification-item-time">${escapeHTML(n.time)}</div>
                </div>
            `;
            item.addEventListener('click', () => {
                n.unread = false;
                renderNotifications();
                updateUnreadBadge();
                if (n.pacienteId) activeChatId = n.pacienteId;
                openChat();
            });
            listContainer.appendChild(item);
        });
        updateUnreadBadge();
    }

    function renderPatientList(filterQuery = '') {
        const patientContainer = document.getElementById('chatPatientList');
        if (!patientContainer) return;

        patientContainer.innerHTML = '';

        const filteredPatients = patientsData
            .filter(p => p.name.toLowerCase().includes(filterQuery))
            .sort((a, b) => {
                if (a.lastDate && b.lastDate) return String(b.lastDate).localeCompare(String(a.lastDate));
                if (a.lastDate) return -1;
                if (b.lastDate) return 1;
                return a.name.localeCompare(b.name);
            });

        if (filteredPatients.length === 0) {
            patientContainer.innerHTML = '<div class="p-4 text-center text-muted">No se encontraron pacientes</div>';
            return;
        }

        filteredPatients.forEach(p => {
            const item = document.createElement('div');
            item.className = `chat-patient-item ${p.id === activeChatId ? 'active' : ''}`;
            item.innerHTML = `
                <div class="chat-avatar-wrapper">
                    ${avatarHTML(p)}
                </div>
                <div class="chat-patient-info">
                    <div class="chat-patient-header">
                        <span class="chat-patient-name">${escapeHTML(p.name)}</span>
                        <span class="chat-patient-time">${escapeHTML(p.time)}${p.unread > 0 ? ` <span class="badge rounded-pill bg-danger">${p.unread}</span>` : ''}</span>
                    </div>
                    <div class="chat-last-msg">${escapeHTML(recortar(p.lastMsg, 60))}</div>
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
                ${avatarHTML(patient)}
                <div>
                    <h5 class="chat-active-name">${escapeHTML(patient.name)}</h5>
                    <span class="chat-active-status offline">${patient.carnet ? `Carnet: ${escapeHTML(patient.carnet)}` : 'Estudiante'}</span>
                </div>
            `;
        }

        renderMessages(patient);
        marcarComoLeidos(patient);
    }

    function renderMessages(patient) {
        const conversationArea = document.getElementById('chatConversationArea');
        if (!conversationArea) return;

        conversationArea.innerHTML = '';

        if (patient.messages.length === 0) {
            conversationArea.innerHTML = '<div class="p-4 text-center text-muted">Aún no hay mensajes con este estudiante.</div>';
            return;
        }

        patient.messages.forEach(msg => {
            const bubble = document.createElement('div');
            bubble.className = `chat-msg-bubble ${msg.sender === 'doctor' ? 'sent' : 'received'}`;
            bubble.innerHTML = `
                ${escapeHTML(msg.text)}
                <span class="chat-msg-time">${escapeHTML(msg.time)}</span>
            `;
            conversationArea.appendChild(bubble);
        });

        setTimeout(() => {
            conversationArea.scrollTop = conversationArea.scrollHeight;
        }, 50);
    }

    async function handleSendMessage(e) {
        e.preventDefault();
        const inputField = document.getElementById('chatInputField');
        if (!inputField) return;

        const text = inputField.value.trim();
        if (!text) return;

        const patient = patientsData.find(p => p.id === activeChatId);
        if (!patient || !miUsuarioId) return;

        inputField.disabled = true;
        try {
            const creado = await peticionApi('/mensajes', {
                method: 'POST',
                body: JSON.stringify({
                    emisor: { idUsuario: miUsuarioId },
                    receptor: { idUsuario: patient.userId },
                    contenido: text,
                    fechaEnvio: ahoraLocalISO(),
                    leido: 0
                })
            });

            const fecha = (creado && creado.fechaEnvio) || ahoraLocalISO();
            ultimoIdProcesado = Math.max(ultimoIdProcesado, (creado && creado.idMensaje) || 0);
            patient.messages.push({
                id: creado ? creado.idMensaje : null,
                sender: 'doctor',
                text,
                time: formatearHora(fecha),
                leido: false,
                emisorId: miUsuarioId,
                receptorId: patient.userId
            });
            patient.lastMsg = `Tú: ${text}`;
            patient.lastDate = fecha;
            patient.time = etiquetaFecha(fecha);

            inputField.value = '';
            renderMessages(patient);
            renderPatientList();
        } catch (error) {
            if (typeof Notif !== 'undefined') {
                Notif.error(error.message || 'No se pudo enviar el mensaje.', 'Mensaje no enviado');
            }
        } finally {
            inputField.disabled = false;
            inputField.focus();
        }
    }

    function ocultarChat() {
        if (chatIcon) {
            const contenedor = chatIcon.closest('button') || chatIcon.closest('.icono-con-badge') || chatIcon;
            contenedor.style.display = 'none';
        }
        if (sidebarChatLink) {
            (sidebarChatLink.closest('li') || sidebarChatLink).style.display = 'none';
        }
        chatPanel.remove();
        chatOverlay.remove();
    }

    verificarSesion().then((usuario) => {
        if (usuario && String(usuario.tipoUsuario).toUpperCase() === 'ADMIN') {
            ocultarChat();
            return;
        }

        if (window.location.hash === '#openChat') {
            history.replaceState("", document.title, window.location.pathname + window.location.search);
            openChat();
        }

        sincronizar().then(iniciarSincronizacion);
    });
});
