document.addEventListener('DOMContentLoaded', async () => {
    'use strict';

    const avatar = document.getElementById('avatarCircle');
    const perfilNombre = document.getElementById('perfilNombre');
    const perfilRol = document.getElementById('perfilRol');
    const avisoSinPerfil = document.getElementById('avisoSinPerfil');

    function poner(id, valor) {
        const elemento = document.getElementById(id);
        if (elemento) elemento.textContent = valor || '—';
    }

    function iniciales(nombres, apellidos) {
        const n = (nombres || '').trim();
        const a = (apellidos || '').trim();
        if (!n && !a) return 'PS';
        return ((n ? n[0] : '') + (a ? a[0] : '')).toUpperCase();
    }

    function nombreRol(tipo) {
        return { ADMIN: 'Administrador', PSICOLOGO: 'Psicólogo' }[tipo] || tipo || '';
    }

    function nombreEstado(estado) {
        return { ACTIVO: 'Activa', INACTIVO: 'Inactiva', BLOQUEADO: 'Bloqueada' }[estado] || estado || '';
    }

    async function cargarPerfil() {
        let sesion;
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

        const rol = nombreRol(sesion.tipoUsuario);
        poner('verCorreo', sesion.correo);
        poner('verRol', rol);
        poner('verEstadoCuenta', nombreEstado(sesion.estadoCuenta));
        if (perfilRol) perfilRol.textContent = rol;

        let psicologo = null;
        try {
            psicologo = await ProfileService.obtenerPsicologoPorUsuario(sesion.idUsuario);
        } catch (error) {
            Notif.error(error.message, 'No se pudo cargar el perfil');
        }

        if (!psicologo) {
            if (avisoSinPerfil) avisoSinPerfil.classList.remove('d-none');
            if (perfilNombre) perfilNombre.textContent = rol || sesion.correo || 'Mi perfil';
            if (avatar) avatar.textContent = iniciales(sesion.correo, '');
            return;
        }

        const nombres = psicologo.nombresCompletos || '';
        const apellidos = psicologo.apellidosCompletos || '';
        poner('verNombres', nombres);
        poner('verApellidos', apellidos);
        if (perfilNombre) perfilNombre.textContent = `${nombres} ${apellidos}`.trim() || sesion.correo;
        if (avatar) avatar.textContent = iniciales(nombres, apellidos);
    }

    cargarPerfil();
});
