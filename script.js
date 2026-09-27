// Data Structure
const routine = [
    {
        id: 'chest',
        name: 'Chest',
        icon: 'fa-child-reaching',
        exercises: ['Incline Chest Press', 'Flat Chest Press', 'Incline Chest Fly', 'Flat Chest Fly', 'Pushups']
    },
    {
        id: 'legs',
        name: 'Legs & Abs',
        icon: 'fa-shoe-prints',
        exercises: ['Prisoner Squats', 'Chair Squats', 'Goblet Squats', 'Lunges', 'Calf Raises', 'Leg Extension', 'Cable Crunches (Heavy)', 'Hanging Knee Raises', 'Planks (Log seconds as Reps)']
    },
    {
        id: 'shoulders',
        name: 'Shoulder',
        icon: 'fa-person-arrow-up-from-line',
        exercises: ['Seated Shoulder Press (75-80°)', 'Side Lateral Raises', 'Front Raises', 'Dumbbell Shrugs']
    },
    {
        id: 'back',
        name: 'Back',
        icon: 'fa-person-walking-luggage',
        exercises: ['Machine Pulldown (Straight Grip)', 'Machine Pulldown (Reverse Grip)', 'One-Arm Dumbbell Row (Knee on bench)', 'Incline Back Press/Row', 'Placeholder: Back']
    },
    {
        id: 'arms',
        name: 'Arms & Abs',
        icon: 'fa-hand-fist',
        exercises: ['Bicep Curl', 'Hammer Curl', 'Concentration Curl (Elbow on leg)', 'Overhead Tricep Extension (Both hands)', 'Bench Dips (Legs down)', 'Placeholder: Tricep', 'Weighted Flat Crunches (Knees Bent)', 'Russian Twists (With Weight)', 'Bicycle Crunches']
    }
];

// State
let workoutHistory = JSON.parse(localStorage.getItem('auraHistory')) || [];
let apiKey = localStorage.getItem('auraGeminiKey') || '';
let currentDayId = 'chest';
let workoutTimer = null;
let workoutSeconds = 0;
let volumeChartInstance = null;
let chatHistory = [
    { role: 'user', parts: [{ text: "I am a beginner starting a 5-day workout split. Be my ruthless, hardcore, motivating AI personal trainer. Use short, punchy, aggressive motivation." }] },
    { role: 'model', parts: [{ text: "No excuses today. You log the sets, I track the gains. Let's get to work. What do you need?" }] }
];

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    initUI();
    updateDashboard();
    renderRoutineTabs();
    selectDay('chest');
    initChart();
});

// UI Logic
function switchTab(tabId) {
    if(typeof playClick === 'function') playClick();
    document.querySelectorAll('main > div').forEach(el => {
        if(el.id.startsWith('tab-')) el.classList.add('hidden');
    });
    document.getElementById(`tab-${tabId}`).classList.remove('hidden');
    
    // Reset all nav buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('text-red-600');
        btn.classList.add('text-gray-600');
    });
    
    // Activate target nav button
    const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if(activeBtn) {
        activeBtn.classList.remove('text-gray-600');
        activeBtn.classList.add('text-red-600');
    }

    if(tabId === 'progress') {
        updateProgressChart();
        renderRecentLogs();
    }
}

function updateDashboard() {
    // Gamification Logic
    const XP_PER_WORKOUT = 100;
    const totalXP = workoutHistory.length * XP_PER_WORKOUT;
    const level = Math.floor(totalXP / 500) + 1;
    const currentLevelXP = totalXP % 500;
    const xpPercent = (currentLevelXP / 500) * 100;
    
    document.getElementById('hdr-level').innerText = level;
    document.getElementById('dash-level').innerText = level;
    document.getElementById('dash-xp').innerText = currentLevelXP;
    document.getElementById('dash-xp-bar').style.width = `${xpPercent}%`;
    
    document.getElementById('dash-workout-count').innerText = workoutHistory.length;
    let totalVol = workoutHistory.reduce((sum, session) => sum + session.totalVolume, 0);
    document.getElementById('dash-total-volume').innerText = totalVol.toLocaleString();
}

