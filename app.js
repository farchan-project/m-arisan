import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
    collection, addDoc, onSnapshot, getDocs, query, where, serverTimestamp, doc, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDt8FQujsgheYoHEtvu23DPrr6QiO_2TfE",
  authDomain: "m-arisan-5e20a.firebaseapp.com",
  projectId: "m-arisan-5e20a",
  storageBucket: "m-arisan-5e20a.firebasestorage.app",
  messagingSenderId: "312996454769",
  appId: "1:312996454769:web:8f18118b2cb2e42a75d6d0"
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, { localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()}) });

const colPutaran = collection(db, "putaran"); const colPeserta = collection(db, "peserta"); 
const colTrans = collection(db, "transaksi"); const colPemenang = collection(db, "pemenang");

let dataPutaran = []; let dataPeserta = []; let dataTrans = []; let dataPemenang = [];
let currentUser = null; let currentWheelWinner = null; let currentWheelPutaranId = null;

// Global Helpers
const rupiah = (angka) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(angka);
const getRupiahVal = (str) => parseInt(str.replace(/[^,\d]/g, ''), 10) || 0;
const formatDate = (ts) => ts ? new Date(ts.toMillis ? ts.toMillis() : ts).toLocaleDateString('id-ID', {day:'2-digit', month:'short', year:'numeric'}) : 'Hari ini';
const getInputDateString = (ts) => { if(!ts) return ""; const d = new Date(ts.toMillis ? ts.toMillis() : ts); return d.toISOString().split('T')[0]; };

function getEmptyState(text) { return `<div class="empty-state"><div class="empty-box">📦</div><p>${text}</p></div>`; }
window.verifyPin = () => { return prompt("Masukkan PIN Otorisasi (farchan112):") === 'farchan112'; };

window.navTo = (screenId, title, menuId) => {
    document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.drawer-menu li').forEach(el => el.classList.remove('active-menu'));
    document.getElementById(screenId).classList.add('active');
    
    // Ganti App Title di Header
    document.querySelector('.app-title').innerHTML = `<img src="logo.png" class="app-logo" onerror="this.style.display='none'"> Cucu Cicit Ladarua`;
    
    if(menuId) document.getElementById(menuId).classList.add('active-menu');
    if(window.innerWidth < 768) { document.getElementById('drawer').classList.remove('open'); document.getElementById('drawer-overlay').style.display = 'none'; }
};

// ======================= AUDIO & CONFETTI =======================
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playTick() {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
    osc.type = 'triangle'; osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
    osc.connect(gain); gain.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + 0.05);
}
function playWinFestive() {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const notes = [523.25, 659.25, 783.99, 1046.50, 783.99, 1046.50];
    notes.forEach((freq, i) => { 
        setTimeout(() => {
            const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
            osc.type = 'square'; osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.15, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);
            osc.connect(gain); gain.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + 0.8);
        }, i * 120);
    });
}
function createConfetti() {
    for(let i=0; i<100; i++) {
        let conf = document.createElement('div'); conf.className = 'confetti';
        conf.style.left = Math.random() * 100 + 'vw'; conf.style.animationDelay = Math.random() * 2 + 's';
        conf.style.backgroundColor = ['#F59E0B', '#10B981', '#0D9488', '#EF4444', '#EC4899'][Math.floor(Math.random()*5)];
        document.body.appendChild(conf); setTimeout(() => conf.remove(), 4000);
    }
}

// ======================= AUTH (MENGGUNAKAN LOCALSTORAGE) =======================
function checkAuth() {
    // Ubah ke localStorage agar ingat perangkat
    currentUser = JSON.parse(localStorage.getItem("loggedUser"));
    if(!currentUser) { document.body.classList.add("is-logged-out"); return; }
    
    document.body.classList.remove("is-logged-out"); 
    document.getElementById("s-login").classList.remove("active");
    document.getElementById("user-name-drawer").innerText = currentUser.nama;
    
    if(currentUser.role === 'admin') {
        document.getElementById("menu-admin").style.display = "block"; 
        window.navTo('s-log', 'Buku Kas', 'm-log'); // Default Buka Buku Kas
        loadAdmin();
    } else {
        document.getElementById("menu-user").style.display = "block"; 
        window.navTo('s-user-dash', 'Beranda', 'u-dash'); 
        loadUser();
    }
}
checkAuth();

