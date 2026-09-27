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
        exercises: ['Seated Shoulder Press (75-80°)', 'Side Lateral Raises', 'Front Raises', 'Dumbbell Shrugs', 'Placeholder: Shoulder']
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
        exercises: ['Bicep Curl', 'Hammer Curl', 'Concentration Curl (Elbow on leg)', 'Overhead Tricep Extension (Both hands)', 'Bench Dips (Legs down)', 'Placeholder: Tricep', 'Weighted Decline Crunches', 'Russian Twists (With Weight)', 'Bicycle Crunches']
    }
];

// State
let workoutHistory = JSON.parse(localStorage.getItem('auraHistory')) || [];
let apiKey = localStorage.getItem('auraGeminiKey') || '';
let currentDayId = 'chest';
let volumeChartInstance = null;
let chatHistory = [
    { role: 'user', parts: [{ text: "I am a beginner starting a 5-day workout split (Chest, Legs, Shoulders, Back, Arms). Be my motivating, expert AI personal trainer." }] },
    { role: 'model', parts: [{ text: "I am ready! I'll be your expert personal trainer. Let's build some muscle and stay consistent. What do you need help with today?" }] }
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
    document.querySelectorAll('main > div').forEach(el => {
        if(el.id.startsWith('tab-')) el.classList.add('hidden');
    });
    document.getElementById(`tab-${tabId}`).classList.remove('hidden');
    
    // Reset all nav buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('text-blue-500');
        btn.classList.add('text-gray-500');
    });
    
    // Activate target nav button
    const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if(activeBtn) {
        activeBtn.classList.remove('text-gray-500');
        activeBtn.classList.add('text-blue-500');
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
        
        btn.className = `snap-center flex-shrink-0 flex flex-col items-center justify-center w-20 h-20 rounded-3xl transition-all ${isActive ? 'gradient-bg shadow-lg shadow-blue-500/30 text-white scale-105' : 'bg-gray-800 text-gray-400 opacity-70'}`;
        btn.innerHTML = `<i class="fa-solid ${day.icon} text-2xl mb-1"></i><span class="text-[10px] font-bold uppercase tracking-wider">${day.name}</span>`;
        container.appendChild(btn);
    });
}

