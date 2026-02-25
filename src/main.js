let currentInstance = null;
let allVersions = [];
let allAccounts = [];

window.addEventListener('pywebviewready', async function() {
    i18n.init(); // Initialize i18n with all loaded language resources

    const data = await pywebview.api.get_init_data();
    allAccounts = data.accounts;
    renderInstances(data.instances);
    renderAccounts(data.accounts, data.current_account);
    
    // Load and apply settings
    document.getElementById('settingsJavaPath').value = data.config.java_path;
    document.getElementById('settingsRam').value = data.config.ram;
    i18n.changeLanguage(data.config.language || 'en'); // Set language from config or default to 'en'
    
    allVersions = await pywebview.api.get_mc_versions();
    renderModpackVersionFilter();
    
    // Select first version by default
    if(allVersions.length > 0) {
        selectVersion(allVersions[0]);
    }
    
    renderLoaders();
    renderVersions(allVersions);
    renderAppVersion();

    // Hide Microsoft login tab temporarily
    const msTab = document.getElementById('tab-microsoft');
    if(msTab) msTab.classList.add('hidden');
});

function renderInstances(list) {
    const container = document.getElementById('instanceList');
    container.innerHTML = '';
    list.forEach(inst => {
        const btn = document.createElement('button');
        btn.className = 'w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 flex items-center gap-3 group text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50';
        
        let iconClass = 'fa-cube';
        if(inst.loader === 'Fabric') iconClass = 'fa-scroll';
        if(inst.loader === 'Forge' || inst.loader === 'NeoForge') iconClass = 'fa-hammer';
        
        btn.innerHTML = `
            <div class="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center shrink-0 border border-zinc-700/50 group-hover:border-zinc-600 transition-colors">
                <i class="fa-solid ${iconClass} text-zinc-500 group-hover:text-zinc-300 text-xs"></i>
            </div>
            <div class="truncate flex-1">
                <div class="truncate text-zinc-300 group-hover:text-white">${inst.name}</div>
                <div class="text-[10px] text-zinc-600 group-hover:text-zinc-500 font-normal">${inst.loader} ${inst.version}</div>
            </div>
        `;
        
        btn.onclick = () => selectInstance(inst, btn);
        container.appendChild(btn);
    });
}

function renderAccounts(list, current) {
    const container = document.getElementById('accountList');
    container.innerHTML = '';
    
    // Update Header Button
    if (current) {
        document.getElementById('currentAccountName').innerText = current.username;
        document.getElementById('currentAccountType').innerText = current.type.toUpperCase();
        // Generate a simple avatar based on name
        const firstLetter = current.username.charAt(0).toUpperCase();
        document.getElementById('currentAccountIcon').innerHTML = `<span class="text-xs">${firstLetter}</span>`;
    } else {
        document.getElementById('currentAccountName').innerText = "No Account";
        document.getElementById('currentAccountType').innerText = "Select or Add";
        document.getElementById('currentAccountIcon').innerHTML = `<i class="fa-solid fa-user-slash"></i>`;
    }

    if(list.length === 0) {
        container.innerHTML = '<div class="p-3 text-xs text-zinc-500 text-center italic">No accounts added yet.</div>';
        return;
    }

    list.forEach(acc => {
        const isActive = current && current.uuid === acc.uuid;
        const btn = document.createElement('button');
        btn.className = `w-full flex items-center gap-3 px-2 py-2 rounded-lg transition-colors ${isActive ? 'bg-emerald-900/20 border border-emerald-500/20' : 'hover:bg-zinc-800 border border-transparent'}`;
        btn.onclick = () => {
            changeAccount(acc.uuid);
            toggleDropdown('accountDropdownMenu');
        };

        btn.innerHTML = `
            <div class="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center shrink-0 border border-zinc-700/50 text-zinc-400">
                <i class="fa-solid fa-user"></i>
            </div>
            <div class="flex flex-col items-start flex-1 overflow-hidden">
                <span class="text-xs font-bold ${isActive ? 'text-emerald-400' : 'text-zinc-300'} truncate w-full text-left">${acc.username}</span>
                <span class="text-[10px] text-zinc-500 truncate w-full text-left">${acc.type.toUpperCase()}</span>
            </div>
            ${isActive ? '<i class="fa-solid fa-check text-emerald-500 text-xs"></i>' : ''}
        `;
        container.appendChild(btn);
    });
}

