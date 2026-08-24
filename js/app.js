// js/app.js
import { auth, db, verificarSesion } from "./auth.js";
import { collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc, setDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Verificación de seguridad
verificarSesion();

let solicitudesLocales = [];
let solicitudesHistorialLocales = [];
let idEdicionActual = null;
let idCambioEstadoActual = null;
let idComentariosActual = null;
let catalogos = {
    productos: [],
    asesores: []
};

// Variable de entorno regional
let plantaActiva = localStorage.getItem('corex_planta_activa') || '700_CIUDAD_DE_MEXICO';

// Estados predeterminados permitidos para cierre
const estadosCierrePredeterminados = ['Completo', 'Duplicado', 'Eliminado'];

// Función para traducir estados de Firebase a visualización del usuario
function obtenerEstadoVisual(estadoFirebase) {
    const mapeo = {
        'Recibido': 'En curso',
        'Correccion': 'Corrección',
        'Completo': 'Completo',
        'Duplicado': 'Duplicado',
        'Eliminado': 'Eliminado'
    };
    return mapeo[estadoFirebase] || estadoFirebase || 'En curso';
}

// Inicialización de la App
function iniciarApp() {
    const selectPlanta = document.getElementById("select-planta-activa");
    if (selectPlanta) {
        selectPlanta.value = plantaActiva;
        selectPlanta.addEventListener("change", (e) => {
            plantaActiva = e.target.value;
            localStorage.setItem('corex_planta_activa', plantaActiva);
            location.reload(); 
        });
    }

    // 1. Cargar Productos Globales
    onSnapshot(doc(db, "configuracion", "catalogos"), (docSnap) => {
        if (docSnap.exists()) {
            catalogos.productos = docSnap.data().productos || [];
        } else {
            setDoc(doc(db, "configuracion", "catalogos"), { productos: catalogos.productos });
        }
        actualizarSelectsYPaneles();
    });

    // 2. Escuchar cambios de autenticación
    onAuthStateChanged(auth, (user) => {
        if (user) {
            const colRef = collection(db, "clientes", user.uid, "plantas_corex", plantaActiva, "solicitudes");
            const consultaOrdenada = query(colRef, orderBy("timestamp", "asc"));
            
            onSnapshot(consultaOrdenada, (snapshot) => {
                solicitudesLocales = [];
                solicitudesHistorialLocales = [];
                snapshot.forEach((docSnap) => {
                    const data = { id: docSnap.id, ...docSnap.data() };
                    // Si el estado es distinto de "Recibido" y "Correccion", va al historial
                    if (data.estado && data.estado !== "Recibido" && data.estado !== "Correccion") {
                        solicitudesHistorialLocales.push(data);
                    } else {
                        solicitudesLocales.push(data);
                    }
                });
                pintarTabla();
                pintarTablaHistorial();
            });

            onSnapshot(doc(db, "plantas_corex", plantaActiva, "configuracion", "asesores"), (docSnap) => {
                catalogos.asesores = docSnap.exists() ? (docSnap.data().lista || []) : [];
                actualizarSelectsYPaneles();
            });
        }
    });
}

// Iniciar aplicación automáticamente
iniciarApp();

function pintarTabla() {
    const cuerpo = document.getElementById("tablaCuerpo");
    if (!cuerpo) return;
    
    cuerpo.innerHTML = ""; 

    if (solicitudesLocales.length === 0) {
        cuerpo.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-gray-400"><i class="fa-solid fa-share-nodes text-2xl block mb-2 text-gray-300"></i>No hay enlaces registrados en el radar.</td></tr>`;
        return;
    }

    solicitudesLocales.forEach((sol, index) => {
        const fila = document.createElement("tr");
        fila.className = "hover:bg-indigo-50/60 transition cursor-pointer font-medium text-gray-700 text-xs sm:text-sm";
        fila.onclick = () => window.abrirModalEditar(sol.id);
        
        const prodMostrar = sol.producto ? sol.producto : "-";
        const asesorMostrar = sol.asesor ? sol.asesor : "-";
        const estadoVisual = obtenerEstadoVisual(sol.estado);
        const colorEstado = "bg-amber-100 text-amber-700";
        const iconoEstado = "fa-clock";

        fila.innerHTML = `
            <td class="px-4 py-4 text-center font-bold text-gray-400" onclick="event.stopPropagation();">${index + 1}</td>
            <td class="px-4 py-4 text-center" onclick="event.stopPropagation();">
                <a href="${sol.link}" target="_blank" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 p-2 rounded-lg inline-flex items-center justify-center transition border border-indigo-200" title="Abrir enlace en Microsoft">
                    <i class="fa-solid fa-arrow-up-right-from-square text-sm"></i>
                </a>
            </td>
            <td class="px-6 py-4 font-semibold text-gray-900">${sol.tipo}</td>
            <td class="px-6 py-4 text-indigo-950 font-medium">${prodMostrar}</td>
            <td class="px-6 py-4 text-emerald-950 font-medium">${asesorMostrar}</td>
            <td class="px-4 py-4 text-gray-500">${sol.fecha}</td>
            <td class="px-4 py-4 text-gray-400">${sol.hora}</td>
            <td class="px-6 py-4">
                <span class="px-3 py-1 rounded-full text-xs font-bold ${colorEstado}">
                    <i class="fa-solid ${iconoEstado} mr-1"></i> ${estadoVisual}
                </span>
            </td>
            <td class="px-4 py-4 text-center" onclick="event.stopPropagation();">
                <button onclick="window.abrirModalEstado('${sol.id}')" class="text-indigo-500 hover:text-indigo-700 p-2 rounded-lg hover:bg-indigo-50 transition" title="Actualizar Estado (Cerrar solicitud)">
                    <i class="fa-solid fa-circle-check text-base"></i>
                </button>
            </td>
        `;
        cuerpo.appendChild(fila);
    });
}

function pintarTablaHistorial() {
    const cuerpoHistorial = document.getElementById("tablaCuerpoHistorial");
    if (!cuerpoHistorial) return;

    cuerpoHistorial.innerHTML = "";

    if (solicitudesHistorialLocales.length === 0) {
        cuerpoHistorial.innerHTML = `<tr><td colspan="12" class="text-center py-8 text-gray-400"><i class="fa-solid fa-box-archive text-2xl block mb-2 text-gray-300"></i>No hay solicitudes en el historial.</td></tr>`;
        return;
    }

    solicitudesHistorialLocales.forEach((sol, index) => {
        const fila = document.createElement("tr");
        fila.className = "hover:bg-gray-50 transition text-xs sm:text-sm text-gray-600";

        const prodMostrar = sol.producto ? sol.producto : "-";
        const asesorMostrar = sol.asesor ? sol.asesor : "-";
        const estadoVisual = obtenerEstadoVisual(sol.estado);
        const fechaCierre = sol.fechaCierre || "-";
        const horaCierre = sol.horaCierre || "-";
        
        // Botón condicional para notas/comentarios
        let botonNotasHtml = `<span class="text-gray-300">-</span>`;
        if (sol.comentarios && sol.comentarios.trim() !== "") {
            botonNotasHtml = `
                <button onclick="window.abrirModalComentarios('${sol.id}')" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 p-1.5 rounded-lg inline-flex items-center justify-center transition border border-indigo-200" title="Ver / Editar Comentarios">
                    <i class="fa-solid fa-comment-dots text-sm"></i>
                </button>
            `;
        }

        fila.innerHTML = `
            <td class="px-4 py-3 text-center font-bold text-gray-400">${index + 1}</td>
            <td class="px-4 py-3 text-center">
                <a href="${sol.link}" target="_blank" class="bg-gray-100 hover:bg-gray-200 text-indigo-600 p-1.5 rounded-lg inline-flex items-center justify-center transition border border-gray-200" title="Abrir enlace">
                    <i class="fa-solid fa-arrow-up-right-from-square text-xs"></i>
                </a>
            </td>
            <td class="px-6 py-3 font-semibold text-gray-800">${sol.tipo}</td>
            <td class="px-6 py-3 text-gray-700">${prodMostrar}</td>
            <td class="px-6 py-3 text-gray-700">${asesorMostrar}</td>
            <td class="px-4 py-3 text-gray-500">${sol.fecha}</td>
            <td class="px-4 py-3 text-gray-400">${sol.hora}</td>
            <td class="px-4 py-3 text-gray-500">${fechaCierre}</td>
            <td class="px-4 py-3 text-gray-400">${horaCierre}</td>
            <td class="px-6 py-3 font-semibold text-indigo-700">${estadoVisual}</td>
            <td class="px-4 py-3 text-center">${botonNotasHtml}</td>
            <td class="px-4 py-3 text-center flex justify-center space-x-2">
                <button onclick="window.cambiarEstadoSolicitud('${sol.id}', 'Recibido')" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-2.5 py-1 rounded text-xs font-medium transition" title="Reactivar pendiente">
                    <i class="fa-solid fa-rotate-left mr-1"></i> Reactivar
                </button>
                <button onclick="window.eliminarSolicitudPermanente('${sol.id}')" class="text-red-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 transition" title="Eliminar definitivo">
                    <i class="fa-solid fa-trash-can text-xs"></i>
                </button>
            </td>
        `;
        cuerpoHistorial.appendChild(fila);
    });
}

function actualizarSelectsYPaneles() {
    const selectProd = document.getElementById("selectProducto");
    const selectAses = document.getElementById("selectAsesor");
    const crudProd = document.getElementById("listaProductosCrud");
    const crudAses = document.getElementById("listaAsesoresCrud");
    const selectNuevoEstado = document.getElementById("selectNuevoEstado");

    if (!selectProd || !selectAses || !crudProd || !crudAses || !selectNuevoEstado) {
        setTimeout(actualizarSelectsYPaneles, 500); 
        return;
    }

    selectProd.innerHTML = `<option value="">-- Ninguno --</option>` + 
        catalogos.productos.map(p => `<option value="${p}">${p}</option>`).join('') + 
        `<option value="Otro">Otro (Manual)</option>`;

    selectAses.innerHTML = `<option value="">-- Ninguno --</option>` + 
        catalogos.asesores.map(a => `<option value="${a}">${a}</option>`).join('');

    let htmlEstados = estadosCierrePredeterminados.map(e => `<option value="${e}">${e}</option>`).join('');
    if (catalogos.estadosCierre) {
        catalogos.estadosCierre.forEach(e => {
            if (!estadosCierrePredeterminados.includes(e)) {
                htmlEstados += `<option value="${e}">${e}</option>`;
            }
        });
    }
    htmlEstados += `<option value="Otro">Otro</option>`;
    selectNuevoEstado.innerHTML = htmlEstados;

    crudProd.innerHTML = catalogos.productos.map(p => 
        `<span class="inline-flex items-center bg-gray-200 text-gray-800 text-[11px] font-medium px-2 py-0.5 rounded shadow-sm">${p}<button onclick="window.eliminarItemCatalogo('productos', '${p}')" class="text-red-500 hover:text-red-700 ml-1 font-bold">×</button></span>`
    ).join('');

    crudAses.innerHTML = catalogos.asesores.map(a => 
        `<span class="inline-flex items-center bg-gray-200 text-gray-800 text-[11px] font-medium px-2 py-0.5 rounded shadow-sm">${a}<button onclick="window.eliminarItemCatalogo('asesores', '${a}')" class="text-red-500 hover:text-red-700 ml-1 font-bold">×</button></span>`
    ).join('');
}

// --- FUNCIONES DE MODALES E HISTORIAL ---
window.abrirModalHistorial = () => {
    const modal = document.getElementById('modalHistorial');
    if (modal) modal.classList.remove('hidden');
};

window.cerrarModalHistorial = () => {
    const modal = document.getElementById('modalHistorial');
    if (modal) modal.classList.add('hidden');
};

window.abrirModalEstado = (id) => {
    idCambioEstadoActual = id;
    const modal = document.getElementById('modalEstado');
    const selectEstado = document.getElementById('selectNuevoEstado');
    const inputOtroEstado = document.getElementById('inputOtroEstado');
    const contOtroEstado = document.getElementById('contenedorOtroEstado');
    const inputComentarios = document.getElementById('inputComentariosCierre');

    if (selectEstado) selectEstado.value = "Completo";
    if (inputOtroEstado) inputOtroEstado.value = "";
    if (contOtroEstado) contOtroEstado.classList.add("hidden");
    if (inputComentarios) inputComentarios.value = "";

    if (modal) modal.classList.remove('hidden');
};

window.cerrarModalEstado = () => {
    const modal = document.getElementById('modalEstado');
    if (modal) modal.classList.add('hidden');
    idCambioEstadoActual = null;
};

window.controlarCampoOtroEstado = () => {
    const sel = document.getElementById("selectNuevoEstado");
    const cont = document.getElementById("contenedorOtroEstado");
    if (!sel || !cont) return;
    if (sel.value === "Otro") cont.classList.remove("hidden");
    else cont.classList.add("hidden");
};

window.guardarNuevoEstado = async () => {
    if (!idCambioEstadoActual) return;
    const selectEstado = document.getElementById("selectNuevoEstado");
    let nuevoEstado = selectEstado.value;

    if (nuevoEstado === "Otro") {
        const inputOtro = document.getElementById("inputOtroEstado");
        nuevoEstado = inputOtro ? inputOtro.value.trim() : "";
        if (!nuevoEstado) return alert("Por favor, escribe el nombre del estado.");

        if (!catalogos.estadosCierre) catalogos.estadosCierre = [];
        if (!catalogos.estadosCierre.includes(nuevoEstado) && !estadosCierrePredeterminados.includes(nuevoEstado)) {
            catalogos.estadosCierre.push(nuevoEstado);
            catalogos.estadosCierre.sort();
        }
    }

    const comentariosInput = document.getElementById("inputComentariosCierre");
    const comentarios = comentariosInput ? comentariosInput.value.trim() : "";

    await window.cambiarEstadoSolicitud(idCambioEstadoActual, nuevoEstado, comentarios);
    window.cerrarModalEstado();
};

window.cambiarEstadoSolicitud = async (id, nuevoEstado, comentarios = null) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
        const datosActualizacion = { estado: nuevoEstado };
        
        // Si se cierra con un estado final, registramos fecha y hora de cierre
        if (nuevoEstado !== "Recibido" && nuevoEstado !== "Correccion") {
            datosActualizacion.fechaCierre = new Date().toLocaleDateString();
            datosActualizacion.horaCierre = new Date().toLocaleTimeString();
            if (comentarios !== null) {
                datosActualizacion.comentarios = comentarios;
            }
        } else {
            // Si se reactiva, limpiamos datos de cierre y comentarios
            datosActualizacion.fechaCierre = null;
            datosActualizacion.horaCierre = null;
            datosActualizacion.comentarios = "";
        }

        await updateDoc(doc(db, "clientes", user.uid, "plantas_corex", plantaActiva, "solicitudes", id), datosActualizacion);
    } catch (error) {
        console.error("Error al actualizar el estado:", error);
    }
};