window.logout = () => { localStorage.removeItem("loggedUser"); window.location.reload(); }

document.getElementById("form-login").addEventListener("submit", async (e) => {
    e.preventDefault(); const telp = document.getElementById("login-telp").value; const pin = document.getElementById("login-pin").value;
    if(telp === 'admin' && pin === 'admin123') { localStorage.setItem("loggedUser", JSON.stringify({ role: 'admin', nama: 'Admin Ladarua' })); window.location.reload(); return; }
    const snap = await getDocs(query(colPeserta, where("telp", "==", telp), where("pin", "==", pin), where("statusAktif", "==", true)));
    if(!snap.empty) { const u = snap.docs[0].data(); localStorage.setItem("loggedUser", JSON.stringify({ role: 'user', nama: u.nama, telp: u.telp, id: snap.docs[0].id })); window.location.reload();
    } else alert("Username / PIN salah.");
});

// Pemenang Global Listener
onSnapshot(colPemenang, snap => {
    dataPemenang = snap.docs.map(d => ({id: d.id, ...d.data()}));
    if(dataPemenang.length > 0) {
        const win = dataPemenang.sort((a,b) => (b.timestamp?.toMillis()||0) - (a.timestamp?.toMillis()||0))[0];
        if(document.getElementById("u-info-pemenang")) document.getElementById("u-info-pemenang").innerText = `${win.nama} (Putaran ${win.urutan_putaran||''})`;
    } else {
        if(document.getElementById("u-info-pemenang")) document.getElementById("u-info-pemenang").innerText = "-";
    }
    if(currentUser && currentUser.role === 'admin') renderPutaran();
});