function selectInstance(inst, btnElement) {
    currentInstance = inst;
    pywebview.api.select_instance(inst.name);
    
    document.getElementById('homeScreen').classList.add('hidden');
    document.getElementById('instanceScreen').classList.remove('hidden');
    document.getElementById('instanceScreen').classList.add('flex');
    
    document.getElementById('instName').innerText = inst.name;
    document.getElementById('instVersion').innerText = inst.version;
    document.getElementById('instLoader').innerText = inst.loader;
    
    // Reset all buttons
    const allBtns = document.getElementById('instanceList').children;
    for(let b of allBtns) {
        b.className = 'w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 flex items-center gap-3 group text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50';
        const iconDiv = b.querySelector('div:first-child');
        iconDiv.className = 'w-8 h-8 rounded bg-zinc-800 flex items-center justify-center shrink-0 border border-zinc-700/50 group-hover:border-zinc-600 transition-colors';
        iconDiv.querySelector('i').className = iconDiv.querySelector('i').className.replace('text-emerald-400', 'text-zinc-500 group-hover:text-zinc-300');
    }
    
    // Set active button
    if(btnElement) {
        btnElement.className = 'w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 flex items-center gap-3 group bg-zinc-800 text-white shadow-sm ring-1 ring-zinc-700/50';
        const iconDiv = btnElement.querySelector('div:first-child');
        iconDiv.className = 'w-8 h-8 rounded bg-emerald-950/30 flex items-center justify-center shrink-0 border border-emerald-500/30';
        iconDiv.querySelector('i').classList.remove('text-zinc-500', 'group-hover:text-zinc-300');
        iconDiv.querySelector('i').classList.add('text-emerald-400');
    }
}

function launchGame() {
    document.getElementById('playBtn').disabled = true;
    document.getElementById('console').innerHTML = '';
    pywebview.api.launch_game_thread();
}

function updateStatus(text) {
    const translated = window.i18n ? window.i18n.t(text) : text;
    document.getElementById('statusText').innerText = translated;
}

function setLoading(isLoading) {
    const el = document.getElementById('progressContainer');
    if(isLoading) el.classList.remove('hidden');
    else el.classList.add('hidden');
}

function updateProgress(percent) { 
    document.getElementById('progressBar').style.width = percent + '%'; 
    document.getElementById('progressPercent').innerText = percent + '%';
}

function consoleLog(text) {
    const c = document.getElementById('console');
    const line = document.createElement('div');
    line.textContent = text;
    c.appendChild(line);
    c.scrollTop = c.scrollHeight;
}

function gameClosed() {
    document.getElementById('playBtn').disabled = false;
    setLoading(false);
    updateStatus("Ready");
}

function hideWindow() { /* Optional: implement minimize logic if needed */ }
function showWindow() { /* Optional */ }

// --- Dropdown Logic ---
function toggleDropdown(id) {
    const el = document.getElementById(id);
    const isHidden = el.classList.contains('hidden');
    // Close all others
    document.querySelectorAll('[id$="DropdownMenu"]').forEach(d => d.classList.add('hidden'));
    if(isHidden) el.classList.remove('hidden');
}

// Close dropdowns when clicking outside
window.addEventListener('click', function(e) {
    if (!e.target.closest('.dropdown-container')) {
        document.querySelectorAll('[id$="DropdownMenu"]').forEach(d => d.classList.add('hidden'));
    }
});

// --- Version & Loader Logic ---
function renderVersions(list) {
    const container = document.getElementById('versionList');
    container.innerHTML = '';
    list.forEach(v => {
        const btn = document.createElement('button');
        btn.className = 'w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white rounded-md transition-colors';
        btn.innerText = v;
        btn.onclick = () => {
            selectVersion(v);
            toggleDropdown('versionDropdownMenu');
        };
        container.appendChild(btn);
    });
}

function selectVersion(v) {
    document.getElementById('newInstVersion').value = v;
    document.getElementById('versionBtnText').innerText = v;
    document.getElementById('versionBtnText').classList.remove('text-zinc-500');
    document.getElementById('versionBtnText').classList.add('text-white');
}

function filterVersions(query) {
    const filtered = allVersions.filter(v => v.toLowerCase().includes(query.toLowerCase()));
    renderVersions(filtered);
}