// Workout Logic
function renderRoutineTabs() {
    const container = document.getElementById('day-selector');
    container.innerHTML = '';
    routine.forEach(day => {
        const btn = document.createElement('button');
        btn.onclick = () => selectDay(day.id);
        const isActive = day.id === currentDayId;
        
        btn.className = `snap-center flex-shrink-0 flex flex-col items-center justify-center w-20 h-20 border transition-all ${isActive ? 'blood-bg border-red-500 text-black shadow-lg shadow-red-900/50 scale-105' : 'bg-black/60 border-gray-800 text-gray-500 hover:border-red-900/50'}`;
        btn.innerHTML = `<i class="fa-solid ${day.icon} text-2xl mb-1"></i><span class="text-[10px] font-bold uppercase tracking-widest">${day.name}</span>`;
        container.appendChild(btn);
    });
}

function selectDay(dayId) {
    if(typeof playClick === 'function') playClick();
    currentDayId = dayId;
    renderRoutineTabs();
    
    const dayData = routine.find(d => d.id === dayId);
    document.getElementById('current-workout-title').innerText = dayData.name;
    
    const list = document.getElementById('exercise-list');
    list.innerHTML = '';
    
    // Store active sets state
    window.currentWorkoutSets = {};
    
    dayData.exercises.forEach((ex, index) => {
        // Default 3 locked sets
        window.currentWorkoutSets[index] = [ { reps: 12, weight: '' }, { reps: 10, weight: '' }, { reps: 8, weight: '' } ];
        
        const div = document.createElement('div');
        div.className = 'hardcore-panel p-5 mb-4 border-l-4 border-l-red-600';
        
        let setsHtml = '';
        window.currentWorkoutSets[index].forEach((set, sIndex) => {
            setsHtml += `
                <div class="flex items-center gap-3 mt-3">
                    <div class="w-8 h-8 bg-red-900/30 text-red-500 border border-red-900/50 font-bebas text-lg flex items-center justify-center flex-shrink-0">${sIndex + 1}</div>
                    
                    <div class="flex-1 relative">
                        <input type="number" inputmode="decimal" placeholder="REPS" value="${set.reps}" oninput="updateSet(${index}, ${sIndex}, 'reps', this.value)" class="w-full py-3 pl-4 pr-2 text-lg font-bebas tracking-wide focus:border-red-600 transition-colors">
                        <span class="absolute right-3 top-3.5 text-[10px] text-gray-500 font-bold uppercase">Reps</span>
                    </div>
                    
                    <div class="flex-1 relative">
                        <input type="number" inputmode="decimal" placeholder="KG" value="${set.weight}" oninput="updateSet(${index}, ${sIndex}, 'weight', this.value)" class="ex-weight w-full py-3 pl-4 pr-2 text-lg font-bebas tracking-wide focus:border-red-600 transition-colors">
                        <span class="absolute right-3 top-3.5 text-[10px] text-gray-500 font-bold uppercase">KG</span>
                    </div>
                </div>
            `;
        });

        div.innerHTML = `
            <h3 class="font-bebas text-2xl text-white mb-2 tracking-wide uppercase"><span class="text-red-600 mr-2">${index + 1}.</span>${ex}</h3>
            <div class="flex flex-col gap-1">
                ${setsHtml}
            </div>
        `;
        
        list.appendChild(div);
    });

    checkWorkoutValid();
}

window.updateSet = function(exIndex, sIndex, field, value) {
    window.currentWorkoutSets[exIndex][sIndex][field] = value;
    checkWorkoutValid();
};

function checkWorkoutValid() {
    let hasValue = false;
    Object.values(window.currentWorkoutSets).forEach(sets => {
        sets.forEach(set => {
            if(parseFloat(set.weight) > 0) hasValue = true;
        });
    });
    
    const btn = document.getElementById('save-workout-btn');
    if(hasValue) {
        btn.classList.remove('opacity-50');
        btn.onclick = saveWorkout;
    } else {
        btn.classList.add('opacity-50');
        btn.onclick = null;
    }
}

