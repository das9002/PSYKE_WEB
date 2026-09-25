
const Toast = Swal.mixin({
    toast: true,
    position: 'top-start',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer);
        toast.addEventListener('mouseleave', Swal.resumeTimer);
    }
});

const Notif = {
    exito(mensaje, titulo = '¡Éxito!') {
        return Toast.fire({
            icon: 'success',
            title: titulo,
            text: mensaje
        });
    },

    error(mensaje, titulo = 'Error') {
        return Toast.fire({
            icon: 'error',
            title: titulo,
            text: mensaje
        });
    },

    errorModal(mensaje, titulo = 'Error') {
        return Swal.fire({
            icon: 'error',
            title: titulo,
            text: mensaje,
            confirmButtonColor: '#dc3545',
            confirmButtonText: 'Entendido'
        });
    },

    informar(mensaje, titulo = 'Aviso') {
        return Swal.fire({
            title: titulo,
            text: mensaje,
            icon: 'info',
            confirmButtonColor: '#0d6efd',
            confirmButtonText: 'Entendido'
        });
    },

    credenciales(titulo, html) {
        return Swal.fire({
            title: titulo,
            html,
            icon: 'success',
            confirmButtonColor: '#198754',
            confirmButtonText: 'Aceptar'
        });
    },

    confirmarEliminar(titulo, texto) {
        return Swal.fire({
            title: titulo,
            text: texto,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc3545',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        }).then(resultado => resultado.isConfirmed);
    },

    confirmar(titulo, texto, botonConfirmar = 'Sí, continuar') {
        return Swal.fire({
            title: titulo,
            text: texto,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#0d6efd',
            cancelButtonColor: '#6c757d',
            confirmButtonText: botonConfirmar,
            cancelButtonText: 'Cancelar'
        }).then(resultado => resultado.isConfirmed);
    }
};