function renderModpackVersionFilter() {
    const container = document.getElementById('modpackFilterList');
    if(!container) return;
    container.innerHTML = '';

    const allBtn = document.createElement('button');
    allBtn.className = 'w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white rounded-md transition-colors';
    allBtn.innerText = i18n.t('all_versions');
    allBtn.onclick = () => {
        selectModpackVersionFilter('', i18n.t('all_versions'));
        toggleDropdown('modpackVersionDropdownMenu');
        searchModpacks();
    };
    container.appendChild(allBtn);

    allVersions.forEach(v => {
        const btn = document.createElement('button');
        btn.className = 'w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white rounded-md transition-colors';
        btn.innerText = v;
        btn.onclick = () => {
            selectModpackVersionFilter(v, v);
            toggleDropdown('modpackVersionDropdownMenu');
            searchModpacks();
        };
        container.appendChild(btn);
    });
}

function selectModpackVersionFilter(value, text) {
    document.getElementById('modpackVersionFilter').value = value;
    const btnText = document.getElementById('modpackVersionBtnText');
    if(btnText) btnText.innerText = text;
}

function renderLoaders() {
    const loaders = ['Vanilla', 'Fabric', 'Forge', 'Quilt', 'NeoForge'];
    const container = document.getElementById('loaderList');
    container.innerHTML = '';
    loaders.forEach(l => {
        const btn = document.createElement('button');
        btn.className = 'w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white rounded-md transition-colors flex items-center gap-2';
        btn.innerHTML = `<div class="w-1.5 h-1.5 rounded-full ${l === 'Vanilla' ? 'bg-zinc-500' : 'bg-emerald-500'}"></div> ${l}`;
        btn.onclick = () => {
            document.getElementById('newInstLoader').value = l;
            document.getElementById('loaderBtnText').innerText = l;
            toggleDropdown('loaderDropdownMenu');
        };
        container.appendChild(btn);
    });
}

// --- Modals ---

function openModal(id) {
    document.getElementById('modalOverlay').classList.remove('hidden');
    const el = document.getElementById(id);
    el.classList.remove('hidden');
    if(id === 'createModal') switchCreateTab('custom');
}

function closeAllModals() {
    document.getElementById('modalOverlay').classList.add('hidden');
    document.querySelectorAll('#modalOverlay > div').forEach(el => el.classList.add('hidden'));
}

async function createInstance() {
    const name = document.getElementById('newInstName').value;
    const ver = document.getElementById('newInstVersion').value;
    const loader = document.getElementById('newInstLoader').value;
    if(name && ver) {
        await pywebview.api.create_instance(name, ver, loader);
        const data = await pywebview.api.get_init_data();
        renderInstances(data.instances);
        closeAllModals();
    }
}

function switchCreateTab(tab) {
    const customTab = document.getElementById('tab-create-custom');
    const modpackTab = document.getElementById('tab-create-modpack');
    const customForm = document.getElementById('create-custom');
    const modpackForm = document.getElementById('create-modpack');
    const importForm = document.getElementById('create-import');

    if (tab === 'custom') {
        customTab.className = 'pb-2 text-sm font-medium text-emerald-500 border-b-2 border-emerald-500 transition-colors';
        modpackTab.className = 'pb-2 text-sm font-medium text-zinc-500 hover:text-zinc-300 transition-colors';
        customForm.classList.remove('hidden');
        modpackForm.classList.add('hidden');
        importForm.classList.add('hidden');
    } else {
        // Reset all
        [customTab, modpackTab].forEach(t => t.className = 'pb-2 text-sm font-medium text-zinc-500 hover:text-zinc-300 transition-colors');
        [customForm, modpackForm, importForm].forEach(f => f.classList.add('hidden'));

        if (tab === 'modpack') {
            modpackTab.className = 'pb-2 text-sm font-medium text-emerald-500 border-b-2 border-emerald-500 transition-colors';
            modpackForm.classList.remove('hidden');
            searchModpacks();
        }
    }
}

function showImportForm() {
    document.getElementById('create-modpack').classList.add('hidden');
    document.getElementById('create-import').classList.remove('hidden');
}

function hideImportForm() {
    document.getElementById('create-import').classList.add('hidden');
    document.getElementById('create-modpack').classList.remove('hidden');
}

let modpackSearchOffset = 0;