function saveWorkout() {
    const dayData = routine.find(d => d.id === currentDayId);
    let sessionVolume = 0;
    let exerciseLogs = [];

    Object.keys(window.currentWorkoutSets).forEach(exIndexStr => {
        const exIndex = parseInt(exIndexStr);
        const name = dayData.exercises[exIndex];
        const sets = window.currentWorkoutSets[exIndex];
        
        let exVolume = 0;
        let validSets = [];
        
        sets.forEach(set => {
            const r = parseFloat(set.reps) || 0;
            const w = parseFloat(set.weight) || 0;
            if(w > 0 && r > 0) {
                exVolume += (r * w);
                validSets.push({ reps: r, weight: w });
            }
        });
        
        if (exVolume > 0) {
            sessionVolume += exVolume;
            exerciseLogs.push({ name, sets: validSets, vol: exVolume });
        }
    });

    if(sessionVolume === 0) return;

    const session = {
        date: new Date().toISOString(),
        dayId: currentDayId,
        dayName: dayData.name,
        totalVolume: sessionVolume,
        duration: workoutSeconds,
        exercises: exerciseLogs
    };

    workoutHistory.push(session);
    localStorage.setItem('auraHistory', JSON.stringify(workoutHistory));
    
    // Reset Timer
    if (workoutTimer) {
        clearInterval(workoutTimer);
        workoutTimer = null;
    }
    workoutSeconds = 0;
    document.getElementById('workout-timer-display').innerText = '00:00';
    const timerBtn = document.getElementById('timer-toggle-btn');
    timerBtn.innerText = 'START';
    timerBtn.classList.remove('bg-gray-700', 'text-white');
    timerBtn.classList.add('blood-bg', 'text-black');
    
    if(typeof playSuccess === 'function') playSuccess();
    updateDashboard();
    selectDay(currentDayId);
    
    switchTab('dashboard');
    window.scrollTo(0,0);
}

