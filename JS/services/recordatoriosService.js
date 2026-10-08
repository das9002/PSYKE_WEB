(function (global) {
    'use strict';

    const TIPOS = {
        CITA: { texto: 'Cita', icono: 'bi-calendar-check' },
        CUESTIONARIO: { texto: 'Cuestionario', icono: 'bi-clipboard2-check' },
        GENERAL: { texto: 'Mensaje', icono: 'bi-chat-heart' }
    };

    const MENSAJES_SUGERIDOS = {
        CITA: 'Te recuerdo tu próxima cita en el departamento de psicología. ¡Te espero!',
        CUESTIONARIO: 'Tienes un cuestionario pendiente en la app de Psyke. Cuando puedas, respóndelo, por favor.',
        GENERAL: ''
    };

    function escapar(texto) {
        const div = document.createElement('div');
        div.textContent = texto ?? '';
        return div.innerHTML.replace(/"/g, '&quot;');
    }

    async function abrir({ idEstudiante, nombre, tipo = 'CITA', mensaje } = {}) {
        if (!idEstudiante) {
            Notif.advertencia('No se encontró al estudiante.');
            return false;
        }
        if (typeof global.Swal === 'undefined') return false;

        const botones = Object.entries(TIPOS).map(([clave, t]) => `
            <button type="button" class="rec-tipo${clave === tipo ? ' activo' : ''}" data-tipo="${clave}">
                <i class="bi ${t.icono}"></i> ${t.texto}
            </button>`).join('');

        const resultado = await global.Swal.fire({
            title: 'Enviar recordatorio',
            html: `
                <div class="rec-form">
                    <p class="rec-destino">Para <strong>${escapar(nombre || 'el estudiante')}</strong>. Le llegará como notificación en su teléfono.</p>
                    <div class="rec-tipos">${botones}</div>
                    <textarea id="recMensaje" class="form-control" rows="4" maxlength="450" placeholder="Escribe el recordatorio...">${escapar(mensaje ?? MENSAJES_SUGERIDOS[tipo])}</textarea>
                    <div class="rec-contador"><span id="recContador">0</span>/450</div>
                </div>`,
            showCancelButton: true,
            confirmButtonText: '<i class="bi bi-send-fill"></i> Enviar',
            cancelButtonText: 'Cancelar',
            reverseButtons: true,
            focusConfirm: false,
            customClass: { popup: 'psyke-alerta rec-popup', confirmButton: 'psyke-alerta-confirmar', cancelButton: 'psyke-alerta-cancelar' },
            didOpen: (popup) => {
                const area = popup.querySelector('#recMensaje');
                const contador = popup.querySelector('#recContador');
                const actualizar = () => { contador.textContent = area.value.length; };
                area.addEventListener('input', actualizar);
                actualizar();
                popup.querySelectorAll('.rec-tipo').forEach((boton) => {
                    boton.addEventListener('click', () => {
                        const anterior = popup.querySelector('.rec-tipo.activo');
                        const sugerido = MENSAJES_SUGERIDOS[anterior?.dataset.tipo];
                        popup.querySelectorAll('.rec-tipo').forEach(b => b.classList.toggle('activo', b === boton));
                        if (!area.value.trim() || area.value === sugerido) {
                            area.value = MENSAJES_SUGERIDOS[boton.dataset.tipo];
                            actualizar();
                        }
                        area.focus();
                    });
                });
            },
            preConfirm: async () => {
                const popup = global.Swal.getPopup();
                const texto = popup.querySelector('#recMensaje').value.trim();
                const tipoElegido = popup.querySelector('.rec-tipo.activo')?.dataset.tipo || 'GENERAL';
                if (!texto) {
                    global.Swal.showValidationMessage('Escribe el mensaje del recordatorio');
                    return false;
                }
                try {
                    await peticionApi('/notificaciones/recordatorio', {
                        method: 'POST',
                        body: JSON.stringify({ idEstudiante, tipo: tipoElegido, mensaje: texto })
                    });
                    return true;
                } catch (error) {
                    global.Swal.showValidationMessage(error?.message || 'No se pudo enviar el recordatorio');
                    return false;
                }
            },
            allowOutsideClick: () => !global.Swal.isLoading()
        });

        if (resultado.isConfirmed) {
            Notif.exito(`${nombre || 'El estudiante'} recibirá el recordatorio en su teléfono.`, 'Recordatorio enviado');
            return true;
        }
        return false;
    }

    global.Recordatorios = { abrir };
})(window);