async function searchModpacks(loadMore = false) {
    const query = document.getElementById('modpackSearchInput').value;
    const version = document.getElementById('modpackVersionFilter').value;
    const container = document.getElementById('modpackList');
    
    if (!loadMore) {
        modpackSearchOffset = 0;
        container.innerHTML = '<div class="text-center text-zinc-500 pt-10"><i class="fa-solid fa-spinner fa-spin"></i></div>';
    } else {
        const btn = document.getElementById('loadMoreModpacksBtn');
        if(btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        }
    }
    
    try {
        const results = await pywebview.api.search_modrinth_modpacks(query, version, modpackSearchOffset);
        if (!loadMore) container.innerHTML = '';
        else {
            const btn = document.getElementById('loadMoreModpacksBtn');
            if(btn) btn.remove();
        }

        if(results.length === 0 && !loadMore) {
            container.innerHTML = '<div class="text-center text-zinc-500 pt-10">No modpacks found.</div>';
            return;
        }
        
        results.forEach(mp => {
            const el = document.createElement('div');
            el.className = 'flex items-center gap-3 p-2 hover:bg-zinc-800/50 rounded-lg transition-colors group';
            
            const imgUrl = mp.icon_url || 'https://cdn.modrinth.com/assets/unknown_pack.png';
            
            el.innerHTML = `
                <img src="${imgUrl}" class="w-10 h-10 rounded bg-zinc-800 object-cover">
                <div class="flex-1 overflow-hidden">
                    <div class="font-bold text-sm text-zinc-200 truncate">${mp.title}</div>
                    <div class="text-xs text-zinc-500 truncate">${mp.author}</div>
                </div>
            `;
            
            const btn = document.createElement('button');
            btn.className = 'px-3 py-1.5 bg-zinc-800 hover:bg-emerald-600 text-white text-xs rounded transition-colors';
            btn.innerText = 'Install';
            btn.onclick = () => openModpackVersions(mp.project_id, mp.title);
            
            el.appendChild(btn);
            container.appendChild(el);
        });

        modpackSearchOffset += results.length;
        if (results.length === 20) {
             const loadMoreContainer = document.createElement('div');
             loadMoreContainer.innerHTML = `<button id="loadMoreModpacksBtn" onclick="searchModpacks(true)" class="w-full mt-2 py-2 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white text-xs font-medium transition-colors">Load More</button>`;
             container.appendChild(loadMoreContainer);
        }
    } catch(e) {
        if (!loadMore) container.innerHTML = '<div class="text-center text-red-500 pt-10">Error searching.</div>';
    }
}

async function openModpackVersions(id, title) {
    const list = document.getElementById('modpackVersionList');
    if (!list) return;
    
    list.innerHTML = '<div class="text-center text-zinc-500 py-4"><i class="fa-solid fa-spinner fa-spin"></i> Loading versions...</div>';
    
    openModal('modpackVersionModal');
    
    try {
        const versions = await pywebview.api.get_modpack_versions(id);
        list.innerHTML = '';
        
        if (!versions || versions.length === 0) {
            list.innerHTML = '<div class="text-center text-zinc-500 py-4">No versions found.</div>';
            return;
        }

        versions.forEach(v => {
            const el = document.createElement('div');
            el.className = 'flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer border border-zinc-800/50 hover:border-zinc-700';
            el.onclick = () => installModpackVersion(id, v.id, v.name, title);
            
            const date = v.date_published ? new Date(v.date_published).toLocaleDateString() : 'Unknown';
            const gameVers = (v.game_versions || []).join(', ');
            const loaders = (v.loaders || []).join(', ');
            
            el.innerHTML = `
                <div>
                    <div class="font-medium text-sm text-zinc-200">${v.name || 'Unnamed'}</div>
                    <div class="text-[10px] text-zinc-500">${gameVers} • ${loaders}</div>
                </div>
                <div class="text-xs text-zinc-600">${date}</div>
            `;
            list.appendChild(el);
        });
    } catch (e) {
        console.error(e);
        list.innerHTML = `<div class="text-center text-red-500 py-4">Error: ${e}</div>`;
    }
}

async function installModpackVersion(projectId, versionId, versionName, packTitle) {
    document.getElementById('modpackVersionModal').classList.add('hidden');
    document.getElementById('createModal').classList.add('hidden');
    
    const instName = await showPrompt("Enter instance name:", `${packTitle} ${versionName}`);
    if(!instName) return;
    
    closeAllModals();
    updateStatus(i18n.t('installing_modpack'));
    setLoading(true);
    
    try {
        const success = await pywebview.api.install_mrpack(instName, projectId, versionId);
        if(success) {
            const data = await pywebview.api.get_init_data();
            renderInstances(data.instances);
            await showAlert(i18n.t('modpack_installed'));
        } else {
            await showAlert(i18n.t('modpack_install_failed'));
        }
    } catch(e) {
        await showAlert("Error: " + e);
    } finally {
        setLoading(false);
        updateStatus("Ready");
    }
}