// Progress Logic
function initChart() {
    const ctx = document.getElementById('volumeChart').getContext('2d');
    volumeChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Volume (kg)',
                data: [],
                backgroundColor: 'rgba(220, 38, 38, 0.9)', // Red bars
                borderRadius: 2,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#6b7280', font:{family:'Bebas Neue', size: 14} } },
                x: { grid: { display: false }, ticks: { color: '#6b7280', font:{family:'Bebas Neue', size: 14} } }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function updateProgressChart() {
    if(!volumeChartInstance) return;
    const labels = workoutHistory.map(h => new Date(h.date).toLocaleDateString(undefined, {month:'short', day:'numeric'}));
    const data = workoutHistory.map(h => h.totalVolume);
    volumeChartInstance.data.labels = labels;
    volumeChartInstance.data.datasets[0].data = data;
    volumeChartInstance.update();
}

function renderRecentLogs() {
    const container = document.getElementById('recent-logs');
    if(workoutHistory.length === 0) {
        container.innerHTML = '<p class="text-gray-500 font-bebas text-center py-8 tracking-wider">NO HISTORY. START LIFTING.</p>';
        return;
    }
    
    container.innerHTML = '';
    const reversed = [...workoutHistory].reverse().slice(0, 10);
    
    reversed.forEach(log => {
        const div = document.createElement('div');
        div.className = 'hardcore-panel p-4 flex justify-between items-center border-l-2 border-l-red-600';
        const durStr = log.duration ? Math.floor(log.duration/60) + 'm ' + (log.duration%60) + 's' : '';
        div.innerHTML = `
            <div>
                <p class="font-bebas text-xl text-white tracking-wider">${log.dayName}</p>
                <p class="text-[10px] text-gray-500 font-bold uppercase">${new Date(log.date).toLocaleDateString()} ${durStr ? '• ' + durStr : ''}</p>
            </div>
            <div class="text-right">
                <p class="font-bebas text-red-500 text-2xl">${log.totalVolume.toLocaleString()} <span class="text-[12px] text-gray-500">KG</span></p>
            </div>
        `;
        container.appendChild(div);
    });
}

// AI logic
function toggleApiSettings() {
    const el = document.getElementById('api-settings');
    el.classList.toggle('hidden');
    document.getElementById('api-key-input').value = apiKey;
}

function saveApiKey() {
    apiKey = document.getElementById('api-key-input').value.trim();
    localStorage.setItem('auraGeminiKey', apiKey);
    toggleApiSettings();
    alert('API Key saved!');
}

document.getElementById('chat-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if(!text) return;

    if(!apiKey) {
        alert("Enter API Key in settings first.");
        toggleApiSettings();
        return;
    }

    addChatMessage('user', text);
    input.value = '';

    chatHistory.push({ role: 'user', parts: [{ text: text }] });

    const loadingId = 'loading-' + Date.now();
    addChatMessage('ai', '<i class="fa-solid fa-spinner fa-spin"></i> Processing...', loadingId);

    try {
        let statsContext = `Context: The user has logged ${workoutHistory.length} workouts. Total volume: ${workoutHistory.reduce((a,b)=>a+b.totalVolume,0)}kg. Routine: 5 days. Keep tone hardcore, aggressive, and short.`;
        
        let requestHistory = [...chatHistory];
        requestHistory[requestHistory.length-1].parts[0].text = `${statsContext}\n\nUser: ${text}`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: requestHistory,
                generationConfig: { maxOutputTokens: 300, temperature: 0.7 }
            })
        });

        if(!response.ok) throw new Error("API Error");
        
        const data = await response.json();
        const reply = data.candidates[0].content.parts[0].text;
        
        chatHistory.push({ role: 'model', parts: [{ text: reply }] });
        document.getElementById(loadingId).innerHTML = marked.parse(reply);
    } catch(err) {
        document.getElementById(loadingId).innerHTML = `<span class="text-red-500 font-bold uppercase">Connection Failure.</span>`;
        chatHistory.pop();
    }
    
    scrollToBottom();
});

function addChatMessage(role, htmlContent, id = null) {
    const chatMsgs = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = `p-4 max-w-[85%] text-sm ${role === 'user' ? 'bg-red-700 ml-auto rounded-tl-xl rounded-bl-xl rounded-tr-xl text-white' : 'border border-red-900/50 bg-black rounded-tr-xl rounded-br-xl rounded-bl-xl text-gray-300'}`;
    if(id) div.id = id;
    
    if(role === 'ai') {
        div.innerHTML = `<div class="font-bebas text-red-600 text-lg mb-1 tracking-wide"><i class="fa-solid fa-skull"></i> Trainer</div><div class="prose prose-invert prose-sm">${htmlContent}</div>`;
    } else {
        div.innerHTML = htmlContent;
    }
    
    chatMsgs.appendChild(div);
    scrollToBottom();
}

function scrollToBottom() {
    const el = document.getElementById('chat-messages');
    el.scrollTop = el.scrollHeight;
}

function initUI() {
    if(!apiKey) {
        document.getElementById('api-settings').classList.remove('hidden');
    }
}

function clearData() {
    if(confirm('WIPE ALL DATA? You will lose all XP and History.')) {
        localStorage.removeItem('auraHistory');
        workoutHistory = [];
        updateDashboard();
        if(currentDayId) selectDay(currentDayId);
        switchTab('dashboard');
    }
}


// ==========================================
// SOUND EFFECTS & MUSIC
// ==========================================
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playClick() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(100, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
}

function playSuccess() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.5);
    
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
}

