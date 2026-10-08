(function (global) {
    'use strict';

    const INTERVALO_PING = 25000;
    const ESPERA_MAXIMA = 30000;

    function crear(opciones) {
        const oyentesEvento = new Set();
        const oyentesEstado = new Set();

        let socket = null;
        let estado = 'desconectado';
        let intentos = 0;
        let detenido = false;
        let conectando = false;
        let temporizadorPing = null;
        let temporizadorReconexion = null;

        function cambiarEstado(nuevo) {
            if (estado === nuevo) return;
            estado = nuevo;
            oyentesEstado.forEach((fn) => {
                try { fn(nuevo); } catch (error) { console.error(error); }
            });
        }

        function emitir(evento) {
            oyentesEvento.forEach((fn) => {
                try { fn(evento); } catch (error) { console.error(error); }
            });
        }

        function iniciarPing() {
            detenerPing();
            temporizadorPing = setInterval(() => enviar({ tipo: 'ping' }), INTERVALO_PING);
        }

        function detenerPing() {
            clearInterval(temporizadorPing);
            temporizadorPing = null;
        }

        function programarReconexion() {
            if (detenido) return;
            clearTimeout(temporizadorReconexion);
            const espera = Math.min(ESPERA_MAXIMA, 1000 * Math.pow(2, intentos)) + Math.random() * 500;
            intentos++;
            temporizadorReconexion = setTimeout(conectar, espera);
        }

        async function conectar() {
            if (detenido || conectando) return;
            if (socket && (socket.readyState === 0 || socket.readyState === 1)) return;
            if (!('WebSocket' in global)) {
                cambiarEstado('no-disponible');
                return;
            }

            conectando = true;
            cambiarEstado('conectando');

            let ticket = null;
            try {
                ticket = await opciones.obtenerTicket();
            } catch (error) {
                conectando = false;
                if (error && error.permanente) {
                    detenido = true;
                    cambiarEstado('no-disponible');
                    return;
                }
            }

            if (!ticket) {
                conectando = false;
                cambiarEstado('desconectado');
                programarReconexion();
                return;
            }

            const base = typeof opciones.url === 'function' ? opciones.url() : opciones.url;
            const separador = base.includes('?') ? '&' : '?';

            try {
                socket = new WebSocket(`${base}${separador}ticket=${encodeURIComponent(ticket)}`);
            } catch (error) {
                conectando = false;
                cambiarEstado('desconectado');
                programarReconexion();
                return;
            }

            socket.onopen = () => {
                conectando = false;
                intentos = 0;
                iniciarPing();
            };

            socket.onmessage = (mensaje) => {
                let datos;
                try { datos = JSON.parse(mensaje.data); } catch (error) { return; }
                if (!datos || datos.tipo === 'pong') return;
                if (datos.tipo === 'conectado') cambiarEstado('conectado');
                emitir(datos);
            };

            socket.onclose = () => {
                conectando = false;
                detenerPing();
                socket = null;
                cambiarEstado('desconectado');
                programarReconexion();
            };

            socket.onerror = () => { };
        }

        function enviar(datos) {
            if (!socket || socket.readyState !== 1) return false;
            try {
                socket.send(JSON.stringify(datos));
                return true;
            } catch (error) {
                return false;
            }
        }

        function reconectarAhora() {
            if (detenido || estado === 'conectado' || conectando) return;
            intentos = 0;
            clearTimeout(temporizadorReconexion);
            conectar();
        }

        function cerrar() {
            detenido = true;
            clearTimeout(temporizadorReconexion);
            detenerPing();
            if (socket) socket.close(1000, 'Cierre normal');
            socket = null;
            cambiarEstado('desconectado');
        }

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') reconectarAhora();
        });
        global.addEventListener('online', reconectarAhora);

        return {
            conectar,
            enviar,
            cerrar,
            estaConectado: () => estado === 'conectado',
            estado: () => estado,
            alEvento(fn) { oyentesEvento.add(fn); return () => oyentesEvento.delete(fn); },
            alCambiarEstado(fn) { oyentesEstado.add(fn); return () => oyentesEstado.delete(fn); }
        };
    }

    global.ChatSocket = { crear };
})(window);
