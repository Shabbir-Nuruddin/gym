// Data Structure
const routine = [
    {
        id: 'chest',
        name: 'Chest Day',
        icon: 'fa-child-reaching',
        exercises: ['Flat Chest Press', 'Incline Chest Press', 'Flat Chest Fly', 'Incline Chest Fly', 'Pushups']
    },
    {
        id: 'legs',
        name: 'Leg Day',
        icon: 'fa-shoe-prints',
        exercises: ['Prisoner Squats', 'Chair Squats', 'Goblet Squats', 'Leg Extension', 'Lunges', 'Calf Raises']
    },
    {
        id: 'shoulders',
        name: 'Shoulders',
        icon: 'fa-person-arrow-up-from-line',
        exercises: ['Shoulder Press', 'Lateral Raises (Side)', 'Lateral Raises (Front)']
    },
    {
        id: 'back',
        name: 'Back Day',
        icon: 'fa-person-walking-luggage',
        exercises: ['Lat Pulldown Machine', 'Reverse Grip Lat Pulldown', 'Seated Cable Row', 'Dumbbell Rows']
    },
    {
        id: 'arms',
        name: 'Arms (Bi/Tri)',
        icon: 'fa-hand-fist',
        exercises: ['Dumbbell Bicep Curls', 'Hammer Curls', 'Tricep Rope Pushdowns', 'Overhead Tricep Extension']
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

    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    let activeNav = document.getElementById(`nav-${tabId}`);
    if(activeNav) activeNav.classList.add('active');

    // Bottom nav highlights
    document.querySelectorAll('nav.fixed a').forEach(el => {
        el.classList.remove('text-blue-500');
        el.classList.add('text-gray-400');
    });
    let activeBottom = document.querySelector(`nav.fixed a[onclick="switchTab('${tabId}')"]`);
    if(activeBottom) {
        activeBottom.classList.remove('text-gray-400');
        activeBottom.classList.add('text-blue-500');
    }

    if(tabId === 'progress') {
        updateProgressChart();
        renderRecentLogs();
    }
}

function updateDashboard() {
    document.getElementById('dash-workout-count').innerText = workoutHistory.length;
    let totalVol = workoutHistory.reduce((sum, session) => sum + session.totalVolume, 0);
    document.getElementById('dash-total-volume').innerText = totalVol + ' kg';
    
    // Naive next workout: (history length % 5) index
    let nextIndex = workoutHistory.length % 5;
    document.getElementById('dash-next-workout').innerText = routine[nextIndex].name;
}

// Workout Logic
function renderRoutineTabs() {
    const container = document.getElementById('day-selector');
    container.innerHTML = '';
    routine.forEach(day => {
        const btn = document.createElement('button');
        btn.onclick = () => selectDay(day.id);
        btn.className = `whitespace-nowrap px-6 py-3 rounded-xl font-semibold transition-all ${day.id === currentDayId ? 'gradient-bg text-white shadow-lg shadow-blue-500/20' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'}`;
        btn.innerHTML = `<i class="fa-solid ${day.icon} mr-2"></i> ${day.name}`;
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
        window.currentWorkoutSets[index] = [ { reps: 12, weight: '' }, { reps: 10, weight: '' }, { reps: 8, weight: '' } ];
        
        const div = document.createElement('div');
        div.className = 'bg-gray-800/50 rounded-xl p-4 border border-gray-700/50';
        div.id = `exercise-container-${index}`;
        
        renderExerciseSets(index, ex, div);
        
        list.appendChild(div);
    });

    checkWorkoutValid();
}

function renderExerciseSets(exIndex, exName, container) {
    let setsHtml = '';
    window.currentWorkoutSets[exIndex].forEach((set, sIndex) => {
        setsHtml += `
            <div class="grid grid-cols-12 gap-2 items-center mt-2">
                <div class="col-span-2 text-gray-400 text-sm font-semibold">Set ${sIndex + 1}</div>
                <div class="col-span-4">
                    <input type="number" min="0" placeholder="Reps" value="${set.reps}" oninput="updateSet(${exIndex}, ${sIndex}, 'reps', this.value)" class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-center focus:border-blue-500 outline-none transition-colors">
                </div>
                <div class="col-span-1 text-center text-gray-500">x</div>
                <div class="col-span-4">
                    <input type="number" min="0" step="0.5" placeholder="kg" value="${set.weight}" oninput="updateSet(${exIndex}, ${sIndex}, 'weight', this.value)" class="ex-weight w-full bg-gray-900 border border-gray-600 rounded p-2 text-center focus:border-blue-500 outline-none transition-colors">
                </div>
                <div class="col-span-1 text-right">
                    <button onclick="removeSet(${exIndex}, ${sIndex})" class="text-red-500/50 hover:text-red-500"><i class="fa-solid fa-xmark"></i></button>
                </div>
            </div>
        `;
    });

    container.innerHTML = `
        <div class="flex justify-between items-center mb-3">
            <h3 class="font-bold text-lg text-blue-100">${exIndex + 1}. ${exName}</h3>
            <button onclick="addSet(${exIndex})" class="text-xs bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full hover:bg-blue-500/30 transition-colors">+ Add Set</button>
        </div>
        <div class="space-y-1">
            ${setsHtml}
        </div>
    `;
}

window.updateSet = function(exIndex, sIndex, field, value) {
    window.currentWorkoutSets[exIndex][sIndex][field] = value;
    checkWorkoutValid();
};

window.addSet = function(exIndex) {
    const dayData = routine.find(d => d.id === currentDayId);
    let defaultReps = 8;
    const sets = window.currentWorkoutSets[exIndex];
    if (sets.length > 0) defaultReps = sets[sets.length - 1].reps;
    
    sets.push({ reps: defaultReps, weight: '' });
    renderExerciseSets(exIndex, dayData.exercises[exIndex], document.getElementById(`exercise-container-${exIndex}`));
};

window.removeSet = function(exIndex, sIndex) {
    const dayData = routine.find(d => d.id === currentDayId);
    window.currentWorkoutSets[exIndex].splice(sIndex, 1);
    renderExerciseSets(exIndex, dayData.exercises[exIndex], document.getElementById(`exercise-container-${exIndex}`));
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
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
        btn.onclick = saveWorkout;
    } else {
        btn.classList.add('opacity-50', 'cursor-not-allowed');
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
    
    alert(`Awesome job! You moved ${sessionVolume} kg today. Keep grinding!`);
}

// Progress Logic
function initChart() {
    const ctx = document.getElementById('volumeChart').getContext('2d');
    volumeChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Session Volume (kg)',
                data: [],
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#8b5cf6',
                pointBorderColor: '#fff',
                pointRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94a3b8' } },
                x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
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
    const reversed = [...workoutHistory].reverse().slice(0, 5); // show last 5
    
    reversed.forEach(log => {
        const div = document.createElement('div');
        div.className = 'bg-gray-800/40 p-4 rounded-lg border border-gray-700/50 flex justify-between items-center';
        div.innerHTML = `
            <div>
                <p class="font-bold text-white">${log.dayName}</p>
                <p class="text-xs text-gray-400">${new Date(log.date).toLocaleDateString()}</p>
            </div>
            <div class="text-right">
                <p class="font-bold text-blue-400">${log.totalVolume} kg</p>
                <p class="text-xs text-gray-500">${log.exercises.length} exercises</p>
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
        alert("Please configure your Gemini API Key in the settings first.");
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

    // Call Gemini API
    try {
        // Inject current stats into prompt dynamically
        let statsContext = `Context: The user has logged ${workoutHistory.length} workouts. Total volume moved: ${workoutHistory.reduce((a,b)=>a+b.totalVolume,0)}kg. Their routine is 5 days (Chest, Legs, Shoulders, Back, Arms). Answer concisely and motivating as a personal trainer.`;
        
        // Prepare payload (System instruction can be simulated by modifying the latest user prompt if API doesn't support it directly in this shape)
        let requestHistory = [...chatHistory];
        requestHistory[requestHistory.length-1].parts[0].text = `${statsContext}\n\nUser: ${text}`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: requestHistory,
                generationConfig: {
                    maxOutputTokens: 500,
                    temperature: 0.7
                }
            })
        });

        if(!response.ok) throw new Error("API Error: " + response.statusText);
        
        const data = await response.json();
        const reply = data.candidates[0].content.parts[0].text;
        
        chatHistory.push({ role: 'model', parts: [{ text: reply }] });
        
        document.getElementById(loadingId).innerHTML = marked.parse(reply);
    } catch(err) {
        console.error(err);
        document.getElementById(loadingId).innerHTML = `<span class="text-red-400">Error: Could not reach the trainer. Check your API key or connection.</span>`;
        chatHistory.pop(); // remove user message from history if failed so retry works
    }
    
    scrollToBottom();
});

function addChatMessage(role, htmlContent, id = null) {
    const chatMsgs = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = `chat-message ${role} p-4 max-w-[85%] ${role === 'user' ? 'ml-auto' : ''}`;
    if(id) div.id = id;
    
    let icon = role === 'user' ? '<i class="fa-solid fa-user"></i> You' : '<i class="fa-solid fa-robot"></i> Trainer';
    let color = role === 'user' ? 'text-blue-400' : 'text-purple-400';
    
    div.innerHTML = `
        <div class="flex items-center ${role === 'user' ? 'justify-end' : ''} gap-2 mb-2 font-semibold ${color}">
            ${icon}
        </div>
        <div class="text-gray-200 markdown-body prose prose-invert max-w-none text-sm md:text-base">
            ${role === 'user' ? htmlContent : marked.parse(htmlContent)}
        </div>
    `;
    
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
    if(confirm('Are you sure you want to delete all workout history? This cannot be undone.')) {
        localStorage.removeItem('auraHistory');
        workoutHistory = [];
        updateDashboard();
        if(currentDayId) selectDay(currentDayId);
        if(!document.getElementById('tab-progress').classList.contains('hidden')) {
            updateProgressChart();
            renderRecentLogs();
        }
        alert('Data reset successfully.');
    }
}
