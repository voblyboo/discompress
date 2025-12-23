const { createFFmpeg, fetchFile } = FFmpeg;

// Initialize FFmpeg
// corePath is required to load the WebAssembly file from the CDN
const ffmpeg = createFFmpeg({ 
    log: true,
    corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js' 
});

const fileInput = document.getElementById('video-upload');
const compressBtn = document.getElementById('compress-btn');
const downloadBtn = document.getElementById('download-btn');
const inputVideo = document.getElementById('input-video');
const outputVideo = document.getElementById('output-video');
const progressBar = document.getElementById('progress-bar');
const progressContainer = document.getElementById('progress-container');
const statusText = document.getElementById('status-text');

let originalFile = null;

// Initialize the FFmpeg engine
(async () => {
    try {
        statusText.innerText = "Loading FFmpeg core... Please wait.";
        await ffmpeg.load();
        statusText.innerText = "Ready to upload.";
    } catch (e) {
        statusText.innerText = "Error: Please run this on a local server (http://localhost), not file://";
        console.error(e);
    }
})();

// Format bytes to MB
const formatSize = (bytes) => (bytes / (1024 * 1024)).toFixed(2) + ' MB';

// Handle File Selection
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    originalFile = file;

    // Reset UI
    outputVideo.style.display = 'none';
    document.getElementById('output-label').style.display = 'none';
    document.getElementById('output-stats').innerText = '';
    downloadBtn.classList.add('disabled');
    downloadBtn.removeAttribute('href');
    progressBar.style.width = '0%';
    progressContainer.style.display = 'none';

    // Show Input Preview
    const fileURL = URL.createObjectURL(file);
    inputVideo.src = fileURL;
    inputVideo.style.display = 'block';
    document.getElementById('input-label').style.display = 'block';
    document.getElementById('input-stats').innerText = `Size: ${formatSize(file.size)}`;

    // Enable Compress Button once metadata is loaded (to get duration)
    inputVideo.onloadedmetadata = () => {
        compressBtn.disabled = false;
        compressBtn.classList.remove('disabled');
        statusText.innerText = `Selected: ${file.name}`;
    };
});

// Handle Compression
compressBtn.addEventListener('click', async () => {
    if (!originalFile) return;

    // Lock UI
    compressBtn.disabled = true;
    compressBtn.classList.add('disabled');
    fileInput.disabled = true;
    progressContainer.style.display = 'block';
    statusText.innerText = "Starting compression...";

    const duration = inputVideo.duration;
    
    // TARGET CALCULATION
    // Goal: < 10MB. Let's aim for 9.5MB to be safe for Discord.
    // 9.5 MB = 9.5 * 8192 kilobits = 77824 kilobits
    // Target Bitrate (kbps) = 77824 / duration_in_seconds
    // We subtract 128kbps for audio to leave room for sound.
    
    const targetSizeMB = 9.5;
    const targetTotalBitrateKbps = (targetSizeMB * 8192) / duration;
    let videoBitrate = Math.floor(targetTotalBitrateKbps - 128); // allocate 128k for audio

    // Safety checks
    if (videoBitrate < 100) videoBitrate = 100; // Minimum watchable quality
    
    const inputName = 'input.mp4';
    const outputName = 'output.mp4';

    // Write file to FFmpeg's virtual file system
    ffmpeg.FS('writeFile', inputName, await fetchFile(originalFile));

    // Progress Listener
    ffmpeg.setProgress(({ ratio }) => {
        const percent = Math.round(ratio * 100);
        progressBar.style.width = `${percent}%`;
        statusText.innerText = `Compressing... ${percent}%`;
    });

    statusText.innerText = `Calculating bitrate: ${videoBitrate}k (Target: ~9.5MB)`;

    // Run FFmpeg Command
    // -i: Input
    // -c:v libx264: Video Codec
    // -b:v: Video Bitrate
    // -c:a aac -b:a 128k: Audio Codec and Bitrate
    // -preset ultrafast: Faster compression (sacrifices a tiny bit of quality for speed)
    await ffmpeg.run(
        '-i', inputName,
        '-c:v', 'libx264',
        '-b:v', `${videoBitrate}k`,
        '-c:a', 'aac',
        '-b:a', '128k',
        '-preset', 'ultrafast',
        outputName
    );

    // Read result
    const data = ffmpeg.FS('readFile', outputName);
    
    // Create Blob for download/preview
    const compressedBlob = new Blob([data.buffer], { type: 'video/mp4' });
    const compressedURL = URL.createObjectURL(compressedBlob);

    // Update Output UI
    outputVideo.src = compressedURL;
    outputVideo.style.display = 'block';
    document.getElementById('output-label').style.display = 'block';
    document.getElementById('output-stats').innerText = `New Size: ${formatSize(compressedBlob.size)}`;

    // Setup Download Button
    downloadBtn.href = compressedURL;
    downloadBtn.download = `compressed_${originalFile.name}`;
    downloadBtn.classList.remove('disabled');

    // Reset UI Logic
    statusText.innerText = "Compression Complete!";
    compressBtn.disabled = false;
    compressBtn.classList.remove('disabled');
    fileInput.disabled = false;
});