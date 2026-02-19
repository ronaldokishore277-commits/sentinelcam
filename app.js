// =============================================
// SENTINELCAM - UPGRADED VERSION
// =============================================

// Get elements
const video = document.getElementById('camera-feed');
const overlayCanvas = document.getElementById('overlay-canvas');
const ctx = overlayCanvas.getContext('2d');
const loadingMsg = document.getElementById('loading-message');
const fpsDisplay = document.getElementById('fps-display');
const countDisplay = document.getElementById('count-display');
const lightDisplay = document.getElementById('light-display');
const confSlider = document.getElementById('confidence-slider');
const confValue = document.getElementById('conf-value');

// Variables
let model = null;
let isDetecting = false;
let frameCount = 0;
let lastFrameTime = performance.now();
let framesThisSecond = 0;
let currentFPS = 0;
let useFrontCamera = true;
let minConfidence = 0.5;

// =============================================
// STEP 1: Start Camera
// =============================================
async function startCamera(useFront = true) {
    try {
        const constraints = {
            video: {
                width: 640,
                height: 480,
                facingMode: useFront ? 'user' : 'environment'
            }
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        
        video.onloadedmetadata = () => {
            overlayCanvas.width = video.videoWidth;
            overlayCanvas.height = video.videoHeight;
            loadingMsg.style.display = 'none';
        };
    } catch (err) {
        console.error('Camera error:', err);
        alert('Cannot access camera. Please allow permission.');
    }
}

// =============================================
// STEP 2: Load AI Model
// =============================================
async function loadModel() {
    try {
        loadingMsg.style.display = 'block';
        loadingMsg.textContent = 'Loading AI model...';
        
        model = await cocoSsd.load();
        
        loadingMsg.style.display = 'none';
        console.log('Model loaded');
        return true;
    } catch (err) {
        console.error('Model error:', err);
        loadingMsg.textContent = 'Failed to load model. Refresh.';
        return false;
    }
}

// =============================================
// STEP 3: Detect Objects
// =============================================
async function detectObjects() {
    if (!model || isDetecting) return;
    
    isDetecting = true;
    
    try {
        const predictions = await model.detect(video);
        
        // Clear previous drawings
        ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        
        // Filter by confidence
        const validPredictions = predictions.filter(p => p.score > minConfidence);
        
        // Draw boxes
        validPredictions.forEach(pred => {
            const [x, y, width, height] = pred.bbox;
            
            // Choose color based on object type
            let color = '#00ff00'; // default green
            if (pred.class === 'person') color = '#ffaa00'; // orange for people
            if (pred.class === 'cell phone') color = '#ff00ff'; // pink for phones
            
            // Draw rectangle
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.strokeRect(x, y, width, height);
            
            // Draw label
            ctx.fillStyle = color;
            ctx.font = 'bold 16px Arial';
            ctx.fillText(
                `${pred.class} (${Math.round(pred.score * 100)}%)`,
                x, y > 20 ? y - 5 : 20
            );
        });
        
        // Update count
        countDisplay.textContent = validPredictions.length;
        
    } catch (err) {
        console.error('Detection error:', err);
    }
    
    isDetecting = false;
}

// =============================================
// STEP 4: Detect Light Level
// =============================================
function detectLightLevel() {
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    
    tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
    
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const data = imageData.data;
    
    let totalBrightness = 0;
    const samples = 100; // Check 100 random pixels for speed
    
    for (let i = 0; i < samples; i++) {
        const randomIndex = Math.floor(Math.random() * (data.length / 4)) * 4;
        const brightness = (data[randomIndex] + data[randomIndex+1] + data[randomIndex+2]) / 3;
        totalBrightness += brightness;
    }
    
    const avgBrightness = totalBrightness / samples;
    
    let level, color;
    if (avgBrightness < 50) {
        level = 'VERY DARK ⚠️';
        color = '#ff4444';
    } else if (avgBrightness < 100) {
        level = 'DARK ⚠️';
        color = '#ff8844';
    } else if (avgBrightness < 150) {
        level = 'LOW LIGHT';
        color = '#ffcc44';
    } else {
        level = 'GOOD LIGHT ✓';
        color = '#44ff44';
    }
    
    lightDisplay.innerHTML = level;
    lightDisplay.style.color = color;
}

// =============================================
// STEP 5: Calculate FPS
// =============================================
function calculateFPS() {
    framesThisSecond++;
    const now = performance.now();
    const delta = now - lastFrameTime;
    
    if (delta >= 1000) {
        currentFPS = framesThisSecond;
        fpsDisplay.textContent = currentFPS;
        framesThisSecond = 0;
        lastFrameTime = now;
    }
}

// =============================================
// STEP 6: Main Loop
// =============================================
function mainLoop() {
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        calculateFPS();
        frameCount++;
        
        // Run detection every 5th frame for speed
        if (frameCount % 5 === 0) {
            detectObjects();
        }
        
        // Check light every 30 frames
        if (frameCount % 30 === 0) {
            detectLightLevel();
        }
    }
    
    requestAnimationFrame(mainLoop);
}

// =============================================
// STEP 7: Save Photo
// =============================================
function savePhoto() {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    
    const link = document.createElement('a');
    link.download = `sentinelcam-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

// =============================================
// STEP 8: Event Listeners
// =============================================
function setupEventListeners() {
    // Confidence slider
    confSlider.addEventListener('input', (e) => {
        minConfidence = e.target.value / 100;
        confValue.textContent = e.target.value + '%';
    });
    
    // Save photo button
    document.getElementById('save-btn').addEventListener('click', savePhoto);
    
    // Switch camera button
    document.getElementById('camera-btn').addEventListener('click', () => {
        useFrontCamera = !useFrontCamera;
        startCamera(useFrontCamera);
    });
    
    // Fullscreen button
    document.getElementById('fullscreen-btn').addEventListener('click', () => {
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen();
        }
    });
}

// =============================================
// STEP 9: Initialize Everything
// =============================================
async function init() {
    await startCamera(useFrontCamera);
    const modelLoaded = await loadModel();
    
    if (modelLoaded) {
        setupEventListeners();
        setTimeout(mainLoop, 2000);
    }
}

// Start
window.onload = init;