// ======================= ADMIN FULL CRUD LOGIC =======================
function loadAdmin() {
    onSnapshot(colPutaran, snap => {
        dataPutaran = snap.docs.map(d => ({id: d.id, ...d.data()})).sort((a,b) => (a.urutan || 0) - (b.urutan || 0));
        renderPutaran(); populatePutaranCS(); renderSetoranList();
    });

    onSnapshot(colPeserta, snap => {
        dataPeserta = snap.docs.map(d => ({id: d.id, ...d.data()})).filter(p => p.statusAktif === true);
        renderPesertaList(); populatePesertaCS(); renderSetoranList();
    });

    onSnapshot(colTrans, snap => {
        dataTrans = snap.docs.map(d => ({id: d.id, ...d.data()})).sort((a,b) => (b.timestamp?.toMillis()||0) - (a.timestamp?.toMillis()||0));
        renderSetoranList(); renderLogKas();
    });

    // --- 1. CRUD PUTARAN & UNDIAN DI DALAMNYA ---
    window.bukaModalPutaran = () => {
        document.getElementById("title-modal-putaran").innerText = "Tambah Putaran Baru";
        document.getElementById("form-putaran").reset(); document.getElementById("eput-id").value = "";
        document.getElementById("modal-putaran").style.display = "flex";
    };

    window.bukaDetailPutaran = (id) => {
        const p = dataPutaran.find(x => x.id === id); document.getElementById("det-putaran-id").value = id;
        document.getElementById("det-putaran-nama").innerText = p.nama; 
        
        // Cek Pemenang untuk putaran ini
        const pemenang = dataPemenang.find(w => w.id_putaran === id);
        const actionArea = document.getElementById("det-putaran-actions");
        
        if(pemenang) {
            actionArea.innerHTML = `
                <div style="background: #ECFDF5; padding: 20px; border-radius: 12px; border: 1px solid #10B981; text-align:center;">
                    <p style="margin:0 0 5px; color:#065F46; font-size:0.9rem;">Tuan Rumah / Pemenang:</p>
                    <h3 style="margin:0 0 15px; color:#047857; font-size:1.8rem;">${pemenang.nama}</h3>
                    <button class="btn-danger" style="padding: 10px;" onclick="hapusPemenangLaluUndi('${pemenang.id}', '${pemenang.id_peserta}')">Batalkan & Hapus Pemenang</button>
                </div>
            `;
        } else {
            actionArea.innerHTML = `
                <button class="btn-primary" style="margin-bottom: 5px; padding: 18px; font-size: 1.2rem; background: var(--secondary); box-shadow: 0 4px 15px rgba(245, 158, 11, 0.4);" onclick="bukaModalUndian('${id}', '${p.nama}')">🎲 UNDI PEMENANG SEKARANG</button>
            `;
        }
        
        document.getElementById("modal-detail-putaran").style.display = "flex";
    };

    window.siapkanEditPutaran = () => {
        const id = document.getElementById("det-putaran-id").value; const p = dataPutaran.find(x => x.id === id);
        document.getElementById("modal-detail-putaran").style.display = "none";
        document.getElementById("title-modal-putaran").innerText = "Edit Nama Putaran"; document.getElementById("eput-id").value = id;
        document.getElementById("eput-nama").value = p.nama.split(" - ")[1] || p.nama; document.getElementById("modal-putaran").style.display = "flex";
    };

    document.getElementById("form-putaran").addEventListener("submit", async(e) => {
        e.preventDefault(); const id = document.getElementById("eput-id").value; const namaRaw = document.getElementById("eput-nama").value;
        if(id) {
            if(!window.verifyPin()) return alert("Aksi Dibatalkan!");
            const p = dataPutaran.find(x => x.id === id); await updateDoc(doc(db, "putaran", id), { nama: `Putaran ${p.urutan} - ${namaRaw}` });
        } else {
            const nextU = dataPutaran.length + 1; await addDoc(colPutaran, { urutan: nextU, nama: `Putaran ${nextU} - ${namaRaw}`, createdAt: serverTimestamp() });
        }
        document.getElementById("modal-putaran").style.display = "none";
    });

    window.aksiHapusPutaran = async () => {
        const id = document.getElementById("det-putaran-id").value; if(!window.verifyPin()) return alert("Aksi Dibatalkan!");
        await deleteDoc(doc(db, "putaran", id)); document.getElementById("modal-detail-putaran").style.display = "none"; alert("Putaran Dihapus!");
    };

    function renderPutaran() {
        if(dataPutaran.length === 0) return document.getElementById("list-putaran").innerHTML = getEmptyState("Belum ada data.");
        document.getElementById("list-putaran").innerHTML = dataPutaran.map(p => {
            const w = dataPemenang.find(x => x.id_putaran === p.id);
            const badge = w ? `<span class="badge success">Pemenang: ${w.nama}</span>` : `<span class="badge danger">Belum Diundi</span>`;
            return `
            <div class="list-card" onclick="bukaDetailPutaran('${p.id}')">
                <div class="list-info"><h4>${p.nama}</h4>${badge}</div>
            </div>`;
        }).join('');
    }
    
    function populatePutaranCS() {
        let optCS = []; dataPutaran.forEach(p => optCS.push({value: p.id, label: p.nama}));
        let initialVal = dataPutaran.length > 0 ? dataPutaran[dataPutaran.length - 1].id : null;
        
        window.initCustomSelect('cs-filter-putaran', [{value: 'ALL', label: '>> Tampilkan Semua Putaran <<'}, ...optCS], renderSetoranList, initialVal);
        document.getElementById("filter-log-putaran").innerHTML = `<option value="ALL">Semua Putaran</option>` + dataPutaran.map(p => `<option value="${p.id}">${p.nama}</option>`).join('');
        setTimeout(renderSetoranList, 100);
    }

    function populatePesertaCS() {
        let optCS = [{value: '', label: 'Semua Anggota'}]; dataPeserta.forEach(p => optCS.push({value: p.id, label: p.nama}));
        window.initCustomSelect('cs-search-peserta', optCS, renderSetoranList);
        document.getElementById("filter-log-peserta").innerHTML = `<option value="ALL">Semua Anggota</option>` + dataPeserta.map(p=>`<option value="${p.id}">${p.nama}</option>`).join('');
    }

    // --- 2. RODA UNDIAN LOGIC ---
    window.bukaModalUndian = (id, nama) => {
        document.getElementById("modal-detail-putaran").style.display = "none";
        currentWheelPutaranId = id;
        document.getElementById("mu-putaran-nama").innerText = nama;
        document.getElementById("modal-undi").style.display = "flex";
        
        // Setup Canvas Roda
        const canvas = document.getElementById("wheelCanvas");
        if(!canvas.getContext) return; const ctx = canvas.getContext("2d");
        const dpr = window.devicePixelRatio || 1; canvas.width = 300 * dpr; canvas.height = 300 * dpr; ctx.scale(dpr, dpr);
        const cw = 150; ctx.clearRect(0, 0, 300, 300);
        
        window.validPeserta = dataPeserta.filter(p => p.sudahMenang !== true);
        if(window.validPeserta.length === 0) { ctx.fillStyle = "#E5E7EB"; ctx.beginPath(); ctx.arc(cw, cw, cw, 0, 2*Math.PI); ctx.fill(); return; }

        const slice = (2 * Math.PI) / window.validPeserta.length;
        const colors = ["#0D9488", "#0F766E", "#F59E0B", "#D97706", "#10B981", "#059669", "#3B82F6", "#2563EB"];

        for (let i = 0; i < window.validPeserta.length; i++) {
            ctx.beginPath(); ctx.moveTo(cw, cw); ctx.arc(cw, cw, cw, i * slice, (i+1) * slice);
            ctx.fillStyle = colors[i % colors.length]; ctx.fill(); 
            ctx.lineWidth = 1.5; ctx.strokeStyle = "white"; ctx.stroke();
            ctx.save(); ctx.translate(cw, cw); ctx.rotate((i * slice) + (slice / 2));
            ctx.textAlign = "right"; ctx.fillStyle = "white"; ctx.font = "bold 14px sans-serif";
            ctx.fillText(window.validPeserta[i].nama, cw - 25, 4); ctx.restore();
        }
        
        canvas.style.transform = `rotate(0deg)`;
        window.currentRotation = 0;
    };

    function easeOutQuart(t) { return 1 - Math.pow(1 - t, 4); }

    document.getElementById("btn-spin").addEventListener("click", () => {
        if(!window.validPeserta || window.validPeserta.length === 0) return alert("Semua anggota sudah menjadi pemenang.");
        const canvas = document.getElementById("wheelCanvas");
        
        const index = Math.floor(Math.random() * window.validPeserta.length); currentWheelWinner = window.validPeserta[index];
        
        const sliceDeg = 360 / window.validPeserta.length; const targetDeg = 270 - (index * sliceDeg) - (sliceDeg / 2); 
        const startRotation = window.currentRotation; const spins = 360 * 15; const totalChange = spins + (targetDeg - (window.currentRotation % 360));
        
        document.getElementById("btn-spin").disabled = true; canvas.style.transition = "none";
        const duration = 8000; let startTime = null; let lastPassedSliceIndex = -1;

        function animateWheel(time) {
            if(!startTime) startTime = time; let t = Math.min(1, (time - startTime) / duration);
            window.currentRotation = startRotation + totalChange * easeOutQuart(t);
            canvas.style.transform = `rotate(${window.currentRotation}deg)`;

            let normalizedRotation = (window.currentRotation % 360); let topPositionDeg = (360 - normalizedRotation + 270) % 360; 
            let currentSlicePassing = Math.floor(topPositionDeg / sliceDeg);
            
            if (currentSlicePassing !== lastPassedSliceIndex) { if (lastPassedSliceIndex !== -1) playTick(); lastPassedSliceIndex = currentSlicePassing; }

            if (t < 1) { requestAnimationFrame(animateWheel); } 
            else {
                playWinFestive(); createConfetti(); document.getElementById("btn-spin").disabled = false;
                const pNameObj = dataPutaran.find(p=>p.id===currentWheelPutaranId);
                document.getElementById("mw-putaran-text").innerText = pNameObj ? pNameObj.nama : 'Putaran ?'; 
                document.getElementById("mw-nama").innerText = currentWheelWinner.nama;
                
                document.getElementById("modal-undi").style.display = "none";
                document.getElementById("mw-actions-pre").style.display = "grid";
                document.getElementById("btn-wa-pemenang").style.display = "none";
                document.getElementById("modal-pemenang").style.display = "flex";
            }
        }
        requestAnimationFrame(animateWheel);
    });

    window.undiUlang = () => { document.getElementById("modal-pemenang").style.display = "none"; document.getElementById("btn-spin").click(); };

    window.simpanPemenang = async () => {
        const pObj = dataPutaran.find(p=>p.id===currentWheelPutaranId);
        await updateDoc(doc(db, "peserta", currentWheelWinner.id), { sudahMenang: true });
        await addDoc(colPemenang, { id_putaran: currentWheelPutaranId, urutan_putaran: pObj?.urutan || '', id_peserta: currentWheelWinner.id, nama: currentWheelWinner.nama, timestamp: serverTimestamp() });
        document.getElementById("mw-actions-pre").style.display = "none"; document.getElementById("btn-wa-pemenang").style.display = "block";
    };

    window.hapusPemenangLaluUndi = async (pemenangId, pesertaId) => {
        if(!window.verifyPin()) return alert("Aksi Dibatalkan!");
        await updateDoc(doc(db, "peserta", pesertaId), { sudahMenang: false });
        await deleteDoc(doc(db, "pemenang", pemenangId));
        document.getElementById("modal-detail-putaran").style.display = "none";
        alert("Pemenang dihapus. Silakan klik putaran lagi untuk undi ulang."); 
    };

    window.sharePemenangWA = () => {
        const pName = document.getElementById("mw-putaran-text").innerText; const wName = document.getElementById("mw-nama").innerText;
        const text = `🏆 *PENGUMUMAN ARISAN* 🏆\nPutaran: ${pName}\n\nSelamat kepada:\n*${wName}*\n\nTelah terpilih sebagai Tuan Rumah pada putaran ini! 🥳🎊`;
        window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent(text), '_blank');
    };

    // --- 3. CRUD PESERTA & SEARCH ---
    document.getElementById("search-peserta-input").addEventListener("keyup", window.renderPesertaList);

    window.renderPesertaList = () => {
        const q = document.getElementById("search-peserta-input").value.toLowerCase();
        const filtered = q ? dataPeserta.filter(p => p.nama.toLowerCase().includes(q)) : dataPeserta;
        
        if(filtered.length === 0) return document.getElementById("list-peserta").innerHTML = getEmptyState("Anggota tidak ditemukan.");
        document.getElementById("list-peserta").innerHTML = filtered.map(p => `
            <div class="list-card" onclick="bukaDetailPeserta('${p.id}')">
                <div class="list-info">
                    <h4>${p.nama}</h4><p>${p.telp} | PIN: ${p.pin}</p>
                    ${p.sudahMenang ? '<span class="badge warning" style="background:#FEF3C7;color:#D97706">Pemenang</span>' : '<span class="badge success">Ikut Diundi</span>'}
                </div>
                <div class="list-actions">
                    <button class="btn-icon" style="color:var(--primary)" onclick="event.stopPropagation(); siapkanEditPesertaById('${p.id}');">✏️</button>
                    <button class="btn-icon" style="color:var(--danger)" onclick="event.stopPropagation(); aksiHapusPesertaById('${p.id}');">🗑️</button>
                </div>
            </div>`).join('');
    };

    window.bukaDetailPeserta = (id) => {
        const p = dataPeserta.find(x => x.id === id); document.getElementById("det-peserta-nama").innerText = p.nama;
        const myTrans = dataTrans.filter(t => t.id_peserta === id && t.tipe === 'IN');
        let html = ""; const grp = {};
        myTrans.forEach(t => { if(!grp[t.id_putaran]) grp[t.id_putaran] = []; grp[t.id_putaran].push(t); });
        
        for(let pid in grp) {
            const pName = dataPutaran.find(x=>x.id===pid)?.nama || "Putaran Terhapus";
            html += `<div style="background: var(--bg-app); padding: 15px; border-radius: 12px; margin-bottom: 10px; border: 1px solid var(--border-color);">
                <h5 style="margin: 0 0 10px; color: var(--primary);">${pName}</h5>`;
            grp[pid].forEach(t => { html += `<div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>${formatDate(t.timestamp)}</span><span style="font-weight:bold; color:var(--success)">${rupiah(t.nominal)}</span></div>`; });
            html += `</div>`;
        }
        document.getElementById("list-detail-bayar").innerHTML = html || getEmptyState("Belum ada riwayat setoran.");
        document.getElementById("modal-detail-peserta").style.display = "flex";
    };

    window.siapkanEditPesertaById = (id) => {
        const p = dataPeserta.find(x => x.id === id);
        document.getElementById("title-modal-peserta").innerText = "Edit Anggota";
        document.getElementById("ep-id").value = p.id; document.getElementById("ep-nama").value = p.nama;
        document.getElementById("ep-telp").value = p.telp; document.getElementById("ep-pin").value = p.pin;
        document.getElementById("ep-menang").value = (p.sudahMenang === true).toString();
        document.getElementById("modal-peserta").style.display = "flex";
    };

    window.bukaModalPeserta = () => {
        document.getElementById("title-modal-peserta").innerText = "Tambah Anggota";
        document.getElementById("form-peserta").reset(); document.getElementById("ep-id").value = "";
        document.getElementById("ep-menang").value = "false"; document.getElementById("modal-peserta").style.display = "flex";
    };
    
    document.getElementById("form-peserta").addEventListener("submit", async(e) => {
        e.preventDefault(); const id = document.getElementById("ep-id").value;
        const data = { nama: document.getElementById("ep-nama").value, telp: document.getElementById("ep-telp").value, pin: document.getElementById("ep-pin").value, sudahMenang: document.getElementById("ep-menang").value === "true", statusAktif: true };
        if(id) { if(!window.verifyPin()) return alert("Dibatalkan!"); await updateDoc(doc(db, "peserta", id), data); } 
        else { await addDoc(colPeserta, data); }
        document.getElementById("modal-peserta").style.display = "none";
    });

    window.aksiHapusPesertaById = async (id) => {
        const p = dataPeserta.find(x => x.id === id);
        if(!window.verifyPin()) return alert("Dibatalkan!");
        if(confirm(`Yakin hapus ${p.nama} dari sistem?`)){
            await deleteDoc(doc(db, "peserta", id)); alert("Anggota dihapus.");
        }
    };

    // --- 4. SETORAN (HANYA IN) ---
    const elSort = document.getElementById("sort-setoran");
    elSort.addEventListener("change", renderSetoranList);

    function renderSetoranList() {
        const pid = document.getElementById("select-putaran-setoran").value; if(!pid) return;
        const searchId = document.getElementById("search-setoran-dropdown").value; const sort = elSort.value;
        const transFiltered = pid === 'ALL' ? dataTrans.filter(t => t.tipe === 'IN') : dataTrans.filter(t => t.id_putaran === pid && t.tipe === 'IN');
        
        let totalUangTampil = 0; let listHtml = "";
        dataPeserta.forEach(p => {
            if(searchId && p.id !== searchId) return;
            const bayarOrgIni = transFiltered.filter(t => t.id_peserta === p.id).reduce((sum, t) => sum + t.nominal, 0);
            if(sort === 'paid' && bayarOrgIni === 0) return; if(sort === 'unpaid' && bayarOrgIni > 0) return;
            totalUangTampil += bayarOrgIni; 
            
            const status = bayarOrgIni > 0 ? `<span style="color:var(--success); font-weight:800; font-size:1.1rem">${rupiah(bayarOrgIni)}</span>` : `<span class="badge danger" style="background:#FEE2E2;color:#DC2626;">Belum Bayar</span>`;
            const onClickAttr = pid === 'ALL' ? '' : `onclick="bukaModalBayar('${p.id}', '${p.nama}')"`;
            
            listHtml += `
                <div class="list-card" ${onClickAttr} style="${pid==='ALL'?'cursor:default':''}">
                    <div class="list-info"><h4>${p.nama}</h4><p>${pid === 'ALL' ? 'Total Seluruh Putaran' : 'Ketuk untuk bayar'}</p></div>
                    <div class="amount">${status}</div>
                </div>`;
        });
        document.getElementById("list-setoran-peserta").innerHTML = listHtml || getEmptyState("Tagihan tidak ditemukan.");
        document.getElementById("total-terkumpul-ui").innerText = rupiah(totalUangTampil);
    }

    window.bukaModalBayar = (id, nama) => {
        document.getElementById("mb-id-peserta").value = id; document.getElementById("mb-nama-peserta").value = nama;
        document.getElementById("mb-nama").innerText = nama; 
        const lastPay = dataTrans.find(t => t.id_peserta === id && t.tipe === 'IN');
        document.getElementById("mb-nominal-rp").value = lastPay ? rupiah(lastPay.nominal) : "";
        document.getElementById("modal-bayar").style.display = "flex";
    };

    document.getElementById("form-submit-bayar").addEventListener("submit", async(e) => {
        e.preventDefault(); const rawNominal = getRupiahVal(document.getElementById("mb-nominal-rp").value);
        if(rawNominal <= 0) return alert("Nominal invalid!");
        await addDoc(colTrans, { tipe: 'IN', id_putaran: document.getElementById("select-putaran-setoran").value, id_peserta: document.getElementById("mb-id-peserta").value, nama_peserta: document.getElementById("mb-nama-peserta").value, nominal: rawNominal, timestamp: serverTimestamp() });
        document.getElementById("modal-bayar").style.display = "none";
    });

    window.shareLaporanWA = () => {
        const pid = document.getElementById("select-putaran-setoran").value; const pName = pid === 'ALL' ? 'Semua Putaran' : dataPutaran.find(x=>x.id===pid)?.nama || "Putaran";
        let t = `*TAGIHAN ARISAN LADARUA*\nPutaran: ${pName}\n\n`;
        const transF = pid === 'ALL' ? dataTrans.filter(x=>x.tipe==='IN') : dataTrans.filter(x=>x.id_putaran===pid && x.tipe==='IN');
        dataPeserta.forEach(p => { const sum = transF.filter(x=>x.id_peserta===p.id).reduce((a,b)=>a+b.nominal, 0); t += `- ${p.nama}: ${sum > 0 ? 'LUNAS ✅' : 'BELUM BAYAR ❌'}\n`; });
        t += `\n*Terkumpul: ${document.getElementById("total-terkumpul-ui").innerText}*`;
        window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent(t), '_blank');
    };

    // --- 5. LOG KAS MURNI IN ---
    document.getElementById("filter-log-putaran").addEventListener("change", renderLogKas);
    document.getElementById("filter-log-peserta").addEventListener("change", renderLogKas);

    function renderLogKas() {
        const fPut = document.getElementById("filter-log-putaran").value; const fPes = document.getElementById("filter-log-peserta").value;
        let tIn = 0; let html = "";
        dataTrans.forEach(t => {
            if(t.tipe !== 'IN') return; 
            if(fPut !== 'ALL' && t.id_putaran !== fPut) return;
            if(fPes !== 'ALL' && t.id_peserta !== fPes) return;

            tIn += t.nominal; 
            html += `<div class="list-card" onclick="bukaEditTransaksi('${t.id}')">
                <div class="list-info"><h4>${t.nama_peserta}</h4><p>${formatDate(t.timestamp)}</p></div>
                <div class="amount" style="color:var(--success);">+${rupiah(t.nominal)}</div>
            </div>`;
        });
        document.getElementById("list-log-kas").innerHTML = html || getEmptyState("Tidak ada transaksi kas.");
        document.getElementById("kas-saldo").innerText = rupiah(tIn);
    }

    window.bukaEditTransaksi = (id) => {
        const t = dataTrans.find(x => x.id === id);
        document.getElementById("et-id").value = t.id;
        document.getElementById("et-ket").value = t.nama_peserta;
        document.getElementById("et-nominal").value = t.nominal;
        document.getElementById("et-tanggal").value = getInputDateString(t.timestamp);
        document.getElementById("modal-detail-transaksi").style.display = "flex";
    };

    document.getElementById("form-edit-transaksi").addEventListener("submit", async(e) => {
        e.preventDefault(); const id = document.getElementById("et-id").value;
        if(!window.verifyPin()) return alert("Aksi Dibatalkan!");
        const inputDate = new Date(document.getElementById("et-tanggal").value);
        await updateDoc(doc(db, "transaksi", id), { nominal: Number(document.getElementById("et-nominal").value), timestamp: inputDate });
        document.getElementById("modal-detail-transaksi").style.display = "none"; alert("Transaksi Berubah!");
    });

    window.aksiHapusTransaksi = async () => {
        const id = document.getElementById("et-id").value;
        if(!window.verifyPin()) return alert("Aksi Dibatalkan!");
        await deleteDoc(doc(db, "transaksi", id));
        document.getElementById("modal-detail-transaksi").style.display = "none"; alert("Dihapus!");
    };

    window.shareBukuKasWA = () => {
        let t = `*BUKU KAS ARISAN LADARUA*\nTotal Masuk: ${document.getElementById("kas-saldo").innerText}\n\nRiwayat Terbaru:\n`;
        dataTrans.filter(x=>x.tipe==='IN').slice(0,15).forEach(x => { t += `${formatDate(x.timestamp)} - ${x.nama_peserta}: +${rupiah(x.nominal)}\n`; });
        window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent(t), '_blank');
    }

    window.cetakLaporan = () => {
        let printWin = window.open('', '', 'width=800,height=600');
        printWin.document.write('<html><head><title>Buku Kas Arisan</title><style>body{font-family:sans-serif;} table{width:100%;border-collapse:collapse;margin-top:20px;} th,td{border:1px solid #ccc;padding:10px;text-align:left;} th{background:#eee;}</style></head><body>');
        printWin.document.write('<h2>Buku Kas Pemasukan Arisan Ladarua</h2><p>Dicetak: ' + new Date().toLocaleString('id-ID') + '</p>');
        printWin.document.write(document.getElementById('list-log-kas').innerHTML.replace(/<div class="list-card" onclick=".*?">/g, '<tr>').replace(/<div class="list-info"><h4>(.*?)<\/h4><p>(.*?)<\/p><\/div><div class="amount.*?">(.*?)<\/div><\/div>/g, '<td>$1</td><td>$2</td><td>$3</td></tr>').replace(/<div class="empty-state">.*?<\/div>/g, '<p>Data kosong</p>'));
        printWin.document.write('</body></html>');
        printWin.document.close(); printWin.print();
    };
}

