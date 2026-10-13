document.addEventListener('DOMContentLoaded', () => {
    // Consulta de respaldo solo mientras el WebSocket está caído
    const INTERVALO_RESPALDO = 30000;
    const MENSAJES_POR_CARGA = 30;
    const ESPERA_CONFIRMACION = 10000;
    const AVISO_ESCRIBIENDO_MS = 2500;

    let patientsData = [];
    let notificationsData = [];
    let activeChatId = null;
    let miUsuarioId = null;
    let socket = null;
    let estadoConexion = 'desconectado';
    let temporizadorRespaldo = null;
    let sincronizando = false;
    let ultimoAvisoEscribiendo = 0;
    const temporizadoresEscribiendo = new Map();
    let filtroChat = 'todos';
    let misEstudiantesChat = null;
    let respuestaPendiente = null;

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
        const horas = d.getHours();
        const minutos = String(d.getMinutes()).padStart(2, '0');
        return `${horas % 12 || 12}:${minutos} ${horas < 12 ? 'a. m.' : 'p. m.'}`;
    }

    function etiquetaFecha(fecha) {
        const d = new Date(fecha);
        if (isNaN(d.getTime())) return '';
        const hoy = new Date();
        if (d.toDateString() === hoy.toDateString()) return formatearHora(fecha);
        const ayer = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1);
        if (d.toDateString() === ayer.toDateString()) return 'Ayer';
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    function idCliente() {
        return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    }

    async function obtenerMiUsuarioId() {
        if (miUsuarioId) return miUsuarioId;
        const usuario = await verificarSesion();
        const id = usuario && (usuario.idUsuario || usuario.id);
        miUsuarioId = id ? Number(id) : null;
        return miUsuarioId;
    }

    // Lista ligera de contactos (solo id, nombre y carnet), guardada unos minutos en la sesión.
    async function cargarPacientes() {
        const contactos = await MensajesService.contactos(miUsuarioId);
        patientsData = (Array.isArray(contactos) ? contactos : [])
            .filter(est => est.idUsuario !== null && est.idUsuario !== undefined)
            .map(est => ({
                id: String(est.idEstudiante),
                userId: Number(est.idUsuario),
                name: `${est.nombres || ''} ${est.apellidos || ''}`.trim() || 'Estudiante',
                carnet: est.codigoCarnet || '',
                iniciales: inicialesDe(est.nombres, est.apellidos),
                color: colorAvatar(est.idEstudiante),
                lastMsg: 'Sin mensajes',
                time: '',
                lastDate: null,
                unread: 0,
                messages: [],
                cargada: false,
                hayMas: false,
                escribiendo: false
            }));
    }

    function pacientePorUsuario(idUsuario) {
        return patientsData.find(p => p.userId === Number(idUsuario));
    }

    function convertirMensaje(m) {
        const emisor = m.emisor ? Number(m.emisor.idUsuario) : null;
        const receptor = m.receptor ? Number(m.receptor.idUsuario) : null;
        return {
            id: m.idMensaje,
            sender: emisor === miUsuarioId ? 'doctor' : 'patient',
            text: m.contenido,
            fecha: m.fechaEnvio,
            time: formatearHora(m.fechaEnvio),
            leido: m.leido === 1,
            emisorId: emisor,
            receptorId: receptor,
            respuestaA: m.idRespuestaA ?? null,
            citado: m.citado ? { id: m.citado.idMensaje, emisorId: Number(m.citado.idEmisor), text: m.citado.contenido } : null
        };
    }

    async function cargarMisEstudiantesChat() {
        try {
            const datos = await MensajesService.misEstudiantes();
            if (datos && !datos.todos) misEstudiantesChat = new Set((datos.ids || []).map(String));
        } catch (error) {
            misEstudiantesChat = null;
        }
        const chipMios = document.querySelector('.chat-filtro[data-filtro="mios"]');
        if (chipMios) chipMios.hidden = !misEstudiantesChat;
    }

    function actualizarUltimoMensaje(paciente, mensaje) {
        paciente.lastMsg = `${mensaje.sender === 'doctor' ? 'Tú: ' : ''}${mensaje.text}`;
        paciente.lastDate = mensaje.fecha;
        paciente.time = etiquetaFecha(mensaje.fecha);
    }

    const ICONOS_NOTIFICACION = {
        CITA: 'bi-calendar-event-fill',
        RECORDATORIO_CITA: 'bi-calendar-check-fill',
        RECORDATORIO_CUESTIONARIO: 'bi-clipboard2-check-fill'
    };

    function agregarNotificacionServidor(n) {
        if (!n || !n.idNotificacion) return false;
        const id = `servidor-${n.idNotificacion}`;
        if (notificationsData.some(item => item.id === id)) return false;
        notificationsData.unshift({
            id,
            idServidor: n.idNotificacion,
            type: 'appointment',
            unread: !n.leida,
            title: n.titulo,
            desc: n.mensaje,
            time: etiquetaFecha(n.fechaCreacion),
            icon: ICONOS_NOTIFICACION[n.tipo] || 'bi-bell-fill',
            url: n.url
        });
        return true;
    }

    function recibirNotificacion(n) {
        if (!agregarNotificacionServidor(n)) return;
        renderNotifications();
        updateUnreadBadge();
        Notif.info(n.mensaje, n.titulo);
        window.dispatchEvent(new CustomEvent('psyke:notificacion', { detail: n }));
    }

    async function cargarNotificacionesServidor() {
        try {
            const lista = await MensajesService.notificaciones();
            (Array.isArray(lista) ? lista : [])
                .slice(0, 15)
                .reverse()
                .forEach(agregarNotificacionServidor);
            renderNotifications();
            updateUnreadBadge();
        } catch (error) { }
    }

    function marcarNotificacionLeida(n) {
        if (!n.idServidor || !n.unread) return;
        MensajesService.marcarNotificacionLeida(n.idServidor).catch(() => { });
    }

    function agregarNotificacion(paciente, titulo, descripcion, hora, idUnico) {
        if (notificationsData.some(n => n.id === idUnico)) return;
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

    async function cargarResumen(anunciar) {
        const resumen = await MensajesService.resumen();
        (Array.isArray(resumen) ? resumen : []).forEach(item => {
            const paciente = pacientePorUsuario(item.idUsuario);
            if (!paciente || !item.ultimoMensaje) return;

            const ultimo = convertirMensaje(item.ultimoMensaje);
            const eraNuevo = !paciente.lastDate || String(ultimo.fecha) > String(paciente.lastDate);
            actualizarUltimoMensaje(paciente, ultimo);

            const conversacionAbierta = chatPanel.classList.contains('active') && activeChatId === paciente.id;
            paciente.unread = conversacionAbierta ? 0 : Number(item.noLeidos) || 0;

            if (paciente.unread > 0) {
                const plural = paciente.unread === 1 ? 'mensaje sin leer' : 'mensajes sin leer';
                agregarNotificacion(paciente, `Mensaje de ${paciente.name}`, `${paciente.unread} ${plural}`, paciente.time, `resumen-${paciente.id}-${ultimo.id}`);
                if (anunciar && eraNuevo && ultimo.sender === 'patient' && typeof Notif !== 'undefined') {
                    Notif.info(recortar(ultimo.text, 80), `Nuevo mensaje de ${paciente.name}`);
                }
            }
        });
    }

    async function traerConversacion(paciente, parametros) {
        const respuesta = await MensajesService.conversacion(paciente.userId, { limite: MENSAJES_POR_CARGA, ...parametros });
        return {
            mensajes: ((respuesta && respuesta.mensajes) || []).map(convertirMensaje),
            hayMas: Boolean(respuesta && respuesta.hayMas)
        };
    }

    async function cargarConversacion(paciente) {
        const { mensajes, hayMas } = await traerConversacion(paciente, {});
        paciente.messages = mensajes;
        paciente.hayMas = hayMas;
        paciente.cargada = true;
    }

    async function cargarAnteriores(paciente) {
        const primero = paciente.messages.find(m => m.id);
        if (!primero) return;

        const area = document.getElementById('chatConversationArea');
        const alturaPrevia = area ? area.scrollHeight : 0;

        const { mensajes, hayMas } = await traerConversacion(paciente, { antesDe: primero.id });
        const conocidos = new Set(paciente.messages.map(m => m.id));
        paciente.messages = mensajes.filter(m => !conocidos.has(m.id)).concat(paciente.messages);
        paciente.hayMas = hayMas;

        renderMessages(paciente, { mantenerPosicion: true });
        if (area) area.scrollTop = area.scrollHeight - alturaPrevia;
    }

    async function traerNuevos(paciente) {
        const ultimo = [...paciente.messages].reverse().find(m => m.id);
        if (!ultimo) {
            await cargarConversacion(paciente);
            return true;
        }
        const { mensajes } = await traerConversacion(paciente, { despuesDe: ultimo.id });
        const conocidos = new Set(paciente.messages.map(m => m.id));
        const nuevos = mensajes.filter(m => !conocidos.has(m.id));
        paciente.messages.push(...nuevos);
        return nuevos.length > 0;
    }

    async function resincronizar(anunciar) {
        if (sincronizando || !miUsuarioId) return;
        sincronizando = true;
        try {
            await cargarResumen(anunciar);
            const activo = patientsData.find(p => p.id === activeChatId);
            if (activo && activo.cargada && chatPanel.classList.contains('active')) {
                if (await traerNuevos(activo)) renderMessages(activo);
                marcarComoLeidos(activo);
            }
            refrescarListas();
        } catch (error) {
            if (error && error.status === 403) detenerRespaldo();
        } finally {
            sincronizando = false;
        }
    }

    function iniciarRespaldo() {
        if (temporizadorRespaldo) return;
        temporizadorRespaldo = setInterval(() => {
            // Las pestañas en segundo plano no consultan; se ponen al día al volver a ellas
            if (!document.hidden) resincronizar(true);
        }, INTERVALO_RESPALDO);
    }

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && temporizadorRespaldo) resincronizar(true);
    });

    function detenerRespaldo() {
        clearInterval(temporizadorRespaldo);
        temporizadorRespaldo = null;
    }

    async function obtenerTicket() {
        return await MensajesService.ticketTiempoReal();
    }

    function conectarTiempoReal() {
        if (socket || typeof ChatSocket === 'undefined') {
            if (!socket) iniciarRespaldo();
            return;
        }

        socket = ChatSocket.crear({
            url: () => window.WS_CHAT_URL,
            obtenerTicket
        });

        socket.alCambiarEstado(estado => {
            estadoConexion = estado;
            if (estado === 'conectado') {
                detenerRespaldo();
                resincronizar(true);
            } else if (estado === 'desconectado' || estado === 'no-disponible') {
                iniciarRespaldo();
            }
            actualizarEstadoCabecera();
        });

        socket.alEvento(procesarEvento);
        iniciarRespaldo();
        socket.conectar();
    }

    function procesarEvento(evento) {
        switch (evento.tipo) {
            case 'mensaje': return recibirMensaje(evento.mensaje, evento.clienteId);
            case 'mensaje_editado': return editarMensajeLocal(evento.mensaje);
            case 'mensaje_eliminado': return eliminarMensajeLocal(evento);
            case 'leidos': return aplicarLeidos(evento);
            case 'escribiendo': return mostrarEscribiendo(evento.emisorId);
            case 'error': return manejarErrorSocket(evento);
            case 'notificacion': return recibirNotificacion(evento.notificacion);
            default: return undefined;
        }
    }

    function recibirMensaje(datos, clienteId) {
        if (!datos) return;
        const mensaje = convertirMensaje(datos);
        const otro = mensaje.sender === 'doctor' ? mensaje.receptorId : mensaje.emisorId;
        const paciente = pacientePorUsuario(otro);
        if (!paciente) return;

        if (paciente.cargada) {
            const pendiente = clienteId ? paciente.messages.find(m => m.clienteId === clienteId) : null;
            if (pendiente) {
                Object.assign(pendiente, mensaje, { pendiente: false, fallido: false, clienteId: null });
            } else if (!paciente.messages.some(m => m.id === mensaje.id)) {
                paciente.messages.push(mensaje);
            }
        }
        actualizarUltimoMensaje(paciente, mensaje);

        const conversacionAbierta = chatPanel.classList.contains('active') && activeChatId === paciente.id;
        if (mensaje.sender === 'patient') {
            paciente.escribiendo = false;
            if (activeChatId === paciente.id) actualizarEstadoCabecera();
            if (conversacionAbierta) {
                marcarComoLeidos(paciente);
            } else {
                paciente.unread++;
                agregarNotificacion(paciente, `Mensaje de ${paciente.name}`, recortar(mensaje.text, 60), mensaje.time, mensaje.id);
                if (typeof Notif !== 'undefined') {
                    Notif.info(recortar(mensaje.text, 80), `Nuevo mensaje de ${paciente.name}`);
                }
            }
        }

        if (conversacionAbierta) renderMessages(paciente);
        refrescarListas();
    }

    function editarMensajeLocal(datos) {
        if (!datos) return;
        const mensaje = convertirMensaje(datos);
        const paciente = pacientePorUsuario(mensaje.sender === 'doctor' ? mensaje.receptorId : mensaje.emisorId);
        if (!paciente) return;
        const existente = paciente.messages.find(m => m.id === mensaje.id);
        if (existente) existente.text = mensaje.text;
        if (activeChatId === paciente.id) renderMessages(paciente);
    }

    function eliminarMensajeLocal(evento) {
        const otro = Number(evento.emisorId) === miUsuarioId ? evento.receptorId : evento.emisorId;
        const paciente = pacientePorUsuario(otro);
        if (!paciente) return;
        paciente.messages = paciente.messages.filter(m => m.id !== evento.idMensaje);
        if (activeChatId === paciente.id) renderMessages(paciente);
        resincronizar(false);
    }

    function aplicarLeidos(evento) {
        const lector = Number(evento.lectorId);
        if (lector === miUsuarioId) {
            const paciente = pacientePorUsuario(evento.emisorId);
            if (paciente) paciente.unread = 0;
            refrescarListas();
            return;
        }
        const paciente = pacientePorUsuario(lector);
        if (!paciente) return;
        paciente.messages.forEach(m => {
            if (m.sender === 'doctor') m.leido = true;
        });
        if (activeChatId === paciente.id) renderMessages(paciente);
    }

    function mostrarEscribiendo(idUsuario) {
        const paciente = pacientePorUsuario(idUsuario);
        if (!paciente) return;
        paciente.escribiendo = true;
        actualizarEstadoCabecera();
        clearTimeout(temporizadoresEscribiendo.get(paciente.id));
        temporizadoresEscribiendo.set(paciente.id, setTimeout(() => {
            paciente.escribiendo = false;
            actualizarEstadoCabecera();
        }, AVISO_ESCRIBIENDO_MS + 1000));
    }

    function manejarErrorSocket(evento) {
        if (evento.clienteId) {
            patientsData.forEach(p => {
                const pendiente = p.messages.find(m => m.clienteId === evento.clienteId);
                if (pendiente) {
                    pendiente.pendiente = false;
                    pendiente.fallido = true;
                    if (activeChatId === p.id) renderMessages(p);
                }
            });
        }
        if (typeof Notif !== 'undefined') {
            Notif.error(evento.mensaje || 'No se pudo enviar el mensaje.', 'Mensaje no enviado');
        }
    }

    function refrescarListas() {
        const buscador = document.getElementById('chatSearchInput');
        renderPatientList(buscador ? buscador.value.toLowerCase() : '');
        renderNotifications();
    }

    async function marcarComoLeidos(paciente) {
        const hayPendientes = paciente.unread > 0 || paciente.messages.some(m => m.sender === 'patient' && !m.leido);
        if (!hayPendientes) return;

        paciente.messages.forEach(m => {
            if (m.sender === 'patient') m.leido = true;
        });
        paciente.unread = 0;
        notificationsData.forEach(n => {
            if (n.pacienteId === paciente.id) n.unread = false;
        });
        refrescarListas();

        const enviado = socket && socket.enviar({ tipo: 'leer', conUsuario: paciente.userId });
        if (!enviado) {
            await MensajesService.marcarLeidos(paciente.userId).catch(() => { });
        }
    }

    function textoEstadoConexion() {
        if (estadoConexion === 'conectado') return { texto: 'Chat en tiempo real', clase: '' };
        if (estadoConexion === 'conectando') return { texto: 'Conectando…', clase: 'offline' };
        return { texto: 'Sin conexión en tiempo real · actualizando cada 10 s', clase: 'offline' };
    }

    function actualizarEstadoCabecera() {
        const estado = document.getElementById('chatEstadoConexion');
        const paciente = patientsData.find(p => p.id === activeChatId);
        if (!estado || !paciente) return;

        if (paciente.escribiendo) {
            estado.textContent = 'Escribiendo…';
            estado.className = 'chat-active-status';
            return;
        }
        const { texto, clase } = textoEstadoConexion();
        const carnet = paciente.carnet ? `Carnet: ${paciente.carnet} · ` : '';
        estado.textContent = `${carnet}${texto}`;
        estado.className = `chat-active-status ${clase}`.trim();
    }

    window.addEventListener('focus', () => {
        if (estadoConexion !== 'conectado') resincronizar(true);
    });

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
                <div class="chat-sidebar-titulo">
                    <h4>Estudiantes</h4>
                    <button type="button" class="chat-close-btn chat-close-lista" aria-label="Cerrar chat"><i class="bi bi-x-lg"></i></button>
                </div>
                <div class="chat-search-wrapper">
                    <i class="bi bi-search"></i>
                    <input type="text" class="chat-search-input" id="chatSearchInput" placeholder="Buscar estudiante...">
                </div>
                <div class="chat-filtros" role="tablist">
                    <button type="button" class="chat-filtro activo" data-filtro="todos">Todos</button>
                    <button type="button" class="chat-filtro" data-filtro="no_leidos">No leídos <span class="chat-filtro-contador" id="chatContadorNoLeidos" hidden></span></button>
                    <button type="button" class="chat-filtro" data-filtro="mios" hidden>Mis estudiantes</button>
                </div>
            </div>
            <div class="chat-patient-list" id="chatPatientList"></div>
        </div>
        <div class="chat-main">
            <div class="chat-main-header">
                <button type="button" class="chat-back-btn" id="chatBackBtn" aria-label="Volver a la lista"><i class="bi bi-arrow-left"></i></button>
                <div class="chat-active-user" id="chatActiveUser"></div>
                <button class="chat-close-btn" id="chatCloseBtn"><i class="bi bi-x-lg"></i></button>
            </div>
            <div class="chat-conversation-area" id="chatConversationArea"></div>
            <div class="chat-respuesta-barra" id="chatRespuestaBarra" hidden>
                <div class="chat-respuesta-contenido">
                    <strong id="chatRespuestaAutor"></strong>
                    <span id="chatRespuestaTexto"></span>
                </div>
                <button type="button" class="chat-respuesta-cancelar" id="chatRespuestaCancelar" aria-label="Cancelar respuesta"><i class="bi bi-x-lg"></i></button>
            </div>
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
    chatPanel.querySelector('.chat-close-lista')?.addEventListener('click', closeChat);
    document.getElementById('chatBackBtn')?.addEventListener('click', () => {
        chatPanel.classList.remove('viendo-conversacion');
    });
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

    document.getElementById('chatRespuestaCancelar')?.addEventListener('click', cancelarRespuesta);
    document.getElementById('chatInputField')?.addEventListener('keydown', (evento) => {
        if (evento.key === 'Escape' && respuestaPendiente) cancelarRespuesta();
    });

    chatPanel.querySelectorAll('.chat-filtro').forEach((chip) => {
        chip.addEventListener('click', () => {
            filtroChat = chip.dataset.filtro;
            chatPanel.querySelectorAll('.chat-filtro').forEach(c => c.classList.toggle('activo', c === chip));
            refrescarListas();
        });
    });

    const chatSearchInput = document.getElementById('chatSearchInput');
    if (chatSearchInput) {
        chatSearchInput.addEventListener('input', () => refrescarListas());
    }

    const markAllReadBtn = document.getElementById('markAllReadBtn');
    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', () => {
            if (notificationsData.some(n => n.idServidor && n.unread)) {
                MensajesService.marcarTodasLeidas().catch(() => { });
            }
            notificationsData.forEach(n => n.unread = false);
            renderNotifications();
            updateUnreadBadge();
        });
    }

    async function openChat(opciones = {}) {
        chatOverlay.classList.add('active');
        chatPanel.classList.add('active');
        chatPanel.classList.toggle('viendo-conversacion', opciones.mostrarConversacion === true);

        if (typeof window.ocultarBotonCloudee === 'function') {
            window.ocultarBotonCloudee();
        } else {
            const btnAI = document.getElementById('btnAIAssistant');
            if (btnAI) btnAI.style.display = 'none';
        }

        if (!activeChatId || !patientsData.some(p => p.id === activeChatId)) {
            const conMensajes = patientsData
                .filter(p => p.lastDate)
                .sort((a, b) => String(b.lastDate).localeCompare(String(a.lastDate)))[0];
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
                marcarNotificacionLeida(n);
                n.unread = false;
                renderNotifications();
                updateUnreadBadge();
                if (n.url) {
                    window.location.href = n.url;
                    return;
                }
                if (n.pacienteId) activeChatId = n.pacienteId;
                openChat({ mostrarConversacion: Boolean(n.pacienteId) });
            });
            listContainer.appendChild(item);
        });
        updateUnreadBadge();
    }

    function renderPatientList(filterQuery = '') {
        const patientContainer = document.getElementById('chatPatientList');
        if (!patientContainer) return;

        patientContainer.innerHTML = '';

        const totalNoLeidos = patientsData.filter(p => p.unread > 0).length;
        const contador = document.getElementById('chatContadorNoLeidos');
        if (contador) {
            contador.textContent = totalNoLeidos;
            contador.hidden = totalNoLeidos === 0;
        }

        const filteredPatients = patientsData
            .filter(p => p.name.toLowerCase().includes(filterQuery))
            .filter(p => {
                if (filtroChat === 'no_leidos') return p.unread > 0;
                if (filtroChat === 'mios') return !misEstudiantesChat || misEstudiantesChat.has(String(p.id));
                return true;
            })
            .sort((a, b) => {
                if (a.lastDate && b.lastDate) return String(b.lastDate).localeCompare(String(a.lastDate));
                if (a.lastDate) return -1;
                if (b.lastDate) return 1;
                return a.name.localeCompare(b.name);
            });

        if (filteredPatients.length === 0) {
            const vacio = filtroChat === 'no_leidos' && !filterQuery
                ? '<i class="bi bi-check2-all d-block fs-3 mb-1"></i>Estás al día, no tienes mensajes sin leer.'
                : 'No se encontraron estudiantes';
            patientContainer.innerHTML = `<div class="p-4 text-center text-muted">${vacio}</div>`;
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
                if (activeChatId !== p.id) cancelarRespuesta();
                activeChatId = p.id;
                document.querySelectorAll('.chat-patient-item').forEach(el => el.classList.remove('active'));
                item.classList.add('active');
                chatPanel.classList.add('viendo-conversacion');
                loadConversation(p.id);
            });
            patientContainer.appendChild(item);
        });
    }

    async function loadConversation(patientId) {
        const patient = patientsData.find(p => p.id === patientId);
        if (!patient) return;

        const activeUserContainer = document.getElementById('chatActiveUser');
        if (activeUserContainer) {
            activeUserContainer.innerHTML = `
                ${avatarHTML(patient)}
                <div>
                    <h5 class="chat-active-name">${escapeHTML(patient.name)}</h5>
                    <span class="chat-active-status offline" id="chatEstadoConexion"></span>
                </div>
            `;
        }
        actualizarEstadoCabecera();

        if (!patient.cargada) {
            const area = document.getElementById('chatConversationArea');
            if (area) area.innerHTML = '<div class="p-4 text-center text-muted"><div class="spinner-border spinner-border-sm text-primary me-2"></div>Cargando mensajes...</div>';
            try {
                await cargarConversacion(patient);
            } catch (error) {
                if (area) area.innerHTML = '<div class="p-4 text-center text-danger">No se pudieron cargar los mensajes.</div>';
                return;
            }
            if (activeChatId !== patient.id) return;
        }

        renderMessages(patient);
        marcarComoLeidos(patient);
    }

    function estadoEnvioHTML(msg) {
        if (msg.sender !== 'doctor') return '';
        if (msg.fallido) return ' <i class="bi bi-exclamation-circle" title="No enviado"></i>';
        if (msg.pendiente) return ' <i class="bi bi-clock" title="Enviando"></i>';
        return msg.leido
            ? ' <i class="bi bi-check-all" title="Visto"></i>'
            : ' <i class="bi bi-check" title="Enviado"></i>';
    }

    function renderMessages(patient, opciones = {}) {
        const conversationArea = document.getElementById('chatConversationArea');
        if (!conversationArea) return;

        const cercaDelFinal = conversationArea.scrollHeight - conversationArea.scrollTop - conversationArea.clientHeight < 120;
        conversationArea.innerHTML = '';

        if (patient.hayMas) {
            const botonAnteriores = document.createElement('button');
            botonAnteriores.type = 'button';
            botonAnteriores.className = 'chat-load-more';
            botonAnteriores.innerHTML = '<i class="bi bi-clock-history"></i> Cargar mensajes anteriores';
            botonAnteriores.addEventListener('click', async () => {
                botonAnteriores.disabled = true;
                botonAnteriores.textContent = 'Cargando...';
                try {
                    await cargarAnteriores(patient);
                } catch (error) {
                    botonAnteriores.disabled = false;
                    botonAnteriores.textContent = 'No se pudo cargar. Toca para reintentar';
                }
            });
            conversationArea.appendChild(botonAnteriores);
        }

        if (patient.messages.length === 0) {
            conversationArea.insertAdjacentHTML('beforeend', '<div class="p-4 text-center text-muted">Aún no hay mensajes con este estudiante.</div>');
            return;
        }

        patient.messages.forEach(msg => {
            const bubble = document.createElement('div');
            bubble.className = `chat-msg-bubble ${msg.sender === 'doctor' ? 'sent' : 'received'}${msg.pendiente ? ' pendiente' : ''}${msg.fallido ? ' fallido' : ''}`;
            if (msg.id) bubble.dataset.id = msg.id;
            bubble.innerHTML = `
                ${citaHTML(msg, patient)}
                <span class="chat-msg-texto">${escapeHTML(msg.text)}</span>
                <span class="chat-msg-time">${escapeHTML(msg.time)}${estadoEnvioHTML(msg)}</span>
                ${msg.id ? '<button type="button" class="chat-msg-responder" title="Responder" aria-label="Responder"><i class="bi bi-reply-fill"></i></button>' : ''}
            `;
            if (msg.id) activarRespuesta(bubble, msg, patient);
            conversationArea.appendChild(bubble);
        });

        if (!opciones.mantenerPosicion && (cercaDelFinal || patient.messages[patient.messages.length - 1].sender === 'doctor')) {
            setTimeout(() => {
                conversationArea.scrollTop = conversationArea.scrollHeight;
            }, 30);
        }
    }

    function autorDe(emisorId, patient) {
        return Number(emisorId) === miUsuarioId ? 'Tú' : patient.name;
    }

    function citaHTML(msg, patient) {
        if (!msg.respuestaA) return '';
        if (!msg.citado) {
            return '<div class="chat-cita eliminada"><span>Mensaje eliminado</span></div>';
        }
        return `
            <div class="chat-cita${Number(msg.citado.emisorId) === miUsuarioId ? ' propia' : ''}" data-ir="${msg.citado.id}" role="button" tabindex="0">
                <strong>${escapeHTML(autorDe(msg.citado.emisorId, patient))}</strong>
                <span>${escapeHTML(recortar(msg.citado.text, 120))}</span>
            </div>`;
    }

    function activarRespuesta(bubble, msg, patient) {
        bubble.querySelector('.chat-msg-responder')?.addEventListener('click', () => prepararRespuesta(msg, patient));
        bubble.addEventListener('dblclick', () => prepararRespuesta(msg, patient));

        const cita = bubble.querySelector('.chat-cita[data-ir]');
        if (cita) cita.addEventListener('click', () => irAMensaje(cita.dataset.ir));

        let inicioX = null;
        let inicioY = null;
        let desplazamiento = 0;
        bubble.addEventListener('touchstart', (evento) => {
            inicioX = evento.touches[0].clientX;
            inicioY = evento.touches[0].clientY;
            desplazamiento = 0;
            bubble.style.transition = 'none';
        }, { passive: true });
        bubble.addEventListener('touchmove', (evento) => {
            if (inicioX === null) return;
            const dx = evento.touches[0].clientX - inicioX;
            const dy = Math.abs(evento.touches[0].clientY - inicioY);
            if (dy > 30) { inicioX = null; bubble.style.transform = ''; return; }
            desplazamiento = Math.max(0, Math.min(dx, 80));
            bubble.style.transform = `translateX(${desplazamiento}px)`;
            bubble.classList.toggle('deslizando', desplazamiento > 50);
        }, { passive: true });
        bubble.addEventListener('touchend', () => {
            bubble.style.transition = '';
            bubble.style.transform = '';
            bubble.classList.remove('deslizando');
            if (desplazamiento > 50) prepararRespuesta(msg, patient);
            inicioX = null;
            desplazamiento = 0;
        });
    }

    function prepararRespuesta(msg, patient) {
        respuestaPendiente = { id: msg.id, emisorId: msg.emisorId, text: msg.text };
        const barra = document.getElementById('chatRespuestaBarra');
        document.getElementById('chatRespuestaAutor').textContent = `Respondiendo a ${autorDe(msg.emisorId, patient)}`;
        document.getElementById('chatRespuestaTexto').textContent = recortar(msg.text, 140);
        barra.classList.toggle('propia', Number(msg.emisorId) === miUsuarioId);
        barra.hidden = false;
        document.getElementById('chatInputField')?.focus();
    }

    function cancelarRespuesta() {
        respuestaPendiente = null;
        const barra = document.getElementById('chatRespuestaBarra');
        if (barra) barra.hidden = true;
    }

    function irAMensaje(id) {
        const destino = document.querySelector(`#chatConversationArea .chat-msg-bubble[data-id="${id}"]`);
        if (!destino) {
            if (typeof Notif !== 'undefined') Notif.info('Ese mensaje es más antiguo. Carga los mensajes anteriores para verlo.', 'Mensaje anterior');
            return;
        }
        destino.scrollIntoView({ behavior: 'smooth', block: 'center' });
        destino.classList.remove('resaltado');
        void destino.offsetWidth;
        destino.classList.add('resaltado');
    }

    async function enviarPorRest(patient, text, provisional) {
        try {
            const creado = await MensajesService.enviar(patient.userId, text, provisional.respuestaA);
            const mensaje = convertirMensaje(creado);
            if (patient.messages.some(m => m.id === mensaje.id)) {
                patient.messages = patient.messages.filter(m => m !== provisional);
            } else {
                Object.assign(provisional, mensaje, { pendiente: false, fallido: false, clienteId: null });
            }
            actualizarUltimoMensaje(patient, mensaje);
        } catch (error) {
            provisional.pendiente = false;
            provisional.fallido = true;
            if (typeof Notif !== 'undefined') {
                Notif.error(error.message || 'No se pudo enviar el mensaje.', 'Mensaje no enviado');
            }
        }
        if (activeChatId === patient.id) renderMessages(patient);
        refrescarListas();
    }

    async function handleSendMessage(e) {
        e.preventDefault();
        const inputField = document.getElementById('chatInputField');
        if (!inputField) return;

        const text = inputField.value.trim();
        if (!text) return;

        const patient = patientsData.find(p => p.id === activeChatId);
        if (!patient || !miUsuarioId) return;

        const ahora = new Date().toISOString();
        const provisional = {
            id: null,
            clienteId: idCliente(),
            sender: 'doctor',
            text,
            fecha: ahora,
            time: formatearHora(ahora),
            leido: false,
            pendiente: true,
            emisorId: miUsuarioId,
            receptorId: patient.userId,
            respuestaA: respuestaPendiente ? respuestaPendiente.id : null,
            citado: respuestaPendiente ? { id: respuestaPendiente.id, emisorId: respuestaPendiente.emisorId, text: respuestaPendiente.text } : null
        };
        patient.messages.push(provisional);
        cancelarRespuesta();
        inputField.value = '';
        renderMessages(patient);
        inputField.focus();

        const enviadoPorSocket = socket && socket.enviar({
            tipo: 'enviar',
            receptorId: patient.userId,
            contenido: text,
            clienteId: provisional.clienteId,
            respuestaA: provisional.respuestaA
        });

        if (!enviadoPorSocket) {
            await enviarPorRest(patient, text, provisional);
            return;
        }

        setTimeout(() => {
            if (provisional.pendiente) {
                provisional.pendiente = false;
                provisional.fallido = true;
                if (activeChatId === patient.id) renderMessages(patient);
            }
        }, ESPERA_CONFIRMACION);
    }

    const campoMensaje = document.getElementById('chatInputField');
    if (campoMensaje) {
        campoMensaje.addEventListener('input', () => {
            const patient = patientsData.find(p => p.id === activeChatId);
            if (!patient || !socket || !campoMensaje.value.trim()) return;
            if (Date.now() - ultimoAvisoEscribiendo < AVISO_ESCRIBIENDO_MS) return;
            ultimoAvisoEscribiendo = Date.now();
            socket.enviar({ tipo: 'escribiendo', receptorId: patient.userId });
        });
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

    async function iniciarChat() {
        const usuario = await verificarSesion();
        if (usuario && String(usuario.tipoUsuario).toUpperCase() === 'ADMIN') {
            ocultarChat();
            return;
        }
        cargarNotificacionesServidor();
        if (!(await obtenerMiUsuarioId())) return;

        try {
            await cargarPacientes();
            cargarMisEstudiantesYRefrescar();
            await cargarResumen(false);
        } catch (error) {
            if (error && error.status === 403) return;
        }
        refrescarListas();
        conectarTiempoReal();

        if (window.location.hash === '#openChat') {
            history.replaceState("", document.title, window.location.pathname + window.location.search);
            openChat();
        }
    }

    async function cargarMisEstudiantesYRefrescar() {
        await cargarMisEstudiantesChat();
        refrescarListas();
    }

    iniciarChat();
});