function selectDay(dayId) {
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
        div.className = 'glass-panel rounded-3xl p-5 mb-4 shadow-md';
        
        let setsHtml = '';
        window.currentWorkoutSets[index].forEach((set, sIndex) => {
            setsHtml += `
                <div class="flex items-center gap-3 mt-3">
                    <div class="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center text-xs flex-shrink-0">${sIndex + 1}</div>
                    
                    <div class="flex-1 relative">
                        <input type="number" inputmode="decimal" placeholder="Reps" value="${set.reps}" oninput="updateSet(${index}, ${sIndex}, 'reps', this.value)" class="w-full bg-gray-900 border-none rounded-2xl py-3 pl-4 pr-2 text-lg font-bold text-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-600 transition-shadow">
                        <span class="absolute right-3 top-3 text-xs text-gray-500 font-bold uppercase">Reps</span>
                    </div>
                    
                    <div class="flex-1 relative">
                        <input type="number" inputmode="decimal" placeholder="Weight" value="${set.weight}" oninput="updateSet(${index}, ${sIndex}, 'weight', this.value)" class="ex-weight w-full bg-gray-900 border-none rounded-2xl py-3 pl-4 pr-2 text-lg font-bold text-white focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-600 transition-shadow">
                        <span class="absolute right-3 top-3 text-xs text-gray-500 font-bold uppercase">KG</span>
                    </div>
                </div>
            `;
        });

        div.innerHTML = `
            <h3 class="font-poppins font-bold text-lg text-white mb-2 ml-1"><span class="text-blue-500 mr-1">${index + 1}.</span> ${ex}</h3>
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
        // Prevent multiple bindings by assigning to property
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
        exercises: exerciseLogs
    };

    workoutHistory.push(session);
    localStorage.setItem('auraHistory', JSON.stringify(workoutHistory));
    
    updateDashboard();
    
    // Clear inputs by re-selecting the day
    selectDay(currentDayId);
    
    switchTab('dashboard');
    window.scrollTo(0,0);
}

// Progress Logic
function initChart() {
    const ctx = document.getElementById('volumeChart').getContext('2d');
    volumeChartInstance = new Chart(ctx, {
        type: 'bar', // changed to bar for mobile clarity
        data: {
            labels: [],
            datasets: [{
                label: 'Volume (kg)',
                data: [],
                backgroundColor: 'rgba(59, 130, 246, 0.8)',
                borderRadius: 4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8', font:{size: 10} } },
                x: { grid: { display: false }, ticks: { color: '#94a3b8', font:{size: 10} } }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function updateProgressChart() {
    if(!volumeChartInstance) return;
    
    // Group by date (simplistic)
    const labels = workoutHistory.map(h => new Date(h.date).toLocaleDateString(undefined, {month:'short', day:'numeric'}));
    const data = workoutHistory.map(h => h.totalVolume);
    
    volumeChartInstance.data.labels = labels;
    volumeChartInstance.data.datasets[0].data = data;
    volumeChartInstance.update();
}

function renderRecentLogs() {
    const container = document.getElementById('recent-logs');
    if(workoutHistory.length === 0) {
        container.innerHTML = '<p class="text-gray-500 italic text-center py-8">No workouts logged yet. Go crush a session!</p>';
        return;
    }
    
    container.innerHTML = '';
    const reversed = [...workoutHistory].reverse().slice(0, 10);
    
    reversed.forEach(log => {
        const div = document.createElement('div');
        div.className = 'glass-panel p-4 rounded-2xl flex justify-between items-center';
        div.innerHTML = `
            <div>
                <p class="font-poppins font-bold text-white">${log.dayName}</p>
                <p class="text-xs text-gray-400 font-bold">${new Date(log.date).toLocaleDateString()}</p>
            </div>
            <div class="text-right">
                <p class="font-bold text-blue-400 text-lg">${log.totalVolume.toLocaleString()} <span class="text-xs text-gray-500">KG</span></p>
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
        alert("Please configure your Gemini API Key in the settings (gear icon) first.");
        toggleApiSettings();
        return;
    }

    addChatMessage('user', text);
    input.value = '';

    // Append to chat history
    chatHistory.push({ role: 'user', parts: [{ text: text }] });

    // Show loading
    const loadingId = 'loading-' + Date.now();
    addChatMessage('ai', '<i class="fa-solid fa-spinner fa-spin"></i> Analyzing...', loadingId);

    try {
        let statsContext = `Context: The user has logged ${workoutHistory.length} workouts. Total volume moved: ${workoutHistory.reduce((a,b)=>a+b.totalVolume,0)}kg. Their routine is 5 days (Chest, Legs, Shoulders, Back, Arms). Answer concisely and motivating as a personal trainer.`;
        
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
        document.getElementById(loadingId).innerHTML = `<span class="text-red-400">Error connecting to AI.</span>`;
        chatHistory.pop();
    }
    
    scrollToBottom();
});

function addChatMessage(role, htmlContent, id = null) {
    const chatMsgs = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = `p-4 max-w-[85%] text-sm rounded-2xl ${role === 'user' ? 'bg-blue-600 ml-auto rounded-tr-none text-white' : 'bg-purple-900/30 border border-purple-500/30 rounded-tl-none text-gray-200'}`;
    if(id) div.id = id;
    
    if(role === 'ai') {
        div.innerHTML = `<div class="font-bold text-purple-300 mb-1"><i class="fa-solid fa-robot"></i> Aura AI</div><div class="prose prose-invert prose-sm">${htmlContent}</div>`;
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
    if(confirm('Delete all data? This resets your level and history.')) {
        localStorage.removeItem('auraHistory');
        workoutHistory = [];
        updateDashboard();
        if(currentDayId) selectDay(currentDayId);
        switchTab('dashboard');
    }
}
