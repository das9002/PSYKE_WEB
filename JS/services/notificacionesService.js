(function (global) {
    'use strict';

    const COLORES = {
        primario: '#0d6efd',
        peligro: '#dc3545',
        exito: '#198754',
        neutro: '#6c757d'
    };

    const hayModal = () => typeof global.Swal !== 'undefined';

    const claseBase = {
        popup: 'psyke-alerta',
        confirmButton: 'psyke-alerta-confirmar',
        cancelButton: 'psyke-alerta-cancelar'
    };

    const Toast = hayModal()
        ? global.Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3500,
            timerProgressBar: true,
            customClass: { popup: 'psyke-toast' },
            didOpen: (toast) => {
                toast.addEventListener('mouseenter', global.Swal.stopTimer);
                toast.addEventListener('mouseleave', global.Swal.resumeTimer);
            }
        })
        : null;

    function toast(icono, titulo, mensaje, duracion) {
        if (!Toast) {
            console[icono === 'error' ? 'error' : 'log'](`${titulo}: ${mensaje || ''}`);
            return Promise.resolve();
        }
        return Toast.fire({
            icon: icono,
            title: titulo,
            text: mensaje || undefined,
            timer: duracion
        });
    }

    function modal(opciones) {
        if (!hayModal()) {
            const texto = [opciones.title, opciones.text].filter(Boolean).join('\n');
            if (opciones.showCancelButton) {
                return Promise.resolve({ isConfirmed: global.confirm(texto) });
            }
            global.alert(texto);
            return Promise.resolve({ isConfirmed: true });
        }
        return global.Swal.fire({
            confirmButtonText: 'Entendido',
            cancelButtonText: 'Cancelar',
            reverseButtons: true,
            customClass: claseBase,
            ...opciones
        });
    }

    const Notif = {
        exito(mensaje, titulo = '¡Listo!') {
            return toast('success', titulo, mensaje, 3000);
        },

        error(mensaje, titulo = 'Error') {
            return toast('error', titulo, mensaje, 5000);
        },

        advertencia(mensaje, titulo = 'Atención') {
            return toast('warning', titulo, mensaje, 4500);
        },

        info(mensaje, titulo = 'Aviso') {
            return toast('info', titulo, mensaje, 3500);
        },

        exitoModal(mensaje, titulo = '¡Listo!') {
            return modal({ icon: 'success', title: titulo, text: mensaje, confirmButtonColor: COLORES.exito });
        },

        errorModal(mensaje, titulo = 'Error') {
            return modal({ icon: 'error', title: titulo, text: mensaje, confirmButtonColor: COLORES.peligro });
        },

        informar(mensaje, titulo = 'Aviso') {
            return modal({ icon: 'info', title: titulo, text: mensaje, confirmButtonColor: COLORES.primario });
        },

        credenciales(titulo, html) {
            return modal({ icon: 'success', title: titulo, html, confirmButtonColor: COLORES.exito, confirmButtonText: 'Aceptar' });
        },

        confirmar(titulo, texto, botonConfirmar = 'Sí, continuar', opciones = {}) {
            return modal({
                icon: opciones.icono || 'question',
                title: titulo,
                text: texto,
                showCancelButton: true,
                confirmButtonColor: opciones.peligro ? COLORES.peligro : COLORES.primario,
                cancelButtonColor: COLORES.neutro,
                confirmButtonText: botonConfirmar,
                cancelButtonText: opciones.botonCancelar || 'Cancelar',
                allowOutsideClick: false
            }).then(resultado => Boolean(resultado && resultado.isConfirmed));
        },

        confirmarEliminar(titulo, texto) {
            return Notif.confirmar(titulo, texto, 'Sí, eliminar', { icono: 'warning', peligro: true });
        },

        cargando(titulo = 'Procesando...', texto = 'Espera un momento.') {
            if (!hayModal()) return;
            global.Swal.fire({
                title: titulo,
                text: texto,
                allowOutsideClick: false,
                allowEscapeKey: false,
                showConfirmButton: false,
                customClass: claseBase,
                didOpen: () => global.Swal.showLoading()
            });
        },

        cerrar() {
            if (hayModal() && global.Swal.isVisible()) {
                global.Swal.close();
            }
        }
    };

    global.Notif = Notif;
})(window);
