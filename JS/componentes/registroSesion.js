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

    /**
     * Abre el registro de sesión.
     * @param {object} opciones
     *   estudiante: { nombre, carnet, iniciales }
     *   cita: { numero, fechaTexto } (opcional; sin cita = atención directa)
     *   tipoInicial, estadoInicial
     *   claveBorrador: texto para recordar lo escrito si se cierra sin guardar
     *   guardar: async ({ tipoProceso, estadoEstudiante, marcadorCritico, notasAnotaciones }) => void
     */
    function abrir(opciones) {
        const { estudiante = {}, cita = null, guardar, claveBorrador } = opciones;
        const borrador = claveBorrador ? leerBorrador(claveBorrador) : null;
        const inicio = borrador && borrador.inicio ? borrador.inicio : Date.now();
        const tipoInicial = (borrador && borrador.tipo) || opciones.tipoInicial || (cita ? 'Sesión de seguimiento' : 'Atención sin cita');
        const estadoInicial = (borrador && borrador.estado) || opciones.estadoInicial || 'Seguimiento';
        const criticoInicial = Boolean(borrador && borrador.critico);
        const secciones = (borrador && Array.isArray(borrador.secciones) && borrador.secciones.length)
            ? borrador.secciones
            : SECCIONES_BASE.map((titulo) => ({ titulo, contenido: '' }));

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
                                <span class="rs-etiqueta">${cita ? `Cita #${escapar(cita.numero)}${cita.fechaTexto ? ` · ${escapar(cita.fechaTexto)}` : ''}` : 'Atención sin cita previa'}</span>
                                <h4 class="modal-title fw-bold mb-0">${escapar(estudiante.nombre || 'Estudiante')}</h4>
                                ${estudiante.carnet ? `<small class="text-muted">Carnet ${escapar(estudiante.carnet)}</small>` : ''}
                            </div>
                        </div>
                        <div class="d-flex align-items-center gap-3">
                            <span class="rs-cronometro" title="Tiempo desde que se abrió la sesión"><span class="rs-punto"></span> En curso · <strong id="rsCronometro">00:00</strong></span>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
                        </div>
                    </div>
                    <div class="modal-body">
                        ${borrador ? '<div class="rs-aviso-borrador"><i class="bi bi-arrow-counterclockwise"></i> Recuperamos lo que habías escrito antes de cerrar.</div>' : ''}
                        <div class="row g-3 mb-3">
                            <div class="col-md-5">
                                <label class="form-label fw-semibold small">Tipo de atención</label>
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
                                <label class="form-label fw-semibold small">Caso crítico</label>
                                <div class="form-check form-switch rs-switch">
                                    <input class="form-check-input" type="checkbox" id="rsCritico" ${criticoInicial ? 'checked' : ''}>
                                    <label class="form-check-label small" for="rsCritico">Requiere atención urgente</label>
                                </div>
                            </div>
                        </div>

                        <div class="d-flex align-items-center justify-content-between mb-2">
                            <h6 class="fw-bold mb-0"><i class="bi bi-journal-text me-1 text-primary"></i> Notas de la sesión</h6>
                            <small class="text-muted">Llena solo las secciones que necesites. Las vacías no se guardan.</small>
                        </div>
                        <div class="rs-secciones" id="rsSecciones">
                            ${secciones.map((s, i) => tarjetaSeccion(s.titulo, s.contenido, i < SECCIONES_BASE.length)).join('')}
                        </div>
                        <div class="rs-agregar">
                            <span class="small text-muted me-1">Agregar sección:</span>
                            ${SECCIONES_SUGERIDAS.map((s) => `<button type="button" class="rs-sugerencia" data-sugerencia="${escapar(s)}"><i class="bi bi-plus"></i> ${escapar(s)}</button>`).join('')}
                            <button type="button" class="rs-sugerencia personalizada" data-sugerencia=""><i class="bi bi-pencil"></i> Personalizada</button>
                        </div>
                        <p class="rs-error" id="rsError" hidden></p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-light" data-bs-dismiss="modal">Cerrar</button>
                        <button type="button" class="btn btn-primary-custom d-flex align-items-center gap-2" id="rsGuardar">
                            <i class="bi bi-floppy-fill"></i> Guardar sesión
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
        let guardado = false;

        const actualizarCronometro = () => {
            cronometro.textContent = formatearCronometro(Math.max(0, Math.floor((Date.now() - inicio) / 1000)));
        };
        actualizarCronometro();
        const temporizador = setInterval(actualizarCronometro, 1000);

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
            if (!claveBorrador || guardado) return;
            const datos = leerSecciones();
            const hayTexto = datos.some((s) => s.contenido.trim());
            if (!hayTexto) return borrarBorrador(claveBorrador);
            guardarBorrador(claveBorrador, {
                inicio,
                tipo: modalEl.querySelector('#rsTipo').value,
                estado: estadoElegido(),
                critico: modalEl.querySelector('#rsCritico').checked,
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
                if (estadoBtn.dataset.estado === 'Prioritario') modalEl.querySelector('#rsCritico').focus();
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

        botonGuardar.addEventListener('click', async () => {
            error.hidden = true;
            const minutos = Math.max(1, Math.round((Date.now() - inicio) / 60000));
            const notas = componerNotas(leerSecciones(), minutos);
            if (!leerSecciones().some((s) => s.contenido.trim())) {
                error.textContent = 'Escribe al menos una sección de notas antes de guardar la sesión.';
                error.hidden = false;
                contenedor.querySelector('.rs-seccion-texto').focus();
                return;
            }
            const tipo = modalEl.querySelector('#rsTipo').value;
            botonGuardar.disabled = true;
            botonGuardar.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Guardando...';
            try {
                await guardar({
                    tipoProceso: tipo,
                    estadoEstudiante: estadoElegido(),
                    marcadorCritico: modalEl.querySelector('#rsCritico').checked ? 'SI' : 'NO',
                    notasAnotaciones: notas
                });
                guardado = true;
                if (claveBorrador) borrarBorrador(claveBorrador);
                modal.hide();
            } catch (e) {
                error.textContent = (e && e.message) || 'No se pudo guardar la sesión.';
                error.hidden = false;
                botonGuardar.disabled = false;
                botonGuardar.innerHTML = '<i class="bi bi-floppy-fill"></i> Guardar sesión';
            }
        });

        modalEl.addEventListener('hidden.bs.modal', () => {
            clearInterval(temporizador);
            recordar();
            modal.dispose();
            modalEl.remove();
        });
        modalEl.addEventListener('shown.bs.modal', () => {
            const primero = contenedor.querySelector('.rs-seccion-texto');
            if (primero) primero.focus();
        });

        modal.show();
    }

    global.RegistroSesion = { abrir, leerNotas, resumenNotas, htmlNotas, componerNotas };
})(window);