// --- GESTIÓN DE MODAL DE COMENTARIOS ---
window.abrirModalComentarios = (id) => {
    const sol = solicitudesHistorialLocales.find(item => item.id === id);
    if (!sol) return;
    idComentariosActual = id;

    const inputEdicion = document.getElementById("inputComentariosEdicion");
    if (inputEdicion) inputEdicion.value = sol.comentarios || "";

    const modal = document.getElementById("modalComentarios");
    if (modal) modal.classList.remove("hidden");
};

window.cerrarModalComentarios = () => {
    const modal = document.getElementById("modalComentarios");
    if (modal) modal.classList.add("hidden");
    idComentariosActual = null;
};

window.guardarComentariosEdicion = async () => {
    if (!idComentariosActual) return;
    const user = auth.currentUser;
    if (!user) return;

    const inputEdicion = document.getElementById("inputComentariosEdicion");
    const nuevosComentarios = inputEdicion ? inputEdicion.value.trim() : "";

    try {
        await updateDoc(doc(db, "clientes", user.uid, "plantas_corex", plantaActiva, "solicitudes", idComentariosActual), {
            comentarios: nuevosComentarios
        });
        window.cerrarModalComentarios();
    } catch (error) {
        console.error("Error al actualizar los comentarios:", error);
    }
};

