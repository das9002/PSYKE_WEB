document.addEventListener('DOMContentLoaded', () => {

    const hamburgerBtn = document.getElementById('hamburgerBtn'); 
    const sidebar = document.querySelector('.sidebar');           
    const overlay = document.getElementById('sidebarOverlay');     

    if (hamburgerBtn && sidebar && overlay) {
        
        hamburgerBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');     
            overlay.classList.toggle('active');   
          
            hamburgerBtn.innerHTML = sidebar.classList.contains('open')
                ? '<i class="bi bi-x"></i>'
                : '<i class="bi bi-list"></i>';
        });

        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');     
            overlay.classList.remove('active');   
            hamburgerBtn.innerHTML = '<i class="bi bi-list"></i>'; 
        });

        document.querySelectorAll('.sidebar .nav-link').forEach(link => {
            link.addEventListener('click', () => {
                sidebar.classList.remove('open');
                overlay.classList.remove('active');
                hamburgerBtn.innerHTML = '<i class="bi bi-list"></i>';
            });
        });
    }

    if (typeof verificarSesion === 'function') {
        verificarSesion().then((usuario) => {
            if (usuario && String(usuario.tipoUsuario).toUpperCase() === 'ADMIN') {
                const opcionMensajes = document.getElementById('switchMensajes')?.closest('.settings-item');
                if (opcionMensajes) opcionMensajes.style.display = 'none';
            }
        });
    }

    const switchOscuro = document.getElementById('switchOscuro'); 
    if (switchOscuro) {
        switchOscuro.checked = document.documentElement.classList.contains('dark-mode');
        
        switchOscuro.addEventListener('change', (e) => {
            if (e.target.checked) {
                document.documentElement.classList.add('dark-mode');
                Preferencias.guardar('psyke_dark_mode', 'enabled');
            } else {
                document.documentElement.classList.remove('dark-mode');
                Preferencias.guardar('psyke_dark_mode', 'disabled');
            }
        });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();

            const confirmado = await Notif.confirmar(
                '¿Cerrar sesión?',
                'Tendrás que ingresar tus credenciales nuevamente para volver a entrar.',
                'Sí, cerrar sesión',
                { icono: 'warning', peligro: true }
            );
            if (confirmado) AuthService.logoutUsuario();
        });
    }

    const btnGestionCatalogos = document.getElementById('btnGestionCatalogos');
    if (btnGestionCatalogos) {
        btnGestionCatalogos.addEventListener('click', (e) => {
            e.preventDefault();
            abrirModalCatalogos();
        });
    }

    const cookiePrefsBtn = document.getElementById('cookiePrefsBtn');
    if (cookiePrefsBtn) {
        cookiePrefsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showCookiePreferencesModal();
        });
    }

    async function abrirModalCatalogos() {
        const modalEl = document.getElementById('modalCatalogos');
        if (!modalEl) return;
        const modal = new bootstrap.Modal(modalEl);
        modal.show();

        await Promise.all([cargarGrados(), cargarSecciones(), cargarEspecialidades()]);
    }

    async function cargarGrados() {
        const lista = document.getElementById('listaGrados');
        if (!lista) return;
        lista.innerHTML = '<li class="list-group-item text-muted">Cargando grados...</li>';
        try {
            const grados = await EstudiantesService.listarGrados();
            lista.innerHTML = '';
            if (!grados || grados.length === 0) {
                lista.innerHTML = '<li class="list-group-item text-muted">No hay grados registrados.</li>';
                return;
            }
            grados.forEach(g => {
                const id = g.idGrado ?? g.id;
                const nombre = g.nombreGrado ?? g.nombre;
                const li = document.createElement('li');
                li.className = 'list-group-item d-flex justify-content-between align-items-center';
                li.innerHTML = `
                    <span>${String(nombre)}</span>
                    <button class="btn btn-outline-danger btn-sm" onclick="eliminarGradoCat(${id})" title="Eliminar Grado">
                        <i class="bi bi-trash"></i>
                    </button>`;
                lista.appendChild(li);
            });
        } catch (e) {
            lista.innerHTML = '<li class="list-group-item text-danger">Error al cargar grados.</li>';
        }
    }

    async function cargarSecciones() {
        const lista = document.getElementById('listaSecciones');
        if (!lista) return;
        lista.innerHTML = '<li class="list-group-item text-muted">Cargando secciones...</li>';
        try {
            const secciones = await EstudiantesService.listarSecciones();
            lista.innerHTML = '';
            if (!secciones || secciones.length === 0) {
                lista.innerHTML = '<li class="list-group-item text-muted">No hay secciones registradas.</li>';
                return;
            }
            secciones.forEach(s => {
                const id = s.idSeccion ?? s.id;
                const nombre = s.nombreSeccion ?? s.nombre;
                const li = document.createElement('li');
                li.className = 'list-group-item d-flex justify-content-between align-items-center';
                li.innerHTML = `
                    <span>${String(nombre)}</span>
                    <button class="btn btn-outline-danger btn-sm" onclick="eliminarSeccionCat(${id})" title="Eliminar Sección">
                        <i class="bi bi-trash"></i>
                    </button>`;
                lista.appendChild(li);
            });
        } catch (e) {
            lista.innerHTML = '<li class="list-group-item text-danger">Error al cargar secciones.</li>';
        }
    }

    async function cargarEspecialidades() {
        const lista = document.getElementById('listaEspecialidades');
        if (!lista) return;
        lista.innerHTML = '<li class="list-group-item text-muted">Cargando especialidades...</li>';
        try {
            const especialidades = await EstudiantesService.listarEspecialidades();
            lista.innerHTML = '';
            if (!especialidades || especialidades.length === 0) {
                lista.innerHTML = '<li class="list-group-item text-muted">No hay especialidades registradas.</li>';
                return;
            }
            especialidades.forEach(esp => {
                const id = esp.idEspecialidad ?? esp.id;
                const nombre = esp.nombreEspecialidad ?? esp.nombre;
                const li = document.createElement('li');
                li.className = 'list-group-item d-flex justify-content-between align-items-center';
                li.innerHTML = `
                    <span>${String(nombre)}</span>
                    <button class="btn btn-outline-danger btn-sm" onclick="eliminarEspecialidadCat(${id})" title="Eliminar Especialidad">
                        <i class="bi bi-trash"></i>
                    </button>`;
                lista.appendChild(li);
            });
        } catch (e) {
            lista.innerHTML = '<li class="list-group-item text-danger">Error al cargar especialidades.</li>';
        }
    }

    document.getElementById('formGrado')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('inputNombreGrado');
        const nombre = input ? input.value.trim() : '';
        if (!nombre) return;
        try {
            await EstudiantesService.crearGrado({ nombreGrado: nombre });
            input.value = '';
            await cargarGrados();
            Notif.exito('Grado agregado correctamente.');
        } catch (err) {
            Notif.error(err.message || 'No se pudo agregar el grado.');
        }
    });

    document.getElementById('formSeccion')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('inputNombreSeccion');
        const nombre = input ? input.value.trim() : '';
        if (!nombre) return;
        try {
            await EstudiantesService.crearSeccion({ nombreSeccion: nombre });
            input.value = '';
            await cargarSecciones();
            Notif.exito('Sección agregada correctamente.');
        } catch (err) {
            Notif.error(err.message || 'No se pudo agregar la sección.');
        }
    });

    document.getElementById('formEspecialidad')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('inputNombreEspecialidad');
        const nombre = input ? input.value.trim() : '';
        if (!nombre) return;
        try {
            await EstudiantesService.crearEspecialidad({ nombreEspecialidad: nombre });
            input.value = '';
            await cargarEspecialidades();
            Notif.exito('Especialidad agregada correctamente.');
        } catch (err) {
            Notif.error(err.message || 'No se pudo agregar la especialidad.');
        }
    });

    window.eliminarGradoCat = async function (id) {
        const confirmado = await Notif.confirmarEliminar('Eliminar grado', '¿Seguro que deseas eliminar el grado? Si tiene estudiantes asignados no se podrá eliminar.');
        if (!confirmado) return;
        try {
            await EstudiantesService.eliminarGrado(id);
            await cargarGrados();
            Notif.exito('Grado eliminado.');
        } catch (err) {
            Notif.error(err.message || 'No se pudo eliminar el grado.');
        }
    };

    window.eliminarSeccionCat = async function (id) {
        const confirmado = await Notif.confirmarEliminar('Eliminar sección', '¿Seguro que deseas eliminar la sección? Si tiene estudiantes asignados no se podrá eliminar.');
        if (!confirmado) return;
        try {
            await EstudiantesService.eliminarSeccion(id);
            await cargarSecciones();
            Notif.exito('Sección eliminada.');
        } catch (err) {
            Notif.error(err.message || 'No se pudo eliminar la sección.');
        }
    };

    window.eliminarEspecialidadCat = async function (id) {
        const confirmado = await Notif.confirmarEliminar('Eliminar especialidad', '¿Seguro que deseas eliminar la especialidad? Si tiene estudiantes asignados no se podrá eliminar.');
        if (!confirmado) return;
        try {
            await EstudiantesService.eliminarEspecialidad(id);
            await cargarEspecialidades();
            Notif.exito('Especialidad eliminada.');
        } catch (err) {
            Notif.error(err.message || 'No se pudo eliminar la especialidad.');
        }
    };

    function showCookiePreferencesModal() {
        const savedPrefs = Preferencias.leer('psyke_cookie_preferences');
        let currentPrefs = { preferences: true, analytics: true };

        if (savedPrefs) {
            try {
                currentPrefs = JSON.parse(savedPrefs);
            } catch (err) {
                console.error("Fallo al decodificar preferencias de cookies guardadas:", err);
            }
        }

        Swal.fire({
            title: 'Preferencias de Cookies',
            html: `
                <div class="text-muted mb-4" style="font-size: 0.9rem;">
                    Utilizamos cookies para optimizar tu experiencia y analizar el tráfico de
                    navegación. Configura tus niveles de consentimiento a continuación:
                </div>
                <div style="text-align: left;">
                    <div class="d-flex justify-content-between align-items-center py-3 border-bottom">
                        <div style="max-width: 80%;">
                            <div class="fw-bold psyke-alerta-subtitulo" style="font-size: 0.9rem;">Cookies Técnicas (Esenciales)</div>
                            <div class="text-muted" style="font-size: 0.78rem; line-height: 1.3;">Obligatorias para el mantenimiento de sesión, seguridad del sistema y almacenamiento de configuraciones fundamentales.</div>
                        </div>
                        <div class="form-switch">
                            <input class="form-check-input" type="checkbox" checked disabled style="cursor: not-allowed; width: 2.8em; height: 1.5em;">
                        </div>
                    </div>
                    <div class="d-flex justify-content-between align-items-center py-3 border-bottom">
                        <div style="max-width: 80%;">
                            <div class="fw-bold psyke-alerta-subtitulo" style="font-size: 0.9rem;">Personalización y Preferencias</div>
                            <div class="text-muted" style="font-size: 0.78rem; line-height: 1.3;">Permiten al sitio web recordar parámetros definidos por el usuario (ej. interruptor del Modo Oscuro, idioma).</div>
                        </div>
                        <div class="form-switch">
                            <input class="form-check-input" type="checkbox" id="cookiePrefSwitch" ${currentPrefs.preferences ? 'checked' : ''} style="width: 2.8em; height: 1.5em;">
                        </div>
                    </div>
                    <div class="d-flex justify-content-between align-items-center py-3">
                        <div style="max-width: 80%;">
                            <div class="fw-bold psyke-alerta-subtitulo" style="font-size: 0.9rem;">Análisis y Rendimiento</div>
                            <div class="text-muted" style="font-size: 0.78rem; line-height: 1.3;">Recopilan información estadística y de uso de forma completamente anónima para medir y mejorar el rendimiento de la aplicación.</div>
                        </div>
                        <div class="form-switch">
                            <input class="form-check-input" type="checkbox" id="cookieAnalSwitch" ${currentPrefs.analytics ? 'checked' : ''} style="width: 2.8em; height: 1.5em;">
                        </div>
                    </div>
                </div>
            `,
            icon: 'info',
            width: 520,
            customClass: { popup: 'psyke-alerta', confirmButton: 'psyke-alerta-confirmar', cancelButton: 'psyke-alerta-cancelar' },
            reverseButtons: true,
            showCancelButton: true,
            confirmButtonColor: '#0d6efd',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Guardar Ajustes',
            cancelButtonText: 'Cancelar',
            preConfirm: () => {
                const prefCheckbox = document.getElementById('cookiePrefSwitch');
                const analCheckbox = document.getElementById('cookieAnalSwitch');

                Preferencias.guardar('psyke_cookie_preferences', JSON.stringify({
                    preferences: prefCheckbox.checked,
                    analytics: analCheckbox.checked
                }));
            }
        }).then((result) => {
            if (result.isConfirmed) {
                Notif.exito('Tus preferencias de privacidad han sido registradas y aplicadas.', 'Preferencias Actualizadas');
            }
        });
    }
});
