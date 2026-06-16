import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc, setDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDZfrbg0EQURvv9Mr1VlSXh5yB2aG9X270",
  authDomain: "solicitud-vr.firebaseapp.com",
  projectId: "solicitud-vr",
  storageBucket: "solicitud-vr.firebasestorage.app",
  messagingSenderId: "53227967905",
  appId: "1:53227967905:web:109022b7d559dfeefa67e0"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let solicitudesLocales = [];
let idEdicionActual = null; 

// Estructura de catálogos por defecto si Firebase está vacío
let catalogos = {
    productos: ["Placa", "Caseton", "Block", "Bovedilla", "Tira", "Cilindro", "Empaque cortado", "Cubierta para tuberia", "Steelfoam", "Insulpanel", "Construpanel"],
    asesores: ["Jessica", "Maria", "Ivan", "Carlos", "Miguel", "Alejandro", "Violeta", "Zuzury", "Briana"]
};

// 1. ESCUCHAR CATÁLOGOS EN TIEMPO REAL
onSnapshot(doc(db, "configuracion", "catalogos"), (docSnap) => {
    if (docSnap.exists()) {
        catalogos = docSnap.data();
    } else {
        // Si no existe el documento en Firebase, lo crea con los valores base iniciales
        setDoc(doc(db, "configuracion", "catalogos"), catalogos);
    }
    actualizarSelectsYPaneles();
});

// 2. ESCUCHAR SOLICITUDES EN TIEMPO REAL
const consultaOrdenada = query(collection(db, "solicitudes"), orderBy("timestamp", "asc"));
onSnapshot(consultaOrdenada, (snapshot) => {
    solicitudesLocales = [];
    snapshot.forEach((doc) => {
        solicitudesLocales.push({ id: doc.id, ...doc.data() });
    });
    pintarTabla();
});