async function selectMrpackFile() {
    const path = await pywebview.api.open_file_dialog();
    if (path) {
        document.getElementById('importFilePath').value = path;
        // Auto-fill name if empty
        const nameInput = document.getElementById('importInstName');
        if (!nameInput.value) {
            // Extract filename without extension
            const filename = path.split(/[\\/]/).pop().replace('.mrpack', '');
            nameInput.value = filename;
        }
    }
}

async function importMrpack() {
    const name = document.getElementById('importInstName').value;
    const path = document.getElementById('importFilePath').value;
    
    if (!name || !path) {
        await showAlert("Please select a file and enter a name.");
        return;
    }
    
    closeAllModals();
    updateStatus(i18n.t('importing_mrpack'));
    setLoading(true);
    
    try {
        const success = await pywebview.api.import_mrpack_local(name, path);
        if(success) {
            const data = await pywebview.api.get_init_data();
            renderInstances(data.instances);
            await showAlert(i18n.t('mrpack_imported'));
        } else {
            await showAlert("Failed to import modpack.");
        }
    } catch(e) {
        await showAlert("Error: " + e);
    } finally {
        setLoading(false);
        updateStatus("Ready");
    }
}

function switchAuthTab(tab) {
    const offlineTab = document.getElementById('tab-offline');
    const elybyTab = document.getElementById('tab-elyby');
    // const microsoftTab = document.getElementById('tab-microsoft');
    const forms = {
        offline: document.getElementById('auth-offline'),
        elyby: document.getElementById('auth-elyby'),
        // microsoft: document.getElementById('auth-microsoft')
    };
    const tabs = {
        offline: { btn: offlineTab, activeClass: 'text-emerald-500 border-b-2 border-emerald-500' },
        elyby: { btn: elybyTab, activeClass: 'text-blue-500 border-b-2 border-blue-500' },
        // microsoft: { btn: microsoftTab, activeClass: 'text-green-500 border-b-2 border-green-500' }
    };

    // Reset all
    Object.values(tabs).forEach(t => t.btn.className = 'pb-2 text-sm font-medium text-zinc-500 hover:text-zinc-300 transition-colors');
    Object.values(forms).forEach(f => f.classList.add('hidden'));

    // Activate selected
    if (tabs[tab] && forms[tab]) {
        tabs[tab].btn.className = `pb-2 text-sm font-medium transition-colors ${tabs[tab].activeClass}`;
        forms[tab].classList.remove('hidden');
    }
}

async function addLocalAccount() {
    const name = document.getElementById('localUsername').value;
    if(name) {
        const accounts = await pywebview.api.add_account_local(name);
        allAccounts = accounts;
        renderAccounts(accounts, accounts[accounts.length-1]);
        closeAllModals();
    }
}

async function addElyByAccount() {
    const u = document.getElementById('elyUsername').value;
    const p = document.getElementById('elyPassword').value;
    if(u && p) {
        const accounts = await pywebview.api.add_account_elyby(u, p);
        if(accounts) {
            allAccounts = accounts;
            renderAccounts(accounts, accounts[accounts.length-1]);
            closeAllModals();
        } else {
            await showAlert("Login failed! Check credentials.");
        }
    }
}

function renderAppVersion() {
    const title = document.querySelector('h1');
    if (title) {
        const ver = document.createElement('div');
        ver.className = 'text-[10px] text-zinc-500 font-normal tracking-wider mt-0.5 opacity-70';
        ver.innerText = 'beta 2';
        title.appendChild(ver);
    }
}

async function saveSettings() {
    const java = document.getElementById('settingsJavaPath').value;
    const ram = document.getElementById('settingsRam').value;
    const lang = i18n.lang;
    await pywebview.api.save_settings({"java_path": java, "ram": ram, "language": lang});
    closeAllModals();
}

async function changeAccount(uuid) {
    await pywebview.api.set_account(uuid);
    const selected = allAccounts.find(a => a.uuid === uuid);
    if (selected) {
        renderAccounts(allAccounts, selected);
    }
}

