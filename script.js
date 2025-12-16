// --- КОНФИГУРАЦИЯ БАЗЫ ДАННЫХ (INDEXEDDB) ---
const DB_NAME = "MyGalleryDB";
const DB_VERSION = 1;
let db;

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            db = e.target.result;
            if (!db.objectStoreNames.contains("media")) {
                const store = db.createObjectStore("media", { keyPath: "id", autoIncrement: true });
                store.createIndex("season", "season", { unique: false });
                store.createIndex("month", "month", { unique: false });
            }
        };
        request.onsuccess = (e) => {
            db = e.target.result;
            resolve(db);
        };
        request.onerror = (e) => reject(e);
    });
}

function saveMedia(file, explicitSeason, explicitMonth) {
    return new Promise((resolve) => {
        const transaction = db.transaction(["media"], "readwrite");
        const store = transaction.objectStore("media");
        
        const now = new Date(); 
        const monthIndex = now.getMonth(); 
        const seasons = ["Зима", "Зима", "Весна", "Весна", "Весна", "Лето", "Лето", "Лето", "Осень", "Осень", "Осень", "Зима"];
        const monthsNames = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
        
        const item = {
            file: file, 
            type: file.type.startsWith('video') ? 'video' : 'image',
            season: explicitSeason || seasons[monthIndex],
            month: explicitMonth || monthsNames[monthIndex],
            date: now.toLocaleDateString() + ' ' + now.toLocaleTimeString(),
            location: "Неизвестно"
        };
        store.add(item);
        transaction.oncomplete = () => resolve();
    });
}

function getMediaByMonth(monthName) {
    return new Promise((resolve) => {
        const transaction = db.transaction(["media"], "readonly");
        const store = transaction.objectStore("media");
        const index = store.index("month");
        const request = index.getAll(monthName);
        request.onsuccess = () => resolve(request.result);
    });
}

// --- ЛОГИКА ТЕМЫ (СОХРАНЕНИЕ / ПЕРЕКЛЮЧЕНИЕ) ---
let currentTheme = 'dark'; // Начальное значение

function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        currentTheme = savedTheme;
    }
    applyTheme();
}

function applyTheme() {
    const body = document.body;
    const icon = document.getElementById('theme-icon');
    const loaderLight = document.getElementById('loader-light');
    const loaderDark = document.getElementById('loader-dark');
    
    if (currentTheme === 'light') {
        body.classList.remove('theme-dark');
        body.classList.add('theme-light');
        icon.className = 'fa-solid fa-moon'; 
        // Показываем нужный лоадер, если он еще не скрыт
        if (!document.getElementById('loader-screen').classList.contains('hidden')) {
             loaderLight.classList.remove('hidden');
             loaderDark.classList.add('hidden');
        }
    } else {
        body.classList.remove('theme-light');
        body.classList.add('theme-dark');
        icon.className = 'fa-solid fa-sun'; 
        // Показываем нужный лоадер, если он еще не скрыт
        if (!document.getElementById('loader-screen').classList.contains('hidden')) {
            loaderDark.classList.remove('hidden');
            loaderLight.classList.add('hidden');
        }
    }
}

function toggleTheme() {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', currentTheme);
    applyTheme();
}


// --- ЛОГИКА ИНТЕРФЕЙСА И ГАЛЕРЕИ ---
const seasonsData = {
    "Зима": ["Декабрь", "Январь", "Февраль"],
    "Весна": ["Март", "Апрель", "Май"],
    "Лето": ["Июнь", "Июль", "Август"],
    "Осень": ["Сентябрь", "Октябрь", "Ноябрь"]
};

let currentView = 'seasons'; 
let currentSeason = '';
let currentMonth = '';
let selectedItems = new Set(); 
let viewingItem = null; 