window.eliminarSolicitudPermanente = async (id) => {
    const user = auth.currentUser;
    if (!user) return;
    if (confirm("¿Deseas eliminar definitivamente este registro del historial?")) {
        await deleteDoc(doc(db, "clientes", user.uid, "plantas_corex", plantaActiva, "solicitudes", id));
    }
};

// --- RESTO DE FUNCIONES WINDOW ---
window.agregarItemCatalogo = async (tipo, idInput) => {
    const input = document.getElementById(idInput);
    if (!input) return;
    const valor = input.value.trim();
    if (!valor) return;

    if (tipo === 'productos') {
        if (catalogos.productos.includes(valor)) return alert("Este elemento ya existe.");
        catalogos.productos.push(valor);
        catalogos.productos.sort();
        await setDoc(doc(db, "configuracion", "catalogos"), { productos: catalogos.productos });
    } else {
        if (catalogos.asesores.includes(valor)) return alert("Este elemento ya existe.");
        catalogos.asesores.push(valor);
        catalogos.asesores.sort();
        await setDoc(doc(db, "plantas_corex", plantaActiva, "configuracion", "asesores"), { lista: catalogos.asesores });
    }
    input.value = "";
};

window.eliminarItemCatalogo = async (tipo, valor) => {
    if (confirm(`¿Quitar "${valor}" de la lista?`)) {
        if (tipo === 'productos') {
            catalogos.productos = catalogos.productos.filter(item => item !== valor);
            await setDoc(doc(db, "configuracion", "catalogos"), { productos: catalogos.productos });
        } else {
            catalogos.asesores = catalogos.asesores.filter(item => item !== valor);
            await setDoc(doc(db, "plantas_corex", plantaActiva, "configuracion", "asesores"), { lista: catalogos.asesores });
        }
    }
};