async function deleteInstance() {
    if(await showConfirm("Are you sure?")) {
        if(await pywebview.api.delete_instance()) {
            const data = await pywebview.api.get_init_data();
            renderInstances(data.instances);
            document.getElementById('homeScreen').classList.remove('hidden');
            document.getElementById('instanceScreen').classList.add('hidden');
        }
    }
}

// --- MOD/ITEM INSTALLATION SCRIPT ---
let modSearchOffset = 0;
let modToDelete = null;
let currentItemBrowserType = 'mod';

// Debounce helper to avoid spamming search API
let debounceTimer;
const debounce = (func, delay) => {
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => func.apply(context, args), delay);
    }
};

function openItemBrowser(type) {
    if (type === 'shaderpack') type = 'shader'; // Defensively handle old values
    currentItemBrowserType = type;
    openModal('modsModal');
    document.getElementById('modSearchInput').value = '';
    const titleEl = document.getElementById('itemBrowserTitle');
    if (type === 'mod') {
        titleEl.innerText = i18n.t('add_mods_title');
    } else if (type === 'resourcepack') {
        titleEl.innerText = i18n.t('add_resource_packs_title');
    } else if (type === 'shader') {
        titleEl.innerText = i18n.t('add_shaders_title');
    }
    else if (type === 'datapack') {
        titleEl.innerText = i18n.t('add_datapacks_title');
    }
    
    searchItems(false);
}

function switchInstanceTab(tabId, button, type) {
    if (type === 'shaderpack') type = 'shader'; // Defensively handle old values
    document.querySelectorAll('.instance-tab-content').forEach(tab => tab.classList.add('hidden'));
    document.querySelectorAll('.instance-tab-btn').forEach(btn => {
        btn.classList.remove('text-emerald-500', 'border-emerald-500');
        btn.classList.add('text-zinc-500', 'border-transparent');
    });
    document.getElementById(tabId).classList.remove('hidden');
    button.classList.add('text-emerald-500', 'border-emerald-500');
    button.classList.remove('text-zinc-500', 'border-transparent');
    
    if (type !== 'console') {
        refreshInstalledItems(type);
    }
}

