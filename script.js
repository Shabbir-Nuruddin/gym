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
    
    dayData.exercises.forEach((ex, index) => {
        const div = document.createElement('div');
        div.className = 'bg-gray-800/50 rounded-xl p-4 border border-gray-700/50';
        div.innerHTML = `
            <h3 class="font-bold text-lg mb-3 text-blue-100">${index + 1}. ${ex}</h3>
            <div class="grid grid-cols-3 gap-3">
                <div>
                    <label class="text-xs text-gray-400 uppercase tracking-wide">Sets</label>
                    <input type="number" min="0" value="3" class="ex-sets w-full bg-gray-900 border border-gray-600 rounded p-2 mt-1 text-center focus:border-blue-500 outline-none transition-colors">
                </div>
                <div>
                    <label class="text-xs text-gray-400 uppercase tracking-wide">Reps</label>
                    <input type="number" min="0" value="10" class="ex-reps w-full bg-gray-900 border border-gray-600 rounded p-2 mt-1 text-center focus:border-blue-500 outline-none transition-colors">
                </div>
                <div>
                    <label class="text-xs text-gray-400 uppercase tracking-wide">Weight (kg)</label>
                    <input type="number" min="0" step="0.5" placeholder="e.g. 20" class="ex-weight w-full bg-gray-900 border border-gray-600 rounded p-2 mt-1 text-center focus:border-blue-500 outline-none transition-colors">
                </div>
            </div>
        `;
        // Listen for inputs to enable save button
        div.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', checkWorkoutValid);
        });
        list.appendChild(div);
    });

    checkWorkoutValid();
}

function checkWorkoutValid() {
    const weights = document.querySelectorAll('.ex-weight');
    let hasValue = false;
    weights.forEach(w => { if(w.value > 0) hasValue = true; });
    
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

    const exerciseDivs = document.getElementById('exercise-list').children;
    
    for(let i=0; i<exerciseDivs.length; i++) {
        const name = dayData.exercises[i];
        const sets = parseFloat(exerciseDivs[i].querySelector('.ex-sets').value) || 0;
        const reps = parseFloat(exerciseDivs[i].querySelector('.ex-reps').value) || 0;
        const weight = parseFloat(exerciseDivs[i].querySelector('.ex-weight').value) || 0;
        
        const vol = sets * reps * weight;
        if(vol > 0) {
            sessionVolume += vol;
            exerciseLogs.push({ name, sets, reps, weight, vol });
        }
    }

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
    
    // Clear inputs
    document.querySelectorAll('.ex-weight').forEach(w => w.value = '');
    checkWorkoutValid();
    
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
