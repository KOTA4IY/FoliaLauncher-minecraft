const languageGroups = {
    "MOST USED": [
        { code: 'en', name: 'English', flag: '🇺🇸' },
        { code: 'ru', name: 'Русский', flag: '🇷🇺' },
        { code: 'fr', name: 'Français', flag: '🇫🇷' },
        { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    ],
    "SLAVIC": [
        { code: 'ua', name: 'Українська', flag: '🇺🇦' },
        { code: 'be', name: 'Беларуская', flag: '🇧🇾' },
        { code: 'pl', name: 'Polski', flag: '🇵🇱' },
        { code: 'cs', name: 'Čeština', flag: '🇨🇿' },
        { code: 'sk', name: 'Slovenčina', flag: '🇸🇰' },
        { code: 'sl', name: 'Slovenščina', flag: '🇸🇮' },
        { code: 'hr', name: 'Hrvatski', flag: '🇭🇷' },
        { code: 'sr', name: 'Српски', flag: '🇷🇸' },
        { code: 'bs', name: 'Bosanski', flag: '🇧🇦' },
        { code: 'bg', name: 'Български', flag: '🇧🇬' },
    ],
    "ROMANCE": [
        { code: 'es', name: 'Español', flag: '🇪🇸' },
        { code: 'pt', name: 'Português', flag: '🇵🇹' },
        { code: 'it', name: 'Italiano', flag: '🇮🇹' },
        { code: 'ro', name: 'Română', flag: '🇷🇴' },
    ],
    "GERMANIC": [
        { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
        { code: 'da', name: 'Dansk', flag: '🇩🇰' },
        { code: 'sv', name: 'Svenska', flag: '🇸🇪' },
        { code: 'no', name: 'Norsk', flag: '🇳🇴' },
        { code: 'is', name: 'Íslenska', flag: '🇮🇸' },
        { code: 'lb', name: 'Lëtzebuergesch', flag: '🇱🇺' },
    ],
    "URALIC": [
        { code: 'fi', name: 'Suomi', flag: '🇫🇮' },
        { code: 'hu', name: 'Magyar', flag: '🇭🇺' },
        { code: 'et', name: 'Eesti', flag: '🇪🇪' },
    ],
    "BALTIC": [
        { code: 'lv', name: 'Latviešu', flag: '🇱🇻' },
        { code: 'lt', name: 'Lietuvių', flag: '🇱🇹' },
    ],
    "OTHER": [
        { code: 'el', name: 'Ελληνικά', flag: '🇬🇷' },
        { code: 'sq', name: 'Shqip', flag: '🇦🇱' },
        { code: 'ga', name: 'Gaeilge', flag: '🇮🇪' },
    ],
};

const i18n = {
    lang: 'en',
    resources: {},
    languageGroups: languageGroups,
    languages: Object.values(languageGroups).flat(),
    init: function() {
        // Now that all lang files are loaded, populate the resources
        this.resources = {
            ...(typeof mostUsedResources !== 'undefined' ? mostUsedResources : {}),
            ...(typeof slavicResources !== 'undefined' ? slavicResources : {}),
            ...(typeof romanceResources !== 'undefined' ? romanceResources : {}),
            ...(typeof germanicResources !== 'undefined' ? germanicResources : {}),
            ...(typeof uralicResources !== 'undefined' ? uralicResources : {}),
            ...(typeof balticResources !== 'undefined' ? balticResources : {}),
            ...(typeof otherResources !== 'undefined' ? otherResources : {}),
        };
    },
    t: function(key, params = {}) {
        const dict = this.resources[this.lang] || this.resources['en'];
        if (!dict) return key;
        let str = dict.translation[key] || key;
        
        // Замена параметров {{param}}
        Object.keys(params).forEach(param => {
            str = str.replace(new RegExp(`{{${param}}}`, 'g'), params[param]);
        });
        return str;
    },
    changeLanguage: function(lang) {
        if (this.resources[lang]) {
            this.lang = lang;
            this.updatePage();
            this.renderLanguageList();
        }
    },
    updatePage: function() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (key) {
                if (el.tagName === 'INPUT' && el.getAttribute('placeholder')) el.placeholder = this.t(key);
                else el.innerText = this.t(key);
            }
        });
    },
    renderLanguageList: function() {
        const list = document.getElementById('languageList');
        const display = document.getElementById('currentLanguageDisplay');
        
        if (display) {
            const current = this.languages.find(l => l.code === this.lang) || this.languages[0];
            display.innerHTML = `<span class="text-lg">${current.flag}</span> <span class="font-medium">${current.name}</span>`;
        }

        if (!list) return;
        list.innerHTML = '';

        Object.keys(this.languageGroups).forEach(group => {
            const header = document.createElement('div');
            header.className = 'px-2 py-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider mt-1 first:mt-0 sticky top-0 bg-[#18181b] z-10';
            header.textContent = group;
            list.appendChild(header);

            this.languageGroups[group].forEach(lang => {
                const btn = document.createElement('button');
                const isActive = this.lang === lang.code;
                btn.className = `w-full text-left px-2 py-1.5 rounded-lg flex items-center gap-3 transition-colors ${isActive ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}`;
                btn.onclick = () => {
                    this.changeLanguage(lang.code);
                    if (typeof toggleDropdown === 'function') toggleDropdown('languageDropdownMenu');
                };
                btn.innerHTML = `
                    <span class="text-lg leading-none">${lang.flag}</span>
                    <span class="text-sm font-medium flex-1">${lang.name}</span>
                    ${isActive ? '<i class="fa-solid fa-check text-emerald-500 text-xs"></i>' : ''}
                `;
                list.appendChild(btn);
            });
        });
    }
};

// Делаем доступным глобально
window.i18n = i18n;