// ==========================================
// MUSIC PLAYER & SOUND EFFECTS
// ==========================================
const playlist = [
    { title: "AURA RADIO", artist: "FreeCodeCamp", src: "https://coderadio-admin.freecodecamp.org/radio/8000/radio.mp3" }
];
for(let i = 1; i <= 100; i++) {
    playlist.push({ title: "TRACK " + i, artist: "LOCAL MUSIC", src: i + ".mp3" });
}
let currentTrackIndex = 0;

const audioPlayer = document.getElementById('bg-music');

function loadTrack(index) {
    const track = playlist[index];
    audioPlayer.src = track.src;
    document.getElementById('track-title').innerText = track.title;
    document.getElementById('track-artist').innerText = track.artist;
    
    // Update Media Session API for Lock Screen Controls
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: track.title,
            artist: track.artist,
            album: 'AURA GYM',
            artwork: [
                { src: 'https://cdn-icons-png.flaticon.com/512/2964/2964098.png', sizes: '512x512', type: 'image/png' }
            ]
        });
    }
}

function toggleMusic() {
    const btn = document.getElementById('play-pause-btn');
    
    // If empty src, load first track
    if (!audioPlayer.src || audioPlayer.src === window.location.href) {
        loadTrack(currentTrackIndex);
    }
    
    if (audioPlayer.paused) {
        audioPlayer.play().catch(e => console.log('Playback prevented', e));
        btn.innerHTML = '<i class="fa-solid fa-pause"></i>';
        btn.classList.add('bg-white');
        btn.classList.remove('blood-bg');
    } else {
        audioPlayer.pause();
        btn.innerHTML = '<i class="fa-solid fa-play ml-1"></i>';
        btn.classList.remove('bg-white');
        btn.classList.add('blood-bg');
    }
    if(typeof playClick === 'function') playClick();
}

function nextTrack() {
    currentTrackIndex = (currentTrackIndex + 1) % playlist.length;
    loadTrack(currentTrackIndex);
    audioPlayer.play().catch(e => console.log(e));
    const btn = document.getElementById('play-pause-btn');
    btn.innerHTML = '<i class="fa-solid fa-pause"></i>';
    if(typeof playClick === 'function') playClick();
}

function prevTrack() {
    currentTrackIndex = (currentTrackIndex - 1 + playlist.length) % playlist.length;
    loadTrack(currentTrackIndex);
    audioPlayer.play().catch(e => console.log(e));
    const btn = document.getElementById('play-pause-btn');
    btn.innerHTML = '<i class="fa-solid fa-pause"></i>';
    if(typeof playClick === 'function') playClick();
}

// Auto-play next track when ended
audioPlayer.addEventListener('ended', nextTrack);

// Media Session Handlers
if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', toggleMusic);
    navigator.mediaSession.setActionHandler('pause', toggleMusic);
    navigator.mediaSession.setActionHandler('previoustrack', prevTrack);
    navigator.mediaSession.setActionHandler('nexttrack', nextTrack);
}

// Load initial text
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('track-title').innerText = playlist[0].title;
    document.getElementById('track-artist').innerText = playlist[0].artist;
});

// duplicate removed


// ==========================================
// WORKOUT TIMER
// ==========================================
function toggleTimer() {
    const btn = document.getElementById('timer-toggle-btn');
    if (workoutTimer) {
        // Pause
        clearInterval(workoutTimer);
        workoutTimer = null;
        btn.innerText = 'RESUME';
        btn.classList.remove('bg-gray-700', 'text-white');
        btn.classList.add('blood-bg', 'text-black');
    } else {
        // Start
        workoutTimer = setInterval(() => {
            workoutSeconds++;
            const m = Math.floor(workoutSeconds / 60).toString().padStart(2, '0');
            const s = (workoutSeconds % 60).toString().padStart(2, '0');
            document.getElementById('workout-timer-display').innerText = m + ':' + s;
        }, 1000);
        btn.innerText = 'PAUSE';
        btn.classList.remove('blood-bg', 'text-black');
        btn.classList.add('bg-gray-700', 'text-white');
    }
    if(typeof playClick === 'function') playClick();
}
