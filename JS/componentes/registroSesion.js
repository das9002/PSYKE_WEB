/* Registro de una sesión de consejería: con cita (desde Citas) o sin cita (atención directa desde Seguimiento).
   Las notas se guardan por secciones dentro de un solo texto, con el formato:
   [Título de la sección]
   contenido
   Así cualquier sesión vieja (texto libre) se sigue mostrando bien. */
(function (global) {
    'use strict';

    const TIPOS_ATENCION = [
        'Sesión de seguimiento',
        'Primera entrevista',
        'Atención sin cita',
        'Intervención en crisis',
        'Orientación académica',
        'Orientación familiar',
        'Cierre del caso'
    ];

    const SECCIONES_BASE = ['Motivo de la consulta', 'Observaciones', 'Acuerdos y tareas', 'Próximos pasos'];
    const SECCIONES_SUGERIDAS = ['Estado emocional', 'Contexto familiar', 'Desempeño académico', 'Relaciones con compañeros', 'Recomendaciones'];
    const AYUDAS = {
        'Motivo de la consulta': '¿Por qué vino el estudiante o por qué se le citó?',
        'Observaciones': 'Lo que notaste durante la sesión: actitud, ánimo, lo que contó...',
        'Acuerdos y tareas': 'Compromisos del estudiante y del psicólogo.',
        'Próximos pasos': 'Qué sigue: otra cita, hablar con encargados, derivar...'
    };
    const ESTADOS = [
        { valor: 'Estable', icono: 'bi-emoji-smile', clase: 'estable' },
        { valor: 'Seguimiento', icono: 'bi-eye', clase: 'seguimiento' },
        { valor: 'Prioritario', icono: 'bi-exclamation-diamond', clase: 'prioritario' }
    ];
    const PREFIJO_BORRADOR = 'psyke_borrador_sesion_';
    const MARCA_DURACION = 'Duración aproximada:';

    function escapar(texto) {
        const div = document.createElement('div');
        div.textContent = texto == null ? '' : String(texto);
        return div.innerHTML;
    }

    // ---------- Notas por secciones ----------

    function componerNotas(secciones, minutos) {
        const bloques = secciones
            .map((s) => ({ titulo: s.titulo.trim(), contenido: s.contenido.trim() }))
            .filter((s) => s.titulo && s.contenido)
            .map((s) => `[${s.titulo.replace(/[\[\]]/g, '')}]\n${s.contenido}`);
        if (minutos > 0) bloques.unshift(`${MARCA_DURACION} ${minutos} min`);
        return bloques.join('\n\n');
    }

    function leerNotas(texto) {
        const limpio = String(texto || '').replace(/\r\n/g, '\n').trim();
        const resultado = { duracion: null, secciones: [], libre: '' };
        if (!limpio) return resultado;

        const lineas = limpio.split('\n');
        if (lineas[0].startsWith(MARCA_DURACION)) {
            resultado.duracion = lineas.shift().slice(MARCA_DURACION.length).trim();
        }

        let actual = null;
        const libres = [];
        lineas.forEach((linea) => {
            const titulo = linea.match(/^\[(.{1,80})\]\s*$/);
            if (titulo) {
                actual = { titulo: titulo[1].trim(), contenido: '' };
                resultado.secciones.push(actual);
            } else if (actual) {
                actual.contenido += (actual.contenido ? '\n' : '') + linea;
            } else {
                libres.push(linea);
            }
        });
        resultado.secciones.forEach((s) => { s.contenido = s.contenido.trim(); });
        resultado.libre = libres.join('\n').trim();
        return resultado;
    }

    function resumenNotas(texto, maximo = 140) {
        const notas = leerNotas(texto);
        const partes = [];
        if (notas.libre) partes.push(notas.libre);
        notas.secciones.forEach((s) => partes.push(`${s.titulo}: ${s.contenido}`));
        const plano = partes.join(' · ').replace(/\s+/g, ' ').trim();
        return plano.length > maximo ? `${plano.slice(0, maximo - 1)}…` : plano;
    }

    function htmlNotas(texto) {
        const notas = leerNotas(texto);
        if (!notas.libre && !notas.secciones.length) {
            return '<p class="text-muted mb-0">Sin notas registradas.</p>';
        }
        let html = '';
        if (notas.duracion) html += `<span class="notas-duracion"><i class="bi bi-stopwatch"></i> ${escapar(notas.duracion)}</span>`;
        if (notas.libre) html += `<p class="notas-libre">${escapar(notas.libre)}</p>`;
        html += notas.secciones.map((s) => `
            <div class="notas-seccion">
                <h6>${escapar(s.titulo)}</h6>
                <p>${escapar(s.contenido)}</p>
            </div>`).join('');
        return html;
    }

    // ---------- Formulario ----------

    function leerBorrador(clave) {
        try {
            const crudo = global.localStorage.getItem(PREFIJO_BORRADOR + clave);
            return crudo ? JSON.parse(crudo) : null;
        } catch (e) {
            return null;
        }
    }

    function guardarBorrador(clave, datos) {
        try { global.localStorage.setItem(PREFIJO_BORRADOR + clave, JSON.stringify(datos)); } catch (e) { }
    }

    function borrarBorrador(clave) {
        try { global.localStorage.removeItem(PREFIJO_BORRADOR + clave); } catch (e) { }
    }

    function tarjetaSeccion(titulo, contenido, fija) {
        const ayuda = AYUDAS[titulo] || 'Escribe aquí...';
        return `
            <div class="rs-seccion" data-fija="${fija ? '1' : '0'}">
                <div class="rs-seccion-cabecera">
                    <input type="text" class="rs-seccion-titulo" value="${escapar(titulo)}" maxlength="60" aria-label="Título de la sección">
                    <button type="button" class="rs-quitar" data-accion="quitar" title="Quitar sección" aria-label="Quitar sección"><i class="bi bi-trash3"></i></button>
                </div>
                <textarea class="rs-seccion-texto" rows="3" placeholder="${escapar(ayuda)}">${escapar(contenido || '')}</textarea>
            </div>`;
    }

    function formatearCronometro(segundos) {
        const h = Math.floor(segundos / 3600);
        const m = Math.floor((segundos % 3600) / 60);
        const s = segundos % 60;
        const dos = (n) => String(n).padStart(2, '0');
        return h ? `${h}:${dos(m)}:${dos(s)}` : `${dos(m)}:${dos(s)}`;
    }

    function hoyLocal() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    /**
     * Abre el registro de sesión.
     * @param {object} opciones
     *   modo: 'vivo' (sesión que está ocurriendo, con cronómetro) | 'manual' (registrar o editar una sesión pasada)
     *   estudiante: { nombre, carnet, iniciales }
     *   cita: { numero, fechaTexto } en modo vivo con cita
     *   psicologo: { id, nombre } fijo: el de la cuenta que registra
     *   psicologos: [{ id, nombre }] solo si quien registra es administrador y debe elegir
     *   citasDisponibles: [{ id, fecha, texto }] para vincular en modo manual
     *   inicial: { fecha, idCita, tipo, estado, critico, notas, idPsicologo } valores al editar
     *   titulo: texto de la etiqueta superior
     *   claveBorrador: texto para recordar lo escrito si se cierra sin guardar
     *   guardar: async ({ tipoProceso, estadoEstudiante, marcadorCritico, notasAnotaciones, fechaAtencion, idCita, idPsicologo }) => void
     */
    function abrir(opciones) {
        const {
            modo = 'vivo', estudiante = {}, cita = null, guardar, claveBorrador,
            psicologo = null, psicologos = null, citasDisponibles = [], inicial = {}
        } = opciones;
        const manual = modo === 'manual';
        const editando = Boolean(inicial && inicial.notas !== undefined);
        const borrador = claveBorrador && !editando ? leerBorrador(claveBorrador) : null;
        const inicio = borrador && borrador.inicio ? borrador.inicio : Date.now();

        const notasIniciales = editando ? leerNotas(inicial.notas) : null;
        const tipoInicial = (borrador && borrador.tipo) || inicial.tipo || opciones.tipoInicial
            || (manual ? 'Sesión de seguimiento' : (cita ? 'Sesión de seguimiento' : 'Atención sin cita'));
        const estadoInicial = (borrador && borrador.estado) || inicial.estado || opciones.estadoInicial || 'Seguimiento';
        const criticoInicial = Boolean((borrador && borrador.critico) || inicial.critico);
        const fechaInicial = (borrador && borrador.fecha) || inicial.fecha || hoyLocal();
        const citaInicial = (borrador && borrador.idCita) || inicial.idCita || '';

        let secciones;
        if (borrador && Array.isArray(borrador.secciones) && borrador.secciones.length) {
            secciones = borrador.secciones;
        } else if (notasIniciales) {
            secciones = notasIniciales.secciones.map((s) => ({ titulo: s.titulo, contenido: s.contenido }));
            if (notasIniciales.libre) secciones.unshift({ titulo: 'Observaciones', contenido: notasIniciales.libre });
            if (!secciones.length) secciones = [{ titulo: 'Observaciones', contenido: '' }];
        } else {
            secciones = SECCIONES_BASE.map((titulo) => ({ titulo, contenido: '' }));
        }
        const duracionPrevia = notasIniciales && notasIniciales.duracion;

        const etiqueta = opciones.titulo
            || (manual ? (editando ? 'Editar registro de sesión' : 'Registro de una sesión pasada')
                : (cita ? `Cita #${cita.numero}${cita.fechaTexto ? ` · ${cita.fechaTexto}` : ''}` : 'Atención sin cita previa'));

        const opcionesCita = citasDisponibles.map((c) => `<option value="${escapar(c.id)}" data-fecha="${escapar(c.fecha)}" ${String(c.id) === String(citaInicial) ? 'selected' : ''}>${escapar(c.texto)}</option>`).join('');
        const campoPsicologo = psicologos && psicologos.length
            ? `<select class="form-select" id="rsPsicologo">${psicologos.map((p) => `<option value="${escapar(p.id)}" ${String(p.id) === String(inicial.idPsicologo || (psicologo && psicologo.id)) ? 'selected' : ''}>${escapar(p.nombre)}</option>`).join('')}</select>`
            : `<div class="rs-fijo"><i class="bi bi-person-badge"></i> ${escapar(psicologo ? psicologo.nombre : 'Tu cuenta')}</div>`;

        const modalEl = document.createElement('div');
        modalEl.className = 'modal fade registro-sesion-modal';
        modalEl.tabIndex = -1;
        modalEl.setAttribute('aria-hidden', 'true');
        modalEl.innerHTML = `
            <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header rs-cabecera">
                        <div class="d-flex align-items-center gap-3">
                            <div class="student-avatar-badge rs-avatar">${escapar(estudiante.iniciales || '')}</div>
                            <div>
                                <span class="rs-etiqueta">${escapar(etiqueta)}</span>
                                <h4 class="modal-title fw-bold mb-0">${escapar(estudiante.nombre || 'Estudiante')}</h4>
                                ${estudiante.carnet ? `<small class="text-muted">Carnet ${escapar(estudiante.carnet)}</small>` : ''}
                            </div>
                        </div>
                        <div class="d-flex align-items-center gap-3">
                            ${manual
                                ? `<span class="rs-cronometro manual"><i class="bi bi-journal-text"></i> ${editando ? 'Editando' : 'Registro manual'}</span>`
                                : '<span class="rs-cronometro" title="Tiempo desde que se abrió la sesión"><span class="rs-punto"></span> En curso · <strong id="rsCronometro">00:00</strong></span>'}
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
                        </div>
                    </div>
                    <div class="modal-body">
                        ${borrador ? '<div class="rs-aviso-borrador"><i class="bi bi-arrow-counterclockwise"></i> Recuperamos lo que habías escrito antes de cerrar.</div>' : ''}
                        ${manual ? `
                        <div class="row g-3 mb-3">
                            <div class="col-md-3">
                                <label class="form-label fw-semibold small" for="rsFecha">Fecha de atención</label>
                                <input type="date" class="form-control" id="rsFecha" value="${escapar(fechaInicial)}" max="${hoyLocal()}">
                            </div>
                            <div class="col-md-5">
                                <label class="form-label fw-semibold small" for="rsCita">Cita vinculada</label>
                                <select class="form-select" id="rsCita">
                                    <option value="">Sin cita (atención directa)</option>
                                    ${opcionesCita}
                                </select>
                                <small class="text-muted" id="rsCitaAyuda"></small>
                            </div>
                            <div class="col-md-4">
                                <label class="form-label fw-semibold small">Psicólogo</label>
                                ${campoPsicologo}
                            </div>
                        </div>` : ''}
                        <div class="row g-3 mb-3">
                            <div class="col-md-5">
                                <label class="form-label fw-semibold small" for="rsTipo">Tipo de atención</label>
                                <select class="form-select" id="rsTipo">
                                    ${TIPOS_ATENCION.map((t) => `<option ${t === tipoInicial ? 'selected' : ''}>${escapar(t)}</option>`).join('')}
                                    ${TIPOS_ATENCION.includes(tipoInicial) ? '' : `<option selected>${escapar(tipoInicial)}</option>`}
                                </select>
                            </div>
                            <div class="col-md-5">
                                <label class="form-label fw-semibold small">Cómo está el estudiante</label>
                                <div class="rs-estados" role="radiogroup">
                                    ${ESTADOS.map((e) => `
                                        <button type="button" class="rs-estado ${e.clase} ${e.valor === estadoInicial ? 'activo' : ''}" data-estado="${e.valor}" role="radio" aria-checked="${e.valor === estadoInicial}">
                                            <i class="bi ${e.icono}"></i> ${e.valor}
                                        </button>`).join('')}
                                </div>
                            </div>
                            <div class="col-md-2">
                                <label class="form-label fw-semibold small" for="rsCritico">Caso crítico</label>
                                <div class="form-check form-switch rs-switch">
                                    <input class="form-check-input" type="checkbox" id="rsCritico" ${criticoInicial ? 'checked' : ''}>
                                    <label class="form-check-label small" for="rsCritico">Requiere atención urgente</label>
                                </div>
                            </div>
                        </div>

                        <div class="d-flex align-items-center justify-content-between mb-2 flex-wrap gap-2">
                            <h6 class="fw-bold mb-0"><i class="bi bi-journal-text me-1 text-primary"></i> Notas de la sesión</h6>
                            <small class="text-muted">Llena solo las secciones que necesites. Las vacías no se guardan.</small>
                        </div>
                        <div class="rs-secciones" id="rsSecciones">
                            ${secciones.map((s) => tarjetaSeccion(s.titulo, s.contenido, SECCIONES_BASE.includes(s.titulo))).join('')}
                        </div>
                        <div class="rs-agregar">
                            <span class="small text-muted me-1">Agregar sección:</span>
                            ${SECCIONES_SUGERIDAS.map((s) => `<button type="button" class="rs-sugerencia" data-sugerencia="${escapar(s)}"><i class="bi bi-plus"></i> ${escapar(s)}</button>`).join('')}
                            <button type="button" class="rs-sugerencia personalizada" data-sugerencia=""><i class="bi bi-pencil"></i> Personalizada</button>
                        </div>
                        ${manual ? `
                        <div class="rs-duracion mt-3">
                            <label class="form-label fw-semibold small mb-0" for="rsDuracion"><i class="bi bi-stopwatch me-1"></i> Duración aproximada</label>
                            <div class="input-group input-group-sm">
                                <input type="number" class="form-control" id="rsDuracion" min="0" max="240" step="5" value="${escapar(String(duracionPrevia || '').replace(/\D/g, '') || '')}" placeholder="30">
                                <span class="input-group-text">min</span>
                            </div>
                        </div>` : ''}
                        <p class="rs-error" id="rsError" hidden></p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-light" data-bs-dismiss="modal">Cerrar</button>
                        <button type="button" class="btn btn-primary-custom d-flex align-items-center gap-2" id="rsGuardar">
                            <i class="bi bi-floppy-fill"></i> ${editando ? 'Guardar cambios' : 'Guardar sesión'}
                        </button>
                    </div>
                </div>
            </div>`;

        document.body.appendChild(modalEl);
        const modal = new global.bootstrap.Modal(modalEl, { backdrop: 'static' });
        const contenedor = modalEl.querySelector('#rsSecciones');
        const cronometro = modalEl.querySelector('#rsCronometro');
        const error = modalEl.querySelector('#rsError');
        const botonGuardar = modalEl.querySelector('#rsGuardar');
        const campoFecha = modalEl.querySelector('#rsFecha');
        const campoCita = modalEl.querySelector('#rsCita');
        const ayudaCita = modalEl.querySelector('#rsCitaAyuda');
        let guardado = false;
        let temporizador = null;

        if (cronometro) {
            const actualizarCronometro = () => {
                cronometro.textContent = formatearCronometro(Math.max(0, Math.floor((Date.now() - inicio) / 1000)));
            };
            actualizarCronometro();
            temporizador = setInterval(actualizarCronometro, 1000);
        }

        // Al cambiar la fecha se propone la cita de ese día (si la hay)
        function proponerCitaDelDia() {
            if (!campoCita || !campoFecha) return;
            const delDia = citasDisponibles.find((c) => c.fecha === campoFecha.value);
            if (delDia && !campoCita.dataset.manual) campoCita.value = String(delDia.id);
            if (!delDia && !campoCita.dataset.manual) campoCita.value = '';
            if (ayudaCita) ayudaCita.textContent = delDia ? '' : 'No hay cita para esa fecha.';
        }
        if (campoFecha) {
            campoFecha.addEventListener('change', proponerCitaDelDia);
            if (!citaInicial) proponerCitaDelDia();
        }
        if (campoCita) {
            campoCita.addEventListener('change', () => {
                campoCita.dataset.manual = '1';
                const elegida = campoCita.selectedOptions[0];
                if (elegida && elegida.dataset.fecha && campoFecha) campoFecha.value = elegida.dataset.fecha;
                if (ayudaCita) ayudaCita.textContent = '';
            });
        }

        function estadoElegido() {
            const activo = modalEl.querySelector('.rs-estado.activo');
            return activo ? activo.dataset.estado : 'Seguimiento';
        }

        function leerSecciones() {
            return Array.from(contenedor.querySelectorAll('.rs-seccion')).map((tarjeta) => ({
                titulo: tarjeta.querySelector('.rs-seccion-titulo').value,
                contenido: tarjeta.querySelector('.rs-seccion-texto').value
            }));
        }

        function recordar() {
            if (!claveBorrador || guardado || editando) return;
            const datos = leerSecciones();
            if (!datos.some((s) => s.contenido.trim())) return borrarBorrador(claveBorrador);
            guardarBorrador(claveBorrador, {
                inicio,
                tipo: modalEl.querySelector('#rsTipo').value,
                estado: estadoElegido(),
                critico: modalEl.querySelector('#rsCritico').checked,
                fecha: campoFecha ? campoFecha.value : undefined,
                idCita: campoCita ? campoCita.value : undefined,
                secciones: datos
            });
        }

        modalEl.addEventListener('input', recordar);
        modalEl.addEventListener('click', (evento) => {
            const estadoBtn = evento.target.closest('.rs-estado');
            if (estadoBtn) {
                modalEl.querySelectorAll('.rs-estado').forEach((b) => {
                    const activo = b === estadoBtn;
                    b.classList.toggle('activo', activo);
                    b.setAttribute('aria-checked', String(activo));
                });
                recordar();
                return;
            }
            const quitar = evento.target.closest('[data-accion="quitar"]');
            if (quitar) {
                const tarjeta = quitar.closest('.rs-seccion');
                if (contenedor.querySelectorAll('.rs-seccion').length <= 1) {
                    tarjeta.querySelector('.rs-seccion-texto').value = '';
                } else {
                    tarjeta.remove();
                }
                recordar();
                return;
            }
            const sugerencia = evento.target.closest('[data-sugerencia]');
            if (sugerencia) {
                const titulo = sugerencia.dataset.sugerencia;
                contenedor.insertAdjacentHTML('beforeend', tarjetaSeccion(titulo || 'Nueva sección', '', false));
                const nueva = contenedor.lastElementChild;
                const foco = titulo ? nueva.querySelector('.rs-seccion-texto') : nueva.querySelector('.rs-seccion-titulo');
                foco.focus();
                if (!titulo) foco.select();
            }
        });

        function mostrarError(texto, campo) {
            error.textContent = texto;
            error.hidden = false;
            if (campo) campo.focus();
        }

        botonGuardar.addEventListener('click', async () => {
            error.hidden = true;
            const seccionesActuales = leerSecciones();
            if (!seccionesActuales.some((s) => s.contenido.trim())) {
                return mostrarError('Escribe al menos una sección de notas antes de guardar la sesión.', contenedor.querySelector('.rs-seccion-texto'));
            }
            let minutos;
            if (manual) {
                if (!campoFecha.value) return mostrarError('Elige la fecha en que se atendió al estudiante.', campoFecha);
                if (campoFecha.value > hoyLocal()) return mostrarError('La fecha de atención no puede ser futura.', campoFecha);
                minutos = Number(modalEl.querySelector('#rsDuracion').value) || 0;
            } else {
                minutos = Math.max(1, Math.round((Date.now() - inicio) / 60000));
            }
            const selectorPsicologo = modalEl.querySelector('#rsPsicologo');
            const idPsicologo = selectorPsicologo ? selectorPsicologo.value : (psicologo && psicologo.id);
            if (manual && !idPsicologo) return mostrarError('No se encontró el psicólogo de tu cuenta para registrar la sesión.');

            botonGuardar.disabled = true;
            botonGuardar.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Guardando...';
            try {
                await guardar({
                    tipoProceso: modalEl.querySelector('#rsTipo').value,
                    estadoEstudiante: estadoElegido(),
                    marcadorCritico: modalEl.querySelector('#rsCritico').checked ? 'SI' : 'NO',
                    notasAnotaciones: componerNotas(seccionesActuales, minutos),
                    fechaAtencion: campoFecha ? campoFecha.value : hoyLocal(),
                    idCita: campoCita && campoCita.value ? Number(campoCita.value) : null,
                    idPsicologo: idPsicologo ? Number(idPsicologo) : null
                });
                guardado = true;
                if (claveBorrador) borrarBorrador(claveBorrador);
                modal.hide();
            } catch (e) {
                mostrarError((e && e.message) || 'No se pudo guardar la sesión.');
                botonGuardar.disabled = false;
                botonGuardar.innerHTML = `<i class="bi bi-floppy-fill"></i> ${editando ? 'Guardar cambios' : 'Guardar sesión'}`;
            }
        });

        modalEl.addEventListener('hidden.bs.modal', () => {
            if (temporizador) clearInterval(temporizador);
            recordar();
            modal.dispose();
            modalEl.remove();
        });
        modalEl.addEventListener('shown.bs.modal', () => {
            const primero = contenedor.querySelector('.rs-seccion-texto');
            if (primero && !manual) primero.focus();
        });

        modal.show();
    }

    global.RegistroSesion = { abrir, leerNotas, resumenNotas, htmlNotas, componerNotas };
})(window);
