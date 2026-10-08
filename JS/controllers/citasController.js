
document.addEventListener('DOMContentLoaded', () => {

    const estado = {
        citas: [],
        estudiantes: [],
        psicologos: [],
        expedientes: [],
        filtro: 'todas',
        textoBusqueda: '',
        rangoFechas: null,
        misEstudiantes: null,
        filtroEstado: '',
        modoEdicion: false,
        idEnEdicion: null,
        usuarioSesion: null,
        psicologoLogueado: null,
        marcaNuevas: Infinity,
        creadasPorMi: new Set(),
        citaResaltada: Number(new URLSearchParams(window.location.search).get('cita')) || null,
        paginaActual: 1,
        limitePorPagina: 10,
        totalElementos: 0,
        totalPaginas: 1,
        resumen: null,
        solicitudActual: 0
    };

    async function obtenerUsuarioSesion() {
        if (typeof verificarSesion === 'function') {
            return await verificarSesion();
        }
        try {
            const respuesta = await fetch((window.AUTH_API_URL || 'http://localhost:8081/api/auth') + '/me', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
            if (respuesta.ok) return await respuesta.json();
        } catch (e) { }
        return null;
    }

    const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    function el(id) {
        return document.getElementById(id);
    }

    function escapeHTML(str) {
        return String(str ?? '').replace(/[&<>"']/g, (c) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[c]));
    }

    function iniciales(nombreCompleto) {
        const partes = (nombreCompleto || '').trim().split(/\s+/);
        if (!partes.length || !partes[0]) return 'ES';
        return ((partes[0][0] || '') + (partes[1] ? partes[1][0] : (partes[0][1] || ''))).toUpperCase();
    }


    function idCita(cita) {
        return cita.idCita ?? cita.id;
    }

    function nombreEstudiante(cita) {
        const est = cita.estudiante;
        if (est && typeof est === 'object') {
            return `${est.nombre ?? est.nombres ?? ''} ${est.apellido ?? est.apellidos ?? ''}`.trim();
        }
        return est || cita.nombreEstudiante || 'Sin estudiante';
    }

    function carnetEstudiante(cita) {
        const est = cita.estudiante;
        const carnet = est && typeof est === 'object' ? (est.carnet ?? est.codigoCarnet) : null;
        return carnet ?? cita.carnetEstudiante ?? cita.carnet ?? '';
    }

    function nombrePsicologo(cita) {
        const psi = cita.psicologo;
        if (psi && typeof psi === 'object') {
            return psi.nombre ?? psi.nombresCompletos ?? `${psi.nombres ?? ''} ${psi.apellidos ?? ''}`.trim();
        }
        return psi || cita.nombrePsicologo || 'Sin psicólogo';
    }

    function fechaCita(cita) {
        return String(cita.fecha ?? cita.fechaHoraCita ?? '').split('T')[0];
    }

    function horaCita(cita) {
        if (cita.hora) return String(cita.hora).substring(0, 5);
        const texto = String(cita.fechaHoraCita ?? '');
        return texto.includes('T') ? texto.split('T')[1].substring(0, 5) : '';
    }

    function formatearHora12(hora24) {
        if (!hora24) return '';
        const [h, m] = hora24.split(':').map(Number);
        if (isNaN(h) || isNaN(m)) return hora24;
        const periodo = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 === 0 ? 12 : h % 12;
        return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${periodo}`;
    }

    const HORA_INICIO = '08:00';
    const HORA_FIN = '15:30';

    function hoyISO() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function horaActual() {
        const d = new Date();
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }

    function esFinDeSemana(fechaISO) {
        const dia = new Date(fechaISO + 'T00:00:00').getDay();
        return dia === 0 || dia === 6;
    }

    function yaPaso(fechaISO, hora) {
        if (!fechaISO) return false;
        const momento = new Date(`${fechaISO}T${hora || '00:00'}:00`);
        return !isNaN(momento.getTime()) && momento <= new Date();
    }

    function generarOpcionesHora30Min(valorActual) {
        const select = el('horaCita');
        if (!select) return;
        const fecha = el('fechaCita')?.value;
        const esHoy = fecha === hoyISO();
        const ahora = horaActual();

        select.innerHTML = '<option value="" selected disabled>Seleccionar hora</option>';
        for (let h = 8; h <= 15; h++) {
            for (let m = 0; m < 60; m += 30) {
                const val24 = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                if (val24 < HORA_INICIO || val24 > HORA_FIN) continue;
                const opt = document.createElement('option');
                opt.value = val24;
                opt.textContent = formatearHora12(val24);
                if (!estado.modoEdicion && esHoy && val24 <= ahora) opt.disabled = true;
                select.appendChild(opt);
            }
        }
        if (valorActual && !select.querySelector(`option[value="${valorActual}"]`)) {
            const opt = document.createElement('option');
            opt.value = valorActual;
            opt.textContent = `${formatearHora12(valorActual)} (fuera de horario)`;
            select.appendChild(opt);
        }
        if (valorActual) select.value = valorActual;
    }

    function actualizarOpcionesEstado() {
        const select = el('estadoCita');
        if (!select) return;
        const pasada = yaPaso(el('fechaCita')?.value, el('horaCita')?.value);
        const opcionRealizada = select.querySelector('option[value="REALIZADA"]');
        if (opcionRealizada) {
            opcionRealizada.disabled = !pasada;
            opcionRealizada.textContent = pasada ? 'Realizada' : 'Realizada (disponible cuando pase la cita)';
        }
        if (!pasada && select.value === 'REALIZADA') select.value = 'PENDIENTE';
    }

    function actualizarAyudaFecha() {
        const ayuda = el('fechaCitaAyuda');
        const fecha = el('fechaCita')?.value;
        if (!ayuda) return;
        if (fecha && esFinDeSemana(fecha)) {
            ayuda.textContent = 'Ese día es fin de semana. Elige de lunes a viernes.';
            ayuda.classList.add('text-danger');
        } else {
            ayuda.textContent = fecha === hoyISO() ? 'Hoy · solo de lunes a viernes' : 'Solo de lunes a viernes';
            ayuda.classList.remove('text-danger');
        }
    }

    function idPsicologoPorDefecto() {
        if (estado.psicologoLogueado) return estado.psicologoLogueado.idPsicologo ?? estado.psicologoLogueado.id;
        if (estado.psicologos.length === 1) return estado.psicologos[0].idPsicologo;
        return null;
    }

    function textoEstudiante(est) {
        const nombre = `${est.nombres ?? est.nombre ?? ''} ${est.apellidos ?? ''}`.trim();
        const carnet = est.codigoCarnet ?? est.carnet;
        return carnet ? `${nombre} (Carnet: ${carnet})` : nombre;
    }

    function subtituloEstudiante(est) {
        const partes = [];
        const carnet = est.codigoCarnet ?? est.carnet;
        if (carnet) partes.push(carnet);
        const grado = est.grado?.nombreGrado;
        if (grado) partes.push(`${grado}${est.seccion?.nombreSeccion ? ` "${est.seccion.nombreSeccion}"` : ''}`);
        return partes.join(' · ');
    }

    function crearOpcionEstudiante(est) {
        const opt = document.createElement('option');
        opt.value = est.idEstudiante ?? est.id;
        opt.textContent = textoEstudiante(est);
        opt.dataset.texto = `${est.nombres ?? est.nombre ?? ''} ${est.apellidos ?? ''}`.trim();
        opt.dataset.subtitulo = subtituloEstudiante(est);
        return opt;
    }

    function renderOpcionesEstudiantes() {
        const select = el('estudianteSelect');
        if (!select) return;
        const seleccionado = select.value;
        const ordenados = [...estado.estudiantes]
            .sort((a, b) => textoEstudiante(a).localeCompare(textoEstudiante(b), 'es'));

        select.innerHTML = '<option value="" disabled selected>Seleccionar estudiante</option>';

        if (estado.misEstudiantes) {
            const mios = ordenados.filter(est => estado.misEstudiantes.has(Number(est.idEstudiante ?? est.id)));
            const otros = ordenados.filter(est => !estado.misEstudiantes.has(Number(est.idEstudiante ?? est.id)));
            [['Mis estudiantes', mios], ['Otros estudiantes', otros]].forEach(([titulo, lista]) => {
                if (lista.length === 0) return;
                const grupo = document.createElement('optgroup');
                grupo.label = `${titulo} (${lista.length})`;
                lista.forEach(est => grupo.appendChild(crearOpcionEstudiante(est)));
                select.appendChild(grupo);
            });
        } else {
            ordenados.forEach(est => select.appendChild(crearOpcionEstudiante(est)));
        }

        if (seleccionado && select.querySelector(`option[value="${seleccionado}"]`)) {
            select.value = seleccionado;
        }
        selectores.estudiante?.sincronizar();
    }

    function renderOpcionesPsicologos(select, lista, textoInicial) {
        if (!select) return;
        select.innerHTML = `<option value="" selected disabled>${textoInicial}</option>`;
        lista.forEach(psi => {
            const opt = document.createElement('option');
            opt.value = psi.idPsicologo ?? psi.id;
            opt.dataset.texto = `${psi.nombresCompletos ?? psi.nombre ?? ''} ${psi.apellidosCompletos ?? ''}`.trim();
            opt.textContent = opt.dataset.texto;
            const correo = psi.usuario?.correo ?? psi.correo;
            if (correo) opt.dataset.subtitulo = correo;
            if (estado.psicologoLogueado && Number(opt.value) === Number(estado.psicologoLogueado.idPsicologo)) {
                opt.dataset.insignia = 'Tú';
            }
            select.appendChild(opt);
        });
    }

    async function asegurarExpediente(idEstudiante) {
        const existente = estado.expedientes.find(exp => Number(exp.estudiante?.idEstudiante ?? exp.idEstudiante) === Number(idEstudiante));
        if (existente) return { expediente: existente, creado: false };

        const lista = await CasosTransferidosService.listarExpedientes();
        estado.expedientes = Array.isArray(lista) ? lista : [];
        const recargado = estado.expedientes.find(exp => Number(exp.estudiante?.idEstudiante ?? exp.idEstudiante) === Number(idEstudiante));
        if (recargado) return { expediente: recargado, creado: false };

        const nuevo = await CasosTransferidosService.crearExpediente({ estudiante: { idEstudiante: Number(idEstudiante) } });
        if (nuevo) estado.expedientes.push(nuevo);
        return { expediente: nuevo, creado: true };
    }

    window.abrirSeguimiento = async function (idEstudiante) {
        if (!idEstudiante) return;
        try {
            await asegurarExpediente(idEstudiante);
            window.location.href = `seguimientos.html?estudiante=${encodeURIComponent(idEstudiante)}`;
        } catch (error) {
            Notif.error(mensajeErrorAmigable(error), 'No se pudo abrir el seguimiento');
        }
    };

    function estadoCita(cita) {
        return String(cita.estado ?? cita.estadoConfirmacion ?? '').toUpperCase();
    }

    function motivoCita(cita) {
        return cita.motivo ?? cita.observaciones ?? '';
    }

    function formatearFechaLegible(fechaVal) {
        const partes = String(fechaVal ?? '').split('T')[0].split('-');
        if (partes.length !== 3) return fechaVal || 'Sin fecha';
        return `${partes[2]} ${MESES[parseInt(partes[1], 10) - 1] || ''} ${partes[0]}`;
    }

    function esProxima(cita) {
        const fecha = fechaCita(cita);
        if (!fecha) return false;
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const fechaInicio = new Date(fecha + 'T00:00:00');
        return !isNaN(fechaInicio.getTime()) && fechaInicio >= hoy;
    }

    function colorBarraEstado(estadoVal) {
        if (estadoVal === 'CONFIRMADA' || estadoVal === 'REALIZADA') return 'verde';
        if (estadoVal === 'PENDIENTE') return 'amarillo';
        return 'rojo';
    }

    function badgeEstado(estadoVal) {
        const e = String(estadoVal || '').toUpperCase();
        const mapa = {
            CONFIRMADA: ['confirmada', 'bi-check-circle-fill', 'Confirmada'],
            REALIZADA: ['realizada', 'bi-check2-all', 'Realizada'],
            PENDIENTE: ['pendiente', 'bi-clock-history', 'Pendiente'],
            CANCELADA: ['cancelada', 'bi-x-circle-fill', 'Cancelada']
        };
        const [clase, icono, texto] = mapa[e] || ['pendiente', 'bi-question-circle', e || 'Sin estado'];
        return `<span class="badge-cita-estado ${clase}"><i class="bi ${icono}"></i> ${escapeHTML(texto)}</span>`;
    }


    function actualizarMetricas() {
        const r = estado.resumen || {};
        if (el('totalCitas')) el('totalCitas').textContent = r.total ?? 0;
        if (el('totalConfirmadas')) el('totalConfirmadas').textContent = r.CONFIRMADA ?? 0;
        if (el('totalPendientes')) el('totalPendientes').textContent = r.PENDIENTE ?? 0;
        if (el('totalCanceladas')) el('totalCanceladas').textContent = r.CANCELADA ?? 0;
    }


    const ESTADO_POR_PESTANA = { pendientes: 'PENDIENTE', canceladas: 'CANCELADA' };
    const DIAS_RECIENTES = 14;

    function desplazarDias(fechaISO, dias) {
        const [a, m, d] = fechaISO.split('-').map(Number);
        const fecha = new Date(a, m - 1, d + dias);
        return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
    }

    function actualizarAyudaPeriodo() {
        const ayuda = el('ayudaPeriodoCitas');
        if (!ayuda) return;
        let texto = '';
        if (estado.rangoFechas) {
            texto = 'Mostrando las citas del rango de fechas elegido.';
        } else if (estado.filtro === 'historial') {
            texto = `Citas de hace más de ${DIAS_RECIENTES} días.`;
        } else if (estado.filtro === 'proximas') {
            texto = 'Citas de hoy en adelante.';
        } else if (estado.filtro === 'pendientes') {
            texto = 'Todas las citas que aún esperan confirmación.';
        } else {
            texto = `Se ocultan las citas de hace más de ${DIAS_RECIENTES} días. Están en la pestaña Historial.`;
        }
        ayuda.innerHTML = `<i class="bi bi-info-circle"></i> ${escapeHTML(texto)}`;
    }

    function construirFiltros() {
        const estadoPestana = ESTADO_POR_PESTANA[estado.filtro] || '';
        const estadoSelect = (estado.filtroEstado || '').toUpperCase();
        if (estadoPestana && estadoSelect && estadoPestana !== estadoSelect) {
            return null;
        }

        const filtros = {
            page: estado.paginaActual - 1,
            size: estado.limitePorPagina,
            sortBy: 'fechaHoraCita',
            direction: estado.filtro === 'proximas' ? 'asc' : 'desc'
        };
        const estadoFinal = estadoPestana || estadoSelect;
        if (estadoFinal) filtros.estado = estadoFinal;

        if (estado.rangoFechas) {
            filtros.desde = estado.rangoFechas.desde;
            filtros.hasta = estado.rangoFechas.hasta;
            filtros.direction = 'asc';
        } else if (estado.filtro === 'proximas') {
            filtros.desde = hoyISO();
        } else if (estado.filtro === 'historial') {
            filtros.hasta = desplazarDias(hoyISO(), -(DIAS_RECIENTES + 1));
        } else if (estado.filtro !== 'pendientes') {
            filtros.desde = desplazarDias(hoyISO(), -DIAS_RECIENTES);
        }

        if (estado.textoBusqueda) filtros.busqueda = estado.textoBusqueda;
        return filtros;
    }

    function actualizarPaginacionCitasUI(inicio, fin, total, paginaActual, totalPaginas) {
        const info = el('infoPaginacionCitas');
        const ind = el('indicadorPaginaCitas');
        const btnPrev = el('btnPrevCitas');
        const btnNext = el('btnNextCitas');

        if (info) {
            info.innerHTML = total === 0
                ? 'Mostrando <strong>0</strong> - <strong>0</strong> de <strong>0</strong> citas'
                : `Mostrando <strong>${inicio}</strong> - <strong>${fin}</strong> de <strong>${total}</strong> citas`;
        }
        if (ind) ind.textContent = `Página ${paginaActual} de ${totalPaginas}`;
        if (btnPrev) btnPrev.disabled = paginaActual <= 1;
        if (btnNext) btnNext.disabled = paginaActual >= totalPaginas;
    }

    function renderTabla() {
        const tbody = el('tablaCitas');
        if (!tbody) return;

        const totalItems = estado.totalElementos;
        const totalPaginas = Math.max(1, estado.totalPaginas);
        const inicio = (estado.paginaActual - 1) * estado.limitePorPagina;
        const citasPagina = estado.citas;
        const fin = inicio + citasPagina.length;

        tbody.innerHTML = '';
        if (el('contadorMostrados')) el('contadorMostrados').textContent = totalItems;

        if (citasPagina.length === 0) {
            const hayFiltros = estado.filtro !== 'todas' || estado.rangoFechas || estado.filtroEstado || estado.textoBusqueda;
            const mensaje = hayFiltros
                ? 'No se encontraron citas con esos filtros.'
                : 'No hay citas registradas en el sistema';
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-4 text-muted">
                        <i class="bi bi-calendar-x fs-1 mb-2 d-block opacity-50"></i>
                        ${mensaje}
                    </td>
                </tr>`;
            actualizarPaginacionCitasUI(0, 0, 0, 1, 1);
            actualizarMetricas();
            return;
        }

        citasPagina.forEach((cita, indiceRelativo) => {
            const indiceGlobal = inicio + indiceRelativo;
            const id = idCita(cita);
            const est = estadoCita(cita);
            const nombre = nombreEstudiante(cita);
            const hora = horaCita(cita);
            const hora12 = formatearHora12(hora);

            const esNueva = Number(id) > estado.marcaNuevas && !estado.creadasPorMi.has(Number(id));
            const puedeRecordar = (est === 'PENDIENTE' || est === 'CONFIRMADA') && !yaPaso(fechaCita(cita), hora);
            const tr = document.createElement('tr');
            tr.dataset.idCita = id;
            if (esNueva) tr.classList.add('cita-nueva');
            if (estado.citaResaltada && Number(id) === estado.citaResaltada) tr.classList.add('cita-resaltada');
            tr.innerHTML = `
                <td><div class="barra-estado ${colorBarraEstado(est)}"></div></td>
                <td class="fw-bold text-muted">#${indiceGlobal + 1}</td>
                <td>
                    <div class="d-flex align-items-center gap-2">
                        <div class="student-avatar-badge">${escapeHTML(iniciales(nombre))}</div>
                        <span class="fw-semibold">${escapeHTML(nombre)}</span>
                        ${esNueva ? '<span class="pill-nueva">Nueva</span>' : ''}
                    </div>
                </td>
                <td class="text-muted">${escapeHTML(carnetEstudiante(cita)) || '—'}</td>
                <td>${escapeHTML(nombrePsicologo(cita))}</td>
                <td>
                    <span class="d-inline-flex align-items-center gap-1">
                        <i class="bi bi-calendar3 text-muted"></i> ${escapeHTML(formatearFechaLegible(fechaCita(cita)))}
                        ${hora12 ? `&nbsp;·&nbsp;<i class="bi bi-clock text-muted"></i> ${escapeHTML(hora12)}` : ''}
                    </span>
                </td>
                <td>${badgeEstado(est)}</td>
                <td class="text-center">
                    <div class="d-flex justify-content-center gap-1">
                        <button class="btn-accion-table btn-ver" onclick="verExpediente(${id})" title="Ver detalle de la cita">
                            <i class="bi bi-eye"></i>
                        </button>
                        <button class="btn-accion-table btn-ver" onclick="abrirSeguimiento(${cita.estudiante?.idEstudiante ?? 'null'})" title="Ver seguimiento del caso">
                            <i class="bi bi-journal-medical"></i>
                        </button>
                        ${puedeRecordar ? `
                        <button class="btn-accion-table btn-recordatorio" onclick="enviarRecordatorioCita(${id})" title="Enviar recordatorio al estudiante">
                            <i class="bi bi-bell"></i>
                        </button>` : ''}
                        <button class="btn-accion-table btn-editar" onclick="abrirModalEditarCita(${id})" title="Reprogramar / Editar cita">
                            <i class="bi bi-pencil-square"></i>
                        </button>
                        <button class="btn-accion-table btn-transferir" onclick="abrirModalTransferirCaso(${id})" title="Transferir caso del estudiante">
                            <i class="bi bi-arrow-left-right"></i>
                        </button>
                        ${est === 'PENDIENTE' ? `
                        <button class="btn-accion-table btn-confirmar" onclick="confirmarCita(${id})" title="Confirmar cita">
                            <i class="bi bi-check-circle-fill"></i>
                        </button>` : ''}
                        ${est !== 'CANCELADA' ? `
                        <button class="btn-accion-table btn-cancelar" onclick="cancelarCita(${id})" title="Cancelar cita">
                            <i class="bi bi-x-circle"></i>
                        </button>` : ''}
                        <button class="btn-accion-table btn-eliminar" onclick="eliminarCita(${id})" title="Eliminar cita del sistema">
                            <i class="bi bi-trash3"></i>
                        </button>
                    </div>
                </td>`;
            tbody.appendChild(tr);
        });

        actualizarPaginacionCitasUI(inicio + 1, fin, totalItems, estado.paginaActual, totalPaginas);
        actualizarMetricas();
        recordarUltimaCitaVista(citasPagina);
        enfocarCitaResaltada();
    }

    function claveUltimaCita() {
        const usuario = estado.usuarioSesion?.idUsuario ?? estado.usuarioSesion?.correo ?? 'anonimo';
        return `psyke_ultima_cita_${usuario}`;
    }

    function cargarMarcaNuevas() {
        try {
            const guardado = Number(localStorage.getItem(claveUltimaCita()));
            estado.marcaNuevas = guardado > 0 ? guardado : Infinity;
        } catch (error) {
            estado.marcaNuevas = Infinity;
        }
    }

    function recordarUltimaCitaVista(citas) {
        const mayor = Math.max(0, ...citas.map(c => Number(idCita(c)) || 0));
        try {
            const guardado = Number(localStorage.getItem(claveUltimaCita())) || 0;
            if (mayor > guardado) localStorage.setItem(claveUltimaCita(), String(mayor));
        } catch (error) { }
    }

    function enfocarCitaResaltada() {
        if (!estado.citaResaltada) return;
        const fila = document.querySelector(`#tablaCitas tr[data-id-cita="${estado.citaResaltada}"]`);
        if (!fila) return;
        fila.scrollIntoView({ behavior: 'smooth', block: 'center' });
        estado.citaResaltada = null;
        history.replaceState(null, '', window.location.pathname);
    }

    window.enviarRecordatorioCita = (id) => {
        const cita = estado.citas.find(c => Number(idCita(c)) === Number(id));
        if (!cita) return;
        const hora12 = formatearHora12(horaCita(cita));
        Recordatorios.abrir({
            idEstudiante: cita.estudiante?.idEstudiante,
            nombre: nombreEstudiante(cita),
            tipo: 'CITA',
            mensaje: `Te recuerdo tu cita del ${formatearFechaLegible(fechaCita(cita))}${hora12 ? ` a las ${hora12}` : ''}. ¡Te espero!`
        });
    };

    window.addEventListener('psyke:notificacion', (evento) => {
        if (evento.detail?.tipo === 'CITA') recargarCitas();
    });

    async function cargarMisEstudiantes() {
        if (estado.usuarioSesion?.tipoUsuario !== 'PSICOLOGO') return;
        try {
            const respuesta = await peticionApi('/estudiantes/mis-estudiantes');
            if (respuesta && !respuesta.todos) {
                estado.misEstudiantes = new Set((respuesta.ids || []).map(Number));
            }
        } catch (error) {
            estado.misEstudiantes = null;
        }
    }

    async function cargarSelectores() {
        try {
            const [estudiantes] = await Promise.all([EstudiantesService.listar(), cargarMisEstudiantes()]);
            estado.estudiantes = Array.isArray(estudiantes) ? estudiantes : [];
            renderOpcionesEstudiantes();
        } catch (error) {
            const status = error?.status;
            if (status === 401) throw error;
            Notif.error(status === 403 ? 'Acceso denegado: Permisos insuficientes' : mensajeErrorAmigable(error), 'No se pudieron cargar los estudiantes');
        }

        try {
            const psicologos = await PsicologosService.listar();
            estado.psicologos = Array.isArray(psicologos) ? psicologos : [];
            renderOpcionesPsicologos(el('psicologoSelect'), estado.psicologos, 'Seleccionar psicólogo');
        } catch (error) {
            const status = error?.status;
            if (status === 401) throw error;
            Notif.error(status === 403 ? 'Acceso denegado: Permisos insuficientes' : mensajeErrorAmigable(error), 'No se pudieron cargar los psicólogos');
        }

        try {
            if (typeof CasosTransferidosService !== 'undefined' && CasosTransferidosService.listarExpedientes) {
                const expedientes = await CasosTransferidosService.listarExpedientes();
                estado.expedientes = Array.isArray(expedientes) ? expedientes : [];
            }
        } catch (error) {
            console.warn('No se pudieron precargar los expedientes:', error);
        }
    }


    function limpiarErrores() {
        document.querySelectorAll('#formCrearCita .is-invalid')
            .forEach(c => c.classList.remove('is-invalid'));
        document.querySelectorAll('#formCrearCita .invalid-feedback')
            .forEach(fb => fb.remove());
    }

    function marcarError(id, mensaje) {
        const campo = el(id);
        if (!campo) return;
        campo.classList.add('is-invalid');
        let fb = campo.nextElementSibling;
        if (!fb || !fb.classList.contains('invalid-feedback')) {
            fb = document.createElement('div');
            fb.className = 'invalid-feedback';
            campo.parentNode.insertBefore(fb, campo.nextSibling);
        }
        fb.textContent = mensaje;
    }

    function validarFormulario() {
        let valido = true;

        if (!el('estudianteSelect').value) {
            marcarError('estudianteSelect', 'Seleccione el estudiante de la cita.');
            valido = false;
        }

        if (!el('psicologoSelect').value) {
            marcarError('psicologoSelect', 'Seleccione el psicólogo asignado.');
            valido = false;
        }

        const fecha = el('fechaCita').value;
        if (!fecha) {
            marcarError('fechaCita', 'La fecha de la cita es obligatoria.');
            valido = false;
        } else {
            const fechaObj = new Date(fecha + 'T00:00:00');
            if (isNaN(fechaObj.getTime())) {
                marcarError('fechaCita', 'Ingrese una fecha válida.');
                valido = false;
            } else if (esFinDeSemana(fecha)) {
                marcarError('fechaCita', 'Las citas solo se pueden programar de lunes a viernes.');
                valido = false;
            } else {
                const estadoSel = el('estadoCita').value;
                if ((estadoSel === 'PENDIENTE' || estadoSel === 'CONFIRMADA') && fechaObj < new Date(new Date().toDateString())) {
                    marcarError('fechaCita', 'La fecha no puede ser anterior a hoy.');
                    valido = false;
                }
            }
        }

        const hora = el('horaCita').value;
        if (!hora) {
            marcarError('horaCita', 'La hora de la cita es obligatoria.');
            valido = false;
        } else if (hora < HORA_INICIO || hora > HORA_FIN) {
            marcarError('horaCita', 'La hora debe estar entre 8:00 AM y 3:30 PM.');
            valido = false;
        } else if (!estado.modoEdicion && fecha && yaPaso(fecha, hora)) {
            marcarError('horaCita', 'Esa hora ya pasó. Elige una hora posterior.');
            valido = false;
        }

        if (el('estadoCita').value === 'REALIZADA' && !yaPaso(fecha, hora)) {
            marcarError('estadoCita', 'Solo puede marcarse como realizada cuando ya pasó la fecha y hora de la cita.');
            valido = false;
        }

        if (!el('motivoCita').value.trim()) {
            marcarError('motivoCita', 'El motivo de consulta es obligatorio.');
            valido = false;
        }

        return valido;
    }

    function construirPayload() {
        return {
            estudiante: { idEstudiante: Number(el('estudianteSelect').value) },
            psicologo: { idPsicologo: Number(el('psicologoSelect').value) },
            fechaHoraCita: `${el('fechaCita').value}T${el('horaCita').value}:00`,
            estado: el('estadoCita').value,
            estadoConfirmacion: el('estadoCita').value,
            motivo: el('motivoCita').value.trim()
        };
    }


    function abrirModalCita() {
        const modal = new bootstrap.Modal(el('modalCrearCita'));
        modal.show();
    }

    function cerrarModalCita() {
        const modal = bootstrap.Modal.getInstance(el('modalCrearCita'));
        if (modal) modal.hide();
    }

    window.abrirModalAgregarCita = function () {
        estado.modoEdicion = false;
        estado.idEnEdicion = null;

        const form = el('formCrearCita');
        if (form) form.reset();
        limpiarErrores();

        renderOpcionesEstudiantes();

        el('citaId').value = '';
        el('fechaCita').min = hoyISO();
        el('estadoCita').value = 'PENDIENTE';
        generarOpcionesHora30Min();
        actualizarAyudaFecha();
        actualizarOpcionesEstado();

        const psiSel = el('psicologoSelect');
        if (psiSel) {
            const idPsi = idPsicologoPorDefecto();
            if (idPsi) psiSel.value = idPsi;
            psiSel.disabled = estado.usuarioSesion?.tipoUsuario === 'PSICOLOGO' && Boolean(estado.psicologoLogueado);
        }
        sincronizarSelectores();

        el('modalCrearCitaLabel').innerHTML =
            '<i class="bi bi-calendar-plus-fill text-primary"></i> <span>Programar Nueva Cita</span>';
        el('btnGuardarCita').innerHTML = '<i class="bi bi-check-lg"></i> Guardar Cita';

        abrirModalCita();
    };

    window.abrirModalEditarCita = function (id) {
        const cita = estado.citas.find(c => Number(idCita(c)) === Number(id));
        if (!cita) return;

        estado.modoEdicion = true;
        estado.idEnEdicion = id;
        limpiarErrores();

        renderOpcionesEstudiantes();

        el('citaId').value = id;
        el('estudianteSelect').value = cita.estudiante?.idEstudiante ?? '';
        el('psicologoSelect').value = cita.psicologo?.idPsicologo ?? '';
        el('fechaCita').removeAttribute('min');
        el('fechaCita').value = fechaCita(cita);
        generarOpcionesHora30Min(horaCita(cita));
        el('estadoCita').value = estadoCita(cita) || 'PENDIENTE';
        el('motivoCita').value = motivoCita(cita);
        actualizarAyudaFecha();
        actualizarOpcionesEstado();
        sincronizarSelectores();

        el('modalCrearCitaLabel').innerHTML =
            '<i class="bi bi-pencil-square text-primary"></i> <span>Reprogramar Cita</span>';
        el('btnGuardarCita').innerHTML = '<i class="bi bi-check2-circle"></i> Actualizar Cita';

        abrirModalCita();
    };

    window.verExpediente = function (id) {
        const cita = estado.citas.find(c => Number(idCita(c)) === Number(id));
        if (!cita) return;

        const nombre = nombreEstudiante(cita);
        const hora = horaCita(cita);
        const hora12 = formatearHora12(hora);
        const idEstudianteCita = cita.estudiante?.idEstudiante ?? cita.estudiante?.id;

        const esMomentoCita = yaPaso(fechaCita(cita), hora) && estadoCita(cita) !== 'CANCELADA';

        el('expedienteModalTitulo').textContent = 'Detalle de la Cita';
        el('expedienteModalBody').innerHTML = `
            <div class="d-flex align-items-center gap-3 mb-4">
                <div class="student-avatar-badge" style="width: 50px; height: 50px; font-size: 1.2rem;">${escapeHTML(iniciales(nombre))}</div>
                <div>
                    <h4 class="mb-0 fw-bold text-dark">${escapeHTML(nombre)}</h4>
                    <p class="text-muted small mb-0">
                        Carnet: <span class="fw-semibold text-dark">${escapeHTML(carnetEstudiante(cita)) || '—'}</span>
                        &bull; Psicólogo: <span class="fw-semibold text-dark">${escapeHTML(nombrePsicologo(cita))}</span>
                    </p>
                </div>
            </div>
            <div class="card p-3 mb-3 border-0 bg-light">
                <h6 class="fw-bold mb-2 text-dark"><i class="bi bi-calendar-event me-2 text-primary"></i>Fecha y Hora Programada</h6>
                <p class="small text-muted mb-0">
                    <i class="bi bi-calendar3 me-1"></i>${escapeHTML(formatearFechaLegible(fechaCita(cita)))}
                    ${hora12 ? ` &nbsp;·&nbsp; <i class="bi bi-clock me-1"></i>${escapeHTML(hora12)}` : ''}
                </p>
            </div>
            <div class="card p-3 mb-3 border-0 bg-light">
                <h6 class="fw-bold mb-2 text-dark"><i class="bi bi-flag-fill me-2 text-primary"></i>Estado de la Cita</h6>
                <div>${badgeEstado(estadoCita(cita))}</div>
            </div>
            <div class="card p-3 mb-3 border-0 bg-light">
                <h6 class="fw-bold mb-2 text-dark"><i class="bi bi-chat-left-text me-2 text-primary"></i>Motivo de Consulta</h6>
                <p class="small text-muted mb-0" style="line-height: 1.6;">${escapeHTML(motivoCita(cita)) || 'Sin motivo registrado.'}</p>
            </div>
            <div class="d-flex justify-content-end mb-3">
                <button type="button" class="btn btn-outline-primary btn-sm" onclick="abrirSeguimiento(${idEstudianteCita})">
                    <i class="bi bi-journal-medical me-1"></i> Ver seguimiento del caso
                </button>
            </div>

            ${esMomentoCita ? `
            <div class="card p-3 border-primary bg-primary bg-opacity-10 mb-3" id="boxSesionNotas">
                <h6 class="fw-bold text-primary mb-2"><i class="bi bi-journal-check me-2"></i>Registrar Notas de Sesión</h6>
                <textarea class="form-control mb-2" id="inputNotasSesion" rows="3" placeholder="Escriba las observaciones y notas relevantes de la sesión realizada..."></textarea>
                <div class="d-flex justify-content-end">
                    <button type="button" class="btn btn-primary btn-sm" onclick="guardarNotasSesion(${idEstudianteCita}, ${id})">
                        <i class="bi bi-save me-1"></i> Guardar Sesión en Seguimiento
                    </button>
                </div>
            </div>` : ''}`;

        const modal = new bootstrap.Modal(el('modalExpediente'));
        modal.show();
    };


    function mensajeErrorAmigable(error) {
        if (error?.errores) return Object.values(error.errores).join(' ');
        return error?.message || 'Ocurrió un error inesperado.';
    }

    function mostrarCargandoTabla() {
        const tbody = el('tablaCitas');
        if (!tbody) return;
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-4 text-muted">
                    <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                    Cargando citas...
                </td>
            </tr>`;
    }

    async function cargarResumen() {
        try {
            estado.resumen = await CitasService.resumen();
        } catch (error) {
            estado.resumen = null;
        }
        actualizarMetricas();
    }

    async function recargarCitas({ conResumen = true } = {}) {
        const numeroSolicitud = ++estado.solicitudActual;
        actualizarAyudaPeriodo();
        const filtros = construirFiltros();
        if (conResumen) cargarResumen();

        if (!filtros) {
            estado.citas = [];
            estado.totalElementos = 0;
            estado.totalPaginas = 1;
            renderTabla();
            return;
        }

        mostrarCargandoTabla();
        try {
            const pagina = await CitasService.buscar(filtros);
            if (numeroSolicitud !== estado.solicitudActual) return;
            estado.citas = Array.isArray(pagina?.content) ? pagina.content : normalizarListado(pagina);
            estado.totalElementos = Number(pagina?.totalElements ?? pagina?.page?.totalElements ?? estado.citas.length) || 0;
            estado.totalPaginas = Number(pagina?.totalPages ?? pagina?.page?.totalPages ?? 1) || 1;

            if (estado.paginaActual > estado.totalPaginas && estado.totalElementos > 0) {
                estado.paginaActual = estado.totalPaginas;
                return recargarCitas({ conResumen: false });
            }
        } catch (error) {
            if (numeroSolicitud !== estado.solicitudActual) return;
            const status = error?.status;
            if (status === 401) {
                throw error;
            }
            estado.citas = [];
            estado.totalElementos = 0;
            estado.totalPaginas = 1;
            let mensaje;
            if (status === 403) {
                mensaje = 'Acceso denegado: Permisos insuficientes para ver las citas.';
            } else if (status === 429) {
                mensaje = error.message;
            } else if (status >= 500) {
                mensaje = 'Error interno del servidor al cargar las citas. Intente nuevamente más tarde.';
            } else {
                mensaje = 'No se pudieron cargar las citas en este momento';
            }
            Notif.error(mensaje);
        }
        renderTabla();
    }

    async function guardarFormulario() {
        limpiarErrores();
        if (!validarFormulario()) return;

        const payload = construirPayload();

        try {
            if (estado.modoEdicion && estado.idEnEdicion !== null) {
                await CitasService.actualizar(estado.idEnEdicion, payload);
                Notif.exito('¡Cita actualizada exitosamente!');
            } else {
                const creada = await CitasService.crear(payload);
                const idCreada = Number(creada?.idCita);
                if (idCreada) {
                    estado.creadasPorMi.add(idCreada);
                    try { localStorage.setItem(claveUltimaCita(), String(Math.max(idCreada, Number(localStorage.getItem(claveUltimaCita())) || 0))); } catch (e) { }
                }
                let seguimientoCreado = false;
                try {
                    seguimientoCreado = (await asegurarExpediente(payload.estudiante.idEstudiante)).creado;
                } catch (errorExpediente) { }
                Notif.exito(seguimientoCreado
                    ? 'Cita programada. Como es la primera cita del estudiante, se abrió su seguimiento de caso.'
                    : '¡Cita programada exitosamente!');
            }

            await recargarCitas();
            cerrarModalCita();
        } catch (error) {
            if (/misma (fecha y )?hora|ya tiene (programada )?otra cita/i.test(error?.message || '')) {
                marcarError('horaCita', error.message);
            }
            Notif.error(mensajeErrorAmigable(error), 'No se pudo guardar la cita');
        }
    }

    window.confirmarCita = async function (id) {
        const cita = estado.citas.find(c => Number(idCita(c)) === Number(id));
        if (!cita) return;

        const confirmado = await Notif.confirmar(
            '¿Confirmar cita?',
            `Se confirmará la cita de ${nombreEstudiante(cita)} programada para el ${formatearFechaLegible(fechaCita(cita))}.`,
            'Sí, confirmar'
        );

        if (!confirmado) return;

        try {
            await CitasService.cambiarEstado(id, 'CONFIRMADA', cita);
            await recargarCitas();
            Notif.exito('¡Cita confirmada exitosamente!');
        } catch (error) {
            Notif.error(mensajeErrorAmigable(error), 'No se pudo confirmar la cita');
        }
    };

    window.guardarNotasSesion = async function (idEstudiante, idCitaTarget) {
        const notas = el('inputNotasSesion')?.value.trim();
        if (!notas) {
            Notif.advertencia('Escribe las notas o el resumen de la sesión antes de guardar.', 'Faltan las notas');
            return;
        }

        const cita = estado.citas.find(c => Number(idCita(c)) === Number(idCitaTarget));
        if (!cita) return;

        if (!yaPaso(fechaCita(cita), horaCita(cita))) {
            Notif.advertencia('Solo puedes registrar la sesión cuando ya pasó la fecha y hora de la cita.', 'Aún no es la cita');
            return;
        }

        try {
            const { expediente } = await asegurarExpediente(idEstudiante);
            const idExpediente = expediente?.idExpediente ?? expediente?.id;
            if (!idExpediente) {
                Notif.error('No se pudo encontrar ni crear el seguimiento de caso del estudiante.');
                return;
            }

            await peticionApi('/sesiones', {
                method: 'POST',
                body: {
                    expediente: { idExpediente: Number(idExpediente) },
                    psicologo: { idPsicologo: Number(cita.psicologo?.idPsicologo ?? idPsicologoPorDefecto()) },
                    cita: { idCita: Number(idCitaTarget) },
                    fechaAtencion: fechaCita(cita),
                    tipoProceso: 'Sesión de seguimiento',
                    estadoEstudiante: 'Seguimiento',
                    notasAnotaciones: notas,
                    marcadorCritico: 'NO'
                }
            });

            if (estadoCita(cita) !== 'REALIZADA') {
                await CitasService.cambiarEstado(idCitaTarget, 'REALIZADA', cita);
            }
            await recargarCitas();

            const modalInstance = bootstrap.Modal.getInstance(el('modalExpediente'));
            if (modalInstance) modalInstance.hide();

            Notif.exito('Las notas se guardaron en el seguimiento del caso y la cita quedó como realizada.', 'Sesión registrada');
        } catch (error) {
            Notif.error(mensajeErrorAmigable(error), 'No se pudo guardar la sesión');
        }
    };

    window.cargarCitas = recargarCitas;

    async function ejecutarCancelacionCita(idCitaTarget) {
        try {
            const citaObj = estado.citas.find(c => Number(idCita(c)) === Number(idCitaTarget));
            if (typeof CitasService !== 'undefined' && CitasService.cambiarEstado) {
                await CitasService.cambiarEstado(idCitaTarget, 'CANCELADA', citaObj);
            } else {
                await peticionApi(`/citas/${idCitaTarget}`, 'PUT', { estado: 'CANCELADA' });
            }

            Notif.exito('La cita se canceló correctamente.', 'Cita cancelada');

            await cargarCitas();
        } catch (error) {
            console.error('Error al ejecutar la cancelación de la cita:', error);
            Notif.error(mensajeErrorAmigable(error), 'No se pudo cancelar la cita');
        }
    }

    window.ejecutarCancelacionCita = ejecutarCancelacionCita;

    window.cancelarCita = async function (idCita) {
        const confirmado = await Notif.confirmar(
            '¿Cancelar cita?',
            'La cita quedará marcada como cancelada.',
            'Sí, cancelar cita',
            { icono: 'warning', peligro: true, botonCancelar: 'No, mantener' }
        );

        if (confirmado) {
            await ejecutarCancelacionCita(idCita);
        }
    };

    window.eliminarCita = async function (id) {
        const cita = estado.citas.find(c => Number(idCita(c)) === Number(id));
        if (!cita) return;

        const confirmado = await Notif.confirmarEliminar(
            '¿Eliminar cita?',
            `Se eliminará la cita de ${nombreEstudiante(cita)}. Esta acción no se puede deshacer.`
        );

        if (!confirmado) return;

        try {
            await CitasService.eliminar(id);
            await recargarCitas();
            Notif.exito('¡Cita eliminada del sistema!');
        } catch (error) {
            Notif.error(mensajeErrorAmigable(error), 'No se pudo eliminar la cita');
        }
    };

    window.abrirModalTransferirCaso = async function (id) {
        const cita = estado.citas.find(c => Number(idCita(c)) === Number(id));
        if (!cita) return;

        const idEst = cita.estudiante?.idEstudiante ?? cita.estudiante?.id ?? cita.idEstudiante;
        const idPsiEmisor = cita.psicologo?.idPsicologo ?? cita.psicologo?.id ?? cita.idPsicologo;
        const nombreEst = nombreEstudiante(cita);
        const carnetEst = carnetEstudiante(cita);
        const psiActual = nombrePsicologo(cita);

        // Aseguramos tener los expedientes actualizados
        if (!estado.expedientes || estado.expedientes.length === 0) {
            try {
                if (typeof CasosTransferidosService !== 'undefined' && CasosTransferidosService.listarExpedientes) {
                    const exps = await CasosTransferidosService.listarExpedientes();
                    estado.expedientes = Array.isArray(exps) ? exps : [];
                }
            } catch (err) {
                console.warn('Error al obtener expedientes:', err);
            }
        }

        if (el('transferirCitaId')) el('transferirCitaId').value = id;
        if (el('transferirNombreEstudiante')) el('transferirNombreEstudiante').textContent = nombreEst;
        if (el('transferirCarnetEstudiante')) {
            el('transferirCarnetEstudiante').textContent = carnetEst ? `Carnet: ${carnetEst}` : 'Sin carnet';
        }
        if (el('transferirPsicologoActual')) el('transferirPsicologoActual').textContent = psiActual;

        const selDestino = el('selectPsicologoDestino');
        if (selDestino) {
            const destinos = estado.psicologos.filter(psi => Number(psi.idPsicologo ?? psi.id) !== Number(idPsiEmisor));
            renderOpcionesPsicologos(selDestino, destinos, 'Seleccionar psicólogo destino');
            selDestino.classList.remove('is-invalid');
            selectores.destino?.sincronizar();
        }

        const motivoInput = el('motivoTransferenciaCita');
        if (motivoInput) {
            motivoInput.value = '';
            motivoInput.classList.remove('is-invalid');
        }

        const modalEl = el('modalTransferir');
        if (modalEl) {
            const modal = new bootstrap.Modal(modalEl);
            modal.show();
        }
    };

    async function guardarTransferenciaCaso(e) {
        if (e) e.preventDefault();

        const citaId = el('transferirCitaId')?.value;
        const cita = estado.citas.find(c => Number(idCita(c)) === Number(citaId));
        if (!cita) {
            Notif.error('No se encontró la información de la cita para transferir.');
            return;
        }

        const idEstudiante = cita.estudiante?.idEstudiante ?? cita.estudiante?.id ?? cita.idEstudiante;
        const idPsicologoEmisor = cita.psicologo?.idPsicologo ?? cita.psicologo?.id ?? cita.idPsicologo;
        const idPsicologoDestino = el('selectPsicologoDestino')?.value;
        const motivo = el('motivoTransferenciaCita')?.value.trim();

        let valido = true;

        if (!idPsicologoDestino) {
            el('selectPsicologoDestino')?.classList.add('is-invalid');
            valido = false;
        } else {
            el('selectPsicologoDestino')?.classList.remove('is-invalid');
        }

        if (!motivo) {
            el('motivoTransferenciaCita')?.classList.add('is-invalid');
            valido = false;
        } else if (motivo.length > 500) {
            el('motivoTransferenciaCita')?.classList.add('is-invalid');
            Notif.error('El motivo de justificación no puede superar los 500 caracteres.');
            valido = false;
        } else {
            el('motivoTransferenciaCita')?.classList.remove('is-invalid');
        }

        if (!valido) return;

        // Validar que la cita tenga psicólogo asignado (psicologoOrigen es obligatorio en el DTO)
        if (!idPsicologoEmisor) {
            Notif.error('La cita no tiene un psicólogo asignado. No se puede transferir el caso.');
            return;
        }

        // Buscar el expediente asociado al estudiante
        let idExpediente = null;
        try {
            if (typeof CasosTransferidosService !== 'undefined' && CasosTransferidosService.listarExpedientes) {
                const exps = await CasosTransferidosService.listarExpedientes();
                estado.expedientes = Array.isArray(exps) ? exps : [];
            }
        } catch (err) {
            console.warn('Error al verificar expedientes:', err);
        }

        let expedienteEncontrado = estado.expedientes.find(exp => {
            const idEstExp = exp.estudiante?.idEstudiante ?? exp.estudiante?.id ?? exp.idEstudiante;
            return Number(idEstExp) === Number(idEstudiante);
        });

        if (expedienteEncontrado) {
            idExpediente = expedienteEncontrado.idExpediente ?? expedienteEncontrado.id;
        } else {
            // Si el estudiante no tiene expediente psicológico, se crea automáticamente para cumplir con la FK
            try {
                const nuevoExpediente = await CasosTransferidosService.crearExpediente({
                    estudiante: { idEstudiante: Number(idEstudiante) }
                });
                if (nuevoExpediente) {
                    idExpediente = nuevoExpediente.idExpediente ?? nuevoExpediente.id;
                    estado.expedientes.push(nuevoExpediente);
                }
            } catch (errExp) {
                console.error('No se pudo obtener o crear el expediente:', errExp);
                // No usar idEstudiante como fallback — son IDs diferentes en la base de datos
                Notif.error('El estudiante no tiene un expediente psicológico en el sistema y no se pudo crear uno automáticamente. Contacte al administrador.');
                return;
            }
        }

        if (!idExpediente) {
            Notif.error('El estudiante seleccionado no posee un expediente psicológico activo en el sistema.');
            return;
        }

        // DTO correspondiente a TranferenciaCasoDTO en Backend (/api/transferencias)
        const payload = {
            expediente: { idExpediente: Number(idExpediente) },
            psicologoOrigen: { idPsicologo: Number(idPsicologoEmisor) },
            motivoJustificacion: motivo,
            estadoAprobacion: 'PENDIENTE'
        };

        // psicologoDestino es opcional — solo se incluye si fue seleccionado
        if (idPsicologoDestino && Number(idPsicologoDestino) > 0) {
            payload.psicologoDestino = { idPsicologo: Number(idPsicologoDestino) };
        }

        const btnSubmit = el('btnConfirmarTransferencia');
        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Transferir Caso';
        }

        try {
            if (typeof CasosTransferidosService !== 'undefined' && CasosTransferidosService.crear) {
                await CasosTransferidosService.crear(payload);
            } else {
                await peticionApi('/transferencias', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
            }

            const modalInstance = bootstrap.Modal.getInstance(el('modalTransferir'));
            if (modalInstance) modalInstance.hide();

            Notif.exito('¡El caso ha sido transferido exitosamente a Casos Transferidos!');
        } catch (error) {
            console.error('Error al transferir caso:', error);
            Notif.error(mensajeErrorAmigable(error), 'No se pudo completar la transferencia del caso');
        } finally {
            if (btnSubmit) {
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = '<i class="bi bi-arrow-left-right"></i> Transferir Caso';
            }
        }
    }


    async function inicializar() {
        estado.usuarioSesion = await obtenerUsuarioSesion();
        cargarMarcaNuevas();
        await cargarSelectores();

        if (estado.usuarioSesion) {
            const u = estado.usuarioSesion;
            estado.psicologoLogueado = estado.psicologos.find(p => {
                const correoP = p.usuario?.correo ?? p.correo;
                const idU = p.usuario?.idUsuario;
                if (u.correo && correoP && correoP.toLowerCase() === u.correo.toLowerCase()) return true;
                if (u.idUsuario && idU && Number(idU) === Number(u.idUsuario)) return true;
                return false;
            });
        }
        renderOpcionesPsicologos(el('psicologoSelect'), estado.psicologos, 'Seleccionar psicólogo');
        sincronizarSelectores();

        await recargarCitas();
    }

    const selectores = {};

    function crearComponentes() {
        if (typeof SelectorBuscable === 'undefined' || typeof Calendario === 'undefined') return;
        selectores.estudiante = SelectorBuscable.crear(el('estudianteSelect'), {
            placeholder: 'Buscar y elegir estudiante',
            textoBusqueda: 'Nombre, apellido o carnet...',
            textoVacio: 'Ningún estudiante coincide'
        });
        selectores.psicologo = SelectorBuscable.crear(el('psicologoSelect'), {
            placeholder: 'Elegir psicólogo',
            textoBusqueda: 'Buscar psicólogo...'
        });
        selectores.destino = SelectorBuscable.crear(el('selectPsicologoDestino'), {
            placeholder: 'Elegir psicólogo de destino',
            textoBusqueda: 'Buscar psicólogo...'
        });
        selectores.hora = SelectorBuscable.crear(el('horaCita'), {
            placeholder: 'Seleccionar hora',
            textoVacio: 'Ya no quedan horas disponibles para este día',
            busqueda: false,
            avatar: false
        });
        selectores.fecha = Calendario.crear(el('fechaCita'), {
            modo: 'unico',
            placeholder: 'Elegir fecha de la cita',
            deshabilitar: esFinDeSemana
        });
        const contenedorFiltro = el('filtroFechasCitas');
        if (contenedorFiltro) {
            selectores.filtroFechas = Calendario.crear(contenedorFiltro, {
                modo: 'rango',
                placeholder: 'Filtrar por fecha',
                alCambiar(rango) {
                    estado.rangoFechas = rango;
                    estado.paginaActual = 1;
                    recargarCitas({ conResumen: false });
                }
            });
        }
    }

    function sincronizarSelectores() {
        Object.values(selectores).forEach(componente => componente?.sincronizar?.());
    }

    crearComponentes();

    el('btnFlotanteCita')?.addEventListener('click', window.abrirModalAgregarCita);


    el('fechaCita')?.addEventListener('change', () => {
        generarOpcionesHora30Min(el('horaCita')?.value);
        if (el('horaCita') && el('horaCita').selectedOptions[0]?.disabled) el('horaCita').value = '';
        actualizarAyudaFecha();
        actualizarOpcionesEstado();
    });

    el('horaCita')?.addEventListener('change', actualizarOpcionesEstado);

    el('formCrearCita')?.addEventListener('submit', (e) => {
        e.preventDefault();
        guardarFormulario();
    });

    el('formTransferirCaso')?.addEventListener('submit', (e) => {
        e.preventDefault();
        guardarTransferenciaCaso(e);
    });

    document.querySelectorAll('#formCrearCita input, #formCrearCita select, #formTransferirCaso input, #formTransferirCaso select, #formTransferirCaso textarea').forEach(campo => {
        campo.addEventListener('input', () => {
            if (campo.classList.contains('is-invalid')) {
                campo.classList.remove('is-invalid');
                const fb = campo.nextElementSibling;
                if (fb && fb.classList.contains('invalid-feedback')) fb.remove();
            }
        });
    });

    let temporizadorBusqueda = null;
    el('buscarEstudiante')?.addEventListener('input', (e) => {
        clearTimeout(temporizadorBusqueda);
        temporizadorBusqueda = setTimeout(() => {
            estado.paginaActual = 1;
            estado.textoBusqueda = e.target.value.trim();
            recargarCitas({ conResumen: false });
        }, 350);
    });


    el('filtroEstadoCita')?.addEventListener('change', (e) => {
        estado.paginaActual = 1;
        estado.filtroEstado = e.target.value;
        recargarCitas({ conResumen: false });
    });

    document.querySelectorAll('.citas-filter-nav .nav-link-custom').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.citas-filter-nav .nav-link-custom')
                .forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            estado.paginaActual = 1;
            estado.filtro = btn.dataset.filter;
            if (estado.rangoFechas && ['todas', 'proximas', 'historial'].includes(estado.filtro)) {
                estado.rangoFechas = null;
                selectores.filtroFechas?.limpiar();
            }
            recargarCitas({ conResumen: false });
        });
    });

    el('btnPrevCitas')?.addEventListener('click', () => {
        if (estado.paginaActual > 1) {
            estado.paginaActual--;
            recargarCitas({ conResumen: false });
        }
    });

    el('btnNextCitas')?.addEventListener('click', () => {
        if (estado.paginaActual < estado.totalPaginas) {
            estado.paginaActual++;
            recargarCitas({ conResumen: false });
        }
    });

    const hamburgerBtn = el('hamburgerBtn');
    const sidebar = document.querySelector('.sidebar');
    const overlay = el('sidebarOverlay');

    if (hamburgerBtn && sidebar && overlay) {
        hamburgerBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            overlay.classList.toggle('active');
            hamburgerBtn.innerHTML = sidebar.classList.contains('open') ? '<i class="bi bi-x"></i>' : '<i class="bi bi-list"></i>';
        });

        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
            hamburgerBtn.innerHTML = '<i class="bi bi-list"></i>';
        });
    }

    inicializar();
});