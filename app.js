// =============================================
// SENTINELCAM - Main Application Code
// =============================================

// Get elements from HTML
const video = document.getElementById('camera-feed');
const overlayCanvas = document.getElementById('overlay-canvas');
const ctx = overlayCanvas.getContext('2d');
const lightStatus = document.getElementById('light-status');
const detectionStatus = document.getElementById('detection-status');

// Global variables
let model = null;
let isDetecting = false;
let frameCount = 0;

// =============================================
// STEP 1: Start Camera
// =============================================
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: 640, 
                height: 480,
                facingMode: 'environment' // Use back camera on phone
            } 
        });
        video.srcObject = stream;
        
        // Wait for video to start playing
        video.onloadedmetadata = () => {
            overlayCanvas.width = video.videoWidth;
            overlayCanvas.height = video.videoHeight;
            console.log('Camera started');
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
        detectionStatus.innerHTML = 'Loading AI model...';
        model = await cocoSsd.load();
        detectionStatus.innerHTML = 'Model loaded. Ready to detect.';
        console.log('Model loaded');
        return true;
    } catch (err) {
        console.error('Model loading error:', err);
        detectionStatus.innerHTML = 'Failed to load AI model';
        return false;
    }
}

// =============================================
// STEP 3: Detect Objects in Frame
// =============================================
async function detectObjects() {
    if (!model || isDetecting) return;
    
    isDetecting = true;
    
    try {
        // Run detection
        const predictions = await model.detect(video);
        
        // Clear previous drawings
        ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        
        // Draw bounding boxes
        predictions.forEach(pred => {
            if (pred.score > 0.5) { // Only show confident detections
                const [x, y, width, height] = pred.bbox;
                
                // Draw rectangle
                ctx.strokeStyle = '#00ff00';
                ctx.lineWidth = 3;
                ctx.strokeRect(x, y, width, height);
                
                // Draw label
                ctx.fillStyle = '#00ff00';
                ctx.font = '16px Arial';
                ctx.fillText(
                    `${pred.class} (${Math.round(pred.score * 100)}%)`,
                    x, y > 20 ? y - 5 : 20
                );
            }
        });
        
        // Update detection status
        const people = predictions.filter(p => p.class === 'person').length;
        if (people > 0) {
            detectionStatus.innerHTML = `👤 ${people} person(s) detected`;
        } else {
            detectionStatus.innerHTML = `No people detected`;
        }
        
    } catch (err) {
        console.error('Detection error:', err);
    }
    
    isDetecting = false;
}

// =============================================
// STEP 4: Detect Light Level
// =============================================
function detectLightLevel() {
    // Create temporary canvas
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    
    // Draw current video frame
    tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
    
    // Get pixel data
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const data = imageData.data;
    
    let totalBrightness = 0;
    const pixelCount = data.length / 4;
    
    // Calculate average brightness
    for (let i = 0; i < data.length; i += 10) { // Sample every 10th pixel for speed
        const brightness = (data[i] + data[i+1] + data[i+2]) / 3;
        totalBrightness += brightness;
    }
    
    const avgBrightness = totalBrightness / (pixelCount / 10);
    
    // Determine light level
    let level, color;
    if (avgBrightness < 50) {
        level = 'VERY DARK';
        color = '#ff6b6b';
    } else if (avgBrightness < 100) {
        level = 'DARK';
        color = '#ffaa6b';
    } else if (avgBrightness < 150) {
        level = 'LOW LIGHT';
        color = '#ffe66b';
    } else {
        level = 'GOOD LIGHT';
        color = '#6bff6b';
    }
    
    lightStatus.innerHTML = `Light Level: <span style="color: ${color}">${level}</span>`;
    
    // Add warning if too dark
    if (avgBrightness < 100) {
        lightStatus.innerHTML += ` ⚠️ Turn on lights`;
    }
}

// =============================================
// STEP 5: Main Loop (Runs continuously)
// =============================================
function mainLoop() {
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        frameCount++;
        
        // Run detection every 10th frame (to save battery)
        if (frameCount % 10 === 0) {
            detectObjects();
        }
        
        // Check light level every 30th frame
        if (frameCount % 30 === 0) {
            detectLightLevel();
        }
    }
    
    requestAnimationFrame(mainLoop);
}

// =============================================
// STEP 6: Initialize Everything
// =============================================
async function init() {
    await startCamera();
    const modelLoaded = await loadModel();
    
    if (modelLoaded) {
        setTimeout(() => {
            mainLoop();
        }, 2000); // Wait 2 seconds for camera to stabilize
    }
}

// Start everything when page loads
window.onload = init;