// --- ЗАПУСК ПРИЛОЖЕНИЯ ---
window.addEventListener('load', async () => {
    loadTheme(); // Загружаем и применяем тему

    // Инициализация лоадеров при запуске (чтобы показать правильный)
    const loaderLight = document.getElementById('loader-light');
    const loaderDark = document.getElementById('loader-dark');
    if (currentTheme === 'light') {
        loaderLight.classList.remove('hidden');
        loaderDark.classList.add('hidden');
    } else {
        loaderDark.classList.remove('hidden');
        loaderLight.classList.add('hidden');
    }

    // Обработчик переключения темы
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

    // Скрываем лоадер после задержки и инициализации
    setTimeout(() => {
        document.getElementById('loader-screen').style.opacity = '0';
        setTimeout(async () => {
            document.getElementById('loader-screen').classList.add('hidden');
            document.getElementById('app').classList.remove('hidden');
            
            await initDB();
            renderSeasons();
        }, 500);
    }, 1200); // Базовая задержка 1.2с
});

// *** DRAG AND DROP ЛОГИКА ***
async function handleDrop(e, targetSeason, targetMonth) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over'); 
    
    const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/') || file.type.startsWith('video/'));
    if(files.length === 0) return;

    for (const file of files) {
        await saveMedia(file, targetSeason, targetMonth); 
    }

    // Обновляем текущий вид
    if (currentView === 'gallery' && currentMonth === targetMonth) {
        renderGallery(currentMonth);
    } else if (currentView === 'months' && currentSeason === targetSeason) {
        renderMonths(currentSeason);
    } else if (currentView === 'seasons') {
        renderSeasons();
    }
    
    alert(`Загружено ${files.length} файлов!`);
}

function addDropListeners(element, targetSeason, targetMonth) {
    element.addEventListener('dragover', (e) => {
        e.preventDefault(); 
        element.classList.add('drag-over'); 
    });
    element.addEventListener('dragleave', (e) => {
        element.classList.remove('drag-over'); 
    });
    element.addEventListener('drop', (e) => handleDrop(e, targetSeason, targetMonth));
}
// *** КОНЕЦ DRAG AND DROP ЛОГИКИ ***

// Рендер сезонов (Главная)
function renderSeasons() {
    currentView = 'seasons';
    currentSeason = '';
    currentMonth = '';
    updateBreadcrumbs();
    const container = document.getElementById('grid-container');
    const galContainer = document.getElementById('gallery-container');
    container.classList.remove('hidden');
    galContainer.classList.add('hidden');
    container.innerHTML = '';

    const icons = { "Зима": "fa-snowflake", "Весна": "fa-seedling", "Лето": "fa-sun", "Осень": "fa-leaf" };

    Object.keys(seasonsData).forEach(season => {
        const div = document.createElement('div');
        div.className = 'folder-card';
        div.innerHTML = `<i class="fa-solid ${icons[season]} folder-icon"></i><div class="folder-name">${season}</div>`;
        div.onclick = () => renderMonths(season);
        
        addDropListeners(div, season, null);
        
        container.appendChild(div);
    });

    hideActionBar();
}
window.goHome = renderSeasons; 

// Рендер месяцев
function renderMonths(season) {
    currentView = 'months';
    currentSeason = season;
    currentMonth = '';
    updateBreadcrumbs();
    const container = document.getElementById('grid-container');
    container.classList.remove('hidden');
    document.getElementById('gallery-container').classList.add('hidden');
    container.innerHTML = '';

    seasonsData[season].forEach(month => {
        const div = document.createElement('div');
        div.className = 'folder-card';
        div.innerHTML = `<i class="fa-solid fa-folder folder-icon"></i><div class="folder-name">${month}</div>`;
        div.onclick = () => renderGallery(month);

        addDropListeners(div, season, month);

        container.appendChild(div);
    });
}

