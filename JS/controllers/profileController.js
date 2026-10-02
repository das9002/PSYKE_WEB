document.addEventListener('DOMContentLoaded', async () => {
    'use strict';

    const form = document.getElementById('editProfileForm');
    const inputNombre = document.getElementById('inputNombre');
    const inputApellido = document.getElementById('inputApellido');
    const inputEmail = document.getElementById('inputEmail');
    const inputRol = document.getElementById('inputRol');
    const botonGuardar = document.getElementById('btnGuardarPerfil');
    const avisoSinPerfil = document.getElementById('avisoSinPerfil');
    const avatar = document.getElementById('avatarCircle');

    const SOLO_LETRAS = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' ]+$/;

    let sesion = null;
    let psicologo = null;

    function iniciales(nombres, apellidos) {
        const n = (nombres || '').trim();
        const a = (apellidos || '').trim();
        if (!n && !a) return 'PS';
        return ((n ? n[0] : '') + (a ? a[0] : '')).toUpperCase();
    }

    function nombreRol(tipo) {
        return { ADMIN: 'Administrador', PSICOLOGO: 'Psicólogo' }[tipo] || tipo || '';
    }

    function habilitarEdicion(habilitado) {
        [inputNombre, inputApellido, botonGuardar].forEach(el => {
            if (el) el.disabled = !habilitado;
        });
        if (avisoSinPerfil) avisoSinPerfil.classList.toggle('d-none', habilitado);
    }

    function validar(nombres, apellidos) {
        if (!nombres || !apellidos) return 'Los nombres y apellidos son obligatorios.';
        if (nombres.length > 100 || apellidos.length > 100) return 'Los nombres y apellidos no pueden superar los 100 caracteres.';
        if (!SOLO_LETRAS.test(nombres) || !SOLO_LETRAS.test(apellidos)) return 'Los nombres y apellidos solo pueden contener letras y espacios.';
        return null;
    }

    async function cargarPerfil() {
        habilitarEdicion(false);
        if (avisoSinPerfil) avisoSinPerfil.classList.add('d-none');

        try {
            sesion = await AuthService.obtenerSesion();
        } catch (error) {
            if (error.status === 401) {
                Notif.error('Tu sesión ha expirado. Inicia sesión nuevamente.', 'Sesión expirada');
                setTimeout(() => window.location.replace('../index.html'), 1500);
            } else {
                Notif.error(error.message, 'No se pudo cargar el perfil');
            }
            return;
        }

        if (inputEmail) inputEmail.value = sesion.correo || '';
        if (inputRol) inputRol.value = nombreRol(sesion.tipoUsuario);

        try {
            psicologo = await ProfileService.obtenerPsicologoPorUsuario(sesion.idUsuario);
        } catch (error) {
            Notif.error(error.message, 'No se pudo cargar el perfil');
            return;
        }

        if (!psicologo) {
            if (avatar) avatar.textContent = iniciales(sesion.correo, '');
            habilitarEdicion(false);
            return;
        }

        inputNombre.value = psicologo.nombresCompletos || '';
        inputApellido.value = psicologo.apellidosCompletos || '';
        if (avatar) avatar.textContent = iniciales(psicologo.nombresCompletos, psicologo.apellidosCompletos);
        habilitarEdicion(true);
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!psicologo || !sesion) return;

            const nombres = inputNombre.value.trim().replace(/\s+/g, ' ');
            const apellidos = inputApellido.value.trim().replace(/\s+/g, ' ');

            const error = validar(nombres, apellidos);
            if (error) {
                Notif.advertencia(error, 'Revisa los campos');
                return;
            }

            if (nombres === psicologo.nombresCompletos && apellidos === psicologo.apellidosCompletos) {
                Notif.info('No hay cambios por guardar.', 'Sin cambios');
                return;
            }

            botonGuardar.disabled = true;
            try {
                const actualizado = await ProfileService.actualizarPsicologo(psicologo.idPsicologo, sesion.idUsuario, nombres, apellidos);
                psicologo = actualizado || { ...psicologo, nombresCompletos: nombres, apellidosCompletos: apellidos };
                inputNombre.value = psicologo.nombresCompletos;
                inputApellido.value = psicologo.apellidosCompletos;
                if (avatar) avatar.textContent = iniciales(nombres, apellidos);
                Notif.exito('Tus datos se guardaron correctamente.', 'Perfil actualizado');
            } catch (err) {
                Notif.error(err.message || 'No se pudo actualizar el perfil.', 'No se pudo guardar');
            } finally {
                botonGuardar.disabled = false;
            }
        });
    }

    cargarPerfil();
});