window.togglePanelListas = () => {
    const p = document.getElementById("panelListas");
    if(p) p.classList.toggle("hidden");
};

window.abrirModalNuevo = () => {
    idEdicionActual = null;
    const modal = document.getElementById('modalAgregar');
    const titulo = document.getElementById('modalTitulo');
    if (titulo) titulo.innerText = "Registrar nuevo pendiente";
    
    const fields = ['inputLink', 'selectTipo', 'selectProducto', 'selectAsesor', 'inputOtro'];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    
    const contOtro = document.getElementById('contenedorOtro');
    if (contOtro) contOtro.classList.add('hidden');
    
    if (modal) modal.classList.remove('hidden');
    setTimeout(() => { 
        const link = document.getElementById('inputLink');
        if (link) link.focus(); 
    }, 50);
};

window.abrirModalEditar = (id) => {
    const sol = solicitudesLocales.find(item => item.id === id);
    if (!sol) return;
    idEdicionActual = id;
    
    const titulo = document.getElementById('modalTitulo');
    if (titulo) titulo.innerText = "Editar Solicitud Múltiple";
    
    document.getElementById('inputLink').value = sol.link;
    document.getElementById('selectTipo').value = sol.tipo;
    document.getElementById('selectAsesor').value = sol.asesor || '';
    
    const selProd = document.getElementById('selectProducto');
    const contOtro = document.getElementById('contenedorOtro');
    
    if (!sol.producto) {
        selProd.value = '';
        contOtro.classList.add('hidden');
    } else if (catalogos.productos.includes(sol.producto)) {
        selProd.value = sol.producto;
        contOtro.classList.add('hidden');
    } else {
        selProd.value = 'Otro';
        document.getElementById('inputOtro').value = sol.producto;
        contOtro.classList.remove('hidden');
    }
    document.getElementById('modalAgregar').classList.remove('hidden');
};

