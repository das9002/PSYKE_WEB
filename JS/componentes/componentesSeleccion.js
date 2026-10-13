(function (global) {
    'use strict';

    const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
    const COLORES = ['#2563EB', '#059669', '#7C3AED', '#DB2777', '#D97706', '#0891B2'];

    function escapar(texto) {
        return String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function normalizar(texto) {
        return String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    }

    function iniciales(texto) {
        const partes = String(texto || '').trim().split(/\s+/).filter(Boolean);
        if (partes.length === 0) return '?';
        if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
        return (partes[0][0] + partes[partes.length > 2 ? 2 : 1][0]).toUpperCase();
    }

    function colorDe(valor) {
        let suma = 0;
        String(valor).split('').forEach((c) => { suma += c.charCodeAt(0); });
        return COLORES[suma % COLORES.length];
    }

    function aISO(fecha) {
        return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
    }

    function deISO(iso) {
        const [a, m, d] = String(iso || '').split('-').map(Number);
        return a && m && d ? new Date(a, m - 1, d) : null;
    }

    function sumarDias(fecha, dias) {
        const copia = new Date(fecha);
        copia.setDate(copia.getDate() + dias);
        return copia;
    }

    function hoy() {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }

    function textoFecha(iso, conAnio = true) {
        const f = deISO(iso);
        if (!f) return '';
        return `${f.getDate()} ${MESES_CORTOS[f.getMonth()]}${conAnio ? ` ${f.getFullYear()}` : ''}`;
    }

    const MARGEN = 8;

    function posicionarPanel(ancla, panel, opciones = {}) {
        const rect = ancla.getBoundingClientRect();
        const anchoVentana = document.documentElement.clientWidth;
        const altoVentana = window.innerHeight;

        panel.style.position = 'fixed';
        panel.style.right = 'auto';
        panel.style.maxWidth = `${anchoVentana - MARGEN * 2}px`;
        if (opciones.mismoAncho) panel.style.width = `${rect.width}px`;

        const lista = opciones.lista;
        if (lista) lista.style.maxHeight = '';

        const espacioAbajo = altoVentana - rect.bottom - MARGEN;
        const espacioArriba = rect.top - MARGEN;
        let alto = panel.offsetHeight;
        const haciaArriba = alto > espacioAbajo && espacioArriba > espacioAbajo;
        const disponible = Math.max(160, (haciaArriba ? espacioArriba : espacioAbajo) - 6);

        if (lista && alto > disponible) {
            const resto = alto - lista.offsetHeight;
            lista.style.maxHeight = `${Math.max(120, disponible - resto)}px`;
            alto = panel.offsetHeight;
        }

        const top = haciaArriba ? Math.max(MARGEN, rect.top - 6 - alto) : rect.bottom + 6;
        const ancho = panel.offsetWidth;
        const left = Math.min(Math.max(MARGEN, rect.left), Math.max(MARGEN, anchoVentana - MARGEN - ancho));

        panel.style.top = `${top}px`;
        panel.style.left = `${left}px`;
        panel.classList.toggle('panel-arriba', haciaArriba);
    }

    function seguirPosicion(estaAbierto, reposicionar) {
        const alMover = () => { if (estaAbierto()) reposicionar(); };
        window.addEventListener('resize', alMover);
        window.addEventListener('scroll', alMover, true);
    }

    function cerrarAlHacerClicFuera(raiz, cerrar) {
        document.addEventListener('mousedown', (evento) => {
            if (!raiz.contains(evento.target)) cerrar();
        });
    }

    /* ---------------------------------------------------------------
     * Selector buscable: reemplaza visualmente un <select> manteniendo
     * su valor, así la lógica del formulario sigue usando select.value.
     * Lee <optgroup label> y data-subtitulo de cada <option>.
     * --------------------------------------------------------------- */
    function crearSelectorBuscable(select, opciones = {}) {
        if (!select || select.dataset.selectorBuscable) return null;
        select.dataset.selectorBuscable = '1';

        const config = {
            placeholder: opciones.placeholder || 'Seleccionar',
            textoBusqueda: opciones.textoBusqueda || 'Buscar...',
            textoVacio: opciones.textoVacio || 'No hay resultados',
            avatar: opciones.avatar !== false,
            busqueda: opciones.busqueda !== false
        };

        const raiz = document.createElement('div');
        raiz.className = 'sb-selector';
        raiz.innerHTML = `
            <button type="button" class="sb-disparador" aria-haspopup="listbox" aria-expanded="false">
                <span class="sb-valor"></span>
                <i class="bi bi-chevron-down sb-flecha" aria-hidden="true"></i>
            </button>
            <div class="sb-panel" hidden tabindex="-1">
                <div class="sb-busqueda"${config.busqueda ? '' : ' hidden'}>
                    <i class="bi bi-search" aria-hidden="true"></i>
                    <input type="text" autocomplete="off" placeholder="${escapar(config.textoBusqueda)}">
                </div>
                <div class="sb-lista" role="listbox"></div>
            </div>`;
        select.parentNode.insertBefore(raiz, select);
        select.classList.add('sb-select-original');
        select.tabIndex = -1;
        select.setAttribute('aria-hidden', 'true');

        const disparador = raiz.querySelector('.sb-disparador');
        const valorEl = raiz.querySelector('.sb-valor');
        const panel = raiz.querySelector('.sb-panel');
        const buscador = raiz.querySelector('.sb-busqueda input');
        const lista = raiz.querySelector('.sb-lista');
        let resaltado = -1;
        let visibles = [];

        function leerOpciones() {
            const resultado = [];
            Array.from(select.children).forEach((nodo) => {
                if (nodo.tagName === 'OPTGROUP') {
                    Array.from(nodo.children).forEach((opt) => agregar(opt, nodo.label));
                } else {
                    agregar(nodo, '');
                }
            });
            function agregar(opt, grupo) {
                if (!opt.value || opt.disabled) return;
                resultado.push({
                    valor: opt.value,
                    texto: opt.dataset.texto || opt.textContent.trim(),
                    subtitulo: opt.dataset.subtitulo || '',
                    insignia: opt.dataset.insignia || '',
                    grupo
                });
            }
            return resultado;
        }

        function htmlAvatar(opcion) {
            if (!config.avatar) return '';
            return `<span class="sb-avatar" style="background:${colorDe(opcion.valor)}">${escapar(iniciales(opcion.texto))}</span>`;
        }

        function pintarValor() {
            const actual = leerOpciones().find((o) => o.valor === select.value);
            raiz.classList.toggle('sb-deshabilitado', select.disabled);
            disparador.disabled = select.disabled;
            raiz.classList.toggle('sb-invalido', select.classList.contains('is-invalid'));
            if (!actual) {
                valorEl.innerHTML = `<span class="sb-placeholder">${escapar(config.placeholder)}</span>`;
                return;
            }
            valorEl.innerHTML = `
                ${htmlAvatar(actual)}
                <span class="sb-textos">
                    <span class="sb-texto">${escapar(actual.texto)}</span>
                    ${actual.subtitulo ? `<span class="sb-subtitulo">${escapar(actual.subtitulo)}</span>` : ''}
                </span>`;
        }

        function pintarLista() {
            const termino = normalizar(buscador.value);
            visibles = leerOpciones().filter((o) => !termino || normalizar(`${o.texto} ${o.subtitulo}`).includes(termino));
            if (visibles.length === 0) {
                lista.innerHTML = `<div class="sb-vacio">${escapar(config.textoVacio)}</div>`;
                return;
            }
            if (resaltado >= visibles.length) resaltado = visibles.length - 1;

            let grupoActual = null;
            lista.innerHTML = visibles.map((o, indice) => {
                let cabecera = '';
                if (o.grupo !== grupoActual) {
                    grupoActual = o.grupo;
                    if (o.grupo) cabecera = `<div class="sb-grupo">${escapar(o.grupo)}</div>`;
                }
                const clases = ['sb-opcion'];
                if (o.valor === select.value) clases.push('sb-seleccionada');
                if (indice === resaltado) clases.push('sb-resaltada');
                return `${cabecera}
                    <div class="${clases.join(' ')}" role="option" data-indice="${indice}" aria-selected="${o.valor === select.value}">
                        ${htmlAvatar(o)}
                        <span class="sb-textos">
                            <span class="sb-texto">${escapar(o.texto)}</span>
                            ${o.subtitulo ? `<span class="sb-subtitulo">${escapar(o.subtitulo)}</span>` : ''}
                        </span>
                        ${o.insignia ? `<span class="sb-insignia">${escapar(o.insignia)}</span>` : ''}
                        ${o.valor === select.value ? '<i class="bi bi-check2 sb-check" aria-hidden="true"></i>' : ''}
                    </div>`;
            }).join('');

            const activa = lista.querySelector('.sb-resaltada');
            if (activa) activa.scrollIntoView({ block: 'nearest' });
        }

        function abrir() {
            if (select.disabled) return;
            panel.hidden = false;
            raiz.classList.add('sb-abierto');
            disparador.setAttribute('aria-expanded', 'true');
            buscador.value = '';
            resaltado = config.busqueda ? -1 : leerOpciones().findIndex((o) => o.valor === select.value);
            pintarLista();
            reposicionar();
            setTimeout(() => (config.busqueda ? buscador : panel).focus(), 0);
        }

        function reposicionar() {
            posicionarPanel(disparador, panel, { mismoAncho: true, lista });
        }

        function cerrar() {
            if (panel.hidden) return;
            panel.hidden = true;
            raiz.classList.remove('sb-abierto');
            disparador.setAttribute('aria-expanded', 'false');
        }

        function elegir(opcion) {
            select.value = opcion.valor;
            select.dispatchEvent(new Event('input', { bubbles: true }));
            select.dispatchEvent(new Event('change', { bubbles: true }));
            pintarValor();
            cerrar();
            disparador.focus();
        }

        disparador.addEventListener('click', () => (panel.hidden ? abrir() : cerrar()));
        seguirPosicion(() => !panel.hidden, reposicionar);
        buscador.addEventListener('input', () => { resaltado = 0; pintarLista(); });
        panel.addEventListener('keydown', (evento) => {
            if (evento.key === 'ArrowDown') {
                evento.preventDefault();
                resaltado = Math.min(visibles.length - 1, resaltado + 1);
                pintarLista();
            } else if (evento.key === 'ArrowUp') {
                evento.preventDefault();
                resaltado = Math.max(0, resaltado - 1);
                pintarLista();
            } else if (evento.key === 'Enter') {
                evento.preventDefault();
                if (visibles[resaltado]) elegir(visibles[resaltado]);
            } else if (evento.key === 'Escape') {
                evento.preventDefault();
                cerrar();
                disparador.focus();
            }
        });
        lista.addEventListener('mousedown', (evento) => {
            const fila = evento.target.closest('.sb-opcion');
            if (!fila) return;
            evento.preventDefault();
            elegir(visibles[Number(fila.dataset.indice)]);
        });
        cerrarAlHacerClicFuera(raiz, cerrar);

        new MutationObserver(pintarValor).observe(select, { attributes: true, attributeFilter: ['class', 'disabled'], childList: true, subtree: true });
        select.addEventListener('change', pintarValor);
        pintarValor();

        return { sincronizar: pintarValor, abrir, cerrar };
    }

    /* ---------------------------------------------------------------
     * Calendario: modo "unico" (reemplaza un <input type="date">) o
     * modo "rango" con accesos rápidos (Hoy, Esta semana, Este mes...).
     * --------------------------------------------------------------- */
    function crearCalendario(destino, opciones = {}) {
        const modo = opciones.modo === 'rango' ? 'rango' : 'unico';
        const inputOriginal = destino.tagName === 'INPUT' ? destino : null;

        const raiz = document.createElement('div');
        raiz.className = `cal-selector cal-${modo}`;
        raiz.innerHTML = `
            <button type="button" class="cal-disparador" aria-haspopup="dialog" aria-expanded="false">
                <i class="bi bi-calendar3 cal-icono" aria-hidden="true"></i>
                <span class="cal-etiqueta"></span>
                <span class="cal-limpiar" role="button" aria-label="Quitar fecha" hidden><i class="bi bi-x-lg"></i></span>
            </button>
            <div class="cal-panel" hidden role="dialog">
                ${modo === 'rango' ? '<div class="cal-atajos"></div>' : ''}
                <div class="cal-mes">
                    <div class="cal-cabecera">
                        <button type="button" class="cal-nav" data-dir="-1" aria-label="Mes anterior"><i class="bi bi-chevron-left"></i></button>
                        <span class="cal-titulo"></span>
                        <button type="button" class="cal-nav" data-dir="1" aria-label="Mes siguiente"><i class="bi bi-chevron-right"></i></button>
                    </div>
                    <div class="cal-semana">${DIAS.map((d) => `<span>${d}</span>`).join('')}</div>
                    <div class="cal-dias"></div>
                    ${modo === 'rango' ? '<div class="cal-pie"><span class="cal-ayuda">Elige un día o un rango de fechas</span><button type="button" class="cal-btn-limpiar">Limpiar</button></div>' : ''}
                </div>
            </div>`;

        if (inputOriginal) {
            inputOriginal.parentNode.insertBefore(raiz, inputOriginal);
            inputOriginal.classList.add('cal-input-original');
            inputOriginal.tabIndex = -1;
        } else {
            destino.appendChild(raiz);
        }

        const disparador = raiz.querySelector('.cal-disparador');
        const etiqueta = raiz.querySelector('.cal-etiqueta');
        const botonQuitar = raiz.querySelector('.cal-limpiar');
        const panel = raiz.querySelector('.cal-panel');
        const titulo = raiz.querySelector('.cal-titulo');
        const dias = raiz.querySelector('.cal-dias');
        const atajos = raiz.querySelector('.cal-atajos');

        const estado = {
            desde: null,
            hasta: null,
            mes: hoy(),
            eligiendoFin: false,
            atajo: null
        };
        estado.mes.setDate(1);

        const ATAJOS = [
            { id: 'hoy', texto: 'Hoy', rango: () => [hoy(), hoy()] },
            { id: 'manana', texto: 'Mañana', rango: () => [sumarDias(hoy(), 1), sumarDias(hoy(), 1)] },
            { id: 'semana', texto: 'Esta semana', rango: () => { const h = hoy(); const lunes = sumarDias(h, -((h.getDay() + 6) % 7)); return [lunes, sumarDias(lunes, 6)]; } },
            { id: 'proximos7', texto: 'Próximos 7 días', rango: () => [hoy(), sumarDias(hoy(), 6)] },
            { id: 'mes', texto: 'Este mes', rango: () => { const h = hoy(); return [new Date(h.getFullYear(), h.getMonth(), 1), new Date(h.getFullYear(), h.getMonth() + 1, 0)]; } },
            { id: 'ultimos30', texto: 'Últimos 30 días', rango: () => [sumarDias(hoy(), -29), hoy()] }
        ];

        function minimo() {
            const valor = inputOriginal ? inputOriginal.min : opciones.min;
            return valor ? deISO(valor) : null;
        }

        function deshabilitado(fecha) {
            const min = minimo();
            if (min && fecha < min) return true;
            return typeof opciones.deshabilitar === 'function' && opciones.deshabilitar(aISO(fecha));
        }

        function pintarEtiqueta() {
            let texto;
            if (modo === 'unico') {
                const valor = inputOriginal ? inputOriginal.value : estado.desde;
                const f = deISO(valor);
                texto = f ? `${['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][f.getDay()]}, ${textoFecha(valor)}` : (opciones.placeholder || 'Elegir fecha');
                raiz.classList.toggle('cal-con-valor', Boolean(f));
            } else if (!estado.desde) {
                texto = opciones.placeholder || 'Cualquier fecha';
                raiz.classList.remove('cal-con-valor');
            } else {
                const atajo = ATAJOS.find((a) => a.id === estado.atajo);
                if (atajo) texto = atajo.texto;
                else if (estado.desde === estado.hasta) texto = textoFecha(estado.desde);
                else texto = `${textoFecha(estado.desde, false)} – ${textoFecha(estado.hasta)}`;
                raiz.classList.add('cal-con-valor');
            }
            etiqueta.textContent = texto;
            botonQuitar.hidden = modo === 'unico' || !estado.desde;
            if (inputOriginal) raiz.classList.toggle('cal-invalido', inputOriginal.classList.contains('is-invalid'));
        }

        function pintarAtajos() {
            if (!atajos) return;
            atajos.innerHTML = ATAJOS.map((a) => `<button type="button" class="cal-atajo ${estado.atajo === a.id ? 'activo' : ''}" data-atajo="${a.id}">${a.texto}</button>`).join('');
        }

        function pintarDias() {
            const anio = estado.mes.getFullYear();
            const mes = estado.mes.getMonth();
            titulo.textContent = `${MESES[mes]} ${anio}`;

            const primero = new Date(anio, mes, 1);
            const desplazamiento = (primero.getDay() + 6) % 7;
            const totalDias = new Date(anio, mes + 1, 0).getDate();
            const hoyISO = aISO(hoy());
            const seleccionUnica = modo === 'unico' ? (inputOriginal ? inputOriginal.value : estado.desde) : null;

            let html = '';
            for (let i = 0; i < desplazamiento; i++) html += '<span class="cal-dia vacio"></span>';
            for (let d = 1; d <= totalDias; d++) {
                const fecha = new Date(anio, mes, d);
                const iso = aISO(fecha);
                const clases = ['cal-dia'];
                if (iso === hoyISO) clases.push('hoy');
                if (deshabilitado(fecha)) clases.push('deshabilitado');
                if (modo === 'unico' && iso === seleccionUnica) clases.push('seleccionado');
                if (modo === 'rango' && estado.desde) {
                    const hasta = estado.hasta || estado.desde;
                    if (iso === estado.desde || iso === hasta) clases.push('seleccionado');
                    if (iso > estado.desde && iso < hasta) clases.push('en-rango');
                    if (iso === estado.desde && hasta !== estado.desde) clases.push('inicio');
                    if (iso === hasta && hasta !== estado.desde) clases.push('fin');
                }
                html += `<button type="button" class="${clases.join(' ')}" data-fecha="${iso}" ${clases.includes('deshabilitado') ? 'disabled' : ''}>${d}</button>`;
            }
            dias.innerHTML = html;
        }

        function notificar() {
            pintarEtiqueta();
            if (modo === 'rango' && typeof opciones.alCambiar === 'function') {
                opciones.alCambiar(estado.desde ? { desde: estado.desde, hasta: estado.hasta || estado.desde } : null);
            }
        }

        function abrir() {
            if (inputOriginal && inputOriginal.disabled) return;
            const base = deISO(modo === 'unico' && inputOriginal ? inputOriginal.value : estado.desde) || hoy();
            estado.mes = new Date(base.getFullYear(), base.getMonth(), 1);
            pintarAtajos();
            pintarDias();
            panel.hidden = false;
            raiz.classList.add('cal-abierto');
            disparador.setAttribute('aria-expanded', 'true');
            reposicionarCalendario();
        }

        function reposicionarCalendario() {
            posicionarPanel(disparador, panel);
        }

        function cerrar() {
            if (panel.hidden) return;
            panel.hidden = true;
            raiz.classList.remove('cal-abierto');
            disparador.setAttribute('aria-expanded', 'false');
            estado.eligiendoFin = false;
        }

        disparador.addEventListener('click', (evento) => {
            if (evento.target.closest('.cal-limpiar')) {
                evento.stopPropagation();
                estado.desde = estado.hasta = estado.atajo = null;
                cerrar();
                notificar();
                return;
            }
            panel.hidden ? abrir() : cerrar();
        });

        seguirPosicion(() => !panel.hidden, reposicionarCalendario);

        raiz.querySelectorAll('.cal-nav').forEach((boton) => boton.addEventListener('click', () => {
            estado.mes = new Date(estado.mes.getFullYear(), estado.mes.getMonth() + Number(boton.dataset.dir), 1);
            pintarDias();
            reposicionarCalendario();
        }));

        dias.addEventListener('click', (evento) => {
            const boton = evento.target.closest('.cal-dia[data-fecha]');
            if (!boton || boton.disabled) return;
            const iso = boton.dataset.fecha;

            if (modo === 'unico') {
                if (inputOriginal) {
                    inputOriginal.value = iso;
                    inputOriginal.dispatchEvent(new Event('input', { bubbles: true }));
                    inputOriginal.dispatchEvent(new Event('change', { bubbles: true }));
                } else {
                    estado.desde = iso;
                }
                pintarEtiqueta();
                cerrar();
                if (typeof opciones.alCambiar === 'function') opciones.alCambiar(iso);
                return;
            }

            estado.atajo = null;
            if (!estado.eligiendoFin || !estado.desde || iso < estado.desde) {
                estado.desde = iso;
                estado.hasta = iso;
                estado.eligiendoFin = true;
                pintarDias();
                notificar();
            } else {
                estado.hasta = iso;
                estado.eligiendoFin = false;
                pintarDias();
                notificar();
                cerrar();
            }
        });

        if (atajos) {
            atajos.addEventListener('click', (evento) => {
                const boton = evento.target.closest('.cal-atajo');
                if (!boton) return;
                const atajo = ATAJOS.find((a) => a.id === boton.dataset.atajo);
                const [desde, hasta] = atajo.rango();
                estado.desde = aISO(desde);
                estado.hasta = aISO(hasta);
                estado.atajo = atajo.id;
                estado.eligiendoFin = false;
                cerrar();
                notificar();
            });
        }

        const botonLimpiar = raiz.querySelector('.cal-btn-limpiar');
        if (botonLimpiar) {
            botonLimpiar.addEventListener('click', () => {
                estado.desde = estado.hasta = estado.atajo = null;
                cerrar();
                notificar();
            });
        }

        document.addEventListener('keydown', (evento) => {
            if (evento.key === 'Escape') cerrar();
        });
        cerrarAlHacerClicFuera(raiz, cerrar);

        if (inputOriginal) {
            new MutationObserver(pintarEtiqueta).observe(inputOriginal, { attributes: true, attributeFilter: ['class', 'disabled', 'min'] });
            inputOriginal.addEventListener('change', pintarEtiqueta);
        }
        pintarEtiqueta();

        return {
            sincronizar: pintarEtiqueta,
            limpiar() {
                estado.desde = estado.hasta = estado.atajo = null;
                pintarEtiqueta();
            },
            valor: () => (estado.desde ? { desde: estado.desde, hasta: estado.hasta || estado.desde } : null)
        };
    }

    global.SelectorBuscable = { crear: crearSelectorBuscable };
    global.Calendario = { crear: crearCalendario };
})(window);
