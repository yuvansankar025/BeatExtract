/* 
   BeatExtract - Frontend Scripts 
   Handles Drag & Drop, File Validation, Loader Overlay, and Web Audio API Mixing
*/

document.addEventListener('DOMContentLoaded', () => {
    // ----------------------------------------------------
    // STUDIO PAGE LOGIC (Drag & drop, upload)
    // ----------------------------------------------------
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('audioFile');
    const fileDetails = document.getElementById('fileDetails');
    const fileName = document.getElementById('fileName');
    const fileMeta = document.getElementById('fileMeta');
    const removeFileBtn = document.getElementById('removeFileBtn');
    const uploadForm = document.getElementById('uploadForm');
    const loaderOverlay = document.getElementById('loaderOverlay');
    const submitBtn = document.getElementById('submitBtn');
    
    // Toast Notification System
    window.showToast = function(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = type === 'success' ? 'ph-check-circle' : 'ph-warning-circle';
        toast.innerHTML = `
            <i class="ph-fill ${icon}" style="font-size: 1.5rem;"></i>
            <span>${message}</span>
        `;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }
    
    if (dropZone && fileInput) {
        function formatBytes(bytes, decimals = 2) {
            if (!+bytes) return '0 Bytes';
            const k = 1024;
            const dm = decimals < 0 ? 0 : decimals;
            const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
        }
        
        function handleFile(file) {
            const allowed = ['.mp3', '.wav', '.flac', '.ogg', '.m4a'];
            const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
            if (!allowed.includes(ext)) {
                showToast(`Unsupported format: ${ext}. Please use MP3, WAV, FLAC, OGG, or M4A.`, 'error');
                resetFile();
                return;
            }
            fileName.textContent = file.name;
            fileMeta.textContent = formatBytes(file.size);
            dropZone.style.display = 'none';
            fileDetails.classList.add('active');
            showToast('File loaded successfully.', 'success');
        }
        
        function resetFile() {
            fileInput.value = '';
            dropZone.style.display = 'flex';
            fileDetails.classList.remove('active');
        }
        
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, e => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });
        
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
        });
        
        dropZone.addEventListener('drop', (e) => {
            if (e.dataTransfer.files.length > 0) {
                fileInput.files = e.dataTransfer.files;
                handleFile(e.dataTransfer.files[0]);
            }
        });
        
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) handleFile(fileInput.files[0]);
        });
        
        removeFileBtn.addEventListener('click', (e) => {
            e.preventDefault();
            resetFile();
        });
        
        uploadForm.addEventListener('submit', (e) => {
            if (fileInput.files.length === 0) {
                e.preventDefault();
                showToast('Please select an audio file first.', 'error');
                return;
            }
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="ph-bold ph-spinner ph-spin"></i> Processing...';
            loaderOverlay.classList.add('active');
        });
    }
    
    // Add hover effects for stem cards in results page
    const stemCards = document.querySelectorAll('.stem-card audio');
    stemCards.forEach(audio => {
        audio.addEventListener('play', () => {
            audio.closest('.stem-card').style.borderColor = 'var(--primary)';
        });
        audio.addEventListener('pause', () => {
            audio.closest('.stem-card').style.borderColor = 'var(--glass-border)';
        });
    });
});

// ----------------------------------------------------
// RESULTS PAGE LOGIC (Web Audio API Mixing)
// ----------------------------------------------------
let audioContext = null;
let audioBuffers = {};
let currentSource = null;
let mixedBuffer = null;

function getSelectedStems() {
    const selected = document.querySelectorAll('.stem-check:checked');
    return Array.from(selected).map(cb => cb.value);
}

async function loadAudio(stem) {
    if (audioBuffers[stem]) return audioBuffers[stem];
    
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    const audioElement = document.getElementById(stem + '-audio');
    if (!audioElement) return null;
    
    const response = await fetch(audioElement.src);
    const data = await response.arrayBuffer();
    const buffer = await audioContext.decodeAudioData(data);
    
    audioBuffers[stem] = buffer;
    return buffer;
}