// This would be called when the mods tab is opened or a mod is installed/deleted
async function refreshInstalledItems(type) {
    if (type === 'shaderpack') type = 'shader'; // Defensively handle old values
    const listMap = {
        'mod': 'installedModsList',
        'resourcepack': 'installedResourcePacksList',
        'shader': 'installedShaderPacksList',
        'datapack': 'installedDatapacksList'
    };
    const emptyMsgMap = {
        'mod': 'no_mods_installed',
        'resourcepack': 'no_resource_packs_installed',
        'shader': 'no_shaders_installed',
        'datapack': 'no_datapacks_installed'
    };
    const apiFuncMap = {
        'mod': pywebview.api.get_installed_mods,
        'resourcepack': pywebview.api.get_installed_resourcepacks,
        'shader': pywebview.api.get_installed_shaders,
        'datapack': pywebview.api.get_installed_datapacks
    };
    const iconMap = {
        'mod': 'fa-puzzle-piece',
        'resourcepack': 'fa-palette',
        'shader': 'fa-sun',
        'datapack': 'fa-database'
    };
    const listElement = document.getElementById(listMap[type]);
    if (!listElement) return;

    // Improved Loading State
    listElement.innerHTML = `
        <div class="flex flex-col items-center justify-center py-12 text-zinc-500 animate-pulse">
            <i class="fa-solid fa-circle-notch fa-spin text-3xl mb-3"></i>
            <span class="text-sm font-medium">Loading ${type}s...</span>
        </div>
    `;

    try {
        // *** THE FIX ***
        const items = await apiFuncMap[type](currentInstance);
        
        if (!items || items.length === 0) {
            // Improved Empty State
            listElement.innerHTML = `
                <div class="flex flex-col items-center justify-center py-12 text-zinc-600 border-2 border-dashed border-zinc-800 rounded-xl">
                    <div class="w-16 h-16 bg-zinc-800/50 rounded-full flex items-center justify-center mb-4">
                        <i class="fa-solid fa-box-open text-3xl opacity-50"></i>
                    </div>
                    <div class="text-base font-medium text-zinc-400" data-i18n="${emptyMsgMap[type]}">Nothing installed yet.</div>
                    <button onclick="openItemBrowser('${type}')" class="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm rounded-lg transition-colors">
                        <i class="fa-solid fa-plus mr-2"></i> Add ${type}
                    </button>
                </div>
            `;
            if (window.i18n) window.i18n.updatePage();
            return;
        }

        listElement.innerHTML = '';
        items.forEach(item => {
            const modElement = document.createElement('div');
            // Improved Item Styling
            modElement.className = 'group flex items-center justify-between bg-zinc-900/40 hover:bg-zinc-800/80 border border-zinc-800/50 hover:border-zinc-700 transition-all duration-200 p-3 rounded-xl mb-2 last:mb-0';
            
            const displayName = item.name || item.file_name;
            const subText = item.name ? item.file_name : (type === 'mod' ? 'Mod file' : 'File');

            modElement.innerHTML = `
                <div class="flex items-center gap-4 overflow-hidden flex-1">
                    <div class="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0 text-zinc-500 group-hover:text-emerald-400 transition-colors border border-zinc-700/50">
                        <i class="fa-solid ${iconMap[type]} text-lg"></i>
                    </div>
                    <div class="flex flex-col overflow-hidden">
                        <span class="font-medium text-zinc-200 truncate group-hover:text-white transition-colors text-sm">${displayName}</span>
                        <span class="text-xs text-zinc-500 truncate font-mono bg-zinc-950/30 px-1.5 py-0.5 rounded w-fit mt-1">${subText}</span>
                    </div>
                </div>
                <div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button onclick="deleteItem('${type}', '${item.file_name}')" class="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-red-900/30 text-zinc-400 hover:text-red-400 transition-colors flex items-center justify-center border border-zinc-700/50 hover:border-red-800/50" title="Delete">
                        <i class="fa-solid fa-trash-can text-xs"></i>
                    </button>
                </div>
            `;
            listElement.appendChild(modElement);
        });
    } catch (e) {
        console.error("Failed to refresh items:", e);
        // Improved Error State
        listElement.innerHTML = `
            <div class="flex flex-col items-center justify-center py-8 text-red-400/80 bg-red-950/20 rounded-xl border border-red-900/30">
                <i class="fa-solid fa-triangle-exclamation mb-2 text-2xl"></i>
                <span class="text-sm font-medium">Failed to load items</span>
                <span class="text-xs text-red-500/50 mt-1 max-w-[80%] text-center">${e}</span>
                <button onclick="refreshInstalledItems('${type}')" class="mt-3 px-3 py-1.5 bg-red-900/20 hover:bg-red-900/40 text-red-300 text-xs rounded border border-red-900/30 transition-colors">
                    Try Again
                </button>
            </div>
        `;
    }
}

async function deleteItem(type, fileName) {
    if (type === 'shaderpack') type = 'shader'; // Defensively handle old values
    if (!currentInstance) return;
    modToDelete = { type, fileName };
    document.getElementById('deleteModMessage').innerText = i18n.t('delete_mod_confirm', {name: fileName});
    openModal('deleteModModal');
}

async function confirmDeleteMod() {
    if (!currentInstance || !modToDelete) return;
    const { type, fileName } = modToDelete;
    const apiFuncMap = {
        'mod': pywebview.api.delete_mod,
        'resourcepack': pywebview.api.delete_resourcepack,
        'shader': pywebview.api.delete_shader,
        'datapack': pywebview.api.delete_datapack
    };

    try {
        // *** THE FIX ***
        await apiFuncMap[type](currentInstance, fileName);
        await refreshInstalledItems(type);
        closeAllModals();
    } catch (e) {
        await showAlert(`Failed to delete item: ${e}`);
    }
    modToDelete = null;
}