// Рендер галереи
async function renderGallery(month) {
    currentView = 'gallery';
    currentMonth = month;
    updateBreadcrumbs();
    document.getElementById('grid-container').classList.add('hidden');
    const galContainer = document.getElementById('gallery-container');
    galContainer.classList.remove('hidden');
    galContainer.innerHTML = '';

    const items = await getMediaByMonth(month);

    if(items.length === 0) {
        galContainer.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Пусто. Добавьте фото/видео через кнопку или Drag & Drop.</p>';
    }

    addDropListeners(galContainer, currentSeason, currentMonth);

    items.forEach(item => {
        const wrapper = document.createElement('div');
        wrapper.className = 'gallery-item';
        wrapper.dataset.id = item.id;

        // Элементы для выделения
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `cbx-${item.id}`;
        checkbox.style.display = 'none';

        const label = document.createElement('label');
        label.htmlFor = `cbx-${item.id}`;
        label.className = 'check';
        label.innerHTML = `<svg width="18px" height="18px" viewBox="0 0 18 18"><path d="M1,9 L1,3.5 C1,2 2,1 3.5,1 L14.5,1 C16,1 17,2 17,3.5 L17,14.5 C17,16 16,17 14.5,17 L3.5,17 C2,17 1,16 1,14.5 L1,9 Z"/><polyline points="1 9 7 14 15 4"/></svg>`;

        wrapper.appendChild(checkbox);
        wrapper.appendChild(label);

        // Обработчики выделения и просмотра
        checkbox.addEventListener('change', (e) => {
            e.stopPropagation();
            toggleSelection(item.id, wrapper);
        });
        wrapper.addEventListener('click', (e) => {
            if (e.target.closest('.check')) { return; }
            openViewer(item);
        });

        const url = URL.createObjectURL(item.file);
        if (item.type === 'video') {
            const vid = document.createElement('video');
            vid.src = url;
            vid.controls = false; 
            vid.muted = true;
            vid.preload = 'metadata';
            wrapper.appendChild(vid);
        } else {
            const img = document.createElement('img');
            img.src = url;
            wrapper.appendChild(img);
        }

        const meta = document.createElement('div');
        meta.className = 'meta-info';
        meta.innerHTML = `<span>${item.date.split(' ')[1]}</span><span>${item.location}</span>`;
        wrapper.appendChild(meta);

        galContainer.appendChild(wrapper);
    });
}

// --- ПРОСМОТРЩИК ---
function openViewer(item) {
    const viewerOverlay = document.getElementById('viewer');
    const viewerContent = viewerOverlay.querySelector('.view-item');
    
    viewerContent.innerHTML = '';
    
    let mediaElement;
    const url = URL.createObjectURL(item.file);

    if (item.type === 'video') {
        mediaElement = document.createElement('video');
        mediaElement.src = url;
        mediaElement.controls = true;
        mediaElement.autoplay = true;
        mediaElement.loop = true;
        mediaElement.muted = false;
    } else {
        mediaElement = document.createElement('img');
        mediaElement.src = url;
    }

    viewerContent.appendChild(mediaElement);
    viewerOverlay.classList.remove('hidden');
    viewingItem = item;
}

function closeViewer() {
    const viewerOverlay = document.getElementById('viewer');
    viewerOverlay.classList.add('hidden'); 
    // Остановка видео, если оно проигрывается
    const media = viewerOverlay.querySelector('.view-item video, .view-item img');
    if (media && media.tagName === 'VIDEO') {
        media.pause();
        media.currentTime = 0;
    }
    viewerOverlay.querySelector('.view-item').innerHTML = '';
    viewingItem = null;
}

// --- ВЫДЕЛЕНИЕ / ПАНЕЛЬ ДЕЙСТВИЙ ---
function toggleSelection(id, element) {
    id = parseInt(id);
    if (selectedItems.has(id)) {
        selectedItems.delete(id);
        element.classList.remove('selected');
    } else {
        selectedItems.add(id);
        element.classList.add('selected');
    }
    updateActionBar();
}

