// js/auth.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyDZfrbg0EQURvv9Mr1VlSXh5yB2aG9X270",
    authDomain: "solicitud-vr.firebaseapp.com",
    projectId: "solicitud-vr",
    storageBucket: "solicitud-vr.firebasestorage.app",
    messagingSenderId: "53227967905",
    appId: "1:53227967905:web:109022b7d559dfeefa67e0"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

const UNIVERSAL_FIREBASE_PASS = "ACCESO_UNIVERSAL_2026";

// REGISTRO
export async function registrarUsuario(email, password, pin) {
    if (!email.endsWith("@fanosa.com")) {
        throw new Error("El correo no pertenece a la organización.");
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, UNIVERSAL_FIREBASE_PASS);
        
        await setDoc(doc(db, "clientes", userCredential.user.uid), {
            email: email,
            cedula: password, 
            folio: pin 
        });
        return userCredential.user;
        
    } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
            throw new Error("El correo ya está en uso");
        }
        throw new Error(error.message);
    }
}

// LOGIN
export async function iniciarSesion(email, password, pin = null) {
    // 1. Firebase Auth como llave de acceso universal
    const userCredential = await signInWithEmailAndPassword(auth, email, UNIVERSAL_FIREBASE_PASS);
    
    // 2. Buscamos en 'clientes' para validar credenciales
    const userDoc = await getDoc(doc(db, "clientes", userCredential.user.uid));
    
    if (!userDoc.exists()) {
        await signOut(auth);
        throw new Error("Cliente no encontrado en base de datos.");
    }

    const data = userDoc.data();
    
    // 3. Validación lógica
    const esValido = pin ? (String(data.folio) === String(pin)) : (String(data.cedula) === String(password));
    
    if (!esValido) {
        await signOut(auth);
        throw new Error("Credencial incorrecta.");
    }
    return userCredential.user;
}

export function verificarSesion(redireccionLogin = true) {
    onAuthStateChanged(auth, (user) => {
        if (!user && redireccionLogin) window.location.href = "login.html";
    });
}

export async function cerrarSesion() {
    await signOut(auth);
    window.location.href = "login.html";
}