async function createMix() {
    const selected = getSelectedStems();
    const status = document.getElementById('mixStatus');
    
    if (selected.length === 0) {
        if(status) status.innerHTML = '<span style="color: var(--danger)"><i class="ph-bold ph-warning-circle"></i> Please select at least one instrument.</span>';
        if(window.showToast) window.showToast("Please select at least one instrument.", "error");
        return null;
    }
    
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    if(status) status.innerHTML = '<i class="ph-bold ph-spinner ph-spin"></i> Preparing mix...';
    
    const buffers = [];
    for (const stem of selected) {
        const buffer = await loadAudio(stem);
        if(buffer) buffers.push(buffer);
    }
    
    if(buffers.length === 0) return null;
    
    let longestLength = 0;
    let sampleRate = buffers[0].sampleRate;
    
    buffers.forEach(buffer => {
        if (buffer.length > longestLength) longestLength = buffer.length;
    });
    
    const output = audioContext.createBuffer(2, longestLength, sampleRate);
    
    // Mix the buffers
    buffers.forEach(buffer => {
        for (let channel = 0; channel < 2; channel++) {
            const outputData = output.getChannelData(channel);
            const sourceChannel = Math.min(channel, buffer.numberOfChannels - 1);
            const inputData = buffer.getChannelData(sourceChannel);
            
            for (let i = 0; i < inputData.length; i++) {
                outputData[i] += inputData[i];
            }
        }
    });
    
    // Normalize to prevent clipping
    for (let channel = 0; channel < 2; channel++) {
        const data = output.getChannelData(channel);
        let max = 0;
        for (let i = 0; i < data.length; i++) {
            max = Math.max(max, Math.abs(data[i]));
        }
        if (max > 1) {
            for (let i = 0; i < data.length; i++) {
                data[i] /= max;
            }
        }
    }
    
    mixedBuffer = output;
    return output;
}

window.playSelected = async function() {
    const status = document.getElementById('mixStatus');
    try {
        const buffer = await createMix();
        if (!buffer) return;
        
        window.stopAudio(); // stop anything playing
        
        currentSource = audioContext.createBufferSource();
        currentSource.buffer = buffer;
        currentSource.connect(audioContext.destination);
        currentSource.start(0);
        
        if(status) status.innerHTML = '<i class="ph-bold ph-speaker-high"></i> Playing selected instruments in sync...';
        
        currentSource.onended = function () {
            if(status) status.innerHTML = '<i class="ph-bold ph-check"></i> Playback finished';
            currentSource = null;
        };
    } catch (error) {
        console.error(error);
        if(status) status.innerHTML = '<span style="color: var(--danger)"><i class="ph-bold ph-x-circle"></i> Unable to play audio.</span>';
    }
}

window.stopAudio = function() {
    if (currentSource) {
        try { currentSource.stop(); } catch (e) {}
        currentSource = null;
    }
    
    // Reset all individual HTML5 audio players just in case
    document.querySelectorAll('audio').forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
    });
    
    const status = document.getElementById('mixStatus');
    if (status) status.innerHTML = '<i class="ph-bold ph-stop"></i> Playback stopped';
}

function audioBufferToWav(buffer) {
    const channels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const bits = 16;
    const dataSize = buffer.length * channels * 2;
    const arrayBuffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(arrayBuffer);
    
    function writeString(offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * channels * 2, true);
    view.setUint16(32, channels * 2, true);
    view.setUint16(34, bits, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);
    
    let offset = 44;
    const channelData = [];
    for (let channel = 0; channel < channels; channel++) {
        channelData.push(buffer.getChannelData(channel));
    }
    
    for (let i = 0; i < buffer.length; i++) {
        for (let channel = 0; channel < channels; channel++) {
            let sample = channelData[channel][i];
            sample = Math.max(-1, Math.min(1, sample));
            const value = sample < 0 ? sample * 32768 : sample * 32767;
            view.setInt16(offset, value, true);
            offset += 2;
        }
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
}

window.downloadSelected = async function() {
    const status = document.getElementById('mixStatus');
    const selected = getSelectedStems();
    
    if (selected.length === 0) {
        if(status) status.innerHTML = '<span style="color: var(--danger)"><i class="ph-bold ph-warning-circle"></i> Please select at least one instrument to download.</span>';
        if(window.showToast) window.showToast("Please select at least one instrument to download.", "error");
        return;
    }
    
    try {
        const buffer = await createMix();
        if (!buffer) return;
        
        if(status) status.innerHTML = '<i class="ph-bold ph-spinner ph-spin"></i> Generating mixed audio file...';
        
        // Export to WAV natively in browser as MP3 encoding requires heavy third-party libraries
        const wavBlob = audioBufferToWav(buffer);
        const url = URL.createObjectURL(wavBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = 'BeatExtract_Mix.wav';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        if(status) status.innerHTML = '<i class="ph-bold ph-check-circle"></i> Download complete';
        if(window.showToast) window.showToast("Mixed audio downloaded successfully.", "success");
    } catch (error) {
        console.error(error);
        if(status) status.innerHTML = '<span style="color: var(--danger)"><i class="ph-bold ph-x-circle"></i> Download failed</span>';
        if(window.showToast) window.showToast("Download failed.", "error");
    }
}