function updateActionBar() {
    const bar = document.getElementById('action-bar');
    const count = document.getElementById('selected-count');
    count.innerText = `${selectedItems.size} выбрано`;
    if (selectedItems.size > 0) {
        bar.classList.remove('hidden');
    } else {
        bar.classList.add('hidden');
    }
}

function hideActionBar() {
    selectedItems.clear();
    document.getElementById('action-bar').classList.add('hidden');
    document.querySelectorAll('.gallery-item').forEach(el => {
        el.classList.remove('selected');
        const checkbox = el.querySelector('input[type="checkbox"]');
        if (checkbox) checkbox.checked = false;
    });
}

// --- Скачивание / Удаление ---
async function downloadSelected() {
    if (selectedItems.size === 0) return;
    
    const transaction = db.transaction(["media"], "readonly");
    const store = transaction.objectStore("media");

    selectedItems.forEach(id => {
        const request = store.get(id);
        request.onsuccess = () => {
            const item = request.result;
            const url = URL.createObjectURL(item.file);
            const a = document.createElement('a');
            a.href = url;
            a.download = `media_${item.id}.${item.type === 'video' ? 'mp4' : 'jpg'}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url); 
        };
    });
    hideActionBar();
}

function deleteSelected() {
    if (selectedItems.size === 0) return;

    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>Удалить выбранные файлы?</h3>
            <p>Вы действительно хотите удалить ${selectedItems.size} файл${selectedItems.size === 1 ? '' : 'а'}?</p>
            <div class="modal-buttons">
                <button class="red-btn" id="confirm-delete">Удалить</button>
                <button id="cancel-delete">Отмена</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('confirm-delete').onclick = function() {
        const transaction = db.transaction(["media"], "readwrite");
        const store = transaction.objectStore("media");

        selectedItems.forEach(id => {
            store.delete(id);
        });

        transaction.oncomplete = () => {
            modal.remove();
            hideActionBar();
            // Обновляем текущий вид после удаления
            if (currentView === 'gallery') {
                renderGallery(currentMonth);
            } else if (currentView === 'months') {
                renderMonths(currentSeason);
            } else {
                renderSeasons();
            }
        };
    };

    document.getElementById('cancel-delete').onclick = function() {
        modal.remove();
    };
}

// --- Хлебные крошки ---
function updateBreadcrumbs() {
    const bSeason = document.getElementById('crumb-season');
    const bMonth = document.getElementById('crumb-month');

    bSeason.innerText = currentSeason ? `> ${currentSeason}` : '';
    bMonth.innerText = currentMonth ? `> ${currentMonth}` : '';

    // Переиспользуем goHome для первого элемента
    document.getElementById('crumb-home').onclick = renderSeasons;

    bSeason.onclick = currentSeason ? () => renderMonths(currentSeason) : null;
    bMonth.onclick = currentMonth ? () => renderGallery(currentMonth) : null;
}

// Загрузка файлов через кнопку
document.getElementById('fileInput').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files).filter(file => file.type.startsWith('image/') || file.type.startsWith('video/'));
    if(files.length === 0) return;

    const now = new Date();
    const monthIndex = now.getMonth();
    const seasons = ["Зима", "Зима", "Весна", "Весна", "Весна", "Лето", "Лето", "Лето", "Осень", "Осень", "Осень", "Зима"];
    const monthsNames = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
    
    const defaultSeason = seasons[monthIndex];
    const defaultMonth = monthsNames[monthIndex];

    for (const file of files) {
        await saveMedia(file, defaultSeason, defaultMonth);
    }
    
    alert(`Загружено ${files.length} файлов в: ${defaultSeason}, ${defaultMonth}`);

    // Обновляем текущий вид
    if (currentView === 'gallery' && currentMonth === defaultMonth) {
        renderGallery(currentMonth);
    } else if (currentView === 'months' && currentSeason === defaultSeason) {
        renderMonths(currentSeason);
    } else {
        renderSeasons();
    }
});