window.cerrarModal = () => {
    const modal = document.getElementById('modalAgregar');
    if (modal) modal.classList.add('hidden');
    idEdicionActual = null;
};

window.controlarCampoOtro = () => {
    const sel = document.getElementById("selectProducto");
    const cont = document.getElementById("contenedorOtro");
    if (!sel || !cont) return;
    if (sel.value === "Otro") cont.classList.remove("hidden");
    else cont.classList.add("hidden");
};

window.evaluarEnter = (e) => { if (e.key === "Enter") { e.preventDefault(); window.procesarFormulario(); } };

window.procesarFormulario = async () => {
    const link = document.getElementById("inputLink").value.trim();
    if (!link) return alert("Por favor, pega un enlace válido.");
    
    const tipo = document.getElementById("selectTipo").value;
    const asesor = document.getElementById("selectAsesor").value;
    let producto = document.getElementById("selectProducto").value;
    if (producto === "Otro") producto = document.getElementById("inputOtro").value.trim() || "Otro";

    const user = auth.currentUser;
    const colRef = collection(db, "clientes", user.uid, "plantas_corex", plantaActiva, "solicitudes");

    if (!idEdicionActual) {
        const duplicado = solicitudesLocales.find(item => item.link === link);
        if (duplicado) {
            if (confirm(`⚠️ Registro Duplicado!\n¿Editar el existente?`)) window.abrirModalEditar(duplicado.id);
            return;
        }
        await addDoc(colRef, { link, tipo, producto, asesor, estado: "Recibido", fecha: new Date().toLocaleDateString(), hora: new Date().toLocaleTimeString(), timestamp: Date.now() });
    } else {
        await updateDoc(doc(db, "clientes", user.uid, "plantas_corex", plantaActiva, "solicitudes", idEdicionActual), { link, tipo, producto, asesor });
    }
    window.cerrarModal();
};