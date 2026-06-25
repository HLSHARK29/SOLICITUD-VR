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

// Inicialización de la App
function iniciarApp() {
    const selectPlanta = document.getElementById("select-planta-activa");
    selectPlanta.value = plantaActiva;

    // Listener del selector de planta en el header
    selectPlanta.addEventListener("change", (e) => {
        plantaActiva = e.target.value;
        localStorage.setItem('corex_planta_activa', plantaActiva);
        location.reload(); // Recarga para re-sincronizar los listeners con la nueva planta
    });

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
            // Cargar Solicitudes por USUARIO y por PLANTA
            const colRef = collection(db, "clientes", user.uid, "plantas_corex", plantaActiva, "solicitudes");
            const consultaOrdenada = query(colRef, orderBy("timestamp", "asc"));
            
            onSnapshot(consultaOrdenada, (snapshot) => {
                solicitudesLocales = [];
                snapshot.forEach((doc) => {
                    solicitudesLocales.push({ id: doc.id, ...doc.data() });
                });
                pintarTabla();
            });

            // Cargar Asesores por PLANTA (Compartidos)
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
        
        // Lógica de estado
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
                    <i class="fa-solid ${iconoEstado} mr-1"></i> ${sol.estado || 'En curso'}
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
    const selectProd = document.getElementById("selectProducto");
    const selectAses = document.getElementById("selectAsesor");
    const crudProd = document.getElementById("listaProductosCrud");
    const crudAses = document.getElementById("listaAsesoresCrud");

    selectProd.innerHTML = `<option value="">-- Ninguno --</option>`;
    catalogos.productos.forEach(p => selectProd.innerHTML += `<option value="${p}">${p}</option>`);
    selectProd.innerHTML += `<option value="Otro">Otro (Manual)</option>`;

    selectAses.innerHTML = `<option value="">-- Ninguno --</option>`;
    catalogos.asesores.forEach(a => selectAses.innerHTML += `<option value="${a}">${a}</option>`);

    crudProd.innerHTML = "";
    catalogos.productos.forEach(p => {
        crudProd.innerHTML += `<span class="inline-flex items-center bg-gray-200 text-gray-800 text-[11px] font-medium px-2 py-0.5 rounded shadow-sm">${p}<button onclick="window.eliminarItemCatalogo('productos', '${p}')" class="text-red-500 hover:text-red-700 ml-1 font-bold">×</button></span>`;
    });

    crudAses.innerHTML = "";
    catalogos.asesores.forEach(a => {
        crudAses.innerHTML += `<span class="inline-flex items-center bg-gray-200 text-gray-800 text-[11px] font-medium px-2 py-0.5 rounded shadow-sm">${a}<button onclick="window.eliminarItemCatalogo('asesores', '${a}')" class="text-red-500 hover:text-red-700 ml-1 font-bold">×</button></span>`;
    });
}

window.agregarItemCatalogo = async (tipo, idInput) => {
    const input = document.getElementById(idInput);
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

window.togglePanelListas = () => document.getElementById("panelListas").classList.toggle("hidden");

window.abrirModalNuevo = () => {
    idEdicionActual = null;
    document.getElementById('modalTitulo').innerText = "Registrar nuevo pendiente";
    document.getElementById('btnTextoGuardar').innerText = "Insertar al Radar";
    document.getElementById('btnIconoGuardar').className = "fa-solid fa-cloud-arrow-up";
    
    document.getElementById('inputLink').value = '';
    document.getElementById('selectTipo').value = 'Alta';
    document.getElementById('selectProducto').value = '';
    document.getElementById('selectAsesor').value = '';
    document.getElementById('inputOtro').value = '';
    document.getElementById('contenedorOtro').classList.add('hidden');
    document.getElementById('inputNuevoAsesorRapido').classList.add('hidden');
    
    document.getElementById('modalAgregar').classList.remove('hidden');
    setTimeout(() => { document.getElementById('inputLink').focus(); }, 50);
};

window.abrirModalEditar = (id) => {
    const sol = solicitudesLocales.find(item => item.id === id);
    if (!sol) return;
    idEdicionActual = id;
    document.getElementById('modalTitulo').innerText = "Editar Solicitud Múltiple";
    document.getElementById('btnTextoGuardar').innerText = "Actualizar Registro";
    document.getElementById('btnIconoGuardar').className = "fa-solid fa-pen-to-square";
    document.getElementById('inputLink').value = sol.link;
    document.getElementById('selectTipo').value = sol.tipo;
    document.getElementById('selectAsesor').value = sol.asesor || '';
    if (!sol.producto) {
        document.getElementById('selectProducto').value = '';
        document.getElementById('inputOtro').value = '';
        document.getElementById('contenedorOtro').classList.add('hidden');
    } else if (catalogos.productos.includes(sol.producto)) {
        document.getElementById('selectProducto').value = sol.producto;
    } else {
        document.getElementById('selectProducto').value = 'Otro';
        document.getElementById('inputOtro').value = sol.producto;
        document.getElementById('contenedorOtro').classList.remove('hidden');
    }
    document.getElementById('modalAgregar').classList.remove('hidden');
};

window.cerrarModal = () => {
    document.getElementById('modalAgregar').classList.add('hidden');
    idEdicionActual = null;
};

window.controlarCampoOtro = () => {
    const valorSel = document.getElementById("selectProducto").value;
    const contenedor = document.getElementById("contenedorOtro");
    if (valorSel === "Otro") {
        contenedor.classList.remove("hidden");
    } else {
        contenedor.classList.add("hidden");
    }
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
        await addDoc(colRef, { 
            link, 
            tipo, 
            producto, 
            asesor, 
            estado: "En curso", 
            fecha: new Date().toLocaleDateString(), 
            hora: new Date().toLocaleTimeString(), 
            timestamp: Date.now() 
        });
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
    const nuevoAsesor = input.value.trim();
    if (!nuevoAsesor || catalogos.asesores.includes(nuevoAsesor)) return;

    catalogos.asesores.push(nuevoAsesor);
    catalogos.asesores.sort();
    await setDoc(doc(db, "plantas_corex", plantaActiva, "configuracion", "asesores"), { lista: catalogos.asesores });
    
    input.value = "";
    document.getElementById('inputNuevoAsesorRapido').classList.add('hidden');
};