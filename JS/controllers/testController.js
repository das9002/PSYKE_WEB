
window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason;
    if (error && (error.name === 'AbortError' || /interrupted by a call to pause/i.test(String(error.message)))) {
        event.preventDefault();
    }
});

function reproducirAudioSeguro(elemento) {
    if (!elemento || typeof elemento.play !== 'function') return;
    const playPromise = elemento.play();
    if (playPromise !== undefined && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {  });
    }
}

document.addEventListener('DOMContentLoaded', () => {


    const estado = {
        cuestionarios: [],
        testsRespondidos: [],
        estudiantes: [],
        psicologos: [],
        catalogoCargado: false,
        respondidosCargados: false,
        estudiantesCargados: false,
        cuestionarioEditandoId: null,
        cargandoCatalogo: false
    };


    function el(id) {
        return document.getElementById(id);
    }

    function escapeHTML(str) {
        return String(str ?? '').replace(/[&<>"']/g, (c) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[c]));
    }

    function nombreCuestionario(c) {
        return c?.nombre ?? c?.nombreCuestionario ?? c?.titulo ?? 'Cuestionario';
    }

    function objetivoCuestionario(c) {
        return c?.objetivo ?? c?.objetivoPrueba ?? c?.descripcion ?? '';
    }

    function creadorCuestionario(c) {
        const creador = c?.creador;
        if (creador && typeof creador === 'object') {
            return `${creador.nombresCompletos ?? ''} ${creador.apellidosCompletos ?? ''}`.trim() || 'Psicólogo institucional';
        }
        return creador ?? c?.psicologo?.nombresCompletos ?? c?.psicologoCreador ?? 'Psicólogo institucional';
    }

    function preguntasCuestionario(c) {
        return Array.isArray(c?.preguntas) ? c.preguntas : Array.isArray(c?.preguntasCuestionario) ? c.preguntasCuestionario : [];
    }

    function idCuestionario(c) {
        return c?.idCuestionario ?? c?.id;
    }

    function idRespondido(r) {
        return r?.idTestRespondido ?? r?.id ?? r?.idRespuesta;
    }

    function nombreEstudianteDe(r) {
        const e = r?.estudiante ?? r?.alumno ?? {};
        const nombres = e?.nombres ?? e?.nombre ?? '';
        const apellidos = e?.apellidos ?? e?.apellido ?? '';
        return `${nombres} ${apellidos}`.trim() || r?.estudianteNombre || 'Estudiante';
    }

    function carnetDe(r) {
        return r?.carnet ?? r?.codigoCarnet ?? r?.estudiante?.codigoCarnet ?? '';
    }

    function gradoDe(r) {
        const g = r?.grado ?? r?.estudiante?.grado ?? {};
        return g?.nombreGrado ?? g?.nombre ?? r?.gradoNombre ?? '';
    }

    function seccionDe(r) {
        const s = r?.seccion ?? r?.estudiante?.seccion ?? {};
        return s?.nombreSeccion ?? s?.nombre ?? '';
    }

    function fechaResolucionDe(r) {
        return r?.fechaResolucion ?? r?.fecha ?? r?.fechaRespuesta ?? '';
    }

    function respuestasDe(r) {
        return Array.isArray(r?.respuestas) ? r.respuestas : Array.isArray(r?.detalleRespuestas) ? r.detalleRespuestas : [];
    }

    function estadoDe(r) {
        return r?.estado ?? 'COMPLETADO';
    }

    function textoPregunta(p) {
        return p?.texto ?? p?.textoPregunta ?? p?.enunciado ?? p?.pregunta ?? '';
    }

    function tipoPregunta(p) {
        return p?.tipo ?? p?.tipoRespuesta ?? 'Escala Likert';
    }

    function textoRespuesta(resp) {
        return resp?.respuesta ?? resp?.texto ?? resp?.valor ?? '';
    }

    function idEstudianteDe(est) {
        return est?.idEstudiante ?? est?.id;
    }

    function textoPreguntaRespuesta(resp) {
        return resp?.pregunta ?? resp?.enunciado ?? textoPregunta(resp);
    }


    const tablaTestsBody = el('tablaTestsBody');
    const noResultsTests = el('noResultsTests');
    const buscarTestInput = el('buscarTestInput');
    const btnNuevoTest = el('btnNuevoTest');

    const vistaListaTests = el('vista-lista-tests');
    const vistaCrearTest = el('vista-crear-test');
    const vistaRespondidos = el('vista-tests-respondidos');
    const vistaSinResponder = el('vista-tests-sin-responder');

    const btnVolverListaTests = el('btnVolverListaTests');
    const btnAddQuestion = el('btnAddQuestion');
    const btnGuardarTest = el('btnGuardarTest');
    const questionsContainer = el('questionsContainer');

    const txtCuestionario = el('txtCuestionario');
    const txtObjetivo = el('txtObjetivo');
    const selectCreador = el('selectCreador');

    const tabCatalogo = el('tabCatalogo');
    const tabCrear = el('tabCrear');
    const tabRespondidos = el('tabRespondidos');
    const tabSinResponder = el('tabSinResponder');

    let questionCount = 0;


    async function cargarCatalogo({ forzar = false } = {}) {
        if (estado.cargandoCatalogo) return;
        if (estado.catalogoCargado && !forzar) return;

        estado.cargandoCatalogo = true;
        mostrarFilaCargando(tablaTestsBody, 6);

        try {
            const lista = await TestService.listarCuestionarios();
            estado.cuestionarios = Array.isArray(lista) ? lista : [];
            estado.catalogoCargado = true;
            renderTablaTests();
        } catch (error) {
            const status = error?.status;
            if (status === 401) throw error;
            estado.cuestionarios = [];
            renderTablaTests();
            let mensaje;
            if (status === 403) {
                mensaje = 'Acceso denegado: Permisos insuficientes para ver el catálogo.';
            } else if (status >= 500) {
                mensaje = 'Error interno del servidor al cargar el catálogo. Intente nuevamente más tarde.';
            } else {
                mensaje = 'No se pudo cargar el catálogo';
            }
            Notif.error(mensaje);
        } finally {
            estado.cargandoCatalogo = false;
        }
    }

    async function cargarTestsRespondidos({ forzar = false } = {}) {
        if (estado.respondidosCargados && !forzar) return;

        try {
            const lista = await TestService.listarTestsRespondidos();
            estado.testsRespondidos = Array.isArray(lista) ? lista : [];
            estado.respondidosCargados = true;
        } catch (error) {
            const status = error?.status;
            if (status === 401) throw error;
            estado.testsRespondidos = [];
            let mensaje;
            if (status === 403) {
                mensaje = 'Acceso denegado: Permisos insuficientes para ver los tests respondidos.';
            } else if (status >= 500) {
                mensaje = 'Error interno del servidor al cargar los tests respondidos. Intente nuevamente más tarde.';
            } else {
                mensaje = 'No se pudo cargar los tests respondidos';
            }
            Notif.error(mensaje);
        }
    }

    async function cargarEstudiantes() {
        if (estado.estudiantesCargados) return;
        try {
            const lista = await TestService.listarEstudiantes();
            estado.estudiantes = Array.isArray(lista) ? lista : [];
            estado.estudiantesCargados = true;
        } catch (error) {
            const status = error?.status;
            if (status === 401) throw error;
            estado.estudiantes = [];
        }
    }


    function activarPestana(tabActiva, vistaActiva) {
        [tabCatalogo, tabCrear, tabRespondidos, tabSinResponder].forEach(t => {
            if (t) t.classList.remove('active');
        });
        [vistaListaTests, vistaCrearTest, vistaRespondidos, vistaSinResponder].forEach(v => {
            if (v) v.classList.add('d-none');
        });

        if (tabActiva) tabActiva.classList.add('active');
        if (vistaActiva) vistaActiva.classList.remove('d-none');
    }

    if (tabCatalogo) tabCatalogo.addEventListener('click', () => {
        activarPestana(tabCatalogo, vistaListaTests);
        cargarCatalogo();
    });

    if (tabCrear) tabCrear.addEventListener('click', () => {
        abrirFormularioCrear();
    });

    if (tabRespondidos) tabRespondidos.addEventListener('click', () => {
        activarPestana(tabRespondidos, vistaRespondidos);
        cargarTestsRespondidos().then(() => renderTablaRespondidos());
    });

    if (tabSinResponder) tabSinResponder.addEventListener('click', () => {
        activarPestana(tabSinResponder, vistaSinResponder);
        cargarTestsRespondidos()
            .then(cargarEstudiantes)
            .then(() => renderTablaSinResponder());
    });


    function mostrarFilaCargando(tbody, colspan) {
        if (!tbody) return;
        tbody.innerHTML = `
            <tr>
                <td colspan="${colspan}" class="text-center py-5 text-muted">
                    <div class="spinner-border text-primary" role="status"></div>
                    <p class="mt-2 mb-0 small">Cargando datos del servidor...</p>
                </td>
            </tr>
        `;
    }

    function mostrarFilaVacia(tbody, colspan, mensaje) {
        if (!tbody) return;
        tbody.innerHTML = `
            <tr>
                <td colspan="${colspan}" class="text-center py-5 text-muted">
                    <i class="bi bi-clipboard-x fs-2 d-block mb-2 opacity-50"></i>
                    ${escapeHTML(mensaje)}
                </td>
            </tr>
        `;
    }

    function renderTablaTests() {
        if (!tablaTestsBody) return;
        tablaTestsBody.innerHTML = '';

        if (estado.cuestionarios.length === 0) {
            if (noResultsTests) noResultsTests.classList.remove('d-none');
            return;
        }
        if (noResultsTests) noResultsTests.classList.add('d-none');

        estado.cuestionarios.forEach(c => {
            const idC = idCuestionario(c);
            const preguntas = preguntasCuestionario(c);
            const cantResp = estado.respondidosCargados
                ? estado.testsRespondidos.filter(r => Number(r?.cuestionario?.idCuestionario ?? r?.cuestionarioId) === Number(idC)).length
                : null;
            const tr = document.createElement('tr');

            tr.innerHTML = `
                <td>
                    <div class="fw-bold text-dark fs-6">${escapeHTML(nombreCuestionario(c))}</div>
                    <small class="text-muted"><i class="bi bi-person-badge me-1"></i>Creado por: ${escapeHTML(creadorCuestionario(c))}</small>
                </td>
                <td>
                    <span class="d-inline-block text-truncate" style="max-width: 260px;" title="${escapeHTML(objetivoCuestionario(c))}">
                        ${escapeHTML(objetivoCuestionario(c))}
                    </span>
                </td>
                <td class="text-center">
                    <span class="badge bg-light text-primary border fw-bold px-3 py-2">
                        ${preguntas.length ? preguntas.length + ' Preguntas' : '—'}
                    </span>
                </td>
                <td class="text-center">
                    <span class="badge bg-success text-white px-3 py-2 cursor-pointer ${estado.respondidosCargados ? '' : 'opacity-50'}"
                          title="Ver estudiantes que respondieron" onclick="verRespondidosTest(${idC})">
                        <i class="bi bi-check-circle-fill me-1"></i>${cantResp === null ? '—' : cantResp}
                    </span>
                </td>
                <td class="text-center">
                    <span class="badge bg-warning text-dark px-3 py-2 cursor-pointer ${estado.respondidosCargados ? '' : 'opacity-50'}"
                          title="Ver estudiantes pendientes" onclick="verSinResponderTest(${idC})">
                        <i class="bi bi-hourglass-split me-1"></i>${cantResp === null ? '—' : Math.max(0, estado.estudiantes.length - cantResp)}
                    </span>
                </td>
                <td class="text-center">
                    <div class="acciones">
                        <button class="btn-accion btn-ver" title="Ver preguntas del test" onclick="verPreguntasModal(${idC})">
                            <i class="bi bi-eye"></i>
                        </button>
                        <button class="btn-accion btn-editar" title="Editar test y preguntas" onclick="editarCuestionario(${idC})">
                            <i class="bi bi-pencil-square"></i>
                        </button>
                        <button class="btn-accion btn-eliminar" title="Eliminar cuestionario" onclick="eliminarCuestionario(${idC})">
                            <i class="bi bi-trash3"></i>
                        </button>
                    </div>
                </td>
            `;
            tablaTestsBody.appendChild(tr);
        });
    }

    let timerBusqueda = null;
    if (buscarTestInput) {
        buscarTestInput.addEventListener('input', (e) => {
            clearTimeout(timerBusqueda);
            timerBusqueda = setTimeout(() => {
                const val = e.target.value.toLowerCase().trim();
                if (!val) {
                    cargarCatalogo();
                    return;
                }
                TestService.buscarCuestionarios(val)
                    .then(lista => {
                        estado.cuestionarios = Array.isArray(lista) ? lista : [];
                        estado.catalogoCargado = true;
                        renderTablaTests();
                    })
                    .catch(() => {
                        estado.cuestionarios = estado.cuestionarios.filter(c =>
                            nombreCuestionario(c).toLowerCase().includes(val) ||
                            objetivoCuestionario(c).toLowerCase().includes(val) ||
                            creadorCuestionario(c).toLowerCase().includes(val)
                        );
                        renderTablaTests();
                    });
            }, 300);
        });
    }


    function generarPreguntaHTML(numero, texto = '', tipo = 'Escala Likert') {
        const previewHTML = generarPreviewPorTipo(tipo, numero);
        return `
            <div class="card-test-section question-card" id="questionCard_${numero}" data-num="${numero}">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <div class="d-flex align-items-center gap-2">
                        <span class="question-badge">Pregunta #${numero}</span>
                    </div>
                    <button type="button" class="btn btn-sm btn-outline-danger btn-delete-question" data-num="${numero}" title="Eliminar esta pregunta">
                        <i class="bi bi-trash3"></i> Eliminar
                    </button>
                </div>

                <div class="mb-3">
                    <label class="custom-form-label">
                        <i class="bi bi-question-circle text-primary"></i> Enunciado de la Pregunta <span class="text-danger">*</span>
                    </label>
                    <input type="text" class="form-control txtPregunta" id="txtPregunta_${numero}"
                           placeholder="Escribe aquí la pregunta para el estudiante..." value="${escapeHTML(texto)}">
                </div>

                <div class="mb-3">
                    <label class="custom-form-label mb-2">
                        <i class="bi bi-ui-radios-grid text-primary"></i> Tipo de Respuesta
                    </label>
                    <div class="row g-2">
                        <div class="col-md-4">
                            <button type="button" class="btn-tipo-respuesta w-100 ${tipo === 'Escala Likert' ? 'active' : ''}"
                                    data-num="${numero}" data-type="Escala Likert">
                                <i class="bi bi-sliders"></i> Escala Likert
                            </button>
                        </div>
                        <div class="col-md-4">
                            <button type="button" class="btn-tipo-respuesta w-100 ${tipo === 'Opcion multiple' ? 'active' : ''}"
                                    data-num="${numero}" data-type="Opcion multiple">
                                <i class="bi bi-list-check"></i> Opción Múltiple
                            </button>
                        </div>
                        <div class="col-md-4">
                            <button type="button" class="btn-tipo-respuesta w-100 ${tipo === 'Pregunta abierta' ? 'active' : ''}"
                                    data-num="${numero}" data-type="Pregunta abierta">
                                <i class="bi bi-textarea-t"></i> Pregunta Abierta
                            </button>
                        </div>
                    </div>
                    <input type="hidden" id="tipoRespuesta_${numero}" value="${tipo}">
                </div>

                <div class="preview-container mt-3">
                    <label class="custom-form-label small text-muted mb-2">
                        <i class="bi bi-eye text-primary"></i> Vista Previa de Respuesta para el Estudiante:
                    </label>
                    <div id="previewBox_${numero}">
                        ${previewHTML}
                    </div>
                </div>
            </div>
        `;
    }

    function generarPreviewPorTipo(tipo, numero) {
        if (tipo === 'Escala Likert') {
            return `
                <div class="preview-respuestas p-3">
                    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
                        <span class="small text-muted">1 (Nunca)</span>
                        <div class="d-flex gap-3">
                            <div class="form-check form-check-inline m-0">
                                <input class="form-check-input" type="radio" name="previewLikert_${numero}" id="likert_${numero}_1" checked>
                                <label class="form-check-label small" for="likert_${numero}_1">1</label>
                            </div>
                            <div class="form-check form-check-inline m-0">
                                <input class="form-check-input" type="radio" name="previewLikert_${numero}" id="likert_${numero}_2">
                                <label class="form-check-label small" for="likert_${numero}_2">2</label>
                            </div>
                            <div class="form-check form-check-inline m-0">
                                <input class="form-check-input" type="radio" name="previewLikert_${numero}" id="likert_${numero}_3">
                                <label class="form-check-label small" for="likert_${numero}_3">3</label>
                            </div>
                            <div class="form-check form-check-inline m-0">
                                <input class="form-check-input" type="radio" name="previewLikert_${numero}" id="likert_${numero}_4">
                                <label class="form-check-label small" for="likert_${numero}_4">4</label>
                            </div>
                            <div class="form-check form-check-inline m-0">
                                <input class="form-check-input" type="radio" name="previewLikert_${numero}" id="likert_${numero}_5">
                                <label class="form-check-label small" for="likert_${numero}_5">5</label>
                            </div>
                        </div>
                        <span class="small text-muted">5 (Siempre)</span>
                    </div>
                </div>
            `;
        } else if (tipo === 'Opcion multiple') {
            return `
                <div class="preview-respuestas p-3">
                    <div class="form-check mb-2">
                        <input class="form-check-input" type="radio" name="previewOpt_${numero}" id="opt_${numero}_1" checked>
                        <label class="form-check-label" for="opt_${numero}_1">Opción A: Frecuentemente / Adecuado</label>
                    </div>
                    <div class="form-check mb-2">
                        <input class="form-check-input" type="radio" name="previewOpt_${numero}" id="opt_${numero}_2">
                        <label class="form-check-label" for="opt_${numero}_2">Opción B: Ocasionalmente / En proceso</label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="radio" name="previewOpt_${numero}" id="opt_${numero}_3">
                        <label class="form-check-label" for="opt_${numero}_3">Opción C: Rara vez / Dificultad</label>
                    </div>
                </div>
            `;
        }
        return `
            <div class="preview-respuestas p-3">
                <textarea class="form-control" rows="2" placeholder="El estudiante redactará su respuesta detallada aquí..." disabled></textarea>
            </div>
        `;
    }

    function reenumerarPreguntas() {
        const cards = questionsContainer.querySelectorAll('.question-card');
        questionCount = cards.length;
        cards.forEach((card, index) => {
            const num = index + 1;
            card.id = `questionCard_${num}`;
            card.dataset.num = num;

            const badge = card.querySelector('.question-badge');
            if (badge) badge.textContent = `Pregunta #${num}`;

            const input = card.querySelector('.txtPregunta');
            if (input) input.id = `txtPregunta_${num}`;

            const btnDelete = card.querySelector('.btn-delete-question');
            if (btnDelete) btnDelete.dataset.num = num;

            const buttonsTipo = card.querySelectorAll('.btn-tipo-respuesta');
            buttonsTipo.forEach(b => b.dataset.num = num);

            const inputTipo = card.querySelector('input[type="hidden"]');
            if (inputTipo) inputTipo.id = `tipoRespuesta_${num}`;

            const previewBox = card.querySelector('[id^="previewBox_"]');
            if (previewBox) {
                previewBox.id = `previewBox_${num}`;
                previewBox.innerHTML = generarPreviewPorTipo(inputTipo ? inputTipo.value : 'Escala Likert', num);
            }
        });
    }

    function agregarPregunta(texto = '', tipo = 'Escala Likert') {
        questionCount++;
        const html = generarPreguntaHTML(questionCount, texto, tipo);
        questionsContainer.insertAdjacentHTML('beforeend', html);
        asignarEventosPregunta(questionCount);
    }

    function asignarEventosPregunta(num) {
        const card = document.getElementById(`questionCard_${num}`);
        if (!card) return;

        const btnTipos = card.querySelectorAll('.btn-tipo-respuesta');
        btnTipos.forEach(btn => {
            btn.addEventListener('click', () => {
                btnTipos.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const selectedType = btn.dataset.type;
                const hiddenInput = document.getElementById(`tipoRespuesta_${btn.dataset.num}`);
                if (hiddenInput) hiddenInput.value = selectedType;

                const previewBox = document.getElementById(`previewBox_${btn.dataset.num}`);
                if (previewBox) {
                    previewBox.innerHTML = generarPreviewPorTipo(selectedType, btn.dataset.num);
                }
            });
        });

        const btnDelete = card.querySelector('.btn-delete-question');
        if (btnDelete) {
            btnDelete.addEventListener('click', () => {
                if (questionsContainer.children.length <= 1) {
                    Notif.informar('El cuestionario debe tener al menos una pregunta.');
                    return;
                }
                card.remove();
                reenumerarPreguntas();
            });
        }
    }

    function abrirFormularioCrear() {
        estado.cuestionarioEditandoId = null;
        if (txtCuestionario) txtCuestionario.value = '';
        if (txtObjetivo) txtObjetivo.value = '';
        if (questionsContainer) questionsContainer.innerHTML = '';
        questionCount = 0;

        agregarPregunta('', 'Escala Likert');
        activarPestana(tabCrear, vistaCrearTest);
    }

    if (btnNuevoTest) btnNuevoTest.addEventListener('click', abrirFormularioCrear);
    if (btnVolverListaTests) btnVolverListaTests.addEventListener('click', () => {
        activarPestana(tabCatalogo, vistaListaTests);
        cargarCatalogo();
    });

    if (btnAddQuestion) {
        btnAddQuestion.addEventListener('click', () => {
            agregarPregunta('', 'Escala Likert');
        });
    }


    const TIPOS_RESPUESTA_VALIDOS = ['Escala Likert', 'Opcion multiple', 'Pregunta abierta'];

    async function cargarPsicologos() {
        if (!selectCreador) return;
        try {
            const lista = await PsicologosService.listar();
            estado.psicologos = Array.isArray(lista) ? lista : [];
            selectCreador.innerHTML = '';
            if (estado.psicologos.length === 0) {
                selectCreador.innerHTML = '<option value="">Sin psicólogos registrados</option>';
                return;
            }
            estado.psicologos.forEach(psi => {
                const opt = document.createElement('option');
                opt.value = psi.idPsicologo;
                opt.textContent = `Lic. ${psi.nombresCompletos ?? ''} ${psi.apellidosCompletos ?? ''}`.trim() || `Psicólogo #${psi.idPsicologo}`;
                selectCreador.appendChild(opt);
            });
        } catch (error) {
            Notif.error(mensajeErrorAmigable(error), 'No se pudieron cargar los psicólogos');
        }
    }

    async function guardarPreguntas(idCuestionario, preguntasArray) {
        for (const p of preguntasArray) {
            await TestService.crearPregunta({
                cuestionario: { idCuestionario: Number(idCuestionario) },
                textoPregunta: p.textoPregunta,
                tipoRespuesta: p.tipoRespuesta
            });
        }
    }

    async function reemplazarPreguntas(idCuestionario, preguntasArray) {
        const todas = await TestService.listarPreguntas();
        const existentes = Array.isArray(todas)
            ? todas.filter(p => Number(p?.cuestionario?.idCuestionario) === Number(idCuestionario))
            : [];
        for (const p of existentes) {
            await TestService.eliminarPregunta(Number(p?.idPregunta ?? p?.id));
        }
        await guardarPreguntas(idCuestionario, preguntasArray);
    }

    async function guardarCuestionario() {
        const nombre = txtCuestionario.value.trim();
        const objetivo = txtObjetivo.value.trim();
        const idCreador = Number(selectCreador ? selectCreador.value : '');

        if (!nombre) {
            Notif.informar('Por favor ingrese el nombre del cuestionario.');
            return;
        }
        if (nombre.length > 150) {
            Notif.informar('El nombre del cuestionario no puede superar los 150 caracteres.');
            return;
        }
        if (!objetivo) {
            Notif.informar('Por favor ingrese el objetivo del cuestionario.');
            return;
        }
        if (objetivo.length > 1000) {
            Notif.informar('El objetivo no puede superar los 1000 caracteres.');
            return;
        }
        if (!idCreador || !estado.psicologos.some(p => Number(p.idPsicologo) === idCreador)) {
            Notif.informar('Seleccione un psicólogo creador de la lista.');
            return;
        }

        const cards = questionsContainer.querySelectorAll('.question-card');
        const preguntasArray = [];
        let errorPreguntas = false;

        cards.forEach((card) => {
            const num = card.dataset.num;
            const txt = document.getElementById(`txtPregunta_${num}`).value.trim();
            const tipo = document.getElementById(`tipoRespuesta_${num}`).value;

            if (!txt || txt.length > 500 || !TIPOS_RESPUESTA_VALIDOS.includes(tipo)) {
                errorPreguntas = true;
                return;
            }
            preguntasArray.push({ textoPregunta: txt, tipoRespuesta: tipo });
        });

        if (errorPreguntas) {
            Notif.informar('Revise las preguntas: todas deben tener texto (máx. 500 caracteres) y un tipo de respuesta válido.');
            return;
        }

        const payload = {
            nombreTest: nombre,
            objetivoPrueba: objetivo,
            creador: { idPsicologo: idCreador }
        };

        try {
            if (estado.cuestionarioEditandoId) {
                await TestService.actualizarCuestionario(estado.cuestionarioEditandoId, payload);
                await reemplazarPreguntas(estado.cuestionarioEditandoId, preguntasArray);
                Notif.exito('¡Cuestionario actualizado correctamente!');
            } else {
                const guardado = await TestService.crearCuestionario(payload);
                await guardarPreguntas(idCuestionario(guardado), preguntasArray);
                Notif.exito('¡Cuestionario guardado con éxito!');
            }

            await cargarCatalogo({ forzar: true });
            activarPestana(tabCatalogo, vistaListaTests);
        } catch (error) {
            Notif.error(mensajeErrorAmigable(error), 'No se pudo guardar el cuestionario');
        }
    }

    if (btnGuardarTest) btnGuardarTest.addEventListener('click', guardarCuestionario);


    window.editarCuestionario = async function (id) {
        let c = estado.cuestionarios.find(item => Number(idCuestionario(item)) === Number(id));
        try {
            const detalle = await TestService.obtenerCuestionarioPorId(id);
            if (detalle) {
                c = detalle;
                const idx = estado.cuestionarios.findIndex(item => Number(idCuestionario(item)) === Number(id));
                if (idx !== -1) estado.cuestionarios[idx] = detalle;
            }
        } catch (error) {
            Notif.error(mensajeErrorAmigable(error), 'No se pudo cargar el cuestionario');
            return;
        }
        if (!c) return;

        estado.cuestionarioEditandoId = id;
        txtCuestionario.value = nombreCuestionario(c);
        txtObjetivo.value = objetivoCuestionario(c);
        if (selectCreador) {
            const idCreador = c?.creador?.idPsicologo ?? c?.creadorId;
            selectCreador.value = idCreador ? String(idCreador) : '';
        }

        questionsContainer.innerHTML = '';
        questionCount = 0;

        const preguntas = preguntasCuestionario(c);
        if (preguntas.length > 0) {
            preguntas.forEach(p => agregarPregunta(textoPregunta(p), tipoPregunta(p)));
        } else {
            agregarPregunta('', 'Escala Likert');
        }

        activarPestana(tabCrear, vistaCrearTest);
    };

    window.eliminarCuestionario = function (id) {
        const c = estado.cuestionarios.find(item => Number(idCuestionario(item)) === Number(id));
        if (!c) return;

        Notif.confirmarEliminar(
            'Eliminar cuestionario',
            `¿Estás seguro de que deseas eliminar el cuestionario "${nombreCuestionario(c)}"? Esta acción también borrará sus preguntas asociadas.`
        ).then(confirmado => {
            if (!confirmado) return;
            TestService.eliminarCuestionario(id)
                .then(() => {
                    estado.cuestionarios = estado.cuestionarios.filter(item => Number(idCuestionario(item)) !== Number(id));
                    Notif.exito('¡Cuestionario eliminado correctamente!');
                    renderTablaTests();
                })
                .catch(error => {
                    Notif.error(mensajeErrorAmigable(error), 'No se pudo eliminar el cuestionario');
                });
        });
    };

    window.verPreguntasModal = async function (id) {
        let c = estado.cuestionarios.find(item => Number(idCuestionario(item)) === Number(id));
        try {
            const detalle = await TestService.obtenerCuestionarioPorId(id);
            if (detalle) c = detalle;
        } catch (error) {
            Notif.error(mensajeErrorAmigable(error), 'No se pudo cargar las preguntas');
            return;
        }
        if (!c) return;

        const tituloEl = el('tituloModalPreguntas');
        const cuerpoEl = el('cuerpoModalPreguntas');

        if (tituloEl) tituloEl.textContent = nombreCuestionario(c);
        if (cuerpoEl) {
            const preguntas = preguntasCuestionario(c);
            let html = `
                <div class="p-3 bg-light rounded-3 mb-3 border">
                    <div class="fw-bold text-primary mb-1">Objetivo de la Prueba:</div>
                    <p class="mb-0 text-muted small">${escapeHTML(objetivoCuestionario(c))}</p>
                </div>
                <h6 class="fw-bold mb-3">Preguntas del Instrumento (${preguntas.length})</h6>
                <div class="list-group">
            `;

            preguntas.forEach((p, idx) => {
                html += `
                    <div class="list-group-item list-group-item-action p-3 mb-2 rounded-3 border">
                        <div class="d-flex justify-content-between align-items-center mb-1">
                            <span class="badge bg-primary-subtle text-primary fw-bold">Pregunta #${idx + 1}</span>
                            <span class="badge bg-secondary text-white">${escapeHTML(tipoPregunta(p))}</span>
                        </div>
                        <div class="fw-semibold text-dark">${escapeHTML(textoPregunta(p))}</div>
                    </div>
                `;
            });

            html += `</div>`;
            cuerpoEl.innerHTML = html;
        }

        const modal = new bootstrap.Modal(el('modalVerPreguntas'));
        modal.show();
    };


    function renderTablaRespondidos(filtroCuestionarioId = null) {
        const tbody = el('tablaRespondidosBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        let lista = estado.testsRespondidos;
        if (filtroCuestionarioId !== null) {
            lista = lista.filter(r => Number(r?.cuestionario?.idCuestionario ?? r?.cuestionarioId) === Number(filtroCuestionarioId));
        }

        if (lista.length === 0) {
            mostrarFilaVacia(tbody, 5, 'No hay tests respondidos registrados aún.');
            return;
        }

        lista.forEach(r => {
            const idR = idRespondido(r);
            const cuestionario = estado.cuestionarios.find(c => Number(idCuestionario(c)) === Number(r?.cuestionario?.idCuestionario ?? r?.cuestionarioId));
            const tr = document.createElement('tr');

            tr.innerHTML = `
                <td>
                    <div class="fw-bold text-dark">${escapeHTML(nombreEstudianteDe(r))}</div>
                    <small class="text-muted">Carnet: <strong>${escapeHTML(carnetDe(r))}</strong>${gradoDe(r) ? ` &bull; ${escapeHTML(gradoDe(r))}` : ''}</small>
                </td>
                <td>
                    <span class="fw-semibold text-primary">${escapeHTML(nombreCuestionario(cuestionario))}</span>
                </td>
                <td>
                    <span class="text-muted"><i class="bi bi-calendar3 me-1"></i>${escapeHTML(fechaResolucionDe(r))}</span>
                </td>
                <td class="text-center">
                    <span class="badge bg-success text-white px-3 py-2">
                        <i class="bi bi-check-all me-1"></i>${escapeHTML(estadoDe(r))}
                    </span>
                </td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-primary" onclick="verDetalleRespuestas(${idR})">
                        <i class="bi bi-journal-check me-1"></i>Ver Respuestas
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    window.verRespondidosTest = function (idCuestionario) {
        cargarTestsRespondidos().then(() => {
            activarPestana(tabRespondidos, vistaRespondidos);
            renderTablaRespondidos(idCuestionario);
        });
    };

    window.verDetalleRespuestas = async function (respId) {
        let r = estado.testsRespondidos.find(item => Number(idRespondido(item)) === Number(respId));
        try {
            const detalle = await TestService.obtenerTestRespondidoPorId(respId);
            if (detalle) r = detalle;
        } catch (error) {
            Notif.error(mensajeErrorAmigable(error), 'No se pudo cargar las respuestas');
            return;
        }
        if (!r) return;

        const cuestionario = estado.cuestionarios.find(c => Number(idCuestionario(c)) === Number(r?.cuestionario?.idCuestionario ?? r?.cuestionarioId));
        const tituloEl = el('tituloModalRespuestas');
        const cuerpoEl = el('cuerpoModalRespuestas');

        if (tituloEl) tituloEl.textContent = `Respuestas de: ${nombreEstudianteDe(r)}`;
        if (cuerpoEl) {
            let html = `
                <div class="p-3 bg-light rounded-3 mb-3 border">
                    <div class="fw-bold text-dark">${escapeHTML(nombreCuestionario(cuestionario))}</div>
                    <div class="small text-muted">Estudiante: <strong>${escapeHTML(nombreEstudianteDe(r))}</strong>${gradoDe(r) ? ` (${escapeHTML(gradoDe(r))})` : ''} &bull; Fecha: ${escapeHTML(fechaResolucionDe(r))}</div>
                </div>
                <h6 class="fw-bold mb-3">Detalle de Respuestas Registradas</h6>
                <div class="list-group">
            `;

            respuestasDe(r).forEach((resp, idx) => {
                html += `
                    <div class="list-group-item p-3 mb-2 rounded-3 border">
                        <div class="fw-bold text-primary mb-1">P${idx + 1}: ${escapeHTML(textoPreguntaRespuesta(resp))}</div>
                        <div class="p-2 bg-white rounded border text-dark fw-medium">
                            <i class="bi bi-chat-right-quote text-muted me-1"></i>${escapeHTML(textoRespuesta(resp))}
                        </div>
                    </div>
                `;
            });

            html += `</div>`;
            cuerpoEl.innerHTML = html;
        }

        const modal = new bootstrap.Modal(el('modalRespuestas'));
        modal.show();
    };


    function renderTablaSinResponder(filtroCuestionarioId = null) {
        const tbody = el('tablaSinResponderBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        let pendientes = [];

        if (estado.estudiantes.length > 0 && estado.respondidosCargados) {
            estado.cuestionarios.forEach(c => {
                const idC = Number(idCuestionario(c));
                const respondieron = new Set(
                    estado.testsRespondidos
                        .filter(r => Number(r?.cuestionario?.idCuestionario ?? r?.cuestionarioId) === idC)
                        .map(r => Number(idEstudianteDe(r?.estudiante ?? r?.alumno)))
                );
                estado.estudiantes.forEach(est => {
                    if (!respondieron.has(Number(idEstudianteDe(est)))) {
                        pendientes.push({
                            estudiante: `${est?.nombres ?? ''} ${est?.apellidos ?? ''}`.trim() || 'Estudiante',
                            carnet: est?.codigoCarnet ?? '',
                            grado: est?.grado?.nombreGrado ?? '',
                            seccion: est?.seccion?.nombreSeccion ?? '',
                            test: nombreCuestionario(c)
                        });
                    }
                });
            });
        } else {
            estado.cuestionarios.forEach(c => {
                const idC = Number(idCuestionario(c));
                const hayRespuestas = estado.respondidosCargados && estado.testsRespondidos.some(r =>
                    Number(r?.cuestionario?.idCuestionario ?? r?.cuestionarioId) === idC
                );
                if (!hayRespuestas) {
                    pendientes.push({
                        estudiante: 'Sin asignaciones registradas',
                        carnet: '',
                        grado: '',
                        seccion: '',
                        test: nombreCuestionario(c)
                    });
                }
            });
        }

        if (filtroCuestionarioId !== null) {
            pendientes = pendientes.filter(p => Number(p.idCuestionario ?? p.testId) === Number(filtroCuestionarioId) || p.test === nombreCuestionario(
                estado.cuestionarios.find(c => Number(idCuestionario(c)) === Number(filtroCuestionarioId))
            ));
        }

        if (pendientes.length === 0) {
            mostrarFilaVacia(tbody, 4, 'No hay estudiantes pendientes. Todos los cuestionarios han sido resueltos.');
            return;
        }

        pendientes.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div class="fw-bold text-dark">${escapeHTML(p.estudiante)}</div>
                    <small class="text-muted">${p.carnet ? `Carnet: <strong>${escapeHTML(p.carnet)}</strong> &bull; ` : ''}${escapeHTML(p.grado)}${p.seccion ? ` "${escapeHTML(p.seccion)}"` : ''}</small>
                </td>
                <td><span class="fw-semibold text-dark">${escapeHTML(p.test)}</span></td>
                <td><span class="badge bg-warning text-dark"><i class="bi bi-clock me-1"></i>Pendiente</span></td>
                <td class="text-center">
                    <button class="btn btn-sm btn-primary" onclick="recordarEstudiante('${escapeHTML(p.estudiante).replace(/'/g, "\\'")}')">
                        <i class="bi bi-send-fill me-1"></i>Recordar
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Badge "Sin Responder" del catálogo
    window.verSinResponderTest = function (idCuestionario) {
        cargarTestsRespondidos()
            .then(cargarEstudiantes)
            .then(() => {
                activarPestana(tabSinResponder, vistaSinResponder);
                renderTablaSinResponder(idCuestionario);
            });
    };

    // Notificación de recordatorio (SweetAlert2)
    window.recordarEstudiante = function (nombreEstudiante) {
        Notif.informar(
            `Se ha enviado el recordatorio de resolución del cuestionario a ${nombreEstudiante} mediante el módulo de notificaciones.`
        );
    };

    // ================= ERRORES =================

    function mensajeErrorAmigable(error) {
        const texto = String(error?.message ?? '').toUpperCase();

        if (error?.status === 400) {
            return `Revise los datos enviados: ${error.message}`;
        }
        if (error?.status === 404) {
            return 'El registro solicitado no fue encontrado. Puede que ya haya sido eliminado.';
        }
        if (error?.status === 500) {
            return 'Ocurrió un error interno en el servidor. Inténtelo de nuevo más tarde.';
        }
        if (error instanceof TypeError || !error?.status) {
            return `No se pudo conectar con el servidor. Verifique que el backend esté activo en ${API_BASE_URL}.`;
        }
        return error.message || 'Ocurrió un error inesperado.';
    }

    // ================= INICIALIZACIÓN =================

    // Carga inicial mínima: solo el catálogo de cuestionarios (GET /cuestionarios)
    cargarCatalogo();
    cargarPsicologos();

    // Menú hamburguesa móvil
    const hamburgerBtn = el('hamburgerBtn');
    const sidebar = document.querySelector('.sidebar');
    const overlay = el('sidebarOverlay');

    if (hamburgerBtn && sidebar && overlay) {
        hamburgerBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            overlay.classList.toggle('active');
            hamburgerBtn.innerHTML = sidebar.classList.contains('open') ? '<i class="bi bi-x"></i>' : '<i class="bi bi-list"></i>';
        });

        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
            hamburgerBtn.innerHTML = '<i class="bi bi-list"></i>';
        });
    }
});