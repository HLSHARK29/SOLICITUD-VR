// js/app.js
import { auth, db, verificarSesion } from "./auth.js";
import { collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc, setDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Verificación de seguridad
verificarSesion();

let solicitudesLocales = [];
let idEdicionActual = null;
let catalogos = {
    productos: [],
    asesores: []
};

// Variable de entorno regional
let plantaActiva = localStorage.getItem('corex_planta_activa') || '700_CIUDAD_DE_MEXICO';

// Función para traducir estados de Firebase a visualización del usuario
function obtenerEstadoVisual(estadoFirebase) {
    const mapeo = {
        'Recibido': 'En curso',
        'Correccion': 'Corrección',
        'Completo': 'Completo'
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
                snapshot.forEach((doc) => {
                    solicitudesLocales.push({ id: doc.id, ...doc.data() });
                });
                pintarTabla();
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
        const esCompleto = sol.estado === "Completo";
        const colorEstado = esCompleto ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700";
        const iconoEstado = esCompleto ? "fa-check-circle" : "fa-clock";

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
                <button onclick="window.eliminarSolicitud('${sol.id}')" class="text-red-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
        `;
        cuerpo.appendChild(fila);
    });
}

function actualizarSelectsYPaneles() {
    // Intentamos obtener los elementos
    const selectProd = document.getElementById("selectProducto");
    const selectAses = document.getElementById("selectAsesor");
    const crudProd = document.getElementById("listaProductosCrud");
    const crudAses = document.getElementById("listaAsesoresCrud");

    // SI ALGUNO ES NULL, SALIMOS DE LA FUNCIÓN PARA EVITAR EL ERROR
    // Pero intentamos re-ejecutar en 500ms por si el DOM aún está cargando
    if (!selectProd || !selectAses || !crudProd || !crudAses) {
        console.log("DOM no listo, reintentando...");
        setTimeout(actualizarSelectsYPaneles, 500); 
        return;
    }

    // SI LLEGAMOS AQUÍ, ES QUE TODOS EXISTEN. Procedemos con seguridad:
    selectProd.innerHTML = `<option value="">-- Ninguno --</option>` + 
        catalogos.productos.map(p => `<option value="${p}">${p}</option>`).join('') + 
        `<option value="Otro">Otro (Manual)</option>`;

    selectAses.innerHTML = `<option value="">-- Ninguno --</option>` + 
        catalogos.asesores.map(a => `<option value="${a}">${a}</option>`).join('');

    crudProd.innerHTML = catalogos.productos.map(p => 
        `<span class="inline-flex items-center bg-gray-200 text-gray-800 text-[11px] font-medium px-2 py-0.5 rounded shadow-sm">${p}<button onclick="window.eliminarItemCatalogo('productos', '${p}')" class="text-red-500 hover:text-red-700 ml-1 font-bold">×</button></span>`
    ).join('');

    crudAses.innerHTML = catalogos.asesores.map(a => 
        `<span class="inline-flex items-center bg-gray-200 text-gray-800 text-[11px] font-medium px-2 py-0.5 rounded shadow-sm">${a}<button onclick="window.eliminarItemCatalogo('asesores', '${a}')" class="text-red-500 hover:text-red-700 ml-1 font-bold">×</button></span>`
    ).join('');
}

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
    
    const btnText = document.getElementById('btnTextoGuardar');
    if (btnText) btnText.innerText = "Insertar al Radar";
    
    const btnIcon = document.getElementById('btnIconoGuardar');
    if (btnIcon) btnIcon.className = "fa-solid fa-cloud-arrow-up";
    
    const fields = ['inputLink', 'selectTipo', 'selectProducto', 'selectAsesor', 'inputOtro'];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    
    const contOtro = document.getElementById('contenedorOtro');
    if (contOtro) contOtro.classList.add('hidden');
    
    const contAsesor = document.getElementById('inputNuevoAsesorRapido');
    if (contAsesor) contAsesor.classList.add('hidden');
    
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
    
    const btnText = document.getElementById('btnTextoGuardar');
    if (btnText) btnText.innerText = "Actualizar Registro";
    
    const btnIcon = document.getElementById('btnIconoGuardar');
    if (btnIcon) btnIcon.className = "fa-solid fa-pen-to-square";
    
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

window.eliminarSolicitud = async (id) => {
    const user = auth.currentUser;
    if (confirm("¿Deseas quitar este enlace?")) await deleteDoc(doc(db, "clientes", user.uid, "plantas_corex", plantaActiva, "solicitudes", id));
};

window.agregarAsesorRapido = async () => {
    const input = document.getElementById("valorNuevoAsesor");
    if (!input) return;
    const nuevoAsesor = input.value.trim();
    if (!nuevoAsesor || catalogos.asesores.includes(nuevoAsesor)) return;

    catalogos.asesores.push(nuevoAsesor);
    catalogos.asesores.sort();
    await setDoc(doc(db, "plantas_corex", plantaActiva, "configuracion", "asesores"), { lista: catalogos.asesores });
    
    input.value = "";
    const cont = document.getElementById('inputNuevoAsesorRapido');
    if (cont) cont.classList.add('hidden');
};