async function searchItems(loadMore = false) {
    const query = document.getElementById('modSearchInput').value.trim();
    const resultsContainer = document.getElementById('modSearchResults');
    const spinner = document.getElementById('modSearchSpinner');
    const loadMoreBtn = document.getElementById('loadMoreModsBtn');

    if (loadMore) {
        if (loadMoreBtn) {
            loadMoreBtn.disabled = true;
            loadMoreBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i> ${i18n.t('loading')}`;
        }
    } else {
        modSearchOffset = 0;
        if (query) {
            spinner.style.display = 'block';
            resultsContainer.innerHTML = '';
        } else {
            spinner.style.display = 'none';
            resultsContainer.innerHTML = `<div class="text-center text-zinc-500 pt-16"><i class="fa-solid fa-spinner fa-spin text-3xl"></i><p class="mt-4">Loading popular mods...</p></div>`;
        }
    }

    try {
        const results = await pywebview.api.search_modrinth(query, currentInstance, modSearchOffset, currentItemBrowserType);

        if (!loadMore) {
            resultsContainer.innerHTML = ''; // Clear loading message or previous results
        }
        if (loadMoreBtn) {
            loadMoreBtn.parentElement.remove(); // Remove old button
        }

        if (results.length === 0 && !loadMore) {
            resultsContainer.innerHTML = `<div class="text-center text-zinc-600 pt-16"><p>${query ? `No results found for "${query}"` : 'No compatible items found for this instance.'}</p></div>`;
        } else {
            results.forEach(mod => {
                const modEl = document.createElement('div');
                modEl.className = 'flex items-center gap-4 p-3 bg-zinc-900/50 rounded-lg';
                modEl.innerHTML = `
                    <img src="${mod.icon_url}" alt="${mod.title}" class="w-12 h-12 rounded-md bg-zinc-800 object-cover">
                    <div class="flex-1 overflow-hidden">
                        <h4 class="font-bold text-white truncate">${mod.title}</h4>
                        <p class="text-sm text-zinc-400 truncate">${mod.description}</p>
                    </div>
                    <button id="install-btn-${mod.project_id}" onclick="installItem('${mod.project_id}', this)" class="px-4 py-2 bg-zinc-800 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors">
                        <i class="fa-solid fa-download mr-2"></i> <span data-i18n="install">Install</span>
                    </button>
                `;
                resultsContainer.appendChild(modEl);
            });

            modSearchOffset += results.length;

            if (results.length === 20) { // 20 is the backend limit
                const loadMoreContainer = document.createElement('div');
                loadMoreContainer.innerHTML = `<button id="loadMoreModsBtn" onclick="searchItems(true)" class="w-full mt-4 py-2.5 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white text-sm font-medium transition-colors">${i18n.t('load_more')}</button>`;
                resultsContainer.appendChild(loadMoreContainer);
            }
        }
    } catch (e) {
        resultsContainer.innerHTML = `<div class="text-center text-red-500 pt-16"><p>Error searching for items: ${e}</p></div>`;
        console.error(e);
    } finally {
        spinner.style.display = 'none';
    }
}

async function installItem(projectId, button) {
    if (!currentInstance) {
        await showAlert("Please select an instance first.");
        return;
    }
    button.disabled = true;
    button.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i> <span data-i18n="installing">Installing...</span>`;

    try {
        const result = await pywebview.api.install_item_from_modrinth(currentInstance, projectId);
        if (result.success) {
            button.innerHTML = `<i class="fa-solid fa-check mr-2"></i> <span data-i18n="installed">Installed</span>`;
            let itemType = result.type || 'mod';
            if (itemType === 'shaderpack') itemType = 'shader'; // Defensively handle old values from backend
            refreshInstalledItems(itemType); 
        } else {
            throw new Error(result.error);
        }
    } catch (e) {
        await showAlert(`Failed to install item: ${e}`);
        button.innerHTML = `<i class="fa-solid fa-download mr-2"></i> <span data-i18n="install">Install</span>`;
        button.disabled = false;
    }
}

// --- Custom Modal Logic ---
let alertResolve = null;
let confirmResolve = null;
let promptResolve = null;

function showAlert(message) {
    return new Promise((resolve) => {
        document.getElementById('alertMessage').innerText = message;
        openModal('alertModal');
        alertResolve = resolve;
    });
}

function closeAlert() {
    closeAllModals();
    if (alertResolve) alertResolve();
}

function showConfirm(message) {
    return new Promise((resolve) => {
        document.getElementById('confirmMessage').innerText = message;
        openModal('confirmModal');
        confirmResolve = resolve;
    });
}

function closeConfirm(result) {
    closeAllModals();
    if (confirmResolve) confirmResolve(result);
}

function showPrompt(message, defaultValue = '') {
    return new Promise((resolve) => {
        document.getElementById('promptMessage').innerText = message;
        const input = document.getElementById('promptInput');
        input.value = defaultValue;
        openModal('promptModal');
        input.focus();
        promptResolve = resolve;
    });
}

function closePrompt(result) {
    closeAllModals();
    if (promptResolve) {
        promptResolve(result ? document.getElementById('promptInput').value : null);
    }
}