// ======================= USER LOGIC =======================
function loadUser() {
    onSnapshot(doc(db, "peserta", currentUser.id), docSnap => {
        if(docSnap.exists()){
            const data = docSnap.data(); document.getElementById("u-nama-teks").innerText = `Halo, ${data.nama}`;
            if(data.fotoBase64) { document.getElementById("u-foto-profil").src = data.fotoBase64; document.getElementById("u-foto-profil").style.display = 'block'; document.getElementById("up-foto-preview").src = data.fotoBase64; document.getElementById("up-foto-preview").style.display = 'block'; }
            document.getElementById("up-nama").value = data.nama; document.getElementById("up-pin").value = data.pin;
        }
    });

    onSnapshot(colTrans, snap => {
        const myTrans = snap.docs.map(d=>d.data()).filter(t => t.id_peserta === currentUser.id && t.tipe === 'IN').sort((a,b) => (b.timestamp?.toMillis()||0) - (a.timestamp?.toMillis()||0));
        let total = 0; let html = "";
        myTrans.forEach(t => { total += t.nominal; html += `<div class="list-card"><div class="list-info"><h4>Setoran Berhasil</h4><p>${formatDate(t.timestamp)}</p></div><div class="amount" style="color:var(--success); font-weight:bold; font-size:1.1rem;">+${rupiah(t.nominal)}</div></div>`; });
        document.getElementById("u-total-bayar").innerText = rupiah(total); document.getElementById("list-riwayat-user").innerHTML = html || getEmptyState("Belum ada riwayat setoran.");
    });

    window.bukaModalProfil = () => { document.getElementById("modal-profil").style.display = "flex"; };
    
    document.getElementById("form-profil").addEventListener("submit", async(e) => {
        e.preventDefault(); const file = document.getElementById("up-foto").files[0];
        const newData = { nama: document.getElementById("up-nama").value, pin: document.getElementById("up-pin").value };
        if(file) {
            const reader = new FileReader();
            reader.onloadend = async () => { newData.fotoBase64 = reader.result; await updateDoc(doc(db, "peserta", currentUser.id), newData); alert("Profil & Foto tersimpan!"); document.getElementById("modal-profil").style.display = "none"; };
            reader.readAsDataURL(file);
        } else { await updateDoc(doc(db, "peserta", currentUser.id), newData); alert("Profil tersimpan!"); document.getElementById("modal-profil").style.display = "none"; }
    });
}

// PWA Init
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