function pintarTabla() {
    const cuerpo = document.getElementById("tablaCuerpo");
    cuerpo.innerHTML = ""; 

    if (solicitudesLocales.length === 0) {
        cuerpo.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-gray-400"><i class="fa-solid fa-share-nodes text-2xl block mb-2 text-gray-300"></i>No hay enlaces registrados en el radar.</td></tr>`;
        return;
    }

    solicitudesLocales.forEach((sol, index) => {
        const fila = document.createElement("tr");
        fila.className = "hover:bg-indigo-50/60 transition cursor-pointer font-medium text-gray-700 text-xs sm:text-sm";
        fila.onclick = () => window.abrirModalEditar(sol.id);
        
        const prodMostrar = sol.producto ? sol.producto : "-";
        const asesorMostrar = sol.asesor ? sol.asesor : "-";

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
            <td class="px-4 py-4 text-center" onclick="event.stopPropagation();">
                <button onclick="window.eliminarSolicitud('${sol.id}')" class="text-red-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
        `;
        cuerpo.appendChild(fila);
    });
}

// SINCRONIZAR LISTAS DESPLEGABLES Y PANEL DE CONFIGURACIÓN
function actualizarSelectsYPaneles() {
    const selectProd = document.getElementById("selectProducto");
    const selectAses = document.getElementById("selectAsesor");
    const crudProd = document.getElementById("listaProductosCrud");
    const crudAses = document.getElementById("listaAsesoresCrud");

    // Llenar select de productos
    selectProd.innerHTML = `<option value="">-- Ninguno --</option>`;
    catalogos.productos.forEach(p => selectProd.innerHTML += `<option value="${p}">${p}</option>`);
    selectProd.innerHTML += `<option value="Otro">Otro (Manual)</option>`;

    // Llenar select de asesores
    selectAses.innerHTML = `<option value="">-- Ninguno --</option>`;
    catalogos.asesores.forEach(a => selectAses.innerHTML += `<option value="${a}">${a}</option>`);

    // Llenar chips de edición (Configuración de Catálogos)
    crudProd.innerHTML = "";
    catalogos.productos.forEach(p => {
        crudProd.innerHTML += `<span class="inline-flex items-center bg-gray-200 text-gray-800 text-[11px] font-medium px-2 py-0.5 rounded shadow-sm">${p}<button onclick="window.eliminarItemCatalogo('productos', '${p}')" class="text-red-500 hover:text-red-700 ml-1 font-bold">×</button></span>`;
    });

    crudAses.innerHTML = "";
    catalogos.asesores.forEach(a => {
        crudAses.innerHTML += `<span class="inline-flex items-center bg-gray-200 text-gray-800 text-[11px] font-medium px-2 py-0.5 rounded shadow-sm">${a}<button onclick="window.eliminarItemCatalogo('asesores', '${a}')" class="text-red-500 hover:text-red-700 ml-1 font-bold">×</button></span>`;
    });
}

// CONTROL DE AGREGAR/ELIMINAR ELEMENTOS EN LOS CATÁLOGOS
window.agregarItemCatalogo = async (tipo, idInput) => {
    const input = document.getElementById(idInput);
    const valor = input.value.trim();
    if (!valor) return;

    if (catalogos[tipo].includes(valor)) return alert("Este elemento ya existe.");

    catalogos[tipo].push(valor);
    catalogos[tipo].sort(); // Mantener orden alfabético
    await setDoc(doc(db, "configuracion", "catalogos"), catalogos);
    input.value = "";
};

window.eliminarItemCatalogo = async (tipo, valor) => {
    if (confirm(`¿Quitar "${valor}" de la lista?`)) {
        catalogos[tipo] = catalogos[tipo].filter(item => item !== valor);
        await setDoc(doc(db, "configuracion", "catalogos"), catalogos);
    }
};

window.togglePanelListas = () => {
    document.getElementById("panelListas").classList.toggle("hidden");
};

// MODALES
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
        document.getElementById('inputOtro').value = '';
        document.getElementById('contenedorOtro').classList.add('hidden');
    } else {
        document.getElementById('selectProducto').value = 'Otro';
        document.getElementById('inputOtro').value = sol.producto;
        document.getElementById('contenedorOtro').classList.remove('hidden');
    }

    document.getElementById('modalAgregar').classList.remove('hidden');
    setTimeout(() => { document.getElementById('inputLink').focus(); }, 50);
};

window.cerrarModal = () => {
    document.getElementById('modalAgregar').classList.add('hidden');
    idEdicionActual = null;
};

window.controlarCampoOtro = () => {
    const valorSel = document.getElementById("selectProducto").value;
    const contenedor = document.getElementById("contenedorOtro");
    const inputOtro = document.getElementById("inputOtro");

    if (valorSel === "Otro") {
        contenedor.classList.remove("hidden");
        setTimeout(() => { inputOtro.focus(); }, 50);
    } else {
        contenedor.classList.add("hidden");
        inputOtro.value = "";
    }
};

window.evaluarEnter = (evento) => {
    if (evento.key === "Enter") {
        evento.preventDefault();
        window.procesarFormulario();
    }
};

window.procesarFormulario = async () => {
    const link = document.getElementById("inputLink").value.trim();
    if (!link) return alert("Por favor, pega un enlace válido.");

    const tipo = document.getElementById("selectTipo").value;
    const asesor = document.getElementById("selectAsesor").value;
    let producto = document.getElementById("selectProducto").value;

    if (producto === "Otro") {
        producto = document.getElementById("inputOtro").value.trim();
        if (!producto) producto = "Otro";
    }

    if (!idEdicionActual) {
        const duplicado = solicitudesLocales.find(item => item.link === link);
        if (duplicado) {
            const respuesta = confirm(`⚠️ ¡Registro Duplicado!\n\nEste enlace ya existe bajo la categoría: "${duplicado.tipo} - ${duplicado.producto || 'Sin Producto'}".\n\n¿Quieres abrir la ficha existente para editarla?`);
            if (respuesta) window.abrirModalEditar(duplicado.id);
            return; 
        }
    }

    if (idEdicionActual) {
        try {
            await updateDoc(doc(db, "solicitudes", idEdicionActual), {
                link: link,
                tipo: tipo,
                producto: producto,
                asesor: asesor
            });
            window.cerrarModal();
        } catch (error) { console.error(error); }
    } else {
        const ahora = new Date();
        const fecha = ahora.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
        const hora = aunque = ahora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });

        try {
            await addDoc(collection(db, "solicitudes"), {
                link: link,
                tipo: tipo,
                producto: producto,
                asesor: asesor,
                fecha: fecha,
                hora: hora,
                timestamp: Date.now()
            });
            window.cerrarModal();
        } catch (error) { console.error(error); }
    }
};

window.eliminarSolicitud = async (id) => {
    if (confirm("¿Deseas quitar este enlace de la lista?")) {
        try { await deleteDoc(doc(db, "solicitudes", id)); } catch (error) { console.error(error); }
    }
};